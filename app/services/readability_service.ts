import { parseHTML } from 'linkedom'
import { Readability } from '@mozilla/readability'

export type ExtractedLink = {
  url: string
  text: string
  rel: string | null
}

export type ExtractResult = {
  title: string | null
  content: string
  links: ExtractedLink[]
}

export class ReadabilityService {
  extract(html: string, baseUrl: string, selector?: string): ExtractResult {
    const { document } = parseHTML(html)

    const links = this.extractLinks(document, baseUrl)
    const title = this.extractTitle(document)

    if (selector) {
      const element = document.querySelector(selector)
      return {
        title,
        content: element ? element.innerHTML : '',
        links,
      }
    }

    const article = new Readability(document).parse()

    if (!article) {
      return {
        title,
        content: html,
        links,
      }
    }

    return {
      title: article.title || title,
      content: article.content ?? html,
      links,
    }
  }

  private extractTitle(document: {
    querySelector(selector: string): { textContent: string | null } | null
  }): string | null {
    const titleEl = document.querySelector('title')
    return titleEl?.textContent?.trim() || null
  }

  private extractLinks(
    document: {
      querySelectorAll(
        selector: string
      ): Iterable<{ getAttribute(name: string): string | null; textContent: string | null }>
    },
    baseUrl: string
  ): ExtractedLink[] {
    const anchors = document.querySelectorAll('a[href]')
    const links: ExtractedLink[] = []
    const baseHostname = new URL(baseUrl).hostname

    for (const anchor of anchors) {
      const href = anchor.getAttribute('href')
      const normalizedHref = href ? href.trim().toLowerCase() : null
      if (
        !normalizedHref ||
        normalizedHref.startsWith('#') ||
        normalizedHref.startsWith('javascript:') ||
        normalizedHref.startsWith('data:') ||
        normalizedHref.startsWith('vbscript:') ||
        normalizedHref.startsWith('mailto:')
      ) {
        continue
      }

      try {
        const parsed = new URL(href!, baseUrl)
        if (parsed.hostname !== baseHostname) {
          continue
        }

        const text = (anchor.textContent ?? '').trim()
        const rel = anchor.getAttribute('rel') || null

        links.push({ url: parsed.href, text, rel })
      } catch {
        // skip malformed URLs
      }
    }

    return links
  }
}

const readabilityService = new ReadabilityService()

export default readabilityService
