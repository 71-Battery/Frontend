import { lazy, Suspense } from 'react'
import { ArrowRight, CheckCircle2, GraduationCap, LoaderCircle } from 'lucide-react'
import './AuthPage.css'
import './EmailConfirmationPage.css'

const FloatingObjects = lazy(() => import('./components/FloatingObjects.jsx'))

export default function EmailConfirmationPage({ status = 'checking' }) {
  const complete = status === 'complete'

  return (
    <div className="auth-page email-confirmation-page">
      <div className="auth-orb auth-orb-one" aria-hidden="true" />
      <div className="auth-orb auth-orb-two" aria-hidden="true" />
      <Suspense fallback={null}>
        <FloatingObjects variant="auth" />
      </Suspense>

      <main className="email-confirmation-layout">
        <section
          className="email-confirmation-card"
          aria-labelledby="email-confirmation-title"
          aria-live="polite"
        >
          <div className="email-confirmation-brand" aria-label="GSM VITA">
            <span><GraduationCap size={21} /></span>
            <strong>GSM VITA</strong>
          </div>

          <span className={`email-confirmation-icon${complete ? ' complete' : ''}`}>
            {complete
              ? <CheckCircle2 size={34} strokeWidth={2.2} />
              : <LoaderCircle className="spin" size={32} />}
          </span>

          <div className="email-confirmation-copy">
            <h1 id="email-confirmation-title">
              {complete ? '이메일 인증이 완료되었습니다!' : '인증 정보를 확인하고 있습니다.'}
            </h1>
            <p>
              {complete
                ? '로그인 화면으로 돌아가서 로그인하세요.'
                : '잠시만 기다려 주세요.'}
            </p>
          </div>

          {complete && (
            <a className="email-confirmation-action" href="/">
              로그인 화면으로 돌아가기
              <ArrowRight size={18} />
            </a>
          )}
        </section>
      </main>
    </div>
  )
}
