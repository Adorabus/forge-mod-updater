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

            let latest
            let tryPatch = patch
            while (!latest && tryPatch >= 0) {
              const tryVersion = [major, minor, tryPatch].join('.')

              // try release
              latest = entry.gameVersionLatestFiles.find(file => file.gameVersion === tryVersion && file.fileType === 1)

              // try beta
              if (!latest) {
                latest = entry.gameVersionLatestFiles.find(file => file.gameVersion === tryVersion && file.fileType === 2)
              }

              // try alpha
              if (!latest) {
                latest = entry.gameVersionLatestFiles.find(file => file.gameVersion === tryVersion && file.fileType === 3)
              }

              tryPatch--
            }

            if (!latest) {
              reject(new Error(`Could not find a compatible candidate for ${id}@${version}.`))
            }

            updateInfo[id] = {
              id,
              name,
              slug,
              file: latest.projectFileId,
              fileName: latest.projectFileName
            }
          }

          // get actual file infos, useful to get the download URL
          const fileIDs = Object.values(updateInfo).map(info => info.file)
          request.post(
            'https://addons-ecs.forgesvc.net/api/v2/addon/files',
            {body: JSON.stringify(fileIDs), headers: {'content-type': 'application/json'}},
            (err2, res2, body2) => {
              if (err2) {
                reject(err2)
              } else {
                const data2 = JSON.parse(body2)
                for (const [entry] of Object.values(data2)) {
                  const {projectId, downloadUrl} = entry
                  updateInfo[projectId].downloadUrl = downloadUrl
                }

                resolve(updateInfo)
              }
            })
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

      if (!latest) throw new Error('Invalid mod id: ' + mod.id)

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
