import { useState, useEffect } from 'react'
import LoginPage from './pages/LoginPage'
import AuditPage from './pages/AuditPage'
import KeywordsPage from './pages/KeywordsPage'
import GeneratorPage from './pages/GeneratorPage'
import AdsPage from './pages/AdsPage'
import CompetitorPage from './pages/CompetitorPage'
import CalendarPage from './pages/CalendarPage'
import ReportPage from './pages/ReportPage'
import PageSpeedPage from './pages/PageSpeedPage'
import MySettingsPage from './pages/MySettingsPage'
import SearchConsolePage from './pages/SearchConsolePage'
import RankTrackingPage from './pages/RankTrackingPage'
import DashboardPage from './pages/admin/DashboardPage'
import TenantsPage from './pages/admin/TenantsPage'
import UsersPage from './pages/admin/UsersPage'
import SettingsPage from './pages/admin/SettingsPage'

const C = {
  bg: '#080b10', sidebar: '#0d1117', card: '#131920',
  border: 'rgba(255,255,255,0.06)', accent: '#6366f1',
  green: '#10b981', text: '#e2e8f0', muted: '#64748b',
  orange: '#f59e0b', red: '#ef4444', blue: '#3b82f6',
}

const SEO_TABS = [
  { id: 'audit', label: 'Auditoría SEO', icon: '🔍', desc: 'Analiza cualquier URL' },
  { id: 'pagespeed', label: 'Core Web Vitals', icon: '⚡', desc: 'Velocidad y rendimiento' },
  { id: 'keywords', label: 'Keywords', icon: '🎯', desc: 'Investigación de palabras clave' },
  { id: 'generator', label: 'Generador IA', icon: '✨', desc: 'Meta, Blog, Fichas, Landing' },
  { id: 'ads', label: 'Google & Meta Ads', icon: '📢', desc: 'Campañas SEM completas' },
  { id: 'competitor', label: 'Competencia', icon: '🕵️', desc: 'Analiza a tus competidores' },
  { id: 'calendar', label: 'Calendario', icon: '📅', desc: 'Plan editorial SEO' },
  { id: 'report', label: 'Informe PDF', icon: '📊', desc: 'Reporte profesional cliente' },
  { id: 'gsc', label: 'Search Console', icon: '📊', desc: 'Keywords y posiciones reales' },
  { id: 'rank', label: 'Rank Tracking', icon: '📈', desc: 'Monitoreo de posiciones diario' },
  { id: 'my-settings', label: 'Mis API Keys', icon: '🔑', desc: 'Configura tus claves propias' },
]

const ADMIN_TABS = [
  { id: 'admin-dashboard', label: 'Dashboard', icon: '🏠' },
  { id: 'admin-tenants', label: 'Tenants', icon: '🏢' },
  { id: 'admin-users', label: 'Usuarios', icon: '👤' },
  { id: 'admin-settings', label: 'Configuración', icon: '⚙️' },
]

function NavBtn({ icon, label, active, onClick }: { icon: string; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '9px 10px', borderRadius: 9, border: 'none', cursor: 'pointer', width: '100%',
      background: active ? 'rgba(99,102,241,0.15)' : 'transparent',
      color: active ? '#818cf8' : C.muted,
      outline: active ? '1px solid rgba(99,102,241,0.3)' : 'none',
      textAlign: 'left', transition: 'all 0.15s',
    }}>
      <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: active ? 600 : 400 }}>{label}</span>
    </button>
  )
}

export default function App() {
  const [user, setUser] = useState<any>(() => {
    try { return JSON.parse(localStorage.getItem('seo_user') || 'null') } catch { return null }
  })
  const [tab, setTab] = useState(() => {
    const p = new URLSearchParams(window.location.search)
    return p.get('tab') || 'audit'
  })
  const [mode, setMode] = useState<'app' | 'admin'>('app')

  // If admin, default to admin panel
  useEffect(() => {
    if (user?.role === 'admin') setMode('admin')
  }, [user])

  const isAdmin = user?.role === 'admin'
  const currentTab = mode === 'admin' ? tab || 'admin-dashboard' : tab

  function handleLogin(u: any, _token: string) {
    setUser(u)
    if (u.role === 'admin') { setMode('admin'); setTab('admin-dashboard') }
    else { setMode('app'); setTab('audit') }
  }

  function logout() {
    localStorage.removeItem('seo_token')
    localStorage.removeItem('seo_user')
    setUser(null)
  }

  if (!user) return <LoginPage onLogin={handleLogin} />

  const allTabs = mode === 'admin' ? ADMIN_TABS : SEO_TABS
  const activeTabInfo = (mode === 'admin' ? ADMIN_TABS : SEO_TABS).find(t => t.id === currentTab)
    ?? (mode === 'admin' ? ADMIN_TABS[0] : SEO_TABS[0])

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: C.bg }}>
      {/* Sidebar */}
      <aside style={{
        width: 240, flexShrink: 0, background: C.sidebar,
        borderRight: `1px solid ${C.border}`,
        display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh',
      }}>
        {/* Logo */}
        <div style={{ padding: '20px 18px 16px', borderBottom: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
            }}>🚀</div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: '#fff', letterSpacing: '-0.3px' }}>SEO UltraPRO</div>
              <div style={{ fontSize: 10, color: C.muted }}>by ConectaAI</div>
            </div>
          </div>
        </div>

        {/* Mode switcher (admin only) */}
        {isAdmin && (
          <div style={{ padding: '10px 10px 0' }}>
            <div style={{ display: 'flex', gap: 4, background: C.bg, borderRadius: 9, padding: 4 }}>
              {([['app', '🔧 SEO Tools'], ['admin', '⚙️ Admin']] as const).map(([m, label]) => (
                <button key={m} onClick={() => { setMode(m); setTab(m === 'admin' ? 'admin-dashboard' : 'audit') }} style={{
                  flex: 1, padding: '6px 4px', borderRadius: 6, border: 'none', cursor: 'pointer',
                  background: mode === m ? 'rgba(99,102,241,0.2)' : 'transparent',
                  color: mode === m ? '#818cf8' : C.muted, fontSize: 11, fontWeight: 600,
                }}>{label}</button>
              ))}
            </div>
          </div>
        )}

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto' }}>
          {allTabs.map(t => (
            <NavBtn key={t.id} icon={t.icon} label={t.label} active={currentTab === t.id} onClick={() => setTab(t.id)} />
          ))}
        </nav>

        {/* User info + logout */}
        <div style={{ padding: '12px 14px', borderTop: `1px solid ${C.border}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
              background: 'linear-gradient(135deg,#6366f1,#8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 700, color: '#fff',
            }}>
              {(user.name || user.email).charAt(0).toUpperCase()}
            </div>
            <div style={{ overflow: 'hidden' }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {user.name || user.email}
              </div>
              <div style={{ fontSize: 10, color: isAdmin ? '#f59e0b' : C.muted, textTransform: 'uppercase', fontWeight: 600 }}>
                {user.role}
              </div>
            </div>
          </div>
          <button onClick={logout} style={{
            width: '100%', padding: '7px', borderRadius: 8, border: `1px solid ${C.border}`,
            background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 12, fontWeight: 500,
          }}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'auto' }}>
        {/* Header */}
        <div style={{
          padding: '20px 32px 16px', borderBottom: `1px solid ${C.border}`,
          background: C.sidebar, position: 'sticky', top: 0, zIndex: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 22 }}>{activeTabInfo.icon}</span>
            <div>
              <h1 style={{ fontSize: 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.3px' }}>{activeTabInfo.label}</h1>
              {'desc' in activeTabInfo && <p style={{ fontSize: 12, color: C.muted, marginTop: 1 }}>{(activeTabInfo as any).desc}</p>}
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: '28px 32px', maxWidth: mode === 'admin' ? 1200 : 1100, margin: '0 auto' }}>
          {/* SEO Tools */}
          {mode === 'app' && (
            <>
              {tab === 'audit' && <AuditPage />}
              {tab === 'pagespeed' && <PageSpeedPage />}
              {tab === 'keywords' && <KeywordsPage />}
              {tab === 'generator' && <GeneratorPage />}
              {tab === 'ads' && <AdsPage />}
              {tab === 'competitor' && <CompetitorPage />}
              {tab === 'calendar' && <CalendarPage />}
              {tab === 'report' && <ReportPage />}
              {tab === 'gsc' && <SearchConsolePage />}
              {tab === 'rank' && <RankTrackingPage />}
              {tab === 'my-settings' && <MySettingsPage />}
            </>
          )}
          {/* Admin Panel */}
          {mode === 'admin' && (
            <>
              {tab === 'admin-dashboard' && <DashboardPage />}
              {tab === 'admin-tenants' && <TenantsPage />}
              {tab === 'admin-users' && <UsersPage />}
              {tab === 'admin-settings' && <SettingsPage />}
            </>
          )}
        </div>
      </main>
    </div>
  )
}
