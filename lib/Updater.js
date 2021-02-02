const Download = require('./Download')
const fs = require('mz/fs')
const path = require('path')
const async = require('async')
const EventEmitter = require('events')

async function tryDelete (directory, fileName) {
  if (!fileName) return
  const filePath = path.join(directory, fileName)
  if (await fs.exists(filePath)) {
    await fs.unlink(filePath)
  }
}

module.exports = class Updater extends EventEmitter {
  constructor (directory, updates, limit = 10) {
    super()
    this.directory = directory
    this.updates = updates
    this.limit = limit
    this.prepared = []
    this.failed = []
    this.updated = []
    this.totalBytes = 0
    this.downloadedBytes = 0
  }

  _prepare () {
    if (!this.updates || this.updates.length === 0) return Promise.resolve()

    return new Promise((resolve, reject) => {
      async.eachLimit(this.updates, this.limit, async (updateInfo) => {
        const filePath = path.join(this.directory, updateInfo.new.fileName)
        const download = new Download(updateInfo.new.downloadUrl, filePath)
        const dlSize = await download.getSize()

        updateInfo.size = dlSize

        this.totalBytes += dlSize
        this.prepared.push({
          download,
          info: updateInfo
        })

        this.emit('modprepared', updateInfo)
      }, (err) => {
        this.emit('allprepared')
        if (err) reject(err)
        else resolve()
      })
    })
  }

  _update () {
    return new Promise((resolve) => {
      async.eachLimit(this.prepared, this.limit, (update, cb) => {
        // delete old file first
        tryDelete(this.directory, update.info.old.fileName)
          .then(() => {
            let cbCalled = false

            // download new file
            update.download.start()
              .on('data', (size) => {
                this.downloadedBytes += size
                this.emit('data', size)
              })
              .on('error', () => {
                // continue on error, just skip this download only
                this.failed.push(update.info.old)
                this.emit('modfailed', update.info.old)

                if (!cbCalled) {
                  cbCalled = true
                  cb()
                }
              })
              .on('end', () => {
                // update metadata
                update.info.old.file = update.info.new.file
                update.info.old.fileName = update.info.new.fileName

                this.updated.push(update.info.old)
                this.emit('modupdated', update.info.old)

                if (!cbCalled) {
                  cbCalled = true
                  cb()
                }
              })
          })
          .catch(cb)
      }, (err) => {
        this.emit('done', err, {
          failed: this.failed,
          updated: this.updated
        })
        resolve()
      })
    })
  }

  // not sure how to properly JS doc since all the documentation sites are down
  /**
   * @fires Updater#allprepared - all mods are prepared
   * @fires Updater#modprepared - size of the mod is known (Update: update info)
   * @fires Updater#data - data downloaded (number: size of data)
   * @fires Updater#modupdated - a mod has finished updating (Mod: mod that was updated)
   * @fires Updater#done - all updates are complete (Error?: the error that occured if any)
   */
  update () {
    this.downloadedBytes = 0

    async.series([
      (cb) => {
        this._prepare()
          .then(cb)
          .catch(cb)
      },
      (cb) => {
        this._update()
          .then(cb)
          .catch(cb)
      }
    ])

    return this
  }
}
