const Lnd = require('./lnd')
const CoreLightningRest = require('./core-lightning-rest')

module.exports = (node) => {
  switch (node.type) {
    case 'lnd':
      return new Lnd(node)

    case 'cln-rest':
      return new CoreLightningRest(node)

    default:
      throw new Error(`Unknown lightning implementation: ${node.type}`)
  }
}
