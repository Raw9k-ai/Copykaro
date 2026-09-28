import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase } from '../supabase'
import { useSavedList } from '../store'

export default function Subject() {
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
