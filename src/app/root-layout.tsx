import { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router'
import { APP_NAME } from '@/lib/app'

export function RootLayout() {
  const location = useLocation()
  useEffect(() => {
    if (!location.pathname.startsWith('/b/') && !location.pathname.startsWith('/w/')) document.title = APP_NAME
    if (!location.hash) window.scrollTo(0, 0)
  }, [location.pathname, location.hash])
  return <Outlet />
}
