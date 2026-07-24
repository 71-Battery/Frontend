import { useEffect, useState } from 'react'
import {
  ChevronDown,
  FilePlus2,
  Megaphone,
  Pencil,
  Plus,
  Save,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import {
  createAdminNotice,
  createAdminRule,
  deleteAdminRule,
  getAdminRules,
  updateAdminRule,
} from '../api/platformApi.js'

const emptyRule = { title: '', content: '', category: '일반' }
const emptyNotice = { title: '', summary: '', content: '', category: '일반' }

export default function AdminContentPanel({ authToken, onContentChanged }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState('rules')
  const [rules, setRules] = useState([])
  const [form, setForm] = useState(emptyRule)
  const [editingRuleId, setEditingRuleId] = useState('')
  const [deleteTargetId, setDeleteTargetId] = useState('')
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!open) return undefined
    const controller = new AbortController()
    setLoading(true)
    setError('')
    getAdminRules({ authToken, signal: controller.signal })
      .then(setRules)
      .catch((requestError) => {
        if (requestError.name !== 'AbortError') {
          setError(requestError.message || '규정 목록을 불러오지 못했습니다.')
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false)
      })
    return () => controller.abort()
  }, [authToken, open])

  function changeMode(nextMode) {
    setMode(nextMode)
    setForm(nextMode === 'rules' ? emptyRule : emptyNotice)
    setEditingRuleId('')
    setDeleteTargetId('')
    setError('')
    setMessage('')
  }

  function startEditing(rule) {
    setMode('rules')
    setEditingRuleId(String(rule.id))
    setDeleteTargetId('')
    setForm({
      title: rule.title || '',
      content: rule.content || '',
      category: rule.category || '일반',
    })
    setError('')
    setMessage('')
  }

  function cancelEditing() {
    setEditingRuleId('')
    setForm(emptyRule)
    setError('')
  }

  async function submit(event) {
    event.preventDefault()
    if (!form.title.trim() || !form.content.trim() || busy) return
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (mode === 'notices') {
        await createAdminNotice(form, { authToken })
        setForm(emptyNotice)
        setMessage('공지가 게시되었습니다.')
      } else if (editingRuleId) {
        const updated = await updateAdminRule(editingRuleId, form, { authToken })
        setRules((current) => current.map((rule) => (
          String(rule.id) === editingRuleId ? updated : rule
        )))
        setEditingRuleId('')
        setForm(emptyRule)
        setMessage('규정이 수정되었습니다.')
      } else {
        const created = await createAdminRule(form, { authToken })
        setRules((current) => [created, ...current])
        setForm(emptyRule)
        setMessage('규정이 게시되었습니다.')
      }
      onContentChanged?.()
    } catch (requestError) {
      setError(requestError.message || '콘텐츠를 저장하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  async function confirmDelete(ruleId) {
    if (busy) return
    setBusy(true)
    setError('')
    setMessage('')
    try {
      await deleteAdminRule(ruleId, { authToken })
      setRules((current) => current.filter((rule) => String(rule.id) !== ruleId))
      setDeleteTargetId('')
      if (editingRuleId === ruleId) cancelEditing()
      setMessage('규정이 삭제되었습니다.')
      onContentChanged?.()
    } catch (requestError) {
      setError(requestError.message || '규정을 삭제하지 못했습니다.')
    } finally {
      setBusy(false)
    }
  }

  const isNotice = mode === 'notices'

  return (
    <section className="admin-panel glass-panel">
      <button
        className="admin-toggle"
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <span><ShieldCheck size={17} />콘텐츠 관리</span>
        <ChevronDown size={17} />
      </button>
      {open && (
        <div className="admin-content">
          <div className="admin-mode-tabs" role="tablist" aria-label="콘텐츠 종류">
            <button
              type="button"
              className={mode === 'rules' ? 'active' : ''}
              onClick={() => changeMode('rules')}
              role="tab"
              aria-selected={mode === 'rules'}
            >
              <ShieldCheck size={15} />규정 관리
            </button>
            <button
              type="button"
              className={isNotice ? 'active' : ''}
              onClick={() => changeMode('notices')}
              role="tab"
              aria-selected={isNotice}
            >
              <Megaphone size={15} />공지 작성
            </button>
          </div>

          <form className="admin-editor-form" onSubmit={submit}>
            <div className="admin-form-heading">
              <div>
                {isNotice ? <FilePlus2 size={18} /> : editingRuleId ? <Pencil size={18} /> : <Plus size={18} />}
                <strong>
                  {isNotice ? '새 공지 게시' : editingRuleId ? '규정 수정' : '새 규정 게시'}
                </strong>
              </div>
              {editingRuleId && (
                <button className="admin-text-button" type="button" onClick={cancelEditing}>
                  <X size={14} />수정 취소
                </button>
              )}
            </div>
            <div className="admin-form-grid">
              <label>
                <span>제목</span>
                <input
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder={isNotice ? '공지 제목' : '규정 제목'}
                  maxLength={200}
                  required
                />
              </label>
              <label>
                <span>분류</span>
                <input
                  value={form.category}
                  onChange={(event) => setForm({ ...form, category: event.target.value })}
                  placeholder="일반"
                  maxLength={100}
                  required
                />
              </label>
              {isNotice && (
                <label className="admin-form-wide">
                  <span>요약</span>
                  <input
                    value={form.summary}
                    onChange={(event) => setForm({ ...form, summary: event.target.value })}
                    placeholder="목록에 표시할 간단한 설명"
                    maxLength={500}
                  />
                </label>
              )}
              <label className="admin-form-wide">
                <span>내용</span>
                <textarea
                  value={form.content}
                  onChange={(event) => setForm({ ...form, content: event.target.value })}
                  placeholder={isNotice ? '공지 내용을 입력하세요.' : '규정 내용을 입력하세요.'}
                  maxLength={50000}
                  rows={6}
                  required
                />
              </label>
            </div>
            <div className="admin-form-actions">
              <small>안전한 굵게·기울임·링크 형식만 저장됩니다.</small>
              <button
                className="admin-primary-button"
                type="submit"
                disabled={busy || !form.title.trim() || !form.content.trim()}
              >
                {editingRuleId ? <Save size={15} /> : <Plus size={15} />}
                {busy ? '저장 중…' : isNotice ? '공지 게시' : editingRuleId ? '변경 저장' : '규정 게시'}
              </button>
            </div>
          </form>

          {error && <p className="inline-error" role="alert">{error}</p>}
          {message && <p className="admin-success" role="status">{message}</p>}

          {mode === 'rules' && (
            <div className="rule-list">
              <div className="admin-list-heading">
                <strong>게시된 규정</strong>
                <span>{rules.length}개</span>
              </div>
              {loading && <p className="admin-empty">규정을 불러오는 중입니다.</p>}
              {!loading && rules.length === 0 && (
                <p className="admin-empty">등록된 규정이 없습니다.</p>
              )}
              {rules.map((rule) => {
                const ruleId = String(rule.id)
                const confirmingDelete = deleteTargetId === ruleId
                return (
                  <article key={ruleId}>
                    <div className="rule-copy">
                      <span>{rule.category || '일반'}</span>
                      <strong>{rule.title}</strong>
                      <p>{rule.content}</p>
                    </div>
                    <div className="rule-actions">
                      {confirmingDelete ? (
                        <>
                          <button type="button" onClick={() => setDeleteTargetId('')} disabled={busy}>
                            취소
                          </button>
                          <button
                            className="danger"
                            type="button"
                            onClick={() => confirmDelete(ruleId)}
                            disabled={busy}
                          >
                            삭제 확인
                          </button>
                        </>
                      ) : (
                        <>
                          <button type="button" onClick={() => startEditing(rule)}>
                            <Pencil size={14} />수정
                          </button>
                          <button
                            className="danger"
                            type="button"
                            onClick={() => setDeleteTargetId(ruleId)}
                          >
                            <Trash2 size={14} />삭제
                          </button>
                        </>
                      )}
                    </div>
                  </article>
                )
              })}
            </div>
          )}
        </div>
      )}
    </section>
  )
}
