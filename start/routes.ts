/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { throttle } from '#start/limiter'
import router from '@adonisjs/core/services/router'
import openapi from '@foadonis/openapi/services/main'

openapi.registerRoutes()

router.get('/', [() => import('#controllers/home_controller'), 'show'])
router.get('/health', [() => import('#controllers/health_controller'), 'show'])
router.get('/api/fetch', [() => import('#controllers/url_controller'), 'show']).use(throttle)
router.post('/api/upload', [() => import('#controllers/upload_controller'), 'store']).use(throttle)
