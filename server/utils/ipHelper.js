/**
 * Normalize IP address to IPv4 format if possible.
 * Converts IPv6 loopback to 127.0.0.1
 */
function normalizeIp(ip) {
  if (!ip) return 'unknown';
  if (ip === '::1') return '127.0.0.1';
  if (ip.startsWith('::ffff:')) return ip.substring(7); // remove ::ffff: prefix
  return ip;
}

module.exports = { normalizeIp };