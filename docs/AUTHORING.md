# Authoring poses

A pose is a YAML file. Nothing is drawn imperatively: you describe a body, and posekit
solves and renders it. This guide is written to be followed by a person or by a model.

## The coordinate system

Angles are **degrees**, measured **counter-clockwise from the +x axis**:

```
            90  (up)
             |
  180 -------+------- 0   (right, and the way a side-view figure faces)
             |
           -90  (down)
```

The figure is one unit tall (sole to crown). The ground is `y = 0`.

## The two ways to angle a bone

| Block | Meaning | Use it for |
|---|---|---|
| `joints:` | rotation **relative to the parent bone**, from anatomical neutral (standing, arms down) | small deviations from standing |
| `world:` | the bone's **absolute direction** on the page | everything else |

`world` is what you want almost always. "The front thigh points down and back at -125°"
is something you can reason about and check by eye. Chaining five relative rotations is not.

A bone listed in `world` ignores its rest angle and its parent's rotation. Its **children
still hang off it**, so pinning the thigh and then flexing the knee with `joints: {shinL: 40}`
works exactly as you would expect.

> **The single most common mistake:** you tilt the pelvis with `root.rotation` and forget
> that every unpinned limb rotates with it. Tilt the pelvis to fold forward, and the legs
> swing up into the air. **If you set `root.rotation`, pin the legs in `world`.**

## Bones you can angle

```
pelvis  spine  neck  head
clavicleL/R  upperArmL/R  forearmL/R  handL/R
hipL/R  thighL/R  shinL/R  footL/R
```

`root.rotation` aims the pelvis (90 = upright). Rotating a bone rotates everything below it.

Positive `shinL` **flexes the knee** (heel toward the buttock). Positive `forearmL` flexes
the elbow. Neither joint bends the other way, and the validator will tell you so.

## Landmarks you can point at

Used by `contact`, annotations and props:

```
hipCenter waist chest neckBase headCenter headTop
shoulderL/R elbowL/R wristL/R handTipL/R
hipJointL/R kneeL/R ankleL/R toeL/R
```

## Views

| view | what it means |
|---|---|
| `front` | the figure faces you. Left and right limbs **mirror**: `upperArmL: 90` and `upperArmR: 90` raise both arms outward. |
| `side` | profile, facing **+x** (to the right). Limbs **do not mirror** - both arms swing the same way, because you see both from the same side. The left/right offset becomes depth and nearly vanishes. |
| `back` | like `front`. |
| `three-quarter` | between the two. |

Set `flip: true` to face the other way. Set `mirror: true` to swap which limb does what
(the other side of an asymmetric asana). Sequences apply both to render "second side".

## Contact points: the thing that keeps you honest

```yaml
contact: [toeL, toeR, handTipL, handTipR]
```

This is the pose's claim about which parts of the body are on the floor. `posekit lint`
checks it against the solved figure and fails if a hand that was supposed to reach the mat
is hovering 9 cm above it. **Every pose must declare its contact points.**

## The loop

```bash
npx tsx src/cli/index.ts lint my-pose                       # anatomy + contact check
npx tsx src/cli/index.ts render my-pose -o out/p.png -w 500 -h 500 --scale 500
```

Then **look at the PNG**. Lint proves the pose is physically possible; only your eye proves
it is the right posture. Iterate until both agree.

## A complete example

```yaml
posekit: 1
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
figure:
  view: side
  grounded: true
  root:
    rotation: -48        # pelvis aims down-and-forward: the torso ramps to the hands
  world:
    thighL: -125         # legs ramp down-and-back to the feet
    thighR: -125
    shinL: -125          # straight leg: shin collinear with thigh
    shinR: -125
    footL: -20
    footR: -20
    spine: -48
    neck: -48
    head: -48            # head hangs between the arms, in line with the spine
    upperArmL: -50       # arms continue the line of the spine to the floor
    upperArmR: -50
    forearmL: -50
    forearmR: -50
    handL: -8            # palm flat
    handR: -8
props:
  - type: mat
muscles:
  engaged: [deltoid, triceps, quadriceps, serratus]
  stretched: [hamstrings, gastrocnemius, latissimus]
```

## Reference

- `posekit vocab` prints every joint, landmark, muscle, style and view name.
- `posekit schema` prints the JSON Schema for the format.
- Props: `mat`, `ground`, `block`, `strap`, `wall`, `surfboard`, `wave`.
- Annotations: `angle`, `line`, `plumb`, `arrow`, `label`, `point`.
- Muscles for `engaged`/`stretched`: run `posekit vocab`.
