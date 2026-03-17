import { NavLink, useLocation } from 'react-router-dom'
import {
  IconBuildingSkyscraper,
  IconChartHistogram,
  IconCoin,
  IconCreditCardPay,
  IconLayoutDashboard,
  IconSettings,
  IconServer,
  IconServer2,
  IconWallet,
} from '@tabler/icons-react'

const menuItems = [
  { to: '/dashboard', label: 'Дашборд', icon: IconLayoutDashboard },
  { to: '/vps', label: 'VPS', icon: IconServer },
  { to: '/tariffs', label: 'Активные тарифы', icon: IconServer2 },
  { to: '/providers', label: 'Хостеры', icon: IconBuildingSkyscraper },
  { to: '/accounts', label: 'Аккаунты хостеров', icon: IconWallet },
  { to: '/payments', label: 'Платежи', icon: IconCreditCardPay },
  { to: '/balance', label: 'Баланс и списания', icon: IconCoin },
  { to: '/reports', label: 'Отчёты', icon: IconChartHistogram },
  { to: '/settings', label: 'Настройки', icon: IconSettings },
]

export function AppLayout({ children }) {
  const location = useLocation()

  return (
    <div className="page">
      <aside className="navbar navbar-vertical navbar-expand-lg app-sidebar" data-bs-theme="dark">
        <div className="container-fluid">
          <h1 className="navbar-brand navbar-brand-autodark my-3 text-white">VPS Tracker</h1>
          <div className="collapse navbar-collapse show">
            <ul className="navbar-nav pt-lg-3">
              {menuItems.map((item) => (
                <li className="nav-item" key={item.to}>
                  <NavLink
                    to={item.to}
                    className={`nav-link ${
                      location.pathname === item.to ? 'active' : ''
                    }`}
                  >
                    <span className="nav-link-icon d-md-none d-lg-inline-block">
                      <item.icon size={18} stroke={1.75} />
                    </span>
                    <span className="nav-link-title">{item.label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </aside>

      <div className="page-wrapper">
        <div className="d-lg-none border-bottom bg-white">
          <div className="container-fluid py-2">
            <div className="mobile-nav-scroll">
              <div className="nav nav-pills nav-sm flex-nowrap">
                {menuItems.map((item) => {
                  const Icon = item.icon
                  return (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={`nav-link ${location.pathname === item.to ? 'active' : ''}`}
                    >
                      <Icon size={16} className="me-1" />
                      {item.label}
                    </NavLink>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
        <div className="page-body">
          <div className="container-fluid">{children}</div>
        </div>
      </div>
    </div>
  )
}
