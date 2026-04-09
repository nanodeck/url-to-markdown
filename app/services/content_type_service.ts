export type ContentCategory = 'html' | 'pdf' | 'unsupported'

export class SsrfRedirectError extends Error {
  constructor(public readonly blockedUrl: string) {
    super(`Redirect target blocked by SSRF guard: ${blockedUrl}`)
    this.name = 'SsrfRedirectError'
  }
}

const HTML_TYPES = ['text/html', 'application/xhtml+xml']

const EXTENSION_MIME_MAP: Record<string, string> = {
  '.pdf': 'application/pdf',
}

const MAGIC_BYTES: Array<{ mime: string; bytes: number[] }> = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46, 0x2d] },
]

export class ContentTypeService {
  classify(contentType: string | null): ContentCategory {
    if (!contentType) {
      return 'html'
    }

    const mimeType = contentType.split(';')[0].trim().toLowerCase()

    if (HTML_TYPES.includes(mimeType)) {
      return 'html'
    }

    if (mimeType === 'application/pdf') {
      return 'pdf'
    }

    return 'unsupported'
  }

  async detect(
    url: string,
    options?: { validateUrl?: (url: string) => Promise<string | null> }
  ): Promise<string | null> {
    try {
      const res = await fetch(url, {
        method: 'HEAD',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; URLtoMarkdown/1.0)',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      })

      if (options?.validateUrl && res.url !== url) {
        const guardError = await options.validateUrl(res.url)
        if (guardError) {
          throw new SsrfRedirectError(res.url)
        }
      }

      const contentType = res.headers.get('content-type')
      const mimeType = contentType?.split(';')[0].trim().toLowerCase()

      if (mimeType === 'application/octet-stream' && contentType) {
        return await this.refineOctetStream(url, contentType)
      }

      return contentType
    } catch (error) {
      if (error instanceof SsrfRedirectError) throw error
      return null
    }
  }

  private async refineOctetStream(url: string, originalContentType: string): Promise<string> {
    const ext = this.extractExtension(url)
    if (ext && ext in EXTENSION_MIME_MAP) {
      return EXTENSION_MIME_MAP[ext]
    }

    try {
      const res = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; URLtoMarkdown/1.0)',
          'Range': 'bytes=0-7',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(10_000),
      })

      const buffer = new Uint8Array(await res.arrayBuffer())
      for (const { mime, bytes } of MAGIC_BYTES) {
        if (bytes.every((b, i) => buffer[i] === b)) {
          return mime
        }
      }
    } catch {
      // fall through
    }

    return originalContentType
  }

  private extractExtension(url: string): string | null {
    try {
      const pathname = new URL(url).pathname
      const dot = pathname.lastIndexOf('.')
      if (dot === -1) return null
      return pathname.slice(dot).toLowerCase().split(/[?#]/)[0]
    } catch {
      return null
    }
  }
}

const contentTypeService = new ContentTypeService()

export default contentTypeService
