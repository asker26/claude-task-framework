import { cn } from '@/lib/utils'
import type { TaskStatus } from '@/lib/types'

export const STATUS_LABEL: Record<TaskStatus, string> = {
  'todo': 'Todo',
  'in-progress': 'In Progress',
  'in-review': 'In Review',
  'approved': 'Approved',
  'testing': 'Testing',
  'paused': 'Paused',
  'done': 'Done',
}

export const STATUS_COLOR: Record<TaskStatus, string> = {
  'todo': 'bg-slate-500/15 text-slate-700 dark:text-slate-400',
  'in-progress': 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  'in-review': 'bg-purple-500/15 text-purple-700 dark:text-purple-400',
  'approved': 'bg-teal-500/15 text-teal-700 dark:text-teal-400',
  'testing': 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400',
  'paused': 'bg-orange-500/15 text-orange-700 dark:text-orange-400',
  'done': 'bg-green-500/15 text-green-700 dark:text-green-400',
}

export const STATUS_BORDER_COLOR: Record<TaskStatus, string> = {
  'todo': 'border-t-slate-400',
  'in-progress': 'border-t-blue-400',
  'in-review': 'border-t-purple-400',
  'approved': 'border-t-teal-400',
  'testing': 'border-t-cyan-400',
  'paused': 'border-t-orange-400',
  'done': 'border-t-green-400',
}

/** Column/list order used across the app — matches scripts/task-serve's sprint_detail ORDER BY. */
export const STATUS_ORDER: TaskStatus[] = [
  'in-progress',
  'todo',
  'in-review',
  'approved',
  'testing',
  'paused',
  'done',
]

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium',
        STATUS_COLOR[status],
        className,
      )}
    >
      {STATUS_LABEL[status]}
    </span>
  )
}
