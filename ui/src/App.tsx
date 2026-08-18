import { Cockpit } from '@/pages/Cockpit'
import { ReportPage } from '@/pages/ReportPage'
import { TermPage } from '@/pages/TermPage'

export default function App() {
  const path = location.pathname
  if (path === '/report') return <ReportPage />
  if (path === '/term') return <TermPage />
  return <Cockpit />
}
