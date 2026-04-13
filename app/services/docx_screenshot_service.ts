import browserService from './browser_service.js'

export type DocxScreenshotOptions = {
  width?: number
  pages?: number
}

const DEFAULT_WIDTH = 1280
const DEFAULT_PAGES = 1
const A4_ASPECT_RATIO = 1.4142

export class DocxScreenshotService {
  async render(html: string, options?: DocxScreenshotOptions): Promise<string[]> {
    const width = options?.width ?? DEFAULT_WIDTH
    const pages = Math.max(1, options?.pages ?? DEFAULT_PAGES)
    const initialHeight = Math.round(width * A4_ASPECT_RATIO)

    const page = await browserService.newPage({ width, height: initialHeight })

    try {
      await page.setContent(html, { waitUntil: 'load' })

      if (pages === 1) {
        const buffer = await page.screenshot({ type: 'png', fullPage: true })
        return [buffer.toString('base64')]
      }

      const contentHeight = Number(await page.evaluate(`document.documentElement.scrollHeight`))
      await page.setViewportSize({ width, height: contentHeight })

      const sliceHeight = Math.ceil(contentHeight / pages)
      const screenshots: string[] = []

      for (let i = 0; i < pages; i++) {
        const y = i * sliceHeight
        const remaining = contentHeight - y
        if (remaining <= 0) break
        const buffer = await page.screenshot({
          type: 'png',
          clip: { x: 0, y, width, height: Math.min(sliceHeight, remaining) },
        })
        screenshots.push(buffer.toString('base64'))
      }

      return screenshots
    } finally {
      await page.close()
    }
  }
}

const docxScreenshotService = new DocxScreenshotService()

export default docxScreenshotService
