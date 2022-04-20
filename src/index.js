const config = require('config')
const Tightrope = require('./tightrope')
const eventLog = require('./audit/event-log')
const transactions = require('./transactions')

const balancers = []
const nodes = config.get('lightningNodes')

// Catch any forced shutdowns (Ctrl-c, kill etc) and attempt to cleanly close connections
process.on('SIGTERM', (signal) => { console.log(signal); process.exit(0) })
process.on('SIGINT', (signal) => { console.log(signal); process.exit(0) })
process.on('uncaughtException', (err) => { console.log(err); process.exit(1) })
process.on('exit', async (code) => {
  console.log(`\nProcess Terminating (${code}). Cleaning up...`)
  balancers.forEach(node => node.shutdown())
})

async function main () {
  // Force the audit logs to be in a ready state
  await eventLog.waitForReady()
  await transactions.waitForReady()

  // Find all the nodes this instance needs to follow...
  nodes.forEach(async (node) => {
    const t = new Tightrope(node)
    balancers.push(t)
    await t.connect()
  })
}

main()
