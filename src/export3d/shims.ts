/**
 * three's GLTFExporter was written for browsers: on the binary path it reads
 * Blobs back through FileReader, which Node does not have. Blob itself is
 * native in Node >= 18, so this one small shim is the entire gap.
 */
export const installFileReaderShim = (): void => {
  if ('FileReader' in globalThis) return;

  class NodeFileReader {
    onloadend: (() => void) | null = null;
    result: ArrayBuffer | string | null = null;

    readAsArrayBuffer(blob: Blob): void {
      void blob.arrayBuffer().then((buffer) => {
        this.result = buffer;
        this.onloadend?.();
      });
    }

    readAsDataURL(blob: Blob): void {
      void blob.arrayBuffer().then((buffer) => {
        this.result = `data:${blob.type || 'application/octet-stream'};base64,${Buffer.from(buffer).toString('base64')}`;
        this.onloadend?.();
      });
    }
  }

  (globalThis as Record<string, unknown>).FileReader = NodeFileReader;
};
