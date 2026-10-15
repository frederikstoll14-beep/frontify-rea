import { LayoutGrid, LogIn, LogOut, Moon, Sun, UserRound } from 'lucide-react'
import { Link, useLocation, useNavigate } from 'react-router'
import { displayName, useAuth } from '@/api/auth'
import { Button } from '@/components/ui/button'
import { MenuContent, MenuItem, MenuLabel, MenuRoot, MenuSeparator, MenuTrigger } from '@/components/ui/menu'
import { Avatar } from '@/components/ui/misc'
import { supabase } from '@/lib/supabase'
import { useTheme } from './theme'

export function UserMenu() {
  const { user, profile } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { theme, toggle } = useTheme()

  if (!user) {
    return (
      <Button asChild size="sm" variant="outline">
        <Link to={`/login?weiter=${encodeURIComponent(location.pathname)}`}>
          <LogIn /> Anmelden
        </Link>
      </Button>
    )
  }
  const name = displayName(profile ?? { full_name: '', email: user.email ?? '' })
  return (
    <MenuRoot>
      <MenuTrigger asChild>
        <button type="button" className="rounded-full" aria-label="Konto-Menü">
          <Avatar name={name} />
        </button>
      </MenuTrigger>
      <MenuContent>
        <MenuLabel>
          <span className="block truncate normal-case tracking-normal text-ink">{name}</span>
          <span className="block truncate font-normal normal-case tracking-normal">{user.email}</span>
        </MenuLabel>
        <MenuSeparator />
        <MenuItem icon={<LayoutGrid />} onSelect={() => navigate('/')}>
          Meine Workspaces
        </MenuItem>
        <MenuItem icon={<UserRound />} onSelect={() => navigate('/konto')}>
          Konto
        </MenuItem>
        <MenuItem icon={theme === 'dark' ? <Sun /> : <Moon />} onSelect={toggle}>
          {theme === 'dark' ? 'Helles Design' : 'Dunkles Design'}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          icon={<LogOut />}
          onSelect={async () => {
            await supabase.auth.signOut()
            navigate('/login')
          }}
        >
          Abmelden
        </MenuItem>
      </MenuContent>
    </MenuRoot>
  )
}
