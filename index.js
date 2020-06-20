
import load from './modules/module-loader/index.js'

async function start () {
  console.log(`let's start!`)
  await load()
  console.log(`mission: accomplished!`)
}

start()