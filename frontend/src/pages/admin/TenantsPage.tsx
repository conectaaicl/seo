import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'
import { Card, Btn, Field, Select, ErrorBox, C, Badge } from '../../components/UI'

const PLAN_COLORS: Record<string, string> = { basic: C.muted, pro: '#6366f1', enterprise: '#f59e0b' }

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: '#131920', border: `1px solid ${C.border}`, borderRadius: 18,
        padding: 28, width: '100%', maxWidth: 480,
        boxShadow: '0 24px 80px rgba(0,0,0,0.5)',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const emptyForm = { name: '', email: '', domain: '', plan: 'basic', notes: '', send_invite: true, groq_api_key: '', pagespeed_api_key: '' }

export default function TenantsPage() {
  const [tenants, setTenants] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ ...emptyForm })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [newPassword, setNewPassword] = useState('')

  const load = () => get('/admin/tenants').then(setTenants).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  function openCreate() { setForm({ ...emptyForm }); setError(''); setNewPassword(''); setModal('create') }
  function openEdit(t: any) { setEditing(t); setForm({ name: t.name, email: t.email, domain: t.domain || '', plan: t.plan || 'basic', notes: t.notes || '', send_invite: false }); setError(''); setModal('edit') }

  async function save() {
    setSaving(true); setError('')
    try {
      if (modal === 'create') {
        const r = await post('/admin/tenants', { ...form, send_invite: (form as any).send_invite !== false })
        if (r.temp_password) setNewPassword(r.temp_password)
      } else if (modal === 'edit' && editing) {
        await put(`/admin/tenants/${editing.id}`, form)
        setModal(null)
      }
      load()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function toggle(id: string) {
    await post(`/admin/tenants/${id}/toggle`, {})
    load()
  }

  async function remove(id: string, name: string) {
    if (!confirm(`¿Eliminar tenant "${name}"? Esto también elimina su cuenta de usuario.`)) return
    await del(`/admin/tenants/${id}`)
    load()
  }

  async function resend(id: string) {
    const r = await post(`/admin/tenants/${id}/resend-invite`, {})
    alert(`Invitación reenviada.\nContraseña temporal: ${r.temp_password}`)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Tenants</div>
          <div style={{ fontSize: 13, color: C.muted }}>{tenants.length} clientes registrados</div>
        </div>
        <Btn onClick={openCreate}>+ Agregar tenant</Btn>
      </div>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>Cargando...</div>
        ) : tenants.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 6 }}>Sin tenants aún</div>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 20 }}>Agrega tu primer cliente para comenzar</div>
            <Btn onClick={openCreate}>+ Agregar primer tenant</Btn>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Tenant', 'Email', 'Plan', 'API Keys', 'Estado', 'Creado', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tenants.map(t => (
                  <tr key={t.id} style={{ borderBottom: `1px solid ${C.border}20` }}>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{t.name}</div>
                      {t.domain && <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{t.domain}</div>}
                    </td>
                    <td style={{ padding: '12px 12px', color: C.muted }}>{t.email}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <Badge label={t.plan?.toUpperCase()} color={PLAN_COLORS[t.plan] || C.muted} />
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: t.groq_api_key_set ? '#10b98118' : '#ffffff0a', color: t.groq_api_key_set ? '#10b981' : C.muted }}>
                          {t.groq_api_key_set ? '🔑 Groq' : '○ Groq'}
                        </span>
                        <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: t.pagespeed_api_key_set ? '#10b98118' : '#ffffff0a', color: t.pagespeed_api_key_set ? '#10b981' : C.muted }}>
                          {t.pagespeed_api_key_set ? '🔑 PSI' : '○ PSI'}
                        </span>
                      </div>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                        background: t.is_active ? '#10b98118' : '#ef444418',
                        color: t.is_active ? '#10b981' : '#ef4444',
                      }}>{t.is_active ? '● Activo' : '○ Inactivo'}</span>
                    </td>
                    <td style={{ padding: '12px 12px', color: C.muted, fontSize: 12 }}>
                      {t.created_at ? new Date(t.created_at).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn onClick={() => openEdit(t)} variant="ghost" small>✏️</Btn>
                        <Btn onClick={() => toggle(t.id)} variant="ghost" small>{t.is_active ? '⏸' : '▶'}</Btn>
                        <Btn onClick={() => resend(t.id)} variant="ghost" small title="Reenviar invitación">📧</Btn>
                        <Btn onClick={() => remove(t.id, t.name)} variant="danger" small>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Create/Edit Modal */}
      {modal && !newPassword && (
        <Modal title={modal === 'create' ? '+ Nuevo Tenant' : `Editar: ${editing?.name}`} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nombre del cliente *" value={form.name} onChange={set('name')} placeholder="Empresa SpA" />
            <Field label="Email *" value={form.email} onChange={set('email')} placeholder="contacto@empresa.cl" type="email" />
            <Field label="Dominio web" value={form.domain} onChange={set('domain')} placeholder="empresa.cl" />
            <Select label="Plan" value={form.plan} onChange={set('plan')} options={[
              { value: 'basic', label: 'Basic' },
              { value: 'pro', label: 'Pro' },
              { value: 'enterprise', label: 'Enterprise' },
            ]} />
            <Field label="Notas internas" value={form.notes} onChange={set('notes')} placeholder="Notas sobre el cliente..." rows={2} />
            <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 14 }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 10, fontWeight: 600 }}>API KEYS PROPIAS (opcional — usa la global si está vacío)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Field label="Groq API Key del tenant" value={(form as any).groq_api_key || ''} onChange={set('groq_api_key')} placeholder="gsk_••• (vacío = usa la global)" mono />
                <Field label="PageSpeed API Key del tenant" value={(form as any).pagespeed_api_key || ''} onChange={set('pagespeed_api_key')} placeholder="AIza••• (vacío = usa la global)" mono />
              </div>
            </div>
            {modal === 'create' && (
              <label style={{ display: 'flex', gap: 10, alignItems: 'center', cursor: 'pointer', padding: '10px 14px', background: C.surface, borderRadius: 8 }}>
                <input type="checkbox" checked={(form as any).send_invite !== false}
                  onChange={e => setForm(f => ({ ...f, send_invite: e.target.checked }))}
                  style={{ width: 16, height: 16, accentColor: '#6366f1' }} />
                <div>
                  <div style={{ fontSize: 13, color: '#fff', fontWeight: 500 }}>Enviar email de bienvenida</div>
                  <div style={{ fontSize: 11, color: C.muted }}>Se enviará el acceso por email automáticamente</div>
                </div>
              </label>
            )}
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Btn onClick={save} loading={saving} disabled={!form.name.trim() || !form.email.trim()}>
                {modal === 'create' ? '✓ Crear tenant' : '✓ Guardar cambios'}
              </Btn>
              <Btn onClick={() => setModal(null)} variant="ghost">Cancelar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Success with password */}
      {newPassword && (
        <Modal title="✓ Tenant creado exitosamente" onClose={() => { setNewPassword(''); setModal(null) }}>
          <div style={{ textAlign: 'center', padding: '10px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 16 }}>🎉</div>
            <div style={{ fontSize: 14, color: C.text, marginBottom: 20 }}>
              El tenant ha sido creado. Guarda estas credenciales:
            </div>
            <div style={{ background: C.surface, borderRadius: 10, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontSize: 11, color: C.muted, marginBottom: 4 }}>CONTRASEÑA TEMPORAL</div>
              <div style={{ fontSize: 20, fontWeight: 800, color: C.green, fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                {newPassword}
              </div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, marginBottom: 20 }}>
              {(form as any).send_invite !== false
                ? 'Las credenciales también fueron enviadas por email.'
                : 'No se envió email. Comparte estas credenciales manualmente.'}
            </div>
            <Btn onClick={() => { setNewPassword(''); setModal(null) }} full>Listo</Btn>
          </div>
        </Modal>
      )}
    </div>
  )
}
