import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { PdfService } from '#services/pdf_service'
import { Pdf2mdConverter } from '#services/pdf_converters/pdf2md_converter'
import urlGuardService from '#services/url_guard_service'

const PDF_FIXTURE = join(import.meta.dirname, '..', 'files', 'file-example_PDF_1MB.pdf')

test.group('PdfService', () => {
  test('converts a PDF buffer to markdown', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(PDF_FIXTURE))

    const service = new PdfService(new Pdf2mdConverter())
    const result = await service.convert(buffer)

    assert.isString(result.markdown)
    assert.isNotEmpty(result.markdown)
  })

  test('throws on invalid PDF buffer', async ({ assert }) => {
    const service = new PdfService(new Pdf2mdConverter())
    const garbage = new Uint8Array([0, 1, 2, 3])

    await assert.rejects(async () => {
      await service.convert(garbage)
    })
  })

  test('converts a PDF buffer to markdown with screenshots', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(PDF_FIXTURE))

    const service = new PdfService(new Pdf2mdConverter())
    const result = await service.convert(buffer, { screenshot: true, screenshotWidth: 1280 })

    assert.isString(result.markdown)
    assert.isNotEmpty(result.markdown)
    assert.isArray(result.screenshots)
    assert.isAbove(result.screenshots!.length, 0)
    for (const s of result.screenshots!) {
      assert.isString(s)
      assert.isNotEmpty(s)
    }
  }).timeout(30_000)

  test('returns null screenshots when screenshot option is false', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(PDF_FIXTURE))

    const service = new PdfService(new Pdf2mdConverter())
    const result = await service.convert(buffer)

    assert.isString(result.markdown)
    assert.isNull(result.screenshots)
  })
})

let fixtureServer: Server
let fixturePort: number
let originalValidate: typeof urlGuardService.validate

test.group('PDF integration', (group) => {
  group.setup(async () => {
    const pdfBuffer = await readFile(PDF_FIXTURE)

    fixtureServer = createServer((req, res) => {
      if (req.url === '/test.pdf') {
        res.writeHead(200, { 'Content-Type': 'application/pdf' })
        res.end(pdfBuffer)
      } else if (req.url === '/test.png') {
        res.writeHead(200, { 'Content-Type': 'image/png' })
        res.end(Buffer.from([0x89, 0x50, 0x4e, 0x47]))
      } else {
        res.writeHead(404)
        res.end()
      }
    })

    await new Promise<void>((resolve) => {
      fixtureServer.listen(0, '127.0.0.1', () => {
        const addr = fixtureServer.address()
        fixturePort = typeof addr === 'object' && addr ? addr.port : 0
        resolve()
      })
    })

    originalValidate = urlGuardService.validate.bind(urlGuardService)
    urlGuardService.validate = async (url: string) => {
      if (url.includes(`127.0.0.1:${fixturePort}`)) return null
      return originalValidate(url)
    }
  })

  group.teardown(async () => {
    urlGuardService.validate = originalValidate
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()))
  })

  test('url endpoint returns markdown for a PDF URL', async ({ client, assert }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.pdf`,
    })

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'url')
    assert.property(body, 'markdown')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
    assert.property(body, 'title')
    assert.property(body, 'links')
    assert.isArray(body.links)
  })

  test('url endpoint returns markdown for a PDF URL even when browser=true', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.pdf`,
      browser: 'true',
    })

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'markdown')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
  })

  test('url endpoint returns screenshots for a PDF URL when screenshot=true', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.pdf`,
      screenshot: 'true',
    })

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'markdown')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
    assert.property(body, 'screenshots')
    assert.isArray(body.screenshots)
    assert.isAbove(body.screenshots.length, 0)

    for (const s of body.screenshots) {
      assert.isString(s)
      const decoded = Buffer.from(s, 'base64')
      assert.deepEqual(
        [...decoded.subarray(0, 4)],
        [0x89, 0x50, 0x4e, 0x47],
        'each screenshot should be a valid PNG'
      )
    }
  }).timeout(30_000)

  test('url endpoint does not return screenshots for PDF when screenshot is not requested', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.pdf`,
    })

    response.assertStatus(200)

    const body = response.body()
    assert.notProperty(body, 'screenshots')
  })

  test('url endpoint respects screenshot_pages for PDF rasterization', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.pdf`,
      screenshot: 'true',
      screenshot_pages: 3,
    })

    response.assertStatus(200)
    assert.lengthOf(response.body().screenshots, 3)
  }).timeout(30_000)

  test('url endpoint respects screenshot_width for PDF rasterization', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.pdf`,
      screenshot: 'true',
      screenshot_width: 640,
    })

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'screenshots')
    assert.isArray(body.screenshots)
    assert.isAbove(body.screenshots.length, 0)
  }).timeout(30_000)

  test('url endpoint returns 415 for unsupported MIME types', async ({ client, assert }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.png`,
    })

    response.assertStatus(415)

    const body = response.body()
    assert.property(body, 'error')
    assert.include(body.error.toLowerCase(), 'unsupported')
    assert.property(body, 'status')
    assert.equal(body.status, 415)
  })
})
