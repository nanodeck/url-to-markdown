import type { PdfConverter } from './pdf_converters/pdf_converter.js'
import { Pdf2mdConverter } from './pdf_converters/pdf2md_converter.js'
import pdfScreenshotService from './pdf_screenshot_service.js'

export type PdfConvertOptions = {
  screenshot?: boolean
  screenshotWidth?: number
}

export type PdfConvertResult = {
  markdown: string
  screenshots: string[] | null
}

const FETCH_TIMEOUT_MS = 30_000
const MAX_PDF_SIZE = 50 * 1024 * 1024 // 50 MB

export class PdfService {
  constructor(private converter: PdfConverter) {}

  async convert(buffer: Uint8Array, options?: PdfConvertOptions): Promise<PdfConvertResult> {
    const markdown = await this.converter.convert(buffer)

    let screenshots: string[] | null = null
    if (options?.screenshot) {
      screenshots = await pdfScreenshotService.render(buffer, {
        width: options.screenshotWidth,
      })
    }

    return { markdown, screenshots }
  }

  async fetchAndConvert(
    url: string,
    options: PdfConvertOptions & { validateUrl: (url: string) => Promise<string | null> }
  ): Promise<PdfConvertResult> {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; URLtoMarkdown/1.0)',
        'Accept': 'application/pdf',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    })

    if (!res.ok) {
      throw new Error(`PDF fetch failed with status ${res.status}`)
    }

    if (res.url !== url) {
      const guardError = await options.validateUrl(res.url)
      if (guardError) {
        throw new Error(`Redirect target blocked: ${guardError}`)
      }
    }

    const contentLength = res.headers.get('content-length')
    if (contentLength && Number.parseInt(contentLength, 10) > MAX_PDF_SIZE) {
      throw new Error(`PDF too large: ${contentLength} bytes (max ${MAX_PDF_SIZE})`)
    }

    const buffer = new Uint8Array(await res.arrayBuffer())

    if (buffer.byteLength > MAX_PDF_SIZE) {
      throw new Error(`PDF too large: ${buffer.byteLength} bytes (max ${MAX_PDF_SIZE})`)
    }

    return this.convert(buffer, options)
  }
}

const pdfService = new PdfService(new Pdf2mdConverter())

export default pdfService
