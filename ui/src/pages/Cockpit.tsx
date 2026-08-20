import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { RunningCards } from '@/components/RunningCards'
import { StagedTable } from '@/components/StagedTable'
import { BoardSection } from '@/components/BoardTable'
import { HistoryList, QueueList, SessionsList } from '@/components/SideLists'
import { ReportView } from '@/components/ReportView'
import { getState, type State } from '@/lib/api'
import { useActions } from '@/lib/actions'
import { ThemeToggle } from '@/components/ThemeToggle'
import { GitPullRequest, RefreshCw, Play, Square } from 'lucide-react'

function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-1.5 mt-5 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">{children}</h2>
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-1.5">
      <div className={`text-lg font-semibold leading-6 ${tone ?? ''}`}>{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  )
}

export function Cockpit() {
  const A = useActions()
  const [s, setS] = useState<State | null>(null)
  const [err, setErr] = useState(false)
  const [sel, setSel] = useState<string | null>(null)

  const refresh = useCallback(() => {
    getState().then(x => { setS(x); setErr(false) }).catch(() => setErr(true))
  }, [])
  useEffect(() => { refresh(); const t = setInterval(refresh, 10000); return () => clearInterval(t) }, [refresh])

  const by = (statuses: string[]) => (s?.board ?? []).filter(b => statuses.includes(b.status))
  const open = (ref: string) => setSel(ref)
  const needsYou = by(['review-failed', 're-review', 'author-replied', 'needs-review'])

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-border bg-background px-4 py-2">
        <h1 className="inline-flex items-center gap-2 text-[15px] font-semibold">
          <span className="rounded-md bg-primary/15 p-1 text-primary"><GitPullRequest className="size-4" /></span>
          PR cockpit <span className="text-muted-foreground">· {s?.org ?? '…'}</span>
        </h1>
        <span className="text-xs text-muted-foreground">
          {err ? 'server unreachable' : s ? `synced ${s.synced_min ?? '?'}m ago · worker: ${s.worker} · model ${s.model}` : 'loading…'}
        </span>
        <span className="grow" />
        <ThemeToggle />
        <Button size="sm" onClick={() => void A.run({ action: 'sync' }, refresh)}><RefreshCw className="size-3" />Sync</Button>
        <Button size="sm" onClick={() => void A.run({ action: 'worker', mode: s?.worker_running ? 'stop' : 'start' }, refresh)}>
          {s?.worker_running ? <Square className="size-3" /> : <Play className="size-3" />}
          {s?.worker_running ? 'Stop worker' : 'Start worker'}
        </Button>
        <Button size="sm" onClick={() => void A.run({ action: 'worker', mode: 'start-queue' }, refresh)}>Queue-only</Button>
        <span className="text-xs text-muted-foreground">{s?.now ?? ''}</span>
      </header>

      <main className={sel ? 'grid grid-cols-1 xl:grid-cols-2' : 'block'}>
        <section className={sel ? 'border-r border-border p-4 overflow-auto' : 'p-4'}>
          {s && (
            <div className="mb-3 flex flex-wrap gap-2">
              <Stat label="needs you" value={needsYou.length} tone={needsYou.length ? 'text-warn' : 'text-ok'} />
              <Stat label="running" value={s.running.length} />
              <Stat label="staged" value={s.staged.length} tone={s.staged.length ? 'text-primary' : ''} />
              <Stat label="waiting author" value={by(['waiting-author', 'commented']).length} />
              <Stat label="open PRs" value={s.board.length} />
            </div>
          )}
          {s && <RunningCards running={s.running} refresh={refresh} openLog={open} />}
          <H2>Staged — read &amp; post</H2>
          {s && <StagedTable staged={s.staged} sel={sel} open={open} />}
          <H2>Queue</H2>
          {s && <QueueList queue={s.queue} refresh={refresh} />}
          {s && (
            <>
              <BoardSection title="Needs you" rows={by(['review-failed', 're-review', 'author-replied', 'needs-review'])} sel={sel} open={open} refresh={refresh} />
              <BoardSection title="Waiting on author" rows={by(['waiting-author', 'commented'])} sel={sel} open={open} refresh={refresh} />
              <BoardSection title="Approved" rows={by(['approved'])} sel={sel} open={open} refresh={refresh} />
              <BoardSection title="Mine" rows={by(['mine'])} sel={sel} open={open} refresh={refresh} />
              <BoardSection title="Skipped" rows={by(['skipped'])} sel={sel} open={open} refresh={refresh} />
              <BoardSection title="Drafts" rows={by(['draft'])} sel={sel} open={open} refresh={refresh} />
            </>
          )}
          <H2>Sessions</H2>
          {s && <SessionsList sessions={s.sessions} />}
          <H2>Last 48h</H2>
          {s && <HistoryList history={s.history} />}
        </section>
        {sel && (
          <section className="sticky top-[41px] max-h-[calc(100vh-41px)] overflow-auto p-4">
            <ReportView refId={sel} onClose={() => setSel(null)} refresh={refresh} />
          </section>
        )}
      </main>
    </div>
  )
}
