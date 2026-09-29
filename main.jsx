import React, { createContext, useContext, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Link, Route, Routes, useNavigate, useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import './styles.css'
import './extra.css'

// ---- supabase.js ----
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Files live in a public Supabase Storage bucket named "notes"
function fileUrl(path, download = false) {
  return supabase.storage
    .from('notes')
    .getPublicUrl(path, download ? { download: true } : undefined).data.publicUrl
}

// ---- store.js ----
// Progress and bookmarks are saved in the student's own browser.
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || []
  } catch {
    return []
  }
}

function useSavedList(key) {
  const [items, setItems] = useState(() => read(key))

  function toggle(id) {
    setItems((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }

  return [items, toggle]
}

// ---- auth.jsx ----
const AuthContext = createContext(null)
const useAuthCtx = () => useContext(AuthContext)

function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, role: null, name: '' })

  useEffect(() => {
    let active = true

    async function load(session) {
      const user = session?.user || null
      if (!user) {
        if (active) setState({ loading: false, user: null, role: null, name: '' })
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('role,full_name,is_active')
        .eq('id', user.id)
        .single()
      if (active) {
        setState({
          loading: false,
          user,
          role: data && data.is_active !== false ? data.role : null,
          name: data?.full_name || '',
        })
      }
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}

// ---- Home.jsx ----
function Home() {
  const [subjects, setSubjects] = useState(null)
  const [error, setError] = useState('')
  const [done] = useSavedList('copykaro:done')

  useEffect(() => {
    supabase
      .from('subjects')
      .select('id,name,code,semesters(course,branch,number),units(topics(id))')
      .order('name')
      .then(({ data, error }) => (error ? setError(error.message) : setSubjects(data)))
  }, [])

  return (
    <>
      <h1>Your syllabus, one topic at a time</h1>
      <p className="lead">Pick a subject, open a topic, read the current notes.</p>

      {error && <p className="error">Could not load subjects: {error}</p>}
      {!subjects && !error && <p className="muted">Loading subjects…</p>}
      {subjects && subjects.length === 0 && <p className="muted">No subjects have been added yet.</p>}

      {subjects && subjects.map((s) => {
        const ids = s.units.flatMap((u) => u.topics.map((t) => t.id))
        const count = ids.filter((id) => done.includes(id)).length
        const pct = ids.length ? Math.round((count / ids.length) * 100) : 0
        const sem = s.semesters
        return (
          <Link key={s.id} to={`/subject/${s.id}`} className="row">
            <div className="row-main">
              <h2>{s.name}</h2>
              <p className="muted">
                {sem ? `${sem.course} ${sem.branch}, Semester ${sem.number}` : ''}
                {s.code ? ` (${s.code})` : ''}
              </p>
              <div className="progress"><span style={{ width: `${pct}%` }} /></div>
              <p className="small">{count} of {ids.length} topics done</p>
            </div>
          </Link>
        )
      })}
    </>
  )
}

// ---- Subject.jsx ----
function Subject() {
  const { id } = useParams()
  const [subject, setSubject] = useState(null)
  const [error, setError] = useState('')
  const [done] = useSavedList('copykaro:done')

  useEffect(() => {
    supabase
      .from('subjects')
      .select('id,name,code,units(id,unit_number,title,topics(id,title,position,notes(current_version_id)))')
      .eq('id', id)
      .single()
      .then(({ data, error }) => (error ? setError(error.message) : setSubject(data)))
  }, [id])

  if (error) return <p className="error">Could not load this subject: {error}</p>
  if (!subject) return <p className="muted">Loading…</p>

  const units = [...subject.units].sort((a, b) => a.unit_number - b.unit_number)
  const allTopics = units.flatMap((u) => u.topics)
  const count = allTopics.filter((t) => done.includes(t.id)).length
  const pct = allTopics.length ? Math.round((count / allTopics.length) * 100) : 0

  // First topic not yet completed, used for "Continue"
  const next = units.flatMap((u) => [...u.topics].sort((a, b) => a.position - b.position))
    .find((t) => !done.includes(t.id))

  return (
    <>
      <Link to="/" className="back">Back to subjects</Link>
      <h1>{subject.name}</h1>
      <div className="progress"><span style={{ width: `${pct}%` }} /></div>
      <p className="small">{count} of {allTopics.length} topics done ({pct}%)</p>
      {next && <Link to={`/topic/${next.id}`} className="btn primary">Continue: {next.title}</Link>}

      {units.map((u) => (
        <section key={u.id} className="unit">
          <h2>Unit {u.unit_number}: {u.title}</h2>
          {[...u.topics].sort((a, b) => a.position - b.position).map((t) => {
            const note = Array.isArray(t.notes) ? t.notes[0] : t.notes
            const hasNote = note && note.current_version_id
            const isDone = done.includes(t.id)
            return (
              <Link key={t.id} to={`/topic/${t.id}`} className="topic-row">
                <span className={`tick ${isDone ? 'on' : ''}`} aria-label={isDone ? 'Completed' : 'Not completed'}>
                  {isDone ? '✓' : ''}
                </span>
                <span className="topic-title">{t.title}</span>
                {!hasNote && <span className="tag">No notes yet</span>}
              </Link>
            )
          })}
        </section>
      ))}
    </>
  )
}

// ---- Topic.jsx ----
const REASONS = [
  ['incorrect', 'Incorrect content'],
  ['outdated', 'Outdated'],
  ['wrong_syllabus', 'Not in the syllabus'],
  ['copyright', 'Copyright issue'],
  ['other', 'Other'],
]

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

function Topic() {
  const { id } = useParams()
  const [topic, setTopic] = useState(null)
  const [versions, setVersions] = useState([])
  const [error, setError] = useState('')
  const [done, toggleDone] = useSavedList('copykaro:done')
  const [saved, toggleSaved] = useSavedList('copykaro:saved')
  const [reason, setReason] = useState('incorrect')
  const [details, setDetails] = useState('')
  const [reportMsg, setReportMsg] = useState('')

  useEffect(() => {
    setTopic(null)
    setVersions([])
    setReportMsg('')
    supabase
      .from('topics')
      .select('id,title,units(unit_number,title,subjects(id,name)),notes(id,current_version_id)')
      .eq('id', id)
      .single()
      .then(async ({ data, error }) => {
        if (error) return setError(error.message)
        setTopic(data)
        const note = Array.isArray(data.notes) ? data.notes[0] : data.notes
        if (note) {
          const { data: v } = await supabase
            .from('note_versions')
            .select('id,version_number,file_path,change_description,created_at')
            .eq('note_id', note.id)
            .eq('status', 'approved')
            .order('version_number', { ascending: false })
          setVersions(v || [])
        }
      })
  }, [id])

  if (error) return <p className="error">Could not load this topic: {error}</p>
  if (!topic) return <p className="muted">Loading…</p>

  const note = Array.isArray(topic.notes) ? topic.notes[0] : topic.notes
  const current = versions.find((v) => v.id === note?.current_version_id) || versions[0]
  const isDone = done.includes(topic.id)
  const isSaved = saved.includes(topic.id)
  const subject = topic.units?.subjects

  async function sendReport(e) {
    e.preventDefault()
    const { error } = await supabase.from('reports').insert({ note_id: note.id, reason, details })
    setReportMsg(error ? 'Could not send the report. Try again.' : 'Report sent. The admin will review it.')
    if (!error) setDetails('')
  }

  return (
    <>
      {subject && <Link to={`/subject/${subject.id}`} className="back">Back to {subject.name}</Link>}
      <h1>{topic.title}</h1>
      <p className="muted">Unit {topic.units.unit_number}: {topic.units.title}</p>

      <div className="actions">
        <button className={`btn ${isDone ? 'ok' : ''}`} onClick={() => toggleDone(topic.id)}>
          {isDone ? 'Completed' : 'Mark complete'}
        </button>
        <button className={`btn ${isSaved ? 'hl' : ''}`} onClick={() => toggleSaved(topic.id)}>
          {isSaved ? 'Bookmarked' : 'Bookmark'}
        </button>
      </div>

      {!current && <p className="empty">Notes for this topic haven’t been added yet. Check back soon.</p>}

      {current && (
        <>
          <p className="small">Version {current.version_number}, updated {fmt(current.created_at)}</p>
          <div className="actions">
            <a className="btn primary" href={fileUrl(current.file_path)} target="_blank" rel="noreferrer">Open notes</a>
            <a className="btn" href={fileUrl(current.file_path, true)}>Download PDF</a>
          </div>
          <iframe className="viewer" title={`${topic.title} notes`} src={fileUrl(current.file_path)} />
          <p className="small muted">If the notes don’t show above, use Open notes.</p>
        </>
      )}

      {versions.length > 0 && (
        <details className="panel">
          <summary>Version history ({versions.length})</summary>
          {versions.map((v) => (
            <div key={v.id} className="version">
              <strong>Version {v.version_number}</strong>
              {v.id === current?.id && <span className="tag current">Current</span>}
              <span className="small muted"> {fmt(v.created_at)}</span>
              {v.change_description && <p>{v.change_description}</p>}
              <a href={fileUrl(v.file_path)} target="_blank" rel="noreferrer">Open this version</a>
            </div>
          ))}
        </details>
      )}

      {note && current && (
        <details className="panel">
          <summary>Report a problem</summary>
          <form onSubmit={sendReport}>
            <label>What’s wrong?
              <select value={reason} onChange={(e) => setReason(e.target.value)}>
                {REASONS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </label>
            <label>Details (optional)
              <textarea rows="3" value={details} onChange={(e) => setDetails(e.target.value)} />
            </label>
            <button className="btn" type="submit">Send report</button>
            {reportMsg && <p className="small">{reportMsg}</p>}
          </form>
        </details>
      )}
    </>
  )
}

// ---- Saved.jsx ----
function Saved() {
  const [saved] = useSavedList('copykaro:saved')
  const [done] = useSavedList('copykaro:done')
  const [topics, setTopics] = useState({})
  const [error, setError] = useState('')

  useEffect(() => {
    const ids = [...new Set([...saved, ...done])]
    if (ids.length === 0) return
    supabase
      .from('topics')
      .select('id,title,units(subjects(name))')
      .in('id', ids)
      .then(({ data, error }) => {
        if (error) return setError(error.message)
        setTopics(Object.fromEntries(data.map((t) => [t.id, t])))
      })
  }, [])

  const list = (ids) =>
    ids.filter((id) => topics[id]).map((id) => (
      <Link key={id} to={`/topic/${id}`} className="topic-row">
        <span className="topic-title">{topics[id].title}</span>
        <span className="small muted">{topics[id].units?.subjects?.name}</span>
      </Link>
    ))

  return (
    <>
      <h1>My study</h1>
      <p className="lead">Saved on this device only. Clearing your browser data removes it.</p>
      {error && <p className="error">Could not load your list: {error}</p>}

      <section className="unit">
        <h2>Bookmarks ({saved.length})</h2>
        {saved.length === 0 ? <p className="empty">Nothing bookmarked yet. Open a topic and tap Bookmark.</p> : list(saved)}
      </section>

      <section className="unit">
        <h2>Completed ({done.length})</h2>
        {done.length === 0 ? <p className="empty">No completed topics yet.</p> : list(done)}
      </section>
    </>
  )
}

// ---- Login.jsx ----
function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setErr(error.message)
    nav('/contribute')
  }

  return (
    <>
      <h1>Contributor login</h1>
      <p className="lead">For contributors and the admin only. Students don’t need to log in.</p>
      <form onSubmit={submit}>
        <label>Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        {err && <p className="error">{err}</p>}
      </form>
    </>
  )
}

// ---- Contribute.jsx ----

function Contribute() {
  const auth = useAuthCtx()
  const [tree, setTree] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [file, setFile] = useState(null)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [mine, setMine] = useState([])

  useEffect(() => {
    supabase
      .from('subjects')
      .select('id,name,units(id,unit_number,title,topics(id,title,position))')
      .order('name')
      .then(({ data }) => setTree(data || []))
  }, [])

  function loadMine() {
    if (!auth.user) return
    supabase
      .from('note_versions')
      .select('id,version_number,status,review_comment,created_at,file_path,notes!note_versions_note_id_fkey(topics(title))')
      .eq('contributor_id', auth.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMine(data || []))
  }
  useEffect(loadMine, [auth.user])

  if (auth.loading) return <p className="muted">Loading…</p>
  if (auth.role !== 'contributor' && auth.role !== 'admin') {
    return <p>Please <Link to="/login">log in as a contributor</Link> to upload notes.</p>
  }

  const subject = tree.find((s) => s.id === subjectId)
  const units = subject ? [...subject.units].sort((a, b) => a.unit_number - b.unit_number) : []
  const unit = units.find((u) => u.id === unitId)
  const topics = unit ? [...unit.topics].sort((a, b) => a.position - b.position) : []

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    if (!topicId || !file || !desc.trim()) return setMsg('Choose a topic, add a PDF, and describe what this version covers or changes.')
    if (file.type !== 'application/pdf') return setMsg('Only PDF files are allowed.')
    if (file.size > 20 * 1024 * 1024) return setMsg('The file is over 20 MB. Please compress it.')
    setBusy(true)

    const { data: note } = await supabase.from('notes').select('id').eq('topic_id', topicId).maybeSingle()
    if (!note) {
      setBusy(false)
      return setMsg('This topic has no note slot yet. Ask the admin.')
    }

    const path = `${topicId}/${Date.now()}.pdf`
    const up = await supabase.storage.from('notes').upload(path, file, { contentType: 'application/pdf' })
    if (up.error) {
      setBusy(false)
      return setMsg('Upload failed: ' + up.error.message)
    }

    const { data: latest } = await supabase
      .from('note_versions')
      .select('version_number')
      .eq('note_id', note.id)
      .order('version_number', { ascending: false })
      .limit(1)
    let v = (latest?.[0]?.version_number || 0) + 1
    let error = null
    for (let i = 0; i < 8; i++) {
      const res = await supabase.from('note_versions').insert({
        note_id: note.id,
        version_number: v,
        file_path: path,
        change_description: desc.trim(),
        contributor_id: auth.user.id,
      })
      error = res.error
      if (!error || error.code !== '23505') break
      v++
    }

    setBusy(false)
    if (error) return setMsg('Could not save: ' + error.message)
    setMsg('Submitted! The admin will review it.')
    setFile(null)
    setDesc('')
    e.target.reset()
    loadMine()
  }

  return (
    <>
      <h1>Upload notes</h1>
      <p className="lead">Hi {auth.name || 'there'}. Your upload goes to the admin for review before students see it.</p>

      <form onSubmit={submit}>
        <label>Subject
          <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setUnitId(''); setTopicId('') }}>
            <option value="">Choose…</option>
            {tree.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Unit
          <select value={unitId} disabled={!subject} onChange={(e) => { setUnitId(e.target.value); setTopicId('') }}>
            <option value="">Choose…</option>
            {units.map((u) => <option key={u.id} value={u.id}>Unit {u.unit_number}: {u.title}</option>)}
          </select>
        </label>
        <label>Topic
          <select value={topicId} disabled={!unit} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Choose…</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        <label>PDF file (max 20 MB)
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        <label>What does this version cover or change?
          <textarea rows="3" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <p className="small muted">Only upload notes you wrote or have permission to share, and make sure they match the syllabus.</p>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Submit for review'}</button>
        {msg && <p className="small"><strong>{msg}</strong></p>}
      </form>

      <section className="unit">
        <h2>My contributions</h2>
        {mine.length === 0 && <p className="empty">You haven’t submitted anything yet.</p>}
        {mine.map((v) => (
          <div key={v.id} className="version">
            <strong>{v.notes?.topics?.title || 'Topic'}</strong>
            <span className={`tag st-${v.status}`}> {v.status}</span>
            <p className="small muted">Version {v.version_number}, {fmt(v.created_at)}</p>
            {v.review_comment && <p className="small">Admin: {v.review_comment}</p>}
            <a href={fileUrl(v.file_path)} target="_blank