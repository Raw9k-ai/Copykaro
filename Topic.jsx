import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { supabase, fileUrl } from '../supabase'
import { useSavedList } from '../store'

const REASONS = [
  ['incorrect', 'Incorrect content'],
  ['outdated', 'Outdated'],
  ['wrong_syllabus', 'Not in the syllabus'],
  ['copyright', 'Copyright issue'],
  ['other', 'Other'],
]

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export default function Topic() {
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
