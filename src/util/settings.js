/**
 * A simple class to simplify having a chain of settings that can be overridden in different contexts
 */
class Settings {
  constructor (baseSettings = {}, idSettings = []) {
    this.baseSettings = baseSettings
    this.idSettings = []
    this.addIdSettings(idSettings)
  }

  /**
   * Adds an array of settings with an id that can override the base settings if the matching id is passed to get()
   * @param {*} settings - an array of settings. Expects a property called id in each element
   */
  addIdSettings (settings) {
    const items = Array.isArray(settings) ? settings : [settings]
    this.idSettings = [...this.idSettings, ...items.filter((item) => item.id !== undefined)]
  }

  /**
   * get a setting
   * @param {*} name - of the setting to get
   * @param {*} id - the id or array of ids of some higher priority overrides (eg a node alias or a channel id).
   * @returns the most specific setting
   */
  get (name, id = null) {
    // find the base setting value.
    let settings = { ...this.baseSettings }

    if (id) {
      const ids = Array.isArray(id) ? id : [id]
      settings = ids.map((i) => this.idSettings.find(item => item.id === i)).reduce((prev, curr) => ({ ...prev, ...curr }), settings)
    }

    return settings[name]
  }
}

module.exports = Settings
