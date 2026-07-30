import { NavLink, useLocation } from 'react-router-dom'
import coactionLogo from '../assets/image.png'

const NAV_ITEMS = [
  { to: '/', label: 'Dashboard' },
  { to: '/api-library', label: 'API Library' },
  { to: '/download', label: 'Download API' },
  { to: '/tags', label: 'Context Tags' },
  { to: '/access', label: 'Secure Access' },
  { to: '/usage', label: 'Usage & KPIs' },
]

export default function TopNav() {
  useLocation()

  return (
    <header className="border-b" style={{ backgroundColor: '#eef4f9' }}>
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <img src={coactionLogo} alt="CoAction" className="h-10 w-auto" />
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
            style={{ textDecoration: 'none' }}
            className="rounded bg-primary px-3 py-2 text-sm font-medium text-white"
          >
            ⬆ Upload API
          </NavLink>
          <div style={{ textAlign: 'right' }}>
            <div className="text-sm font-semibold text-foreground">Divya M.</div>
            <div className="text-xs text-muted">divyamrutha2001@gmail.com</div>
          </div>
        </div>
      </div>
    </header>
  )
}
