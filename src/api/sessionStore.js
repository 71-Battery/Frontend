import { normalizeProfile } from './profileMapper.js'

export const SESSION_STORAGE_KEY = 'gsm-compass.auth-session.v1'

const SESSION_VERSION = 1
const MAX_STORED_SESSION_LENGTH = 32_768
const MAX_TOKEN_LENGTH = 8_192

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function getSessionStorage(storage) {
  if (storage) return storage
  try {
    return globalThis.sessionStorage || null
  } catch {
    return null
  }
}

function hasStableIdentity(user) {
  return isRecord(user) && [
    user.id,
    user.studentId,
    user.studentNumber,
    user.email,
    user.schoolEmail,
  ].some((value) => value !== undefined && value !== null && String(value).trim())
}

function normalizeMeta(meta) {
  if (!isRecord(meta)) return {}
  return {
    source: typeof meta.source === 'string' ? meta.source : undefined,
    profileSource: typeof meta.profileSource === 'string' ? meta.profileSource : undefined,
    fallback: meta.fallback === true,
    stale: meta.stale === true,
  }
}

function normalizeSession(session) {
  if (!isRecord(session) || !hasStableIdentity(session.user)) return null

  const token = typeof session.token === 'string' ? session.token.trim() : ''
  const user = normalizeProfile(session.user)
  const isDemo = user.dataSource === 'demo'
  if ((!isDemo && !token) || token.length > MAX_TOKEN_LENGTH) return null

  return {
    user,
    token,
    permissions: {
      canManageContent: session.permissions?.canManageContent === true,
    },
    meta: normalizeMeta(session.meta),
  }
}

export function saveSession(session, storage) {
  const target = getSessionStorage(storage)
  const normalized = normalizeSession(session)
  if (!target || !normalized) {
    clearSession(storage)
    return false
  }

  try {
    target.setItem(SESSION_STORAGE_KEY, JSON.stringify({
      version: SESSION_VERSION,
      ...normalized,
    }))
    return true
  } catch {
    return false
  }
}

export function readSession(storage) {
  const target = getSessionStorage(storage)
  if (!target) return null

  try {
    const raw = target.getItem(SESSION_STORAGE_KEY)
    if (!raw || raw.length > MAX_STORED_SESSION_LENGTH) {
      if (raw) target.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    const parsed = JSON.parse(raw)
    if (parsed?.version !== SESSION_VERSION) {
      target.removeItem(SESSION_STORAGE_KEY)
      return null
    }

    const normalized = normalizeSession(parsed)
    if (!normalized) target.removeItem(SESSION_STORAGE_KEY)
    return normalized
  } catch {
    try {
      target.removeItem(SESSION_STORAGE_KEY)
    } catch {
      // Storage can be blocked by the browser. Treat it as unavailable.
    }
    return null
  }
}

export function clearSession(storage) {
  const target = getSessionStorage(storage)
  if (!target) return
  try {
    target.removeItem(SESSION_STORAGE_KEY)
  } catch {
    // Logging out must still succeed when browser storage is unavailable.
  }
}

