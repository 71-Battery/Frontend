import { ApiError, apiRequest, unwrapData } from './httpClient.js'
import { normalizeChatPayload } from './chatMapper.js'
import { normalizeProfile } from './profileMapper.js'
import { mapAndSortSchedules } from './scheduleMapper.js'
import {
  normalizeContentResources,
  normalizeSavedResource,
  RESOURCE_TYPES,
} from './resourceMapper.js'

export const PLATFORM_ENDPOINTS = Object.freeze({
  root: '/',
  health: '/health',
  supabaseHealth: '/supabase-health',
  chat: '/api/v1/chat',
  adminRules: '/api/admin/rules',
  adminNotices: '/api/admin/notices',
  adminUsers: '/api/admin/users',
  profile: '/api/profile',
  schedules: '/api/schedules',
  notices: '/api/notices',
  regulations: '/api/regulations',
  savedResources: '/api/saved-resources',
  apiHealth: '/api/health',
})

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function getMeta(payload, data) {
  const meta = payload?.meta || data?.meta
  return meta && typeof meta === 'object' && !Array.isArray(meta) ? meta : {}
}

function getList(data, key) {
  if (Array.isArray(data)) return data
  if (Array.isArray(data?.[key])) return data[key]
  if (Array.isArray(data?.items)) return data.items
  return []
}

function normalizePermissions(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {}
  return {
    canManageContent: source.canManageContent === true,
    canManageUsers: source.canManageUsers === true,
    canAssignRoles: source.canAssignRoles === true,
  }
}

export async function getServerInfo({ signal } = {}) {
  return apiRequest(PLATFORM_ENDPOINTS.root, { signal })
}

export async function getHealth({ signal } = {}) {
  return apiRequest(PLATFORM_ENDPOINTS.health, { signal })
}

export async function getSupabaseHealth({ signal } = {}) {
  return apiRequest(PLATFORM_ENDPOINTS.supabaseHealth, { signal })
}

export async function getApiHealth({ signal } = {}) {
  return apiRequest(PLATFORM_ENDPOINTS.apiHealth, { signal })
}

export async function getProfile({ authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.profile, { authToken, signal })
  const data = unwrapData(payload)
  const source = data?.profile || data?.student || data?.user || data
  if (!source || typeof source !== 'object') {
    throw new ApiError('프로필 응답을 확인할 수 없습니다.', { code: 'INVALID_PROFILE_RESPONSE' })
  }
  const meta = getMeta(payload, data)
  return {
    profile: normalizeProfile({
      ...source,
      dataSource: meta.fallback ? 'fallback' : source.dataSource,
    }),
    permissions: normalizePermissions(data?.permissions || payload?.permissions),
    meta,
  }
}

export async function getSchedules({ fromDate, toDate, studentGrade, authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.schedules, {
    query: { fromDate, toDate },
    authToken,
    signal,
  })
  const data = unwrapData(payload)
  return {
    items: mapAndSortSchedules(getList(data, 'schedules'), studentGrade),
    meta: { source: 'DATA_GSM', ...getMeta(payload, data) },
  }
}

export async function getNotices({ profile, authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.notices, { authToken, signal })
  const data = unwrapData(payload)
  return {
    items: normalizeContentResources(getList(data, 'notices'), RESOURCE_TYPES.NOTICE, profile),
    meta: { source: 'INTERNAL_DB', ...getMeta(payload, data) },
  }
}

export async function getRegulations({ profile, authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.regulations, { authToken, signal })
  const data = unwrapData(payload)
  return {
    items: normalizeContentResources(getList(data, 'regulations'), RESOURCE_TYPES.RULE, profile),
    meta: { source: 'INTERNAL_DB', ...getMeta(payload, data) },
  }
}

export async function getSavedResources({ authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.savedResources, { authToken, signal })
  const data = unwrapData(payload)
  return {
    items: getList(data, 'savedResources').map(normalizeSavedResource).filter(Boolean),
    meta: { source: 'USER_DATA', ...getMeta(payload, data) },
  }
}

export async function saveResource(resourceType, resourceId, { authToken, signal } = {}) {
  const payload = await apiRequest(
    `${PLATFORM_ENDPOINTS.savedResources}/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`,
    { method: 'PUT', authToken, signal },
  )
  if (!payload) return { resourceType, resourceId }
  const data = unwrapData(payload)
  return normalizeSavedResource(data?.savedResource || data) || { resourceType, resourceId }
}

export async function removeSavedResource(resourceType, resourceId, { authToken, signal } = {}) {
  await apiRequest(
    `${PLATFORM_ENDPOINTS.savedResources}/${encodeURIComponent(resourceType)}/${encodeURIComponent(resourceId)}`,
    { method: 'DELETE', authToken, signal },
  )
}

export async function sendChat(message, { authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.chat, {
    method: 'POST',
    body: { query: asText(message) },
    authToken,
    signal,
    timeoutMs: 90000,
  })
  const result = normalizeChatPayload(payload)
  if (!result) throw new ApiError('AI 답변 형식을 확인할 수 없습니다.', { code: 'INVALID_CHAT_RESPONSE' })
  return result
}

export async function getAdminRules({ authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.adminRules, { authToken, signal })
  const data = unwrapData(payload)
  return Array.isArray(data) ? data : Array.isArray(data?.rules) ? data.rules : []
}

export async function createAdminRule(rule, { authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.adminRules, {
    method: 'POST',
    body: {
      title: asText(rule.title),
      content: asText(rule.content),
      category: asText(rule.category, 'GENERAL'),
    },
    authToken,
    signal,
  })
  const data = unwrapData(payload) || {}
  return data.rule || data
}

export async function updateAdminRule(ruleId, rule, { authToken, signal } = {}) {
  const payload = await apiRequest(
    `${PLATFORM_ENDPOINTS.adminRules}/${encodeURIComponent(ruleId)}`,
    {
      method: 'PATCH',
      body: {
        title: asText(rule.title),
        content: asText(rule.content),
        category: asText(rule.category, '일반'),
      },
      authToken,
      signal,
    },
  )
  const data = unwrapData(payload) || {}
  return data.rule || data
}

export async function deleteAdminRule(ruleId, { authToken, signal } = {}) {
  await apiRequest(
    `${PLATFORM_ENDPOINTS.adminRules}/${encodeURIComponent(ruleId)}`,
    {
      method: 'DELETE',
      authToken,
      signal,
    },
  )
}

export async function createAdminNotice(notice, { authToken, signal } = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.adminNotices, {
    method: 'POST',
    body: {
      title: asText(notice.title),
      summary: asText(notice.summary),
      content: asText(notice.content),
      category: asText(notice.category, '일반'),
    },
    authToken,
    signal,
  })
  const data = unwrapData(payload) || {}
  return data.notice || data
}

export async function getAdminUsers({
  page = 1,
  perPage = 20,
  authToken,
  signal,
} = {}) {
  const payload = await apiRequest(PLATFORM_ENDPOINTS.adminUsers, {
    query: { page, perPage },
    authToken,
    signal,
  })
  const data = unwrapData(payload) || {}
  return {
    users: Array.isArray(data.users) ? data.users : [],
    pagination: data.pagination && typeof data.pagination === 'object'
      ? data.pagination
      : { page, perPage, total: 0 },
  }
}

export async function updateAdminUserRole(
  userId,
  appRole,
  { authToken, signal } = {},
) {
  const payload = await apiRequest(
    `${PLATFORM_ENDPOINTS.adminUsers}/${encodeURIComponent(userId)}/role`,
    {
      method: 'PATCH',
      body: { appRole },
      authToken,
      signal,
    },
  )
  return unwrapData(payload)
}
