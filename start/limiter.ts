import env from '#start/env'
import limiter from '@adonisjs/limiter/services/main'

const requests = env.get('RATE_LIMIT_REQUESTS')
const duration = env.get('RATE_LIMIT_DURATION')
const blockFor = env.get('RATE_LIMIT_BLOCK_FOR')

export const throttle = limiter.define('global', (ctx) => {
  const guard = limiter.allowRequests(requests).every(duration).usingKey(`ip:${ctx.request.ip()}`)

  return blockFor ? guard.blockFor(blockFor) : guard
})
