import { useState } from 'preact/hooks';
import type { JSX } from 'preact';
import { parse as parseYamlRaw } from 'yaml';
import { parsePose, type PoseSpecInput } from '@asanakit/model/index.js';
import { renderSvg } from '@asanakit/render/scene.js';
import { collection } from '../state/app.js';
import { blankPose, loadPose, pose, styleId } from '../state/doc.js';
import { parsed } from '../state/preview.js';
import { toYaml } from '../state/serialize.js';
import { can } from '../state/entitlements.js';
import { downloadText, svgToPngBlob, downloadBlob } from '../lib/download.js';
import { pickTextFile } from '../lib/upload.js';
import { encodeShare, SHARE_URL_BUDGET } from '../lib/share.js';
import { CloseIcon } from '../ui/icons.js';

/** Save, export and import - the editor's way in and out. */
export const ExportMenu = ({ onClose }: { onClose: () => void }): JSX.Element => {
  const [message, setMessage] = useState('');
  const doc = pose.value;
  const spec = parsed.value.spec;

  const exportSvg = (): string | null => {
    if (spec === undefined) return null;
    return renderSvg({ ...spec, physics: 'none' }, { style: styleId.value, width: 900, height: 1100, title: true, caption: true });
  };

  const act = (fn: () => void | Promise<void>): void => {
    void (async (): Promise<void> => {
      try {
        await fn();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : String(error));
      }
    })();
  };

  const id = typeof doc.id === 'string' ? doc.id : 'pose';

  return (
    <div class="modal-veil" onClick={onClose}>
      <div class="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Save and export">
        <div class="grabber" />
        <div style="display:flex;align-items:center;margin-bottom:10px">
          <h2 style="flex:1">Save &amp; export</h2>
          <button class="iconbtn" onClick={onClose} aria-label="Close"><CloseIcon /></button>
        </div>

        <div class="detail-actions" style="margin-top:0">
          <button
            class="btn primary"
            disabled={spec === undefined}
            onClick={() =>
              act(() => {
                collection.savePose({ id, name: doc.name ?? id, yaml: toYaml(doc) });
                setMessage(`Saved "${doc.name}" to My poses.`);
              })
            }
          >
            Save to My poses
          </button>
          <button class="btn" disabled={!can('export-yaml')} onClick={() => act(() => downloadText(toYaml(doc), `${id}.pose.yaml`, 'text/yaml'))}>
            Download YAML
          </button>
          <button
            class="btn"
            disabled={spec === undefined}
            onClick={() =>
              act(() => {
                const svg = exportSvg();
                if (svg !== null) downloadText(svg, `${id}.svg`, 'image/svg+xml');
              })
            }
          >
            Download SVG
          </button>
          <button
            class="btn"
            disabled={spec === undefined || !can('export-png')}
            onClick={() =>
              act(async () => {
                const svg = exportSvg();
                if (svg === null) return;
                downloadBlob(await svgToPngBlob(svg, 900, 1100), `${id}.png`);
              })
            }
          >
            Download PNG
          </button>
          <button
            class="btn"
            disabled={spec === undefined}
            onClick={() =>
              act(async () => {
                if (spec === undefined) return;
                const { poseToGlb } = await import('../three/glb.js');
                downloadBlob(await poseToGlb({ ...spec, physics: 'none' }), `${id}.glb`);
              })
            }
          >
            Download GLB (3D)
          </button>
          <button
            class="btn"
            disabled={spec === undefined}
            onClick={() =>
              act(async () => {
                const link = `${location.origin}/#/p/${await encodeShare(toYaml(doc))}`;
                if (link.length > SHARE_URL_BUDGET) {
                  setMessage('This pose is too large for a link - download the YAML instead.');
                  return;
                }
                await navigator.clipboard.writeText(link);
                setMessage('Share link copied.');
              })
            }
          >
            Copy share link
          </button>
          <button
            class="btn"
            onClick={() =>
              act(async () => {
                const picked = await pickTextFile('.yaml,.yml,.json');
                if (picked === null) return;
                parsePose(picked.text, picked.name);
                loadPose(parseYamlRaw(picked.text) as PoseSpecInput);
                setMessage(`Loaded ${picked.name}.`);
                onClose();
              })
            }
          >
            Upload .pose.yaml
          </button>
          <button class="btn" onClick={() => act(() => { loadPose(blankPose()); onClose(); })}>
            New blank pose
          </button>
        </div>

        <div class="field" style="margin-top:16px">
          <label>Import - paste .pose.yaml</label>
          <textarea
            id="import-yaml"
            rows={4}
            placeholder="asanakit: 2&#10;id: my-asana&#10;..."
          />
          <button
            class="btn"
            onClick={() =>
              act(() => {
                const el = document.getElementById('import-yaml') as HTMLTextAreaElement;
                const text = el.value;
                if (text.trim() === '') return;
                parsePose(text, 'pasted');
                loadPose(parseYamlRaw(text) as PoseSpecInput);
                setMessage('Imported.');
                onClose();
              })
            }
          >
            Import pasted YAML
          </button>
        </div>

        {message !== '' && <p role="status" style="font-size:13px;color:var(--ink-soft)">{message}</p>}
      </div>
    </div>
  );
};
