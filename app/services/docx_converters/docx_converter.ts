export interface DocxConverter {
  convert(buffer: Uint8Array): Promise<string>
}
