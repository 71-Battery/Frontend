import {
  lazy,
  Suspense,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import gsap from 'gsap'
import {
  ArrowRight,
  Bell,
  BellOff,
  Bookmark,
  BookmarkCheck,
  BookOpenText,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  CircleAlert,
  GraduationCap,
  House,
  LoaderCircle,
  List as ListIcon,
  LogOut,
  Megaphone,
  MessageCircleQuestion,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  Sparkles,
  Sun,
  X,
} from 'lucide-react'
import AuthPage from './AuthPage.jsx'
import EmailConfirmationPage from './EmailConfirmationPage.jsx'
import FloatingObjects from './components/FloatingObjects.jsx'
import {
  logout as logoutWithBackend,
  verifyEmailConfirmation,
} from './api/authApi.js'
import { mockLogout } from './api/mockAuthApi.js'
import {
  createAdminRule,
  getAdminRules,
  getProfile,
  sendChat,
} from './api/platformApi.js'
import {
  clearSession as clearStoredSession,
  readSession as readStoredSession,
  saveSession as saveStoredSession,
} from './api/sessionStore.js'
import { AUTH_INVALIDATED_EVENT } from './api/httpClient.js'
import {
  requestNotificationPermission,
  shouldNotifyForAnswer,
  showBackgroundNotification,
} from './api/browserNotifications.js'
import {
  readPreferences,
  savePreferences,
} from './api/preferencesStore.js'
import { makeResourceKey, parseResourceKey, RESOURCE_TYPES } from './api/resourceMapper.js'
import { buildCalendarMonth, getCalendarMonths } from './api/calendarMapper.js'
import {
  getDefaultScheduleRange,
  getHomeAgenda,
  getSchedulePageCount,
  getSchedulePageIndex,
  getSchedulesForPage,
  isStrictScheduleDate,
  SCHEDULE_PAGE_DAYS,
  SCHEDULE_WINDOW_DAYS,
} from './api/scheduleMapper.js'
import { useAcademicData } from './hooks/useAcademicData.js'
import './App.css'

const MarkdownMessage = lazy(() => import('./components/MarkdownMessage.jsx'))

const departmentLabels = {
  SW_DEVELOPMENT: '소프트웨어개발과',
  SMART_IOT: '스마트IoT과',
  AI: '인공지능과',
}

const suggestions = [
  '학사규정에서 꼭 알아야 할 출결 기준을 알려줘',
  '기업 협력사별 현장실습과 채용 연계 기회를 알려줘',
  '실무프로젝트가 교육과정에서 어떻게 진행되는지 알려줘',
]

const navItems = [
  { id: 'home', label: '홈', icon: House },
  { id: 'chat', label: 'AI 질문', icon: MessageCircleQuestion },
  { id: 'timeline', label: '학사 타임라인', icon: CalendarDays },
  { id: 'notices', label: '공지·규정', icon: Megaphone },
  { id: 'saved', label: '저장한 정보', icon: Bookmark },
]


function getGrade(user) {
  return user.grade ? `${user.grade}학년` : '학년 미설정'
}

function getDepartment(user) {
  return departmentLabels[user.major] || user.majorLabel || '학과 미설정'
}

function demoAnswer(question) {
  if (/인턴|현장실습/.test(question)) return '지원 일정, 이력서, 프로젝트 설명 순서로 준비하세요. GitHub에는 본인이 맡은 기능과 배포 경험을 구체적으로 적어 두면 좋아요.'
  if (/세특|프로젝트/.test(question)) return '세특에는 맡은 역할, 사용 기술, 해결한 문제를 구체적으로 적어 보세요. 예: CI/CD 파이프라인 구성, 배포 자동화, 장애 원인 분석.'
  return '이번 달에는 실무 프로젝트 진행 상황과 인턴십 준비를 우선 확인하세요. 중요한 결정은 학교의 확정 공지도 함께 확인해 주세요.'
}

function Brand() {
  return (
    <div className="main-brand" aria-label="GSM VITA">
      <span><GraduationCap size={21} /></span>
      <strong>GSM VITA</strong>
    </div>
  )
}

function SourceBadges({ meta = {}, demo = false }) {
  const source = String(meta.profileSource || meta.source || '').toUpperCase()
  return (
    <span className="source-badges" aria-label="데이터 상태">
      {demo && <small className="source-badge demo">DEMO</small>}
      {!demo && meta.fallback && <small className="source-badge warning">로컬 프로필</small>}
      {!demo && source.includes('USER') && <small className="source-badge">사용자 저장</small>}
      {meta.stale && <small className="source-badge warning">업데이트 지연</small>}
    </span>
  )
}

function DashboardHeader({
  user,
  profileMeta,
  preferences,
  onThemeChange,
  onNotificationsChange,
  onLogout,
  loggingOut = false,
}) {
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationBusy, setNotificationBusy] = useState(false)
  const profileMenuRef = useRef(null)

  useEffect(() => {
    if (!profileOpen) return undefined

    function handlePointerDown(event) {
      if (!profileMenuRef.current?.contains(event.target)) setProfileOpen(false)
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') setProfileOpen(false)
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [profileOpen])

  async function toggleNotifications() {
    if (notificationBusy) return
    setNotificationBusy(true)
    try {
      await onNotificationsChange(!preferences.notifications)
    } finally {
      setNotificationBusy(false)
    }
  }

  return (
    <header className="dashboard-header">
      <Brand />
      <div className="header-actions">
        <div className="profile-menu" ref={profileMenuRef}>
          <button
            className="account-summary"
            type="button"
            aria-haspopup="dialog"
            aria-expanded={profileOpen}
            onClick={() => setProfileOpen((open) => !open)}
          >
            <span className="account-avatar">{user.name.slice(0, 1)}</span>
            <span className="account-copy">
              <strong>{user.name}</strong>
              <small>
                {getGrade(user)}
                {user.classNum ? ` ${user.classNum}반` : ''}
                {user.number ? ` ${user.number}번` : ''}
                {' · '}
                {getDepartment(user)}
              </small>
            </span>
            <SourceBadges meta={profileMeta} demo={user.dataSource === 'demo'} />
            <ChevronDown className="profile-chevron" size={15} />
          </button>
          {profileOpen && (
            <section className="profile-settings" role="dialog" aria-label="프로필 설정">
              <div className="profile-settings-heading">
                <span className="account-avatar large">{user.name.slice(0, 1)}</span>
                <div>
                  <strong>{user.name}</strong>
                  <small>{user.schoolEmail || user.email}</small>
                </div>
              </div>
              <div className="profile-settings-group">
                <div className="profile-setting-copy">
                  <strong>화면 모드</strong>
                  <small>원하는 화면 밝기를 선택하세요.</small>
                </div>
                <div className="theme-options" aria-label="화면 모드">
                  <button
                    className={preferences.theme === 'light' ? 'active' : ''}
                    type="button"
                    aria-pressed={preferences.theme === 'light'}
                    onClick={() => onThemeChange('light')}
                  >
                    <Sun size={15} /> 화이트
                  </button>
                  <button
                    className={preferences.theme === 'dark' ? 'active' : ''}
                    type="button"
                    aria-pressed={preferences.theme === 'dark'}
                    onClick={() => onThemeChange('dark')}
                  >
                    <Moon size={15} /> 다크
                  </button>
                </div>
              </div>
              <div className="profile-settings-group notification-setting">
                <span className="setting-symbol">
                  {preferences.notifications ? <Bell size={17} /> : <BellOff size={17} />}
                </span>
                <div className="profile-setting-copy">
                  <strong>AI 답변 알림</strong>
                  <small>AI 질문이 아닌 다른 메뉴를 볼 때 답변 도착을 알려드려요.</small>
                </div>
                <button
                  className="setting-switch"
                  type="button"
                  role="switch"
                  aria-checked={preferences.notifications}
                  aria-label="AI 답변 알림"
                  onClick={toggleNotifications}
                  disabled={notificationBusy}
                >
                  <span />
                </button>
              </div>
            </section>
          )}
        </div>
        <button
          className="icon-action"
          type="button"
          onClick={onLogout}
          aria-label={loggingOut ? '로그아웃 처리 중' : '로그아웃'}
          disabled={loggingOut}
        >
          {loggingOut ? <LoaderCircle className="spin" size={18} /> : <LogOut size={18} />}
        </button>
      </div>
    </header>
  )
}

function AppToast({ notification, onOpen, onClose }) {
  if (!notification) return null

  const content = (
    <>
      <span><Sparkles size={17} /></span>
      <span>
        <strong>{notification.title}</strong>
        <small>{notification.body}</small>
      </span>
    </>
  )

  return (
    <div className={`app-toast ${notification.tone || ''}`} role="status" aria-live="polite">
      {notification.action === 'chat'
        ? <button className="app-toast-content" type="button" onClick={onOpen}>{content}</button>
        : <div className="app-toast-content static">{content}</div>}
      <button className="app-toast-close" type="button" onClick={onClose} aria-label="알림 닫기">
        <X size={16} />
      </button>
    </div>
  )
}

function EvidenceList({ sources = [], onSourceSelect, label = '답변 근거' }) {
  if (!sources.length) return null

  return (
    <div className="answer-sources" aria-label={label}>
      {sources.slice(0, 3).map((source, index) => (
        source.kind === 'DOCUMENT' || source.type === 'DOCUMENT' ? (
          <article
            className="answer-source-document"
            key={`document:${source.document}:${index}`}
          >
            <small>{source.category || '참고 문서'}</small>
            <strong>{source.document}</strong>
            {source.snippet && <p>{source.snippet}</p>}
          </article>
        ) : (
          <button
            type="button"
            key={`${source.type}:${source.id}`}
            onClick={() => onSourceSelect(source)}
          >
            <small>{source.type === RESOURCE_TYPES.SCHEDULE ? '일정' : source.type === RESOURCE_TYPES.RULE ? '규정' : '공지'}</small>
            <strong>{source.title}</strong>
            {source.date && <span>{source.date.slice(0, 10)}</span>}
          </button>
        )
      ))}
    </div>
  )
}

function ChatPanel({ user, authToken, onSourceSelect, onAnswerReady }) {
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const endRef = useRef(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [messages, sending])

  async function ask(rawQuestion) {
    const message = rawQuestion.trim()
    if (!message || sending) return
    setQuestion('')
    setError('')
    setMessages((current) => [...current, { id: crypto.randomUUID(), role: 'user', content: message }])
    setSending(true)
    try {
      const response = user.dataSource === 'demo'
        ? {
          answer: demoAnswer(message),
          hasContext: true,
          sources: [{
            kind: 'INTERNAL',
            type: RESOURCE_TYPES.SCHEDULE,
            id: 'schedule-project',
            title: '실무프로젝트 중간보고서 제출',
            date: '2026-07-25',
          }],
        }
        : await sendChat(message, { authToken })
      setMessages((current) => [...current, {
        id: crypto.randomUUID(),
        role: 'assistant',
        content: response.answer,
        hasContext: response.hasContext,
        sources: response.sources || [],
      }])
      onAnswerReady?.()
    } catch (requestError) {
      setError(requestError.message || '답변을 불러오지 못했습니다.')
    } finally {
      setSending(false)
    }
  }

  return (
    <section className="chat-panel glass-panel reveal" aria-labelledby="chat-title">
      <div className="chat-heading">
        <span className="feature-icon"><Sparkles size={21} /></span>
        <div><p>교내 공지 · 학사정보 AI</p><h1 id="chat-title">{user.name}님, 무엇이 궁금한가요?</h1></div>
      </div>

      {messages.length === 0 ? (
        <div className="chat-empty">
          <p>규정, 학사 일정, 인턴십처럼 학교생활에 필요한 내용을 질문해 보세요.</p>
          <div className="suggestion-list">
            {suggestions.map((item) => <button type="button" key={item} onClick={() => ask(item)}>{item}<ArrowRight size={15} /></button>)}
          </div>
        </div>
      ) : (
        <div className="conversation" aria-live="polite">
          {messages.map((message) => (
            <div className={`message ${message.role}`} key={message.id}>
              {message.role === 'assistant' && <span><Sparkles size={15} /></span>}
              <div className="message-body">
                {message.role === 'assistant'
                  ? (
                    <Suspense fallback={<p>{message.content}</p>}>
                      <MarkdownMessage content={message.content} />
                    </Suspense>
                  )
                  : <p>{message.content}</p>}
                {message.hasContext === false && (
                  <div className="answer-context-empty" role="status">
                    <CircleAlert size={14} />
                    관련 근거 문서를 찾지 못했어요. 답변 범위를 확인해 주세요.
                  </div>
                )}
                {message.hasContext !== false && message.sources?.length > 0 && (
                  <EvidenceList sources={message.sources} onSourceSelect={onSourceSelect} />
                )}
              </div>
            </div>
          ))}
          {sending && <div className="message assistant loading"><span><LoaderCircle className="spin" size={15} /></span><p>학교 정보를 확인하고 있어요.</p></div>}
          <div ref={endRef} />
        </div>
      )}

      {error && <div className="inline-error" role="alert"><CircleAlert size={16} />{error}</div>}
      <form className="chat-composer" onSubmit={(event) => { event.preventDefault(); ask(question) }}>
        <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder="질문을 입력하세요" aria-label="AI에게 질문하기" maxLength={1000} disabled={sending} />
        <button type="submit" disabled={!question.trim() || sending} aria-label="질문 보내기">{sending ? <LoaderCircle className="spin" size={19} /> : <Send size={18} />}</button>
      </form>
      <p className="ai-notice"><ShieldCheck size={13} /> AI 답변은 학교의 확정 공지와 함께 확인해 주세요.</p>
    </section>
  )
}

function AgendaGroup({ label, items, onNavigate, tone }) {
  if (!items.length) return null

  return (
    <div className={`agenda-group ${tone}`}>
      <div className="agenda-group-heading">
        <span>{label}</span>
        <small>{items.length}개</small>
      </div>
      <div className="agenda-list">
        {items.map((schedule) => (
          <button type="button" key={schedule.id} onClick={() => onNavigate('timeline')}>
            <span className="agenda-date">
              <strong>{schedule.ddayValue === 0 ? '오늘' : schedule.dday}</strong>
              <small>{schedule.month} {schedule.date}일</small>
            </span>
            <span className="agenda-copy">
              <strong>{schedule.title}</strong>
              <small>{schedule.category} · {schedule.target}</small>
            </span>
            <ChevronRight size={15} />
          </button>
        ))}
      </div>
    </div>
  )
}

function TodayAgendaPanel({ schedules, scheduleStatus, onNavigate }) {
  const agenda = getHomeAgenda(schedules, 3)
  const hasAgenda = agenda.today.length > 0 || agenda.upcoming.length > 0

  return (
    <aside className="agenda-panel glass-panel reveal" aria-labelledby="agenda-title">
      <div className="panel-heading">
        <div><p>TODAY &amp; NEXT</p><h2 id="agenda-title">오늘 확인할 내용</h2></div>
        <button type="button" onClick={() => onNavigate('timeline')} aria-label="학사 타임라인 전체 보기"><ArrowRight size={17} /></button>
      </div>
      <div className="home-agenda">
        {scheduleStatus === 'loading' ? (
          <div className="agenda-state" role="status">
            <LoaderCircle className="spin" size={19} />
            <span>오늘과 다가오는 일정을 확인하고 있어요.</span>
          </div>
        ) : hasAgenda ? (
          <>
            <AgendaGroup label="오늘" items={agenda.today} onNavigate={onNavigate} tone="today" />
            <AgendaGroup label="다가오는 일정" items={agenda.upcoming} onNavigate={onNavigate} tone="upcoming" />
          </>
        ) : (
          <div className="agenda-state empty">
            <CalendarDays size={19} />
            <span>오늘과 앞으로 예정된 일정이 없어요.</span>
          </div>
        )}
      </div>
    </aside>
  )
}

function ViewHeading({ eyebrow, title, description, meta, demo = false }) {
  return (
    <div className="view-heading reveal">
      <div>
        <p>{eyebrow}</p>
        <h1>{title}</h1>
        <span>{description}</span>
      </div>
      <SourceBadges meta={meta} demo={demo} />
    </div>
  )
}

function PanelFeedback({ status, error, onRetry, emptyTitle, emptyDescription }) {
  if (status === 'loading') {
    return (
      <div className="empty-content data-feedback" aria-live="polite">
        <LoaderCircle className="spin" size={23} />
        <strong>정보를 불러오고 있어요.</strong>
        <span>잠시만 기다려 주세요.</span>
      </div>
    )
  }
  if (status === 'error') {
    return (
      <div className="empty-content data-feedback error" role="alert">
        <CircleAlert size={23} />
        <strong>정보를 불러오지 못했어요.</strong>
        <span>{error}</span>
        <button type="button" onClick={onRetry}><RefreshCw size={15} />다시 시도</button>
      </div>
    )
  }
  return (
    <div className="empty-content data-feedback">
      <CalendarDays size={23} />
      <strong>{emptyTitle}</strong>
      <span>{emptyDescription}</span>
    </div>
  )
}

function SaveButton({ saved, busy = false, onClick, label }) {
  return (
    <button
      className={`save-action ${saved ? 'saved' : ''}`}
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      disabled={busy}
      aria-label={`${label} ${saved ? '저장 취소' : '저장'}`}
    >
      {busy ? <LoaderCircle className="spin" size={17} /> : saved ? <BookmarkCheck size={17} /> : <Bookmark size={17} />}
      <span>{busy ? '처리 중' : saved ? '저장됨' : '저장'}</span>
    </button>
  )
}

function DashboardOverview({
  user,
  schedules,
  contentItems,
  scheduleStatus,
  onNavigate,
  savedCount,
}) {
  const overviewAgenda = getHomeAgenda(schedules, 1)
  const nextSchedule = overviewAgenda.today[0] || overviewAgenda.upcoming[0] || null
  const latestNotice = contentItems[0] || null

  return (
    <section className="overview-panel glass-panel reveal" aria-labelledby="overview-title">
      <div className="overview-heading">
        <span className="feature-icon"><House size={21} /></span>
        <div><p>오늘의 학사 브리핑</p><h1 id="overview-title">{user.name}님이 먼저 볼 정보예요.</h1></div>
      </div>
      {nextSchedule ? (
        <div className="overview-priority">
          <span className="priority-date"><strong>{nextSchedule.date}</strong><small>{nextSchedule.month}</small></span>
          <div><span>{nextSchedule.category} · {nextSchedule.dday}</span><strong>{nextSchedule.title}</strong><p>{nextSchedule.description}</p></div>
          <button type="button" onClick={() => onNavigate('timeline')} aria-label="학사 타임라인에서 확인"><ArrowRight size={18} /></button>
        </div>
      ) : (
        <div className="overview-priority overview-placeholder">
          {scheduleStatus === 'loading' ? <LoaderCircle className="spin" size={22} /> : <CalendarDays size={22} />}
          <div>
            <strong>{scheduleStatus === 'loading' ? '다가오는 일정을 확인하고 있어요.' : '표시할 일정이 없어요.'}</strong>
            <p>학사 타임라인에서 조회 상태를 확인할 수 있어요.</p>
          </div>
          <button type="button" onClick={() => onNavigate('timeline')} aria-label="학사 타임라인에서 확인"><ArrowRight size={18} /></button>
        </div>
      )}
      <div className="overview-links">
        <button type="button" onClick={() => onNavigate('chat')}>
          <span><MessageCircleQuestion size={18} /></span>
          <div><strong>AI에게 질문하기</strong><small>학교생활 정보를 쉽게 물어보세요.</small></div>
          <ArrowRight size={16} />
        </button>
        <button type="button" onClick={() => onNavigate('notices')}>
          <span><Megaphone size={18} /></span>
          <div>
            <strong>{latestNotice?.title || '공지·규정 확인하기'}</strong>
            <small>{latestNotice ? `${latestNotice.department}의 최신 ${latestNotice.type === RESOURCE_TYPES.RULE ? '규정' : '공지'}` : '게시된 학교 정보를 확인하세요.'}</small>
          </div>
          <ArrowRight size={16} />
        </button>
        <button type="button" onClick={() => onNavigate('saved')}>
          <span><BookmarkCheck size={18} /></span>
          <div><strong>저장한 정보 {savedCount}개</strong><small>다시 볼 일정과 공지를 확인하세요.</small></div>
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}

function TimelineView({
  events,
  status,
  error,
  meta,
  retry,
  isDemo,
  savedKeys,
  savingKeys,
  savedStatus,
  toggleSaved,
  selectedResourceId,
}) {
  const [selectedId, setSelectedId] = useState(null)
  const [pageIndex, setPageIndex] = useState(0)
  const [viewMode, setViewMode] = useState('list')
  const [calendarMonthIndex, setCalendarMonthIndex] = useState(0)
  const timelineModeRef = useRef(null)
  const pageCount = useMemo(() => getSchedulePageCount(events), [events])
  const pageEvents = useMemo(() => getSchedulesForPage(events, pageIndex), [events, pageIndex])
  const fallbackRange = useMemo(() => getDefaultScheduleRange(), [])
  const rangeStart = isStrictScheduleDate(meta?.fromDate) ? meta.fromDate : fallbackRange.fromDate
  const rangeEnd = isStrictScheduleDate(meta?.toDate) ? meta.toDate : fallbackRange.toDate
  const calendarMonths = useMemo(() => getCalendarMonths(rangeStart, rangeEnd), [rangeEnd, rangeStart])
  const calendarMonth = calendarMonths[calendarMonthIndex] || calendarMonths[0] || null
  const calendarCells = useMemo(
    () => buildCalendarMonth(calendarMonth, rangeStart, rangeEnd, events),
    [calendarMonth, events, rangeEnd, rangeStart],
  )
  const calendarMonthEvents = useMemo(
    () => events.filter((event) => event.scheduleDate.startsWith(`${calendarMonth?.key || 'none'}-`)),
    [calendarMonth, events],
  )

  useLayoutEffect(() => {
    const target = timelineModeRef.current
    if (!target) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set(target, { clearProps: 'all' })
      return undefined
    }
    const animation = gsap.fromTo(
      target,
      { autoAlpha: 0, y: 10, scale: 0.992, filter: 'blur(3px)' },
      {
        autoAlpha: 1,
        y: 0,
        scale: 1,
        filter: 'blur(0px)',
        duration: 0.34,
        ease: 'power2.out',
        clearProps: 'opacity,visibility,transform,filter',
      },
    )
    return () => animation.kill()
  }, [viewMode])

  useEffect(() => {
    const focusedEvent = events.find((event) => event.id === selectedResourceId)
    const focusedPageIndex = getSchedulePageIndex(focusedEvent)
    if (focusedPageIndex < 0) return
    setPageIndex(focusedPageIndex)
    const focusedMonthIndex = calendarMonths.findIndex((month) => focusedEvent.scheduleDate.startsWith(`${month.key}-`))
    if (focusedMonthIndex >= 0) setCalendarMonthIndex(focusedMonthIndex)
    setSelectedId(focusedEvent.id)
  }, [calendarMonths, events, selectedResourceId])

  useEffect(() => {
    if (pageIndex < pageCount) return
    setPageIndex(pageCount - 1)
  }, [pageCount, pageIndex])

  useEffect(() => {
    if (viewMode !== 'list') return
    setSelectedId((current) => (
      selectedResourceId && pageEvents.some((event) => event.id === selectedResourceId)
        ? selectedResourceId
        : current && pageEvents.some((event) => event.id === current)
        ? current
        : pageEvents[0]?.id || null
    ))
  }, [pageEvents, selectedResourceId, viewMode])

  useEffect(() => {
    if (calendarMonthIndex < calendarMonths.length) return
    setCalendarMonthIndex(Math.max(0, calendarMonths.length - 1))
  }, [calendarMonthIndex, calendarMonths.length])

  useEffect(() => {
    if (viewMode !== 'calendar') return
    setSelectedId((current) => (
      selectedResourceId && calendarMonthEvents.some((event) => event.id === selectedResourceId)
        ? selectedResourceId
        : current && calendarMonthEvents.some((event) => event.id === current)
        ? current
        : calendarMonthEvents[0]?.id || null
    ))
  }, [calendarMonthEvents, selectedResourceId, viewMode])

  const selected = events.find((event) => event.id === selectedId) || null

  function selectPage(nextPageIndex) {
    setPageIndex(nextPageIndex)
    setSelectedId(getSchedulesForPage(events, nextPageIndex)[0]?.id || null)
  }

  function selectCalendarMonth(nextMonthIndex) {
    const nextMonth = calendarMonths[nextMonthIndex]
    if (!nextMonth) return
    setCalendarMonthIndex(nextMonthIndex)
    setSelectedId(events.find((event) => event.scheduleDate.startsWith(`${nextMonth.key}-`))?.id || null)
  }

  function changeViewMode(nextMode) {
    setViewMode(nextMode)
    if (!selected) return
    if (nextMode === 'list') {
      const selectedPageIndex = getSchedulePageIndex(selected)
      if (selectedPageIndex >= 0) setPageIndex(selectedPageIndex)
      return
    }
    const selectedMonthIndex = calendarMonths.findIndex((month) => selected.scheduleDate.startsWith(`${month.key}-`))
    if (selectedMonthIndex >= 0) setCalendarMonthIndex(selectedMonthIndex)
  }

  return (
    <div className="content-view">
      <ViewHeading
        eyebrow="ACADEMIC TIMELINE"
        title="학사 타임라인"
        description={`오늘부터 ${SCHEDULE_WINDOW_DAYS}일 동안의 학사 일정을 날짜순으로 확인합니다.`}
        meta={meta}
        demo={isDemo}
      />
      <div className="timeline-layout">
        <section className="timeline-panel glass-panel reveal" aria-label="학사 일정 목록">
          <div className="content-panel-heading">
            <div>
              <strong>다가오는 일정</strong>
              <span>{viewMode === 'list' ? `${SCHEDULE_PAGE_DAYS}일씩 나누어 가까운 순서로 정리했어요.` : '월별 달력에서 날짜와 일정을 확인하세요.'}</span>
            </div>
            <div className="timeline-view-toggle" role="group" aria-label="학사 일정 보기 방식">
              <button className={viewMode === 'list' ? 'active' : ''} type="button" onClick={() => changeViewMode('list')} aria-pressed={viewMode === 'list'}>
                <ListIcon size={14} />목록으로 보기
              </button>
              <button className={viewMode === 'calendar' ? 'active' : ''} type="button" onClick={() => changeViewMode('calendar')} aria-pressed={viewMode === 'calendar'}>
                <CalendarDays size={14} />달력으로 보기
              </button>
            </div>
          </div>
          {status === 'error' && events.length > 0 && (
            <div className="partial-error" role="status"><CircleAlert size={15} />{error}<button type="button" onClick={retry}>다시 시도</button></div>
          )}
          <div className="timeline-mode-content" ref={timelineModeRef}>
            {events.length === 0 ? (
              <PanelFeedback
                status={status}
                error={error}
                onRetry={retry}
                emptyTitle="조회 기간에 등록된 일정이 없어요."
                emptyDescription="새 일정이 등록되면 이곳에 표시됩니다."
              />
            ) : viewMode === 'list' && pageEvents.length > 0 ? (
              <ol className="timeline-list">
                {pageEvents.map((event) => (
                  <li key={event.id}>
                    <button
                      className={`timeline-row ${selectedId === event.id ? 'selected' : ''}`}
                      type="button"
                      onClick={() => setSelectedId(event.id)}
                      aria-current={selectedId === event.id ? 'true' : undefined}
                    >
                      <time><strong>{event.date}</strong><span>{event.month}</span></time>
                      <span className={`timeline-marker ${event.tone}`} />
                      <span className="timeline-row-copy">
                        <span><em>{event.category}</em><small>{event.target}</small></span>
                        <strong>{event.title}</strong>
                        <small>{event.description}</small>
                      </span>
                      <b className={event.tone}>{event.dday}</b>
                    </button>
                  </li>
                ))}
              </ol>
            ) : viewMode === 'list' ? (
              <div className="empty-content data-feedback">
                <CalendarDays size={23} />
                <strong>이 기간에는 일정이 없어요.</strong>
                <span>다른 번호의 목록을 확인해 보세요.</span>
              </div>
            ) : (
              <div className="academic-calendar">
                <div className="calendar-navigation">
                  <button type="button" onClick={() => selectCalendarMonth(calendarMonthIndex - 1)} disabled={calendarMonthIndex === 0} aria-label="이전 달">
                    <ChevronLeft size={17} />
                  </button>
                  <div>
                    <strong>{calendarMonth?.label || '달력'}</strong>
                    <span>{calendarMonthEvents.length}개 일정</span>
                  </div>
                  <button type="button" onClick={() => selectCalendarMonth(calendarMonthIndex + 1)} disabled={calendarMonthIndex >= calendarMonths.length - 1} aria-label="다음 달">
                    <ChevronRight size={17} />
                  </button>
                </div>
                <div className="calendar-weekdays" aria-hidden="true">
                  {['일', '월', '화', '수', '목', '금', '토'].map((weekday) => <span key={weekday}>{weekday}</span>)}
                </div>
                <div className="calendar-grid" role="grid" aria-label={`${calendarMonth?.label || ''} 학사 일정`}>
                  {calendarCells.map((cell) => (
                    <div
                      className={`calendar-day ${cell.inMonth ? '' : 'outside-month'} ${cell.inRange ? '' : 'outside-range'} ${cell.isToday ? 'today' : ''}`}
                      key={cell.scheduleDate}
                      role="gridcell"
                    >
                      <time dateTime={cell.scheduleDate}>{cell.day}</time>
                      <div className="calendar-day-events">
                        {cell.events.slice(0, 2).map((event) => (
                          <button
                            className={`calendar-event ${event.tone} ${selectedId === event.id ? 'selected' : ''}`}
                            type="button"
                            key={event.id}
                            onClick={() => setSelectedId(event.id)}
                            aria-label={`${cell.scheduleDate} ${event.title}`}
                            title={event.title}
                          >
                            <span>{event.title}</span>
                          </button>
                        ))}
                        {cell.events.length > 2 && <small className="calendar-more">+{cell.events.length - 2}</small>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {events.length > 0 && viewMode === 'list' && (
              <nav className="timeline-pagination" aria-label="학사 일정 목록 페이지">
                {Array.from({ length: pageCount }, (_, index) => (
                  <button
                    className={pageIndex === index ? 'active' : ''}
                    type="button"
                    key={index}
                    onClick={() => selectPage(index)}
                    aria-current={pageIndex === index ? 'page' : undefined}
                    aria-label={`${index + 1}번 목록`}
                  >
                    {index + 1}
                  </button>
                ))}
              </nav>
            )}
          </div>
        </section>

        {selected ? (
          <aside className="detail-panel glass-panel reveal" aria-labelledby="selected-schedule-title">
            <div className={`detail-symbol ${selected.tone}`}><CalendarDays size={23} /></div>
            <p>선택한 일정 · {selected.source}</p>
            <h2 id="selected-schedule-title">{selected.title}</h2>
            <span className="detail-description">{selected.description}</span>
            <dl>
              <div><dt>날짜</dt><dd>{selected.scheduleDate}</dd></div>
              <div><dt>대상</dt><dd>{selected.target}</dd></div>
              <div><dt>분류</dt><dd>{selected.category}</dd></div>
              {selected.school.name && <div><dt>학교</dt><dd>{selected.school.name}</dd></div>}
            </dl>
            <div className="detail-tip"><Sparkles size={17} /><span><strong>맞춤 안내</strong>프로필과 관련된 일정은 AI 질문에서 준비 방법을 물어볼 수 있어요.</span></div>
            <SaveButton
              saved={savedKeys.has(makeResourceKey(RESOURCE_TYPES.SCHEDULE, selected.id))}
              busy={savedStatus === 'loading' || savingKeys.has(makeResourceKey(RESOURCE_TYPES.SCHEDULE, selected.id))}
              onClick={() => toggleSaved(RESOURCE_TYPES.SCHEDULE, selected.id)}
              label={selected.title}
            />
          </aside>
        ) : (
          <aside className="detail-panel glass-panel reveal">
            <div className="empty-content detail-empty"><CalendarDays size={22} /><strong>선택할 일정이 없어요.</strong><span>일정이 준비되면 상세 내용을 확인할 수 있어요.</span></div>
          </aside>
        )}
      </div>
    </div>
  )
}

function NoticesView({
  items,
  noticeState,
  regulationState,
  retry,
  isDemo,
  savedKeys,
  savingKeys,
  savedStatus,
  toggleSaved,
  selectedResourceId,
}) {
  const [query, setQuery] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const filtered = items.filter((notice) => (
    `${notice.title} ${notice.summary} ${notice.department} ${notice.category}`.toLowerCase().includes(query.trim().toLowerCase())
  ))
  const selected = filtered.find((notice) => notice.id === selectedId) || filtered[0] || null
  const meta = {
    source: isDemo ? 'DEMO' : 'INTERNAL_DB',
    stale: noticeState.meta.stale || regulationState.meta.stale,
  }
  const status = items.length > 0
    ? 'ready'
    : noticeState.status === 'loading' || regulationState.status === 'loading'
      ? 'loading'
      : noticeState.status === 'error' && regulationState.status === 'error'
        ? 'error'
        : 'ready'
  const combinedError = [noticeState.error, regulationState.error].filter(Boolean).join(' ')

  useEffect(() => {
    if (selectedResourceId && items.some((item) => item.id === selectedResourceId)) {
      setQuery('')
      setSelectedId(selectedResourceId)
      return
    }
    if (!selectedId || !items.some((item) => item.id === selectedId)) setSelectedId(items[0]?.id || null)
  }, [items, selectedId, selectedResourceId])

  return (
    <div className="content-view">
      <ViewHeading
        eyebrow="NOTICE & RULES"
        title="공지·규정"
        description="게시된 공지와 규정을 한곳에서 찾습니다."
        meta={meta}
        demo={isDemo}
      />
      <div className="notice-layout">
        <section className="notice-panel glass-panel reveal">
          <label className="notice-search">
            <Search size={18} aria-hidden="true" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="공지와 규정을 검색하세요" aria-label="공지와 규정 검색" />
          </label>
          <div className="notice-list" aria-live="polite">
            {noticeState.status === 'error' && items.length > 0 && (
              <div className="partial-error"><CircleAlert size={15} />공지 일부를 불러오지 못했어요.<button type="button" onClick={retry}>다시 시도</button></div>
            )}
            {regulationState.status === 'error' && items.length > 0 && (
              <div className="partial-error"><CircleAlert size={15} />규정 일부를 불러오지 못했어요.<button type="button" onClick={retry}>다시 시도</button></div>
            )}
            {filtered.map((notice) => (
              <article className={`notice-row ${selected?.id === notice.id ? 'selected' : ''}`} key={notice.id}>
                <button className="notice-row-main" type="button" onClick={() => setSelectedId(notice.id)}>
                  <span className="notice-meta">
                    <em>{notice.type === RESOURCE_TYPES.RULE ? '규정' : '공지'}</em>
                    <em>{notice.category}</em>
                    <small>{notice.date}</small>
                  </span>
                  <strong>{notice.title}</strong>
                  <p>{notice.summary}</p>
                  <span className="notice-source"><Megaphone size={14} />{notice.department} · {notice.target}</span>
                </button>
                <SaveButton
                  saved={savedKeys.has(makeResourceKey(notice.type, notice.id))}
                  busy={savedStatus === 'loading' || savingKeys.has(makeResourceKey(notice.type, notice.id))}
                  onClick={() => toggleSaved(notice.type, notice.id)}
                  label={notice.title}
                />
              </article>
            ))}
            {!items.length && (
              <PanelFeedback
                status={status}
                error={combinedError}
                onRetry={retry}
                emptyTitle="게시된 공지와 규정이 없어요."
                emptyDescription="새 정보가 게시되면 이곳에 표시됩니다."
              />
            )}
            {items.length > 0 && !filtered.length && (
              <div className="empty-content"><Search size={22} /><strong>검색 결과가 없어요.</strong><span>다른 검색어를 입력해 보세요.</span></div>
            )}
          </div>
        </section>

        {selected ? (
          <aside className="detail-panel notice-detail glass-panel reveal" aria-labelledby="selected-notice-title">
            <div className="detail-symbol accent">{selected.type === RESOURCE_TYPES.RULE ? <ShieldCheck size={23} /> : <BookOpenText size={23} />}</div>
            <p>{selected.type === RESOURCE_TYPES.RULE ? '규정' : '공지'} · {selected.category} · {selected.department}</p>
            <h2 id="selected-notice-title">{selected.title}</h2>
            <span className="detail-description">{selected.content || selected.summary}</span>
            <dl>
              <div><dt>등록일</dt><dd>{selected.date}</dd></div>
              <div><dt>대상</dt><dd>{selected.target}</dd></div>
              <div><dt>버전</dt><dd>v{selected.version}</dd></div>
            </dl>
            <div className="detail-tip"><Sparkles size={17} /><span><strong>추천 이유</strong>{selected.reason}</span></div>
          </aside>
        ) : (
          <aside className="detail-panel glass-panel reveal">
            <div className="empty-content detail-empty"><Search size={22} /><strong>선택할 정보가 없어요.</strong><span>검색어를 바꾸면 상세 내용을 볼 수 있어요.</span></div>
          </aside>
        )}
      </div>
    </div>
  )
}

function SavedView({
  schedules,
  contentItems,
  savedState,
  savedKeys,
  savingKeys,
  toggleSaved,
  retry,
  isDemo,
}) {
  const resourceLookup = new Map([
    ...schedules.map((item) => [makeResourceKey(RESOURCE_TYPES.SCHEDULE, item.id), {
      ...item,
      resourceType: RESOURCE_TYPES.SCHEDULE,
      subtitle: `${item.category} · ${item.month} ${item.date}일`,
      body: item.description,
    }]),
    ...contentItems.map((item) => [makeResourceKey(item.type, item.id), {
      ...item,
      resourceType: item.type,
      subtitle: `${item.type === RESOURCE_TYPES.RULE ? '규정' : '공지'} · ${item.department}`,
      body: item.summary,
    }]),
  ])
  const savedRecordLookup = new Map(savedState.items.map((item) => [
    makeResourceKey(item.resourceType, item.resourceId),
    item,
  ]))
  const savedItems = [...savedKeys].map((key) => {
    const known = resourceLookup.get(key)
    if (known) return known
    const parsed = parseResourceKey(key)
    const record = savedRecordLookup.get(key)
    return parsed ? {
      id: parsed.resourceId,
      resourceType: parsed.resourceType,
      title: record?.title || '현재 조회 범위 밖의 저장 정보',
      subtitle: parsed.resourceType === RESOURCE_TYPES.SCHEDULE ? '학사 일정' : parsed.resourceType === RESOURCE_TYPES.RULE ? '규정' : '공지',
      body: '원본 정보를 다시 조회하면 상세 내용이 표시됩니다.',
    } : null
  }).filter(Boolean)
  const total = savedItems.length

  return (
    <div className="content-view">
      <ViewHeading
        eyebrow="MY LIBRARY"
        title="저장한 정보"
        description="다시 확인할 일정과 공지를 한곳에 모았습니다."
        meta={savedState.meta}
        demo={isDemo}
      />
      <section className="saved-panel glass-panel reveal">
        <div className="content-panel-heading">
          <div><strong>저장 목록</strong><span>{total}개의 정보를 저장했어요.</span></div>
          <BookmarkCheck size={19} />
        </div>
        {savedState.status === 'error' && total > 0 && (
          <div className="partial-error"><CircleAlert size={15} />{savedState.error}<button type="button" onClick={retry}>다시 시도</button></div>
        )}
        {total ? (
          <div className="saved-grid">
            {savedItems.map((item) => {
              const key = makeResourceKey(item.resourceType, item.id)
              return (
                <article className="saved-card" key={key}>
                  <span className={`saved-card-icon ${item.resourceType !== RESOURCE_TYPES.SCHEDULE ? 'notice' : ''}`}>
                    {item.resourceType === RESOURCE_TYPES.SCHEDULE ? <CalendarDays size={18} /> : item.resourceType === RESOURCE_TYPES.RULE ? <ShieldCheck size={18} /> : <Megaphone size={18} />}
                  </span>
                  <div><small>{item.subtitle}</small><strong>{item.title}</strong><p>{item.body}</p></div>
                  <SaveButton
                    saved
                    busy={savingKeys.has(key)}
                    onClick={() => toggleSaved(item.resourceType, item.id)}
                    label={item.title}
                  />
                </article>
              )
            })}
          </div>
        ) : (
          <PanelFeedback
            status={savedState.status}
            error={savedState.error}
            onRetry={retry}
            emptyTitle="저장한 정보가 아직 없어요."
            emptyDescription="일정이나 공지의 저장 버튼을 눌러 모아보세요."
          />
        )}
      </section>
    </div>
  )
}

function AdminRules({ authToken }) {
  const [open, setOpen] = useState(false)
  const [rules, setRules] = useState([])
  const [form, setForm] = useState({ title: '', content: '', category: 'GENERAL' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    getAdminRules({ authToken, signal: controller.signal }).then(setRules).catch((requestError) => {
      if (requestError.name !== 'AbortError') setError(requestError.message)
    })
    return () => controller.abort()
  }, [authToken, open])

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim() || busy) return
    setBusy(true)
    setError('')
    try {
      const created = await createAdminRule(form, { authToken })
      setRules((current) => [created, ...current])
      setForm({ title: '', content: '', category: 'GENERAL' })
    } catch (requestError) {
      setError(requestError.message || '규칙을 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="admin-panel glass-panel">
      <button className="admin-toggle" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>관리자 규칙 <ChevronDown size={17} /></button>
      {open && (
        <div className="admin-content">
          <form onSubmit={submit}>
            <input value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} placeholder="규칙 제목" aria-label="규칙 제목" />
            <textarea value={form.content} onChange={(event) => setForm({ ...form, content: event.target.value })} placeholder="규칙 내용" aria-label="규칙 내용" />
            <button type="submit" disabled={busy || !form.title.trim() || !form.content.trim()}><Plus size={16} />규칙 추가</button>
          </form>
          {error && <p className="inline-error" role="alert">{error}</p>}
          <div className="rule-list">
            {rules.map((rule) => <article key={rule.id || `${rule.title}-${rule.category}`}><span>{rule.category || 'GENERAL'}</span><strong>{rule.title}</strong><p>{rule.content}</p></article>)}
          </div>
        </div>
      )}
    </section>
  )
}

function PrimaryNavigation({ activeView, onChange, savedCount }) {
  return (
    <nav className="primary-tabs" aria-label="주요 메뉴">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          type="button"
          className={activeView === id ? 'active' : ''}
          aria-current={activeView === id ? 'page' : undefined}
          onClick={() => onChange(id)}
        >
          <Icon size={17} />
          <span>{label}</span>
          {id === 'saved' && savedCount > 0 && <small>{savedCount}</small>}
        </button>
      ))}
    </nav>
  )
}

function MainDashboard({ session, onLogout, loggingOut = false }) {
  const { user, token: authToken, permissions, meta: profileMeta } = session
  const [activeView, setActiveView] = useState('home')
  const [focusedResource, setFocusedResource] = useState(null)
  const [preferences, setPreferences] = useState(readPreferences)
  const [toast, setToast] = useState(null)
  const activeViewRef = useRef(activeView)
  const preferencesRef = useRef(preferences)
  const academic = useAcademicData({ user, authToken })
  const contentItems = [...academic.notices.items, ...academic.regulations.items].sort((left, right) => (
    String(right.publishedAt || right.effectiveFrom).localeCompare(String(left.publishedAt || left.effectiveFrom))
  ))
  const isAdmin = permissions.canManageContent
  const isDemo = user.dataSource === 'demo'
  const viewRef = useRef(null)
  const savedCount = academic.savedKeys.size

  activeViewRef.current = activeView
  preferencesRef.current = preferences

  useLayoutEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined
    const targets = viewRef.current?.querySelectorAll('.reveal') || []
    const animation = gsap.fromTo(targets, { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.48, stagger: 0.055, ease: 'power3.out', clearProps: 'opacity,visibility,transform' })
    return () => animation.kill()
  }, [activeView])

  function handleSourceSelect(source) {
    setFocusedResource({ type: source.type, id: source.id })
    setActiveView(source.type === RESOURCE_TYPES.SCHEDULE ? 'timeline' : 'notices')
  }

  function updatePreferences(patch) {
    setPreferences((current) => {
      const next = { ...current, ...patch }
      savePreferences(next)
      return next
    })
  }

  function handleThemeChange(theme) {
    updatePreferences({ theme })
  }

  async function handleNotificationsChange(enabled) {
    if (!enabled) {
      updatePreferences({ notifications: false })
      return
    }

    const permission = await requestNotificationPermission()
    if (permission !== 'granted') {
      updatePreferences({ notifications: false })
      setToast({
        tone: 'warning',
        title: permission === 'unsupported' ? '알림을 지원하지 않는 브라우저예요' : '알림 권한이 필요해요',
        body: permission === 'unsupported'
          ? '지원되는 브라우저에서 다시 설정해 주세요.'
          : '브라우저 설정에서 이 사이트의 알림을 허용해 주세요.',
      })
      return
    }

    updatePreferences({ notifications: true })
  }

  function openChatFromNotification() {
    window.focus()
    setActiveView('chat')
    setToast(null)
  }

  function handleAnswerReady() {
    if (!shouldNotifyForAnswer({
      notificationsEnabled: preferencesRef.current.notifications,
      activeView: activeViewRef.current,
    })) return

    const notification = {
      title: 'AI 답변이 도착했어요',
      body: 'AI 질문 탭에서 준비된 답변을 확인해 보세요.',
      action: 'chat',
    }
    setToast(notification)
    showBackgroundNotification({
      ...notification,
      onClick: openChatFromNotification,
    })
  }

  return (
    <div className="dashboard-shell" data-theme={preferences.theme}>
      <div className="ambient ambient-one" aria-hidden="true" /><div className="ambient ambient-two" aria-hidden="true" />
      <FloatingObjects />
      <a className="skip-link" href="#main-content">본문으로 바로가기</a>
      <DashboardHeader
        user={user}
        profileMeta={profileMeta}
        preferences={preferences}
        onThemeChange={handleThemeChange}
        onNotificationsChange={handleNotificationsChange}
        onLogout={onLogout}
        loggingOut={loggingOut}
      />
      <AppToast
        notification={toast}
        onOpen={openChatFromNotification}
        onClose={() => setToast(null)}
      />
      <main className="dashboard-main" id="main-content">
        <PrimaryNavigation activeView={activeView} onChange={setActiveView} savedCount={savedCount} />
        {academic.saveError && <div className="global-data-error" role="alert"><CircleAlert size={16} />{academic.saveError}</div>}
        <div className="active-view" ref={viewRef}>
          {activeView === 'home' && (
            <div className="dashboard-grid">
              <DashboardOverview
                user={user}
                schedules={academic.schedules.items}
                contentItems={contentItems}
                scheduleStatus={academic.schedules.status}
                onNavigate={setActiveView}
                savedCount={savedCount}
              />
              <TodayAgendaPanel
                schedules={academic.schedules.items}
                scheduleStatus={academic.schedules.status}
                onNavigate={setActiveView}
              />
            </div>
          )}
          <div className="single-view" hidden={activeView !== 'chat'}>
            <ChatPanel
              user={user}
              authToken={authToken}
              onSourceSelect={handleSourceSelect}
              onAnswerReady={handleAnswerReady}
            />
          </div>
          {activeView === 'timeline' && (
            <TimelineView
              events={academic.schedules.items}
              status={academic.schedules.status}
              error={academic.schedules.error}
              meta={academic.schedules.meta}
              retry={academic.retry}
              isDemo={isDemo}
              savedKeys={academic.savedKeys}
              savingKeys={academic.savingKeys}
              savedStatus={academic.saved.status}
              toggleSaved={academic.toggleSaved}
              selectedResourceId={focusedResource?.type === RESOURCE_TYPES.SCHEDULE ? focusedResource.id : null}
            />
          )}
          {activeView === 'notices' && (
            <>
              <NoticesView
                items={contentItems}
                noticeState={academic.notices}
                regulationState={academic.regulations}
                retry={academic.retry}
                isDemo={isDemo}
                savedKeys={academic.savedKeys}
                savingKeys={academic.savingKeys}
                savedStatus={academic.saved.status}
                toggleSaved={academic.toggleSaved}
                selectedResourceId={focusedResource?.type !== RESOURCE_TYPES.SCHEDULE ? focusedResource?.id : null}
              />
              {isAdmin && <AdminRules authToken={authToken} />}
            </>
          )}
          {activeView === 'saved' && (
            <SavedView
              schedules={academic.schedules.items}
              contentItems={contentItems}
              savedState={academic.saved}
              savedKeys={academic.savedKeys}
              savingKeys={academic.savingKeys}
              toggleSaved={academic.toggleSaved}
              retry={academic.retry}
              isDemo={isDemo}
            />
          )}
        </div>
      </main>
    </div>
  )
}

function isStoredAuthenticationError(error) {
  return error?.status === 401 || error?.status === 410 || [
    'ACCOUNT_REMOVED',
    'UNAUTHORIZED',
    'USER_NOT_FOUND',
    'INVALID_TOKEN',
    'INVALID_AUTH_IDENTITY',
  ].includes(error?.code)
}

function SessionRestoreScreen() {
  return (
    <main className="session-restore-screen" role="status" aria-live="polite">
      <span><LoaderCircle className="spin" size={24} /></span>
      <strong>로그인 상태를 확인하고 있어요</strong>
      <p>잠시만 기다려 주세요.</p>
    </main>
  )
}

function App({ initialRoute = { kind: 'app' } }) {
  const [session, setSession] = useState(null)
  const [loggingOut, setLoggingOut] = useState(false)
  const [confirmationStatus, setConfirmationStatus] = useState('checking')
  const [sessionStatus, setSessionStatus] = useState(
    initialRoute.kind === 'email-confirmation' ? 'ready' : 'restoring',
  )

  useEffect(() => {
    const invalidateSession = () => {
      clearStoredSession()
      setSession(null)
      setSessionStatus('ready')
    }
    window.addEventListener(AUTH_INVALIDATED_EVENT, invalidateSession)
    return () => window.removeEventListener(
      AUTH_INVALIDATED_EVENT,
      invalidateSession,
    )
  }, [])

  useEffect(() => {
    if (initialRoute.kind !== 'email-confirmation') return undefined

    const controller = new AbortController()
    verifyEmailConfirmation({
      authToken: initialRoute.accessToken,
      signal: controller.signal,
    })
      .then(() => setConfirmationStatus('complete'))
      .catch(() => {
        if (!controller.signal.aborted) window.location.replace('/')
      })

    return () => controller.abort()
  }, [initialRoute])

  useEffect(() => {
    if (initialRoute.kind === 'email-confirmation') return undefined

    const storedSession = readStoredSession()
    if (!storedSession) {
      setSessionStatus('ready')
      return undefined
    }

    if (storedSession.user.dataSource === 'demo') {
      setSession(storedSession)
      setSessionStatus('ready')
      return undefined
    }

    const controller = new AbortController()
    let active = true
    getProfile({
      authToken: storedSession.token,
      signal: controller.signal,
    })
      .then((profileResponse) => {
        if (!active) return
        const restoredSession = {
          user: profileResponse.profile,
          token: storedSession.token,
          permissions: profileResponse.permissions,
          meta: profileResponse.meta,
        }
        saveStoredSession(restoredSession)
        setSession(restoredSession)
      })
      .catch((error) => {
        if (!active || controller.signal.aborted) return
        if (isStoredAuthenticationError(error)) {
          clearStoredSession()
          setSession(null)
          return
        }

        // Keep a validated local snapshot during a temporary backend cold
        // start. Protected requests still verify the token on the backend.
        setSession(storedSession)
      })
      .finally(() => {
        if (active) setSessionStatus('ready')
      })

    return () => {
      active = false
      controller.abort()
    }
  }, [initialRoute.kind])

  function handleAuthenticated(authenticated) {
    const nextSession = {
      user: authenticated.user,
      token: authenticated.token || '',
      permissions: {
        canManageContent: authenticated.permissions?.canManageContent === true,
      },
      meta: authenticated.meta || {},
    }
    saveStoredSession(nextSession)
    setSession(nextSession)
  }

  async function handleLogout() {
    if (loggingOut) return

    setLoggingOut(true)
    clearStoredSession()
    try {
      if (session?.user?.dataSource === 'demo') {
        await mockLogout()
      } else if (session?.token) {
        await logoutWithBackend({ authToken: session.token })
      }
    } catch {
      // Always remove the browser-held token, even if the provider is offline.
    } finally {
      setSession(null)
      setLoggingOut(false)
    }
  }

  if (initialRoute.kind === 'email-confirmation') {
    return <EmailConfirmationPage status={confirmationStatus} />
  }
  if (sessionStatus === 'restoring') return <SessionRestoreScreen />
  if (!session) return <AuthPage onAuthenticated={handleAuthenticated} />
  return (
    <MainDashboard
      session={session}
      onLogout={handleLogout}
      loggingOut={loggingOut}
    />
  )
}

export default App
