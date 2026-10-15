import { createBrowserRouter, Link, Navigate, Outlet } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/misc'
import { ActivityPage } from '@/features/activity/activity-page'
import { ForgotPasswordPage, LoginPage, RequireAuth, ResetPasswordPage } from '@/features/auth/auth-pages'
import { BasicsPage } from '@/features/basics/basics-page'
import { BrandLayout } from '@/features/brand/brand-layout'
import { PortalHome } from '@/features/brand/portal-home'
import { GuidelineIndex, GuidelineLayout } from '@/features/guidelines/guideline-layout'
import { GuidelinePageView } from '@/features/guidelines/guideline-page'
import { LibraryPage } from '@/features/library/library-page'
import { PrintPage } from '@/features/print/print-page'
import { BrandSettingsPage } from '@/features/settings/brand-settings'
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
              { path: ':pageSlug', element: <GuidelinePageView /> },
            ],
          },
          { path: 'bibliothek/:librarySlug', element: <LibraryPage /> },
          { path: 'basis', element: <BasicsPage /> },
          { path: 'aktivitaet', element: <ActivityPage /> },
          { path: 'einstellungen', element: <BrandSettingsPage /> },
          { path: 'drucken/:guidelineSlug', element: <PrintPage /> },
        ],
      },
      { path: '*', element: <NotFound /> },
    ],
  },
])
