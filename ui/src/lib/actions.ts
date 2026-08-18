import { act } from './api'
import { useToast } from './toast'
import { useDialogs } from '@/components/ui/dialog'

export function useActions() {
  const toast = useToast()
  const { confirmDlg, promptDlg } = useDialogs()

  const run = async (payload: Record<string, unknown>, refresh?: () => void) => {
    toast(`… ${payload.action}${payload.ref ? ` ${payload.ref}` : ''}`)
    const r = await act(payload)
    toast(`${r.ok ? '✓' : '✗'} ${r.output}`)
    refresh?.()
    return r
  }

  return {
    run,
    confirmDlg,
    promptDlg,
    queueReview: async (ref: string, refresh?: () => void) => {
      const n = await promptDlg({
        title: `Queue review — ${ref}`,
        description: 'Directions for the reviewer (optional). They override the default review focus.',
        placeholder: 'e.g. focus on the payment flow, ignore CSS',
        optional: true,
      })
      if (n === null) return
      void run({ action: 'review', ref, notes: n || undefined }, refresh)
    },
    takeOver: async (ref: string, refresh?: () => void) => {
      const n = await promptDlg({
        title: `Take over the review — ${ref}`,
        description: 'Opens an interactive session (tmux + Terminal) running reviewer-ultra that follows your directions.',
        placeholder: 'initial directions (optional)',
        optional: true,
      })
      if (n === null) return
      void run({ action: 'takeover', ref, notes: n || undefined }, refresh)
    },
    workOn: async (ref: string, refresh?: () => void) => {
      const n = await promptDlg({
        title: `Work on ${ref}`,
        description: 'Opens an interactive session on the PR branch in a dedicated worktree.',
        placeholder: 'e.g. fix findings 1 and 3, rename the endpoint',
        optional: true,
      })
      if (n === null) return
      void run({ action: 'work', ref, notes: n || undefined }, refresh)
    },
  }
}
