import { cn } from '@/lib/utils'
import type { TaskPriority } from '@/lib/types'

const PRIORITY_LABEL: Record<TaskPriority, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

const PRIORITY_COLOR: Record<TaskPriority, string> = {
  high: 'bg-red-500/15 text-red-700 dark:text-red-400',
  medium: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
  low: 'bg-gray-500/15 text-gray-600 dark:text-gray-400',
}

export function PriorityBadge({ priority, className }: { priority: TaskPriority; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex items-center whitespace-nowrap rounded-md px-1.5 py-0.5 text-[10px] font-medium',
        PRIORITY_COLOR[priority],
        className,
      )}
    >
      {PRIORITY_LABEL[priority]}
    </span>
  )
}
