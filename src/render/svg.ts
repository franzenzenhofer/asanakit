import { create } from 'xmlbuilder2';

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

const build = (node: SvgNode, parent: ReturnType<typeof create> | ReturnType<typeof create>['ele']): void => {
  const attrs = Object.fromEntries(
    Object.entries(node.attrs)
      .filter(([, v]) => v !== undefined)
      .map(([k, v]) => [k, typeof v === 'number' ? String(num(v)) : String(v)]),
  );
  const child = (parent as ReturnType<typeof create>).ele(node.name, attrs);
  if (node.text !== undefined) child.txt(node.text);
  for (const c of node.children) build(c, child as never);
};

/**
 * Serialise to a standalone SVG document. xmlbuilder2 entity-escapes text and
 * attributes, so the output is safe to inline into HTML - a pose name can never
 * break out of a <text> element.
 */
export const serialize = (root: SvgNode): string => {
  const doc = create();
  build(root, doc);
  return doc.end({ prettyPrint: true, headless: true, indent: '  ' });
};
