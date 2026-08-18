import { Badge } from '@/components/ui/badge'
import type { BoardRow, StagedRow } from '@/lib/api'
import { ExternalLink } from 'lucide-react'

export function Size({ r }: { r: { changed_files: number | null; additions: number | null; deletions: number | null } }) {
  return (
    <span className="whitespace-nowrap text-muted-foreground">
      {r.changed_files ?? '?'}f <span className="text-ok">+{r.additions ?? '?'}</span>/
      <span className="text-destructive">-{r.deletions ?? '?'}</span>
    </span>
  )
}

export function GhLink({ url }: { url: string | null }) {
  if (!url) return null
  return (
    <a href={url} target="_blank" rel="noreferrer" onClick={e => e.stopPropagation()}
       className="text-muted-foreground hover:text-primary" title="open on GitHub">
      <ExternalLink className="inline size-3" />
    </a>
  )
}

export function Tags({ b }: { b: BoardRow }) {
  return (
    <span className="inline-flex gap-1 whitespace-nowrap">
      {b.stale ? <Badge variant="warn">STALE</Badge> : null}
      {b.conflicts ? <Badge variant="bad">conflicts</Badge> : null}
      {b.ci_red ? <Badge variant="bad">ci-red</Badge> : null}
      {b.checks === 'SUCCESS' && (b.status === 'approved' || b.status === 'mine') ? <Badge variant="ok">green</Badge> : null}
      {b.too_big ? <Badge>too-big</Badge> : null}
      {b.claims ? <Badge variant="ok">s:{b.claims}</Badge> : null}
    </span>
  )
}

export function statusText(b: BoardRow): string {
  if (b.status === 'staged') return `staged ${b.active_review_verdict ?? '?'}${b.active_review_behind ? ' (behind)' : ''}`
  if (b.status === 'waiting-author') return `waiting ${b.waiting_days ?? 0}d`
  if (b.status === 'approved') return b.ready ? 'ready ✓' : 'approved'
  if (b.status === 'mine') return b.ready ? 'ready ✓' : (b.review_decision || 'no-review').toLowerCase()
  return b.status
}

export function statusClass(status: string): string {
  if (status === 'staged') return 'text-primary'
  if (status === 'running') return 'text-warn'
  if (status === 're-review' || status === 'author-replied') return 'text-warn'
  if (status === 'approved') return 'text-ok'
  if (status === 'review-failed') return 'text-destructive'
  return ''
}

export function verdictBadge(v: string | null | undefined) {
  if (!v) return <Badge>?</Badge>
  if (v === 'BLOCK') return <Badge variant="bad">BLOCK</Badge>
  if (v === 'REQUEST_CHANGES') return <Badge variant="warn">REQUEST_CHANGES</Badge>
  return <Badge variant="ok">{v}</Badge>
}

export type SizedRow = BoardRow | StagedRow
