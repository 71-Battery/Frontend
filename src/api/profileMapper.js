export const MAJOR_LABELS = Object.freeze({
  SW_DEVELOPMENT: '소프트웨어개발과',
  SMART_IOT: '스마트IoT과',
  AI: '인공지능과',
})

const VALID_MAJORS = new Set(Object.keys(MAJOR_LABELS))

function toNullableInteger(value) {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') {
    const match = value.match(/\d+/)
    if (match) value = match[0]
  }
  const parsed = Number(value)
  return Number.isInteger(parsed) ? parsed : null
}

export function normalizeProfile(raw = {}) {
  const source = raw.profile || raw.student || raw.user || raw
  const email = String(source.email || source.schoolEmail || '').trim().toLowerCase()
  const major = VALID_MAJORS.has(source.major) ? source.major : null
  const department = String(source.department || source.majorLabel || MAJOR_LABELS[major] || '').trim()

  return {
    id: source.id !== undefined && source.id !== null
      ? String(source.id)
      : source.studentId !== undefined && source.studentId !== null
        ? String(source.studentId)
        : email || null,
    name: String(source.name || email.split('@')[0] || '학생').trim(),
    email,
    schoolEmail: String(source.schoolEmail || email).trim().toLowerCase(),
    grade: toNullableInteger(source.grade),
    classNum: toNullableInteger(source.classNum),
    number: toNullableInteger(source.number),
    studentNumber: toNullableInteger(source.studentNumber),
    major,
    majorLabel: department || '학과 미설정',
    department: department || null,
    specialty: typeof source.specialty === 'string' && source.specialty.trim() ? source.specialty.trim() : null,
    role: typeof source.role === 'string' && source.role.trim() ? source.role.trim() : 'GENERAL_STUDENT',
    interests: Array.isArray(source.interests)
      ? source.interests.filter((item) => typeof item === 'string' && item.trim()).map((item) => item.trim())
      : [],
    dataSource: source.dataSource || 'backend',
  }
}
