import { useMemo } from 'react'
import { ArrowLeft } from 'lucide-react'
import { Link, useParams } from 'react-router-dom'
import { useSprint } from '@/lib/api'
import { useTaskSheet } from '@/lib/task-sheet-store'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { KanbanBoard } from '@/components/task-board/KanbanBoard'
import { SprintHeader } from '@/components/sprint/SprintHeader'
import { SprintPicker } from '@/components/sprint/SprintPicker'
import type { TaskFilters } from '@/lib/types'

function parseSprintId(raw: string | undefined): number | undefined {
  return raw !== undefined && /^\d+$/.test(raw) ? Number(raw) : undefined
}

function SprintDetailMessage({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-3 p-10 text-center">
      <p className="text-sm text-muted-foreground">{text}</p>
      <Link to="/">
        <Button variant="outline" size="sm">
          Back to board
        </Button>
      </Link>
    </div>
  )
}

export function SprintDetail() {
  const { sprintId: sprintIdParam } = useParams()
  const sprintId = parseSprintId(sprintIdParam)
  const { data: sprint, isLoading, isError } = useSprint(sprintId)
  const { openById } = useTaskSheet()

  const filters = useMemo<TaskFilters>(
    () => (sprintId === undefined ? { include_done: true } : { sprint_id: sprintId, include_done: true }),
    [sprintId],
  )

  if (sprintId === undefined) {
    return <SprintDetailMessage text="Invalid sprint id." />
  }

  if (isLoading) {
    return (
      <div className="flex flex-col gap-4 p-4 md:p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (isError || !sprint) {
    return <SprintDetailMessage text="Sprint not found." />
  }

  return (
    <div className="flex flex-col gap-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link to="/">
          <Button variant="ghost" size="sm">
            <ArrowLeft />
            Board
          </Button>
        </Link>
        {sprint.project_id != null && <SprintPicker projectId={sprint.project_id} currentSprintId={sprint.id} />}
      </div>

      <SprintHeader sprint={sprint} />

      <KanbanBoard filters={filters} onTaskClick={(task) => openById(task.id)} defaultCollapsedStatuses={[]} />
    </div>
  )
}
