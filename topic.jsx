import { useEffect, useState } from 'react'
import { supabase, fileUrl, useSavedList } from './lib'
import { useParams } from 'react-router-dom'
import { Icon, Crumbs, Pill } from './ui'

const REASONS = [
  ['incorrect', 'Incorrect content'],
  ['outdated', 'Outdated'],
  ['wrong_syllabus', 'Not in the syllabus'],
  ['copyright', 'Copyright issue'],
  ['other', 'Other'],
]

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function Topic() {
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
        localStorage.setItem('copykaro:last', JSON.stringify({ id: data.id, title: data.title }))
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

  const crumbs = [{ to: '/', label: 'Subjects' }]
  if (subject) crumbs.push({ to: `/subject/${subject.id}`, label: subject.name })
  crumbs.push({ label: topic.title })

  return (
    <>
      <Crumbs items={crumbs} />
      <div className="card">
        <div className="title-row">
          <h1>{topic.title}</h1>
          {current && <Pill tone="green">Current Version</Pill>}
        </div>
        <p className="meta">
          Unit {topic.units.unit_number}: {topic.units.title}
          {current ? `. Last updated ${fmt(current.created_at)}` : ''}
        </p>

        {current && (
          <div className="actions">
            <a className="btn primary" href={fileUrl(current.file_path)} target="_blank" rel="noreferrer">Read online</a>
            <a className="btn" href={fileUrl(current.file_path, true)}><Icon name="download" size={18} /> Download PDF</a>
          </div>
        )}
        <div className="actions">
          <button className={`btn ${isDone ? 'ok' : ''}`} onClick={() => toggleDone(topic.id)}>
            {isDone ? '✓ Completed' : 'Mark complete'}
          </button>
          <button className={`btn ${isSaved ? 'hl' : ''}`} onClick={() => toggleSaved(topic.id)}>
            {isSaved ? 'Bookmarked' : 'Bookmark'}
          </button>
        </div>
      </div>

      {!current && <p className="empty section">Notes for this topic haven’t been added yet. Check back soon.</p>}

      {current && (
        <>
          <div className="card summary">
            <h3>Note summary</h3>
            <p>{current.change_description || 'No summary was added for this version.'}</p>
            <p className="small muted">Version {current.version_number}</p>
          </div>
          <iframe className="viewer" title={`${topic.title} notes`} src={fileUrl(current.file_path)} />
          <p className="small muted">If the notes don’t show above, use Read online.</p>
        </>
      )}

      {versions.length > 0 && (
        <section className="card section">
          <h2>Version history</h2>
          {versions.map((v) => (
            <div key={v.id} className="tl">
              <div className={`tl-v ${v.id === current?.id ? 'cur' : ''}`}>v{v.version_number}</div>
              <div className="tl-body">
                <strong>{fmt(v.created_at)}</strong>
                {v.id === current?.id && <> <Pill tone="green">Current</Pill></>}
                {v.change_description && <p>{v.change_description}</p>}
                <a href={fileUrl(v.file_path)} target="_blank" rel="noreferrer">Open this version</a>
              </div>
            </div>
          ))}
        </section>
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
