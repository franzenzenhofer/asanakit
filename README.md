# asanakit

**Programmatic stick-figure and anatomical infographics for yoga and surf postures.**

Describe a posture as data. Get a correct, deterministic, machine-readable illustration.

```bash
npx asanakit render adho-mukha-svanasana -o downdog.svg --style anatomy --title
npx asanakit sheet --sequence ashtanga-primary -o primary-series.png --columns 6 --numbered
```

asanakit is CLI-first, has no browser and no DOM, and renders the same bytes on every
machine. It ships with the **full Ashtanga Primary Series** - 37 asanas, 60 steps - authored
in its own pose format, plus 8 surf postures.

![The Ashtanga Primary Series rendered by asanakit](examples/ashtanga-primary-series.png)

---

## Why it exists

Every other option is a dead end. Traced SVG artwork is unposeable. Pose-estimation
datasets give you keypoints scraped from photos, with no joint angles, no licence you can
use, and no way to say "now bend that knee ten degrees more". 3D mannequin libraries are
GPL, or need a GPU, or both.

asanakit takes the third path: a **20-bone kinematic rig** plus a **declarative pose format**.
The posture is the data. The picture is a pure function of it.

## What you get

- **A pose format** (`.pose.yaml`) with a published JSON Schema. Joint angles, absolute bone
  directions, props, annotations, muscle activation, teaching cues.
- **Forward kinematics** over a 20-bone humanoid rig with anatomical proportions.
- **An anatomical validator.** Knees and elbows that bend backwards are rejected. A pose
  declares which parts of the body touch the floor, and asanakit checks that they do.
- **Seven styles**, all pure token data: `stick`, `anatomy`, `silhouette`, `blueprint`,
  `ink`, `poster`, `minimal`.
- **SVG and PNG.** Deterministic, HTML-safe, and every element carries `data-bone`,
  `data-muscle`, `data-annotation` hooks so the output stays machine-readable.
- **Keypoint export** to MediaPipe-33 and COCO-17 for interop with pose-estimation tooling.
- **Contact sheets and sequences** - render a whole practice in one command.

## The same posture, seven ways

![Every style](examples/styles.png)

## Anatomy, not decoration

Muscles are displaced in two anatomical planes - lateral (left/right) and sagittal
(front/back) - so the chest is never drawn behind the back. Engaged muscles shade one way,
stretched muscles the other.

![Downward dog with muscle activation](examples/anatomy.png)

## Surf

![Surf postures](examples/surf.png)

## Install

```bash
npm install asanakit                       # once published to npm
npx github:franzenzenhofer/asanakit --help # straight from source, today
```

## The format

```yaml
asanakit: 1
id: utthita-trikonasana
name: Extended Triangle
sanskrit: Utthita Trikoṇāsana
discipline: yoga
family: standing
breath: inhale
drishti: hastagrai
cues:
  - Lengthen both sides of the waist
  - Stack the top shoulder over the bottom one
contact: [toeL, toeR, handTipR]
figure:
  view: front
  world:               # absolute bone directions, in degrees
    thighL: -55        # 0 = right, 90 = up, -90 = down
    thighR: -125
    spine: 35
    upperArmL: 35
    upperArmR: -145
props:
  - type: mat
annotations:
  - type: angle
    at: kneeL
    from: hipJointL
    to: ankleL
muscles:
  engaged: [obliques, quadriceps]
  stretched: [hamstrings, adductors]
```

Full guide: **[docs/AUTHORING.md](docs/AUTHORING.md)**.

## CLI

| Command | What it does |
|---|---|
| `asanakit render <pose> -o out.svg` | render one pose (`.svg` or `.png`) |
| `asanakit sheet --all -o sheet.png` | contact sheet of many poses |
| `asanakit sequence <id> -o dir/` | every pose of a sequence, in practice order |
| `asanakit lint [poses...]` | check poses against the limits of a real body |
| `asanakit list` | what is in the library |
| `asanakit vocab` | every joint, landmark, muscle and style name |
| `asanakit schema` | the JSON Schema for the pose format |
| `asanakit keypoints <pose>` | export as MediaPipe-33 / COCO-17 keypoints |
| `asanakit landmarks <pose>` | the solved skeleton, as JSON |

Options: `--style`, `--width`, `--height`, `--title`, `--caption`, `--muscles`,
`--background`, `--optimize`, `--scale`, `--lib <dir>`.

## Library API

```ts
import { parsePose, renderSvg, renderPng, validatePose, solveSkeleton } from 'asanakit';

const pose = parsePose(yamlSource, 'triangle.pose.yaml');

const issues = validatePose(pose);          // [] means anatomically sound
const svg = renderSvg(pose, { style: 'anatomy', title: true });
const png = renderPng(svg, { width: 1200 });
```

## Built for machines as well as people

- Errors name the field and the file, and report every problem at once.
- `asanakit schema` and `asanakit vocab` are the full contract - a model can discover the
  entire vocabulary without reading the source.
- `asanakit lint` turns "does this look right" into a check that either passes or fails.
- Rendering is deterministic, so output diffs are meaningful in review.

## Licence

MIT.

Dependencies are all permissive: `gl-matrix` (MIT), `d3-shape`/`d3-path` (ISC),
`xmlbuilder2` (MIT), `commander` (MIT), `zod` (MIT), `yaml` (ISC), `svgo` (MIT),
`@resvg/resvg-js` (MPL-2.0, used unmodified as a dependency).

The MediaPipe-33 and COCO-17 keypoint layouts restate the public layouts published by the
Apache-2.0 licensed MediaPipe and tfjs-models projects.
