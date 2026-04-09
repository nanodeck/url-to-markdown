import { test } from '@japa/runner'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { DocxService } from '#services/docx_service'
import { MammothConverter } from '#services/docx_converters/mammoth_converter'
import urlGuardService from '#services/url_guard_service'

const DOCX_FIXTURE = join(import.meta.dirname, '..', 'files', 'sample.docx')

test.group('DocxService', () => {
  test('converts a DOCX buffer to markdown', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(DOCX_FIXTURE))

    const service = new DocxService(new MammothConverter())
    const result = await service.convert(buffer)

    assert.isString(result.markdown)
    assert.isNotEmpty(result.markdown)
    assert.include(result.markdown, 'Hello World')
    assert.include(result.markdown, 'Test Heading')
  })

  test('throws on invalid DOCX buffer', async ({ assert }) => {
    const service = new DocxService(new MammothConverter())
    const garbage = new Uint8Array([0, 1, 2, 3])

    await assert.rejects(async () => {
      await service.convert(garbage)
    })
  })

  test('converts a DOCX buffer to markdown with screenshots', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(DOCX_FIXTURE))

    const service = new DocxService(new MammothConverter())
    const result = await service.convert(buffer, { screenshot: true, screenshotWidth: 1280 })

    assert.isString(result.markdown)
    assert.isNotEmpty(result.markdown)
    assert.isArray(result.screenshots)
    assert.lengthOf(result.screenshots!, 1)
    assert.isString(result.screenshots![0])
    assert.isNotEmpty(result.screenshots![0])
  }).timeout(30_000)

  test('returns null screenshots when screenshot option is false', async ({ assert }) => {
    const buffer = new Uint8Array(await readFile(DOCX_FIXTURE))

    const service = new DocxService(new MammothConverter())
    const result = await service.convert(buffer)

    assert.isString(result.markdown)
    assert.isNull(result.screenshots)
  })
})

let fixtureServer: Server
let fixturePort: number
let originalValidate: typeof urlGuardService.validate

test.group('DOCX integration', (group) => {
  group.setup(async () => {
    const docxBuffer = await readFile(DOCX_FIXTURE)

    fixtureServer = createServer((req, res) => {
      if (req.url === '/test.docx') {
        res.writeHead(200, {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        })
        res.end(docxBuffer)
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

  test('url endpoint returns markdown for a DOCX URL', async ({ client, assert }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.docx`,
    })

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'url')
    assert.property(body, 'markdown')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
    assert.include(body.markdown, 'Hello World')
    assert.property(body, 'title')
    assert.isNull(body.title)
    assert.property(body, 'links')
    assert.isArray(body.links)
    assert.lengthOf(body.links, 0)
  })

  test('url endpoint returns markdown for a DOCX URL even when browser=true', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.docx`,
      browser: 'true',
    })

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'markdown')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
  })

  test('url endpoint returns screenshots for a DOCX URL when screenshot=true', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.docx`,
      screenshot: 'true',
    })

    response.assertStatus(200)

    const body = response.body()
    assert.property(body, 'markdown')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
    assert.property(body, 'screenshots')
    assert.isArray(body.screenshots)
    assert.lengthOf(body.screenshots, 1)

    const decoded = Buffer.from(body.screenshots[0], 'base64')
    assert.deepEqual(
      [...decoded.subarray(0, 4)],
      [0x89, 0x50, 0x4e, 0x47],
      'screenshot should be a valid PNG'
    )
  }).timeout(30_000)

  test('url endpoint does not return screenshots for DOCX when screenshot is not requested', async ({
    client,
    assert,
  }) => {
    const response = await client.get('/api/fetch').qs({
      url: `http://127.0.0.1:${fixturePort}/test.docx`,
    })

    response.assertStatus(200)

    const body = response.body()
    assert.notProperty(body, 'screenshots')
  })
})
