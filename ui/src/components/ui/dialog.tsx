import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { AlertTriangle } from 'lucide-react'

interface ConfirmOpts {
  title: string
  body?: string
  confirmText?: string
  destructive?: boolean
}
interface PromptOpts {
  title: string
  description?: string
  defaultValue?: string
  placeholder?: string
  multiline?: boolean
  submitText?: string
  optional?: boolean
}
interface Dialogs {
  confirmDlg: (o: ConfirmOpts) => Promise<boolean>
  promptDlg: (o: PromptOpts) => Promise<string | null>
}

const DialogCtx = createContext<Dialogs>({
  confirmDlg: async () => false,
  promptDlg: async () => null,
})
export const useDialogs = () => useContext(DialogCtx)

type Pending =
  | { kind: 'confirm'; opts: ConfirmOpts; resolve: (v: boolean) => void }
  | { kind: 'prompt'; opts: PromptOpts; resolve: (v: string | null) => void }

export function DialogProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<Pending | null>(null)
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const confirmDlg = useCallback((opts: ConfirmOpts) =>
    new Promise<boolean>(resolve => setPending({ kind: 'confirm', opts, resolve })), [])
  const promptDlg = useCallback((opts: PromptOpts) =>
    new Promise<string | null>(resolve => {
      setValue(opts.defaultValue ?? '')
      setPending({ kind: 'prompt', opts, resolve })
    }), [])

  const close = useCallback((result: boolean | string | null) => {
    if (!pending) return
    if (pending.kind === 'confirm') pending.resolve(result === true)
    else pending.resolve(typeof result === 'string' ? result : null)
    setPending(null)
  }, [pending])

  useEffect(() => {
    if (!pending) return
    const el = pending.kind === 'prompt' ? (pending.opts.multiline ? taRef.current : inputRef.current) : null
    setTimeout(() => el?.focus(), 30)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close(null) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pending, close])

  return (
    <DialogCtx.Provider value={{ confirmDlg, promptDlg }}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[100] flex items-start justify-center bg-black/55 p-4 pt-[18vh]"
             onMouseDown={e => { if (e.target === e.currentTarget) close(null) }}>
          <div role="dialog" aria-modal="true" aria-label={pending.opts.title}
               className="w-full max-w-md rounded-xl border border-border bg-card p-4 shadow-2xl motion-safe:animate-[dlg_0.15s_ease-out]">
            <div className="flex items-start gap-2.5">
              {pending.kind === 'confirm' && pending.opts.destructive && (
                <span className="mt-0.5 rounded-md bg-destructive/15 p-1.5 text-destructive"><AlertTriangle className="size-4" /></span>
              )}
              <div className="min-w-0 grow">
                <h3 className="text-sm font-semibold">{pending.opts.title}</h3>
                {pending.kind === 'confirm' && pending.opts.body && (
                  <p className="mt-1 whitespace-pre-wrap text-xs text-muted-foreground">{pending.opts.body}</p>
                )}
                {pending.kind === 'prompt' && (
                  <>
                    {pending.opts.description && <p className="mt-1 text-xs text-muted-foreground">{pending.opts.description}</p>}
                    {pending.opts.multiline ? (
                      <textarea ref={taRef} value={value} onChange={e => setValue(e.target.value)}
                        placeholder={pending.opts.placeholder} rows={3}
                        onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) close(value) }}
                        className="mt-2.5 w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-primary/50" />
                    ) : (
                      <Input ref={inputRef} value={value} onChange={e => setValue(e.target.value)}
                        placeholder={pending.opts.placeholder} className="mt-2.5 bg-background"
                        onKeyDown={e => { if (e.key === 'Enter') close(value) }} />
                    )}
                  </>
                )}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => close(null)}>Cancel</Button>
              {pending.kind === 'confirm' ? (
                <Button size="sm" variant={pending.opts.destructive ? 'destructive' : 'default'} autoFocus
                        onClick={() => close(true)}>
                  {pending.opts.confirmText ?? 'Confirm'}
                </Button>
              ) : (
                <Button size="sm" variant="default" onClick={() => close(value)}>
                  {pending.opts.submitText ?? (pending.opts.optional && !value ? 'Skip & go' : 'OK')}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </DialogCtx.Provider>
  )
}
