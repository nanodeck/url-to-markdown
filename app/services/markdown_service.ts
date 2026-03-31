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
  }

  convert(html: string): string {
    return this.turndown.turndown(html)
  }
}

const markdownService = new MarkdownService()

export default markdownService
