import { useState } from 'react'

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
