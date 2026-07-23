import test from 'node:test'
import assert from 'node:assert/strict'
import {
  clearSession,
  readSession,
  saveSession,
  SESSION_STORAGE_KEY,
} from '../src/api/sessionStore.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

function authenticatedSession() {
  return {
    user: {
      id: 'student-id',
      name: '홍길동',
      email: 'student@gsm.hs.kr',
      grade: 2,
      major: 'SW_DEVELOPMENT',
      department: '소프트웨어개발과',
      password: 'must-not-be-stored',
    },
    token: 'access-token',
    permissions: { canManageContent: false },
    meta: { source: 'DATA_GSM', fallback: false },
  }
}

test('stores and restores only the normalized browser session', () => {
  const storage = createStorage()
  assert.equal(saveSession(authenticatedSession(), storage), true)

  const restored = readSession(storage)
  const raw = storage.getItem(SESSION_STORAGE_KEY)

  assert.equal(restored.token, 'access-token')
  assert.equal(restored.user.name, '홍길동')
  assert.equal(restored.user.password, undefined)
  assert.equal(raw.includes('must-not-be-stored'), false)
});

test('removes malformed or unusable session values', () => {
  const storage = createStorage()
  storage.setItem(SESSION_STORAGE_KEY, JSON.stringify({
    version: 1,
    token: '',
    user: { name: '학생' },
  }))

  assert.equal(readSession(storage), null)
  assert.equal(storage.getItem(SESSION_STORAGE_KEY), null)
});

test('clears a persisted session during logout', () => {
  const storage = createStorage()
  saveSession(authenticatedSession(), storage)

  clearSession(storage)

  assert.equal(readSession(storage), null)
});

