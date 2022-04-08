const config = require('config')
const hypercore = require('hypercore')
const { toPromises } = require('hypercore-promisifier')

class AuditLog {
  constructor (name) {
    this.storage = config.get('audit.storage.path')
    this.core = toPromises(hypercore(this.storage + name, { valueEncoding: 'json' }))
  }

  discoveryKey () {
    return this.core.discoveryKey
  }

  publicKey () {
    return this.core.publicKey
  }

  async append (data) {
    await this.core.append({ ...data, timestamp: Date.now() })
  }
}

/**
 * Using singleton patten to ensure we only attempt to create a
 * single instance of each audit log (it will fail if we attempt to
 * create 2 instances of the same path anyway).
 * This also means every class / component can ask for their own
 * reference to the audit log and log things without it being held in a
 * central master class.
 */
const singletons = []
function auditFactory (name) {
  // Has this one already been created
  const index = singletons.findIndex((s) => s.name === name)
  if (index !== -1) {
    return singletons[index].log
  }

  // If not, create it and remember it
  const log = new AuditLog(name)
  singletons.push({ name, log })

  // give them the new instance
  return log
}

module.exports = auditFactory
