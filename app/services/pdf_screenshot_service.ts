import { createIsomorphicCanvasFactory, getDocumentProxy, renderPageAsImage } from 'unpdf'

export type PdfScreenshotOptions = {
  width?: number
  pages?: number
}

const DEFAULT_WIDTH = 1280
const DEFAULT_PAGES = 1

// Use unpdf (which bundles its own pdfjs) for both markdown extraction and
// screenshot rendering. Importing pdfjs-dist directly here used to cause a
// "API version vs Worker version" mismatch once unpdf had loaded its bundled
// pdfjs into the process.
const canvasImport = () => import('@napi-rs/canvas')

export class PdfScreenshotService {
  async render(buffer: Uint8Array, options?: PdfScreenshotOptions): Promise<string[]> {
    const targetWidth = options?.width ?? DEFAULT_WIDTH
    const maxPages = Math.max(1, options?.pages ?? DEFAULT_PAGES)
    // unpdf's bundled pdfjs has a built-in NodeCanvasFactory that always throws
    // ("@napi-rs/canvas is not available"). We must inject our own factory at
    // document construction time so internal renders (e.g. image patterns)
    // don't hit the broken built-in.
    const CanvasFactory = await createIsomorphicCanvasFactory(canvasImport)
    const doc = await getDocumentProxy(buffer.slice(), { CanvasFactory })

    const screenshots: string[] = []

    try {
      const lastPage = Math.min(maxPages, doc.numPages)
      for (let page = 1; page <= lastPage; page++) {
        const dataUrl = await renderPageAsImage(doc, page, {
          canvasImport,
          width: targetWidth,
          toDataURL: true,
        })
        // dataUrl format: "data:image/png;base64,XXXX"
        const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1)
        screenshots.push(base64)
      }
    } finally {
      await doc.loadingTask.destroy()
    }

    return screenshots
  }
}

const pdfScreenshotService = new PdfScreenshotService()

export default pdfScreenshotService
