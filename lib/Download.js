const fs = require('fs')
const request = require('request')
const EventEmitter = require('events')

module.exports = class Download extends EventEmitter {
  constructor (slug, file, writePath) {
    super()
    this.url = `https://minecraft.curseforge.com/projects/${slug}/files/${file}/download`
    this.resolvedUrl = null
    this.writePath = writePath

    this.fileSize = 0
  }

  resolveUrl () {
    if (this.resolvedUrl) return Promise.resolve(this.resolvedUrl) // cached
    return new Promise((resolve, reject) => {
      request({method: 'GET', url: this.url, followRedirect: false}, (err, res) => {
        if (err) {
          reject(err)
        } else {
          this.resolvedUrl = res.headers.location.replace('//edge', '//media')
          resolve(this.resolvedUrl)
        }
      })
    })
  }

  getSize () {
    return new Promise((resolve, reject) => {
      // follow the redirect first
      this.resolveUrl()
        .then((resolvedUrl) => {
          request.head(resolvedUrl, (err, res) => {
            if (err) reject(err)
            else resolve(parseInt(res.headers['content-length']))
          })
        })
    })
  }

  start () {
    request(this.resolvedUrl || this.url, {
      timeout: 0
    })
      .on('data', (data) => {
        this.emit('data', data.length)
      })
      .on('response', (response) => {
        response.on('end', () => {
          this.emit('end')
        })
      })
      .on('error', (err) => {
        this.emit('error', err)
      })
      .pipe(fs.createWriteStream(this.writePath))

    return this
  }
}
