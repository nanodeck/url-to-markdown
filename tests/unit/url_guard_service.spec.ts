import { test } from '@japa/runner'
import { UrlGuardService } from '#services/url_guard_service'

test.group('UrlGuardService: default (no allowlists)', () => {
  test('blocks private 10.x IP', async ({ assert }) => {
    const guard = new UrlGuardService()
    const result = await guard.validate('http://10.0.0.1/secret')
    assert.isNotNull(result)
  })

  test('blocks 192.168.x IP', async ({ assert }) => {
    const guard = new UrlGuardService()
    const result = await guard.validate('http://192.168.1.1/')
    assert.isNotNull(result)
  })

  test('blocks 127.0.0.1', async ({ assert }) => {
    const guard = new UrlGuardService()
    const result = await guard.validate('http://127.0.0.1/admin')
    assert.isNotNull(result)
  })

  test('blocks file:// protocol', async ({ assert }) => {
    const guard = new UrlGuardService()
    const result = await guard.validate('file:///etc/passwd')
    assert.isNotNull(result)
  })

  test('allows public IPs', async ({ assert }) => {
    const guard = new UrlGuardService()
    const result = await guard.validate('http://93.184.216.34/')
    assert.isNull(result)
  })
})

test.group('UrlGuardService: CIDR allowlist', () => {
  test('allows private IP that matches allowed CIDR', async ({ assert }) => {
    const guard = new UrlGuardService(['10.96.0.0/12'])
    const result = await guard.validate('http://10.96.0.1/')
    assert.isNull(result)
  })

  test('allows IP at end of allowed CIDR range', async ({ assert }) => {
    const guard = new UrlGuardService(['10.96.0.0/12'])
    const result = await guard.validate('http://10.111.255.254/')
    assert.isNull(result)
  })

  test('still blocks private IP outside allowed CIDR', async ({ assert }) => {
    const guard = new UrlGuardService(['10.96.0.0/12'])
    const result = await guard.validate('http://10.0.0.1/')
    assert.isNotNull(result)
  })

  test('supports multiple CIDRs', async ({ assert }) => {
    const guard = new UrlGuardService(['10.96.0.0/12', '192.168.1.0/24'])

    assert.isNull(await guard.validate('http://10.100.0.1/'))
    assert.isNull(await guard.validate('http://192.168.1.50/'))
    assert.isNotNull(await guard.validate('http://192.168.2.1/'))
  })

  test('still blocks file:// even with CIDR allowlist', async ({ assert }) => {
    const guard = new UrlGuardService(['10.0.0.0/8'])
    const result = await guard.validate('file:///etc/passwd')
    assert.isNotNull(result)
  })

  test('ignores invalid CIDR entries', async ({ assert }) => {
    const guard = new UrlGuardService(['not-a-cidr', '10.96.0.0/12'])
    assert.isNull(await guard.validate('http://10.96.0.1/'))
    assert.isNotNull(await guard.validate('http://10.0.0.1/'))
  })
})

test.group('UrlGuardService: host allowlist', () => {
  test('allows explicitly allowed hostname', async ({ assert }) => {
    const guard = new UrlGuardService([], ['pdf-store.internal.svc.cluster.local'])
    const result = await guard.validate('http://pdf-store.internal.svc.cluster.local/doc.pdf')
    assert.isNull(result)
  })

  test('hostname matching is case-insensitive', async ({ assert }) => {
    const guard = new UrlGuardService([], ['My-Service.Local'])
    const result = await guard.validate('http://my-service.local/api')
    assert.isNull(result)
  })

  test('does not allow private IPs not in host list', async ({ assert }) => {
    const guard = new UrlGuardService([], ['allowed.internal'])
    const result = await guard.validate('http://10.0.0.1/')
    assert.isNotNull(result)
  })

  test('still blocks file:// even with host allowlist', async ({ assert }) => {
    const guard = new UrlGuardService([], ['anything'])
    const result = await guard.validate('file:///etc/passwd')
    assert.isNotNull(result)
  })
})

test.group('UrlGuardService: both allowlists combined', () => {
  test('CIDR and host allowlists work together', async ({ assert }) => {
    const guard = new UrlGuardService(
      ['10.96.0.0/12'],
      ['pdf-store.internal.svc.cluster.local']
    )

    // Allowed by CIDR
    assert.isNull(await guard.validate('http://10.96.0.1/'))
    // Allowed by hostname
    assert.isNull(await guard.validate('http://pdf-store.internal.svc.cluster.local/doc.pdf'))
    // Blocked: private IP not in CIDR
    assert.isNotNull(await guard.validate('http://10.0.0.1/'))
    // Blocked: protocol
    assert.isNotNull(await guard.validate('file:///etc/passwd'))
  })
})
