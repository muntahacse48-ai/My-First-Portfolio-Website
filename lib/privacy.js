// Shared rule for hiding private info from public views.
// Any object flagged with `private: true` is removed, and the flag itself is
// stripped so it never reaches the browser.

function publicObject(node, depth = 0) {
  if (depth > 10) return node;
  if (Array.isArray(node)) {
    return node
      .map((item) => publicObject(item, depth + 1))
      .filter((item) => item !== null);
  }
  if (node && typeof node === "object") {
    if (node.private === true) return null;
    const out = {};
    for (const [key, value] of Object.entries(node)) {
      if (key === "private") continue;
      const cleaned = publicObject(value, depth + 1);
      if (cleaned !== null) out[key] = cleaned;
    }
    return out;
  }
  return node;
}

module.exports = { publicObject };