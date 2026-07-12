import { writeFileSync, mkdirSync } from 'node:fs';
import { parsePose, type PoseSpec } from '../src/model/index.js';
import { renderPng, renderSvg } from '../src/render/index.js';
import type { StyleId } from '../src/render/styles.js';

const OUT = 'out/preview';
mkdirSync(OUT, { recursive: true });

const p = (yaml: string): PoseSpec => parsePose(`posekit: 1\n${yaml}`, 'preview.yaml');

const poses: Array<{ pose: PoseSpec; style: StyleId }> = [
  { pose: p('id: rest\nname: Neutral\ndiscipline: yoga\nfigure:\n  view: front\n'), style: 'stick' },
  {
    pose: p(
      [
        'id: warrior2',
        'name: Warrior II',
        'discipline: yoga',
        'figure:',
        '  view: front',
        '  joints:',
        '    thighL: 45',
        '    shinL: -45',
        '    thighR: 45',
        '    upperArmL: 90',
        '    upperArmR: 90',
        '    footL: 0',
        'props:',
        '  - type: mat',
      ].join('\n'),
    ),
    style: 'stick',
  },
  {
    pose: p(
      [
        'id: downdog',
        'name: Downward Dog',
        'discipline: yoga',
        'figure:',
        '  view: side',
        '  root:',
        '    rotation: 35',
        '  joints:',
        '    thighL: -55',
        '    thighR: -55',
        '    upperArmL: -60',
        '    upperArmR: -60',
        '    neck: 30',
        'props:',
        '  - type: mat',
      ].join('\n'),
    ),
    style: 'stick',
  },
  {
    pose: p(
      [
        'id: anat',
        'name: Anatomy',
        'discipline: yoga',
        'figure:',
        '  view: front',
        '  joints:',
        '    upperArmL: 100',
        '    upperArmR: 100',
        'muscles:',
        '  engaged: [quadriceps, deltoid]',
        '  stretched: [pectoralis]',
      ].join('\n'),
    ),
    style: 'anatomy',
  },
  {
    pose: p(
      [
        'id: popup',
        'name: Surf pop-up',
        'discipline: surf',
        'figure:',
        '  view: side',
        '  joints:',
        '    thighL: 55',
        '    shinL: -75',
        '    thighR: -35',
        '    shinR: 55',
        '    spine: -15',
        '    upperArmL: 70',
        '    upperArmR: -60',
        'props:',
        '  - type: surfboard',
        '    under: [ankleL, ankleR]',
        '    rotation: -8',
      ].join('\n'),
    ),
    style: 'silhouette',
  },
  { pose: p('id: bp\nname: Blueprint\ndiscipline: yoga\nfigure:\n  view: side\n'), style: 'blueprint' },
];

for (const { pose, style } of poses) {
  const svg = renderSvg(pose, { width: 420, height: 560, style, title: true });
  writeFileSync(`${OUT}/${pose.id}-${style}.svg`, svg);
  writeFileSync(`${OUT}/${pose.id}-${style}.png`, renderPng(svg, { width: 420 }));
  console.log(`${OUT}/${pose.id}-${style}.png`);
}
