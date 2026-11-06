/**
 * Merkt sich eine geöffnete Einladung, bis sie eingelöst ist. Ohne das geht sie verloren, wenn die
 * Anmeldung oder E-Mail-Bestätigung nicht wieder auf der Einladungsseite landet.
 */
const KEY = 'pending_invite_token'

type Store = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function defaultStore(): Store | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/** Tokens sind kurze Hex-Zeichenfolgen; alles andere wird verworfen. */
export function isValidInviteToken(value: string): boolean {
  return /^[A-Za-z0-9_-]{8,128}$/.test(value)
}

/** Holt den Token aus einem eingefügten Link („…/einladung/abc123“) oder aus dem nackten Token. */
export function parseInviteToken(input: string): string | null {
  const text = input.trim()
  const fromLink = /\/einladung\/([^/?#\s]+)/.exec(text)?.[1]
  const candidate = fromLink ?? text
  return isValidInviteToken(candidate) ? candidate : null
}

export function rememberInvite(token: string, store: Store | null = defaultStore()): void {
  if (!store || !isValidInviteToken(token)) return
  try {
    store.setItem(KEY, token)
  } catch {
    /* Speicher gesperrt: dann bleibt es beim direkten Ablauf */
  }
}

export function pendingInvite(store: Store | null = defaultStore()): string | null {
  try {
    const value = store?.getItem(KEY) ?? null
    return value && isValidInviteToken(value) ? value : null
  } catch {
    return null
  }
}

export function forgetInvite(store: Store | null = defaultStore()): void {
  try {
    store?.removeItem(KEY)
  } catch {
    /* nichts zu tun */
  }
}

/** Seiten, auf denen eine offene Einladung nicht umgeleitet werden soll. */
export function shouldResumeInvite(pathname: string): boolean {
  return !/^\/(einladung\/|login|registrieren|passwort-|oauth\/)/.test(pathname)
}
