import { Route, Routes } from 'react-router-dom'
import { TaskSheetProvider } from '@/lib/task-sheet-store'
import { AppLayout } from '@/components/AppLayout'
import { Board } from '@/pages/Board'
import { SprintDetail } from '@/pages/SprintDetail'

export default function App() {
  return (
    <TaskSheetProvider>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<Board />} />
          <Route path="/sprints/:sprintId" element={<SprintDetail />} />
        </Route>
      </Routes>
    </TaskSheetProvider>
  )
}
