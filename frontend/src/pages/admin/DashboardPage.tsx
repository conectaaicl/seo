import { useState, useEffect } from 'react'
import { get } from '../../api'
import { Card, C } from '../../components/UI'

function StatCard({ icon, label, value, color, sub }: { icon: string; label: string; value: any; color: string; sub?: string }) {
  return (
    <Card style={{ padding: '20px 24px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 11, color: C.muted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{value}</div>
          {sub && <div style={{ fontSize: 12, color: C.muted, marginTop: 6 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28, opacity: 0.8 }}>{icon}</div>
      </div>
    </Card>
  )
}

function StatusBadge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px',
      background: ok ? '#10b98110' : '#ef444410',
      border: `1px solid ${ok ? '#10b98130' : '#ef444430'}`,
      borderRadius: 10,
    }}>
      <div style={{ width: 8, height: 8, borderRadius: '50%', background: ok ? '#10b981' : '#ef4444', flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: ok ? '#10b981' : '#ef4444' }}>{label}</div>
        <div style={{ fontSize: 11, color: C.muted }}>{ok ? 'Configurado y activo' : 'No configurado'}</div>
      </div>
    </div>
  )
}

export default function DashboardPage() {
  const [stats, setStats] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    get('/admin/stats').then(setStats).finally(() => setLoading(false))
  }, [])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 300 }}>
      <div style={{ color: C.muted, fontSize: 14 }}>Cargando...</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Dashboard</div>
        <div style={{ fontSize: 13, color: C.muted }}>Resumen del sistema SEO UltraPRO</div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14 }}>
        <StatCard icon="🏢" label="Tenants totales" value={stats?.total_tenants ?? 0} color='#6366f1' sub={`${stats?.active_tenants ?? 0} activos`} />
        <StatCard icon="👤" label="Usuarios totales" value={stats?.total_users ?? 0} color={C.green} sub={`${stats?.active_users ?? 0} activos`} />
        <StatCard icon="🤖" label="IA Groq" value={stats?.groq_configured ? 'Activo' : 'Inactivo'} color={stats?.groq_configured ? C.green : '#ef4444'} />
        <StatCard icon="⚡" label="PageSpeed API" value={stats?.pagespeed_configured ? 'Activo' : 'Público'} color={stats?.pagespeed_configured ? C.green : C.orange} />
      </div>

      {/* Services status */}
      <Card>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>Estado de servicios</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
          <StatusBadge ok={stats?.groq_configured} label="API Groq (IA)" />
          <StatusBadge ok={stats?.pagespeed_configured} label="Google PageSpeed API" />
          <StatusBadge ok={stats?.smtp_configured} label="Email SMTP" />
        </div>
      </Card>

      {/* Quick guide */}
      <Card style={{ background: 'rgba(99,102,241,0.06)', borderColor: 'rgba(99,102,241,0.25)' }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 16 }}>🚀 Guía de inicio rápido</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { done: stats?.groq_configured, text: 'Configura tu clave de API Groq en Configuración → API Keys' },
            { done: stats?.smtp_configured, text: 'Configura el servidor SMTP para enviar emails a tus clientes' },
            { done: (stats?.total_tenants ?? 0) > 0, text: 'Agrega tu primer tenant (cliente) en la sección Tenants' },
          ].map((step, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              <div style={{
                width: 22, height: 22, borderRadius: '50%', flexShrink: 0, marginTop: 1,
                background: step.done ? '#10b981' : C.surface,
                border: `2px solid ${step.done ? '#10b981' : C.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 11, color: step.done ? '#fff' : C.muted, fontWeight: 700,
              }}>
                {step.done ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: 13, color: step.done ? C.muted : C.text, textDecoration: step.done ? 'line-through' : 'none', paddingTop: 2 }}>
                {step.text}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}
