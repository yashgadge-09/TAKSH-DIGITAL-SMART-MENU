declare module 'heic-convert' {
  type InputBuffer = Buffer | ArrayBuffer;

  interface ConvertOptions {
    buffer: InputBuffer;
    format: 'JPEG' | 'PNG';
    quality?: number;
  }

  export default function heicConvert(options: ConvertOptions): Promise<Buffer>;
}
