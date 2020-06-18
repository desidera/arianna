
export function is_object (value) {
  return typeof value === 'object' && value != null && !Array.isArray(value)
}

export function try_parse_url (string, baseURL) {
  try {
    return new URL(string, baseURL)
  } catch (error) {
    return undefined
  }
}

export function try_parse_specifier (specifier, base_url) {
  if (specifier.startsWith('/') || specifier.startsWith('./') || specifier.startsWith('../')) {
    return try_parse_url(specifier, base_url)
  }

  let url = try_parse_url(specifier)

  return url
}
