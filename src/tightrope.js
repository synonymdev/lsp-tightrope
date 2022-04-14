const config = require('config')
const crypto = require('crypto')
const Hyperswarm = require('hyperswarm')
const bs58 = require('bs58')
const signMessage = require('./util/sign')
const Lightning = require('./lightning')
const Audit = require('./audit')

class Tightrope extends Audit {
  /**
   * Set up the local instance and get the config secret
   */
  constructor (lnNodeInfo) {
    super()

    // Shared secret that all lightning nodes in the cluster should know
    this.secret = config.get('secret')

    // We generate a topic from the secret...
    this.topic = this.sha256(this.secret)
    this.topicBase58 = bs58.encode(this.topic)

    // The hyperswarm (created in connect)
    this.swarm = null
    this.myPublicKey = null

    // active connections with peers
    this.activeConnections = []
    this.channelOwners = []

    // track the node info
    this.lnNodeInfo = lnNodeInfo

    // Log something
    this.logEvent('booting')
  }

  /**
   * Attempt to connect to the Hyperswarm and find peers
   */
  async connect () {
    try {
      // Connect to the lightning node
      this.lightning = new Lightning(this.lnNodeInfo)
      await this.lightning.connect()
      this.lightning.on('requestRebalance', (id, request, tokens) => this.onRequestRebalance(id, request, tokens))

      // Create a new one
      const swarm = new Hyperswarm()
      this.swarm = swarm
      this.myPublicKey = bs58.encode(swarm.keyPair.publicKey)

      // Add handlers
      swarm.on('close', () => console.log('close'))

      swarm.on('disconnection', () => console.log('disconnection'))
      swarm.on('peer', () => console.log('peer'))
      swarm.on('peer-rejected', () => console.log('peer-rejected'))
      swarm.on('updated', () => console.log('updated'))

      swarm.on('connection', (socket, peerInfo) => this.onOpenConnection(socket, peerInfo))

      // join the hyperswarm on the topic we derived from the secret
      swarm.join(this.topic)

      this.logEvent('swarmConnected', { topic: this.topicBase58 })
    } catch (err) {
      this.logEvent('startupError', { error: err })
    }
  }

  /**
   * Cleanly shutdown
   */
  async shutdown () {
    this.logEvent('shutdown')

    // leave the swarm, so we don't connect with anyone new
    if (this.swarm) {
      await this.swarm.leave(this.topic)
      await this.swarm.destroy()
      this.swarm = null
    }

    try {
      // Drop all the open connections with peers
      this.activeConnections.forEach((c) => c.socket.end())
    } catch (err) {
      console.log(err)
    }

    // reset the list of peers
    this.activeConnections = []

    // Close the connection to the lightning node
    await this.lightning.disconnect()
  }

  /**
   * Called when a new connection is established with a peer
   * @param {*} socket
   * @param {*} peerInfo
   */
  onOpenConnection (socket, peerInfo) {
    // swarm1 will receive server connections
    const remotePublicKey = bs58.encode(peerInfo.publicKey)
    this.logEvent('peerConnected', { remotePeer: remotePublicKey })

    // Set up the connection so we know when it fails
    socket.setKeepAlive(5000)
    socket.setTimeout(7000)

    // add it to the list of open connections
    this.addActiveConnection(remotePublicKey, socket)

    // handle data
    socket.on('data', data => this.onMessage(remotePublicKey, data.toString()))

    socket.on('end', () => { socket.end() })
    socket.on('close', () => this.onCloseConnection(remotePublicKey))
    socket.on('error', (err) => console.log(`Error on connection to ${remotePublicKey}`, err.message))

    this.sendMessage(remotePublicKey, { type: 'hello', lnPublicKey: this.lightning.publicKey, lnAlias: this.lightning.alias })
  }

  /**
   * Called when the socket connection to a peer is closed for some reason
   * @param {*} remotePublicKey
   */
  onCloseConnection (remotePeer) {
    this.removeActiveConnection(remotePeer)
    this.logEvent('peerDisconnected', { remotePeer })
  }

  /**
   * Called when we get a new message on the socket from a peer
   * Validates that the message has been correctly signed
   * @param {*} data
   */
  async onMessage (remotePeer, data) {
    const obj = JSON.parse(data)

    // Check the signature is a match (ie, they know the secret)
    const signature = signMessage(this.secret, obj.timestamp, remotePeer, obj.message)
    if (signature !== obj.signature) {
      this.logEvent('errorBadSig', { remotePeer, message: data })
      return
    }

    // Check that the message is recent (reduce replay attacks)
    const now = Date.now()
    const age = Math.abs(now - obj.timestamp)
    if (age > 5000) {
      this.logEvent('errorOldMsg', { remotePeer, messageAge: age, message: data })
      return
    }

    // do something
    switch (obj.message.type) {
      case 'hello':
        await this.onHello(remotePeer, obj.message)
        break

      case 'payInvoice':
        await this.onPayInvoice(remotePeer, obj.message)
        break

      case 'paymentResult':
        await this.onPaymentResult(remotePeer, obj.message)
        break

      default:
        console.log(`unknown action from remote peer ${remotePeer}`)
        console.log(obj)
        break
    }
  }

  /**
   * Called when we receive a valid 'hello' message from a remote peer
   * @param {*} remotePeer
   * @param {*} msg
   */
  async onHello (remotePeer, msg) {
    this.logEvent('peerHello', { remotePeer, publicKey: msg.lnPublicKey, alias: msg.lnAlias })

    // Discover if we have any channels open with this node
    const channels = await this.lightning.findChannelsFromPubKey(msg.lnPublicKey)
    if (channels.length > 0) {
      channels.forEach((c) => {
        // log it
        this.logEvent('peerSharedChannel', { remotePeer, remoteAlias: msg.lnAlias, localAlias: this.lightning.alias, channelInfo: c })

        // track the owner of this channel
        this.channelOwners = this.channelOwners.filter((owner) => owner.channelId !== c.id)
        this.channelOwners.push({ channelId: c.id, remotePeer, remoteLightning: msg.lnPublicKey })

        // watch the channel for it to go out of balance
        this.lightning.watchChannel(c.id)
      })
    }
  }

  /**
   * Called when a remote peer has asked us to pay an invoice
   * The message will have been signed to confirm they are part of the cluster
   * @param {*} remotePeer
   * @param {*} msg
   */
  async onPayInvoice (remotePeer, msg) {
    this.logEvent('onPayInvoice', { channelId: msg.channelId, invoice: msg.invoice, amount: msg.tokens })
    const result = await this.lightning.payInvoice(msg.invoice)
    this.sendMessage(remotePeer, { ...result, channelId: msg.channelId, type: 'paymentResult' })
  }

  /**
   * Called when a remote peer has completed it's attempt to pay an invoice.
   * The payload indicates if the payment was a success or not
   * @param {*} remotePeer
   * @param {*} msg
   */
  async onPaymentResult (remotePeer, msg) {
    this.logEvent('onPaymentResult', { remotePeer, ...msg })
    await this.lightning.confirmPayment(msg)
  }

  /**
   * Event handler called when an invoice needs to be paid
   * @param {*} id - channel id
   * @param {*} request - Bolt 11 encoded invoice
   * @param {*} tokens - how much was it for
   */
  async onRequestRebalance (channel, request, tokens) {
    const owner = this.channelOwners.find((c) => c.channelId === channel.id)
    if (owner) {
      this.logEvent('onRequestRebalance', { remotePeer: owner.remotePeer, invoice: request, amount: tokens, channelId: channel.id })
      this.sendMessage(owner.remotePeer, { type: 'payInvoice', invoice: request, tokens, channelId: channel.id })
    }
  }

  /**
   * Sends a message to a remote peer, signing it
   * @param {*} to
   * @param {*} message
   * @returns
   */
  sendMessage (to, message) {
    const socket = this.findConnection(to)
    if (!socket) {
      this.logEvent('missingConnection', { remotePeer: to })
      return
    }

    const timestamp = Date.now()
    const signature = signMessage(this.secret, timestamp, this.myPublicKey, message)
    socket.write(JSON.stringify({ message, timestamp, signature }))
  }

  /**
   * Adds an active socket connection to our list of open connections
   * @param {*} remotePublicKey
   * @param {*} socket
   */
  addActiveConnection (remotePublicKey, socket) {
    this.removeActiveConnection(remotePublicKey)
    this.activeConnections.push({ remotePublicKey, socket })
  }

  /**
   * Removes an active socket connection from the list (eg when it is being closed)
   * @param {*} remotePublicKey
   */
  removeActiveConnection (remotePublicKey) {
    this.activeConnections = this.activeConnections.filter(c => c.remotePublicKey !== remotePublicKey)

    // also, remove and channels we were watching that belongs to this peer
    this.channelOwners.forEach((c) => {
      if (c.remotePeer === remotePublicKey) {
        this.lightning.unwatchChannel(c.channelId)
      }
    })

    // remove them from the channel owners list also
    this.channelOwners = this.channelOwners.filter((owner) => owner.remotePeer !== remotePublicKey)
  }

  /**
   * Given a peers public key, find the socket connection to them
   * @param {*} remotePublicKey
   * @returns
   */
  findConnection (remotePublicKey) {
    const result = this.activeConnections.find(c => c.remotePublicKey === remotePublicKey)
    if (result) {
      return result.socket
    }

    return null
  }

  /**
   * Given a string, calculate the sha256 hash of it and base58 encode the result
   * @param {*} message
   * @returns
   */
  sha256 (message) {
    return crypto.createHash('sha256').update(message).digest()
  }
}

module.exports = Tightrope
