import type { HttpContext } from '@adonisjs/core/http'
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@foadonis/openapi/decorators'
import { urlQueryValidator } from '#validators/url'
import { UrlToMarkdownResponse, UrlErrorResponse, UrlValidationErrorResponse, SCREENSHOT_DEFAULT_WIDTH, SCREENSHOT_DEFAULT_HEIGHT } from '#schemas/url'
import browserService, { type ScreenshotOptions } from '#services/browser_service'
import readabilityService from '#services/readability_service'
import markdownService from '#services/markdown_service'
import urlGuardService from '#services/url_guard_service'

export default class UrlController {
  @ApiTags('URL')
  @ApiOperation({
    summary: 'Convert URL to Markdown',
    description: 'Fetch a web page, extract its main content, and return it as Markdown.',
  })
  @ApiQuery({ name: 'url', required: true, type: String, description: 'URL to convert to Markdown' })
  @ApiQuery({ name: 'browser', required: false, type: Boolean, description: 'Use headless Chromium for JS-rendered pages' })
  @ApiQuery({ name: 'selector', required: false, type: String, description: 'CSS selector to extract specific content (skips Readability)' })
  @ApiQuery({ name: 'screenshot', required: false, type: Boolean, description: 'Capture a PNG screenshot of the page' })
  @ApiQuery({ name: 'screenshot_width', required: false, type: Number, description: 'Screenshot viewport width in pixels (default: 1280, max: 1920)' })
  @ApiQuery({ name: 'screenshot_height', required: false, type: Number, description: 'Screenshot viewport height in pixels (default: 720, max: 1080)' })
  @ApiResponse({
    status: 200,
    description: 'Markdown conversion result',
    type: UrlToMarkdownResponse,
  })
  @ApiResponse({
    status: 422,
    description: 'Validation error',
    type: UrlValidationErrorResponse,
  })
  @ApiResponse({
    status: 403,
    description: 'URL blocked by SSRF protection',
    type: UrlErrorResponse,
  })
  @ApiResponse({
    status: 502,
    description: 'Failed to reach URL',
    type: UrlErrorResponse,
  })
  async show({ request, response, logger }: HttpContext) {
    const payload = await request.validateUsing(urlQueryValidator, {
      data: request.qs(),
    })

    const guardError = await urlGuardService.validate(payload.url)
    if (guardError) {
      logger.info({ url: payload.url, reason: guardError }, 'url:blocked by SSRF guard')
      return response.status(403).send({ error: guardError, status: 403 })
    }

    const startedAt = Date.now()
    const screenshotOpts = this.buildScreenshotOptions(!!payload.screenshot, payload.screenshot_width, payload.screenshot_height)
    const useBrowser = !!payload.browser || !!screenshotOpts

    logger.info({ url: payload.url, browser: useBrowser, screenshot: !!screenshotOpts }, 'url:request received')

    const fetchResult = await this.fetchUrl(payload.url, useBrowser, screenshotOpts, logger)
    if ('error' in fetchResult) {
      return response.status(fetchResult.status).send(fetchResult)
    }

    const { html, status, finalUrl, screenshot } = fetchResult

    if (status >= 400 || status === 0) {
      logger.info({ url: payload.url, status }, 'url:upstream non-success status')
      return response.status(status || 502).send({
        error: 'URL returned non-success status',
        status,
      })
    }

    const extracted = readabilityService.extract(html, finalUrl, payload.selector)
    const markdown = markdownService.convert(extracted.content)

    logger.info(
      { durationMs: Date.now() - startedAt, url: finalUrl, markdownLength: markdown.length, linksCount: extracted.links.length },
      'url:request completed'
    )

    const result: Record<string, unknown> = {
      url: finalUrl,
      title: extracted.title,
      markdown,
      links: extracted.links,
    }

    if (screenshot) {
      result.screenshot = screenshot
    }

    return response.send(result)
  }

  private buildScreenshotOptions(enabled: boolean, width?: number, height?: number): ScreenshotOptions | undefined {
    if (!enabled) {
      return undefined
    }
    return {
      width: width ?? SCREENSHOT_DEFAULT_WIDTH,
      height: height ?? SCREENSHOT_DEFAULT_HEIGHT,
    }
  }

  private async fetchUrl(
    url: string,
    useBrowser: boolean,
    screenshot: ScreenshotOptions | undefined,
    logger: import('@adonisjs/core/logger').Logger
  ): Promise<{ html: string; status: number; finalUrl: string; screenshot: string | null } | { error: string; status: number }> {
    try {
      if (useBrowser) {
        return await browserService.fetchPage(url, screenshot)
      }

      const res = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; URLtoMarkdown/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
        redirect: 'follow',
      })

      const html = await res.text()
      return { html, status: res.status, finalUrl: res.url, screenshot: null }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch URL'
      logger.info({ err: error, url, message }, 'url:fetch failed')
      return { error: `Failed to fetch URL: ${message}`, status: 502 }
    }
  }
}
