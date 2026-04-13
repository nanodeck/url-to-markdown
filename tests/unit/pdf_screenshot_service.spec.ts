import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { PdfScreenshotService } from '#services/pdf_screenshot_service'

const PDF_FIXTURE = join(import.meta.dirname, '..', 'files', 'file-example_PDF_1MB.pdf')

test.group('PdfScreenshotService', () => {
  test('renders the first page of a PDF by default', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(PDF_FIXTURE))
    const service = new PdfScreenshotService()

    const screenshots = await service.render(buffer)

    assert.isArray(screenshots)
    assert.lengthOf(screenshots, 1)

    const decoded = Buffer.from(screenshots[0], 'base64')
    assert.deepEqual(
      [...decoded.subarray(0, 4)],
      [0x89, 0x50, 0x4e, 0x47],
      'should be a valid PNG (magic bytes)'
    )
  }).timeout(30_000)

  test('respects pages option to render multiple pages', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(PDF_FIXTURE))
    const service = new PdfScreenshotService()

    const screenshots = await service.render(buffer, { pages: 3 })

    assert.lengthOf(screenshots, 3)
    for (const screenshot of screenshots) {
      const decoded = Buffer.from(screenshot, 'base64')
      assert.deepEqual([...decoded.subarray(0, 4)], [0x89, 0x50, 0x4e, 0x47])
    }
  }).timeout(30_000)

  test('caps pages option at the actual page count', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(PDF_FIXTURE))
    const service = new PdfScreenshotService()

    const screenshots = await service.render(buffer, { pages: 9999 })

    assert.isAbove(screenshots.length, 1)
  }).timeout(60_000)

  test('respects width option to control output size', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(PDF_FIXTURE))
    const service = new PdfScreenshotService()

    const narrow = await service.render(buffer, { width: 640 })
    const wide = await service.render(buffer, { width: 1280 })

    assert.equal(narrow.length, wide.length)

    const bufNarrow = Buffer.from(narrow[0], 'base64')
    const bufWide = Buffer.from(wide[0], 'base64')
    assert.isAbove(bufWide.length, bufNarrow.length, 'wider render should produce a larger image')
  }).timeout(60_000)

  test('throws on invalid PDF buffer', async ({ assert }) => {
    const service = new PdfScreenshotService()
    const garbage = new Uint8Array([0, 1, 2, 3])

    await assert.rejects(async () => {
      await service.render(garbage)
    })
  })
})
