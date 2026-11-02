import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { beforeEach } from 'vitest';
import { closeOutbox } from './lib/outbox/db';

// Every test starts with an empty outbox.
beforeEach(() => {
  closeOutbox();
  globalThis.indexedDB = new IDBFactory();
});
