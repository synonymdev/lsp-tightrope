const config = require('config')
const hypercore = require('hypercore')

class AuditHypercore {
  constructor (name) {
    this.storage = config.get('audit.storage.path')
    this.core = hypercore(this.storage + name, { valueEncoding: 'json' })
    this.ready = new Promise((resolve) => this.core.on('ready', () => resolve()))
  }

  discoveryKey () {
    return this.core.discoveryKey
  }

  publicKey () {
    return this.core.publicKey
  }

  async waitForReady () {
    await this.ready
  }

  async append (data) {
    await this.waitForReady()
    return new Promise((resolve, reject) => {
      this.core.append({ ...data, timestamp: Date.now() }, (err, seq) => {
        if (err) return reject(err)
        return resolve(seq)
      })
    })
  }

  async length () {
    await this.waitForReady()
    return this.core.length
  }

  async get (index) {
    await this.waitForReady()
    return new Promise((resolve, reject) => {
      this.core.get(index, (err, seq) => {
        if (err) return reject(err)
        return resolve(seq)
      })
    })
  }

  async getRecent (count) {
    const len = await this.length()
    if (len === 0) {
      return []
    }

    const end = len
    const start = Math.max(0, end - count)
    if (start === end) {
      return []
    }

    return new Promise((resolve, reject) => {
      this.core.getBatch(start, end, { wait: true }, (err, seq) => {
        if (err) return reject(err)
        return resolve(seq)
      })
    })
  }
}

module.exports = AuditHypercore
