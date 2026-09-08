import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { ProgressBar } from './ProgressBar'
import type { Sprint, SprintStatus } from '@/lib/types'

export const SPRINT_STATUS_LABEL: Record<SprintStatus, string> = {
  planned: 'Planned',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

export const SPRINT_STATUS_COLOR: Record<SprintStatus, string> = {
  planned: 'bg-slate-500/15 text-slate-700 dark:text-slate-400',
  active: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  completed: 'bg-green-500/15 text-green-700 dark:text-green-400',
  cancelled: 'bg-red-500/15 text-red-700 dark:text-red-400',
}

export function SprintStatusBadge({ status, className }: { status: SprintStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium',
        SPRINT_STATUS_COLOR[status],
        className,
      )}
    >
      {SPRINT_STATUS_LABEL[status]}
    </span>
  )
}

export interface SprintHeaderProps {
  sprint: Sprint
  className?: string
}

export function SprintHeader({ sprint, className }: SprintHeaderProps) {
  return (
    <Card className={cn(className)}>
      <CardHeader className="gap-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg leading-tight font-semibold">{sprint.name}</h1>
          <SprintStatusBadge status={sprint.status} />
        </div>
        {sprint.project_name && <p className="text-sm text-muted-foreground">{sprint.project_name}</p>}
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {sprint.goal && <p className="text-sm">{sprint.goal}</p>}
        <ProgressBar done={sprint.done} total={sprint.total} />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>Start {sprint.start_date ?? '—'}</span>
          <span>End {sprint.end_date ?? '—'}</span>
        </div>
      </CardContent>
    </Card>
  )
}
