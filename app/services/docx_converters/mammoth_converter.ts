import mammoth from 'mammoth'
import type { DocxConverter } from './docx_converter.js'

export class MammothConverter implements DocxConverter {
  async convert(buffer: Uint8Array): Promise<string> {
    const result = await mammoth.convertToHtml({ buffer: Buffer.from(buffer) })
    return result.value
  }
}
