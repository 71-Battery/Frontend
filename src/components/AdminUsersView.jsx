import { useEffect, useMemo, useState } from 'react'
import {
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCog,
  UsersRound,
} from 'lucide-react'
import {
  getAdminUsers,
  updateAdminUserRole,
} from '../api/platformApi.js'

const roleLabels = {
  STUDENT: '일반 사용자',
  CONTENT_EDITOR: '콘텐츠 관리자',
  ADMIN: '관리자',
}

function displayDate(value) {
  if (!value) return '기록 없음'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '기록 없음'
  return new Intl.DateTimeFormat('ko-KR', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  }).format(date)
}

export default function AdminUsersView({
  authToken,
  currentEmail,
  canAssignRoles,
}) {
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({ page: 1, perPage: 20, total: 0 })
  const [page, setPage] = useState(1)
  const [query, setQuery] = useState('')
  const [roleDrafts, setRoleDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [busyUserId, setBusyUserId] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [reloadVersion, setReloadVersion] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    setLoading(true)
    setError('')
    setMessage('')
    getAdminUsers({
      page,
      perPage: 20,
      authToken,
      signal: controller.signal,
    }).then((result) => {
      setUsers(result.users)
      setPagination(result.pagination)
      setRoleDrafts(Object.fromEntries(
        result.users.map((user) => [user.id, user.appRole]),
      ))
    }).catch((requestError) => {
      if (requestError.name !== 'AbortError') {
        setError(requestError.message || '회원 목록을 불러오지 못했습니다.')
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false)
    })
    return () => controller.abort()
  }, [authToken, page, reloadVersion])

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    if (!normalized) return users
    return users.filter((user) => (
      String(user.name || '').toLowerCase().includes(normalized) ||
      String(user.email || '').toLowerCase().includes(normalized)
    ))
  }, [query, users])

  const pageCount = Math.max(1, Math.ceil(Number(pagination.total || 0) / 20))

  async function saveRole(user) {
    const nextRole = roleDrafts[user.id]
    if (!nextRole || nextRole === user.appRole || busyUserId) return
    setBusyUserId(user.id)
    setError('')
    setMessage('')
    try {
      const updated = await updateAdminUserRole(user.id, nextRole, { authToken })
      setUsers((current) => current.map((item) => (
        item.id === user.id
          ? { ...item, appRole: updated.appRole || nextRole }
          : item
      )))
      setMessage(`${user.name || user.email} 계정의 권한을 변경했습니다.`)
    } catch (requestError) {
      setRoleDrafts((current) => ({ ...current, [user.id]: user.appRole }))
      setError(requestError.message || '권한을 변경하지 못했습니다.')
    } finally {
      setBusyUserId('')
    }
  }

  return (
    <section className="admin-users-view reveal">
      <div className="admin-users-heading">
        <div>
          <span className="eyebrow"><ShieldCheck size={14} />ADMIN</span>
          <h1>회원 관리</h1>
          <p>가입 계정을 확인하고 서비스 내 역할을 안전하게 관리합니다.</p>
        </div>
        <button
          className="admin-refresh-button"
          type="button"
          onClick={() => setReloadVersion((value) => value + 1)}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? 'spin' : ''} />새로고침
        </button>
      </div>

      <div className="admin-users-toolbar glass-panel">
        <label className="admin-user-search">
          <Search size={16} />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="현재 페이지에서 이름 또는 이메일 검색"
          />
        </label>
        <span><UsersRound size={15} />전체 {pagination.total || 0}명</span>
      </div>

      {error && <p className="inline-error" role="alert">{error}</p>}
      {message && <p className="admin-success" role="status"><Check size={15} />{message}</p>}

      <div className="admin-user-list glass-panel" aria-busy={loading}>
        {loading && <p className="admin-empty">회원 목록을 불러오는 중입니다.</p>}
        {!loading && filteredUsers.length === 0 && (
          <p className="admin-empty">조건에 맞는 회원이 없습니다.</p>
        )}
        {filteredUsers.map((user) => {
          const isCurrentUser = String(user.email).toLowerCase() === String(currentEmail).toLowerCase()
          const hasChange = roleDrafts[user.id] && roleDrafts[user.id] !== user.appRole
          return (
            <article className="admin-user-row" key={user.id}>
              <div className="admin-user-avatar" aria-hidden="true">
                {(user.name || user.email || 'U').slice(0, 1)}
              </div>
              <div className="admin-user-identity">
                <div>
                  <strong>{user.name || '이름 없음'}</strong>
                  {isCurrentUser && <small>현재 계정</small>}
                </div>
                <span>{user.email || '이메일 없음'}</span>
                <small>
                  가입 {displayDate(user.createdAt)}
                  {' · '}
                  {user.emailConfirmed ? '이메일 인증 완료' : '이메일 인증 대기'}
                </small>
              </div>
              <div className="admin-role-control">
                <label htmlFor={`role-${user.id}`}>서비스 권한</label>
                <div>
                  <select
                    id={`role-${user.id}`}
                    value={roleDrafts[user.id] || user.appRole}
                    onChange={(event) => setRoleDrafts((current) => ({
                      ...current,
                      [user.id]: event.target.value,
                    }))}
                    disabled={!canAssignRoles || isCurrentUser || busyUserId === user.id}
                  >
                    {Object.entries(roleLabels).map(([value, label]) => (
                      <option key={value} value={value}>{label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => saveRole(user)}
                    disabled={!hasChange || !canAssignRoles || isCurrentUser || Boolean(busyUserId)}
                  >
                    <UserCog size={14} />
                    {busyUserId === user.id ? '저장 중…' : '권한 저장'}
                  </button>
                </div>
              </div>
            </article>
          )
        })}
      </div>

      <div className="admin-pagination">
        <button type="button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1 || loading}>
          <ChevronLeft size={15} />이전
        </button>
        <span>{page} / {pageCount}</span>
        <button type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= pageCount || loading}>
          다음<ChevronRight size={15} />
        </button>
      </div>
    </section>
  )
}
