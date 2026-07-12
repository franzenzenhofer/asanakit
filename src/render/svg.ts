export type AttrValue = string | number | undefined;

export interface SvgNode {
  readonly name: string;
  readonly attrs: Readonly<Record<string, AttrValue>>;
  readonly children: readonly SvgNode[];
  readonly text?: string;
}

const DECIMALS = 3;

/** Round coordinates so the same pose always serialises to the same bytes. */
export const num = (value: number): number => {
  const rounded = Number(value.toFixed(DECIMALS));
  return Object.is(rounded, -0) ? 0 : rounded;
};

export const el = (name: string, attrs: Record<string, AttrValue> = {}, children: readonly SvgNode[] = []): SvgNode => ({
  name,
  attrs,
  children,
});

export const textEl = (name: string, attrs: Record<string, AttrValue>, text: string): SvgNode => ({
  name,
  attrs,
  children: [],
  text,
});

export const group = (attrs: Record<string, AttrValue>, children: readonly SvgNode[]): SvgNode =>
  el('g', attrs, children.filter(Boolean));

const escapeText = (value: string): string =>
  value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

const escapeAttr = (value: string): string => escapeText(value).replaceAll('"', '&quot;');

const attrString = (attrs: Readonly<Record<string, AttrValue>>): string =>
  Object.entries(attrs)
    .filter((entry): entry is [string, string | number] => entry[1] !== undefined)
    .map(([k, v]) => ` ${k}="${escapeAttr(typeof v === 'number' ? String(num(v)) : v)}"`)
    .join('');

const build = (node: SvgNode, depth: number, out: string[]): void => {
  const pad = '  '.repeat(depth);
  const open = `${pad}<${node.name}${attrString(node.attrs)}`;
  if (node.text !== undefined) {
    out.push(`${open}>${escapeText(node.text)}</${node.name}>`);
  } else if (node.children.length === 0) {
    out.push(`${open}/>`);
  } else {
    out.push(`${open}>`);
    for (const child of node.children) build(child, depth + 1, out);
    out.push(`${pad}</${node.name}>`);
  }
};

/**
 * Serialise to a standalone SVG document. Text and attributes are
 * entity-escaped, so the output is safe to inline into HTML - a pose name can
 * never break out of a <text> element. Pure string building: byte-deterministic
 * and browser-safe.
 */
export const serialize = (root: SvgNode): string => {
  const out: string[] = [];
  build(root, 0, out);
  return `${out.join('\n')}\n`;
};
