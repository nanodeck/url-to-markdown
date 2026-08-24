import { test } from '@japa/runner'
import { MarkdownService } from '#services/markdown_service'

test.group('MarkdownService', () => {
  test('drops script contents from markdown', ({ assert }) => {
    const service = new MarkdownService()
    const markdown = service.convert(
      '<div><p>Hello</p><script>var secret = 1; window.alert("pwn")</script></div>'
    )

    assert.include(markdown, 'Hello')
    assert.notInclude(markdown, 'var secret')
    assert.notInclude(markdown, 'window.alert')
  })

  test('drops style contents from markdown', ({ assert }) => {
    const service = new MarkdownService()
    const markdown = service.convert('<div><p>Hello</p><style>.a { color: red }</style></div>')

    assert.include(markdown, 'Hello')
    assert.notInclude(markdown, 'color: red')
  })

  test('drops noscript and template contents from markdown', ({ assert }) => {
    const service = new MarkdownService()
    const markdown = service.convert(
      '<div><p>Hello</p><noscript>Enable JS</noscript><template><p>Hidden</p></template></div>'
    )

    assert.include(markdown, 'Hello')
    assert.notInclude(markdown, 'Enable JS')
    assert.notInclude(markdown, 'Hidden')
  })

  test('keeps regular content intact', ({ assert }) => {
    const service = new MarkdownService()
    const markdown = service.convert('<h1>Title</h1><p>Body <a href="/x">link</a></p>')

    assert.include(markdown, '# Title')
    assert.include(markdown, '[link](/x)')
  })
})
