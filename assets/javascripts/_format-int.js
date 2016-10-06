/**
 * Converts 1234567 to "1,234,567".
 */
module.exports = function formatInt(n) {
  return n.toFixed(0)
    .replace(/(\d)(?=(\d{3})+$)/g, '$1,');
};
