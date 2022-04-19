const config = require('config')
const Settings = require('./settings')

// Load up all the settings specific to tightrope
const all = new Settings(config.get('limits.baseSettings'))
all.addIdSettings(config.get('limits.idSettings'))

// make them available
module.exports = (name, id = null) => all.get(name, id)
