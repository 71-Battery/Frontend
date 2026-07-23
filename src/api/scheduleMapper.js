const SEOUL_TIME_ZONE = 'Asia/Seoul'
const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const VALID_GRADES = new Set([1, 2, 3])
export const SCHEDULE_WINDOW_DAYS = 90
export const SCHEDULE_PAGE_DAYS = 30

function toDateParts(value) {
  const match = DATE_PATTERN.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const timestamp = Date.UTC(year, month - 1, day)
  const candidate = new Date(timestamp)

  if (
    candidate.getUTCFullYear() !== year
    || candidate.getUTCMonth() !== month - 1
    || candidate.getUTCDate() !== day
  ) return null

  return { year, month, day, timestamp }
}

function formatDateParts({ year, month, day }) {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function normalizeGrades(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(Number).filter((grade) => Number.isInteger(grade) && VALID_GRADES.has(grade)))].sort()
}

export function getSeoulDateParts(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: SEOUL_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return {
    year: Number(values.year),
    month: Number(values.month),
    day: Number(values.day),
  }
}

export function isStrictScheduleDate(value) {
  return typeof value === 'string' && Boolean(toDateParts(value))
}

export function getDefaultScheduleRange(now = new Date()) {
  const today = getSeoulDateParts(now)
  const fromDate = formatDateParts(today)
  const lastDay = new Date(Date.UTC(today.year, today.month - 1, today.day) + (SCHEDULE_WINDOW_DAYS - 1) * 86_400_000)
  const toDate = formatDateParts({
    year: lastDay.getUTCFullYear(),
    month: lastDay.getUTCMonth() + 1,
    day: lastDay.getUTCDate(),
  })
  return { fromDate, toDate }
}

export function getSchedulePageIndex(schedule) {
  const days = Number(schedule?.ddayValue)
  if (!Number.isInteger(days) || days < 0 || days >= SCHEDULE_WINDOW_DAYS) return -1
  return Math.floor(days / SCHEDULE_PAGE_DAYS)
}

export function getSchedulePageCount(schedules) {
  const lastPageIndex = (Array.isArray(schedules) ? schedules : [])
    .reduce((maximum, schedule) => Math.max(maximum, getSchedulePageIndex(schedule)), -1)
  return Math.max(1, lastPageIndex + 1)
}

export function getSchedulesForPage(schedules, pageIndex) {
  return (Array.isArray(schedules) ? schedules : [])
    .filter((schedule) => getSchedulePageIndex(schedule) === pageIndex)
}

export function getHomeAgenda(schedules, maximumItems = 3) {
  const limit = Number.isInteger(maximumItems) && maximumItems > 0 ? maximumItems : 3
  const upcoming = (Array.isArray(schedules) ? schedules : [])
    .filter((schedule) => Number.isInteger(schedule?.ddayValue) && schedule.ddayValue >= 0)
    .sort((left, right) => (
      left.ddayValue - right.ddayValue
      || String(left.scheduleDate || '').localeCompare(String(right.scheduleDate || ''))
      || String(left.title || '').localeCompare(String(right.title || ''), 'ko')
    ))
    .slice(0, limit)

  return {
    today: upcoming.filter((schedule) => schedule.ddayValue === 0),
    upcoming: upcoming.filter((schedule) => schedule.ddayValue > 0),
  }
}

export function formatTargetGrades(targetGrades) {
  const grades = normalizeGrades(targetGrades)
  if (!grades.length) return '대상 정보 없음'
  if (grades.length === 3 && grades.every((grade, index) => grade === index + 1)) return '전 학년'
  return `${grades.join('·')}학년`
}

function getDdayLabel(days) {
  if (days === 0) return 'D-DAY'
  return days > 0 ? `D-${days}` : `D+${Math.abs(days)}`
}

function getTone(days, category, targeted) {
  if (days >= 0 && days <= 2) return 'urgent'
  if (days >= 3 && days <= 7) return 'warning'
  if (days > 7 && (targeted || /시험|평가|제출|마감/.test(category))) return 'accent'
  return 'neutral'
}

function getImportance(targetGrades, studentGrade) {
  if (targetGrades.length === 3 && targetGrades.every((grade, index) => grade === index + 1)) return 'MEDIUM'
  if (Number.isInteger(studentGrade) && targetGrades.includes(studentGrade)) return 'HIGH'
  return 'LOW'
}

export function mapSchedule(raw, studentGrade, now = new Date()) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null

  const scheduleDate = asText(raw.scheduleDate)
  const dateParts = toDateParts(scheduleDate)
  const id = asText(raw.id || raw.scheduleId)
  const title = asText(raw.title || raw.eventName)
  if (!dateParts || !id || !title) return null

  const today = getSeoulDateParts(now)
  const todayTimestamp = Date.UTC(today.year, today.month - 1, today.day)
  const days = Math.round((dateParts.timestamp - todayTimestamp) / 86_400_000)
  const targetGrades = normalizeGrades(raw.targetGrades)
  const category = asText(raw.category || raw.dayCategory, '학사일정')
  const isTargeted = Number.isInteger(studentGrade) && targetGrades.includes(studentGrade)

  const schoolSource = raw.school && typeof raw.school === 'object' ? raw.school : {}
  const school = {
    code: asText(schoolSource.code || raw.schoolCode),
    name: asText(schoolSource.name || raw.schoolName),
    officeCode: asText(schoolSource.officeCode || raw.officeCode),
    officeName: asText(schoolSource.officeName || raw.officeName),
  }

  return {
    id,
    scheduleDate,
    title,
    description: asText(raw.description || raw.eventContent, '세부 내용이 제공되지 않은 일정입니다.'),
    category,
    targetGrades,
    academicYear: asText(raw.academicYear, String(dateParts.year)),
    school,
    courseType: asText(raw.courseType || raw.schoolCourseType),
    dayNightType: asText(raw.dayNightType),
    source: asText(raw.source, 'DATA_GSM'),
    month: `${dateParts.month}월`,
    date: String(dateParts.day).padStart(2, '0'),
    dday: getDdayLabel(days),
    ddayValue: days,
    target: formatTargetGrades(targetGrades),
    tone: getTone(days, `${category} ${title}`, isTargeted),
    importance: getImportance(targetGrades, studentGrade),
  }
}

export function mapAndSortSchedules(rawSchedules, studentGrade, now = new Date()) {
  const importanceOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 }
  return (Array.isArray(rawSchedules) ? rawSchedules : [])
    .map((schedule) => mapSchedule(schedule, studentGrade, now))
    .filter(Boolean)
    .sort((left, right) => (
      left.scheduleDate.localeCompare(right.scheduleDate)
      || importanceOrder[left.importance] - importanceOrder[right.importance]
      || left.title.localeCompare(right.title, 'ko')
    ))
}
