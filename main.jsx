import React, { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, NavLink, Link, Route, Routes, useParams } from 'react-router-dom'
import { createClient } from '@supabase/supabase-js'
import './styles.css'

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

// ---- App.jsx ----
function App() {
  return (
    <>
      <header className="bar-top">
        <div className="bar-inner">
          <Link to="/" className="wordmark">Copykaro</Link>
          <nav>
            <NavLink to="/" end>Subjects</NavLink>
            <NavLink to="/saved">My study</NavLink>
          </nav>
        </div>
      </header>
      <main className="page">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/subject/:id" element={<Subject />} />
          <Route path="/topic/:id" element={<Topic />} />
          <Route path="/saved" element={<Saved />} />
          <Route path="*" element={<p>Page not found. <Link to="/">Go to subjects</Link></p>} />
        </Routes>
      </main>
    </>
  )
}

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
)
