import TurndownService from 'turndown'
import { gfm } from '@truto/turndown-plugin-gfm'

export class MarkdownService {
  private turndown: TurndownService

  constructor() {
    this.turndown = new TurndownService({
      headingStyle: 'atx',
      codeBlockStyle: 'fenced',
      bulletListMarker: '-',
    })

    this.turndown.use(gfm)

    // Turndown emits the raw text of these elements as markdown, which leaks
    // inline JavaScript and CSS into the output for non-Readability code paths.
    this.turndown.remove(['script', 'style', 'noscript', 'template', 'iframe'])
  }

  convert(html: string): string {
    return this.turndown.turndown(html)
  }
}

const markdownService = new MarkdownService()

export default markdownService
