import vine from '@vinejs/vine'
import { ApiProperty } from '@foadonis/openapi/decorators'

export const SCREENSHOT_MAX_WIDTH = 1920
export const SCREENSHOT_MAX_HEIGHT = 1080
export const SCREENSHOT_DEFAULT_WIDTH = 1280
export const SCREENSHOT_DEFAULT_HEIGHT = 720

export const urlRequestSchema = vine.object({
  url: vine.string().trim().url(),
  browser: vine
    .string()
    .trim()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  selector: vine.string().trim().optional(),
  screenshot: vine
    .string()
    .trim()
    .optional()
    .transform((value) => value === 'true' || value === '1'),
  screenshot_width: vine.number().min(1).max(SCREENSHOT_MAX_WIDTH).optional(),
  screenshot_height: vine.number().min(1).max(SCREENSHOT_MAX_HEIGHT).optional(),
})

export class UrlLink {
  @ApiProperty({ type: String, example: 'https://example.com/about' })
  declare url: string

  @ApiProperty({ type: String, example: 'About Us' })
  declare text: string

  @ApiProperty({
    required: false,
    type: String,
    example: 'nofollow',
    description: 'Value of the rel attribute, if present',
  })
  declare rel: string | null
}

export class UrlToMarkdownResponse {
  @ApiProperty({
    type: String,
    example: 'https://example.com/article',
    description: 'Final URL (after redirects)',
  })
  declare url: string

  @ApiProperty({
    required: false,
    type: String,
    example: 'Article Title',
    description: 'Page title',
  })
  declare title: string | null

  @ApiProperty({
    type: String,
    example: '# Article Title\n\nContent here...',
    description: 'Markdown content',
  })
  declare markdown: string

  @ApiProperty({
    type: [UrlLink],
    description:
      'Same-domain links found on the page, resolved to absolute URLs (external links are excluded)',
  })
  declare links: UrlLink[]

  @ApiProperty({
    required: false,
    type: String,
    description: 'Base64-encoded PNG screenshot of the page (present when screenshot=true)',
  })
  declare screenshot: string | null
}

export class UrlErrorResponse {
  @ApiProperty({ type: String, example: 'URL returned non-success status' })
  declare error: string

  @ApiProperty({ type: Number, example: 404 })
  declare status: number
}

export class UrlValidationIssue {
  @ApiProperty({ type: String, example: 'url' })
  declare field: string

  @ApiProperty({ type: String, example: 'url' })
  declare rule: string

  @ApiProperty({ type: String, example: 'The url field must be a valid URL' })
  declare message: string
}

export class UrlValidationErrorResponse {
  @ApiProperty({ type: [UrlValidationIssue] })
  declare errors: UrlValidationIssue[]
}
