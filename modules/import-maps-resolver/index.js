import { try_parse_specifier, try_parse_url } from '../utils/index.js'
import { assert } from '../assert/index.js'

export default function resolve (specifier, parsed_import_map, script_url) {
  let as_url = try_parse_specifier(specifier, script_url)
  let normalized_specifier = as_url ? as_url.href : specifier
  let script_url_string = script_url.href

  let scopes = parsed_import_map.scopes || {}
  for (let scope_prefix in scopes) {
    let scope_imports = scopes[scope_prefix]
    if (scope_prefix === script_url_string ||
        (scope_prefix.endsWith('/') && script_url_string.startsWith(scope_prefix))) {
      let scope_imports_match = resolve_imports_match(normalized_specifier, scope_imports)

      if (scope_imports_match) {
        return scope_imports_match
      }
    }
  }

  let imports = parsed_import_map.imports || {}
  let top_level_imports_match = resolve_imports_match(normalized_specifier, imports);

  if (top_level_imports_match) {
    return top_level_imports_match
  }

  if (as_url) {
    return as_url
  }

  throw new TypeError(`Unmapped bare specifier "${specifier}"`)
}

function resolve_imports_match (normalized_specifier, specifier_map) {
  for (let specifier_key in specifier_map) {
    let resolution_result = specifier_map[specifier_key]
    // Exact-match case
    if (specifier_key === normalized_specifier) {
      if (!resolution_result) {
        throw new TypeError(`Blocked by a null entry for "${specifier_key}"`)
      }

      assert(resolution_result instanceof URL)

      return resolution_result
    }

    // Package prefix-match case
    if (specifier_key.endsWith('/') && normalized_specifier.startsWith(specifier_key)) {
      if (!resolution_result) {
        throw new TypeError(`Blocked by a null entry for "${specifier_key}"`)
      }

      assert(resolution_result instanceof URL)

      let after_prefix = normalized_specifier.substring(specifier_key.length)

      // Enforced by parsing
      assert(resolution_result.href.endsWith('/'))

      let url = try_parse_url(after_Prefix, resolution_result)
      if (!url) {
        throw new TypeError(`Failed to resolve prefix-match relative URL for "${specifier_key}"`);
      }

      assert(url instanceof URL)

      return url
    }
  }

  return undefined
}