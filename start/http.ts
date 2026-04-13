import { Agent, setGlobalDispatcher } from 'undici'
import env from '#start/env'

if (env.get('URL_IGNORE_HTTPS_ERRORS', false)) {
  setGlobalDispatcher(
    new Agent({
      connect: { rejectUnauthorized: false },
    })
  )
}
