import { URL } from 'node:url'
import { isIP } from 'node:net'
import dns from 'node:dns/promises'

const BLOCKED_PROTOCOLS = new Set(['file:', 'data:', 'ftp:', 'gopher:'])

const PRIVATE_RANGES = [
  // IPv4
  { prefix: '10.', mask: null },
  {
    prefix: '172.',
    mask: (ip: string) => {
      const b = Number.parseInt(ip.split('.')[1], 10)
      return b >= 16 && b <= 31
    },
  },
  { prefix: '192.168.', mask: null },
  { prefix: '127.', mask: null },
  { prefix: '169.254.', mask: null },
  { prefix: '0.', mask: null },
  // IPv6
  { prefix: '::1', mask: null },
  { prefix: 'fc', mask: null },
  { prefix: 'fd', mask: null },
  { prefix: 'fe80:', mask: null },
  { prefix: '::ffff:127.', mask: null },
  { prefix: '::ffff:10.', mask: null },
  { prefix: '::ffff:192.168.', mask: null },
  { prefix: '::ffff:169.254.', mask: null },
]

function isPrivateIP(ip: string): boolean {
  const lower = ip.toLowerCase()
  for (const range of PRIVATE_RANGES) {
    if (lower.startsWith(range.prefix)) {
      if (!range.mask) return true
      if (range.mask(ip)) return true
    }
  }
  return false
}

export class UrlGuardService {
  /**
   * Validates that a URL is safe to fetch (not targeting internal resources).
   * Returns an error message if blocked, or null if safe.
   */
  async validate(rawUrl: string): Promise<string | null> {
    let parsed: URL
    try {
      parsed = new URL(rawUrl)
    } catch {
      return 'Invalid URL'
    }

    if (BLOCKED_PROTOCOLS.has(parsed.protocol)) {
      return `Protocol ${parsed.protocol} is not allowed`
    }

    const hostname = parsed.hostname

    // Check if hostname is a raw IP
    if (isIP(hostname)) {
      if (isPrivateIP(hostname)) {
        return 'URLs targeting private/internal IP addresses are not allowed'
      }
      return null
    }

    // Resolve hostname and check all IPs
    try {
      const addresses = await dns.resolve4(hostname).catch(() => [] as string[])
      const addresses6 = await dns.resolve6(hostname).catch(() => [] as string[])
      const all = [...addresses, ...addresses6]

      for (const addr of all) {
        if (isPrivateIP(addr)) {
          return 'URLs targeting private/internal IP addresses are not allowed'
        }
      }
    } catch {
      // DNS resolution failed — let the fetch itself handle this
    }

    return null
  }
}

const urlGuardService = new UrlGuardService()

export default urlGuardService
