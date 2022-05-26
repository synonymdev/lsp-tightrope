const BigNumber = require('bignumber.js')
const lnService = require('ln-service')
const Lightning = require('./lightning')

// https://github.com/alexbosworth/ln-service

class Lnd extends Lightning {
  /**
   * Set up the lightning node connection
   * @param {*} node { cert, macaroon, socket }
   */
  constructor (node) {
    super()

    // LND credentials
    this.cert = node.cert
    this.macaroon = node.macaroon
    this.socket = node.socket

    // The lnd GRPC connection
    this.lnd = null

    this.type = 'LND'
  }

  /**
   * Attempt to connect to the node using the credentials given
   */
  async connect () {
    // Already connected?
    if (this.lnd) {
      return
    }

    // Connect to the light node...
    const credentials = {
      cert: this.cert,
      macaroon: this.macaroon,
      socket: this.socket
    }

    // Connect and remember
    const auth = lnService.authenticatedLndGrpc(credentials)
    this.lnd = auth.lnd

    // Get some basic wallet details
    const walletInfo = await lnService.getWalletInfo({ lnd: this.lnd })
    this.publicKey = walletInfo.public_key
    this.alias = walletInfo.alias
    this.version = walletInfo.version

    // do the common stuff
    await super.connect()
  }

  /**
   * Clean up the connection
   */
  async disconnect () {
    super.disconnect()
    this.lnd = null
  }

  /**
   * Are we connected to a node?
   * @returns true if we have a connection
   */
  _hasConnection () {
    // we have a connection if the lnd object isn't null
    return this.lnd !== null
  }

  /**
   * Create an invoice
   * @param {*} tokens
   * @param {*} expiresAt
   */
  async _createInvoice (tokens, lifespan) {
    const expiresAt = new Date(Date.now() + lifespan)
    const invoice = await lnService.createInvoice({
      lnd: this.lnd,
      description: 'tightrope rebalance',
      expires_at: expiresAt.toISOString(),
      tokens: tokens
    })

    // return the bolt11 invoice request
    return invoice.request
  }

  /**
   * Pay the invoice
   * @param {*} invoice
   * @param {*} outgoingChannelHint
   */
  async _pay (invoice, outgoingChannelHint) {
    const payment = await lnService.pay({ lnd: this.lnd, request: invoice, outgoing_channel: outgoingChannelHint })

    return {
      paymentId: payment?.id || null,
      confirmed: payment?.is_confirmed || false,
      confirmedAt: payment?.confirmed_at || null
    }
  }

  /**
   * Decode a bolt 11 invoice request
   * @param {*} invoice
   */
  async _decode (invoice) {
    const details = await lnService.decodePaymentRequest({ lnd: this.lnd, request: invoice })

    return {
      amount: +details.tokens,
      destination: details.destination
    }
  }

  /**
   * Get the list of channels on the node, remapped to our internal format
   */
  async _mappedChannels () {
    const channelList = await lnService.getChannels({ lnd: this.lnd })
    return channelList.channels.map((c) => ({
      id: c.id,
      localAlias: this.alias,
      localPublicKey: this.publicKey,
      remotePublicKey: c.partner_public_key,
      localBalance: new BigNumber(c.local_balance),
      remoteBalance: new BigNumber(c.remote_balance),
      capacity: new BigNumber(c.capacity),
      isActive: c.is_active,
      isClosing: c.is_closing,
      isOpening: c.is_opening,
      isPrivate: c.is_private
    }))
  }
}

module.exports = Lnd
