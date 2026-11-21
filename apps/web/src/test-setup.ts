import '@testing-library/jest-dom/vitest';
import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { configure } from '@testing-library/react';
import { beforeEach } from 'vitest';

// The suite runs many jsdom apps in parallel; one second is too tight for findBy and waitFor on a busy machine.
configure({ asyncUtilTimeout: 5000 });
import { closeOutbox } from './lib/outbox/db';

// Every test starts with an empty outbox.
beforeEach(() => {
  closeOutbox();
  globalThis.indexedDB = new IDBFactory();
});

// jsdom has no canvas. ECharts measures label text through one, so give it a rough text width.
HTMLCanvasElement.prototype.getContext = (() => ({ font: '', measureText: (t: string) => ({ width: t.length * 6 }) })) as unknown as HTMLCanvasElement['getContext'];
