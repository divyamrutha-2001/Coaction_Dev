import { NavLink, useLocation } from 'react-router-dom'
import coactionLogo from '../assets/logo.png'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/api-library', label: 'API Library' },
  { to: '/download', label: 'Downloads' },
  { to: '/tags', label: 'Context Tags' },
  { to: '/access', label: 'Admin Access' },
  { to: '/usage', label: 'Usage & KPIs' },
  { to: '/trace', label: 'Trace' },
]

export default function TopNav() {
  useLocation()

  return (
    <header className="border-b" style={{ backgroundColor: '#ffffff' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img
            src={coactionLogo}
            alt="CoAction Developer Workbench"
            style={{ height: '60px', width: 'auto' }}
          />
        </div>

        <nav
          className="mr-auto flex items-center gap-2 flex-wrap justify-center"
          style={{ marginLeft: '5rem' }}
          aria-label="Primary"
        >
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              style={{ textDecoration: 'none' }}
              className={({ isActive }) =>
                `rounded px-3 py-2 text-sm font-medium ${
                  isActive ? 'bg-primary text-white' : 'text-foreground bg-card'
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-3">
          <NavLink
            to="/upload"
            style={{
              textDecoration: 'none',
              backgroundColor: '#ffffff',
              color: 'hsl(var(--primary))',
              border: '1px solid hsl(var(--primary))',
            }}
            className="inline-flex items-center gap-1.5 rounded px-3 py-2 text-sm font-semibold"
          >
            <span aria-hidden="true">↑</span> Upload API
          </NavLink>
          <div
            className="relative inline-flex items-center justify-center rounded-full font-semibold text-white"
            style={{
              width: '2.25rem',
              height: '2.25rem',
              backgroundColor: '#0f2b46',
              fontSize: '0.85rem',
            }}
            title="Signed in as Divya M."
            aria-label="Signed in as Divya M."
          >
            DM
            <span
              aria-hidden="true"
              style={{
                position: 'absolute',
                bottom: '1px',
                right: '1px',
                width: '0.6rem',
                height: '0.6rem',
                backgroundColor: '#22c55e',
                border: '2px solid #eef4f9',
                borderRadius: '9999px',
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
