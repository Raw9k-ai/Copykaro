import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase, useAuthCtx } from './lib'

const must = (res) => {
  if (res.error) throw res.error
  return res.data
}

// Delete the PDF files that belong to these topics before the topics are removed
async function purge(topicIds) {
  if (topicIds.length === 0) return
  const { data: notes } = await supabase.from('notes').select('id').in('topic_id', topicIds)
  const noteIds = (notes || []).map((n) => n.id)
  if (noteIds.length === 0) return
  const { data: vs } = await supabase.from('note_versions').select('file_path').in('note_id', noteIds)
  const paths = [...new Set((vs || []).map((v) => v.file_path))]
  if (paths.length) await supabase.storage.from('notes').remove(paths)
}

export function Syllabus() {
  const auth = useAuthCtx()
  const [sems, setSems] = useState([])
  const [subjects, setSubjects] = useState([])
  const [semId, setSemId] = useState('')
  const [subId, setSubId] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)
  const [semForm, setSemForm] = useState({ college: '', course: 'B.Tech', branch: '', number: '1' })
  const [subForm, setSubForm] = useState({ name: '', code: '' })
  const [unitNo, setUnitNo] = useState('')
  const [unitTitle, setUnitTitle] = useState('')
  const [bulk, setBulk] = useState({})

  async function load() {
    const { data: s } = await supabase
      .from('semesters')
      .select('id,college,course,branch,number')
      .order('course')
      .order('branch')
      .order('number')
    setSems(s || [])
    setSemId((cur) => cur || s?.[0]?.id || '')
    const { data: sub } = await supabase
      .from('subjects')
      .select('id,name,code,semester_id,units(id,unit_number,title,topics(id,title,position))')
      .order('name')
    setSubjects(sub || [])
  }

  useEffect(() => {
    if (auth.role === 'admin') load()
  }, [auth.role])

  if (auth.loading) return <p className="muted">Loading…</p>
  if (auth.role !== 'admin') return <p>This page is for the admin. <Link to="/login">Log in</Link></p>

  const semSubjects = subjects.filter((s) => s.semester_id === semId)
  const subject = subjects.find((s) => s.id === subId && s.semester_id === semId)
  const units = subject ? [...subject.units].sort((a, b) => a.unit_number - b.unit_number) : []
  const nextUnit = units.reduce((m, u) => Math.max(m, u.unit_number), 0) + 1

  async function run(fn, ok) {
    setBusy(true)
    setMsg('')
    try {
      await fn()
      setMsg(ok)
    } catch (e) {
      setMsg('Error: ' + (e.message || e))
    }
    await load()
    setBusy(false)
  }

  const addSemester = (e) => {
    e.preventDefault()
    run(async () => {
      const f = semForm
      const n = parseInt(f.number, 10)
      if (!f.college.trim() || !f.course.trim() || !f.branch.trim()) throw new Error('Fill in college, course and branch.')
      if (!n || n < 1) throw new Error('Semester number must be 1 or more.')
      const row = must(await supabase.from('semesters')
        .insert({ college: f.college.trim(), course: f.course.trim(), branch: f.branch.trim(), number: n })
        .select('id').single())
      setSemId(row.id)
      setSubId('')
    }, 'Semester added.')
  }

  const addSubject = (e) => {
    e.preventDefault()
    run(async () => {
      if (!semId) throw new Error('Choose a semester first.')
      if (!subForm.name.trim()) throw new Error('Type the subject name.')
      const row = must(await supabase.from('subjects')
        .insert({ semester_id: semId, name: subForm.name.trim(), code: subForm.code.trim() || null })
        .select('id').single())
      setSubForm({ name: '', code: '' })
      setSubId(row.id)
    }, 'Subject added.')
  }

  const addUnit = (e) => {
    e.preventDefault()
    run(async () => {
      if (!unitTitle.trim()) throw new Error('Type the unit title.')
      must(await supabase.from('units').insert({
        subject_id: subId,
        unit_number: parseInt(unitNo, 10) || nextUnit,
        title: unitTitle.trim(),
      }))
      setUnitNo('')
      setUnitTitle('')
    }, 'Unit added.')
  }

  const addTopics = (unit) =>
    run(async () => {
      const lines = (bulk[unit.id] || '')
        .split('\n')
        .map((x) => x.trim().replace(/^(?:[-*•]|\d+[.)])\s+/, ''))
        .filter(Boolean)
      if (lines.length === 0) throw new Error('Type at least one topic.')
      const start = unit.topics.reduce((m, t) => Math.max(m, t.position), 0)
      const created = must(await supabase.from('topics')
        .insert(lines.map((title, i) => ({ unit_id: unit.id, title, position: start + i + 1 })))
        .select('id'))
      must(await supabase.from('notes').insert(created.map((t) => ({ topic_id: t.id }))))
      setBulk({ ...bulk, [unit.id]: '' })
    }, 'Topics added.')

  const delTopic = (t) => {
    if (!window.confirm(`Delete the topic "${t.title}" and its notes?`)) return
    run(async () => {
      await purge([t.id])
      must(await supabase.from('topics').delete().eq('id', t.id))
    }, 'Topic deleted.')
  }

  const delUnit = (u) => {
    if (!window.confirm(`Delete Unit ${u.unit_number} with all its topics and notes?`)) return
    run(async () => {
      await purge(u.topics.map((t) => t.id))
      must(await supabase.from('units').delete().eq('id', u.id))
    }, 'Unit deleted.')
  }

  const delSubject = (s) => {
    if (!window.confirm(`Delete the subject "${s.name}" with all units, topics and notes?`)) return
    run(async () => {
      await purge(s.units.flatMap((u) => u.topics.map((t) => t.id)))
      must(await supabase.from('subjects').delete().eq('id', s.id))
      setSubId('')
    }, 'Subject deleted.')
  }

  return (
    <>
      <h1>Syllabus</h1>
      <p className="muted">Add your semester, subjects, units and topics. Students see changes straight away.</p>
      {msg && <p className="small"><strong>{msg}</strong></p>}

      <section className="card section">
        <h2>1. Semester</h2>
        {sems.length > 0 ? (
          <label>Choose semester
            <select value={semId} onChange={(e) => { setSemId(e.target.value); setSubId('') }}>
              {sems.map((s) => (
                <option key={s.id} value={s.id}>{s.course} {s.branch}, Semester {s.number} ({s.college})</option>
              ))}
            </select>
          </label>
        ) : (
          <p className="empty">No semester yet. Add one below.</p>
        )}
        <details className="panel">
          <summary>Add a new semester</summary>
          <form onSubmit={addSemester}>
            <label>College name
              <input value={semForm.college} onChange={(e) => setSemForm({ ...semForm, college: e.target.value })} />
            </label>
            <label>Course (for example B.Tech)
              <input value={semForm.course} onChange={(e) => setSemForm({ ...semForm, course: e.target.value })} />
            </label>
            <label>Branch (for example CSE)
              <input value={semForm.branch} onChange={(e) => setSemForm({ ...semForm, branch: e.target.value })} />
            </label>
            <label>Semester number
              <input inputMode="numeric" value={semForm.number} onChange={(e) => setSemForm({ ...semForm, number: e.target.value })} />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>Add semester</button>
          </form>
        </details>
      </section>

      {semId && (
        <section className="card section">
          <h2>2. Subjects</h2>
          {semSubjects.length === 0 && <p className="empty">No subjects in this semester yet.</p>}
          {semSubjects.length > 0 && (
            <div className="list">
              {semSubjects.map((s) => (
                <div key={s.id} className="row-link">
                  <span className="row-title">
                    {s.name}{s.code ? ` (${s.code})` : ''}
                    <span className="small muted block">{s.units.length} units</span>
                  </span>
                  {s.id === subId
                    ? <span className="pill blue">Selected</span>
                    : <button className="btn small" onClick={() => setSubId(s.id)}>Open</button>}
                  <button className="btn small reject" disabled={busy} onClick={() => delSubject(s)}>Delete</button>
                </div>
              ))}
            </div>
          )}
          <form onSubmit={addSubject}>
            <label>Subject name
              <input value={subForm.name} onChange={(e) => setSubForm({ ...subForm, name: e.target.value })} />
            </label>
            <label>Subject code (optional)
              <input value={subForm.code} onChange={(e) => setSubForm({ ...subForm, code: e.target.value })} />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>Add subject</button>
          </form>
        </section>
      )}

      {subject && (
        <section className="section">
          <h2>3. Units and topics in {subject.name}</h2>
          {units.length === 0 && <p className="empty">No units yet. Add the first one below.</p>}
          {units.map((u) => (
            <div key={u.id} className="card review">
              <div className="title-row">
                <h3>Unit {u.unit_number}: {u.title}</h3>
                <button className="btn small reject" disabled={busy} onClick={() => delUnit(u)}>Delete unit</button>
              </div>
              {u.topics.length > 0 && (
                <div className="list">
                  {[...u.topics].sort((a, b) => a.position - b.position).map((t) => (
                    <div key={t.id} className="row-link">
                      <span className="row-title">{t.title}</span>
                      <button className="btn small reject" disabled={busy} onClick={() => delTopic(t)}>Delete</button>
                    </div>
                  ))}
                </div>
              )}
              <label>Add topics (one per line)
                <textarea
                  rows="4"
                  placeholder={'for loop\nwhile loop\ndo-while loop'}
                  value={bulk[u.id] || ''}
                  onChange={(e) => setBulk({ ...bulk, [u.id]: e.target.value })}
                />
              </label>
              <button className="btn primary" disabled={busy} onClick={() => addTopics(u)}>Add topics</button>
            </div>
          ))}

          <form className="card" onSubmit={addUnit}>
            <h3>Add a unit</h3>
            <label>Unit number (leave empty for {nextUnit})
              <input inputMode="numeric" value={unitNo} onChange={(e) => setUnitNo(e.target.value)} />
            </label>
            <label>Unit title
              <input value={unitTitle} onChange={(e) => setUnitTitle(e.target.value)} />
            </label>
            <button className="btn primary" type="submit" disabled={busy}>Add unit</button>
          </form>
        </section>
      )}
    </>
  )
}
