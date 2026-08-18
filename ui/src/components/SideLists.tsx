import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useActions } from '@/lib/actions'
import type { HistoryRow, QueueRow, SessionRow } from '@/lib/api'

export function QueueList({ queue, refresh }: { queue: QueueRow[]; refresh: () => void }) {
  const A = useActions()
  if (!queue.length) return <div className="text-xs text-muted-foreground">(empty)</div>
  return (
    <div className="space-y-1">
      {queue.map(q => (
        <div key={q.id} className="flex items-center gap-2 text-sm">
          <span className="font-mono text-primary">{q.ref}</span>
          <span className="text-xs text-muted-foreground">queued {q.mins}m ago{q.attempts ? ` · attempt ${q.attempts + 1}` : ''}</span>
          <Button size="sm" onClick={() => void A.run({ action: 'discard', ref: q.ref, reason: 'dequeued from UI' }, refresh)}>dequeue</Button>
        </div>
      ))}
    </div>
  )
}

export function SessionsList({ sessions }: { sessions: SessionRow[] }) {
  if (!sessions.length) return <div className="text-xs text-muted-foreground">(none live)</div>
  return (
    <div className="space-y-1 text-xs">
      {sessions.map(s => (
        <div key={s.id} className="flex flex-wrap items-center gap-1.5">
          <b>{s.label || s.id}</b>
          <Badge>{s.kind}</Badge>
          <span className="text-muted-foreground">{s.repo ?? ''}</span>
          {s.claims && <span className="text-ok">claims {s.claims}</span>}
          <span className="text-muted-foreground">· seen {s.last_seen_at.slice(11, 16)}</span>
        </div>
      ))}
    </div>
  )
}

export function HistoryList({ history }: { history: HistoryRow[] }) {
  if (!history.length) return <div className="text-xs text-muted-foreground">(nothing yet)</div>
  return (
    <div className="space-y-0.5 font-mono text-xs text-muted-foreground">
      {history.map(h => (
        <div key={h.id}>
          {(h.finished_at || h.started_at || '').slice(5, 16)} <b className="text-foreground">{h.ref}</b> {h.status} {h.verdict ?? ''} {h.took != null ? `${h.took}m` : ''} {h.error ? `— ${h.error.slice(0, 80)}` : ''}
        </div>
      ))}
    </div>
  )
}
