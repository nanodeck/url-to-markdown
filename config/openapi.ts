import UrlController from '#controllers/url_controller'
import { defineConfig } from '@foadonis/openapi'

export default defineConfig({
  ui: 'scalar',
  document: {
    info: {
      title: 'URL to Markdown API',
      version: '1.0.0',
      description: 'Convert URLs to Markdown.',
    },
  },
  controllers: [UrlController],
})
