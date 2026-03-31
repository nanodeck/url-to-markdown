/*
|--------------------------------------------------------------------------
| Test runner entrypoint
|--------------------------------------------------------------------------
|
| The "test.ts" file is the entrypoint for running tests using Japa.
|
| Either you can run this file directly or use the "test"
| command to run this file and monitor file changes.
|
*/

process.env.NODE_ENV = 'test'
process.env.HOST = process.env.HOST ?? '127.0.0.1'
process.env.PORT = process.env.PORT ?? '3334'

if (process.env.DISABLE_HTTP_SERVER === 'true') {
  const http = await import('node:http')
  const net = await import('node:net')
  const originalHttpListen = http.Server.prototype.listen
  const originalNetListen = net.Server.prototype.listen

  const noopListen = function (this: any, ...args: any[]) {
    const callback = typeof args.at(-1) === 'function' ? args.at(-1) : undefined

    if (callback) {
      process.nextTick(callback)
    }
    process.nextTick(() => this.emit('listening'))
    return this
  }

  http.Server.prototype.listen = noopListen
  net.Server.prototype.listen = noopListen

  process.on('exit', () => {
    http.Server.prototype.listen = originalHttpListen
    net.Server.prototype.listen = originalNetListen
  })
}

import 'reflect-metadata'
import { Ignitor, prettyPrintError } from '@adonisjs/core'
import { configure, processCLIArgs, run } from '@japa/runner'

/**
 * URL to the application root. AdonisJS need it to resolve
 * paths to file and directories for scaffolding commands
 */
const APP_ROOT = new URL('../', import.meta.url)

/**
 * The importer is used to import files in context of the
 * application.
 */
const IMPORTER = (filePath: string) => {
  if (filePath.startsWith('./') || filePath.startsWith('../')) {
    return import(new URL(filePath, APP_ROOT).href)
  }
  return import(filePath)
}

new Ignitor(APP_ROOT, { importer: IMPORTER })
  .tap((app) => {
    app.booting(async () => {
      await import('#start/env')
    })
    app.listen('SIGTERM', () => app.terminate())
    app.listenIf(app.managedByPm2, 'SIGINT', () => app.terminate())
  })
  .testRunner()
  .configure(async (app) => {
    const { runnerHooks, ...config } = await import('../tests/bootstrap.js')

    processCLIArgs(process.argv.splice(2))
    configure({
      ...app.rcFile.tests,
      ...config,
      setup: runnerHooks.setup,
      teardown: runnerHooks.teardown.concat([() => app.terminate()]),
    })
  })
  .run(() => run())
  .catch((error) => {
    process.exitCode = 1
    prettyPrintError(error)
  })
