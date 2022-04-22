const config = require('config')
const { EventEmitter } = require('events')
const eventLog = require('./audit/event-log')

class Logging extends EventEmitter {
  constructor () {
    super()

    // verbose
    this.verbose = config.get('audit.verboseScreenLogging')

    // properties that we should mask
    this.shouldMask = config.get('audit.shouldMask')
    this.maskLen = 8
  }

  /**
   * Logs an event in the audit log
   * @param {*} event
   * @param {*} data
   */
  logEvent (event, data = {}) {
    const maskedData = this._maskPrivateProperties(data)
    eventLog.append({ event, data: maskedData })

    console.log(event)
    if (this.verbose) {
      console.log(maskedData)
    }
  }

  /**
   * Logs an error event
   * @param {*} reason - very short description of the error
   * @param {*} data - any data that will help
   */
  logError (reason, data = {}) {
    this.logEvent('error', { error: reason, details: data })
  }

  /**
   * Given an object, mask any private properties
   * @param {*} data
   * @returns
   */
  _maskPrivateProperties (data) {
    const keys = Object.keys(data)
    return keys.reduce((masked, key) => {
      // default to a straight copy
      const out = { ...masked }
      out[key] = data[key]

      // If it is a key we should mask, try and do that.
      if (this.shouldMask.includes(key)) {
        if (typeof data[key] === 'string') {
          const len = Math.max(data[key].length - this.maskLen, 0)
          out[key] = data[key].substring(0, this.maskLen) + '*'.repeat(len)
        } else {
          out[key] = '**[protected data]**'
        }
      }

      return out
    }, {})
  }
}

module.exports = Logging
