const request = require('request')

function lookup (ids, version) {
  return new Promise((resolve, reject) => {
    const postBody = JSON.stringify(ids)
    request.post(
      'https://addons-ecs.forgesvc.net/api/v2/addon',
      {body: postBody, headers: {'content-type': 'application/json'}},
      (err, res, body) => {
        if (err) {
          reject(err)
        } else {
          const updateInfo = {}

          const data = JSON.parse(body)
          for (const entry of Object.values(data)) {
            const {id, name, slug} = entry
            const [major, minor, patch] = version.split('.')

            let latest = entry.gameVersionLatestFiles.find(file => file.gameVersion === version)

            // if we can't find exact match, check for earlier patches
            let tryPatch = patch - 1
            while (!latest && tryPatch >= 0) {
              latest = entry.gameVersionLatestFiles.find(file => file.gameVersion === [major, minor, tryPatch].join('.'))
              tryPatch--
            }

            if (!latest) {
              reject(`Could not find a compatible candidate for ${id}@${version}.`)
            }

            updateInfo[id] = {
              id,
              name,
              slug,
              file: latest.projectFileId,
              fileName: latest.projectFileName
            }
          }

          resolve(updateInfo)
        }
      })
  })
}

module.exports = {
  lookup,
  async checkMods (mods, version) {
    const checked = {
      updates: [],
      upToDate: []
    }

    if (!mods || mods.length === 0) return checked

    const ids = mods.map(mod => mod.id)
    const info = await lookup(ids, version)

    for (const mod of mods) {
      const latest = info[mod.id]
      if (!mod.file || latest.file > mod.file) {
        checked.updates.push({
          old: mod,
          new: latest,
          slug: latest.slug,
          name: latest.name
        })
      } else {
        checked.upToDate.push(mod)
      }
    }

    return checked
  }
}
