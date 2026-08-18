import { Button } from '@/components/ui/button'
import { GhLink, Size, Tags, statusClass, statusText } from '@/components/prbits'
import { queueReview } from '@/lib/actions'
import { runAction } from '@/lib/actions'
import { useToast } from '@/lib/toast'
import type { BoardRow } from '@/lib/api'
import { cn } from '@/lib/utils'

function RowButtons({ b, refresh }: { b: BoardRow; refresh: () => void }) {
  const toast = useToast()
  const canQueue = ['needs-review', 're-review', 'author-replied', 'review-failed', 'commented', 'waiting-author', 'approved'].includes(b.status)
  return (
    <span className="flex justify-end gap-1">
      {(b.status === 'approved' || b.status === 'mine') && !!b.ready && (
        <Button size="sm" variant="destructive"
          onClick={e => { e.stopPropagation(); if (confirm(`Merge ${b.ref} on GitHub?`)) void runAction(toast, { action: 'merge', ref: b.ref }, refresh) }}>
          merge
        </Button>
      )}
      {canQueue && (
        <Button size="sm" onClick={e => { e.stopPropagation(); queueReview(toast, b.ref, refresh) }}>queue review</Button>
      )}
      {b.status === 'skipped'
        ? <Button size="sm" onClick={e => { e.stopPropagation(); void runAction(toast, { action: 'unskip', ref: b.ref }, refresh) }}>unskip</Button>
        : b.status !== 'mine' && <Button size="sm" onClick={e => { e.stopPropagation(); void runAction(toast, { action: 'skip', ref: b.ref, days: 7 }, refresh) }}>skip 7d</Button>}
    </span>
  )
}

export function BoardSection({ title, rows, sel, open, refresh }: {
  title: string; rows: BoardRow[]; sel: string | null; open: (ref: string) => void; refresh: () => void
}) {
  if (!rows.length) return null
  return (
    <div>
      <h2 className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map(b => (
              <tr key={b.ref} onClick={() => open(b.ref)}
                  className={cn('cursor-pointer border-b border-border hover:bg-muted/60', sel === b.ref && 'bg-primary/10')}>
                <td className="whitespace-nowrap py-1 pr-2 font-mono text-primary">{b.ref} <GhLink url={b.url} /></td>
                <td className={cn('whitespace-nowrap py-1 pr-2 font-semibold', statusClass(b.status))}>{statusText(b)}</td>
                <td className="whitespace-nowrap py-1 pr-2">{b.age_days ?? 0}d</td>
                <td className="py-1 pr-2 text-xs"><Size r={b} /></td>
                <td className="whitespace-nowrap py-1 pr-2">{b.author ?? ''}</td>
                <td className="whitespace-nowrap py-1 pr-2"><Tags b={b} /></td>
                <td className="w-full max-w-0 truncate py-1 pr-2 text-muted-foreground">{b.title ?? ''}</td>
                <td className="py-0.5"><RowButtons b={b} refresh={refresh} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
