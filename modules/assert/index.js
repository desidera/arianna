
export function assert (test) {
  if (!test) {
    throw new Error('assert failed')
  }
}