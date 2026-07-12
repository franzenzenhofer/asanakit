import { Resvg } from '@resvg/resvg-js';
import { optimize } from 'svgo';

export interface PngOptions {
  /** Output width in pixels; height follows the SVG aspect ratio. */
  readonly width?: number;
  /** Uniform scale factor, used when no width is given. */
  readonly scale?: number;
  readonly background?: string;
}

/**
 * Rasterise with resvg: a pure-Rust SVG renderer with no system libraries and
 * no browser, so a PNG built on a laptop is byte-identical to one built in CI.
 */
export const renderPng = (svg: string, options: PngOptions = {}): Buffer => {
  const fitTo =
    options.width === undefined
      ? ({ mode: 'zoom', value: options.scale ?? 1 } as const)
      : ({ mode: 'width', value: options.width } as const);

  const resvg = new Resvg(svg, {
    fitTo,
    ...(options.background === undefined ? {} : { background: options.background }),
    font: { loadSystemFonts: true },
  });

  return Buffer.from(resvg.render().asPng());
};

/**
 * Shrink the SVG without losing the `data-*` hooks: those attributes are the
 * contract that lets another program (or a model) find a bone, a muscle or an
 * annotation in the output.
 */
export const optimizeSvg = (svg: string): string =>
  optimize(svg, {
    multipass: true,
    js2svg: { indent: 0, pretty: false },
    plugins: [
      {
        name: 'preset-default',
        params: {
          overrides: {
            removeViewBox: false,
            cleanupIds: false,
            removeUnknownsAndDefaults: { keepDataAttrs: true },
          },
        },
      },
    ],
  }).data;
