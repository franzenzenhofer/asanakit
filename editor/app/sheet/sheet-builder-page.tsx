import { useMemo, useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { stringify } from 'yaml';
import { parsePose } from '@asanakit/model/index.js';
import { buildPrintableHtml } from '@asanakit/render/printable.js';
import { collection } from '../state/app.js';
import { can } from '../state/entitlements.js';
import { library } from '../state/library.js';
import {
  addSection, addStep, blankSheet, buildPreview, loadSheet, makeResolver, removeSection,
  renameSection, sheet, sheetFromSequence, stepCount,
} from '../state/sheet-doc.js';
import { downloadBlob, downloadText, printHtml, svgToPngBlob } from '../lib/download.js';
import { encodeShare, SHARE_URL_BUDGET } from '../lib/share.js';
import { MoreIcon, PlusIcon, PrintIcon } from '../ui/icons.js';
import { StepRow } from './step-row.js';
import { SheetOptions } from './sheet-options.js';
import { SheetMenu } from './sheet-menu.js';
import { PosePicker } from './pose-picker.js';

type Tab = 'steps' | 'layout' | 'preview';

interface StepsTabProps {
  readonly sections: NonNullable<ReturnType<typeof blankSheet>['sections']>;
  readonly stepName: (poseId: string, label: string | undefined) => string;
  readonly onAddPose: (section: number) => void;
}

const StepsTab = ({ sections, stepName, onAddPose }: StepsTabProps): JSX.Element => (
  <div class="sheet-steps">
    {sections.every((s) => s.steps.length === 0) && (
      <div class="empty">
        <span class="serif">An empty sheet</span>
        Add poses from the library, or start from a bundled sequence in the menu.
      </div>
    )}
    {sections.map((section, si) => (
      <div key={si}>
        <div class="sheet-section-row">
          <input value={section.name} aria-label="Section name" onChange={(e) => renameSection(si, (e.target as HTMLInputElement).value)} />
          {sections.length > 1 && (
            <button class="iconbtn" style="width:32px;height:32px" aria-label="Remove section" onClick={() => removeSection(si)}>✕</button>
          )}
        </div>
        {section.steps.map((step, i) => (
          <StepRow key={`${step.pose}-${i}`} section={si} index={i} step={step} name={stepName(step.pose, step.label)} />
        ))}
        <button class="btn subtle" style="margin:2px 0 8px" onClick={() => onAddPose(si)}>
          <span style="width:16px;height:16px;display:inline-flex"><PlusIcon /></span> Add pose
        </button>
      </div>
    ))}
    <div class="sheet-addbar">
      <button class="btn" onClick={() => addSection(`Section ${sections.length + 1}`)}>New section</button>
    </div>
  </div>
);

const PreviewTab = ({ pages, errors }: { pages: readonly string[]; errors: readonly string[] }): JSX.Element => (
  <div class="sheet-preview">
    {errors.map((e) => (
      <p key={e} style="color:var(--error)">{e}</p>
    ))}
    {pages.length === 0 && errors.length === 0 && (
      <div class="empty"><span class="serif">No pages yet</span>Add poses first - the preview is the exact printout.</div>
    )}
    {pages.map((page, i) => (
      <div key={i} class="page" dangerouslySetInnerHTML={{ __html: page }} />
    ))}
  </div>
);

/** Compose a practice sheet, see the exact pages, print them. */
export const SheetBuilderPage = (): JSX.Element => {
  const [tab, setTab] = useState<Tab>('steps');
  const [menuOpen, setMenuOpen] = useState(false);
  const [pickerFor, setPickerFor] = useState<number | null>(null);

  const doc = sheet.value;
  const sections = doc.sections ?? [];
  const myPoses = collection.myPoses.value;
  const resolver = useMemo(() => makeResolver(myPoses), [myPoses]);
  const preview = useMemo(
    () => (tab === 'preview' || menuOpen ? buildPreview(doc, resolver) : null),
    [doc, resolver, tab, menuOpen],
  );

  const stepName = (poseId: string, label: string | undefined): string => {
    if (label !== undefined) return label;
    const bundled = library().byId.get(poseId);
    if (bundled !== undefined) return bundled.pose.name;
    return myPoses.find((p) => p.id === poseId)?.name ?? poseId;
  };

  /** Embed referenced "my poses" inline so the sheet is self-contained. */
  const selfContained = (): typeof doc => {
    const referenced = new Set(sections.flatMap((s) => s.steps.map((st) => st.pose)));
    const inline = myPoses.filter((p) => referenced.has(p.id)).map((p) => parsePose(p.yaml, p.id));
    return inline.length === 0 ? doc : { ...doc, poses: inline };
  };

  const print = (): void => {
    const built = buildPreview(selfContained(), resolver);
    if (built.layout === undefined || built.pages.length === 0) return;
    printHtml(buildPrintableHtml(built.pages, built.layout.paper, doc.name ?? 'Practice sheet'));
  };

  return (
    <div class="sheetgrid">
      <header class="topbar">
        <input
          style="flex:1;border:none;background:none;font-family:var(--serif);font-size:17px;font-weight:650;padding:4px 0;min-width:0"
          value={doc.name ?? ''}
          name="sheet-name"
          aria-label="Sheet name"
          onChange={(e) => loadSheet({ ...doc, name: (e.target as HTMLInputElement).value || 'My Practice Sheet' })}
        />
        <button class="iconbtn" onClick={print} disabled={stepCount.value === 0 || !can('sheet-builder')} aria-label="Print">
          <PrintIcon />
        </button>
        <button class="iconbtn" onClick={() => setMenuOpen(true)} aria-label="Sheet menu">
          <MoreIcon />
        </button>
      </header>

      <div class="panel-tabs" style="background:var(--paper-raised);border-bottom:1px solid var(--line)">
        <div class="chips" role="tablist">
          {(['steps', 'layout', 'preview'] as const).map((t) => (
            <button key={t} class={`chip ${tab === t ? 'active' : ''}`} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>
              {t === 'steps' ? `Poses (${stepCount.value})` : t === 'layout' ? 'Layout' : 'Pages'}
            </button>
          ))}
        </div>
      </div>

      {tab === 'steps' && <StepsTab sections={sections} stepName={stepName} onAddPose={setPickerFor} />}

      {tab === 'layout' && (
        <div class="library">
          <SheetOptions />
        </div>
      )}

      {tab === 'preview' && preview !== null && <PreviewTab pages={preview.pages} errors={preview.errors} />}

      {menuOpen && (
        <SheetMenu
          onClose={() => setMenuOpen(false)}
          onPrint={print}
          onShareLink={async () => {
            const link = `${location.origin}/#/s/${await encodeShare(stringify(selfContained()))}`;
            if (link.length > SHARE_URL_BUDGET) return 'Too large for a link - download the YAML instead.';
            await navigator.clipboard.writeText(link);
            return 'Share link copied.';
          }}
          onDownloadYaml={() => downloadText(stringify(selfContained()), `${doc.id ?? 'sheet'}.sheet.yaml`, 'text/yaml')}
          onDownloadPng={async () => {
            const built = buildPreview(selfContained(), resolver);
            if (built.layout === undefined) return;
            for (const [i, page] of built.pages.entries()) {
              downloadBlob(
                await svgToPngBlob(page, built.layout.paper.widthMm * 4, built.layout.paper.heightMm * 4),
                `${doc.id ?? 'sheet'}-page-${i + 1}.png`,
              );
            }
          }}
          onSave={() => collection.saveSheet({ id: doc.id ?? 'my-sheet', name: doc.name ?? 'My sheet', spec: doc })}
          onLoad={(spec) => loadSheet(spec)}
          onNew={() => loadSheet(blankSheet())}
          onFromSequence={(seq) => sheetFromSequence(seq)}
        />
      )}

      {pickerFor !== null && (
        <PosePicker
          onClose={() => setPickerFor(null)}
          onPick={(id) => {
            addStep(pickerFor, id);
            setPickerFor(null);
          }}
        />
      )}
    </div>
  );
};
