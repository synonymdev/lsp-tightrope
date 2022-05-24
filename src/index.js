const config = require('config')
const goodbye = require('graceful-goodbye')
const Tightrope = require('./tightrope')
const eventLog = require('./audit/event-log')
const transactions = require('./transactions')

// The separate tightrope instances for each lightning node
let balancers = []

// Catch any forced shutdowns (Ctrl-c, kill etc) and attempt to cleanly close connections
goodbye(async () => {
  console.log('\nProcess Terminating. Cleaning up...')
  for (let i = 0; i < balancers.length; i += 1) {
    await balancers[i].shutdown()
  }

  balancers = []
})

async function main () {
  // Force the audit logs to be in a ready state
  await eventLog.waitForReady()
  await transactions.waitForReady()

  // Find all the nodes this instance needs to follow...
  const nodes = config.get('lightningNodes')
  nodes.forEach(async (node) => {
    const t = new Tightrope(node)
    balancers.push(t)
    await t.connect()
  })
}

main()
