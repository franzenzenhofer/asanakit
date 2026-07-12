import { computed, signal } from '@preact/signals';
import { parsePose, sheetSchema, type PoseSpec, type SequenceSpec, type SheetSpec, type SheetSpecInput } from '@asanakit/model/index.js';
import { layoutSheet, type SheetLayout } from '@asanakit/render/sheet-layout.js';
import { renderSheetPages } from '@asanakit/render/sheet-page.js';
import { library } from './library.js';
import type { SavedPose } from './collection.js';

type SectionInput = NonNullable<SheetSpecInput['sections']>[number];
export type StepInput = SectionInput['steps'][number];

export const blankSheet = (): SheetSpecInput => ({
  asanakit: 2,
  id: 'my-sheet',
  name: 'My Practice Sheet',
  sections: [{ name: 'Practice', steps: [] }],
});

export const sheet = signal<SheetSpecInput>(blankSheet());

const withSections = (value: SheetSpecInput, sections: SectionInput[]): SheetSpecInput => ({ ...value, sections });

const sectionsOf = (value: SheetSpecInput): SectionInput[] => (value.sections ?? []).map((s) => ({ ...s, steps: [...s.steps] }));

export const patchSheet = (patch: Partial<SheetSpecInput>): void => {
  sheet.value = { ...sheet.value, ...patch };
};

export const addStep = (section: number, poseId: string): void => {
  const sections = sectionsOf(sheet.value);
  sections[section]?.steps.push({ pose: poseId });
  sheet.value = withSections(sheet.value, sections);
};

export const patchStep = (section: number, index: number, patch: Partial<StepInput>): void => {
  const sections = sectionsOf(sheet.value);
  const step = sections[section]?.steps[index];
  if (step === undefined) return;
  sections[section]?.steps.splice(index, 1, { ...step, ...patch });
  sheet.value = withSections(sheet.value, sections);
};

export const removeStep = (section: number, index: number): void => {
  const sections = sectionsOf(sheet.value);
  sections[section]?.steps.splice(index, 1);
  sheet.value = withSections(sheet.value, sections);
};

export const moveStep = (section: number, index: number, delta: -1 | 1): void => {
  const sections = sectionsOf(sheet.value);
  const steps = sections[section]?.steps;
  if (steps === undefined) return;
  const target = index + delta;
  if (target < 0 || target >= steps.length) return;
  const [step] = steps.splice(index, 1);
  if (step !== undefined) steps.splice(target, 0, step);
  sheet.value = withSections(sheet.value, sections);
};

export const addSection = (name: string): void => {
  sheet.value = withSections(sheet.value, [...sectionsOf(sheet.value), { name, steps: [] }]);
};

export const renameSection = (index: number, name: string): void => {
  const sections = sectionsOf(sheet.value);
  const section = sections[index];
  if (section === undefined) return;
  sections[index] = { ...section, name };
  sheet.value = withSections(sheet.value, sections);
};

export const removeSection = (index: number): void => {
  const sections = sectionsOf(sheet.value);
  sections.splice(index, 1);
  sheet.value = withSections(sheet.value, sections);
};

export const loadSheet = (value: SheetSpecInput): void => {
  sheet.value = value;
};

/** Start a sheet from a bundled sequence - "print the Ashtanga primary" in one tap. */
export const sheetFromSequence = (sequence: SequenceSpec): void => {
  sheet.value = {
    asanakit: 2,
    id: `${sequence.id}-sheet`,
    name: sequence.name,
    sections: sequence.sections.map((s) => ({ name: s.name, steps: s.steps.map((step) => ({ ...step })) })),
  };
};

/** Resolve pose ids against the bundled library, then saved "my poses". */
export const makeResolver = (myPoses: readonly SavedPose[]): ((id: string) => PoseSpec | undefined) => {
  const mine = new Map(myPoses.map((p) => [p.id, p.yaml]));
  return (id) => {
    const bundled = library().byId.get(id);
    if (bundled !== undefined) return bundled.pose;
    const yaml = mine.get(id);
    return yaml === undefined ? undefined : parsePose(yaml, id);
  };
};

export interface SheetPreview {
  readonly spec?: SheetSpec;
  readonly layout?: SheetLayout;
  readonly pages: readonly string[];
  readonly errors: readonly string[];
}

export const buildPreview = (input: SheetSpecInput, resolve: (id: string) => PoseSpec | undefined): SheetPreview => {
  const result = sheetSchema.safeParse(input);
  if (!result.success) return { pages: [], errors: result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
  try {
    const layout = layoutSheet(result.data, resolve);
    return { spec: result.data, layout, pages: renderSheetPages(layout), errors: [] };
  } catch (error) {
    return { spec: result.data, pages: [], errors: [error instanceof Error ? error.message : String(error)] };
  }
};

export const stepCount = computed(() => (sheet.value.sections ?? []).reduce((n, s) => n + s.steps.length, 0));
