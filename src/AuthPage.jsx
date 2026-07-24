import {
  lazy,
  Suspense,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from 'react'
import gsap from 'gsap'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Mail,
  MailCheck,
  RefreshCw,
  Sparkles,
  UserRound,
  X,
} from 'lucide-react'
import {
  login as loginWithBackend,
  resendVerification as resendVerificationEmail,
  signup as signupWithBackend,
} from './api/authApi.js'
import { createDemoSession } from './api/mockAuthApi.js'
import { getLegalDocument } from './legalDocuments.js'
import { displayEmail } from './utils/piiMask.js'
import './AuthPage.css'

const initialLogin = { email: '', password: '' }
const FloatingObjects = lazy(() => import('./components/FloatingObjects.jsx'))
const SCHOOL_EMAIL_DOMAIN = '@gsm.hs.kr'
const EMAIL_LOCAL_PATTERN = /^[A-Za-z0-9._%+-]+$/
const initialSignup = {
  name: '',
  studentNumber: '',
  schoolEmail: '',
  password: '',
  passwordConfirm: '',
  terms: false,
  privacy: false,
  notifications: false,
}

function normalizeEmailLocal(value) {
  const compactValue = value.replace(/\s/g, '')
  if (compactValue.toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN)) {
    return compactValue.slice(0, -SCHOOL_EMAIL_DOMAIN.length)
  }
  return compactValue
}

function isValidEmailLocal(value) {
  return value.length <= 64
    && EMAIL_LOCAL_PATTERN.test(value)
    && !value.startsWith('.')
    && !value.endsWith('.')
    && !value.includes('..')
}

function getRemainingSeconds(timestamp, now) {
  const target = timestamp ? Date.parse(timestamp) : Number.NaN
  if (!Number.isFinite(target)) return 0
  return Math.max(0, Math.ceil((target - now) / 1000))
}

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatAccountCountdown(totalSeconds) {
  if (totalSeconds <= 0) return '정리 대기 시간이 만료되었습니다.'
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  return `${hours}시간 ${minutes}분 후 미인증 계정이 자동 삭제됩니다.`
}

function TextField({
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
  maxLength,
  suffix,
  description,
  error,
  disabled = false,
}) {
  const inputId = useId()
  const errorId = useId()
  const descriptionId = useId()
  const describedBy = [
    description ? descriptionId : '',
    error ? errorId : '',
  ].filter(Boolean).join(' ') || undefined

  return (
    <div className={`auth-field ${error ? 'has-error' : ''}`}>
      <label className="auth-label" htmlFor={inputId}>{label}</label>
      <span className="auth-input-wrap">
        <Icon size={18} aria-hidden="true" />
        <input
          id={inputId}
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          maxLength={maxLength}
          aria-invalid={Boolean(error)}
          aria-describedby={describedBy}
          disabled={disabled}
        />
        {suffix}
      </span>
      {description && <span className="auth-sr-only" id={descriptionId}>{description}</span>}
      {error && <small className="field-error" id={errorId}>{error}</small>}
    </div>
  )
}

function PasswordToggle({ visible, onToggle, controlsLabel, disabled }) {
  return (
    <button type="button" className="password-toggle" onClick={onToggle} aria-label={`${controlsLabel} ${visible ? '숨기기' : '보기'}`} disabled={disabled}>
      {visible ? <EyeOff size={18} /> : <Eye size={18} />}
    </button>
  )
}

function LegalDocumentModal({ legalDocument, onClose }) {
  const closeButtonRef = useRef(null)

  useEffect(() => {
    if (!legalDocument) return undefined

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    closeButtonRef.current?.focus()

    function handleKeyDown(event) {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
    }
  }, [legalDocument, onClose])

  if (!legalDocument) return null

  const titleId = `legal-document-${legalDocument.id}`

  return (
    <div
      className="legal-modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <section className="legal-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="legal-modal-header">
          <span><FileText size={20} /></span>
          <div>
            <small>{legalDocument.badge} 약관 · 시행일 {legalDocument.effectiveDate}</small>
            <h2 id={titleId}>{legalDocument.title}</h2>
            <p>{legalDocument.summary}</p>
          </div>
          <button ref={closeButtonRef} type="button" onClick={onClose} aria-label="약관 닫기">
            <X size={18} />
          </button>
        </header>
        <div className="legal-modal-content" tabIndex="0">
          {legalDocument.notice && (
            <div className="legal-draft-notice" role="note">
              <strong>정식 운영 전 확인</strong>
              <p>{legalDocument.notice}</p>
            </div>
          )}
          {legalDocument.sections.map((section) => (
            <article className="legal-clause" key={section.title}>
              <h3>{section.title}</h3>
              {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
              {section.items?.length > 0 && (
                <ul>
                  {section.items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              )}
            </article>
          ))}
        </div>
        <footer className="legal-modal-footer">
          <p>전문을 확인한 뒤 회원가입 화면의 체크박스에서 동의해 주세요.</p>
          <button type="button" onClick={onClose}>확인</button>
        </footer>
      </section>
    </div>
  )
}

function AuthPage({ onAuthenticated, initialError = '' }) {
  const [mode, setMode] = useState('login')
  const [signupStep, setSignupStep] = useState(1)
  const [login, setLogin] = useState(initialLogin)
  const [signup, setSignup] = useState(initialSignup)
  const [passwordVisibility, setPasswordVisibility] = useState({ login: false, signup: false, confirm: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [notice, setNotice] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [loginNeedsVerification, setLoginNeedsVerification] = useState(false)
  const [verification, setVerification] = useState(null)
  const [verificationEmailRevealed, setVerificationEmailRevealed] = useState(false)
  const [legalDocument, setLegalDocument] = useState(null)
  const [clockNow, setClockNow] = useState(() => Date.now())
  const stageRef = useRef(null)
  const titleRef = useRef(null)
  const previousStageHeightRef = useRef(null)
  const previousModeRef = useRef(mode)
  const previousSignupStepRef = useRef(signupStep)
  const agreementsErrorId = useId()
  const loginTabId = useId()
  const signupTabId = useId()
  const panelId = useId()

  const panelKey = mode === 'login' ? 'login' : `signup-${signupStep}`
  const verificationRemaining = getRemainingSeconds(
    verification?.verificationExpiresAt,
    clockNow,
  )
  const resendRemaining = getRemainingSeconds(
    verification?.resendAvailableAt,
    clockNow,
  )
  const accountRemaining = getRemainingSeconds(
    verification?.accountExpiresAt,
    clockNow,
  )

  useEffect(() => {
    if (!verification) return undefined
    setClockNow(Date.now())
    const intervalId = window.setInterval(() => setClockNow(Date.now()), 1000)
    return () => window.clearInterval(intervalId)
  }, [verification])

  function focusFirstInvalid(form) {
    window.requestAnimationFrame(() => {
      const invalidControl = form.querySelector('[aria-invalid="true"]') || form.querySelector('.agreement-list input:not(:checked)')
      invalidControl?.focus()
    })
  }

  function rememberStageHeight() {
    const currentHeight = stageRef.current?.getBoundingClientRect().height
    if (currentHeight) previousStageHeightRef.current = currentHeight
  }

  useLayoutEffect(() => {
    const stage = stageRef.current
    const panel = stage?.querySelector('.auth-stage-panel')
    if (!stage || !panel) return undefined

    const stageStyle = window.getComputedStyle(stage)
    const stageVerticalPadding =
      Number.parseFloat(stageStyle.paddingTop) + Number.parseFloat(stageStyle.paddingBottom)
    const nextHeight = panel.scrollHeight + stageVerticalPadding
    const previousHeight = previousStageHeightRef.current
    const modeChanged = previousModeRef.current !== mode
    const movingForward = modeChanged ? mode === 'signup' : signupStep >= previousSignupStepRef.current
    previousModeRef.current = mode
    previousSignupStepRef.current = signupStep
    previousStageHeightRef.current = nextHeight

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      gsap.set([stage, panel], { clearProps: 'all' })
      return undefined
    }

    gsap.killTweensOf([stage, panel])
    gsap.set(stage, { overflow: 'hidden' })
    if (previousHeight === null) {
      gsap.set(stage, { height: nextHeight })
    } else {
      gsap.fromTo(
        stage,
        { height: previousHeight },
        { height: nextHeight, duration: 0.42, ease: 'power3.inOut' },
      )
    }
    gsap.fromTo(
      panel,
      { autoAlpha: 0, x: movingForward ? 24 : -24, filter: 'blur(3px)' },
      { autoAlpha: 1, x: 0, filter: 'blur(0px)', duration: 0.36, ease: 'power2.out', clearProps: 'opacity,visibility,transform,filter' },
    )
    const clearHeight = gsap.delayedCall(0.44, () => gsap.set(stage, { clearProps: 'height,overflow' }))

    return () => {
      clearHeight.kill()
      gsap.killTweensOf([stage, panel])
      gsap.set(stage, { clearProps: 'height,overflow' })
    }
  }, [mode, signupStep])

  function changeMode(nextMode) {
    if (busy || nextMode === mode) return
    rememberStageHeight()
    setMode(nextMode)
    setSignupStep(1)
    setError('')
    setNotice('')
    setFieldErrors({})
    setLoginNeedsVerification(false)
    setVerification(null)
    setVerificationEmailRevealed(false)
    setPasswordVisibility({ login: false, signup: false, confirm: false })
  }

  function showVerificationStep(email, data, message) {
    rememberStageHeight()
    setMode('signup')
    setSignupStep(3)
    setVerification({
      email,
      verificationExpiresAt: data.verificationExpiresAt,
      resendAvailableAt: data.resendAvailableAt,
      accountExpiresAt: data.accountExpiresAt,
    })
    setClockNow(Date.now())
    setError('')
    setNotice(message)
    setFieldErrors({})
    setLoginNeedsVerification(false)
    setVerificationEmailRevealed(false)
    window.requestAnimationFrame(() => titleRef.current?.focus())
  }

  function handleTabKeyDown(event) {
    if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return
    event.preventDefault()
    const nextMode = mode === 'login' ? 'signup' : 'login'
    changeMode(nextMode)
    const nextTabId = nextMode === 'login' ? loginTabId : signupTabId
    window.requestAnimationFrame(() => document.getElementById(nextTabId)?.focus())
  }

  async function submitLogin(event) {
    event.preventDefault()
    const form = event.currentTarget
    const errors = {}
    const emailLocal = login.email.trim()
    if (!isValidEmailLocal(emailLocal)) errors.email = '학교 이메일 아이디를 확인해 주세요.'
    if (login.password.length < 8) errors.password = '비밀번호를 8자 이상 입력해 주세요.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      focusFirstInvalid(form)
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    setLoginNeedsVerification(false)
    try {
      const response = await loginWithBackend({
        email: `${emailLocal}${SCHOOL_EMAIL_DOMAIN}`,
        password: login.password,
      })
      onAuthenticated(response.data)
    } catch (requestError) {
      if (requestError.fieldErrors && Object.keys(requestError.fieldErrors).length) {
        setFieldErrors(requestError.fieldErrors)
        window.requestAnimationFrame(() => focusFirstInvalid(form))
      }
      setLoginNeedsVerification(requestError.code === 'EMAIL_NOT_VERIFIED')
      setError(requestError.message || '로그인 중 문제가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function resendFromLogin() {
    const emailLocal = login.email.trim()
    if (!isValidEmailLocal(emailLocal)) {
      setFieldErrors({ email: '학교 이메일 아이디를 확인해 주세요.' })
      return
    }

    const email = `${emailLocal}${SCHOOL_EMAIL_DOMAIN}`
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await resendVerificationEmail(email)
      showVerificationStep(
        email,
        response.data,
        '새 인증 메일을 보냈습니다. 받은편지함을 확인해 주세요.',
      )
    } catch (requestError) {
      setError(requestError.message || '인증 메일을 보내지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function startDemo() {
    if (busy) return
    setError('')
    setFieldErrors({})
    onAuthenticated(createDemoSession().data)
  }

  function continueSignup(event) {
    event.preventDefault()
    const form = event.currentTarget
    const errors = {}
    if (!signup.name.trim()) errors.name = '이름을 입력해 주세요.'
    if (!/^\d{4}$/.test(signup.studentNumber)) errors.studentNumber = '학번은 4자리로 구성됩니다.'
    if (!isValidEmailLocal(signup.schoolEmail.trim())) errors.schoolEmail = '학교 이메일 아이디를 확인해 주세요.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      focusFirstInvalid(form)
      return
    }
    rememberStageHeight()
    setSignupStep(2)
    setFieldErrors({})
    window.requestAnimationFrame(() => titleRef.current?.focus())
  }

  function returnToSignupInfo() {
    rememberStageHeight()
    setSignupStep(1)
    setError('')
    setNotice('')
    setVerification(null)
    setFieldErrors({})
    window.requestAnimationFrame(() => titleRef.current?.focus())
  }

  async function submitSignup(event) {
    event.preventDefault()
    const form = event.currentTarget
    const errors = {}
    if (signup.password.length < 10 || !/[A-Za-z]/.test(signup.password) || !/\d/.test(signup.password)) errors.password = '영문과 숫자를 포함해 10자 이상 입력해 주세요.'
    if (signup.password !== signup.passwordConfirm) errors.passwordConfirm = '비밀번호가 일치하지 않습니다.'
    if (!signup.terms || !signup.privacy) errors.agreements = '필수 약관에 동의해 주세요.'
    setFieldErrors(errors)
    if (Object.keys(errors).length) {
      focusFirstInvalid(form)
      return
    }

    setBusy(true)
    setError('')
    setNotice('')
    const signupPayload = {
      name: signup.name.trim(),
      studentNumber: Number(signup.studentNumber),
      schoolEmail: `${signup.schoolEmail.trim()}${SCHOOL_EMAIL_DOMAIN}`,
      password: signup.password,
      agreements: {
        terms: signup.terms,
        privacy: signup.privacy,
        notifications: signup.notifications,
      },
    }
    try {
      const response = await signupWithBackend(signupPayload)
      if (response.data.verificationRequired) {
        showVerificationStep(
          signupPayload.schoolEmail,
          response.data,
          '학교 이메일로 인증 링크를 보냈습니다.',
        )
      } else {
        onAuthenticated(response.data)
      }
    } catch (requestError) {
      if (requestError.fieldErrors && Object.keys(requestError.fieldErrors).length) {
        setFieldErrors(requestError.fieldErrors)
        window.requestAnimationFrame(() => focusFirstInvalid(form))
      }
      setError(requestError.message || '가입 처리 중 문제가 발생했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function resendPendingVerification() {
    if (!verification?.email || resendRemaining > 0 || busy) return
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const response = await resendVerificationEmail(verification.email)
      setVerification((current) => ({
        ...current,
        verificationExpiresAt: response.data.verificationExpiresAt,
        resendAvailableAt: response.data.resendAvailableAt,
        accountExpiresAt: response.data.accountExpiresAt,
      }))
      setClockNow(Date.now())
      setNotice('새 인증 메일을 보냈습니다. 이전 링크 대신 새 링크를 사용해 주세요.')
    } catch (requestError) {
      if (requestError.code === 'UNVERIFIED_ACCOUNT_EXPIRED') {
        rememberStageHeight()
        setVerification(null)
        setSignupStep(1)
      }
      setError(requestError.message || '인증 메일을 보내지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  function returnToLogin() {
    if (busy) return
    rememberStageHeight()
    setMode('login')
    setSignupStep(1)
    if (verification?.email?.toLowerCase().endsWith(SCHOOL_EMAIL_DOMAIN)) {
      setLogin((current) => ({
        ...current,
        email: verification.email.slice(0, -SCHOOL_EMAIL_DOMAIN.length),
      }))
    }
    setVerification(null)
    setNotice('')
    setError('')
    setFieldErrors({})
    window.requestAnimationFrame(() => titleRef.current?.focus())
  }

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />
      <Suspense fallback={null}>
        <FloatingObjects variant="auth" />
      </Suspense>

      <main className="auth-layout">
        <section className="auth-form-area" aria-labelledby="auth-title">
          <div className="auth-form-card">
            <div className="auth-tabs" role="tablist" aria-label="인증 방식" onKeyDown={handleTabKeyDown}>
              <button id={loginTabId} type="button" role="tab" aria-selected={mode === 'login'} aria-controls={panelId} tabIndex={mode === 'login' ? 0 : -1} className={mode === 'login' ? 'active' : ''} onClick={() => changeMode('login')} disabled={busy}>로그인</button>
              <button id={signupTabId} type="button" role="tab" aria-selected={mode === 'signup'} aria-controls={panelId} tabIndex={mode === 'signup' ? 0 : -1} className={mode === 'signup' ? 'active' : ''} onClick={() => changeMode('signup')} disabled={busy}>회원가입</button>
            </div>

            <div className="auth-stage-shell" ref={stageRef}>
              <div className="auth-stage-panel" key={panelKey} id={panelId} role="tabpanel" aria-labelledby={mode === 'login' ? loginTabId : signupTabId}>
                {mode === 'login' ? (
                  <>
                    <div className="auth-title-block">
                      <h1 id="auth-title" ref={titleRef} tabIndex="-1">로그인</h1>
                      <p>학교 이메일로 로그인하세요.</p>
                    </div>
                    {error && <div className="auth-error" role="alert">{error}</div>}
                    {notice && <div className="auth-notice" role="status">{notice}</div>}
                    <form className="auth-form" onSubmit={submitLogin} noValidate aria-busy={busy}>
                      <TextField label="이메일" icon={Mail} value={login.email} onChange={(event) => setLogin({ ...login, email: normalizeEmailLocal(event.target.value) })} placeholder="이메일" autoComplete="username" inputMode="email" suffix={<span className="email-domain">@gsm.hs.kr</span>} description="아이디 부분만 입력하며, 뒤에 @gsm.hs.kr가 자동으로 붙습니다." error={fieldErrors.email} disabled={busy} />
                      <TextField label="비밀번호" icon={LockKeyhole} type={passwordVisibility.login ? 'text' : 'password'} value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} placeholder="비밀번호" autoComplete="current-password" suffix={<PasswordToggle visible={passwordVisibility.login} onToggle={() => setPasswordVisibility((current) => ({ ...current, login: !current.login }))} controlsLabel="로그인 비밀번호" disabled={busy} />} error={fieldErrors.password} disabled={busy} />
                      <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> 확인 중</> : <>로그인<ArrowRight size={18} /></>}</button>
                      {loginNeedsVerification && (
                        <button className="resend-verification-button" type="button" onClick={resendFromLogin} disabled={busy}>
                          {busy ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
                          이메일 인증 다시하기
                        </button>
                      )}
                      <div className="auth-divider"><span>또는</span></div>
                      <button className="demo-login" type="button" onClick={startDemo} disabled={busy}><Sparkles size={17} />데모 계정 사용하기</button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="auth-title-block signup-title">
                      <div className="signup-progress" aria-label={`회원가입 ${signupStep}/3단계`}>
                        <span className="active">1</span><i />
                        <span className={signupStep >= 2 ? 'active' : ''}>2</span><i />
                        <span className={signupStep >= 3 ? 'active' : ''}>3</span>
                      </div>
                      <h1 id="auth-title" ref={titleRef} tabIndex="-1">
                        {signupStep === 1 ? '학생 정보 입력' : signupStep === 2 ? '계정 보안 설정' : '이메일을 확인해 주세요'}
                      </h1>
                      <p>
                        {signupStep === 1
                          ? '학교 계정 확인에 필요한 정보만 입력해 주세요.'
                          : signupStep === 2
                            ? '비밀번호와 필수 약관을 확인해 주세요.'
                            : '인증을 완료한 뒤 로그인 화면에서 로그인하세요.'}
                      </p>
                    </div>
                    {error && <div className="auth-error" role="alert">{error}</div>}
                    {notice && <div className="auth-notice" role="status">{notice}</div>}
                    {signupStep === 1 ? (
                      <form className="auth-form" onSubmit={continueSignup} noValidate>
                        <TextField label="이름" icon={UserRound} value={signup.name} onChange={(event) => setSignup({ ...signup, name: event.target.value })} placeholder="이름을 입력하세요" autoComplete="name" error={fieldErrors.name} />
                        <div className="auth-field-row">
                          <TextField label="학번" icon={GraduationCap} value={signup.studentNumber} onChange={(event) => setSignup({ ...signup, studentNumber: event.target.value.replace(/\D/g, '').slice(0, 4) })} placeholder="예: 2201" inputMode="numeric" maxLength={4} error={fieldErrors.studentNumber} />
                          <TextField label="학교 이메일" icon={Mail} value={signup.schoolEmail} onChange={(event) => setSignup({ ...signup, schoolEmail: normalizeEmailLocal(event.target.value) })} placeholder="이메일" autoComplete="email" inputMode="email" suffix={<span className="email-domain">@gsm.hs.kr</span>} description="아이디 부분만 입력하며, 뒤에 @gsm.hs.kr가 자동으로 붙습니다." error={fieldErrors.schoolEmail} />
                        </div>
                        <button className="auth-submit" type="submit">다음 단계<ArrowRight size={18} /></button>
                      </form>
                    ) : signupStep === 2 ? (
                      <form className="auth-form" onSubmit={submitSignup} noValidate aria-busy={busy}>
                        <TextField label="비밀번호" icon={LockKeyhole} type={passwordVisibility.signup ? 'text' : 'password'} value={signup.password} onChange={(event) => setSignup({ ...signup, password: event.target.value })} placeholder="비밀번호" autoComplete="new-password" suffix={<PasswordToggle visible={passwordVisibility.signup} onToggle={() => setPasswordVisibility((current) => ({ ...current, signup: !current.signup }))} controlsLabel="새 비밀번호" disabled={busy} />} error={fieldErrors.password} disabled={busy} />
                        <TextField label="비밀번호 확인" icon={LockKeyhole} type={passwordVisibility.confirm ? 'text' : 'password'} value={signup.passwordConfirm} onChange={(event) => setSignup({ ...signup, passwordConfirm: event.target.value })} placeholder="비밀번호" autoComplete="new-password" suffix={<PasswordToggle visible={passwordVisibility.confirm} onToggle={() => setPasswordVisibility((current) => ({ ...current, confirm: !current.confirm }))} controlsLabel="비밀번호 확인" disabled={busy} />} error={fieldErrors.passwordConfirm} disabled={busy} />
                        <div className="agreement-list" role="group" aria-label="약관 동의" aria-invalid={Boolean(fieldErrors.agreements)} aria-describedby={fieldErrors.agreements ? agreementsErrorId : undefined}>
                          <div className="agreement-row">
                            <label className="auth-checkbox agreement-check" aria-label="이용약관 동의"><input type="checkbox" checked={signup.terms} onChange={(event) => setSignup({ ...signup, terms: event.target.checked })} disabled={busy} /><span><Check size={13} /></span><b>[필수]</b></label>
                            <p><button type="button" onClick={() => setLegalDocument(getLegalDocument('terms'))}>이용약관 동의<ChevronRight size={14} /></button></p>
                          </div>
                          <div className="agreement-row">
                            <label className="auth-checkbox agreement-check" aria-label="개인정보 수집 이용 동의"><input type="checkbox" checked={signup.privacy} onChange={(event) => setSignup({ ...signup, privacy: event.target.checked })} disabled={busy} /><span><Check size={13} /></span><b>[필수]</b></label>
                            <p><button type="button" onClick={() => setLegalDocument(getLegalDocument('privacy'))}>개인정보 수집·이용 동의<ChevronRight size={14} /></button></p>
                          </div>
                          <label className="auth-checkbox"><input type="checkbox" checked={signup.notifications} onChange={(event) => setSignup({ ...signup, notifications: event.target.checked })} disabled={busy} /><span><Check size={13} /></span><b>[선택]</b> 중요 일정 알림 받기</label>
                          {fieldErrors.agreements && <small className="field-error" id={agreementsErrorId}>{fieldErrors.agreements}</small>}
                        </div>
                        <div className="signup-actions"><button type="button" className="back-button" onClick={returnToSignupInfo} disabled={busy}><ArrowLeft size={17} />이전</button><button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> 가입 중</> : <>가입하기<ArrowRight size={18} /></>}</button></div>
                      </form>
                    ) : (
                      <div className="verification-panel" aria-live="polite">
                        <span className="verification-mail-icon" aria-hidden="true"><MailCheck size={26} /></span>
                        <strong className="verification-email">
                          {displayEmail(verification?.email, verificationEmailRevealed)}
                          <button
                            type="button"
                            className="verification-email-toggle"
                            onClick={() => setVerificationEmailRevealed((current) => !current)}
                            aria-pressed={verificationEmailRevealed}
                            aria-label={verificationEmailRevealed ? '이메일 가리기' : '이메일 표시하기'}
                            title={verificationEmailRevealed ? '이메일 가리기' : '이메일 표시하기'}
                          >
                            {verificationEmailRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                          </button>
                        </strong>
                        <div className={`verification-timer ${verificationRemaining === 0 ? 'is-expired' : ''}`}>
                          <span>인증 링크 남은 시간</span>
                          <b>{verificationRemaining > 0 ? formatCountdown(verificationRemaining) : '만료됨'}</b>
                          <small>링크는 메일을 보낸 시점부터 1시간 동안 유효합니다.</small>
                        </div>
                        <p className="verification-retention">{formatAccountCountdown(accountRemaining)}</p>
                        <div className="verification-actions">
                          <button
                            className="resend-verification-button"
                            type="button"
                            onClick={resendPendingVerification}
                            disabled={busy || resendRemaining > 0}
                          >
                            {busy ? <LoaderCircle className="spin" size={17} /> : <RefreshCw size={17} />}
                            {resendRemaining > 0
                              ? `${resendRemaining}초 후 다시 보내기`
                              : '인증 메일 다시 보내기'}
                          </button>
                          <button className="back-button" type="button" onClick={returnToLogin} disabled={busy}>
                            <ArrowLeft size={17} />로그인으로 돌아가기
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
      <LegalDocumentModal legalDocument={legalDocument} onClose={() => setLegalDocument(null)} />
    </div>
  )
}

export default AuthPage
