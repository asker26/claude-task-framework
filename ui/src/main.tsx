import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ToastProvider } from '@/lib/toast'
import { DialogProvider } from '@/components/ui/dialog'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ToastProvider>
      <DialogProvider>
        <App />
      </DialogProvider>
    </ToastProvider>
  </React.StrictMode>,
)
