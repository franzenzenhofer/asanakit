/** Browser export primitives: blob downloads and SVG -> PNG via canvas. */

export const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};

export const downloadText = (text: string, filename: string, type: string): void =>
  downloadBlob(new Blob([text], { type }), filename);

const SCALE = 3;

/** Rasterize a self-contained SVG document at 3x for crisp print/share PNGs. */
export const svgToPngBlob = async (svg: string, width: number, height: number): Promise<Blob> => {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const image = new Image();
    image.decoding = 'async';
    await new Promise<void>((resolvePromise, reject) => {
      image.onload = (): void => resolvePromise();
      image.onerror = (): void => reject(new Error('SVG did not rasterize; is it self-contained?'));
      image.src = url;
    });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(width * SCALE);
    canvas.height = Math.round(height * SCALE);
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('no 2d canvas context');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolvePromise, reject) => {
      canvas.toBlob((blob) => (blob === null ? reject(new Error('PNG encode failed')) : resolvePromise(blob)), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(url);
  }
};

/** Print vector pages: a hidden iframe hosting the printable HTML. */
export const printHtml = (html: string): void => {
  const frame = document.createElement('iframe');
  frame.style.position = 'fixed';
  frame.style.right = '100%';
  frame.style.bottom = '100%';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  if (doc === null) throw new Error('print frame has no document');
  doc.open();
  doc.write(html);
  doc.close();
  frame.onload = (): void => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60_000);
  };
};
