import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useActions } from '@/lib/actions'
import { winName, type RunningRow } from '@/lib/api'
import { SquareTerminal, OctagonX, Hand } from 'lucide-react'

export function RunningCards({ running, refresh, openLog }: {
  running: RunningRow[]; refresh: () => void; openLog: (ref: string) => void
}) {
  const A = useActions()
  if (!running.length) {
    return <Card className="text-xs text-muted-foreground">worker idle — nothing running</Card>
  }
  return (
    <div className="space-y-2">
      {running.map(r => (
        <Card key={r.id} className="border-warn/30">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-warn">
              <span className="size-2 rounded-full bg-warn motion-safe:animate-[pulse-dot_1.6s_ease-in-out_infinite]" />
              running
            </span>
            <button className="cursor-pointer font-mono text-primary hover:underline" onClick={() => openLog(r.ref)}>{r.ref}</button>
            <span className="text-xs text-muted-foreground">{r.mins}m · {r.agents} agents · heartbeat {r.hb_s}s ago</span>
            <span className="grow" />
            <Button size="sm" onClick={async () => {
              if (await A.confirmDlg({ title: `Abort the running review of ${r.ref}?`, body: 'The session is killed and not requeued.', confirmText: 'Abort', destructive: true }))
                void A.run({ action: 'abort', ref: r.ref }, refresh)
            }}><OctagonX className="size-3" />abort</Button>
            <Button size="sm" onClick={() => void A.takeOver(r.ref, refresh)}><Hand className="size-3" />take over</Button>
            <a href={`/term?win=${winName('review', r.ref)}&ref=${encodeURIComponent(r.ref)}`} target="_blank" rel="noreferrer">
              <Button size="sm"><SquareTerminal className="size-3" />web term</Button>
            </a>
          </div>
          <div className="mt-1.5 truncate rounded-md bg-muted/60 px-2 py-1 font-mono text-xs text-muted-foreground">{r.last_action || '…'}</div>
        </Card>
      ))}
    </div>
  )
}
