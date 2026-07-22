import { Routes, Route, Navigate } from 'react-router-dom'
import AppShell from './components/layout/AppShell'
import { ProtectedRoute, GuestOnlyRoute } from './components/auth/ProtectedRoute'

// Auth
import Login    from './pages/Login'
import MFALogin from './pages/MFALogin'

// Cases
import CaseWorkspace from './pages/CaseWorkspace'
import CaseDetail    from './pages/CaseDetail'

// Geo Intelligence
import GeoIntelligence   from './pages/GeoIntelligence'
import RegionalDashboard from './pages/RegionalDashboard'

// Network
import NetworkMap   from './pages/NetworkMap'
import NodeRegistry from './pages/NodeRegistry'

// Analytics
import ThreatAnalytics from './pages/ThreatAnalytics'

// Governance
import GovernanceSecurity   from './pages/GovernanceSecurity'
import GovernanceIntegrity  from './pages/GovernanceIntegrity'
import GovernanceAudit      from './pages/GovernanceAudit'
import GovernanceProtocols  from './pages/GovernanceProtocols'
import GovernanceDirectives from './pages/GovernanceDirectives'
import GovernanceAccess     from './pages/GovernanceAccess'

export default function App() {
  return (
    <Routes>
      {/* ── Auth routes (guests only) ────────────────────────────────── */}
      <Route element={<GuestOnlyRoute />}>
        <Route path="/login"     element={<Login />} />
        <Route path="/login/mfa" element={<MFALogin />} />
      </Route>

      {/* ── Protected app shell ──────────────────────────────────────── */}
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>

          {/* Root → cases */}
          <Route index element={<Navigate to="/cases" replace />} />

          {/* Case Workspace */}
          <Route path="/cases"     element={<CaseWorkspace />} />
          <Route path="/cases/:id" element={<CaseDetail />} />

          {/* Geo Intelligence */}
          <Route path="/map"                element={<GeoIntelligence />} />
          <Route path="/map/district/:id"   element={<RegionalDashboard />} />

          {/* Network */}
          <Route path="/network"          element={<NetworkMap />} />
          <Route path="/network/registry" element={<NodeRegistry />} />

          {/* Analytics */}
          <Route path="/analytics" element={<ThreatAnalytics />} />

          {/* Governance — all 6 sub-routes */}
          <Route path="/governance"             element={<GovernanceSecurity />} />
          <Route path="/governance/integrity"   element={<GovernanceIntegrity />} />
          <Route path="/governance/audit"       element={<GovernanceAudit />} />
          <Route path="/governance/protocols"   element={<GovernanceProtocols />} />
          <Route path="/governance/directives"  element={<GovernanceDirectives />} />
          <Route path="/governance/access"      element={<GovernanceAccess />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/cases" replace />} />
        </Route>
      </Route>

      {/* Bare / with no match → login */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
