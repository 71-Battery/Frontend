import { MAJOR_LABELS } from './profileMapper.js'

export const RESOURCE_TYPES = Object.freeze({
  SCHEDULE: 'SCHEDULE',
  NOTICE: 'NOTICE',
  RULE: 'RULE',
})

const VALID_RESOURCE_TYPES = new Set(Object.values(RESOURCE_TYPES))

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asGrades(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((grade) => Number.isInteger(grade) && grade >= 1 && grade <= 3))].sort()
}

function asMajors(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((major) => typeof major === 'string' && MAJOR_LABELS[major]))]
}

function formatDisplayDate(value, fallback = '게시일 미정') {
  if (typeof value !== 'string') return fallback
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  return match ? `${match[1]}.${match[2]}.${match[3]}` : fallback
}

function formatInternalTarget(grades, majors) {
  const gradeLabel = grades.length ? `${grades.join('·')}학년` : '전 학년'
  const majorLabel = majors.length ? majors.map((major) => MAJOR_LABELS[major]).join('·') : '전체 학과'
  return `${gradeLabel} · ${majorLabel}`
}

function buildReason(resource, profile) {
  const matchesGrade = Number.isInteger(profile?.grade) && (
    !resource.targetGrades.length || resource.targetGrades.includes(profile.grade)
  )
  const matchesMajor = profile?.major && (
    !resource.targetMajors.length || resource.targetMajors.includes(profile.major)
  )

  if (matchesGrade && matchesMajor) {
    return `현재 ${profile.grade}학년 ${MAJOR_LABELS[profile.major] || '학생'}에게 관련된 ${resource.category} 정보예요.`
  }
  if (matchesGrade) return `현재 ${profile.grade}학년 학생이 확인하면 좋은 ${resource.category} 정보예요.`
  return `학교생활에 참고할 수 있는 ${resource.category} 정보예요.`
}

export function normalizeContentResource(raw, type, profile) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const normalizedType = String(raw.type || type || '').toUpperCase()
  if (![RESOURCE_TYPES.NOTICE, RESOURCE_TYPES.RULE].includes(normalizedType)) return null

  const id = asText(raw.id)
  const title = asText(raw.title)
  if (!id || !title) return null

  const targetGrades = asGrades(raw.targetGrades)
  const targetMajors = asMajors(raw.targetMajors)
  const resource = {
    id,
    type: normalizedType,
    title,
    summary: asText(raw.summary || raw.description || raw.content, '요약이 제공되지 않았습니다.'),
    content: asText(raw.content),
    category: asText(raw.category, normalizedType === RESOURCE_TYPES.RULE ? '규정' : '일반'),
    department: asText(raw.department, '담당 부서 미정'),
    publishedAt: asText(raw.publishedAt || raw.published_at),
    deadlineAt: asText(raw.deadlineAt || raw.deadline_at),
    effectiveFrom: asText(raw.effectiveFrom || raw.effective_from),
    effectiveTo: asText(raw.effectiveTo || raw.effective_to),
    targetGrades,
    targetMajors,
    sourceUrl: asText(raw.sourceUrl || raw.source_url) || null,
    version: Number.isInteger(Number(raw.version)) ? Number(raw.version) : 1,
    updatedAt: asText(raw.updatedAt || raw.updated_at),
  }
  resource.date = formatDisplayDate(
    resource.publishedAt || resource.effectiveFrom,
    normalizedType === RESOURCE_TYPES.RULE ? '상시' : '게시일 미정',
  )
  resource.target = formatInternalTarget(targetGrades, targetMajors)
  resource.reason = asText(raw.reason) || buildReason(resource, profile)
  return resource
}

export function normalizeContentResources(rawItems, type, profile) {
  return (Array.isArray(rawItems) ? rawItems : [])
    .map((item) => normalizeContentResource(item, type, profile))
    .filter(Boolean)
}

export function normalizeSavedResource(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const resourceType = String(raw.resourceType || raw.resource_type || raw.type || '').toUpperCase()
  const resourceId = asText(raw.resourceId || raw.resource_id || raw.id)
  if (!VALID_RESOURCE_TYPES.has(resourceType) || !resourceId) return null
  return {
    resourceType,
    resourceId,
    savedAt: asText(raw.savedAt || raw.saved_at),
    title: asText(raw.title),
  }
}

export function makeResourceKey(resourceType, resourceId) {
  return `${String(resourceType).toUpperCase()}:${String(resourceId)}`
}

export function parseResourceKey(key) {
  const separator = String(key).indexOf(':')
  if (separator < 1) return null
  const resourceType = key.slice(0, separator)
  const resourceId = key.slice(separator + 1)
  if (!VALID_RESOURCE_TYPES.has(resourceType) || !resourceId) return null
  return { resourceType, resourceId }
}
