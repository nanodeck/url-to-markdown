import env from '#start/env'
import { chromium, type Browser } from 'playwright'

export type ScreenshotOptions = {
  width: number
  height: number
}

export type FetchResult = {
  html: string
  status: number
  finalUrl: string
  screenshot: string | null
}

export class BrowserService {
  private browser: Browser | null = null
  private launching: Promise<Browser> | null = null

  private async launchBrowser(): Promise<Browser> {
    try {
      return await chromium.launch()
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to launch Chromium. Ensure Playwright browsers are installed.'
      throw new Error(message)
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser) {
      return this.browser
    }

    this.launching ??= this.launchBrowser()

    try {
      const browser = await this.launching
      browser.on('disconnected', () => {
        this.browser = null
      })
      this.browser = browser
      return browser
    } finally {
      this.launching = null
    }
  }

  async fetchPage(url: string, screenshot?: ScreenshotOptions): Promise<FetchResult> {
    const browser = await this.getBrowser()
    const page = await browser.newPage({
      viewport: {
        width: screenshot?.width ?? env.get('URL_VIEWPORT_WIDTH', 1280),
        height: screenshot?.height ?? env.get('URL_VIEWPORT_HEIGHT', 720),
      },
    })

    page.setDefaultTimeout(env.get('URL_TIMEOUT_MS', 30_000))
    page.setDefaultNavigationTimeout(env.get('URL_NAVIGATION_TIMEOUT_MS', 30_000))

    try {
      const response = await page.goto(url, {
        waitUntil: env.get('URL_WAIT_UNTIL', 'load'),
      })

      const status = response?.status() ?? 0
      const html = await page.content()
      const finalUrl = page.url()

      let screenshotBase64: string | null = null
      if (screenshot) {
        const buffer = await page.screenshot({ type: 'png', fullPage: false })
        screenshotBase64 = buffer.toString('base64')
      }

      return { html, status, finalUrl, screenshot: screenshotBase64 }
    } finally {
      await page.close()
    }
  }

  async shutdown() {
    if (!this.browser) {
      return
    }

    await this.browser.close()
    this.browser = null
  }
}

const browserService = new BrowserService()

export default browserService
