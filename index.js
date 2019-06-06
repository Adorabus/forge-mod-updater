const fs = require('mz/fs')
const path = require('path')
const api = require('./lib/api')
const Updater = require('./lib/Updater')

/**
 * @typedef {Object} Mod
 * @property {number} id - project ID of the mod
 * @property {file} file - file ID of the mod (version)
 * @property {fileName} fileName - file name of the mod
 */

/**
 * @typedef {Object} Update
 * @property {Mod} old - current mod information
 * @property {Mod} new - new mod information
 * @property {string} slug - project slug
 * @property {string} name - title of the mod
 * @property {?number} size - size of the latest version in bytes
 */

/**
 * @typedef {Object} ImportResult
 * @property {Mod[]} imported - list of successfully imported mods
 * @property {Mod[]} skipped - list of skipped mods (duplicates)
 */

/**
 * @typedef {Object} CheckResult
 * @property {Update[]} updates - list of updates
 * @property {Mod[]} upToDate - list of mods that are already up to date
 */

class ForgeModUpdater {
  /**
    * @param {string} directory - directory to manage
    */
  constructor (directory) {
    this.directory = directory
    this.manifestPath = path.join(directory, '.fmm-manifest')
    this.manifest = {
      gameVersion: '1.12.2',
      mods: []
    }
  }

  // use this externally to avoid rebinding issues
  /**
    * @returns {Object} - manifest object
    */
  getManifest () {
    return this.manifest
  }

  /**
   * Initialize the manifest.
   * @param {string} gameVersion - minecraft version
   * @returns {Promise}
   */
  init (gameVersion = '1.12.2') {
    this.manifest.gameVersion = gameVersion
    this.manifest.mods.length = 0

    return this.save()
  }

  /**
   * Check if manifest file exists.
   * @returns {Promise.<boolean>}
   */
  exists () {
    return fs.exists(this.manifestPath)
  }

  /**
    * Read manifest file.
    * @returns {Promise}
    */
  async load () {
    const exists = await this.exists()
    if (!exists) throw new Error(`Manifest does not exist in "${this.directory}"!`)

    const raw = await fs.readFile(this.manifestPath)
    this.manifest = JSON.parse(raw)
  }

  /**
    * Write to manifest file.
    * @returns {Promise}
    */
  save () {
    return fs.writeFile(this.manifestPath, JSON.stringify(this.manifest))
  }

  /**
    * Add mod to manifest by ID.
    * @param {number} id - ID of the mod
    * @returns {boolean} - successful (not a duplicate)
    */
  addModByID (id) {
    if (this.manifest.mods.find(mod => mod.id === id)) return false
    this.manifest.mods.push({id})

    return true
  }

  /**
   * Import mods from a curse/twitch manifest file.
   * @param {string} filePath - curse/twitch manifest file
   * @returns {ImportResult} - import results
   */
  import (filePath) {
    const result = {
      imported: [],
      skipped: []
    }

    if (!fs.existsSync(filePath)) {
      throw new Error('The specified manifest file does not exist!')
    }

    try {
      const raw = fs.readFileSync(filePath)
      const twitchManifest = JSON.parse(raw)

      for (const mod of twitchManifest.files) {
        if (this.addModByID(mod.projectID)) result.imported.push(mod)
        else result.skipped.push(mod)
      }

      return result
    } catch (error) {
      throw new Error('Failed to parse the specified manifest file!')
    }
  }

  /**
   * Check mods for updates.
   * @returns {Promise.<CheckResult>} - update check result
   */
  check () {
    return api.checkMods(this.manifest.mods, this.manifest.gameVersion)
  }

  /**
   * Update all mods that require it.
   * @param {Update[]} updates - mods to update
   * @param {number} limit - maximum concurrent downloads
   * @returns {Updater} - The Updater doing the update
   */
  update (updates, limit = 10) {
    const updater = new Updater(this.directory, updates, limit)
    return updater.update(limit)
      .on('done', (err) => {
        if (!err) this.save()
      })
  }
}

module.exports = ForgeModUpdater
