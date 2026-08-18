import { Button } from '@/components/ui/button'
import { GhLink, Size, Tags, statusClass, statusText } from '@/components/prbits'
import { useActions } from '@/lib/actions'
import type { BoardRow } from '@/lib/api'
import { cn } from '@/lib/utils'
import { GitMerge } from 'lucide-react'

function RowButtons({ b, refresh }: { b: BoardRow; refresh: () => void }) {
  const A = useActions()
  const canQueue = ['needs-review', 're-review', 'author-replied', 'review-failed', 'commented', 'waiting-author', 'approved'].includes(b.status)
  return (
    <span className="flex justify-end gap-1">
      {(b.status === 'approved' || b.status === 'mine') && !!b.ready && (
        <Button size="sm" variant="destructive" onClick={async e => {
          e.stopPropagation()
          if (await A.confirmDlg({ title: `Merge ${b.ref} on GitHub?`, body: b.title ?? undefined, confirmText: 'Merge', destructive: true }))
            void A.run({ action: 'merge', ref: b.ref }, refresh)
        }}><GitMerge className="size-3" />merge</Button>
      )}
      {canQueue && <Button size="sm" onClick={e => { e.stopPropagation(); void A.queueReview(b.ref, refresh) }}>queue review</Button>}
      {b.status === 'skipped'
        ? <Button size="sm" onClick={e => { e.stopPropagation(); void A.run({ action: 'unskip', ref: b.ref }, refresh) }}>unskip</Button>
        : b.status !== 'mine' && <Button size="sm" variant="ghost" className="text-muted-foreground" onClick={e => { e.stopPropagation(); void A.run({ action: 'skip', ref: b.ref, days: 7 }, refresh) }}>skip 7d</Button>}
    </span>
  )
}

export function BoardSection({ title, rows, sel, open, refresh }: {
  title: string; rows: BoardRow[]; sel: string | null; open: (ref: string) => void; refresh: () => void
}) {
  if (!rows.length) return null
  return (
    <div>
      <h2 className="mb-1.5 mt-5 flex items-baseline gap-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {title} <span className="rounded-full bg-muted px-1.5 text-[10px] font-medium">{rows.length}</span>
      </h2>
      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        <table className="w-full border-collapse">
          <tbody>
            {rows.map(b => (
              <tr key={b.ref} onClick={() => open(b.ref)}
                  className={cn('cursor-pointer border-b border-border last:border-0 transition-colors hover:bg-muted/50', sel === b.ref && 'bg-primary/10')}>
                <td className="whitespace-nowrap px-3 py-1.5 font-mono text-primary">{b.ref} <GhLink url={b.url} /></td>
                <td className={cn('whitespace-nowrap py-1.5 pr-2 font-medium', statusClass(b.status))}>{statusText(b)}</td>
                <td className="whitespace-nowrap py-1.5 pr-2 text-muted-foreground">{b.age_days ?? 0}d</td>
                <td className="py-1.5 pr-2 text-xs"><Size r={b} /></td>
                <td className="whitespace-nowrap py-1.5 pr-2">{b.author ?? ''}</td>
                <td className="whitespace-nowrap py-1.5 pr-2"><Tags b={b} /></td>
                <td className="w-full max-w-0 truncate py-1.5 pr-2 text-muted-foreground">{b.title ?? ''}</td>
                <td className="py-1 pr-2"><RowButtons b={b} refresh={refresh} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
