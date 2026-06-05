import { redirect } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import LandingPage from '@/components/landing/LandingPage'

export default async function HomePage() {
  let user = null
  let role = null

  try {
    const supabase = await createServerSupabase()
    const { data: { user: u } } = await supabase.auth.getUser()
    user = u
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()
      role = profile?.role
    }
  } catch { /* no session → show landing */ }

  if (user && role === 'coach') redirect('/dashboard')
  if (user && role === 'cliente') redirect('/cliente')

  return <LandingPage />
}
