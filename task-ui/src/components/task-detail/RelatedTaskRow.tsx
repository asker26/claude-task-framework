import { StatusBadge } from '@/components/task-board/StatusBadge'
import type { RelatedTask } from '@/lib/types'

export interface RelatedTaskRowProps {
  task: RelatedTask
  onClick?: (task: RelatedTask) => void
}

export function RelatedTaskRow({ task, onClick }: RelatedTaskRowProps) {
  return (
    <button
      type="button"
      onClick={() => onClick?.(task)}
      className="flex w-full items-center gap-2 rounded-md border px-3 py-1.5 text-left text-sm transition-colors hover:border-primary/30 hover:bg-muted/50"
    >
      <span className="shrink-0 font-mono text-xs text-muted-foreground">#{task.id}</span>
      <span className="flex-1 truncate">{task.title}</span>
      <StatusBadge status={task.status} />
    </button>
  )
}
