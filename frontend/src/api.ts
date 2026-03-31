const BASE = import.meta.env.VITE_API_URL || 'http://localhost:8009'

function getToken() {
  return localStorage.getItem('seo_token') || ''
}

function authHeaders() {
  const token = getToken()
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

async function handleResponse(r: Response) {
  if (r.status === 401) {
    localStorage.removeItem('seo_token')
    localStorage.removeItem('seo_user')
    window.location.reload()
    throw new Error('Sesión expirada')
  }
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: r.statusText }))
    throw new Error(err.detail || 'Error en la solicitud')
  }
  return r.json()
}

export async function post(path: string, body: any) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse(r)
}

export async function get(path: string) {
  const r = await fetch(`${BASE}${path}`, { headers: authHeaders() })
  return handleResponse(r)
}

export async function put(path: string, body: any) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'PUT',
    headers: authHeaders(),
    body: JSON.stringify(body),
  })
  return handleResponse(r)
}

export async function del(path: string) {
  const r = await fetch(`${BASE}${path}`, {
    method: 'DELETE',
    headers: authHeaders(),
  })
  return handleResponse(r)
}

export async function login(email: string, password: string) {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse(r)
}
