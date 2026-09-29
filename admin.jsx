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
  const [tab, setTab] = useState('pending')
  const [totals, setTotals] = useState({ topics: 0, live: 0 })

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

    const t = await supabase.from('topics').select('id', { count: 'exact', head: true })
    const n = await supabase.from('notes').select('id', { count: 'exact', head: true }).not('current_version_id', 'is', null)
    setTotals({ topics: t.count || 0, live: n.count || 0 })
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

  async function reject(id, path) {
    setMsg('')
    if (!comments[id]?.trim()) return setMsg('Please write a reason before rejecting, so the contributor can fix it.')
    if (!window.confirm('Reject this upload and permanently delete the file?')) return
    const { error } = await supabase
      .from('note_versions')
      .update({ status: 'rejected', reviewed_by: auth.user.id, reviewed_at: new Date().toISOString(), review_comment: comments[id].trim() })
      .eq('id', id)
      .eq('status', 'pending')
    if (error) return setMsg('Could not reject: ' + error.message)
    const rm = await supabase.storage.from('notes').remove([path])
    setMsg(rm.error ? 'Rejected, but the file could not be deleted: ' + rm.error.message : 'Rejected. The file was deleted and your reason was saved.')
    load()
  }

  async function closeReport(id, status) {
    await supabase.from('reports').update({ status }).eq('id', id)
    load()
  }

  return (
    <>
      <h1>Admin panel</h1>

      <div className="stats-grid">
        <div className="stat tone-3"><b>{pending.length}</b><span>Pending updates</span></div>
        <div className="stat tone-0"><b>{totals.topics}</b><span>Total topics</span></div>
        <div className="stat tone-2"><b>{totals.live}</b><span>Notes live</span></div>
        <div className="stat tone-4"><b>{reports.length}</b><span>Open reports</span></div>
      </div>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={tab === 'pending'} className={`tab ${tab === 'pending' ? 'on' : ''}`} onClick={() => setTab('pending')}>Pending updates</button>
        <button role="tab" aria-selected={tab === 'reports'} className={`tab ${tab === 'reports' ? 'on' : ''}`} onClick={() => setTab('reports')}>Reports</button>
      </div>
      {msg && <p className="small"><strong>{msg}</strong></p>}

      {tab === 'pending' && (
        <section>
          {pending.length === 0 && <p className="empty">Nothing waiting for review.</p>}
          {pending.map((v) => (
            <div key={v.id} className="card review">
              <strong>{v.notes?.topics?.title}</strong>
              <span className="small muted"> {v.notes?.topics?.units?.subjects?.name}</span>
              <p className="small muted">Version {v.version_number} by {names[v.contributor_id] || 'Contributor'}, {fmt(v.created_at)}</p>
              <p>{v.change_description}</p>
              <a href={fileUrl(v.file_path)} target="_blank" rel="noreferrer">Open file to check</a>
              <label>Comment (required to reject)
                <input value={comments[v.id] || ''} onChange={(e) => setComments({ ...comments, [v.id]: e.target.value })} />
              </label>
              <div className="actions">
                <button className="btn approve" onClick={() => approve(v.id)}>Approve</button>
                <button className="btn reject" onClick={() => reject(v.id, v.file_path)}>Reject and delete file</button>
              </div>
            </div>
          ))}
        </section>
      )}

      {tab === 'reports' && (
        <section>
          {reports.length === 0 && <p className="empty">No open reports.</p>}
          {reports.map((r) => (
            <div key={r.id} className="card review">
              <strong>{r.notes?.topics?.title}</strong> <span className="pill amber">{r.reason}</span>
              <p className="small muted">{fmt(r.created_at)}</p>
              {r.details && <p>{r.details}</p>}
              <div className="actions">
                <button className="btn approve" onClick={() => closeReport(r.id, 'resolved')}>Resolved</button>
                <button className="btn" onClick={() => closeReport(r.id, 'dismissed')}>Dismiss</button>
              </div>
            </div>
          ))}
        </section>
      )}
    </>
  )
}
