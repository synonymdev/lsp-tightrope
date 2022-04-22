const transactionLog = require('./audit/transaction-log')
const timeToMilliseconds = require('./util/time-to-milliseconds')

class Transactions {
  constructor () {
    this.recent = []
  }

  /**
   * Wait for the hypercore to be ready and fetch recent transactions
   */
  async waitForReady () {
    await transactionLog.waitForReady()
    await this._cacheRecentTransaction()
  }

  async add (transaction) {
    return transactionLog.append(this._toTransaction(transaction))
  }

  /**
   * Find some sub-set of recent transactions
   * Optional criteria { since: millisecondTimestamp, state: 'complete'|'pending'|'failed' }
   * @param {*} filter
   * @returns
   */
  async filter (filter) {
    const since = filter.since || (Date.now() - timeToMilliseconds('1d'))
    const state = filter.state || 'complete'

    // Get all
    const recent = await transactionLog.getRecent(1000)

    // Filter down to just the ones we need
    return recent.filter((t) => t.timestamp > since && t.state === state)
  }

  async _cacheRecentTransaction () {
    this.recent = await transactionLog.getRecent(1000)
  }

  /**
   * Force the transaction to match the required format
   * with all required properties and no extra properties
   * @param {*} obj
   * @returns
   */
  _toTransaction (obj) {
    // Defaults for everything we want
    const src = {
      paidTo: null,
      paidBy: null,
      channelId: null,
      amount: 0,
      invoice: null,
      state: 'unknown',
      ...obj
    }

    // then keep just what we need
    return {
      paidTo: src.paidTo,
      paidBy: src.paidBy,
      channelId: src.channelId,
      amount: src.amount,
      invoice: src.invoice,
      state: `${src.state}`.toLowerCase()
    }
  }
}

module.exports = new Transactions()
