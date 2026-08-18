import { Button } from '@/components/ui/button'
import { GhLink, Size, verdictBadge } from '@/components/prbits'
import type { StagedRow } from '@/lib/api'
import { cn } from '@/lib/utils'

export function StagedTable({ staged, sel, open }: { staged: StagedRow[]; sel: string | null; open: (ref: string) => void }) {
  if (!staged.length) return <div className="text-xs text-muted-foreground">nothing staged</div>
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <tbody>
          {staged.map(s => (
            <tr key={s.id} onClick={() => open(s.ref)}
                className={cn('cursor-pointer border-b border-border hover:bg-muted/60', sel === s.ref && 'bg-primary/10')}>
              <td className="whitespace-nowrap py-1 pr-2 font-mono text-primary">{s.ref} <GhLink url={s.url} /></td>
              <td className="whitespace-nowrap py-1 pr-2">{verdictBadge(s.verdict)}{s.behind ? <span className="ml-1 text-xs text-warn">(behind)</span> : null}</td>
              <td className="whitespace-nowrap py-1 pr-2 text-xs text-muted-foreground">{s.mins_ago}m ago</td>
              <td className="py-1 pr-2 text-xs"><Size r={s} /></td>
              <td className="whitespace-nowrap py-1 pr-2">{s.author ?? ''}</td>
              <td className="w-full max-w-0 truncate py-1 pr-2 text-muted-foreground">{s.title ?? ''}</td>
              <td className="py-0.5">
                <span className="flex justify-end gap-1">
                  <Button size="sm" variant="default" onClick={e => { e.stopPropagation(); open(s.ref) }}>read</Button>
                  <a href={`/report?ref=${encodeURIComponent(s.ref)}`} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}>
                    <Button size="sm">full page ↗</Button>
                  </a>
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
