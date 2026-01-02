import { Outlet } from 'react-router-dom'
import { Sidebar } from '../components/Sidebar'

export default function DashboardLayout() {
  return (
    <div className="flex min-h-screen bg-white">
      <Sidebar />
      <main className="flex-1 p-8 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
