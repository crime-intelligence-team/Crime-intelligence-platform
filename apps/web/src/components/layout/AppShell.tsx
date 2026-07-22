import { Outlet, useLocation } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import { GovernanceSubNav } from './GovernanceSubNav'

export default function AppShell() {
  const { pathname } = useLocation()
  const isGovernance = pathname.startsWith('/governance')

  return (
    <div className="flex h-screen overflow-hidden bg-surface-base">
      <Sidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <TopBar />
        {isGovernance && <GovernanceSubNav />}
        <main className="flex-1 overflow-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
