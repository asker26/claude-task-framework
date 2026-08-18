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
        <div className="fixed bottom-4 right-4 z-50 max-w-lg whitespace-pre-wrap rounded-lg border border-border bg-card p-3 font-mono text-xs shadow-lg">
          {msg}
        </div>
      )}
    </ToastCtx.Provider>
  )
}
