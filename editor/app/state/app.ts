import { browserKV } from './kv.js';
import { createCollection } from './collection.js';

/** App-wide singletons: one storage, one collection. */
export const kv = browserKV();
export const collection = createCollection(kv);
