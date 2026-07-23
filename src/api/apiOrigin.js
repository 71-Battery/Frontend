const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

export function normalizeApiBaseUrl(value) {
  const configured = typeof value === 'string' ? value.trim() : ''
  if (!configured) return ''

  let url
  try {
    url = new URL(configured)
  } catch {
    throw new Error('API 주소는 https:// 또는 로컬 개발 주소 형식이어야 합니다.')
  }

  const isLocalHttp = url.protocol === 'http:'
    && (LOCAL_HOSTS.has(url.hostname) || url.hostname.endsWith('.localhost'))

  if (url.protocol !== 'https:' && !isLocalHttp) {
    throw new Error('API 주소는 HTTPS를 사용해야 합니다.')
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('API 주소에는 인증 정보, 쿼리 또는 해시를 포함할 수 없습니다.')
  }

  return url.href.replace(/\/+$/, '')
}
