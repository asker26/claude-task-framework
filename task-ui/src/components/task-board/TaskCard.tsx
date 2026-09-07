import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { AgentIndicator } from './AgentIndicator'
import { PriorityBadge } from './PriorityBadge'
import { STATUS_BORDER_COLOR } from './StatusBadge'
import type { Task } from '@/lib/types'

export interface TaskCardProps {
  task: Task
  onClick?: (task: Task) => void
  className?: string
}

export function TaskCard({ task, onClick, className }: TaskCardProps) {
  return (
    <Card
      className={cn(
        'cursor-pointer gap-2 border-t-2 py-3 transition-shadow hover:shadow-md',
        STATUS_BORDER_COLOR[task.status],
        className,
      )}
      onClick={() => onClick?.(task)}
    >
      <CardHeader className="gap-1 px-3">
        <span className="font-mono text-[9px] text-muted-foreground">#{task.id}</span>
        <CardTitle className="text-sm leading-snug font-medium">{task.title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 px-3">
        {(task.project_name || task.sprint_name) && (
          <div className="flex flex-wrap items-center gap-1 text-[10px] text-muted-foreground">
            {task.project_name && (
              <span className="truncate rounded-md bg-muted px-1.5 py-0.5">{task.project_name}</span>
            )}
            {task.sprint_name && (
              <span className="truncate rounded-md bg-muted px-1.5 py-0.5">{task.sprint_name}</span>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <PriorityBadge priority={task.priority} />
          <AgentIndicator agent={task.running_agent} />
        </div>
      </CardContent>
    </Card>
  )
}
