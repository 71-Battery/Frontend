export const EMAIL_CONFIRMATION_PATH = '/auth/confirmed'

const JWT_PATTERN = /^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/

export function resolveInitialRoute({ pathname, search = '', hash = '' }) {
  if (pathname === '/') return { kind: 'app' }
  if (pathname !== EMAIL_CONFIRMATION_PATH) return { kind: 'redirect' }

  const query = new URLSearchParams(search)
  const fragment = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash)
  const error = fragment.get('error') || query.get('error')
  const type = fragment.get('type') || query.get('type')
  const accessToken = fragment.get('access_token') || query.get('access_token') || ''

  if (
    error
    || type !== 'signup'
    || accessToken.length > 8192
    || !JWT_PATTERN.test(accessToken)
  ) {
    return { kind: 'redirect' }
  }

  return {
    kind: 'email-confirmation',
    accessToken,
  }
}
