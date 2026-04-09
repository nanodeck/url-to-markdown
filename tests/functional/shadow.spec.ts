import { test } from '@japa/runner'
import { createServer, type Server } from 'node:http'
import urlGuardService from '#services/url_guard_service'

let fixtureServer: Server
let fixtureUrl: string
let originalValidate: typeof urlGuardService.validate

const SHADOW_HTML = `<!DOCTYPE html>
<html>
<head><title>Shadow DOM Test</title></head>
<body>
  <h1>Light DOM heading</h1>
  <div id="host"></div>
  <script>
    const host = document.getElementById('host');
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = '<p>Shadow content visible</p>';

    // nested shadow DOM
    const inner = document.createElement('div');
    inner.id = 'inner-host';
    shadow.appendChild(inner);
    const innerShadow = inner.attachShadow({ mode: 'open' });
    innerShadow.innerHTML = '<span>Nested shadow content</span>';
  </script>
</body>
</html>`

test.group('Shadow DOM extraction', (group) => {
  group.setup(async () => {
    fixtureServer = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' })
      res.end(SHADOW_HTML)
    })

    await new Promise<void>((resolve) => {
      fixtureServer.listen(0, '127.0.0.1', () => {
        const addr = fixtureServer.address()
        if (addr && typeof addr === 'object') {
          fixtureUrl = `http://127.0.0.1:${addr.port}/`
        }
        resolve()
      })
    })

    // Allow localhost for this test group (SSRF guard blocks it by default)
    originalValidate = urlGuardService.validate.bind(urlGuardService)
    urlGuardService.validate = async (url: string) => {
      if (url.startsWith(fixtureUrl)) return null
      return originalValidate(url)
    }
  })

  group.teardown(async () => {
    urlGuardService.validate = originalValidate
    await new Promise<void>((resolve) => fixtureServer.close(() => resolve()))
  })

  test('shadow=true extracts shadow DOM content', async ({ client, assert }) => {
    const response = await client.get('/api/fetch').qs({ url: fixtureUrl, shadow: 'true' })

    response.assertStatus(200)

    const body = response.body()
    assert.include(body.markdown, 'Shadow content visible')
    assert.include(body.markdown, 'Nested shadow content')
  })

  test('without shadow param, shadow DOM content is absent', async ({ client, assert }) => {
    const response = await client.get('/api/fetch').qs({ url: fixtureUrl, browser: 'true' })

    response.assertStatus(200)

    const body = response.body()
    assert.notInclude(body.markdown, 'Shadow content visible')
  })
})
