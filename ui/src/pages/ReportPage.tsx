import { ReportView } from '@/components/ReportView'
import { ThemeToggle } from '@/components/ThemeToggle'

export function ReportPage() {
  const ref = new URLSearchParams(location.search).get('ref') ?? ''
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background px-4 py-2">
        <h1 className="text-[15px] font-semibold"><a href="/">PR cockpit</a> · <span className="text-muted-foreground">report</span></h1>
        <span className="grow" />
        <ThemeToggle />
      </header>
      <div className="mx-auto max-w-[1500px] p-4">
        {ref ? <ReportView refId={ref} full /> : <div className="text-muted-foreground">no ?ref given</div>}
      </div>
    </div>
  )
}
