import parse_import_map from '../import-maps-parser/index.js'
import parse_module from '../module-parser/index.js'
import resolve_specifier from '../import-maps-resolver/index.js'
import Locker from '../locker/index.js'

let __import_map

const __modules_map = new Map()

const locker = new Locker()

export default async function load () {
  let base_url = get_base_url()

  await load_import_map(base_url)

  await load_modules()
}

function get_base_url () {
  let base_url = location.origin + location.pathname
  base_url = new URL(base_url)
  return base_url
}

function create_blob_url (source) {
  let blob = new Blob([source], { type: 'application/javascript' })
  let blob_url = URL.createObjectURL(blob)
  return blob_url
}

async function load_import_map (base_url) {
  let scripts = document.querySelectorAll('script[type="importmap-shim"][src]')
  if (scripts.length === 0) {
    console.warn('No import-map was found!')
    return
  }
  if (scripts.length > 1) {
    console.warn('Only one import-map is currently allowed!')
  }
  let script = scripts[0]
  let src = script.src
  let response = await fetch(script.src)
  let json = await response.json()
  let import_map = parse_import_map(json, base_url)
  __import_map = import_map
}

async function load_modules () {
  let scripts = document.querySelectorAll('script[type="module-shim"][src]')
  for (let script of scripts) {
    await load_module(script.src)
  }
}

async function load_module (src) {
  let script_url = new URL(src)
  let script_url_href = script_url.href

  let module_blob_url = __modules_map.get(script_url_href)
  if (module_blob_url) {
    return module_blob_url
  }

  if (locker.has(script_url_href)) {
    await locker.unlocked(script_url_href)
    return load_module(src)
  }

  locker.lock(script_url_href)

  let response = await fetch(src)
  let source = await response.text()

  let [import_declarations] = parse_module(source)

  let promises = []

  for (let import_declaration of import_declarations) {
    let declaration_type = import_declaration.dynamic
    console.log(import_declaration)
    //static delcaration
    if (declaration_type === -1) {
      let statement = import_declaration.statement
      let specifier = statement.slice(import_declaration.start, import_declaration.end)
      let specifier_url = resolve_specifier(specifier, __import_map, script_url)
      let specifier_start = import_declaration.start
      let specifier_end = import_declaration.end
      let promise = load_module(specifier_url)
      promise.then((module_blob_url) => {
        source = source.slice(0, specifier_start) + module_blob_url + source.slice(specifier_end)
        console.log(source, module_blob_url)
      })
      promises.push(promise)
    }
    // import.meta
    else if (declaration_type === -2) {
      //todo
    }
    // dynamic import
    else {
      //todo
    }
  }

  await Promise.all(promises)

  module_blob_url = create_blob_url(source)
  __modules_map.set(script_url_href, module_blob_url)

  locker.unlock(script_url_href)

  import(module_blob_url)

  return module_blob_url
}
