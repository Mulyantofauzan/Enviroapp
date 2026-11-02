import { formatCoords } from '../lib/stamp';
import { Icon } from '../icons';
import { Badge } from '../ui/Badge';

export type MetaFields = { source?: 'camera' | 'gallery'; gps_lat?: number | null; gps_lng?: number | null };

/** Where a file came from: coordinates, a camera photo without a fix, or a plain gallery file. */
export function EvidenceMeta({ e }: { e: MetaFields }) {
  if (e.source === 'camera' && e.gps_lat != null && e.gps_lng != null) {
    return <span className="ui-geo"><Icon name="pin" size={14} />GPS {formatCoords(e.gps_lat, e.gps_lng)}</span>;
  }
  if (e.source === 'camera') return <Badge tone="warning">Tanpa lokasi</Badge>;
  return <Badge tone="neutral">Galeri</Badge>;
}
