import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, useSavedList } from './lib'
import { Icon, Crumbs, Pill } from './ui'

export function Subject() {
  const { id } = useParams()
  const [subject, setSubject] = useState(null)
  const [error, setError] = useState('')
  const [open, setOpen] = useState(null)
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
  const sorted = (u) => [...u.topics].sort((a, b) => a.position - b.position)
  const allTopics = units.flatMap((u) => u.topics)
  const count = allTopics.filter((t) => done.includes(t.id)).length
  const pct = allTopics.length ? Math.round((count / allTopics.length) * 100) : 0

  const status = (u) => {
    const d = u.topics.filter((t) => done.includes(t.id)).length
    if (u.topics.length > 0 && d === u.topics.length) return ['green', 'Completed']
    if (d > 0) return ['blue', 'In progress']
    return ['grey', 'Not started']
  }
  const firstOpen = units.find((u) => status(u)[1] !== 'Completed')
  const openId = open === null ? firstOpen?.id : open
  const next = units.flatMap(sorted).find((t) => !done.includes(t.id))

  return (
    <>
      <Crumbs items={[{ to: '/', label: 'Subjects' }, { label: subject.name }]} />
      <div className="card subject-head">
        <div className="sc-ic big tone-0"><Icon name="code" size={26} /></div>
        <div className="sh-main">
          <h1>{subject.name}</h1>
          <p className="small muted">{units.length} Units, {pct}% completed</p>
          <div className="progress"><span style={{ width: `${pct}%` }} /></div>
        </div>
        {next && <Link to={`/topic/${next.id}`} className="btn primary">Continue: {next.title}</Link>}
      </div>

      <h2 className="section-h">Units</h2>
      {units.map((u) => {
        const [tone, label] = status(u)
        const isOpen = openId === u.id
        return (
          <section key={u.id} className="unit-card">
            <button className="unit-head" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? '' : u.id)}>
              <strong>Unit {u.unit_number}: {u.title}</strong>
              <Pill tone={tone}>{label}</Pill>
              <span className={`chev ${isOpen ? 'turn' : ''}`}><Icon name="chevron" size={18} /></span>
            </button>
            {isOpen && (
              <div className="unit-body">
                {sorted(u).map((t) => {
                  const note = Array.isArray(t.notes) ? t.notes[0] : t.notes
                  const isDone = done.includes(t.id)
                  return (
                    <Link key={t.id} to={`/topic/${t.id}`} className="row-link">
                      <span className={`check ${isDone ? 'on' : ''}`} aria-label={isDone ? 'Completed' : 'Not completed'}>{isDone ? '✓' : ''}</span>
                      <span className="row-title">{t.title}</span>
                      {!note?.current_version_id && <span className="pill">No notes yet</span>}
                      <span className="chev"><Icon name="chevron" size={18} /></span>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>
        )
      })}
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

  const list = (ids) => (
    <div className="list">
      {ids.filter((id) => topics[id]).map((id) => (
        <Link key={id} to={`/topic/${id}`} className="row-link">
          <span className="row-title">
            {topics[id].title}
            <span className="small muted block">{topics[id].units?.subjects?.name}</span>
          </span>
          <span className="chev"><Icon name="chevron" size={18} /></span>
        </Link>
      ))}
    </div>
  )

  return (
    <>
      <h1>My study</h1>
      <p className="lead">Saved on this device only. Clearing your browser data removes it.</p>
      {error && <p className="error">Could not load your list: {error}</p>}

      <section className="section">
        <h2>Bookmarks ({saved.length})</h2>
        {saved.length === 0 ? <p className="empty">Nothing bookmarked yet. Open a topic and tap Bookmark.</p> : list(saved)}
      </section>

      <section className="section">
        <h2>Completed ({done.length})</h2>
        {done.length === 0 ? <p className="empty">No completed topics yet.</p> : list(done)}
      </section>
    </>
  )
}
