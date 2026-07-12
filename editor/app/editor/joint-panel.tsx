import type { JSX } from 'preact';
import type { BoneId } from '@asanakit/core/types.js';
import { commitGesture, dispatch, linkSides, pose, selectedBone } from '../state/doc.js';
import { readJoint, solvedWorldDirection } from '../state/joints.js';
import { SliderRow } from '../ui/slider-row.js';
import { LinkIcon } from '../ui/icons.js';

const GROUPS: readonly { name: string; bones: readonly BoneId[] }[] = [
  { name: 'Torso', bones: ['pelvis', 'spine', 'neck', 'head'] },
  { name: 'Arm L', bones: ['clavicleL', 'upperArmL', 'forearmL', 'handL'] },
  { name: 'Arm R', bones: ['clavicleR', 'upperArmR', 'forearmR', 'handR'] },
  { name: 'Leg L', bones: ['hipL', 'thighL', 'shinL', 'footL'] },
  { name: 'Leg R', bones: ['hipR', 'thighR', 'shinR', 'footR'] },
];

const label = (bone: BoneId): string => bone.replace(/([A-Z])$/, ' $1').replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase();

const JOINT_CHANNELS = [
  { channel: 'flex', label: 'Flex', min: -180, max: 180 },
  { channel: 'abduct', label: 'Abduct', min: -180, max: 180 },
  { channel: 'twist', label: 'Twist', min: -180, max: 180 },
] as const;

const WORLD_CHANNELS = [
  { channel: 'azimuth', label: 'Azimuth', min: -180, max: 180 },
  { channel: 'elevation', label: 'Elevation', min: -90, max: 90 },
  { channel: 'twist', label: 'Twist', min: -180, max: 180 },
] as const;

export const JointPanel = (): JSX.Element => {
  const bone = selectedBone.value;
  const doc = pose.value;

  const picker = (
    <div class="field">
      <label>Bone - or tap the figure</label>
      {GROUPS.map((group) => (
        <div class="chips" key={group.name}>
          {group.bones.map((b) => (
            <button key={b} class={`chip ${bone === b ? 'active' : ''}`} onClick={() => (selectedBone.value = b)}>
              {label(b)}
            </button>
          ))}
        </div>
      ))}
    </div>
  );

  if (bone === null) return <div>{picker}</div>;

  const world = doc.figure?.world?.[bone];
  const mode = world === undefined ? 'joint' : 'world';
  const joint = readJoint(doc.figure?.joints?.[bone]);
  const direction = world ?? solvedWorldDirection(doc, bone);

  return (
    <div>
      {picker}
      <div class="field-row" style="align-items:center; margin-bottom: 10px;">
        <div class="segmented" role="tablist" aria-label="Control mode">
          <button class={mode === 'joint' ? 'active' : ''} onClick={() => dispatch({ type: 'set-bone-mode', bone, mode: 'joint' })}>
            Joint
          </button>
          <button class={mode === 'world' ? 'active' : ''} onClick={() => dispatch({ type: 'set-bone-mode', bone, mode: 'world' })}>
            World
          </button>
        </div>
        <button
          class={`chip ${linkSides.value ? 'active' : ''}`}
          style="display:inline-flex;align-items:center;gap:5px;"
          onClick={() => (linkSides.value = !linkSides.value)}
          aria-pressed={linkSides.value}
        >
          <span style="width:14px;height:14px;display:inline-flex;"><LinkIcon /></span> both sides
        </button>
        <button class="btn subtle" onClick={() => dispatch({ type: 'reset-bone', bone })}>
          Reset
        </button>
      </div>

      {mode === 'joint'
        ? JOINT_CHANNELS.map((c) => (
            <SliderRow
              key={c.channel}
              label={c.label}
              value={joint[c.channel]}
              min={c.min}
              max={c.max}
              onChange={(value, transient) => dispatch({ type: 'set-joint', bone, channel: c.channel, value }, { transient })}
              onCommit={commitGesture}
            />
          ))
        : WORLD_CHANNELS.map((c) => (
            <SliderRow
              key={c.channel}
              label={c.label}
              value={c.channel === 'twist' ? (world?.twist ?? 0) : (direction[c.channel] ?? 0)}
              min={c.min}
              max={c.max}
              onChange={(value, transient) => dispatch({ type: 'set-world', bone, channel: c.channel, value }, { transient })}
              onCommit={commitGesture}
            />
          ))}
    </div>
  );
};
