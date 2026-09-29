import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, useSavedList } from './lib'

export function Home() {
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

export function Subject() {
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

export function Saved() {
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
