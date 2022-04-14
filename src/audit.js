const config = require('config')
const { EventEmitter } = require('events')
const auditFactory = require('./audit-logging')

class Audit extends EventEmitter {
  constructor () {
    super()

    // Audit Logging
    this.eventLog = auditFactory(config.get('audit.eventLog'))
    this.transactionLog = auditFactory(config.get('audit.transactionLog'))

    // verbose
    this.verbose = config.get('audit.verboseScreenLogging')
  }

  /**
   * Logs an event in the audit log
   * @param {*} event
   * @param {*} data
   */
  logEvent (event, data = {}) {
    this.eventLog.append({ event, data })
    console.log(event)
    if (this.verbose) {
      console.log(data)
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
}

module.exports = Audit
