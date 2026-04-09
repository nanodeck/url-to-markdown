export interface PdfConverter {
  convert(buffer: Uint8Array): Promise<string>
}
