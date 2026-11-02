import { useState, type ReactNode } from 'react';
import { Button } from './Button';

export type Column<Row> = {
  key: string;
  header: string;
  render: (row: Row) => ReactNode;
  align?: 'left' | 'right';
  sticky?: boolean;
  cellClass?: (row: Row) => string;
};

type Props<Row> = {
  caption: string;
  columns: Column<Row>[];
  rows: Row[];
  rowKey: (row: Row) => string;
  emptyText: string;
  pageSize?: number;
};

const cls = (...p: (string | false | undefined)[]) => p.filter(Boolean).join(' ');

/** A plain, accessible table: scrolls sideways inside its own box, first column can stay put, rows load 50 at a time. */
export function DataTable<Row>({ caption, columns, rows, rowKey, emptyText, pageSize = 50 }: Props<Row>) {
  const [limit, setLimit] = useState(pageSize);
  if (rows.length === 0) return <p className="ui-muted">{emptyText}</p>;
  return (
    <>
      <div className="ui-tablewrap" role="region" aria-label={caption} tabIndex={0}>
        <table className="ui-table">
          <caption className="ui-sr">{caption}</caption>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className={cls(c.sticky && 'is-sticky', c.align === 'right' && 'is-right')}>{c.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, limit).map((r) => (
              <tr key={rowKey(r)}>
                {columns.map((c) => (
                  <td key={c.key} className={cls(c.sticky && 'is-sticky', c.align === 'right' && 'is-right', c.cellClass?.(r))}>{c.render(r)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > limit && <Button variant="outline" block onClick={() => setLimit((l) => l + pageSize)}>Tampilkan lebih banyak</Button>}
    </>
  );
}
