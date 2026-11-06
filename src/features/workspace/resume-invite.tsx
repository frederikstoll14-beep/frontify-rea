import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import { useAuth } from '@/api/auth'
import { pendingInvite, shouldResumeInvite } from '@/lib/pending-invite'

/**
 * Ist jemand angemeldet und hat zuvor einen Einladungslink geöffnet, der noch nicht eingelöst wurde
 * (z. B. weil die E-Mail-Bestätigung auf der Startseite gelandet ist), geht es dorthin zurück.
 */
export function ResumePendingInvite() {
  const { user, loading } = useAuth()
  const { pathname } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (loading || !user || !shouldResumeInvite(pathname)) return
    const token = pendingInvite()
    if (token) navigate(`/einladung/${token}`, { replace: true })
  }, [loading, user, pathname, navigate])

  return null
}
