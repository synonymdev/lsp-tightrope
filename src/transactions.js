const transactionLog = require('./audit/transaction-log')

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

  filter (filter) {
    // const { from, to, since } = filter
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
      srcNode: null,
      dstNode: null,
      channelId: null,
      amount: 0,
      invoice: null,
      state: 'unknown',
      ...obj
    }

    // then keep just what we need
    return {
      srcNode: src.srcNode,
      dstNode: src.dstNode,
      channelId: src.channelId,
      amount: src.amount,
      invoice: src.invoice,
      state: `${src.state}`.toLowerCase()
    }
  }
}

module.exports = new Transactions()
