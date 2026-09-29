import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase, fileUrl, useAuthCtx } from './lib'
import { compressPdf } from './compress'

export function Login() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setBusy(true)
    setErr('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setErr(error.message)
    nav('/contribute')
  }

  return (
    <>
      <h1>Contributor login</h1>
      <p className="lead">For contributors and the admin only. Students don’t need to log in.</p>
      <form onSubmit={submit}>
        <label>Email
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label>Password
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Log in'}</button>
        {err && <p className="error">{err}</p>}
      </form>
    </>
  )
}

const fmt = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
const mb = (n) => (n / 1048576).toFixed(1)
const LEVELS = {
  balanced: { scale: 1.5, quality: 0.6 },
  smaller: { scale: 1.2, quality: 0.5 },
}

export function Contribute() {
  const auth = useAuthCtx()
  const [tree, setTree] = useState([])
  const [subjectId, setSubjectId] = useState('')
  const [unitId, setUnitId] = useState('')
  const [topicId, setTopicId] = useState('')
  const [file, setFile] = useState(null)
  const [desc, setDesc] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [mine, setMine] = useState([])
  const [compress, setCompress] = useState(true)
  const [level, setLevel] = useState('balanced')

  useEffect(() => {
    supabase
      .from('subjects')
      .select('id,name,units(id,unit_number,title,topics(id,title,position))')
      .order('name')
      .then(({ data }) => setTree(data || []))
  }, [])

  function loadMine() {
    if (!auth.user) return
    supabase
      .from('note_versions')
      .select('id,version_number,status,review_comment,created_at,file_path,notes!note_versions_note_id_fkey(topics(title))')
      .eq('contributor_id', auth.user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setMine(data || []))
  }
  useEffect(loadMine, [auth.user])

  if (auth.loading) return <p className="muted">Loading…</p>
  if (auth.role !== 'contributor' && auth.role !== 'admin') {
    return <p>Please <Link to="/login">log in as a contributor</Link> to upload notes.</p>
  }

  const subject = tree.find((s) => s.id === subjectId)
  const units = subject ? [...subject.units].sort((a, b) => a.unit_number - b.unit_number) : []
  const unit = units.find((u) => u.id === unitId)
  const topics = unit ? [...unit.topics].sort((a, b) => a.position - b.position) : []

  async function submit(e) {
    e.preventDefault()
    setMsg('')
    if (!topicId || !file || !desc.trim()) return setMsg('Choose a topic, add a PDF, and describe what this version covers or changes.')
    if (file.type !== 'application/pdf') return setMsg('Only PDF files are allowed.')
    if (file.size > 150 * 1024 * 1024) return setMsg('The file is over 150 MB. Please split it into parts.')
    if (!compress && file.size > 20 * 1024 * 1024) return setMsg('The file is over 20 MB. Turn on compression or make it smaller.')
    setBusy(true)

    let upFile = file
    if (compress) {
      try {
        upFile = await compressPdf(file, { ...LEVELS[level], onProgress: (i, n) => setMsg(`Compressing page ${i} of ${n}…`) })
      } catch (err) {
        upFile = file
        setMsg('Could not compress this file, using the original.')
      }
    }
    if (upFile.size > 20 * 1024 * 1024) {
      setBusy(false)
      return setMsg('Still over 20 MB after compressing. Please split the notes into smaller PDFs.')
    }

    const { data: note } = await supabase.from('notes').select('id').eq('topic_id', topicId).maybeSingle()
    if (!note) {
      setBusy(false)
      return setMsg('This topic has no note slot yet. Ask the admin.')
    }

    const path = `${topicId}/${Date.now()}.pdf`
    const up = await supabase.storage.from('notes').upload(path, upFile, { contentType: 'application/pdf' })
    if (up.error) {
      setBusy(false)
      return setMsg('Upload failed: ' + up.error.message)
    }

    const { data: latest } = await supabase
      .from('note_versions')
      .select('version_number')
      .eq('note_id', note.id)
      .order('version_number', { ascending: false })
      .limit(1)
    let v = (latest?.[0]?.version_number || 0) + 1
    let error = null
    for (let i = 0; i < 8; i++) {
      const res = await supabase.from('note_versions').insert({
        note_id: note.id,
        version_number: v,
        file_path: path,
        change_description: desc.trim(),
        contributor_id: auth.user.id,
      })
      error = res.error
      if (!error || error.code !== '23505') break
      v++
    }

    setBusy(false)
    if (error) return setMsg('Could not save: ' + error.message)
    setMsg(`Submitted! Size ${mb(file.size)} MB to ${mb(upFile.size)} MB. The admin will review it.`)
    setFile(null)
    setDesc('')
    e.target.reset()
    loadMine()
  }

  return (
    <>
      <h1>Upload notes</h1>
      <p className="lead">Hi {auth.name || 'there'}. Your upload goes to the admin for review before students see it.</p>

      <form onSubmit={submit}>
        <label>Subject
          <select value={subjectId} onChange={(e) => { setSubjectId(e.target.value); setUnitId(''); setTopicId('') }}>
            <option value="">Choose…</option>
            {tree.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </label>
        <label>Unit
          <select value={unitId} disabled={!subject} onChange={(e) => { setUnitId(e.target.value); setTopicId('') }}>
            <option value="">Choose…</option>
            {units.map((u) => <option key={u.id} value={u.id}>Unit {u.unit_number}: {u.title}</option>)}
          </select>
        </label>
        <label>Topic
          <select value={topicId} disabled={!unit} onChange={(e) => setTopicId(e.target.value)}>
            <option value="">Choose…</option>
            {topics.map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </label>
        <label>PDF file (max 20 MB)
          <input type="file" accept="application/pdf" onChange={(e) => setFile(e.target.files[0] || null)} />
        </label>
        <label>What does this version cover or change?
          <textarea rows="3" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
        <label>
          <input type="checkbox" checked={compress} onChange={(e) => setCompress(e.target.checked)} /> Compress the PDF
        </label>
        {compress && (
          <label>Compression
            <select value={level} onChange={(e) => setLevel(e.target.value)}>
              <option value="balanced">Balanced (good quality)</option>
              <option value="smaller">Smaller file (lower quality)</option>
            </select>
          </label>
        )}
        <p className="small muted">Compressing turns each page into an image, so text can’t be selected or searched. It works best for scanned or handwritten notes. Untick it for typed PDFs.</p>
        <p className="small muted">Only upload notes you wrote or have permission to share, and make sure they match the syllabus.</p>
        <button className="btn primary" type="submit" disabled={busy}>{busy ? 'Uploading…' : 'Submit for review'}</button>
        {msg && <p className="small"><strong>{msg}</strong></p>}
      </form>

      <section className="unit">
        <h2>My contributions</h2>
        {mine.length === 0 && <p className="empty">You haven’t submitted anything yet.</p>}
        {mine.map((v) => (
          <div key={v.id} className="version">
            <strong>{v.notes?.topics?.title || 'Topic'}</strong>
            <span className={`tag st-${v.status}`}> {v.status}</span>
            <p className="small muted">Version {v.version_number}, {fmt(v.created_at)}</p>
            {v.review_comment && <p className="small">Admin: {v.review_comment}</p>}
            {v.status === 'rejected'
              ? <p className="small muted">The file was removed after rejection. Fix the issues and upload again.</p>
              : <a href={fileUrl(v.file_path)} target="_blank" rel="noreferrer">Open file</a>}
          </div>
        ))}
      </section>
    </>
  )
}
