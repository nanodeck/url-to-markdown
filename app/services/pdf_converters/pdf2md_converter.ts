import type { PdfConverter } from './pdf_converter.js'
// @opendocsg/pdf2md ships without proper type definitions; cast through unknown
import pdf2mdModule from '@opendocsg/pdf2md'

const pdf2md = pdf2mdModule as unknown as (buffer: Uint8Array) => Promise<string>

export class Pdf2mdConverter implements PdfConverter {
  async convert(buffer: Uint8Array): Promise<string> {
    return pdf2md(buffer)
  }
}
