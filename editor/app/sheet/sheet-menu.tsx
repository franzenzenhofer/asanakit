import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { parse as parseYamlRaw } from 'yaml';
import { parseSheet, type SequenceSpec, type SheetSpecInput } from '@asanakit/model/index.js';
import { collection } from '../state/app.js';
import { library } from '../state/library.js';
import { pickTextFile } from '../lib/upload.js';
import { CloseIcon } from '../ui/icons.js';

export interface SheetMenuProps {
  readonly onClose: () => void;
  readonly onPrint: () => void;
  readonly onDownloadYaml: () => void;
  readonly onDownloadPng: () => Promise<void>;
  readonly onSave: () => void;
  readonly onLoad: (spec: SheetSpecInput) => void;
  readonly onNew: () => void;
  readonly onFromSequence: (sequence: SequenceSpec) => void;
}

/** Sheet actions: print, export, save, and starting points. */
export const SheetMenu = (props: SheetMenuProps): JSX.Element => {
  const [message, setMessage] = useState('');
  const done = (text: string): void => setMessage(text);

  return (
    <div class="modal-veil" onClick={props.onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Sheet menu">
        <div class="grabber" />
        <div style="display:flex;align-items:center;margin-bottom:10px">
          <h2 style="flex:1">Sheet</h2>
          <button class="iconbtn" onClick={props.onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <div class="detail-actions" style="margin-top:0">
          <button class="btn primary" onClick={() => { props.onPrint(); props.onClose(); }}>Print / PDF</button>
          <button class="btn" onClick={() => { props.onSave(); done('Saved to My sheets.'); }}>Save</button>
          <button class="btn" onClick={props.onDownloadYaml}>Download YAML</button>
          <button class="btn" onClick={() => void props.onDownloadPng().catch((e: unknown) => done(String(e)))}>PNG per page</button>
          <button
            class="btn"
            onClick={() =>
              void (async (): Promise<void> => {
                try {
                  const picked = await pickTextFile('.yaml,.yml,.json');
                  if (picked === null) return;
                  parseSheet(picked.text, picked.name);
                  props.onLoad(parseYamlRaw(picked.text) as SheetSpecInput);
                  props.onClose();
                } catch (error) {
                  done(error instanceof Error ? error.message : String(error));
                }
              })()
            }
          >
            Upload .sheet.yaml
          </button>
          <button class="btn" onClick={() => { props.onNew(); props.onClose(); }}>New empty sheet</button>
        </div>

        <div class="section-h"><h2>Start from a sequence</h2></div>
        {library().sequences.map((seq) => (
          <button
            key={seq.id}
            class="btn"
            style="width:100%;justify-content:flex-start;margin-bottom:4px"
            onClick={() => { props.onFromSequence(seq); props.onClose(); }}
          >
            {seq.name}
          </button>
        ))}

        {collection.mySheets.value.length > 0 && (
          <>
            <div class="section-h"><h2>My sheets</h2></div>
            {collection.mySheets.value.map((saved) => (
              <div key={saved.id} style="display:flex;gap:4px;margin-bottom:4px">
                <button class="btn" style="flex:1;justify-content:flex-start" onClick={() => { props.onLoad(saved.spec); props.onClose(); }}>
                  {saved.name}
                </button>
                <button class="iconbtn" aria-label={`Delete ${saved.name}`} onClick={() => collection.removeSheet(saved.id)}>✕</button>
              </div>
            ))}
          </>
        )}

        {message !== '' && <p role="status" style="font-size:13px;color:var(--ink-soft)">{message}</p>}
      </div>
    </div>
  );
};
