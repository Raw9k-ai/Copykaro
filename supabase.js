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
