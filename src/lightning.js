const config = require('config')
const BigNumber = require('bignumber.js')
const lnService = require('ln-service')
const { clearInterval } = require('timers')
const Audit = require('./audit')
const asyncFilter = require('./util/async-filter')
const settings = require('./util/tightrope-settings')

// https://github.com/alexbosworth/ln-service

class Lightning extends Audit {
  /**
   * Set up the lightning node connection
   * @param {*} node { cert, macaroon, socket }
   */
  constructor (node) {
    super()
    this.cert = node.cert
    this.macaroon = node.macaroon
    this.socket = node.socket
    this.alias = 'none'

    // wallet info
    this.walletInfo = null
    this.publicKey = null

    // The lightning node (LND only at the moment...)
    this.lnd = null

    // list of channels we are watching
    this.watchList = []
    this.pollingTimer = null

    // have some idea of when it's safe to try and rebalance a channel (not too often)
    this.blockedPending = []
    this.invoiceLifespan = 30 * 1000
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

    this.walletInfo = await lnService.getWalletInfo({ lnd: this.lnd })
    this.publicKey = this.walletInfo.public_key
    this.alias = this.walletInfo.alias

    // Get the current list of channels
    await this.refreshChannelList()

    // Start a timer to watch the channels
    const interval = settings('refreshRate', this.alias) * 1000
    this.pollingTimer = setInterval(() => this.onPollChannels(), interval)

    // log it
    this.logEvent('lightningConnected', { alias: this.alias, publicKey: this.publicKey, lnVersion: this.walletInfo.version })
  }

  /**
   * Clean up the connection
   */
  async disconnect () {
    if (this.publicKey) {
      this.logEvent('lightningDisconnect', { alias: this.alias, publicKey: this.publicKey, lnVersion: this.walletInfo?.version })
    }

    this.lnd = null
    this.walletInfo = null
    this.publicKey = null
    this.alias = 'disconnected'
    this.watchList = []

    clearInterval(this.pollingTimer)
    this.pollingTimer = null
  }

  /**
   * Called on a regular interval to see if any channels are out of balance
   */
  async onPollChannels () {
    // get the channel list up to date
    await this.refreshChannelList()

    // look to rebalance things and remove channels that are no longer there.
    this.watchList = await asyncFilter(this.watchList, async (id) => this.onConsiderChannelRebalance(id))
  }

  /**
   * Check a specific channel on our watchlist to see if it is out of balance and in need of rebalancing
   * @param {*} channelId
   */
  async onConsiderChannelRebalance (channelId) {
    const channel = this.channels.find((c) => c.id === channelId)
    if (!channel) {
      // log the problem
      this.logError('Watched channel missing', { alias: this.alias, publicKey: this.publicKey, channelId: channelId })

      // asked to be removed from the watchlist
      return false
    }

    if (channel.isActive) {
      // Work out percentage balance that is local
      const local = channel.localBalance.div(channel.capacity)

      // find out the balance points for this channel, and any configured 'dead zone'
      const balancePoint = settings('balancePoint', [this.alias, channelId])
      const deadzone = settings('deadzone', [this.alias, channelId])
      const rebalanceThreshold = Math.min(1, Math.max(0, balancePoint - deadzone))

      console.log(`${this.alias}:${channelId} Local: ${local * 100}%. Threshold: ${rebalanceThreshold * 100}% `)
      if (local < rebalanceThreshold) {
        // Work out how much to ask for
        const targetBalance = channel.localBalance.plus(channel.remoteBalance).times(balancePoint)
        const invoiceAmount = targetBalance.minus(channel.localBalance)
        await this.rebalanceChannel(channel, invoiceAmount)
      }
    }

    return true
  }

  /**
   * A channel we care about is out of balance - attempt to rebalance
   * @param {*} channel
   * @param {*} invoiceAmount
   */
  async rebalanceChannel (channel, invoiceAmount) {
    try {
      // Are we already in the middle to trying to rebalance this channel?
      // If we are, just stop here and let the original attempt complete
      const blocked = this.blockedPending.find((c) => c.id === channel.id)
      if (blocked) {
        if (blocked.until > Date.now()) {
          this.logEvent('alreadyBalancing', { alias: this.alias, publicKey: this.publicKey, channelId: channel.id, timeout: (blocked.until - Date.now()) / 1000 })
          return
        }
      }

      // this will be the only attempt for a while
      const expiresAt = new Date(Date.now() + this.invoiceLifespan)
      const blockUntil = Date.now() + (this.invoiceLifespan * 2)

      // block for a few minutes (avoid overlapping invoices)
      this.blockedPending = this.blockedPending.filter((c) => c.id !== channel.id)
      this.blockedPending.push({ id: channel.id, until: blockUntil })

      // Create an invoice
      const tokens = invoiceAmount.toFixed(0)
      const invoice = await lnService.createInvoice({
        lnd: this.lnd,
        description: 'tightrope rebalance',
        expires_at: expiresAt.toISOString(),
        tokens: tokens
      })

      // Ask for this invoice to be paid by the other side...
      this.logEvent('invoiceCreated', { alias: this.alias, publicKey: this.publicKey, channelId: channel.id, amount: tokens, invoice: invoice.request })
      this.emit('requestRebalance', channel, invoice.request, tokens)
    } catch (err) {
      this.logError('rebalance channel failed', err)
    }
  }

  /**
   * Will attempt to pay the BOLT 11 invoice given
   * @param {*} invoice
   * @returns
   */
  async payInvoice (invoice) {
    const payment = await lnService.pay({ lnd: this.lnd, request: invoice })
    if (payment && payment.is_confirmed) {
      this.logEvent('invoicePaid', { alias: this.alias, publicKey: this.publicKey, invoice, paymentId: payment.id })
    } else {
      this.logEvent('paymentFailed', { alias: this.alias, publicKey: this.publicKey, invoice })
    }

    return {
      paymentId: payment.id || null,
      confirmed: payment.is_confirmed || false,
      confirmedAt: payment.confirmed_at || null
    }
  }

  /**
   * When a payment has been confirmed we can stop blocking rebalances on that channel
   * If the payment failed (ie, not confirmed), then we leave the block in place. It will timeout
   * after a few minutes, but this is to prevent spamming payment requests when something is failing.
   * @param {*} result
   */
  async confirmPayment (result) {
    if (result.confirmed) {
      this.blockedPending = this.blockedPending.filter((c) => c.id !== result.channelId)
    }
  }

  /**
   * Asks the lightning node for the current list of channels and keeps the relevant data
   * @returns - an array of channels
   */
  async refreshChannelList () {
    if (!this.lnd) {
      this.channels = []
      return this.channels
    }

    const channelList = await lnService.getChannels({ lnd: this.lnd })
    this.channels = channelList.channels.map((c) => ({
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

    return this.channels
  }

  /**
   * Refresh the list of channels and look for a channel that connects to a
   * lightning public key given
   * @param {*} lnPublicKey
   * @returns
   */
  async findChannelsFromPubKey (lnPublicKey) {
    await this.refreshChannelList()
    return this.channels.filter((c) => c.remotePublicKey === lnPublicKey)
  }

  /**
   * Start watching the channel id given. This is a channel that
   * we will want to keep balanced, so it will be monitored and a rebalancing
   * event triggered if it falls outside the limits.
   * @param {*} channelId
   */
  watchChannel (channelId) {
    this.unwatchChannel(channelId)
    this.watchList.push(channelId)
    this.logEvent('startWatchingChannel', { channelId, localAlias: this.alias })
  }

  /**
   * Stop watching a channel
   * @param {*} channelId
   */
  unwatchChannel (channelId) {
    if (this.watchList.findIndex(c => c === channelId) !== -1) {
      this.logEvent('stopWatchingChannel', { channelId, localAlias: this.alias })
    }
    this.watchList = this.watchList.filter(c => c !== channelId)
  }
}

module.exports = Lightning
