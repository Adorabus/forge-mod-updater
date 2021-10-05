const ForgeUpdater = require('../index')
const fs = require('fs')

const DIR = 'test_dir'

if (!fs.existsSync(DIR)) {
  fs.mkdirSync(DIR)
}

async function test () {
  const updater = new ForgeUpdater(DIR)
  await updater.init('1.16.4')

  updater.addModByID(240633)

  try {
    const checkRes = await updater.check()
    updater.update(checkRes.updates)
      .on('done', (err) => {
        if (err) console.log(err)
        console.log('Done')
      })
    console.log(checkRes)
  } catch (error) {
    console.log('Test failed.', error.message)
  }
}

test().then(console.log).catch(console.error)
