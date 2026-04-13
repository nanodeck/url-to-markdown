import type { DocxConverter } from './docx_converters/docx_converter.js'
import { MammothConverter } from './docx_converters/mammoth_converter.js'
import markdownService from './markdown_service.js'
import docxScreenshotService from './docx_screenshot_service.js'

export type DocxConvertOptions = {
  screenshot?: boolean
  screenshotWidth?: number
  screenshotPages?: number
}

export type DocxConvertResult = {
  markdown: string
  screenshots: string[] | null
}

const FETCH_TIMEOUT_MS = 30_000
const MAX_DOCX_SIZE = 50 * 1024 * 1024 // 50 MB

export class DocxService {
  constructor(private readonly converter: DocxConverter) {}

  async convert(buffer: Uint8Array, options?: DocxConvertOptions): Promise<DocxConvertResult> {
    const html = await this.converter.convert(buffer)
    const markdown = markdownService.convert(html)

    let screenshots: string[] | null = null
    if (options?.screenshot) {
      screenshots = await docxScreenshotService.render(html, {
        width: options.screenshotWidth,
        pages: options.screenshotPages,
      })
    }

    return { markdown, screenshots }
  }

  async fetchAndConvert(
    url: string,
    options: DocxConvertOptions & { validateUrl: (url: string) => Promise<string | null> }
  ): Promise<DocxConvertResult> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URLtoMarkdown/1.0)',
        'Accept': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!res.ok) {
      throw new Error(`DOCX fetch failed with status ${res.status}`)
    }

    if (res.url !== url) {
      const guardError = await options.validateUrl(res.url)
      if (guardError) {
        throw new Error(`Redirect target blocked: ${guardError}`)
      }
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_DOCX_SIZE) {
      throw new Error(`DOCX too large: ${contentLength} bytes (max ${MAX_DOCX_SIZE})`)
    }

    const buffer = new Uint8Array(await res.arrayBuffer())

    if (buffer.byteLength > MAX_DOCX_SIZE) {
      throw new Error(`DOCX too large: ${buffer.byteLength} bytes (max ${MAX_DOCX_SIZE})`)
    }

    return this.convert(buffer, options)
  }
}

const docxService = new DocxService(new MammothConverter())

export default docxService
