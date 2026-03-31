/*
|--------------------------------------------------------------------------
| Environment variables service
|--------------------------------------------------------------------------
|
| The `Env.create` method creates an instance of the Env service. The
| service validates the environment variables and also cast values
| to JavaScript data types.
|
*/

import { Env } from '@adonisjs/core/env'

export default await Env.create(new URL('../', import.meta.url), {
  NODE_ENV: Env.schema.enum(['development', 'production', 'test'] as const),
  PORT: Env.schema.number(),
  APP_KEY: Env.schema.string(),
  HOST: Env.schema.string({ format: 'host' }),
  LOG_LEVEL: Env.schema.string(),
  APP_URL: Env.schema.string.optional(),
  APP_NAME: Env.schema.string.optional(),
  APP_VERSION: Env.schema.string.optional(),
  APP_ENV: Env.schema.string.optional(),

  REQUEST_BODY_LIMIT: Env.schema.string(),

  RATE_LIMIT_REQUESTS: Env.schema.number(),
  RATE_LIMIT_DURATION: Env.schema.string(),
  RATE_LIMIT_BLOCK_FOR: Env.schema.string.optional(),
  LIMITER_STORE: Env.schema.enum(['memory'] as const),

  URL_TIMEOUT_MS: Env.schema.number.optional(),
  URL_NAVIGATION_TIMEOUT_MS: Env.schema.number.optional(),
  URL_VIEWPORT_WIDTH: Env.schema.number.optional(),
  URL_VIEWPORT_HEIGHT: Env.schema.number.optional(),
  URL_WAIT_UNTIL: Env.schema.enum.optional(['load', 'domcontentloaded', 'networkidle'] as const),
})
