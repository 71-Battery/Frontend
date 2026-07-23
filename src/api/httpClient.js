import { normalizeApiBaseUrl } from './apiOrigin.js'

const configuredApiBaseUrl = import.meta.env?.VITE_API_BASE_URL || ''
let apiBaseUrlConfigurationError = null

export const API_BASE_URL = (() => {
  try {
    return normalizeApiBaseUrl(configuredApiBaseUrl)
  } catch (error) {
    apiBaseUrlConfigurationError = error
    return ''
  }
})()

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS'])
const SAFE_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: '이메일과 비밀번호를 확인해 주세요.',
  EMAIL_NOT_VERIFIED: '학교 이메일 인증을 완료한 뒤 다시 로그인해 주세요.',
  VERIFICATION_RESEND_TOO_SOON: '잠시 후 인증 메일을 다시 요청해 주세요.',
  VERIFICATION_NOT_PENDING: '인증 대기 중인 계정을 확인할 수 없습니다.',
  UNVERIFIED_ACCOUNT_EXPIRED: '인증 대기 시간이 만료되었습니다. 다시 회원가입해 주세요.',
  VERIFICATION_RESEND_FAILED: '인증 메일을 보내지 못했습니다. 잠시 후 다시 시도해 주세요.',
  ACCOUNT_LOCKED: '로그인 시도가 잠시 제한되었습니다. 잠시 후 다시 시도해 주세요.',
  VALIDATION_ERROR: '입력한 내용을 다시 확인해 주세요.',
  CSRF_TOKEN_INVALID: '보안 확인이 만료되었습니다. 다시 시도해 주세요.',
  DATA_PROVIDER_AUTH_ERROR: '학사 정보 제공자 인증에 문제가 발생했습니다. 관리자에게 알려 주세요.',
  DATA_PROVIDER_PERMISSION_ERROR: '학사 정보를 불러올 권한이 준비되지 않았습니다.',
  DATA_PROVIDER_RATE_LIMITED: '학사 정보 요청이 많습니다. 잠시 후 다시 시도해 주세요.',
  DATA_PROVIDER_TIMEOUT: '학사 정보 응답이 지연되고 있습니다. 잠시 후 다시 시도해 주세요.',
  DATA_PROVIDER_UNAVAILABLE: '학사 정보 제공자가 일시적으로 응답하지 않습니다.',
  DATA_PROVIDER_INVALID_RESPONSE: '학사 정보 형식을 확인할 수 없습니다.',
  STUDENT_IDENTITY_MISMATCH: '학교 이메일과 학번이 재학생 정보와 일치하지 않습니다.',
  STUDENT_PROFILE_NOT_FOUND: '연결된 학생 프로필을 찾을 수 없습니다. 학교 이메일과 정보 제공 동의를 확인해 주세요.',
  INVALID_REQUEST: '질문을 입력해 주세요.',
  QUERY_TOO_LONG: '질문은 1,000자 이하로 입력해 주세요.',
  PROFILE_INCOMPLETE: 'AI 질문을 사용하려면 학년과 학과 정보가 필요합니다.',
  USER_NOT_FOUND: '사용자 정보를 찾을 수 없습니다.',
  KNOWLEDGE_BASE_UNAVAILABLE: 'AI 지식베이스를 일시적으로 불러올 수 없습니다.',
  AI_PROVIDER_UNAVAILABLE: 'AI 답변을 생성하지 못했습니다. 잠시 후 다시 시도해 주세요.',
  CAMPUS_AI_UNAVAILABLE: 'AI 서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.',
  CAMPUS_AI_TIMEOUT: 'AI 응답 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.',
  INVALID_AI_RESPONSE: 'AI 서버 응답을 확인할 수 없습니다.',
}
const SAFE_FIELD_ERROR_MESSAGES = {
  email: '이메일 형식을 확인해 주세요.',
  identifier: '학번 또는 학교 이메일 형식을 확인해 주세요.',
  password: '비밀번호 형식을 확인해 주세요.',
  name: '이름을 확인해 주세요.',
  studentNumber: '학번 형식을 확인해 주세요.',
  schoolEmail: '학교 이메일 형식을 확인해 주세요.',
  passwordConfirm: '비밀번호 확인 값을 확인해 주세요.',
  agreements: '필수 약관 동의를 확인해 주세요.',
}
const SAFE_BACKEND_MESSAGES = new Set([
  '이메일과 비밀번호를 입력해 주세요.',
  '올바른 이메일 형식이 아닙니다.',
  '인증 토큰이 필요합니다.',
  '유효하지 않은 토큰입니다.',
  '질문 내용을 입력해 주세요.',
  '주제를 입력해 주세요.',
])

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR', fieldErrors = {}, requestId = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.fieldErrors = fieldErrors
    this.requestId = requestId
  }
}

function buildUrl(path, query) {
  if (apiBaseUrlConfigurationError) {
    throw new ApiError('API 연결 주소 설정을 확인해 주세요.', { code: 'INVALID_API_ORIGIN' })
  }
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  const url = new URL(`${API_BASE_URL}${normalizedPath}`, window.location.origin)

  Object.entries(query || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value))
  })

  return url
}

function getSafeMessage(status, payload) {
  const safeMessage = SAFE_ERROR_MESSAGES[payload?.error?.code]
  if (safeMessage) return safeMessage
  if (SAFE_BACKEND_MESSAGES.has(payload?.message)) return payload.message
  if (status === 401) return '로그인이 필요하거나 세션이 만료되었습니다.'
  if (status === 403) return '이 정보를 확인할 권한이 없습니다.'
  if (status === 404) return '요청한 정보를 찾을 수 없습니다.'
  if (status === 409) return '현재 상태에서는 요청을 처리할 수 없습니다.'
  if (status === 400 || status === 422) return '입력한 내용을 다시 확인해 주세요.'
  if (status === 429) return '요청이 많습니다. 잠시 후 다시 시도해 주세요.'
  if (status >= 500) return '학교 정보 서버에 일시적인 문제가 발생했습니다.'
  return '요청을 처리하지 못했습니다.'
}

function getSafeFieldErrors(status, errorData) {
  if (![400, 422].includes(status) || errorData?.code !== 'VALIDATION_ERROR') return {}
  const rawFieldErrors = errorData.fieldErrors
  if (!rawFieldErrors || typeof rawFieldErrors !== 'object' || Array.isArray(rawFieldErrors)) return {}

  return Object.fromEntries(
    Object.keys(rawFieldErrors)
      .filter((field) => SAFE_FIELD_ERROR_MESSAGES[field])
      .map((field) => [field, SAFE_FIELD_ERROR_MESSAGES[field]]),
  )
}

function getCsrfToken() {
  const tokenCookie = document.cookie.split('; ').find((item) => item.startsWith('XSRF-TOKEN='))
  if (!tokenCookie) return ''
  try {
    return decodeURIComponent(tokenCookie.slice('XSRF-TOKEN='.length))
  } catch {
    return ''
  }
}

export async function apiRequest(path, {
  method = 'GET',
  query,
  body,
  signal,
  authToken,
  timeoutMs = 75000,
} = {}) {
  const upperMethod = method.toUpperCase()
  const targetUrl = buildUrl(path, query)
  const requestHeaders = { Accept: 'application/json' }

  if (body !== undefined) requestHeaders['Content-Type'] = 'application/json'
  if (authToken) requestHeaders.Authorization = `Bearer ${authToken}`
  if (
    !SAFE_METHODS.has(upperMethod)
    && targetUrl.origin === window.location.origin
  ) {
    const csrfToken = getCsrfToken()
    if (csrfToken) requestHeaders['X-XSRF-TOKEN'] = csrfToken
  }

  const controller = new AbortController()
  // 프로필 확인 후 Data-GSM 일정 조회가 이어지는 cold request도 완료할
  // 수 있도록 서버의 두 단계 5초 제한보다 여유 있게 둡니다.
  const boundedTimeoutMs = Number.isFinite(timeoutMs)
    ? Math.min(Math.max(timeoutMs, 1000), 90000)
    : 75000
  const timeoutId = window.setTimeout(() => controller.abort(), boundedTimeoutMs)
  const abortFromCaller = () => controller.abort(signal?.reason)
  if (signal) {
    if (signal.aborted) controller.abort(signal.reason)
    else signal.addEventListener('abort', abortFromCaller, { once: true })
  }

  let response
  try {
    response = await fetch(targetUrl, {
      method: upperMethod,
      credentials: targetUrl.origin === window.location.origin ? 'same-origin' : 'omit',
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error.name === 'AbortError' && signal?.aborted) throw error
    if (error.name === 'AbortError') throw new ApiError('요청 시간이 초과되었습니다. 잠시 후 다시 시도해 주세요.', { code: 'REQUEST_TIMEOUT' })
    throw new ApiError('서비스에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.')
  } finally {
    window.clearTimeout(timeoutId)
    signal?.removeEventListener('abort', abortFromCaller)
  }

  const contentType = response.headers.get('content-type') || ''
  const payload = contentType.includes('application/json') ? await response.json().catch(() => null) : null

  const payloadStatus = String(payload?.status || '').toLowerCase()
  if (!response.ok || payloadStatus === 'error') {
    const errorData = payload?.error || {}
    throw new ApiError(getSafeMessage(response.status, payload), {
      status: response.status,
      code: errorData.code || (payloadStatus === 'error' ? 'BACKEND_ERROR' : `HTTP_${response.status}`),
      fieldErrors: getSafeFieldErrors(response.status, errorData),
      requestId: errorData.requestId || errorData.request_id || response.headers.get('x-request-id'),
    })
  }

  if (!SAFE_METHODS.has(upperMethod) && response.status === 204) return null
  return payload
}

export function unwrapData(payload) {
  return payload?.data ?? payload
}
