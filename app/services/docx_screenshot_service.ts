import browserService from './browser_service.js'

export type DocxScreenshotOptions = {
  width?: number
}

const DEFAULT_WIDTH = 1280
const A4_ASPECT_RATIO = 1.4142

export class DocxScreenshotService {
  async render(html: string, options?: DocxScreenshotOptions): Promise<string[]> {
    const width = options?.width ?? DEFAULT_WIDTH
    const height = Math.round(width * A4_ASPECT_RATIO)

    const page = await browserService.newPage({ width, height })

    try {
      await page.setContent(html, { waitUntil: 'load' })
      const buffer = await page.screenshot({ type: 'png', fullPage: true })
      return [buffer.toString('base64')]
    } finally {
      await page.close()
    }
  }
}

const docxScreenshotService = new DocxScreenshotService()

export default docxScreenshotService
