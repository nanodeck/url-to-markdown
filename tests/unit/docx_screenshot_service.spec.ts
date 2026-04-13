import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import mammoth from 'mammoth'
import { DocxScreenshotService } from '#services/docx_screenshot_service'

const DOCX_FIXTURE = join(import.meta.dirname, '..', 'files', 'sample.docx')

let html: string

test.group('DocxScreenshotService', (group) => {
  group.setup(async () => {
    const buffer = await readFile(DOCX_FIXTURE)
    const result = await mammoth.convertToHtml({ buffer })
    html = result.value
  })

  test('renders HTML to a single base64 PNG screenshot', async ({ assert }) => {
    const service = new DocxScreenshotService()
    const screenshots = await service.render(html)

    assert.isArray(screenshots)
    assert.lengthOf(screenshots, 1)
    assert.isString(screenshots[0])
    assert.isNotEmpty(screenshots[0])

    const decoded = Buffer.from(screenshots[0], 'base64')
    assert.deepEqual(
      [...decoded.subarray(0, 4)],
      [0x89, 0x50, 0x4e, 0x47],
      'should be a valid PNG (magic bytes)'
    )
  }).timeout(30_000)

  test('respects pages option to slice the render', async ({ assert }) => {
    const service = new DocxScreenshotService()
    const screenshots = await service.render(html, { pages: 3 })

    assert.lengthOf(screenshots, 3)
    for (const screenshot of screenshots) {
      const decoded = Buffer.from(screenshot, 'base64')
      assert.deepEqual([...decoded.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47])
    }
  }).timeout(30_000)

  test('respects width option', async ({ assert }) => {
    const service = new DocxScreenshotService()

    const narrow = await service.render(html, { width: 640 })
    const wide = await service.render(html, { width: 1280 })

    assert.lengthOf(narrow, 1)
    assert.lengthOf(wide, 1)

    const bufNarrow = Buffer.from(narrow[0], 'base64')
    const bufWide = Buffer.from(wide[0], 'base64')
    assert.isAbove(bufWide.length, bufNarrow.length, 'wider render should produce a larger image')
  }).timeout(60_000)
})
