export type TaskStatus =
  | 'todo'
  | 'in-progress'
  | 'in-review'
  | 'approved'
  | 'testing'
  | 'done'
  | 'paused'

export type TaskType = 'feature' | 'bug' | 'research' | 'video' | 'release' | 'other'
export type TaskPriority = 'high' | 'medium' | 'low'
export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled'
export type AgentRunStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
export type AgentState = 'running' | 'stuck'

export interface Project {
  id: number
  name: string
  org_id: number | null
  org_name: string | null
  github_repo: string | null
  local_path: string | null
  description: string | null
  task_count: number
  open_task_count: number
  active_sprint_id: number | null
  active_sprint_name: string | null
}

export interface Sprint {
  id: number
  name: string
  project_id: number | null
  project_name: string | null
  goal: string | null
  status: SprintStatus
  start_date: string | null
  end_date: string | null
  done: number
  total: number
}

export interface SprintDetail extends Sprint {
  tasks: Task[]
}

/**
 * Denormalized "who's actively working this right now", inlined onto a task by
 * scripts/task-serve. Present only while the task's most recent agent attempt is
 * still pending/running — `stuck` mirrors agent-watcher's exact predicate
 * (status='running' AND heartbeat older than CTF_STUCK_TIMEOUT).
 */
export interface RunningAgentInfo {
  id: number
  worker_name: string
  status: Extract<AgentRunStatus, 'pending' | 'running'>
  heartbeat_age_s: number | null
  stuck: boolean
  tmux_pane: string | null
  started_at: string
}

export interface Task {
  id: number
  title: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  project_id: number | null
  project_name: string | null
  sprint_id: number | null
  sprint_name: string | null
  parent_task_id: number | null
  due_date: string | null
  depends_on: number[]
  /**
   * Schema FK to agent_profiles.id, but ~1000 of 1696 live rows hold a
   * datetime string here instead (a pre-existing data bug, not a task-serve
   * issue — confirmed via direct DB inspection). Never trust this for
   * identity/lookup; use assigned_agent_name (or TaskDetail.assigned_agent,
   * which the server already resolves and nulls out safely) instead.
   */
  assigned_agent_id: number | null
  assigned_agent_name: string | null
  created_at: string
  /**
   * NULL for 923 of 1696 live rows (pre-existing data gap, not a task-serve bug) and,
   * for ~26 more, a stray small integer (e.g. 1, 7) instead of a datetime string — some
   * unrelated historical write clobbered this column. Never assume it parses; always
   * check typeof/null before formatting as a date.
   */
  updated_at: string | null
  running_agent: RunningAgentInfo | null
}

export interface AgentProfile {
  id: number
  name: string
  role: string
}

export interface RelatedTask {
  id: number
  title: string
  status: TaskStatus
}

/** Raw `agents` table row, as returned in TaskDetail.agent_history (desc by id — most recent first). */
export interface AgentHistoryEntry {
  id: number
  task_id: number
  worker_name: string
  status: AgentRunStatus
  cli_session_id: string | null
  tmux_pane: string | null
  pid: number | null
  retry_count: number
  result: string | null
  heartbeat_at: string | null
  started_at: string | null
  completed_at: string | null
  created_at: string
  profile_id: number | null
}

export interface StatusHistoryEntry {
  from_status: TaskStatus | null
  to_status: TaskStatus
  changed_at: string
}

export interface TaskDetail {
  id: number
  title: string
  type: TaskType
  status: TaskStatus
  priority: TaskPriority
  project_id: number | null
  parent_task_id: number | null
  notes: string | null
  due_date: string | null
  depends_on: number[]
  acceptance_criteria: string | null
  assigned_agent_id: number | null
  created_at: string
  /** Same gotcha as Task.updated_at — null or a stray non-date integer for a real minority of rows. */
  updated_at: string | null
  sprint_id: number | null
  project: { id: number; name: string } | null
  sprint: { id: number; name: string } | null
  assigned_agent: AgentProfile | null
  parent: RelatedTask | null
  subtasks: RelatedTask[]
  depends_on_tasks: RelatedTask[]
  running_agent: RunningAgentInfo | null
  agent_history: AgentHistoryEntry[]
  status_history: StatusHistoryEntry[]
}

/** A row from GET /api/agents — one pending/running agent, denormalized with its task + project. */
export interface AgentInstance {
  id: number
  task_id: number
  task_title: string
  project_name: string | null
  worker_name: string
  status: AgentRunStatus
  heartbeat_age_s: number | null
  stuck: boolean
  started_at: string
  retry_count: number
  tmux_pane: string | null
}

/** Raw shape of GET /api/tasks — paginated, not a bare array. */
export interface TaskListResponse {
  tasks: Task[]
  next_cursor: number | null
  total: number
}

export type TaskFilters = {
  project_id?: number
  org_id?: number
  sprint_id?: number
  status?: TaskStatus
  priority?: TaskPriority
  q?: string
  due_date_from?: string
  due_date_to?: string
  agent_state?: AgentState
  include_done?: boolean
}
