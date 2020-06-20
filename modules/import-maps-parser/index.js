import { is_object, try_parse_url, try_parse_specifier } from '../utils/index.js'

export default function parse (input, base_url) {
  if (!is_object(input)) {
    throw new TypeError('Import map JSON must be an object.')
  }

  if (!(base_url instanceof URL)) {
    throw new TypeError('Missing base URL or base URL is not a URL')
  }

  let sorted_normalized_imports = {}
  if ('imports' in input) {
    if (!input.imports || !is_object(input.imports)) {
      throw new TypeError("Import map's imports value must be an object.");
    }
    sorted_normalized_imports = sort_and_normalize_specifier_map(input.imports, base_url)
  }

  let sorted_normalized_scopes = {}
  if ('scopes' in input) {
    if (!input.scopes || !is_object(input.scopes)) {
      throw new TypeError("Import map's scopes value must be an object.");
    }
    sorted_normalized_scopes = sort_and_normalize_scopes(input.scopes, base_url)
  }

  let bad_keys = new Set(Object.keys(input))
  bad_keys.delete('imports')
  bad_keys.delete('scopes')

  for (let bad_key of bad_keys) {
    console.warn(`Invalid top-level key "${bad_key}". Only "imports" and "scopes" can be present.`)
  }

  let import_maps = {
    imports: sorted_normalized_imports,
    scopes: sorted_normalized_scopes
  }

  return import_maps
}

function sort_and_normalize_specifier_map (obj, base_url) {
  if (!is_object(obj)) {
    return
  }

  let normalized = {}

  for (let specifier_key in obj) {
    let value = obj[specifier_key]

    let normalized_specifier_key = normalize_specifier_key(specifier_key, base_url)
    if (!normalized_specifier_key) {
      continue
    }

    if (typeof value !== 'string') {
      let value = JSON.stringify(value)
      console.warn(`Invalid address ${value} for the specifier key "${specifier_key}".`)
      console.warn(`Addresses must be strings.`)
      normalized[normalized_specifier_key] = null
      continue
    }

    const address_url = try_parse_specifier(value, base_url)
    if (!address_url) {
      console.warn(`Invalid address "${value}" for the specifier key "${specifier_key}".`)
      normalized[normalized_specifier_key] = null
      continue
    }

    if (specifier_key.endsWith('/') && !address_url.href.endsWith('/')) {
      console.warn(`Invalid address "${address_url.href}" for package specifier key "${specifier_key}".`)
      console.warn(`Package addresses must end with "/".`)
      normalized[normalized_specifier_key] = null
      continue
    }

    normalized[normalized_specifier_key] = address_url
  }

  let sorted_normalized = {}
  let sorted_keys = Object.keys(normalized).sort(compare_keys)
  for (let key of sorted_keys) {
    sorted_normalized[key] = normalized[key]
  }

  return sorted_normalized
}

function sort_and_normalize_scopes (obj, base_url) {
  const normalized = {}
  for (let scope_prefix in obj) {
    let potential_specifier_map = obj[scope_prefix]

    if (!is_object(potential_specifier_map)) {
      throw new TypeError(`The value for the "${scope_prefix}" scope prefix must be an object.`)
    }

    const scope_prefix_url = try_parse_url(scope_prefix, base_url);
    if (!scope_prefix_url) {
      console.warn(`Invalid scope "${scope_prefix}" (parsed against base URL "${base_url}").`)
      continue
    }

    const normalized_scope_prefix = scope_prefix_url.href;
    normalized[normalized_scope_prefix] = sort_and_normalize_specifier_map(
        potential_specifier_map, base_url)
  }

  let sorted_normalized = {}
  let sorted_keys = Object.keys(normalized).sort(compare_keys)
  for (let key of sorted_keys) {
    sorted_normalized[key] = normalized[key]
  }

  return sorted_normalized
}

function normalize_specifier_key (specifier_key, base_url) {
  if (specifier_key === '') {
    console.warn(`Invalid empty string specifier key.`)
    return undefined
  }

  let url = try_parse_specifier(specifier_key, base_url)
  if (url) {
    return url.href
  }

  return specifier_key
}

function compare_keys (a, b) {
  if (a > b) {
    return -1
  }

  if (b > a) {
    return +1
  }

  throw new Error('This should never be reached because this is only used on JSON object keys')
}