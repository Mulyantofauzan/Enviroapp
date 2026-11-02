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
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => { opened = null; reject(req.error); };
      req.onblocked = () => { opened = null; reject(new Error('blocked')); };
    });
  }
  return opened;
}

async function run<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(STORE, mode);
    const req = fn(tx.objectStore(STORE));
    tx.oncomplete = () => resolve(req.result);
    tx.onerror = () => reject(tx.error ?? req.error);
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  });
}

// Photos are stored as bytes plus type: it avoids Blob quirks in some browsers' IndexedDB.
export type Stored = Omit<OutboxItem, 'blob'> & { blob: { data: ArrayBuffer; type: string } | null };

const readBytes = (b: Blob): Promise<ArrayBuffer> => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result as ArrayBuffer);
  r.onerror = () => reject(r.error);
  r.readAsArrayBuffer(b);
});

export async function allItems(): Promise<OutboxItem[]> {
  const rows = await run<Stored[]>('readonly', (s) => s.getAll());
  return rows.map((r) => ({ ...r, blob: r.blob ? new Blob([r.blob.data], { type: r.blob.type }) : null }));
}
export async function putItem(item: OutboxItem): Promise<IDBValidKey> {
  const stored: Stored = { ...item, blob: item.blob ? { data: await readBytes(item.blob), type: item.blob.type } : null };
  return run('readwrite', (s) => s.put(stored));
}
/** Reads, changes and writes one item in a single transaction, so two tabs cannot overwrite each other's change. */
export async function updateItem(id: string, patch: (x: Stored) => Partial<Stored>): Promise<boolean> {
  const db = await open();
  return new Promise<boolean>((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    const store = tx.objectStore(STORE);
    let found = false;
    const get = store.get(id);
    get.onsuccess = () => {
      if (!get.result) return;
      found = true;
      store.put({ ...get.result, ...patch(get.result) });
    };
    tx.oncomplete = () => resolve(found);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('aborted'));
  });
}
export const deleteItem = (id: string): Promise<undefined> => run('readwrite', (s) => s.delete(id));
