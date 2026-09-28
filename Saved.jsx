import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../supabase'
import { useSavedList } from '../store'

export default function Saved() {
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

  const list = (ids) =>
    ids.filter((id) => topics[id]).map((id) => (
      <Link key={id} to={`/topic/${id}`} className="topic-row">
        <span className="topic-title">{topics[id].title}</span>
        <span className="small muted">{topics[id].units?.subjects?.name}</span>
      </Link>
    ))

  return (
    <>
      <h1>My study</h1>
      <p className="lead">Saved on this device only. Clearing your browser data removes it.</p>
      {error && <p className="error">Could not load your list: {error}</p>}

      <section className="unit">
        <h2>Bookmarks ({saved.length})</h2>
        {saved.length === 0 ? <p className="empty">Nothing bookmarked yet. Open a topic and tap Bookmark.</p> : list(saved)}
      </section>

      <section className="unit">
        <h2>Completed ({done.length})</h2>
        {done.length === 0 ? <p className="empty">No completed topics yet.</p> : list(done)}
      </section>
    </>
  )
}
