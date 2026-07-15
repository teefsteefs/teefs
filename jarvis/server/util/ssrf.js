import { lookup } from 'node:dns/promises';
import net from 'node:net';

/**
 * Guard for the page-reader tool: the URL comes from search results (and,
 * in agent mode, from the model), so it is untrusted input. We refuse
 * anything that could reach internal services.
 *
 * Note: this blocks the practical cases (localhost, RFC1918, link-local,
 * cloud metadata). It does not defend against DNS rebinding after the
 * check — acceptable for this tool's threat model since the process holds
 * no other network privileges.
 */

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
    return false;
  }
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fc') || low.startsWith('fd') || low.startsWith('fe80')) return true;
    if (low.startsWith('::ffff:')) return isPrivateIp(low.slice(7));
    return false;
  }
  return false;
}

export function isForbiddenHostname(hostname) {
  const h = hostname.toLowerCase().replace(/\.$/, '');
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal')) return true;
  const bare = h.replace(/^\[|\]$/g, '');
  if (net.isIP(bare) && isPrivateIp(bare)) return true;
  return false;
}

/**
 * Validates that a URL is a public http(s) address.
 * @returns {Promise<URL>} the parsed URL when safe
 * @throws {Error} when the URL must not be fetched
 */
export async function assertPublicHttpUrl(rawUrl) {
  let url;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error(`URL không hợp lệ: ${String(rawUrl).slice(0, 120)}`);
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Chỉ hỗ trợ http/https, không hỗ trợ ${url.protocol}`);
  }
  if (url.username || url.password) {
    throw new Error('Không hỗ trợ URL chứa thông tin đăng nhập');
  }
  if (isForbiddenHostname(url.hostname)) {
    throw new Error('Từ chối truy cập địa chỉ nội bộ');
  }
  // Resolve the hostname and re-check, so DNS names pointing at internal
  // ranges are rejected too.
  const bare = url.hostname.replace(/^\[|\]$/g, '');
  if (!net.isIP(bare)) {
    try {
      const { address } = await lookup(bare);
      if (isPrivateIp(address)) throw new Error('Từ chối truy cập địa chỉ nội bộ');
    } catch (err) {
      if (err.message === 'Từ chối truy cập địa chỉ nội bộ') throw err;
      // DNS failure: let fetch surface the real network error later.
    }
  }
  return url;
}
