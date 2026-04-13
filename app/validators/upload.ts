import vine from '@vinejs/vine'
import { SCREENSHOT_MAX_WIDTH } from '#schemas/url'

export const uploadFormValidator = vine.compile(
  vine.object({
    screenshot: vine
      .string()
      .trim()
      .optional()
      .transform((value) => value === 'true' || value === '1'),
    screenshot_width: vine.number().min(1).max(SCREENSHOT_MAX_WIDTH).optional(),
    screenshot_pages: vine.number().min(1).optional(),
  })
)
