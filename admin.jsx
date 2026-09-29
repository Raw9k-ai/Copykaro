import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, fileUrl, useAuthCtx } from './lib'

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })

export function Admin() {
  const auth = useAuthCtx()
  const [pending, setPending] = useState([])
  const [names, setNames] = useState({})
  const [reports, setReports] = useState([])
  const [comments, setComments] = useState({})
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: p } = await supabase
      .from('note_versions')
      .select('id,version_number,file_path,change_description,created_at,contributor_id,notes!note_versions_note_id_fkey(topics(title,units(subjects(name))))')
      .eq('status', 'pending')
      .order('created_at')
    setPending(p || [])

    const ids = [...new Set((p || []).map((x) => x.contributor_id))]
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id,full_name').in('id', ids)
      setNames(Object.fromEntries((profs || []).map((x) => [x.id, x.full_name])))
    }

    const { data: r } = await supabase
      .from('reports')
      .select('id,reason,details,created_at,notes(topics(title))')
      .eq('status', 'open')
      .order('created_at')
    setReports(r || [])
  }

  useEffect(() => {
    if (auth.role === 'admin') load()
  }, [auth.role])

  if (auth.loading) return <p className="muted">Loading…</p>
  if (auth.role !== 'admin') return <p>This page is for the admin. <Link to="/login">Log in</Link></p>

  async function approve(id) {
    setMsg('')
    const { error } = await supabase.rpc('approve_version', { p_version_id: id, p_comment: comments[id] || null })
    setMsg(error ? 'Could not approve: ' + error.message : 'Approved. This is now the current version.')
    load()
  }

  async function reject(id) {
    setMsg('')
    if (!comments[id]?.trim()) return setMsg('Please write a reason before rejecting, so the contributor can fix it.')
    const { error } = await supabase
      .from('note_versions')
      .update({ status: 'rejected', reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(), review_comment: comments[id] })
      .eq('id', id)
    setMsg(error ? 'Could not reject: ' + error.message : 'Rejected.')
    load()
  }

  async function closeReport(id, status) {
    await supabase.from('reports').update({ status }).eq('id', id)
    load()
  }

  return (
    <>
      <h1>Admin review</h1>
      {msg && <p className="small"><strong>{msg}</strong></p>}

      <section className="unit">
        <h2>Pending uploads ({pending.length})</h2>
        {pending.length === 0 && <p className="empty">Nothing waiting for review.</p>}
        {pending.map((v) => (
          <div key={v.id} className="version">
            <strong>{v.notes?.topics?.title}</strong>
            <span className="small muted"> {v.notes?.topics?.units?.subjects?.name}</span>
            <p className="small muted">Version {v.version_number} by {names[v.contributor_id] || 'Contributor'}, {fmt(v.created_at)}</p>
            <p>{v.change_description}</p>
            <a href={fileUrl(v.file_path)} target="_blank" rel="noreferrer">Open file to check</a>
            <label>Comment (required to reject)
              <input value={comments[v.id] || ''} onChange={(e) => setComments({ ...comments, [v.id]: e.target.value })} />
            </label>
            <div className="actions">
              <button className="btn ok" onClick={() => approve(v.id)}>Approve</button>
              <button className="btn" onClick={() => reject(v.id)}>Reject</button>
            </div>
          </div>
        ))}
      </section>

      <section className="unit">
        <h2>Open reports ({reports.length})</h2>
        {reports.length === 0 && <p className="empty">No open reports.</p>}
        {reports.map((r) => (
          <div key={r.id} className="version">
            <strong>{r.notes?.topics?.title}</strong>
            <span className="tag"> {r.reason}</span>
            <p className="small muted">{fmt(r.created_at)}</p>
            {r.details && <p>{r.details}</p>}
            <div className="actions">
              <button className="btn" onClick={() => closeReport(r.id, 'resolved')}>Resolved</button>
              <button className="btn" onClick={() => closeReport(r.id, 'dismissed')}>Dismiss</button>
            </div>
          </div>
        ))}
      </section>
    </>
  )
}
