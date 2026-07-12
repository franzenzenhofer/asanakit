/** URL-fragment sharing: deflate-raw + base64url. No server, no tracking. */

const B64_URL_UNSAFE = { '+': '-', '/': '_' } as const;
const B64_URL_SAFE = { '-': '+', _: '/' } as const;

/** A link longer than this stops being pasteable; fall back to a file. */
export const SHARE_URL_BUDGET = 7500;

const pipe = async (bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> => {
  const readable = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(readable).arrayBuffer());
};

export const encodeShare = async (text: string): Promise<string> => {
  const deflated = await pipe(new TextEncoder().encode(text), new CompressionStream('deflate-raw'));
  let binary = '';
  for (const byte of deflated) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/[+/]/g, (c) => B64_URL_UNSAFE[c as keyof typeof B64_URL_UNSAFE]).replace(/=+$/, '');
};

export const decodeShare = async (data: string): Promise<string> => {
  const binary = atob(data.replace(/[-_]/g, (c) => B64_URL_SAFE[c as keyof typeof B64_URL_SAFE]));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const inflated = await pipe(bytes, new DecompressionStream('deflate-raw'));
  return new TextDecoder().decode(inflated);
};
