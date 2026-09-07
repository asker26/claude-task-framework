import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { AgentIndicator } from '@/components/task-board/AgentIndicator'
import { useAgents } from '@/lib/api'
import { useTaskSheet } from '@/lib/task-sheet-store'
import { cn } from '@/lib/utils'
import type { AgentInstance, RunningAgentInfo } from '@/lib/types'

function formatHeartbeatAge(seconds: number | null): string {
  if (seconds == null) return 'unknown'
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  const restMinutes = minutes % 60
  return restMinutes ? `${hours}h ${restMinutes}m ago` : `${hours}h ago`
}

function toIndicatorAgent(agent: AgentInstance): RunningAgentInfo {
  return {
    id: agent.id,
    worker_name: agent.worker_name,
    status: agent.status === 'pending' ? 'pending' : 'running',
    heartbeat_age_s: agent.heartbeat_age_s,
    stuck: agent.stuck,
    tmux_pane: agent.tmux_pane,
    started_at: agent.started_at,
  }
}

/**
 * System-wide "running now" strip — one card per active (pending/running/stuck) agent
 * across every project. Clicking a card opens that agent's task in the shared
 * TaskDetailSheet (mounted once by TaskSheetProvider — see lib/task-sheet-store.tsx).
 */
export function RunningAgents({ className }: { className?: string }) {
  const { data: agents, isLoading } = useAgents()
  const { openById } = useTaskSheet()

  if (isLoading) {
    return (
      <div className={cn('flex flex-wrap gap-2', className)}>
        <Skeleton className="h-[72px] w-64 rounded-xl" />
        <Skeleton className="h-[72px] w-64 rounded-xl" />
      </div>
    )
  }

  if (!agents || agents.length === 0) {
    return <Card className="px-3 py-2 text-xs text-muted-foreground">No agents running right now.</Card>
  }

  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      {agents.map((agent) => (
        <Card
          key={agent.id}
          onClick={() => openById(agent.task_id)}
          className={cn(
            'w-64 cursor-pointer gap-1.5 py-2.5 transition-shadow hover:shadow-md',
            agent.stuck && 'ring-1 ring-red-500/40',
          )}
        >
          <div className="flex items-center justify-between gap-2 px-3">
            <AgentIndicator agent={toIndicatorAgent(agent)} />
            {agent.retry_count > 0 && (
              <span className="text-[10px] text-muted-foreground">retry {agent.retry_count}</span>
            )}
          </div>
          <div className="space-y-0.5 px-3">
            <div className="truncate text-sm font-medium" title={agent.task_title}>
              <span className="mr-1 font-mono text-[9px] text-muted-foreground">#{agent.task_id}</span>
              {agent.task_title}
            </div>
            <div className="flex items-center justify-between gap-2 text-[10px] text-muted-foreground">
              <span className="truncate">{agent.project_name ?? 'No project'}</span>
              <span className="shrink-0">heartbeat {formatHeartbeatAge(agent.heartbeat_age_s)}</span>
            </div>
          </div>
        </Card>
      ))}
    </div>
  )
}
