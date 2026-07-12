# Authoring poses

A pose is a YAML file. Nothing is drawn imperatively: you describe a body in 3D, and
asanakit solves and renders it - as an SVG/PNG from any camera, as an interactive 3D
viewer, or as a GLB model. This guide is written to be followed by a person or by a model.

## The coordinate system

The figure stands at the origin in anatomical neutral, **facing +z**, with **+x its own
left** and **+y up**. It is one unit tall (sole to crown). The ground is the plane `y = 0`.

All rotations are **degrees**.

## The two ways to angle a bone

| Block | Meaning | Use it for |
|---|---|---|
| `joints:` | rotation **relative to the parent bone**, about the joint's own anatomical axes | small deviations from standing; twists |
| `world:` | the bone's **absolute direction** in space | everything else |

### `world`: absolute directions

```yaml
world:
  thighL: { azimuth: 0, elevation: -55 }     # down and forward
  spine:  { azimuth: 0, elevation: 40 }      # leaning forward, 40° above horizontal
  upperArmR: { azimuth: -90, elevation: 0 }  # straight out to the figure's right
```

- `azimuth` - which way the bone points on the compass of the body: `0` = the figure's
  facing direction (+z), `90` = the figure's **left**, `-90` its right, `180` backward.
- `elevation` - how far it rises: `90` = straight up, `0` = horizontal, `-90` = straight down.
- `twist` (optional) - rotation about the aimed bone.

"The front thigh points forward and 55° down" is something you can reason about and check
by eye. Chaining five relative rotations is not. **`world` is what you want almost always.**

A bone listed in `world` ignores its parent's rotation. Its **children still hang off
it**, so pinning the thigh and then flexing the knee with `joints: {shinL: 40}` works
exactly as you would expect.

> **The single most common mistake:** you tip the figure with `root.pitch` and forget
> that every unpinned limb rotates with it. Tip the root to fold forward, and the legs
> swing up into the air. **If you set root angles, pin the legs in `world`.**

### `joints`: anatomical rotations

A bare number is pure **flexion** - the joint bending the way anatomy names it:

```yaml
joints:
  forearmL: 90          # elbow bends 90° (forward - the only way an elbow goes)
  shinR: 60             # knee bends 60° (backward - the only way a knee goes)
```

The object form adds the other two anatomical axes:

```yaml
joints:
  upperArmL: { abduct: 90 }              # arm straight out to the side
  thighR:    { flex: 45, abduct: 30, twist: 20 }
```

- `flex` - forward bend for hips/arms/spine, backward for knees, toes-up for ankles.
- `abduct` - away from the midline, on either side. Center bones lean toward the figure's left.
- `twist` - about the bone: positive is **external rotation** (toes/palms turn outward);
  for center bones, turning toward the figure's left.

The signs are per-side anatomical, so a mirrored pose is literally the same numbers with
L and R swapped - which is what `mirror: true` does.

### The root

```yaml
root:
  yaw: 90       # turn the whole figure toward its left
  pitch: 40     # tip it forward (90 = horizontal, face down)
  roll: -65     # cartwheel it sideways (negative drops the LEFT side)
  position: [0, 0, 0]
  scale: 1
```

## Bones you can angle

```
pelvis  spine  neck  head
clavicleL/R  upperArmL/R  forearmL/R  handL/R
hipL/R  thighL/R  shinL/R  footL/R
```

Rotating a bone rotates everything below it. Feet rest pointing forward, dropped 20°
toward the floor; a **flat standing foot wants `world: { azimuth: …, elevation: 0 }`**
or a matching dorsiflexion.

## Landmarks you can point at

Used by `contact`, annotations and props:

```
hipCenter waist chest neckBase headCenter headTop
shoulderL/R elbowL/R wristL/R handTipL/R
hipJointL/R kneeL/R ankleL/R toeL/R
```

## The camera

The pose is 3D; a picture of it needs a viewpoint:

```yaml
camera: side                              # or front | back | left | right | three-quarter | top
camera: { azimuth: 30, elevation: 15 }    # or any orbit angle
```

This is only the pose's **default**. `--camera` on the CLI overrides it, and every camera
shows the same body: `asanakit render pose --camera back` needs nothing re-authored.
Camera azimuth 0 looks at the figure's front; positive azimuth walks toward the figure's
left; `side` is the classic profile with the figure facing picture-right.

`mirror: true` swaps which limb does what (the other side of an asymmetric asana).
Sequences use it to render the "second side".

## Physics, when necessary

```yaml
physics: settle
```

drops the solved figure onto the ground plane with a real physics engine (Rapier) and
lets it rest on its true support instead of the naive lowest-point shift. Opt-in per pose,
or ad hoc with `--settle`. The authored pose is preserved exactly; only the figure's
position and orientation change.

## Contact points: the thing that keeps you honest

```yaml
contact: [toeL, toeR, handTipL, handTipR]
```

This is the pose's claim about which parts of the body are on the floor. `asanakit lint`
checks it against the solved figure and fails if a hand that was supposed to reach the mat
is hovering 9 cm above it. **Every pose must declare its contact points.**

## The loop

```bash
asanakit lint my-pose                                    # anatomy + contact check
asanakit render my-pose -o out/p.png -w 500 -h 500
asanakit view my-pose --open                             # orbit it in 3D
```

Then **look at it - from more than one angle**. Lint proves the pose is physically
possible; only your eye proves it is the right posture. Iterate until both agree.

## A complete example

```yaml
asanakit: 2
id: adho-mukha-svanasana
name: Downward-Facing Dog
sanskrit: Adho Mukha Śvānāsana
discipline: yoga
family: inversion
difficulty: 2
description: An inverted V. Hips lift back and up, heels press down.
tags: [ashtanga, surya-namaskara-a, inversion]
breath: exhale
drishti: nabi-chakra
cues:
  - Lift the sit bones, lengthen the spine
contact: [toeL, toeR, handTipL, handTipR]
camera: side
figure:
  grounded: true
  root:
    pitch: 138                                   # pelvis aims down-and-forward: the torso ramps to the hands
  world:
    thighL: { azimuth: 180, elevation: -55 }     # legs ramp down-and-back to the feet
    thighR: { azimuth: 180, elevation: -55 }
    shinL: { azimuth: 180, elevation: -55 }      # straight leg: shin collinear with thigh
    shinR: { azimuth: 180, elevation: -55 }
    footL: { azimuth: 0, elevation: -20 }
    footR: { azimuth: 0, elevation: -20 }
    spine: { azimuth: 0, elevation: -48 }
    neck: { azimuth: 0, elevation: -48 }
    head: { azimuth: 0, elevation: -48 }         # head hangs between the arms, in line with the spine
    upperArmL: { azimuth: 0, elevation: -50 }    # arms continue the line of the spine to the floor
    upperArmR: { azimuth: 0, elevation: -50 }
    forearmL: { azimuth: 0, elevation: -50 }
    forearmR: { azimuth: 0, elevation: -50 }
    handL: { azimuth: 0, elevation: -8 }         # palm flat
    handR: { azimuth: 0, elevation: -8 }
props:
  - type: mat
muscles:
  engaged: [deltoid, triceps, quadriceps, serratus]
  stretched: [hamstrings, gastrocnemius, latissimus]
```

## Reference

- `asanakit vocab` prints every joint, landmark, muscle, style and camera name.
- `asanakit schema` prints the JSON Schema for the format.
- Props: `mat`, `ground`, `block`, `strap`, `wall`, `surfboard`, `wave`.
- Annotations: `angle`, `line`, `plumb`, `arrow`, `label`, `point`.
- Muscles for `engaged`/`stretched`: run `asanakit vocab`.
