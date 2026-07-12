# Working on posekit

## The one rule

Poses are data, not code. If a posture looks wrong, fix the `.pose.yaml`, not the renderer.
If the renderer is wrong, there is a test missing.

## Quality gates

```bash
npm run verify     # typecheck + lint + test + build. All must pass.
npx tsx src/cli/index.ts lint    # every bundled pose must be anatomically sound
```

## How the code is arranged

| Path | Responsibility |
|---|---|
| `src/core` | vectors, angles, the 20-bone rig, the forward-kinematics solver. Pure. |
| `src/model` | the pose/sequence schema (zod), parsing, mirroring |
| `src/anatomy` | muscle definitions, and the validator that rejects impossible bodies |
| `src/render` | SVG layers (figure, muscles, props, annotations), styles, rasterising |
| `src/standards` | MediaPipe-33 / COCO-17 keypoint export |
| `src/library` | loading bundled poses and sequences |
| `src/cli` | commander wiring only - no logic |
| `poses/` | the pose data itself |

## Conventions

- Maths coordinates everywhere: x right, y up, degrees CCW from +x. The single y-flip into
  SVG space happens in `render/project.ts` and nowhere else.
- Draw functions take one `RenderContext`, not four arguments.
- Styles are data. A new look is a new token set in `render/styles.ts`, never a code branch.
- TDD: write the failing test first. Every bug fix starts with a test that reproduces it.

## Authoring poses

Read `docs/AUTHORING.md`. The loop is: write the YAML, run `posekit lint` until it is clean,
render a PNG, and **look at it**. Lint proves the posture is physically possible; only your
eye proves it is the right posture.
