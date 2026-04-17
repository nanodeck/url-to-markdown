import type { HttpContext } from '@adonisjs/core/http'
import { ApiExcludeOperation } from '@foadonis/openapi/decorators'

export default class HomeController {
  @ApiExcludeOperation()
  async show({ view }: HttpContext) {
    return view.render('home', { docsPath: '/api' })
  }
}
