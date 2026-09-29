import { createContext, useContext, useEffect, useState } from 'react'
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Files live in a public Supabase Storage bucket named "notes"
export function fileUrl(path, download = false) {
  return supabase.storage
    .from('notes')
    .getPublicUrl(path, download ? { download: true } : undefined).data.publicUrl
}

// Progress and bookmarks are saved in the student's own browser.
function read(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || []
  } catch {
    return []
  }
}

export function useSavedList(key) {
  const [items, setItems] = useState(() => read(key))

  function toggle(id) {
    setItems((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }

  return [items, toggle]
}

const AuthContext = createContext(null)
export const useAuthCtx = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [state, setState] = useState({ loading: true, user: null, role: null, name: '' })

  useEffect(() => {
    let active = true

    async function load(session) {
      const user = session?.user || null
      if (!user) {
        if (active) setState({ loading: false, user: null, role: null, name: '' })
        return
      }
      const { data } = await supabase
        .from('profiles')
        .select('role,full_name,is_active')
        .eq('id', user.id)
        .single()
      if (active) {
        setState({
          loading: false,
          user,
          role: data && data.is_active !== false ? data.role : null,
          name: data?.full_name || '',
        })
      }
    }

    supabase.auth.getSession().then(({ data }) => load(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => load(session), 0)
    })
    return () => {
      active = false
      sub.subscription.unsubscribe()
    }
  }, [])

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
