const axios = require('axios')
const BigNumber = require('bignumber.js')
const { v4: uuidv4 } = require('uuid');
const Lightning = require('./lightning')

class CoreLightningRest extends Lightning {
  /**
   * Set up the lightning node connection
   * @param {*} node { macaroon, socket }
   */
  constructor (node) {
    super()

    // cln credentials
    this.macaroon = node.macaroon
    this.baseURL = node.socket
    this.type = 'Core Lightning'
  }

  buildRequest (method, url, params) {
    return {
      url,
      method,
      baseURL: this.baseURL,
      headers: {
        macaroon: this.macaroon,
        encodingType: 'hex'
      },
      data: params,
      responseType: 'json'
    }
  }

  async _callApi (method, path, params = {}) {
    const res = await axios.request(this.buildRequest(method, path, params))
    return res.data
  }

  /**
   * Attempt to connect to the node using the credentials given
   */
  async connect () {
    // Find out about our node and attempt to use the connection
    const info = await this._callApi('get', '/v1/getinfo')
    this.publicKey = info.id
    this.alias = info.alias
    this.version = info.version

    // set up everything else
    await super.connect()
  }

  /**
   * Clean up the connection
   */
  async disconnect () {
    super.disconnect()
  }

  /**
   * are we connected to the node?
   * @returns true if we have a connection to the node
   */
  _hasConnection () {
    return this.publicKey !== null
  }

  /**
   * Create an invoice
   * @param {*} tokens
   * @param {*} expiresAt
   */
  async _createInvoice (tokens, lifespan) {
    const expiry = lifespan / 1000
    const label = uuidv4()
    const invoice = await this._callApi('post', '/v1/invoice/genInvoice', {
      amount: tokens * 1000,
      description: 'tightrope rebalance',
      expiry,
      label
    })

    return invoice.bolt11
  }

  /**
   * Pay the invoice
   * @param {*} invoice
   * @param {*} outgoingChannelHint
   */
  async _pay (invoice, outgoingChannelHint) {
    const payment = await this._callApi('post', '/v1/pay', { invoice })
    if (!payment) {
      return {
        paymentId: null,
        confirmed: false,
        confirmedAt: null,
        preimage: null
      }
    }

    const createdAt = new Date(payment.created_at * 1000)
    return {
      paymentId: payment.payment_hash,
      confirmed: payment.status === 'complete',
      confirmedAt: createdAt.toISOString(),
      preimage: payment.payment_preimage
    }
  }

  /**
   * Decode a bolt 11 invoice request
   * @param {*} invoice
   */
  async _decode (invoice) {
    const decoded = await this._callApi('get', `/v1/pay/decodepay/${invoice}`)

    return {
      amount: decoded.msatoshi / 1000,
      destination: decoded.payee
    }
  }

  /**
   * Get the list of channels on the node, remapped to our internal format
   */
  async _mappedChannels () {
    const channels = await this._callApi('get', '/v1/channel/listChannels')
    return channels.map((c) => ({
      id: c.short_channel_id,
      localAlias: this.alias,
      localPublicKey: this.publicKey,
      remotePublicKey: c.id,
      localBalance: new BigNumber(c.msatoshi_to_us / 1000),
      remoteBalance: new BigNumber(c.msatoshi_to_them / 1000),
      capacity: new BigNumber(c.msatoshi_total / 1000),
      isActive: c.connected,
      isClosing: false,
      isOpening: false,
      isPrivate: c.private
    }))
  }
}

module.exports = CoreLightningRest
