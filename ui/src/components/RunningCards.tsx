import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { runAction, takeOver } from '@/lib/actions'
import { useToast } from '@/lib/toast'
import { winName, type RunningRow } from '@/lib/api'
import { SquareTerminal } from 'lucide-react'

export function RunningCards({ running, refresh, openLog }: {
  running: RunningRow[]; refresh: () => void; openLog: (ref: string) => void
}) {
  const toast = useToast()
  if (!running.length) return <Card className="text-xs text-muted-foreground">worker idle — nothing running</Card>
  return (
    <div className="space-y-2">
      {running.map(r => (
        <Card key={r.id}>
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold">RUNNING</span>
            <button className="font-mono text-primary cursor-pointer" onClick={() => openLog(r.ref)}>{r.ref}</button>
            <span className="text-muted-foreground text-xs">{r.mins}m · agents {r.agents} · heartbeat {r.hb_s}s ago</span>
            <span className="grow" />
            <Button size="sm" onClick={() => { if (confirm(`Abort the running review of ${r.ref}?`)) void runAction(toast, { action: 'abort', ref: r.ref }, refresh) }}>abort</Button>
            <Button size="sm" onClick={() => takeOver(toast, r.ref, refresh)}>take over</Button>
            <a href={`/term?win=${winName('review', r.ref)}`} target="_blank" rel="noreferrer">
              <Button size="sm"><SquareTerminal className="size-3" />web term</Button>
            </a>
          </div>
          <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{r.last_action}</div>
        </Card>
      ))}
    </div>
  )
}
