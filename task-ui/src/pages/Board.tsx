import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useProjects, useSprints } from '@/lib/api'
import { useTaskSheet } from '@/lib/task-sheet-store'
import { Skeleton } from '@/components/ui/skeleton'
import { RunningAgents } from '@/components/RunningAgents'
import { BoardFilters } from '@/components/task-board/BoardFilters'
import { BoardViewToggle, useBoardView } from '@/components/task-board/BoardViewToggle'
import { KanbanBoard } from '@/components/task-board/KanbanBoard'
import { TaskTable } from '@/components/task-board/TaskTable'
import type { TaskFilters, TaskPriority, TaskStatus } from '@/lib/types'

const DEFAULT_COLLAPSED: TaskStatus[] = ['done', 'paused']

function parseId(searchParams: URLSearchParams, key: string): number | undefined {
  const raw = searchParams.get(key)
  return raw !== null && /^\d+$/.test(raw) ? Number(raw) : undefined
}

export function Board() {
  const [searchParams] = useSearchParams()
  const { openById } = useTaskSheet()
  const [view] = useBoardView()

  const { data: projects = [], isSuccess: projectsLoaded } = useProjects()

  const orgId = parseId(searchParams, 'org_id')
  const projectId = parseId(searchParams, 'project_id')
  const sprintId = parseId(searchParams, 'sprint_id')
  const status = (searchParams.get('status') as TaskStatus | null) ?? undefined
  const priority = (searchParams.get('priority') as TaskPriority | null) ?? undefined
  const q = searchParams.get('q') ?? undefined
  const dueFrom = searchParams.get('due_date_from') ?? undefined
  const dueTo = searchParams.get('due_date_to') ?? undefined
  const includeDone = searchParams.get('include_done') === '1'

  const { data: sprints = [] } = useSprints(projectId)

  // BoardFilters writes the org default into the URL as soon as projects load; until then,
  // filters stays null so the table/kanban below never fires a request with no org scope —
  // the exact "unfiltered board" behavior that prompted this requirement.
  const filters = useMemo<TaskFilters | null>(() => {
    if (orgId === undefined) return null
    return {
      org_id: orgId,
      project_id: projectId,
      sprint_id: sprintId,
      status,
      priority,
      q,
      due_date_from: dueFrom,
      due_date_to: dueTo,
      ...(includeDone ? { include_done: true } : {}),
    }
  }, [orgId, projectId, sprintId, status, priority, q, dueFrom, dueTo, includeDone])

  const hasOrgs = projects.some((p) => p.org_id != null)

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <RunningAgents />

      <div className="flex flex-wrap items-end justify-between gap-3">
        <BoardFilters projects={projects} sprints={sprints} className="flex-1" />
        <BoardViewToggle />
      </div>

      {filters === null ? (
        projectsLoaded && !hasOrgs ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No organizations found — create one with scripts/taskctl add-org.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )
      ) : view === 'kanban' ? (
        <KanbanBoard
          filters={filters}
          onTaskClick={(task) => openById(task.id)}
          defaultCollapsedStatuses={DEFAULT_COLLAPSED}
        />
      ) : (
        <TaskTable filters={filters} onTaskClick={(task) => openById(task.id)} />
      )}
    </div>
  )
}
