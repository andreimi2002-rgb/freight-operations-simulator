// Pure translation helper. It takes a dictionary object so it can be tested
// with plain Node, without the bundler's JSON import.

/** Look up a dotted key ("home.board.title") in a nested dictionary. */
export function lookup(dict, key) {
  let node = dict;
  for (const part of key.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

/**
 * Build t(key, params). A missing key throws, so the static build fails
 * instead of shipping a page with a raw key in it.
 */
export function makeT(dict) {
  return function t(key, params = {}) {
    const value = lookup(dict, key);
    if (typeof value !== 'string') {
      throw new Error(`i18n: missing text for key "${key}"`);
    }
    return value.replace(/\{(\w+)\}/g, (match, name) =>
      name in params ? String(params[name]) : match,
    );
  };
}
