import type { HttpContext } from '@adonisjs/core/http'

export default class HealthController {
  async show({ response }: HttpContext) {
    return response.ok({
      status: 'ok',
      uptime: process.uptime(),
    })
  }
}
