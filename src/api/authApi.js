import { ApiError, apiRequest, unwrapData } from './httpClient.js'
import { normalizeProfile } from './profileMapper.js'
import { getProfile } from './platformApi.js'

export const AUTH_ENDPOINTS = {
  login: '/api/auth/login',
  signup: '/api/auth/signup',
  resendVerification: '/api/auth/resend-verification',
  logout: '/api/auth/logout',
  confirmation: '/api/auth/confirmation',
}

function getAccessToken(data) {
  const token = data?.accessToken
    || data?.token
    || data?.access_token
    || data?.session?.accessToken
    || data?.session?.access_token
  return typeof token === 'string' && token.trim() ? token.trim() : ''
}

function normalizeAuthPayload(payload) {
  const data = unwrapData(payload)
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new ApiError('인증 응답을 확인할 수 없습니다. 다시 시도해 주세요.', {
      code: 'INVALID_AUTH_RESPONSE',
    })
  }

  const user = data.user || data.student || data.profile || data
  const hasIdentityValue = (value) => value !== undefined && value !== null && String(value).trim() !== ''
  const hasStableIdentity = user && typeof user === 'object' && (
    hasIdentityValue(user.id) ||
    hasIdentityValue(user.studentId) ||
    hasIdentityValue(user.studentNumber) ||
    hasIdentityValue(user.email)
  )
  if (!hasStableIdentity && !getAccessToken(data)) {
    throw new ApiError('인증 응답을 확인할 수 없습니다. 다시 시도해 주세요.', {
      code: 'INVALID_AUTH_RESPONSE',
    })
  }

  return {
    status: payload?.status || 'OK',
    code: payload?.code || 200,
    message: payload?.message || 'OK',
    data: {
      user: hasStableIdentity ? normalizeProfile(user) : null,
      token: getAccessToken(data),
      permissions: {
        canManageContent: data?.permissions?.canManageContent === true,
      },
      verificationRequired: data.verificationRequired === true,
      verificationExpiresAt: data.verificationExpiresAt || null,
      resendAvailableAt: data.resendAvailableAt || null,
      accountExpiresAt: data.accountExpiresAt || null,
      meta: payload?.meta && typeof payload.meta === 'object' ? payload.meta : {},
    },
  }
}

async function hydrateAuthenticatedProfile(payload) {
  const normalized = normalizeAuthPayload(payload)
  if (normalized.data.token) {
    const profileResponse = await getProfile({ authToken: normalized.data.token })
    normalized.data.user = profileResponse.profile
    normalized.data.permissions = profileResponse.permissions
    normalized.data.meta = profileResponse.meta
  }
  return normalized
}

export async function login(credentials) {
  const payload = await apiRequest(AUTH_ENDPOINTS.login, {
    method: 'POST',
    body: {
      email: credentials.email,
      password: credentials.password,
    },
  })
  return hydrateAuthenticatedProfile(payload)
}

export async function signup(account) {
  const payload = await apiRequest(AUTH_ENDPOINTS.signup, {
    method: 'POST',
    body: {
      email: account.schoolEmail || account.email,
      password: account.password,
      name: account.name,
      studentNumber: account.studentNumber,
      agreements: account.agreements,
    },
  })
  return hydrateAuthenticatedProfile(payload)
}

export async function resendVerification(email) {
  const payload = await apiRequest(AUTH_ENDPOINTS.resendVerification, {
    method: 'POST',
    body: { email },
    timeoutMs: 30000,
  })
  return normalizeAuthPayload(payload)
}

export async function logout({ authToken, signal } = {}) {
  return apiRequest(AUTH_ENDPOINTS.logout, {
    method: 'POST',
    authToken,
    signal,
    timeoutMs: 30000,
  })
}

export async function verifyEmailConfirmation({ authToken, signal } = {}) {
  return apiRequest(AUTH_ENDPOINTS.confirmation, {
    authToken,
    signal,
    timeoutMs: 30000,
  })
}
