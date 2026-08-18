import { useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { termCapture, termKeys, termWindows } from '@/lib/api'
import { ThemeToggle } from '@/components/ThemeToggle'
import { cn } from '@/lib/utils'

export function TermPage() {
  const win = new URLSearchParams(location.search).get('win') ?? ''
  const [wins, setWins] = useState<string[]>([])
  const [screen, setScreen] = useState('connecting…')
  const [stat, setStat] = useState('')
  const [inp, setInp] = useState('')
  const scr = useRef<HTMLPreElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      try {
        const wl = await termWindows()
        if (!alive) return
        setWins(wl)
        if (!win) { setScreen('pick a window below (take-* and work-* are your interactive sessions)'); return }
        const c = await termCapture(win)
        if (!alive) return
        setScreen(c.text)
        setStat(c.ok ? new Date().toLocaleTimeString() : 'window gone?')
        if (stick.current && scr.current) scr.current.scrollTop = scr.current.scrollHeight
      } catch { setStat('server unreachable') }
    }
    void tick()
    const t = setInterval(tick, 1000)
    return () => { alive = false; clearInterval(t) }
  }, [win])

  const send = async () => { if (win) { await termKeys({ win, text: inp }); setInp('') } }
  const key = (k: string) => { if (win) void termKeys({ win, special: k }) }

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center gap-3 border-b border-border bg-background px-4 py-2">
        <h1 className="text-[15px] font-semibold"><a href="/">PR cockpit</a> · <span className="text-muted-foreground">terminal</span> <b>{win}</b></h1>
        <span className="grow" />
        <span className="text-xs text-muted-foreground">{stat}</span>
        <ThemeToggle />
      </header>
      <div className="flex flex-wrap gap-3 px-4 pt-2 text-xs">
        {wins.map(w => (
          <a key={w} href={`/term?win=${encodeURIComponent(w)}`} className={cn('text-primary hover:underline', w === win && 'font-bold')}>{w}</a>
        ))}
      </div>
      <pre ref={scr} onScroll={() => { const el = scr.current!; stick.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 30 }}
           className="mx-4 mt-2 grow overflow-y-auto whitespace-pre-wrap rounded-lg border border-border bg-term p-2.5 font-mono text-xs leading-[1.35] text-[oklch(0.87_0.01_255)]">
        {screen}
      </pre>
      <div className="flex gap-2 p-4">
        <Input value={inp} onChange={e => setInp(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); void send() } }}
               placeholder="type to the session — Enter sends (claude sees it as your message)" autoFocus />
        <Button variant="default" onClick={() => void send()}>Send</Button>
        <Button onClick={() => key('Esc')}>Esc</Button>
        <Button onClick={() => key('C-c')}>Ctrl-C</Button>
        <Button onClick={() => key('Enter')}>Enter</Button>
        <Button onClick={() => key('Up')}>↑</Button>
        <Button onClick={() => key('Down')}>↓</Button>
        <Button onClick={() => key('Tab')}>Tab</Button>
      </div>
    </div>
  )
}
