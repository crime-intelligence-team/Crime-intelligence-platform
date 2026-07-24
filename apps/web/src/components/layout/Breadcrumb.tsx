import { Link, useLocation } from 'react-router-dom'
import { ChevronRight, Home } from 'lucide-react'

// Route → human label mapping
const LABELS: Record<string, string> = {
  '':           'Home',
  cases:        'Case Workspace',
  map:          'Geo Intelligence',
  district:     'Regional Dashboards',
  network:      'Network Map',
  registry:     'Node Registry',
  analytics:    'Threat Analytics',
  governance:   'Governance',
  integrity:    'Integrity Monitoring',
  audit:        'Audit Log',
  protocols:    'Policy Engine',
  directives:   'Directives',
  access:       'Access Control',
  login:        'Login',
  mfa:          'MFA Verification',
}

interface Crumb { label: string; to: string }

function buildCrumbs(pathname: string): Crumb[] {
  const segments = pathname.split('/').filter(Boolean)
  const crumbs: Crumb[] = []
  let path = ''

  for (const seg of segments) {
    path += `/${seg}`
    // Skip dynamic route IDs — they look like UUIDs or short alphanumeric codes
    const isId = /^[a-z0-9_-]{2,10}-[a-z0-9_-]+$/i.test(seg) || /^\d+$/.test(seg)
    const label = isId ? seg.toUpperCase() : (LABELS[seg] ?? seg)
    crumbs.push({ label, to: path })
  }

  return crumbs
}

export function Breadcrumb() {
  const { pathname } = useLocation()
  const crumbs = buildCrumbs(pathname)

  // Don't show breadcrumbs on the root or simple single-level routes
  if (crumbs.length <= 1) return null

  return (
    <nav
      aria-label="Breadcrumb"
      className="flex items-center gap-1 text-[11px] text-sentinel-500 overflow-hidden min-w-0"
    >
      <Link
        to="/cases"
        className="shrink-0 p-0.5 text-sentinel-500 hover:text-sentinel-300 transition-colors"
        title="Command Center"
      >
        <Home className="w-3 h-3" />
      </Link>

      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1
        return (
          <span key={crumb.to} className="flex items-center gap-1 min-w-0">
            <ChevronRight className="w-3 h-3 shrink-0 text-sentinel-600" />
            {isLast ? (
              <span className="font-medium text-sentinel-200 truncate max-w-[180px]">
                {crumb.label}
              </span>
            ) : (
              <Link
                to={crumb.to}
                className="hover:text-sentinel-200 transition-colors truncate max-w-[120px] whitespace-nowrap"
              >
                {crumb.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
