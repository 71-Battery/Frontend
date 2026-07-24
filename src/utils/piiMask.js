// 개인정보 원본은 state/props에 유지하고 화면에 렌더링할 때만 마스킹합니다.

export function maskName(name) {
  const value = String(name || '').trim()
  if (value.length <= 1) return value
  if (value.length === 2) return `${value[0]}*`

  return `${value[0]}${'*'.repeat(value.length - 2)}${value[value.length - 1]}`
}

export function maskEmail(email) {
  const value = String(email || '').trim()
  const atIndex = value.indexOf('@')
  if (atIndex <= 0) return value

  const local = value.slice(0, atIndex)
  const domain = value.slice(atIndex)

  if (local.length <= 2) return `${local[0]}*${domain}`
  if (local.length <= 4) {
    return `${local[0]}${'*'.repeat(local.length - 1)}${domain}`
  }

  const visibleHead = local.slice(0, 3)
  const visibleTail = local.slice(-2)
  return `${visibleHead}${'*'.repeat(local.length - 5)}${visibleTail}${domain}`
}

export function maskStudentNumber(studentNumber) {
  const value = String(studentNumber ?? '').trim()
  if (value.length <= 2) return value.length ? `${value[0]}*` : value
  return `${value.slice(0, 2)}${'*'.repeat(value.length - 2)}`
}

export function withPiiMask(maskFn) {
  return (value, revealed) => (revealed ? String(value ?? '') : maskFn(value))
}

export const displayName = withPiiMask(maskName)
export const displayEmail = withPiiMask(maskEmail)
export const displayStudentNumber = withPiiMask(maskStudentNumber)
