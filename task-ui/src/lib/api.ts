import { useInfiniteQuery, useQuery } from '@tanstack/react-query'
import type {
  AgentInstance,
  AgentState,
  Project,
  Sprint,
  SprintDetail,
  TaskDetail,
  TaskFilters,
  TaskListResponse,
} from './types'

const POLL_MS = 10_000

async function apiFetch<T>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) {
    let message = res.statusText
    try {
      const body = await res.json()
      if (body && typeof body.error === 'string') message = body.error
    } catch {}
    throw new Error(`${res.status} ${message}`)
  }
  return res.json() as Promise<T>
}

function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue
    search.set(key, value === true ? '1' : String(value))
  }
  const s = search.toString()
  return s ? `?${s}` : ''
}

export function useProjects() {
  return useQuery({
    queryKey: ['projects'],
    queryFn: () => apiFetch<Project[]>('/api/projects'),
    refetchInterval: POLL_MS,
  })
}

export function useSprints(projectId?: number) {
  return useQuery({
    queryKey: ['sprints', projectId ?? null],
    queryFn: () => apiFetch<Sprint[]>(`/api/sprints${toQuery({ project_id: projectId })}`),
    refetchInterval: POLL_MS,
  })
}

export function useSprint(id: number | null | undefined) {
  return useQuery({
    queryKey: ['sprint', id ?? null],
    queryFn: () => apiFetch<SprintDetail>(`/api/sprints/${id}`),
    enabled: id != null,
    refetchInterval: POLL_MS,
  })
}

/**
 * Thin single-page fetch exposing only `total` — for count-only consumers (e.g. StatStrip)
 * that must never fetch a full list just to display a number. For a scrollable list of
 * tasks, use useTasksInfinite instead.
 */
export function useTasks(filters: TaskFilters = {}, limit = 1) {
  return useQuery({
    queryKey: ['tasks', filters, limit],
    queryFn: () => apiFetch<TaskListResponse>(`/api/tasks${toQuery({ ...filters, limit })}`),
    refetchInterval: POLL_MS,
  })
}

const TASKS_PAGE_SIZE = 30

/** Paginated task list for anything that renders a scrollable list of tasks (TaskTable, KanbanBoard). */
export function useTasksInfinite(filters: TaskFilters = {}, limit = TASKS_PAGE_SIZE) {
  return useInfiniteQuery({
    queryKey: ['tasks-infinite', filters, limit],
    queryFn: ({ pageParam }: { pageParam: number | undefined }) =>
      apiFetch<TaskListResponse>(`/api/tasks${toQuery({ ...filters, limit, cursor: pageParam })}`),
    initialPageParam: undefined as number | undefined,
    getNextPageParam: (lastPage) => lastPage.next_cursor ?? undefined,
    refetchInterval: POLL_MS,
  })
}

export function useTask(id: number | null | undefined) {
  return useQuery({
    queryKey: ['task', id ?? null],
    queryFn: () => apiFetch<TaskDetail>(`/api/tasks/${id}`),
    enabled: id != null,
    refetchInterval: POLL_MS,
  })
}

export function useAgents(state?: AgentState) {
  return useQuery({
    queryKey: ['agents', state ?? null],
    queryFn: () => apiFetch<AgentInstance[]>(`/api/agents${toQuery({ state })}`),
    refetchInterval: POLL_MS,
  })
}
