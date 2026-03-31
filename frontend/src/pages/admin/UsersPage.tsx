import { useState, useEffect } from 'react'
import { get, post, put, del } from '../../api'
import { Card, Btn, Field, Select, ErrorBox, C, Badge } from '../../components/UI'

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: '#131920', border: `1px solid ${C.border}`, borderRadius: 18, padding: 28, width: '100%', maxWidth: 440, boxShadow: '0 24px 80px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{title}</div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: C.muted, cursor: 'pointer', fontSize: 18 }}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const ROLE_COLORS: Record<string, string> = { admin: '#f59e0b', user: '#6366f1' }

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [modal, setModal] = useState<'create' | 'edit' | null>(null)
  const [editing, setEditing] = useState<any>(null)
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = () => get('/admin/users').then(setUsers).finally(() => setLoading(false))
  useEffect(() => { load() }, [])
  const set = (k: string) => (v: string) => setForm(f => ({ ...f, [k]: v }))

  function openCreate() { setForm({ name: '', email: '', password: '', role: 'user' }); setError(''); setModal('create') }
  function openEdit(u: any) { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role }); setError(''); setModal('edit') }

  async function save() {
    setSaving(true); setError('')
    try {
      if (modal === 'create') {
        await post('/admin/users', form)
      } else if (modal === 'edit' && editing) {
        const body: any = { name: form.name, role: form.role }
        if (form.password) body.password = form.password
        await put(`/admin/users/${editing.id}`, body)
      }
      setModal(null); load()
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  async function toggle(id: string) {
    try { await post(`/admin/users/${id}/toggle`, {}); load() }
    catch (e: any) { alert(e.message) }
  }

  async function remove(id: string, email: string) {
    if (!confirm(`¿Eliminar usuario "${email}"?`)) return
    try { await del(`/admin/users/${id}`); load() }
    catch (e: any) { alert(e.message) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>Usuarios</div>
          <div style={{ fontSize: 13, color: C.muted }}>{users.length} usuarios registrados</div>
        </div>
        <Btn onClick={openCreate}>+ Crear usuario</Btn>
      </div>

      <Card>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: C.muted }}>Cargando...</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                  {['Usuario', 'Rol', 'Estado', 'Último acceso', 'Creado', 'Acciones'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: C.muted, fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: `1px solid ${C.border}20` }}>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 600, color: '#fff' }}>{u.name || '—'}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <Badge label={u.role.toUpperCase()} color={ROLE_COLORS[u.role] || C.muted} />
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, background: u.is_active ? '#10b98118' : '#ef444418', color: u.is_active ? '#10b981' : '#ef4444' }}>
                        {u.is_active ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px', color: C.muted, fontSize: 12 }}>
                      {u.last_login ? new Date(u.last_login).toLocaleDateString('es-CL') : 'Nunca'}
                    </td>
                    <td style={{ padding: '12px 12px', color: C.muted, fontSize: 12 }}>
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('es-CL') : '—'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <Btn onClick={() => openEdit(u)} variant="ghost" small>✏️</Btn>
                        <Btn onClick={() => toggle(u.id)} variant="ghost" small>{u.is_active ? '⏸' : '▶'}</Btn>
                        <Btn onClick={() => remove(u.id, u.email)} variant="danger" small>🗑</Btn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal && (
        <Modal title={modal === 'create' ? '+ Nuevo Usuario' : `Editar: ${editing?.email}`} onClose={() => setModal(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field label="Nombre completo" value={form.name} onChange={set('name')} placeholder="Juan Pérez" />
            <Field label="Email *" value={form.email} onChange={set('email')} placeholder="usuario@empresa.cl" type="email" />
            <Field
              label={modal === 'create' ? 'Contraseña *' : 'Nueva contraseña (dejar vacío para no cambiar)'}
              value={form.password} onChange={set('password')} placeholder="••••••••" type="password"
            />
            <Select label="Rol" value={form.role} onChange={set('role')} options={[
              { value: 'user', label: 'Usuario' },
              { value: 'admin', label: 'Administrador' },
            ]} />
            {error && <ErrorBox msg={error} />}
            <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
              <Btn onClick={save} loading={saving} disabled={!form.email.trim() || (modal === 'create' && !form.password.trim())}>
                {modal === 'create' ? '✓ Crear usuario' : '✓ Guardar cambios'}
              </Btn>
              <Btn onClick={() => setModal(null)} variant="ghost">Cancelar</Btn>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
