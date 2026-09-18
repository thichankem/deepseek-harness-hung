/** Ambient types for the browser-only qrcode entry, which ships no own types. */
declare module 'qrcode/lib/browser.js' {
  export function toDataURL(
    text: string,
    options?: {
      margin?: number
      width?: number
      errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H'
    },
  ): Promise<string>
}