const config = require('config')
const AuditHypercore = require('./audit-hypercore')

module.exports = new AuditHypercore(config.get('audit.eventLog'))
