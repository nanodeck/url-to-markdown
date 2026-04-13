import { test } from '@japa/runner'

test('url endpoint returns markdown for a valid URL', async ({ client, assert }) => {
  const response = await client.get('/api/fetch').qs({ url: 'http://example.com' })

  response.assertStatus(200)

  const body = response.body()
  assert.property(body, 'url')
  assert.property(body, 'title')
  assert.property(body, 'markdown')
  assert.isString(body.markdown)
  assert.isNotEmpty(body.markdown)
  assert.property(body, 'links')
  assert.isArray(body.links)
})

test('url endpoint returns 422 when url is missing', async ({ client }) => {
  const response = await client.get('/api/fetch')

  response.assertStatus(422)
})

test('url endpoint returns 422 for invalid url', async ({ client }) => {
  const response = await client.get('/api/fetch').qs({ url: 'not-a-url' })

  response.assertStatus(422)
})

test('url endpoint forwards upstream non-success status', async ({ client, assert }) => {
  const response = await client.get('/api/fetch').qs({ url: 'https://httpbin.org/status/404' })

  response.assertStatus(404)

  const body = response.body()
  assert.property(body, 'error')
  assert.property(body, 'status')
  assert.equal(body.status, 404)
})

test('url endpoint returns 502 for unreachable host', async ({ client, assert }) => {
  const response = await client
    .get('/api/fetch')
    .qs({ url: 'http://this-domain-does-not-exist-12345.example' })

  response.assertStatus(502)

  const body = response.body()
  assert.property(body, 'error')
  assert.property(body, 'status')
  assert.equal(body.status, 502)
})

test('url endpoint rejects file:// URLs via validation', async ({ client }) => {
  const response = await client.get('/api/fetch').qs({ url: 'file:///etc/passwd' })

  // file:// is rejected by VineJS URL validation (defense-in-depth: SSRF guard also blocks it)
  response.assertStatus(422)
})

test('url endpoint blocks localhost URLs (SSRF)', async ({ client, assert }) => {
  const response = await client.get('/api/fetch').qs({ url: 'http://127.0.0.1/admin' })

  response.assertStatus(403)

  const body = response.body()
  assert.property(body, 'error')
  assert.include(body.error, 'private')
})

test('url endpoint blocks private IP ranges (SSRF)', async ({ client, assert }) => {
  const response = await client.get('/api/fetch').qs({ url: 'http://10.0.0.1/internal' })

  response.assertStatus(403)

  const body = response.body()
  assert.property(body, 'error')
  assert.include(body.error, 'private')
})

test('url endpoint returns screenshot when screenshot=true with browser', async ({
  client,
  assert,
}) => {
  const response = await client
    .get('/api/fetch')
    .qs({ url: 'http://example.com', browser: 'true', screenshot: 'true' })

  response.assertStatus(200)

  const body = response.body()
  assert.property(body, 'screenshots')
  assert.isArray(body.screenshots)
  assert.lengthOf(body.screenshots, 1)
  assert.isString(body.screenshots[0])
  assert.isNotEmpty(body.screenshots[0])
})

test('url endpoint does not return screenshots when screenshot is not requested', async ({
  client,
  assert,
}) => {
  const response = await client.get('/api/fetch').qs({ url: 'http://example.com' })

  response.assertStatus(200)

  const body = response.body()
  assert.notProperty(body, 'screenshots')
})
