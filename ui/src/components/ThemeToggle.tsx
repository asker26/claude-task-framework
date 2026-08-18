import { Button } from '@/components/ui/button'
import { Moon, Sun } from 'lucide-react'

export function ThemeToggle() {
  return (
    <Button size="sm" variant="ghost" title="light / dark" onClick={() => {
      const dark = document.documentElement.classList.toggle('dark')
      localStorage.setItem('prc-theme', dark ? 'dark' : 'light')
    }}>
      <Sun className="size-3.5 dark:hidden" />
      <Moon className="hidden size-3.5 dark:inline" />
    </Button>
  )
}
