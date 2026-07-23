export const PREFERENCES_STORAGE_KEY = 'gsm-compass.preferences.v1'

export const DEFAULT_PREFERENCES = Object.freeze({
  theme: 'light',
  notifications: false,
})

function getLocalStorage(storage) {
  if (storage) return storage
  try {
    return globalThis.localStorage || null
  } catch {
    return null
  }
}

function normalizePreferences(value) {
  return {
    theme: value?.theme === 'dark' ? 'dark' : 'light',
    notifications: value?.notifications === true,
  }
}

export function readPreferences(storage) {
  const target = getLocalStorage(storage)
  if (!target) return { ...DEFAULT_PREFERENCES }

  try {
    const raw = target.getItem(PREFERENCES_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_PREFERENCES }
    return normalizePreferences(JSON.parse(raw))
  } catch {
    try {
      target.removeItem(PREFERENCES_STORAGE_KEY)
    } catch {
      // Treat blocked browser storage as unavailable.
    }
    return { ...DEFAULT_PREFERENCES }
  }
}

export function savePreferences(preferences, storage) {
  const target = getLocalStorage(storage)
  if (!target) return false

  try {
    target.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(normalizePreferences(preferences)))
    return true
  } catch {
    return false
  }
}
