export type OutboxKind = 'weather' | 'water' | 'coagulant' | 'evidence' | 'complete';
export type OutboxRequest = {
  method: 'PUT' | 'POST';
  path: string;
  body?: Record<string, unknown>;
  fields?: Record<string, string>;
  filename?: string;
};
export type OutboxItem = {
  id: string; owner: string; kind: OutboxKind; key: string; group: string | null; label: string;
  request: OutboxRequest; blob: Blob | null; recordedAt: string; seq: number;
  status: 'pending' | 'failed'; error: string | null; tries: number; nextAt: number;
};

const NAME = 'evo-outbox';
const STORE = 'items';
const BLOBS = 'blobs';
let opened: Promise<IDBDatabase> | null = null;

export const outboxAvailable = () => typeof indexedDB !== 'undefined' && indexedDB !== null;

/** Drops the cached connection (used by tests that swap the database). */
export function closeOutbox() {
  opened?.then((d) => d.close()).catch(() => {});
  opened = null;
}

function open(): Promise<IDBDatabase> {
  if (!opened) {
    opened = new Promise((resolve, reject) => {
      const req = indexedDB.open(NAME, 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
        store.createIndex('owner', 'owner');
        req.result.createObjectStore(BLOBS, { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opened = null; reject(req.error); };
      req.onblocked = () => { opened = null; reject(new Error('blocked')); };
    });
  }
  return opened;
}

function tx<T>(mode: IDBTransactionMode, stores: string[], fn: (t: IDBTransaction) => IDBRequest<T>): Promise<T> {
  return open().then((db) => new Promise<T>((resolve, reject) => {
    const t = db.transaction(stores, mode);
    const req = fn(t);
    t.oncomplete = () => resolve(req.result);
    t.onerror = () => reject(t.error ?? req.error);
    t.onabort = () => reject(t.error ?? new Error('aborted'));
  }));
}
const run = <T,>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) => tx(mode, [STORE], (t) => fn(t.objectStore(STORE)));

// Photos live in their own store as bytes plus type (avoids Blob quirks in some browsers' IndexedDB), so listing
// the queue never loads them: a photo is read only when it is about to be sent.
export type Stored = Omit<OutboxItem, 'blob'> & { blob: null };

const readBytes = (b: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as ArrayBuffer);
  r.onerror = () => reject(r.error);
  r.readAsArrayBuffer(b);
});

export async function allItems(): Promise<OutboxItem[]> {
  return run<OutboxItem[]>('readonly', (s) => s.getAll());
}

export async function putItem(item: OutboxItem): Promise<void> {
  const bytes = item.blob ? { id: item.id, data: await readBytes(item.blob), type: item.blob.type } : null;
  await tx('readwrite', [STORE, BLOBS], (t) => {
    if (bytes) t.objectStore(BLOBS).put(bytes);
    return t.objectStore(STORE).put({ ...item, blob: null });
  });
}

export async function loadBlob(id: string): Promise<Blob | null> {
  const row = await tx<{ data: ArrayBuffer; type: string } | undefined>('readonly', [BLOBS], (t) => t.objectStore(BLOBS).get(id));
  return row ? new Blob([row.data], { type: row.type }) : null;
}

/** Reads, changes and writes one item in a single transaction, so two tabs cannot overwrite each other's change. */
export async function updateItem(id: string, patch: (x: Stored) => Partial<Stored>): Promise<boolean> {
  const db = await open();
  return new Promise<boolean>((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite');
    const store = t.objectStore(STORE);
    let found = false;
    const get = store.get(id);
    get.onsuccess = () => {
      if (!get.result) return;
      found = true;
      store.put({ ...get.result, ...patch(get.result) });
    };
    t.oncomplete = () => resolve(found);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error ?? new Error('aborted'));
  });
}

export const deleteItem = (id: string): Promise<void> =>
  tx('readwrite', [STORE, BLOBS], (t) => { t.objectStore(BLOBS).delete(id); return t.objectStore(STORE).delete(id); }).then(() => undefined);
