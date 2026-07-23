const INTERNAL_SOURCE_TYPES = new Set(['SCHEDULE', 'NOTICE', 'RULE'])

function isRecord(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function asText(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asFiniteNumber(value) {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : null
}

function hasChatFields(value) {
  if (!isRecord(value)) return false
  return [
    value.answer,
    value.status === undefined ? value.message : null,
    typeof value.response === 'string' ? value.response : null,
    value.content,
  ].some((item) => asText(item))
    || Array.isArray(value.sources)
    || typeof value.has_context === 'boolean'
    || typeof value.hasContext === 'boolean'
}

export function unwrapChatData(payload) {
  let current = payload
  const visited = new Set()

  for (let depth = 0; depth < 5 && isRecord(current) && !visited.has(current); depth += 1) {
    visited.add(current)

    const nested = [current.data, current.result, current.chat, current.response]
      .find((candidate) => isRecord(candidate))
    if (nested) {
      current = nested
      continue
    }
    if (hasChatFields(current)) return current
    break
  }

  return hasChatFields(current) ? current : {}
}

export function normalizeAiSource(value, index = 0) {
  if (!isRecord(value)) return null

  const type = asText(value.type).toUpperCase()
  const id = asText(value.id || value.resourceId)
  const title = asText(value.title)

  if (INTERNAL_SOURCE_TYPES.has(type) && id && title) {
    return {
      kind: 'INTERNAL',
      type,
      id,
      title,
      date: asText(value.date || value.scheduleDate || value.publishedAt),
    }
  }

  const category = asText(value.category, '참고 문서')
  const document = asText(value.document || value.title || value.id, `문서 ${index + 1}`)
  const snippet = asText(value.snippet || value.excerpt || value.content)
  if (type !== 'DOCUMENT' && !value.document && !snippet) return null

  return {
    kind: 'DOCUMENT',
    type: 'DOCUMENT',
    category,
    document,
    snippet,
    score: asFiniteNumber(value.score),
  }
}

export function normalizeChatPayload(payload) {
  const data = unwrapChatData(payload)
  const answer = [
    data.answer,
    data.message,
    typeof data.response === 'string' ? data.response : '',
    data.content,
  ].map((value) => asText(value)).find(Boolean) || ''
  if (!answer) return null

  const sources = (Array.isArray(data.sources) ? data.sources : [])
    .map(normalizeAiSource)
    .filter(Boolean)
    .sort((left, right) => {
      if (left.kind !== 'DOCUMENT' || right.kind !== 'DOCUMENT') return 0
      if (left.score === null) return 1
      if (right.score === null) return -1
      return left.score - right.score
    })

  const explicitHasContext = typeof data.has_context === 'boolean'
    ? data.has_context
    : typeof data.hasContext === 'boolean'
      ? data.hasContext
      : null
  const hasContext = explicitHasContext ?? sources.length > 0

  return {
    answer,
    conversationId: asText(data.conversationId || data.conversation_id) || null,
    requestId: asText(data.request_id || data.requestId) || null,
    hasContext,
    sources: hasContext ? sources : [],
  }
}
