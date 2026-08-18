export interface BoardRow {
  repo: string; number: number; ref: string; title: string | null; author: string | null
  url: string | null; status: string; stale: number; ready: number; conflicts: number
  ci_red: number; too_big: number; age_days: number | null; waiting_days: number | null
  checks: string | null; review_decision: string | null; claims: string | null
  active_review_verdict: string | null; active_review_behind: number
  additions: number | null; deletions: number | null; changed_files: number | null
}
export interface RunningRow {
  id: number; ref: string; mins: number; hb_s: number; agents: number; last_action: string
}
export interface QueueRow { id: number; ref: string; mins: number; attempts: number }
export interface StagedRow {
  id: number; ref: string; title: string | null; url: string | null; verdict: string | null
  behind: number; mins_ago: number; author: string | null
  additions: number | null; deletions: number | null; changed_files: number | null
}
export interface HistoryRow {
  id: number; ref: string; status: string; verdict: string | null; attempts: number
  error: string | null; started_at: string | null; finished_at: string | null; took: number | null
}
export interface SessionRow {
  id: string; label: string | null; kind: string; repo: string | null; cwd: string | null
  last_seen_at: string; claims: string | null
}
export interface Ticket { jira_key: string; title: string | null; url: string | null; created_at: string }
export interface FindingDiscard { fkey: string; excerpt: string | null; view: string }
export interface State {
  org: string; now: string; synced_min: number | null; worker: string; worker_running: boolean
  model: string; running: RunningRow[]; queue: QueueRow[]; staged: StagedRow[]
  board: BoardRow[]; history: HistoryRow[]; sessions: SessionRow[]
}
export interface Report {
  error?: string; id?: number; ref: string; status?: string; verdict?: string | null
  head_sha?: string; pr_head?: string; behind?: boolean; report_path?: string
  finished_at?: string; title?: string | null; url?: string | null; author?: string | null
  html?: string; has_optimized?: boolean; view?: string; tickets?: Ticket[]; discards?: FindingDiscard[]
}

export async function getState(): Promise<State> {
  const r = await fetch('/api/state')
  if (!r.ok) throw new Error(`state ${r.status}`)
  return r.json()
}
export async function getReport(ref: string, view?: string): Promise<Report> {
  const r = await fetch(`/api/report?ref=${encodeURIComponent(ref)}${view ? `&view=${view}` : ''}`)
  return r.json()
}
export async function getLog(ref: string): Promise<string> {
  const r = await fetch(`/api/log?ref=${encodeURIComponent(ref)}`)
  return r.text()
}
export async function act(payload: Record<string, unknown>): Promise<{ ok: boolean; output: string }> {
  const r = await fetch('/api/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  return r.json()
}
export const termWindows = async (): Promise<string[]> => (await fetch('/api/term/windows')).json()
export async function termCapture(win: string): Promise<{ ok: boolean; text: string }> {
  const r = await fetch(`/api/term/capture?win=${encodeURIComponent(win)}`)
  return { ok: r.ok, text: await r.text() }
}
export const termKeys = (payload: Record<string, unknown>) =>
  fetch('/api/term/keys', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })

export const winName = (prefix: 'review' | 'work' | 'take', ref: string) =>
  `${prefix}-${ref.replace(/[.#]/g, '-')}`
