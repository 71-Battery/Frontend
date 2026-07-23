import { useId, useLayoutEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  LoaderCircle,
  LockKeyhole,
  Mail,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { login as loginWithBackend, signup as signupWithBackend } from './api/authApi.js'
import { createDemoSession } from './api/mockAuthApi.js'
import './AuthPage.css'

const initialLogin = { email: '', password: '' }
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
  notifications: true,
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

function TextField({
  label,
  icon: Icon,
  type = 'text',
  value,
  onChange,
  placeholder,
  autoComplete,
  inputMode,
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

function AuthPage({ onAuthenticated, initialError = '' }) {
  const [mode, setMode] = useState('login')
  const [signupStep, setSignupStep] = useState(1)
  const [login, setLogin] = useState(initialLogin)
  const [signup, setSignup] = useState(initialSignup)
  const [passwordVisibility, setPasswordVisibility] = useState({ login: false, signup: false, confirm: false })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(initialError)
  const [fieldErrors, setFieldErrors] = useState({})
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

    const nextHeight = panel.scrollHeight
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
    const clearHeight = gsap.delayedCall(0.44, () => gsap.set(stage, { clearProps: 'height' }))

    return () => {
      clearHeight.kill()
      gsap.killTweensOf([stage, panel])
      gsap.set(stage, { clearProps: 'height' })
    }
  }, [mode, signupStep])

  function changeMode(nextMode) {
    if (busy || nextMode === mode) return
    rememberStageHeight()
    setMode(nextMode)
    setSignupStep(1)
    setError('')
    setFieldErrors({})
    setPasswordVisibility({ login: false, signup: false, confirm: false })
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
      setError(requestError.message || '로그인 중 문제가 발생했습니다.')
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
    if (!/^\d{4,8}$/.test(signup.studentNumber)) errors.studentNumber = '학번은 숫자 4~8자리로 입력해 주세요.'
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
      onAuthenticated(response.data)
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

  return (
    <div className="auth-page">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />

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
                    <form className="auth-form" onSubmit={submitLogin} noValidate aria-busy={busy}>
                      <TextField label="이메일" icon={Mail} value={login.email} onChange={(event) => setLogin({ ...login, email: normalizeEmailLocal(event.target.value) })} placeholder="이메일" autoComplete="username" inputMode="email" suffix={<span className="email-domain">@gsm.hs.kr</span>} description="아이디 부분만 입력하며, 뒤에 @gsm.hs.kr가 자동으로 붙습니다." error={fieldErrors.email} disabled={busy} />
                      <TextField label="비밀번호" icon={LockKeyhole} type={passwordVisibility.login ? 'text' : 'password'} value={login.password} onChange={(event) => setLogin({ ...login, password: event.target.value })} placeholder="비밀번호" autoComplete="current-password" suffix={<PasswordToggle visible={passwordVisibility.login} onToggle={() => setPasswordVisibility((current) => ({ ...current, login: !current.login }))} controlsLabel="로그인 비밀번호" disabled={busy} />} error={fieldErrors.password} disabled={busy} />
                      <button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> 확인 중</> : <>로그인<ArrowRight size={18} /></>}</button>
                      <div className="auth-divider"><span>또는</span></div>
                      <button className="demo-login" type="button" onClick={startDemo} disabled={busy}><Sparkles size={17} />데모 계정 사용하기</button>
                    </form>
                  </>
                ) : (
                  <>
                    <div className="auth-title-block signup-title">
                      <div className="signup-progress" aria-label={`회원가입 ${signupStep}/2단계`}><span className="active">1</span><i /><span className={signupStep === 2 ? 'active' : ''}>2</span></div>
                      <h1 id="auth-title" ref={titleRef} tabIndex="-1">{signupStep === 1 ? '학생 정보 입력' : '계정 보안 설정'}</h1>
                      <p>{signupStep === 1 ? '학교 계정 확인에 필요한 정보만 입력해 주세요.' : '비밀번호와 필수 약관을 확인해 주세요.'}</p>
                    </div>
                    {error && <div className="auth-error" role="alert">{error}</div>}
                    {signupStep === 1 ? (
                      <form className="auth-form" onSubmit={continueSignup} noValidate>
                        <TextField label="이름" icon={UserRound} value={signup.name} onChange={(event) => setSignup({ ...signup, name: event.target.value })} placeholder="이름을 입력하세요" autoComplete="name" error={fieldErrors.name} />
                        <div className="auth-field-row">
                          <TextField label="학번" icon={GraduationCap} value={signup.studentNumber} onChange={(event) => setSignup({ ...signup, studentNumber: event.target.value.replace(/\D/g, '') })} placeholder="예: 2201" inputMode="numeric" error={fieldErrors.studentNumber} />
                          <TextField label="학교 이메일" icon={Mail} value={signup.schoolEmail} onChange={(event) => setSignup({ ...signup, schoolEmail: normalizeEmailLocal(event.target.value) })} placeholder="이메일" autoComplete="email" inputMode="email" suffix={<span className="email-domain">@gsm.hs.kr</span>} description="아이디 부분만 입력하며, 뒤에 @gsm.hs.kr가 자동으로 붙습니다." error={fieldErrors.schoolEmail} />
                        </div>
                        <button className="auth-submit" type="submit">다음 단계<ArrowRight size={18} /></button>
                      </form>
                    ) : (
                      <form className="auth-form" onSubmit={submitSignup} noValidate aria-busy={busy}>
                        <TextField label="비밀번호" icon={LockKeyhole} type={passwordVisibility.signup ? 'text' : 'password'} value={signup.password} onChange={(event) => setSignup({ ...signup, password: event.target.value })} placeholder="비밀번호" autoComplete="new-password" suffix={<PasswordToggle visible={passwordVisibility.signup} onToggle={() => setPasswordVisibility((current) => ({ ...current, signup: !current.signup }))} controlsLabel="새 비밀번호" disabled={busy} />} error={fieldErrors.password} disabled={busy} />
                        <TextField label="비밀번호 확인" icon={LockKeyhole} type={passwordVisibility.confirm ? 'text' : 'password'} value={signup.passwordConfirm} onChange={(event) => setSignup({ ...signup, passwordConfirm: event.target.value })} placeholder="비밀번호" autoComplete="new-password" suffix={<PasswordToggle visible={passwordVisibility.confirm} onToggle={() => setPasswordVisibility((current) => ({ ...current, confirm: !current.confirm }))} controlsLabel="비밀번호 확인" disabled={busy} />} error={fieldErrors.passwordConfirm} disabled={busy} />
                        <div className="agreement-list" role="group" aria-label="약관 동의" aria-invalid={Boolean(fieldErrors.agreements)} aria-describedby={fieldErrors.agreements ? agreementsErrorId : undefined}>
                          <label className="auth-checkbox"><input type="checkbox" checked={signup.terms} onChange={(event) => setSignup({ ...signup, terms: event.target.checked })} disabled={busy} /><span><Check size={13} /></span><b>[필수]</b> 이용약관 동의</label>
                          <label className="auth-checkbox"><input type="checkbox" checked={signup.privacy} onChange={(event) => setSignup({ ...signup, privacy: event.target.checked })} disabled={busy} /><span><Check size={13} /></span><b>[필수]</b> 개인정보 처리 안내 동의</label>
                          <label className="auth-checkbox"><input type="checkbox" checked={signup.notifications} onChange={(event) => setSignup({ ...signup, notifications: event.target.checked })} disabled={busy} /><span><Check size={13} /></span><b>[선택]</b> 중요 일정 알림 받기</label>
                          {fieldErrors.agreements && <small className="field-error" id={agreementsErrorId}>{fieldErrors.agreements}</small>}
                        </div>
                        <div className="signup-actions"><button type="button" className="back-button" onClick={returnToSignupInfo} disabled={busy}><ArrowLeft size={17} />이전</button><button className="auth-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="spin" size={18} /> 가입 중</> : <>가입하기<ArrowRight size={18} /></>}</button></div>
                      </form>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default AuthPage
