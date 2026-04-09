import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { createCanvas, Path2D } from '@napi-rs/canvas'

export type PdfScreenshotOptions = {
  width?: number
}

const DEFAULT_WIDTH = 1280

// pdfjs-dist expects a global Path2D for canvas rendering; Node.js doesn't provide one,
// so we polyfill it with @napi-rs/canvas's implementation.
if (!('Path2D' in globalThis)) {
  Object.defineProperty(globalThis, 'Path2D', { value: Path2D })
}

export class PdfScreenshotService {
  async render(buffer: Uint8Array, options?: PdfScreenshotOptions): Promise<string[]> {
    const targetWidth = options?.width ?? DEFAULT_WIDTH
    const doc = await getDocument({
      data: buffer.slice(),
      useSystemFonts: true,
      isEvalSupported: false,
    }).promise

    const screenshots: string[] = []

    try {
      for (let page = 1; page <= doc.numPages; page++) {
        const pdfPage = await doc.getPage(page)
        const defaultViewport = pdfPage.getViewport({ scale: 1 })
        const scale = targetWidth / defaultViewport.width
        const viewport = pdfPage.getViewport({ scale })

        const canvas = createCanvas(Math.floor(viewport.width), Math.floor(viewport.height))
        const ctx = canvas.getContext('2d')

        await pdfPage.render({ canvas: canvas as never, canvasContext: ctx as never, viewport })
          .promise

        screenshots.push(canvas.toBuffer('image/png').toString('base64'))
      }
    } finally {
      doc.destroy()
    }

    return screenshots
  }
}

const pdfScreenshotService = new PdfScreenshotService()

export default pdfScreenshotService
