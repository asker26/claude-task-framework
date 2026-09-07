import { useCallback, useMemo, useRef, useState } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useTasksInfinite } from '@/lib/api'
import { useInfiniteScrollSentinel } from '@/hooks/use-infinite-scroll'
import { STATUS_BORDER_COLOR, STATUS_LABEL, STATUS_ORDER } from './StatusBadge'
import { TaskCard } from './TaskCard'
import type { Task, TaskFilters, TaskStatus } from '@/lib/types'

const COLUMN_PAGE_SIZE = 30

interface KanbanColumnProps {
  status: TaskStatus
  filters: TaskFilters
  collapsed: boolean
  onToggle: () => void
  onTaskClick?: (task: Task) => void
}

function KanbanColumn({ status, filters, collapsed, onToggle, onTaskClick }: KanbanColumnProps) {
  const columnFilters = useMemo<TaskFilters>(() => ({ ...filters, status }), [filters, status])
  // Collapsed columns fetch limit=1 (cheapest possible page) purely to learn `total` for the
  // header badge — they never load the row list until expanded.
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useTasksInfinite(
    columnFilters,
    collapsed ? 1 : COLUMN_PAGE_SIZE,
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useInfiniteScrollSentinel(scrollRef, sentinelRef, handleLoadMore, !collapsed)

  const tasks = useMemo(() => data?.pages.flatMap((p) => p.tasks) ?? [], [data])
  const total = data?.pages[0]?.total

  return (
    <div className={cn('flex shrink-0 flex-col rounded-lg border bg-muted/20', collapsed ? 'w-12' : 'w-72')}>
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          'flex items-center gap-1.5 border-b-2 px-3 py-2 text-left text-xs font-medium',
          STATUS_BORDER_COLOR[status],
        )}
      >
        {collapsed ? <ChevronRight className="size-3.5 shrink-0" /> : <ChevronDown className="size-3.5 shrink-0" />}
        {!collapsed && <span className="flex-1 truncate">{STATUS_LABEL[status]}</span>}
        <span className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] text-muted-foreground">
          {total ?? '·'}
        </span>
      </button>
      {!collapsed && (
        <div ref={scrollRef} className="flex flex-col gap-2 overflow-y-auto p-2" style={{ maxHeight: '75vh' }}>
          {isLoading && (
            <>
              <div className="h-24 shrink-0 animate-pulse rounded-lg bg-muted" />
              <div className="h-24 shrink-0 animate-pulse rounded-lg bg-muted" />
            </>
          )}
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} onClick={onTaskClick} />
          ))}
          {!isLoading && tasks.length === 0 && (
            <p className="py-6 text-center text-xs text-muted-foreground">No tasks</p>
          )}
          <div ref={sentinelRef} className="h-px shrink-0" />
          {isFetchingNextPage && (
            <Loader2 className="mx-auto size-4 shrink-0 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  )
}

export interface KanbanBoardProps {
  filters: TaskFilters
  onTaskClick?: (task: Task) => void
  /** Statuses whose column starts collapsed. Uncontrolled after mount — pass a fresh
   *  value per route (the board collapses done/paused, a sprint page collapses none). */
  defaultCollapsedStatuses?: TaskStatus[]
  className?: string
}

export function KanbanBoard({ filters, onTaskClick, defaultCollapsedStatuses = [], className }: KanbanBoardProps) {
  const [collapsed, setCollapsed] = useState<Set<TaskStatus>>(() => new Set(defaultCollapsedStatuses))

  function toggle(status: TaskStatus) {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(status)) next.delete(status)
      else next.add(status)
      return next
    })
  }

  return (
    <div className={cn('flex w-full gap-3 overflow-x-auto pb-2', className)}>
      {STATUS_ORDER.map((status) => (
        <KanbanColumn
          key={status}
          status={status}
          filters={filters}
          collapsed={collapsed.has(status)}
          onToggle={() => toggle(status)}
          onTaskClick={onTaskClick}
        />
      ))}
    </div>
  )
}
