const API_PATH = /^(?:\/api(?:\/|$)|\/health$|\/supabase-health$)/

function jsonError(status, code, message) {
  return Response.json(
    {
      status: 'ERROR',
      error: { code, message },
    },
    {
      status,
      headers: {
        'Cache-Control': 'no-store',
      },
    },
  )
}

function resolveBackendOrigin(request, env) {
  const configured = String(env.BACKEND_ORIGIN || '').trim()
  const requestUrl = new URL(request.url)
  const fallback = ['localhost', '127.0.0.1'].includes(requestUrl.hostname)
    ? 'http://localhost:3000'
    : ''
  const value = configured || fallback

  if (!value) return null

  try {
    const origin = new URL(value)
    const isLocalHttp = origin.protocol === 'http:'
      && ['localhost', '127.0.0.1'].includes(origin.hostname)
    if (origin.protocol !== 'https:' && !isLocalHttp) return null
    return origin
  } catch {
    return null
  }
}

async function proxyApi(request, env) {
  const backendOrigin = resolveBackendOrigin(request, env)
  if (!backendOrigin) {
    return jsonError(
      503,
      'BACKEND_NOT_CONFIGURED',
      '백엔드 연결 주소가 아직 구성되지 않았습니다.',
    )
  }

  const incomingUrl = new URL(request.url)
  const targetUrl = new URL(`${incomingUrl.pathname}${incomingUrl.search}`, backendOrigin)
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('cf-connecting-ip')
  headers.delete('cf-ipcountry')
  headers.delete('cf-ray')
  headers.delete('cf-visitor')

  try {
    return await fetch(targetUrl, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
      redirect: 'manual',
    })
  } catch {
    return jsonError(
      502,
      'BACKEND_UNAVAILABLE',
      '백엔드 서버에 일시적으로 연결할 수 없습니다.',
    )
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url)
    if (API_PATH.test(url.pathname)) return proxyApi(request, env)
    return env.ASSETS.fetch(request)
  },
}
