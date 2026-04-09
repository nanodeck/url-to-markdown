import { test } from '@japa/runner'
import { createServer } from 'node:http'
import type { Server } from 'node:http'
import { ContentTypeService, SsrfRedirectError } from '#services/content_type_service'

test.group('ContentTypeService', () => {
  test('classifies text/html as html', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service.classify('text/html'), 'html')
  })

  test('classifies text/html with charset as html', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service.classify('text/html; charset=utf-8'), 'html')
  })

  test('classifies application/xhtml+xml as html', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service.classify('application/xhtml+xml'), 'html')
  })

  test('classifies application/pdf as pdf', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service.classify('application/pdf'), 'pdf')
  })

  test('classifies image/png as unsupported', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service.classify('image/png'), 'unsupported')
  })

  test('classifies application/json as unsupported', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service.classify('application/json'), 'unsupported')
  })

  test('classifies null content-type as html (fallback)', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service.classify(null), 'html')
  })

  test('extracts .pdf extension from URL', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service['extractExtension']('https://example.com/file.pdf'), '.pdf')
  })

  test('extracts extension from URL with query params', ({ assert }) => {
    const service = new ContentTypeService()
    assert.equal(service['extractExtension']('https://example.com/file.pdf?token=abc'), '.pdf')
  })

  test('returns null for URL without extension', ({ assert }) => {
    const service = new ContentTypeService()
    assert.isNull(service['extractExtension']('https://example.com/download'))
  })
})

let fixtureServer: Server
let fixturePort: number

test.group('ContentTypeService.detect', (group) => {
  group.setup(async () => {
    const pdfMagicBytes = Buffer.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])

    fixtureServer = createServer((req, res) => {
      if (req.url === '/octet-pdf') {
        if (req.method === 'HEAD') {
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
          res.end()
        } else {
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
          res.end(pdfMagicBytes)
        }
      } else if (req.url === '/octet-unknown') {
        if (req.method === 'HEAD') {
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
          res.end()
        } else {
          res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
          res.end(Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00]))
        }
      } else if (req.url === '/file.pdf') {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' })
        res.end()
      } else if (req.url === '/redirect') {
        res.writeHead(302, { Location: '/landing' })
        res.end()
      } else if (req.url === '/landing') {
        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end('<html></html>')
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
  })

  group.teardown(async () => {
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()))
  })

  test('refines octet-stream to application/pdf via magic bytes', async ({ assert }) => {
    const service = new ContentTypeService()
    const result = await service.detect(`http://127.0.0.1:${fixturePort}/octet-pdf`)
    assert.equal(result, 'application/pdf')
  })

  test('refines octet-stream to application/pdf via .pdf extension', async ({ assert }) => {
    const service = new ContentTypeService()
    const result = await service.detect(`http://127.0.0.1:${fixturePort}/file.pdf`)
    assert.equal(result, 'application/pdf')
  })

  test('falls back to octet-stream when magic bytes do not match', async ({ assert }) => {
    const service = new ContentTypeService()
    const result = await service.detect(`http://127.0.0.1:${fixturePort}/octet-unknown`)
    assert.equal(result, 'application/octet-stream')
  })

  test('throws SsrfRedirectError when redirect target is blocked', async ({ assert }) => {
    const service = new ContentTypeService()
    const validateUrl = async (_url: string) => 'blocked by guard'

    try {
      await service.detect(`http://127.0.0.1:${fixturePort}/redirect`, { validateUrl })
      assert.fail('Expected SsrfRedirectError to be thrown')
    } catch (error) {
      assert.instanceOf(error, SsrfRedirectError)
    }
  })
})
