const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

function parseDate(value) {
  const match = DATE_PATTERN.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const epoch = Date.UTC(year, month - 1, day)
  const restored = new Date(epoch)
  if (
    restored.getUTCFullYear() !== year
    || restored.getUTCMonth() !== month - 1
    || restored.getUTCDate() !== day
  ) return null
  return { year, month, day, epoch }
}

function formatDate(date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`
}

export function getCalendarMonths(fromDate, toDate) {
  const from = parseDate(fromDate)
  const to = parseDate(toDate)
  if (!from || !to || from.epoch > to.epoch) return []

  const months = []
  let year = from.year
  let month = from.month
  while (year < to.year || (year === to.year && month <= to.month)) {
    months.push({
      key: `${year}-${String(month).padStart(2, '0')}`,
      year,
      month,
      label: `${year}년 ${month}월`,
    })
    month += 1
    if (month > 12) {
      year += 1
      month = 1
    }
  }
  return months
}

export function buildCalendarMonth(month, fromDate, toDate, schedules) {
  if (!month || !Number.isInteger(month.year) || !Number.isInteger(month.month)) return []
  const from = parseDate(fromDate)
  const to = parseDate(toDate)
  if (!from || !to) return []

  const firstDayEpoch = Date.UTC(month.year, month.month - 1, 1)
  const leadingDays = new Date(firstDayEpoch).getUTCDay()
  const daysInMonth = new Date(Date.UTC(month.year, month.month, 0)).getUTCDate()
  const cellCount = Math.ceil((leadingDays + daysInMonth) / 7) * 7
  const eventsByDate = new Map()

  for (const schedule of Array.isArray(schedules) ? schedules : []) {
    if (!parseDate(schedule?.scheduleDate)) continue
    const current = eventsByDate.get(schedule.scheduleDate) || []
    current.push(schedule)
    eventsByDate.set(schedule.scheduleDate, current)
  }

  return Array.from({ length: cellCount }, (_, index) => {
    const date = new Date(firstDayEpoch + (index - leadingDays) * 86_400_000)
    const scheduleDate = formatDate(date)
    const epoch = date.getTime()
    return {
      scheduleDate,
      day: date.getUTCDate(),
      inMonth: date.getUTCMonth() + 1 === month.month,
      inRange: epoch >= from.epoch && epoch <= to.epoch,
      isToday: scheduleDate === fromDate,
      events: eventsByDate.get(scheduleDate) || [],
    }
  })
}
