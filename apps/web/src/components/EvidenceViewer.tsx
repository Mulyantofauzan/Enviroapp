import { useEffect, useRef } from 'react';
import { formatDateId, formatNumber } from '@evo/shared';
import { Icon } from '../icons';
import { witaStamp } from '../lib/stamp';
import { EvidenceMeta, type MetaFields } from './EvidenceMeta';

export type ViewerItem = MetaFields & {
  id: string; filename: string; mime: string; size: number; taken_at?: string | null; uploaded_at: string;
  uploaded_by_name: string; uploaded_by_role?: string; title?: string; due_date?: string;
};

const sizeText = (n: number) => (n < 1024 ? `${n} B` : n < 1024 * 1024 ? `${formatNumber(n / 1024, 1)} KB` : `${formatNumber(n / (1024 * 1024), 1)} MB`);

/** The whole picture, plus what is known about it. Escape or the button closes it. */
export function EvidenceViewer({ item, onClose }: { item: ViewerItem; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = overflow; };
  }, [onClose]);

  return (
    <div className="ui-viewer" role="dialog" aria-modal="true" aria-label="Pratinjau eviden">
      <div className="ui-viewer__panel">
        <header className="ui-viewer__head">
          <div>
            {item.title && <h3>{item.title}</h3>}
            {item.due_date && <p>{formatDateId(item.due_date)}</p>}
          </div>
          <button type="button" ref={closeRef} className="ui-iconbtn" aria-label="Tutup" onClick={onClose}><Icon name="x" /></button>
        </header>
        <div className="ui-viewer__img"><img src={`/api/evidence/${item.id}/file`} alt={item.filename} /></div>
        <dl className="ui-viewer__meta">
          <div><EvidenceMeta e={item} /></div>
          {item.source === 'camera' && item.taken_at && <div>Diambil {witaStamp(new Date(item.taken_at))} WITA</div>}
          <div>Diunggah {witaStamp(new Date(item.uploaded_at))} WITA</div>
          <div>{item.uploaded_by_name}{item.uploaded_by_role ? ` - ${item.uploaded_by_role}` : ''}</div>
          <div className="ui-muted">{item.filename} - {sizeText(item.size)}</div>
        </dl>
        <a className="ui-btn ui-btn--primary" href={`/api/evidence/${item.id}/file`} download={item.filename}><Icon name="download" /> Unduh</a>
      </div>
    </div>
  );
}
