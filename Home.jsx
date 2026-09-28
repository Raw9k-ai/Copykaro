import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useSavedList } from '../store'

export default function Home() {
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
