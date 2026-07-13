import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { channelsOf, isHinge, ROM, termFor, type Channel, type Range } from '@asanakit/anatomy/rom.js';
import type { BoneId } from '@asanakit/core/types.js';
import { commitGesture, dispatch, linkSides, pose, selectedBone } from '../state/doc.js';
import { counterpart, readJoint, solvedWorldDirection } from '../state/joints.js';
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

const WORLD_CHANNELS = [
  { channel: 'azimuth', label: 'Azimuth', min: -180, max: 180 },
  { channel: 'elevation', label: 'Elevation', min: -90, max: 90 },
  { channel: 'twist', label: 'Twist', min: -180, max: 180 },
] as const;

/**
 * The control says what the movement is called, and which way it is going: a
 * knee reads "Flexion", a shoulder turned inward reads "Internal rotation".
 * Both the words and the range come from `src/anatomy/rom.ts`, the same table
 * lint checks against - so a slider cannot reach a body lint would reject, and
 * an elbow is never offered an abduction control it does not have.
 */
const channelLabel = (bone: BoneId, channel: Channel, value: number): string => {
  const range = ROM[bone][channel];
  if (range === undefined) return channel;
  // At rest the control names both directions; once it moves, it names the one it is doing.
  return value === 0 ? `${range.positive} / ${range.negative}` : (termFor(bone, channel, value) ?? channel);
};

const BonePicker = ({ onPick }: { onPick: (bone: BoneId) => void }): JSX.Element => (
  <div class="field">
    {GROUPS.map((group) => (
      <div class="chips" key={group.name}>
        {group.bones.map((b) => (
          <button key={b} class={`chip ${selectedBone.value === b ? 'active' : ''}`} onClick={() => onPick(b)}>
            {label(b)}
          </button>
        ))}
      </div>
    ))}
  </div>
);

const ChannelSliders = ({ bone }: { bone: BoneId }): JSX.Element => {
  const doc = pose.value;
  const world = doc.figure?.world?.[bone];
  const joint = readJoint(doc.figure?.joints?.[bone]);
  const direction = world ?? solvedWorldDirection(doc, bone);

  if (world === undefined) {
    return (
      <div>
        {channelsOf(bone).map((channel) => {
          const range = ROM[bone][channel] as Range;
          return (
            <SliderRow
              key={channel}
              label={channelLabel(bone, channel, joint[channel])}
              value={joint[channel]}
              min={range.min}
              max={range.max}
              onChange={(value, transient) => dispatch({ type: 'set-joint', bone, channel, value }, { transient })}
              onCommit={commitGesture}
            />
          );
        })}
        {isHinge(bone) && (
          <p class="panel-hint">This joint is a hinge: it flexes, and that is all it does.</p>
        )}
      </div>
    );
  }

  return (
    <div>
      {WORLD_CHANNELS.map((c) => (
        <SliderRow
          key={c.channel}
          label={c.label}
          value={c.channel === 'twist' ? (world.twist ?? 0) : (direction[c.channel] ?? 0)}
          min={c.min}
          max={c.max}
          onChange={(value, transient) => dispatch({ type: 'set-world', bone, channel: c.channel, value }, { transient })}
          onCommit={commitGesture}
        />
      ))}
    </div>
  );
};

/**
 * Mobile-first ordering: with a bone selected, the sliders are the FIRST thing
 * in the panel - the full picker hides behind "change bone", so tapping the
 * figure lands you directly on the controls.
 */
export const JointPanel = (): JSX.Element => {
  const [picking, setPicking] = useState(false);
  const bone = selectedBone.value;
  const doc = pose.value;

  if (bone === null) {
    return (
      <div>
        <p class="panel-hint">Tap a limb on the figure to pose it - or pick a bone:</p>
        <BonePicker onPick={(b) => (selectedBone.value = b)} />
      </div>
    );
  }

  const mode = doc.figure?.world?.[bone] === undefined ? 'joint' : 'world';
  const hasCounterpart = counterpart(bone) !== null;

  return (
    <div>
      <div class="bone-header">
        <span class="bone-name serif">{label(bone)}</span>
        <button class="chip" onClick={() => setPicking(!picking)} aria-expanded={picking}>
          {picking ? 'done' : 'change bone'}
        </button>
        <button class="btn subtle" onClick={() => dispatch({ type: 'reset-bone', bone })}>
          Reset
        </button>
      </div>
      {picking && <BonePicker onPick={(b) => { selectedBone.value = b; setPicking(false); }} />}

      <div class="field-row" style="align-items:center; margin-bottom: 10px;">
        <div class="segmented" role="tablist" aria-label="Control mode">
          <button class={mode === 'joint' ? 'active' : ''} onClick={() => dispatch({ type: 'set-bone-mode', bone, mode: 'joint' })}>
            Joint
          </button>
          <button class={mode === 'world' ? 'active' : ''} onClick={() => dispatch({ type: 'set-bone-mode', bone, mode: 'world' })}>
            World
          </button>
        </div>
        {hasCounterpart && (
          <button
            class={`chip ${linkSides.value ? 'active' : ''}`}
            style="display:inline-flex;align-items:center;gap:5px;"
            onClick={() => (linkSides.value = !linkSides.value)}
            aria-pressed={linkSides.value}
          >
            <span style="width:14px;height:14px;display:inline-flex;"><LinkIcon /></span> both sides
          </button>
        )}
      </div>

      <ChannelSliders bone={bone} />
    </div>
  );
};
