import app from '@adonisjs/core/services/app'
import browserService from '#services/browser_service'

app.terminating(async () => {
  await browserService.shutdown()
})
