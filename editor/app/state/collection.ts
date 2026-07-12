import { signal, type Signal } from '@preact/signals';
import type { SheetSpecInput } from '@asanakit/model/index.js';
import type { KV } from './kv.js';

export interface SavedPose {
  readonly id: string;
  readonly name: string;
  readonly yaml: string;
  readonly savedAt: string;
}

export interface SavedSheet {
  readonly id: string;
  readonly name: string;
  readonly spec: SheetSpecInput;
  readonly savedAt: string;
}

const POSES_KEY = 'asanakit.my-poses';
const SHEETS_KEY = 'asanakit.my-sheets';

const readList = <T>(kv: KV, key: string): T[] => {
  const raw = kv.get(key);
  if (raw === null) return [];
  return JSON.parse(raw) as T[];
};

/** "My poses" and "my sheets": device-local collections behind the KV seam. */
export interface Collection {
  readonly myPoses: Signal<readonly SavedPose[]>;
  readonly mySheets: Signal<readonly SavedSheet[]>;
  savePose(entry: Omit<SavedPose, 'savedAt'>): void;
  removePose(id: string): void;
  saveSheet(entry: Omit<SavedSheet, 'savedAt'>): void;
  removeSheet(id: string): void;
}

export const createCollection = (kv: KV): Collection => {
  const myPoses = signal<readonly SavedPose[]>(readList<SavedPose>(kv, POSES_KEY));
  const mySheets = signal<readonly SavedSheet[]>(readList<SavedSheet>(kv, SHEETS_KEY));

  const persistPoses = (list: readonly SavedPose[]): void => {
    myPoses.value = list;
    kv.set(POSES_KEY, JSON.stringify(list));
  };

  const persistSheets = (list: readonly SavedSheet[]): void => {
    mySheets.value = list;
    kv.set(SHEETS_KEY, JSON.stringify(list));
  };

  return {
    myPoses,
    mySheets,
    savePose(entry: Omit<SavedPose, 'savedAt'>): void {
      const saved = { ...entry, savedAt: new Date().toISOString() };
      persistPoses([saved, ...myPoses.value.filter((p) => p.id !== entry.id)]);
    },
    removePose(id: string): void {
      persistPoses(myPoses.value.filter((p) => p.id !== id));
    },
    saveSheet(entry: Omit<SavedSheet, 'savedAt'>): void {
      const saved = { ...entry, savedAt: new Date().toISOString() };
      persistSheets([saved, ...mySheets.value.filter((s) => s.id !== entry.id)]);
    },
    removeSheet(id: string): void {
      persistSheets(mySheets.value.filter((s) => s.id !== id));
    },
  };
};
