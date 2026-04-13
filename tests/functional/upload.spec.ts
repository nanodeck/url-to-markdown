import { test } from '@japa/runner'
import { join } from 'node:path'
import { writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'

const PDF_FIXTURE = join(import.meta.dirname, '..', 'files', 'file-example_PDF_1MB.pdf')
const DOCX_FIXTURE = join(import.meta.dirname, '..', 'files', 'sample.docx')

test.group('Upload endpoint', () => {
  test('PDF upload returns markdown with filename as url', async ({ client, assert }) => {
    const response = await client
      .post('/api/file')
      .file('file', PDF_FIXTURE, { contentType: 'application/pdf' })

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.url, 'file-example_PDF_1MB.pdf')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
    assert.isNull(body.title)
    assert.isArray(body.links)
    assert.notProperty(body, 'screenshots')
  })

  test('DOCX upload returns markdown with filename as url', async ({ client, assert }) => {
    const response = await client.post('/api/file').file('file', DOCX_FIXTURE, {
      contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    })

    response.assertStatus(200)
    const body = response.body()
    assert.equal(body.url, 'sample.docx')
    assert.isString(body.markdown)
    assert.isNotEmpty(body.markdown)
  })

  test('PDF upload with screenshot=true returns one screenshot by default', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/file')
      .file('file', PDF_FIXTURE, { contentType: 'application/pdf' })
      .fields({ screenshot: 'true' })

    response.assertStatus(200)
    const body = response.body()
    assert.isArray(body.screenshots)
    assert.lengthOf(body.screenshots, 1)
  }).timeout(30_000)

  test('PDF upload with screenshot_pages renders requested number of pages', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/file')
      .file('file', PDF_FIXTURE, { contentType: 'application/pdf' })
      .fields({ screenshot: 'true', screenshot_pages: '3' })

    response.assertStatus(200)
    assert.lengthOf(response.body().screenshots, 3)
  }).timeout(30_000)

  test('unsupported extension returns 415', async ({ client, assert }) => {
    const txtPath = join(tmpdir(), `upload-test-${Date.now()}.txt`)
    await writeFile(txtPath, 'hello world')

    const response = await client
      .post('/api/file')
      .file('file', txtPath, { contentType: 'text/plain' })

    response.assertStatus(415)
    const body = response.body()
    assert.equal(body.status, 415)
    assert.include(body.error.toLowerCase(), 'unsupported')
  })

  test('PDF mime header but DOCX bytes (extension docx) resolves as docx', async ({
    client,
    assert,
  }) => {
    const response = await client
      .post('/api/file')
      .file('file', DOCX_FIXTURE, { contentType: 'application/pdf', filename: 'spoofed.docx' })

    response.assertStatus(200)
    const body = response.body()
    assert.isString(body.markdown)
  })

  test('PDF mime header with random bytes returns 415', async ({ client }) => {
    const garbagePath = join(tmpdir(), `upload-garbage-${Date.now()}.pdf`)
    await writeFile(garbagePath, Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05]))

    const response = await client
      .post('/api/file')
      .file('file', garbagePath, { contentType: 'application/octet-stream', filename: 'x.bin' })

    response.assertStatus(415)
  })

  test('missing file field returns 422', async ({ client, assert }) => {
    const response = await client.post('/api/file').fields({ screenshot: 'true' })

    response.assertStatus(422)
    const body = response.body()
    assert.equal(body.status, 422)
    assert.include(body.error, 'file')
  })
})
