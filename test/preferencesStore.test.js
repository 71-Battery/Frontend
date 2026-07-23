import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_STORAGE_KEY,
  readPreferences,
  savePreferences,
} from '../src/api/preferencesStore.js'

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  }
}

test('uses light mode with notifications disabled by default', () => {
  assert.deepEqual(readPreferences(createStorage()), DEFAULT_PREFERENCES)
})

test('persists supported appearance and notification preferences', () => {
  const storage = createStorage()
  assert.equal(savePreferences({ theme: 'dark', notifications: true }, storage), true)
  assert.deepEqual(readPreferences(storage), { theme: 'dark', notifications: true })
})

test('normalizes untrusted stored preferences', () => {
  const storage = createStorage()
  storage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify({
    theme: 'unknown',
    notifications: 'yes',
    accessToken: 'must-be-ignored',
  }))

  assert.deepEqual(readPreferences(storage), DEFAULT_PREFERENCES)
  assert.equal(savePreferences(readPreferences(storage), storage), true)
  assert.equal(storage.getItem(PREFERENCES_STORAGE_KEY).includes('accessToken'), false)
})
