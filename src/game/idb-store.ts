/**
 * Tiny IndexedDB key/value helper. Designer maps (up to 512×512 tiles, several MB each) live here
 * instead of localStorage, which stops at about 5 MB for the whole site.
 */
const DB_NAME = "turbz-designer";
const DB_VERSION = 2;
export const STORE_MAPS = "maps";
export const STORE_DRAFTS = "drafts";
/** Each life's rolled world, cached so it loads instantly and never changes under a hunter. */
export const STORE_WORLDS = "worlds";

let dbPromise: Promise<IDBDatabase> | null = null;

export function idbAvailable(): boolean {
  try {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  } catch {
    return false;
  }
}

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_MAPS)) db.createObjectStore(STORE_MAPS);
      if (!db.objectStoreNames.contains(STORE_DRAFTS)) db.createObjectStore(STORE_DRAFTS);
      if (!db.objectStoreNames.contains(STORE_WORLDS)) db.createObjectStore(STORE_WORLDS);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB failed to open."));
    req.onblocked = () => reject(new Error("IndexedDB is blocked by another tab."));
  });
  dbPromise.catch(() => { dbPromise = null; });
  return dbPromise;
}

function run<T>(store: string, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then((db) => new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const req = fn(tx.objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB request failed."));
    tx.onabort = () => reject(tx.error ?? new Error("IndexedDB transaction aborted."));
  }));
}

export const idbGet = <T = unknown>(store: string, key: string) => run<T | undefined>(store, "readonly", (s) => s.get(key) as IDBRequest<T | undefined>);
export const idbPut = (store: string, key: string, value: unknown) => run(store, "readwrite", (s) => s.put(value, key)).then(() => undefined);
export const idbDelete = (store: string, key: string) => run(store, "readwrite", (s) => s.delete(key)).then(() => undefined);
export const idbAll = <T = unknown>(store: string) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>);
