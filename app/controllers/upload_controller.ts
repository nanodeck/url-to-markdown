import type { HttpContext } from '@adonisjs/core/http'
import type { Logger } from '@adonisjs/core/logger'
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@foadonis/openapi/decorators'
import { readFile } from 'node:fs/promises'
import env from '#start/env'
import { uploadFormValidator } from '#validators/upload'
import {
  UrlToMarkdownResponse,
  UrlErrorResponse,
  UrlValidationErrorResponse,
  SCREENSHOT_DEFAULT_WIDTH,
} from '#schemas/url'
import pdfService from '#services/pdf_service'
import docxService from '#services/docx_service'
import { isPdfBytes } from '#services/content_type_service'

type Kind = 'pdf' | 'docx'

type ConvertOptions = { screenshot: boolean; screenshotWidth: number; screenshotPages?: number }

type ConvertResult = { markdown: string; screenshots: string[] | null }

const CONVERTERS: Record<
  Kind,
  (buffer: Uint8Array, options: ConvertOptions) => Promise<ConvertResult>
> = {
  pdf: (buffer, options) => pdfService.convert(buffer, options),
  docx: (buffer, options) => docxService.convert(buffer, options),
}

function resolveKind(ext: string | undefined, buffer: Uint8Array): Kind | null {
  if (ext === 'docx') return 'docx'
  if (ext === 'pdf' && isPdfBytes(buffer)) return 'pdf'
  return null
}

export default class UploadController {
  @ApiTags('Upload')
  @ApiOperation({
    summary: 'Upload a file and convert to Markdown',
    description: 'Accepts PDF or DOCX file uploads via multipart form data.',
  })
  @ApiBody({
    description: 'Multipart form data with file field and optional screenshot fields',
    required: true,
    mediaType: 'multipart/form-data',
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: { type: 'string', format: 'binary', description: 'PDF or DOCX file' },
        screenshot: { type: 'boolean', description: 'Render page screenshots' },
        screenshot_width: {
          type: 'number',
          description: 'Screenshot width in pixels (default 1280, max 1920)',
        },
        screenshot_pages: {
          type: 'number',
          description: 'Number of pages to render (default 1)',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Markdown conversion result',
    type: UrlToMarkdownResponse,
  })
  @ApiResponse({ status: 413, description: 'File too large', type: UrlErrorResponse })
  @ApiResponse({ status: 415, description: 'Unsupported file type', type: UrlErrorResponse })
  @ApiResponse({ status: 422, description: 'Validation error', type: UrlValidationErrorResponse })
  @ApiResponse({ status: 502, description: 'Conversion failed', type: UrlErrorResponse })
  async store({ request, response, logger }: HttpContext) {
    const payload = await request.validateUsing(uploadFormValidator, { data: request.all() })

    const maxMb = env.get('UPLOAD_MAX_SIZE_MB', 50)
    const file = request.file('file', {
      size: `${maxMb}mb`,
      extnames: ['pdf', 'docx'],
    })

    if (!file) {
      return response.status(422).send({ error: 'file required', status: 422 })
    }

    if (!file.isValid) {
      const sizeError = file.errors.find((e) => e.type === 'size')
      if (sizeError) {
        return response.status(413).send({ error: `File too large (max ${maxMb}MB)`, status: 413 })
      }
      return response.status(415).send({ error: 'Unsupported file type', status: 415 })
    }

    if (!file.tmpPath) {
      return response.status(502).send({ error: 'Failed to read upload', status: 502 })
    }

    const buffer = new Uint8Array(await readFile(file.tmpPath))
    const kind = resolveKind(file.extname?.toLowerCase(), buffer)
    if (!kind) {
      return response.status(415).send({ error: 'File type mismatch', status: 415 })
    }

    const options: ConvertOptions = {
      screenshot: !!payload.screenshot,
      screenshotWidth: payload.screenshot_width ?? SCREENSHOT_DEFAULT_WIDTH,
      screenshotPages: payload.screenshot_pages,
    }

    return this.convert(kind, file.clientName, buffer, options, response, logger)
  }

  private async convert(
    kind: Kind,
    filename: string,
    buffer: Uint8Array,
    options: ConvertOptions,
    response: HttpContext['response'],
    logger: Logger
  ) {
    const startedAt = Date.now()
    const label = kind.toUpperCase()

    try {
      const result = await CONVERTERS[kind](buffer, options)

      logger.info(
        {
          filename,
          size: buffer.byteLength,
          kind,
          durationMs: Date.now() - startedAt,
          markdownLength: result.markdown.length,
          screenshotCount: result.screenshots?.length ?? 0,
        },
        'upload:converted'
      )

      const body: Record<string, unknown> = {
        url: filename,
        title: null,
        markdown: result.markdown,
        links: [],
      }
      if (result.screenshots) body.screenshots = result.screenshots
      return response.send(body)
    } catch (error) {
      const message = error instanceof Error ? error.message : `Failed to process ${label}`
      logger.info({ err: error, filename, kind }, 'upload:failed')
      return response
        .status(502)
        .send({ error: `Failed to process ${label}: ${message}`, status: 502 })
    }
  }
}
