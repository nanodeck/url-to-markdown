import { defineConfig } from '@adonisjs/core/app'

export default defineConfig({
  experimental: {
    mergeMultipartFieldsAndFiles: true,
    shutdownInReverseOrder: true,
  },

  commands: [() => import('@adonisjs/core/commands')],

  providers: [
    () => import('@adonisjs/core/providers/app_provider'),
    () => import('@adonisjs/core/providers/edge_provider'),
    () => import('@adonisjs/core/providers/hash_provider'),
    () => import('@adonisjs/core/providers/vinejs_provider'),
    () => import('@adonisjs/limiter/limiter_provider'),
    {
      file: () => import('@adonisjs/core/providers/repl_provider'),
      environment: ['repl', 'test'],
    },
    () => import('@foadonis/openapi/openapi_provider'),
  ],

  preloads: [
    () => import('#start/routes'),
    () => import('#start/kernel'),
    () => import('#start/http'),
    () => import('#start/browser'),
  ],

  metaFiles: [
    {
      pattern: 'resources/views/**/*.edge',
      reloadServer: false,
    },
  ],

  tests: {
    suites: [
      {
        files: ['tests/unit/**/*.spec(.ts|.js)'],
        name: 'unit',
        timeout: 2000,
      },
      {
        files: ['tests/functional/**/*.spec(.ts|.js)'],
        name: 'functional',
        timeout: 30000,
      },
    ],
    forceExit: false,
  },
})
