# asanakit

## Golden goal

**asanakit is the best asana & surf posture visualization library for stick figures and body postures.**
Declarative pose data in; perfect deterministic 2D printouts and fully explorable 3D out; correct
physics when necessary; driveable end-to-end by AI and by CLI.

Everything in this repository serves that goal. If a change does not make the poses truer, the
pictures better, or the machine-driveability stronger, it does not belong here.

## The one rule

Poses are data, not code. If a posture looks wrong, fix the `.pose.yaml`, not the renderer.
If the renderer is wrong, there is a test missing.

## Doctrine: one 3D core, no legacy paths

- The **3D skeleton is the single source of truth**. Every pose solves to a real 3D skeleton
  (quaternion forward kinematics over the 21-bone rig).
- **2D output is always a camera projection of the 3D solve** — front, back, side, or any
  azimuth/elevation. Never add view-specific hacks (foreshortening factors, per-view sign flips,
  fake depth) to make a single angle look right; fix the rig, the pose, or the projection.
- **No backward compatibility, no frozen legacy paths.** This library is pre-1.0. When the format
  or the rig can be made better, make it better and migrate the bundled poses. Old formats are
  rejected fail-fast with a clear error.
- **Physics is never hand-rolled.** Realistic positioning (gravity settling, ground contact) goes
  through Rapier (`@dimforge/rapier3d-compat`), opt-in, applied after the kinematic solve and
  never mutating authored pose data.

## Quality gates

```bash
npm run verify                   # typecheck + lint + test + build (incl. viewer bundle). All must pass.
npx tsx src/cli/index.ts lint    # every bundled pose must be anatomically sound
```

## How the code is arranged

| Path | Responsibility |
|---|---|
| `src/core` | vec3/quat math, the 21-bone 3D rig, joint rotations (flex/abduct/twist), the quaternion FK solver. Pure. |
| `src/model` | the pose/sequence schema v2 (zod), parsing, mirroring |
| `src/anatomy` | muscle definitions, and the validator that rejects impossible bodies |
| `src/render` | camera + orthographic projection, depth-sorted SVG layers (figure, muscles, props, annotations), styles, rasterising |
| `src/three` | Skeleton → three.js scene graph (shared by GLB export and the viewer) |
| `src/export3d` | GLB/glTF export via three's GLTFExporter (Node shims live here) |
| `src/viewer` | self-contained offline HTML: fullscreen viewer and showcase pages (three + OrbitControls, pose picker, inline SVG gallery) |
| `src/physics` | Rapier settling. Lazy-loaded: importing asanakit never touches WASM. |
| `src/standards` | MediaPipe-33 / COCO-17 keypoint export (with real z) |
| `src/library` | loading bundled poses and sequences |
| `src/cli` | commander wiring only - no logic |
| `poses/` | the pose data itself |
| `viewer-src/` | browser entry for the viewer bundle (esbuild → dist/viewer) |

## Conventions

- Maths coordinates everywhere: **y up**, x right, z toward the front-view camera; degrees in
  YAML, quaternions only inside `src/core`. The single y-flip into SVG space happens in
  `render/project.ts` and nowhere else.
- Determinism boundaries: solved skeletons, SVG, PNG, and GLB are byte-deterministic per
  (pose, camera, style). Physics-settled output is deterministic per machine (fixed timestep,
  two-run identity tested) but never byte-golden across machines.
- Draw functions take one `RenderContext`, not four arguments.
- Styles are data. A new look is a new token set in `render/styles.ts`, never a code branch.
- TDD: write the failing test first. Every bug fix starts with a test that reproduces it. No mocks.
- Files stay small (target ≤200 lines, hard max ~450); named exports; barrels per module;
  ESM with `.js` import specifiers.
- Light backgrounds only. The viewer and all default styles are white/light - never dark themes.
- `three` is pinned exactly (0.x churn); addons imported via `three/addons/...`.

## Authoring poses

Read `docs/AUTHORING.md`. The loop is: write the YAML, run `asanakit lint` until it is clean,
render a PNG (and orbit it in `asanakit view`), and **look at it**. Lint proves the posture is
physically possible; only your eye proves it is the right posture.
