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

function parseCidr(cidr: string): { network: number; mask: number } | null {
  const parts = cidr.split('/')
  if (parts.length !== 2) return null

  const octets = parts[0].split('.')
  if (octets.length !== 4) return null

  const bits = Number.parseInt(parts[1], 10)
  if (Number.isNaN(bits) || bits < 0 || bits > 32) return null

  const ip =
    ((Number.parseInt(octets[0], 10) << 24) |
      (Number.parseInt(octets[1], 10) << 16) |
      (Number.parseInt(octets[2], 10) << 8) |
      Number.parseInt(octets[3], 10)) >>>
    0

  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0

  return { network: (ip & mask) >>> 0, mask }
}

function ipToInt(ip: string): number {
  const octets = ip.split('.')
  if (octets.length !== 4) return -1
  return (
    ((Number.parseInt(octets[0], 10) << 24) |
      (Number.parseInt(octets[1], 10) << 16) |
      (Number.parseInt(octets[2], 10) << 8) |
      Number.parseInt(octets[3], 10)) >>>
    0
  )
}

function parseCommaSeparated(value: string | undefined): string[] {
  if (!value) return []
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export class UrlGuardService {
  private allowedCidrs: Array<{ network: number; mask: number }>
  private allowedHosts: Set<string>

  constructor(
    allowedCidrs?: string[],
    allowedHosts?: string[]
  ) {
    this.allowedCidrs = (allowedCidrs ?? [])
      .map(parseCidr)
      .filter((c): c is { network: number; mask: number } => c !== null)

    this.allowedHosts = new Set(
      (allowedHosts ?? []).map((h) => h.toLowerCase())
    )
  }

  private isAllowedByCidr(ip: string): boolean {
    const ipInt = ipToInt(ip)
    if (ipInt === -1) return false
    return this.allowedCidrs.some((c) => ((ipInt & c.mask) >>> 0) === c.network)
  }

  private isAllowedByHost(hostname: string): boolean {
    return this.allowedHosts.has(hostname.toLowerCase())
  }

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

    if (this.isAllowedByHost(hostname)) {
      return null
    }

    // Check if hostname is a raw IP
    if (isIP(hostname)) {
      if (isPrivateIP(hostname) && !this.isAllowedByCidr(hostname)) {
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
        if (isPrivateIP(addr) && !this.isAllowedByCidr(addr)) {
          return 'URLs targeting private/internal IP addresses are not allowed'
        }
      }
    } catch {
      // DNS resolution failed — let the fetch itself handle this
    }

    return null
  }
}

const urlGuardService = new UrlGuardService(
  parseCommaSeparated(process.env.SSRF_ALLOWED_CIDRS),
  parseCommaSeparated(process.env.SSRF_ALLOWED_HOSTS)
)

export default urlGuardService
