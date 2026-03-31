import { test } from '@japa/runner'

test('openapi ui is available', async ({ client }) => {
  const response = await client.get('/api')

  response.assertStatus(200)
  response.assertTextIncludes('<!doctype html>')
})
