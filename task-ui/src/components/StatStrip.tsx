import { useTasks } from '@/lib/api'
import { cn } from '@/lib/utils'
import type { TaskFilters } from '@/lib/types'

function useTaskCount(filters: TaskFilters) {
  const { data, isLoading } = useTasks(filters)
  return { count: data?.total ?? 0, isLoading }
}

function Stat({
  label,
  value,
  isLoading,
  tone,
}: {
  label: string
  value: number
  isLoading: boolean
  tone: string
}) {
  return (
    <div className="rounded-lg border border-border bg-card px-3 py-1.5">
      <div className={cn('text-lg leading-6 font-semibold', tone)}>{isLoading ? '—' : value}</div>
      <div className="text-[10px] whitespace-nowrap text-muted-foreground uppercase tracking-wider">{label}</div>
    </div>
  )
}

/**
 * System-wide header counts. Each stat reads only `total` from a limit=1 useTasks() query
 * (never a full task list) — /api/tasks' agent_state filter covers running/stuck the same
 * way status covers paused/in-review, so all four go through the one thin hook.
 */
export function StatStrip({ className }: { className?: string }) {
  const paused = useTaskCount({ status: 'paused' })
  const inReview = useTaskCount({ status: 'in-review' })
  const running = useTaskCount({ agent_state: 'running' })
  const stuck = useTaskCount({ agent_state: 'stuck' })

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      <Stat
        label="paused"
        value={paused.count}
        isLoading={paused.isLoading}
        tone={paused.count ? 'text-orange-700 dark:text-orange-400' : 'text-green-600 dark:text-green-400'}
      />
      <Stat
        label="in review"
        value={inReview.count}
        isLoading={inReview.isLoading}
        tone="text-purple-700 dark:text-purple-400"
      />
      <Stat
        label="running"
        value={running.count}
        isLoading={running.isLoading}
        tone="text-green-700 dark:text-green-400"
      />
      <Stat
        label="stuck"
        value={stuck.count}
        isLoading={stuck.isLoading}
        tone={stuck.count ? 'text-red-700 dark:text-red-400' : 'text-green-600 dark:text-green-400'}
      />
    </div>
  )
}
