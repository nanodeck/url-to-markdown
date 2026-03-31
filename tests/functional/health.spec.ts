import { test } from '@japa/runner'

test('health endpoint returns ok', async ({ client }) => {
  const response = await client.get('/health')

  response.assertStatus(200)
  response.assertBodyContains({ status: 'ok' })
})
