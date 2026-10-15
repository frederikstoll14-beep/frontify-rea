import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { Toaster } from 'sonner'
import { AuthProvider } from '@/api/auth'
import { ThemeProvider } from '@/components/layout/theme'
import { ConfirmProvider } from '@/components/ui/confirm'
import { TooltipProvider } from '@/components/ui/misc'
import { SetupNotice } from '@/features/workspace/setup-notice'
import { isConfigured } from '@/lib/supabase'
import { router } from './app/router'
import './styles.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isConfigured ? (
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <AuthProvider>
            <TooltipProvider>
              <ConfirmProvider>
                <RouterProvider router={router} />
                <Toaster position="bottom-right" richColors closeButton />
              </ConfirmProvider>
            </TooltipProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryClientProvider>
    ) : (
      <SetupNotice />
    )}
  </StrictMode>,
)
