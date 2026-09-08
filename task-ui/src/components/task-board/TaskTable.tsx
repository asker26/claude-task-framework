import { useCallback, useMemo, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2 } from 'lucide-react'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { cn, fmt, fmtDate } from '@/lib/utils'
import { useTasksInfinite } from '@/lib/api'
import { useInfiniteScrollSentinel } from '@/hooks/use-infinite-scroll'
import { AgentIndicator } from './AgentIndicator'
import { PriorityBadge } from './PriorityBadge'
import { StatusBadge } from './StatusBadge'
import type { Task, TaskFilters } from '@/lib/types'

type SortKey = 'id' | 'title' | 'project_name' | 'sprint_name' | 'status' | 'priority' | 'agent' | 'updated_at'
type SortDir = 'asc' | 'desc'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'id', label: 'ID' },
  { key: 'title', label: 'Title' },
  { key: 'project_name', label: 'Project' },
  { key: 'sprint_name', label: 'Sprint' },
  { key: 'status', label: 'Status' },
  { key: 'priority', label: 'Priority' },
  { key: 'agent', label: 'Agent' },
  { key: 'updated_at', label: 'Updated' },
]

const PRIORITY_WEIGHT: Record<Task['priority'], number> = { high: 0, medium: 1, low: 2 }
const STATUS_WEIGHT: Record<Task['status'], number> = {
  'in-progress': 0,
  'todo': 1,
  'in-review': 2,
  'approved': 3,
  'testing': 4,
  'paused': 5,
  'done': 6,
}

function compare(a: Task, b: Task, key: SortKey): number {
  switch (key) {
    case 'id':
      return a.id - b.id
    case 'priority':
      return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
    case 'status':
      return STATUS_WEIGHT[a.status] - STATUS_WEIGHT[b.status]
    case 'agent':
      return (a.running_agent?.worker_name ?? '').localeCompare(b.running_agent?.worker_name ?? '')
    default: {
      const av = a[key]
      const bv = b[key]
      if (av == null && bv == null) return 0
      if (av == null) return 1
      if (bv == null) return -1
      return String(av).localeCompare(String(bv))
    }
  }
}

/**
 * updated_at is null for most rows and, for a real few, a stray non-date integer
 * (see Task['updated_at'] doc) — always verify it's a parseable string before formatting.
 */
function formatUpdated(value: Task['updated_at']): string {
  if (typeof value !== 'string') return '—'
  const parsed = new Date(value)
  return isNaN(parsed.getTime()) ? '—' : fmtDate(value)
}

const TABLE_PAGE_SIZE = 30

export interface TaskTableProps {
  filters: TaskFilters
  onTaskClick?: (task: Task) => void
  className?: string
}

export function TaskTable({ filters, onTaskClick, className }: TaskTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('updated_at')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useTasksInfinite(
    filters,
    TABLE_PAGE_SIZE,
  )

  const scrollRef = useRef<HTMLDivElement>(null)
  const sentinelRef = useRef<HTMLDivElement>(null)
  const handleLoadMore = useCallback(() => {
    if (hasNextPage && !isFetchingNextPage) fetchNextPage()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])
  useInfiniteScrollSentinel(scrollRef, sentinelRef, handleLoadMore)

  const tasks = useMemo(() => data?.pages.flatMap((p) => p.tasks) ?? [], [data])

  const sorted = useMemo(() => {
    const dir = sortDir === 'asc' ? 1 : -1
    return [...tasks].sort((a, b) => compare(a, b, sortKey) * dir)
  }, [tasks, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  return (
    <div
      ref={scrollRef}
      className={cn('w-full overflow-y-auto rounded-lg border', className)}
      style={{ maxHeight: '75vh' }}
    >
      <Table>
        <TableHeader className="sticky top-0 z-10 bg-background">
          <TableRow>
            {COLUMNS.map((col) => (
              <TableHead key={col.key}>
                <button
                  type="button"
                  onClick={() => toggleSort(col.key)}
                  className="inline-flex items-center gap-1 hover:text-foreground"
                >
                  {col.label}
                  {sortKey === col.key ? (
                    sortDir === 'asc' ? (
                      <ArrowUp className="size-3" />
                    ) : (
                      <ArrowDown className="size-3" />
                    )
                  ) : (
                    <ArrowUpDown className="size-3 opacity-30" />
                  )}
                </button>
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sorted.map((task) => (
            <TableRow key={task.id} className="cursor-pointer" onClick={() => onTaskClick?.(task)}>
              <TableCell className="font-mono text-xs text-muted-foreground">{task.id}</TableCell>
              <TableCell className="max-w-xs truncate font-medium">{task.title}</TableCell>
              <TableCell className="text-muted-foreground">{task.project_name ?? '—'}</TableCell>
              <TableCell className="text-muted-foreground">{task.sprint_name ?? '—'}</TableCell>
              <TableCell>
                <StatusBadge status={task.status} />
              </TableCell>
              <TableCell>
                <PriorityBadge priority={task.priority} />
              </TableCell>
              <TableCell>
                <AgentIndicator agent={task.running_agent} />
              </TableCell>
              <TableCell
                className="text-xs text-muted-foreground"
                title={typeof task.updated_at === 'string' ? fmt(task.updated_at) : undefined}
              >
                {formatUpdated(task.updated_at)}
              </TableCell>
            </TableRow>
          ))}
          {!isLoading && sorted.length === 0 && (
            <TableRow>
              <TableCell colSpan={COLUMNS.length} className="py-8 text-center text-sm text-muted-foreground">
                No tasks.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
      <div ref={sentinelRef} className="h-px" />
      {(isLoading || isFetchingNextPage) && (
        <div className="flex justify-center py-3">
          <Loader2 className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
