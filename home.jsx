import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, useSavedList } from './lib'
import { Icon, SUBJECT_ICONS, HeroArt } from './ui'

const noteOf = (t) => (Array.isArray(t.notes) ? t.notes[0] : t.notes)

const FEATURES = [
  ['list', 'Organized by syllabus'],
  ['refresh', 'Continuously updated'],
  ['users', 'Student contributions'],
  ['clock', 'Version history'],
]

function readLast() {
  try {
    return JSON.parse(localStorage.getItem('copykaro:last'))
  } catch {
    return null
  }
}

export function Home() {
  const [subjects, setSubjects] = useState(null)
  const [error, setError] = useState('')
  const [done] = useSavedList('copykaro:done')
  const [q, setQ] = useState('')
  const [results, setResults] = useState(null)
  const last = readLast()

  useEffect(() => {
    supabase
      .from('subjects')
      .select('id,name,code,semesters(course,branch,number),units(topics(id,notes(current_version_id)))')
      .order('name')
      .then(({ data, error }) => (error ? setError(error.message) : setSubjects(data)))
  }, [])

  useEffect(() => {
    const term = q.trim().replace(/[%_\\]/g, ' ')
    if (term.length < 2) {
      setResults(null)
      return
    }
    let active = true
    const timer = setTimeout(() => {
      supabase
        .from('topics')
        .select('id,title,units(unit_number,title,subjects(name)),notes(current_version_id)')
        .ilike('title', `%${term}%`)
        .limit(20)
        .then(({ data }) => {
          if (active) setResults(data || [])
        })
    }, 250)
    return () => {
      active = false
      clearTimeout(timer)
    }
  }, [q])

  const allTopics = subjects ? subjects.flatMap((s) => s.units.flatMap((u) => u.topics)) : []
  const withNotes = allTopics.filter((t) => noteOf(t)?.current_version_id).length

  return (
    <>
      <section className="hero">
        <div>
          <h1>Your Class. Your Notes. <span className="accent">Always Up to Date.</span></h1>
          <p className="lead">
            Find syllabus-aligned notes for your college, semester and subjects. Written by contributors, checked by an admin.
          </p>
          <div className="searchbox">
            <Icon name="search" size={18} />
            <input
              type="search"
              placeholder="Search topics, like Loops or Pointers"
              aria-label="Search topics"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
          {last && !q && <Link to={`/topic/${last.id}`} className="btn primary">Continue: {last.title}</Link>}
        </div>
        <HeroArt />
      </section>

      {error && <p className="error">Could not load subjects: {error}</p>}

      {results !== null && (
        <section className="section">
          <h2>Search results ({results.length})</h2>
          {results.length === 0 && <p className="empty">No topics match “{q}”. Try a shorter word.</p>}
          {results.length > 0 && (
            <div className="list">
              {results.map((t) => (
                <Link key={t.id} to={`/topic/${t.id}`} className="row-link">
                  <span className="row-title">
                    {t.title}
                    <span className="small muted block">{t.units?.subjects?.name}, Unit {t.units?.unit_number}</span>
                  </span>
                  {!noteOf(t)?.current_version_id && <span className="pill">No notes yet</span>}
                  <span className="chev"><Icon name="chevron" size={18} /></span>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {results === null && (
        <>
          <section className="features">
            {FEATURES.map(([icon, label]) => (
              <div key={label} className="feat">
                <div className="feat-ic"><Icon name={icon} /></div>
                <h3>{label}</h3>
              </div>
            ))}
          </section>

          <section className="section">
            <h2>Your subjects</h2>
            {!subjects && !error && <p className="muted">Loading subjects…</p>}
            {subjects && subjects.length === 0 && <p className="empty">No subjects have been added yet.</p>}
            <div className="grid">
              {subjects && subjects.map((s, i) => {
                const ids = s.units.flatMap((u) => u.topics.map((t) => t.id))
                const count = ids.filter((id) => done.includes(id)).length
                const pct = ids.length ? Math.round((count / ids.length) * 100) : 0
                const sem = s.semesters
                return (
                  <Link key={s.id} to={`/subject/${s.id}`} className={`subject-card tone-${i % 6}`}>
                    <div className="sc-ic"><Icon name={SUBJECT_ICONS[i % 6]} /></div>
                    <h3>{s.name}</h3>
                    <p className="small muted">
                      {s.units.length} {s.units.length === 1 ? 'Unit' : 'Units'}
                      {sem ? `, Semester ${sem.number}` : ''}
                    </p>
                    <div className="progress"><span style={{ width: `${pct}%` }} /></div>
                    <p className="small muted">{pct}% completed</p>
                  </Link>
                )
              })}
            </div>
            {subjects && allTopics.length > 0 && (
              <p className="small muted stats">
                {subjects.length} {subjects.length === 1 ? 'subject' : 'subjects'}, {allTopics.length} topics, {withNotes} with notes so far.
              </p>
            )}
          </section>
        </>
      )}
    </>
  )
}
