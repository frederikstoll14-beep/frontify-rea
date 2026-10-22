import { createBrowserRouter, Link, Navigate, Outlet } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { ForgotPasswordPage, LoginPage, RequireAuth, ResetPasswordPage } from '@/features/auth/auth-pages'
import { BrandLayout } from '@/features/brand/brand-layout'
import { OAuthConsentPage } from '@/features/connections/oauth-consent-page'
import { PortalHome } from '@/features/brand/portal-home'
import { GuidelineIndex, GuidelineLayout } from '@/features/guidelines/guideline-layout'
import { AccountPage } from '@/features/workspace/account-page'
import { DashboardPage } from '@/features/workspace/dashboard-page'
import { InvitePage } from '@/features/workspace/invite-page'
import { WorkspacePage } from '@/features/workspace/workspace-page'
import { RootLayout } from './root-layout'

function NotFound() {
  return (
    <AppShell>
      <EmptyState
        title="Seite nicht gefunden"
        description="Der Link ist falsch oder die Seite wurde verschoben."
        action={
          <Button asChild variant="outline">
            <Link to="/">Zur Startseite</Link>
          </Button>
        }
      />
    </AppShell>
  )
}

function Protected() {
  return (
    <RequireAuth>
      <Outlet />
    </RequireAuth>
  )
}

export const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/login', element: <LoginPage /> },
      { path: '/registrieren', element: <Navigate to="/login?modus=registrieren" replace /> },
      { path: '/passwort-vergessen', element: <ForgotPasswordPage /> },
      { path: '/passwort-neu', element: <ResetPasswordPage /> },
      { path: '/einladung/:token', element: <InvitePage /> },
      {
        element: <Protected />,
        children: [
          { path: '/', element: <DashboardPage /> },
          { path: '/w/:workspaceSlug', element: <WorkspacePage /> },
          { path: '/konto', element: <AccountPage /> },
          { path: '/oauth/consent', element: <OAuthConsentPage /> },
        ],
      },
      {
        path: '/b/:brandSlug',
        element: <BrandLayout />,
        children: [
          { index: true, element: <PortalHome /> },
          {
            path: 'g/:guidelineSlug',
            element: <GuidelineLayout />,
            children: [
              { index: true, element: <GuidelineIndex /> },
              {
                path: ':pageSlug',
                lazy: () =>
                  import('@/features/guidelines/guideline-page').then((m) => ({
                    Component: m.GuidelinePageView,
                  })),
              },
            ],
          },
          {
            path: 'bibliothek/:librarySlug',
            lazy: () => import('@/features/library/library-page').then((m) => ({ Component: m.LibraryPage })),
          },
          {
            path: 'basis',
            lazy: () => import('@/features/basics/basics-page').then((m) => ({ Component: m.BasicsPage })),
          },
          {
            path: 'aktivitaet',
            lazy: () =>
              import('@/features/activity/activity-page').then((m) => ({ Component: m.ActivityPage })),
          },
          {
            path: 'einstellungen',
            lazy: () =>
              import('@/features/settings/brand-settings').then((m) => ({ Component: m.BrandSettingsPage })),
          },
          {
            path: 'drucken/:guidelineSlug',
            lazy: () => import('@/features/print/print-page').then((m) => ({ Component: m.PrintPage })),
          },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
