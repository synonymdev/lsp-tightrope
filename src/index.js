const config = require('config')
const Tightrope = require('./tightrope')

const balancers = []
const nodes = config.get('lightningNodes')

// Find all the nodes this instance needs to follow...
nodes.forEach(async (node) => {
  const t = new Tightrope(node)
  balancers.push(t)
  await t.connect()
})

// Catch any forced shutdowns (Ctrl-c, kill etc) and attempt to cleanly close connections
process.on('SIGTERM', (signal) => process.exit(0))
process.on('SIGINT', (signal) => process.exit(0))
process.on('uncaughtException', (err) => { console.log(err); process.exit(1) })
process.on('exit', async (code) => {
  console.log('\nProcess Terminating. Cleaning up...')
  balancers.forEach(node => node.shutdown())
})
