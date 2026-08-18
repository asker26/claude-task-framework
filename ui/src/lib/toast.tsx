import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react'

const ToastCtx = createContext<(msg: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState<string | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout>>()
  const toast = useCallback((m: string) => {
    setMsg(m)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setMsg(null), 7000)
  }, [])
  return (
    <ToastCtx.Provider value={toast}>
      {children}
      {msg && (
        <div role="status" aria-live="polite"
             className={`fixed bottom-4 right-4 z-50 max-w-lg whitespace-pre-wrap rounded-lg border bg-card p-3 pl-3.5 font-mono text-xs shadow-xl motion-safe:animate-[toast-in_0.18s_ease-out] ${msg.startsWith('✗') ? 'border-destructive/50' : msg.startsWith('✓') ? 'border-ok/50' : 'border-border'}`}>
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
