import { act } from './api'
import type { useToast } from './toast'

type Toast = ReturnType<typeof useToast>

export async function runAction(toast: Toast, payload: Record<string, unknown>, refresh?: () => void) {
  toast(`… ${payload.action}${payload.ref ? ` ${payload.ref}` : ''}`)
  const r = await act(payload)
  toast(`${r.ok ? '✓' : '✗'} ${r.output}`)
  refresh?.()
  return r
}

export function queueReview(toast: Toast, ref: string, refresh?: () => void) {
  const n = prompt('Directions for the reviewer (optional — e.g. "focus on the payment flow, ignore CSS")', '')
  if (n === null) return
  void runAction(toast, { action: 'review', ref, notes: n || undefined }, refresh)
}
export function takeOver(toast: Toast, ref: string, refresh?: () => void) {
  const n = prompt('Initial directions for your interactive session (optional)', '')
  if (n === null) return
  void runAction(toast, { action: 'takeover', ref, notes: n || undefined }, refresh)
}
export function workOn(toast: Toast, ref: string, refresh?: () => void) {
  const n = prompt('What do you want to do on this PR? (optional — e.g. "fix findings 1 and 3")', '')
  if (n === null) return
  void runAction(toast, { action: 'work', ref, notes: n || undefined }, refresh)
}
