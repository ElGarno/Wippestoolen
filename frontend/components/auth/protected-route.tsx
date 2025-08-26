'use client'

import { useEffect, ReactNode } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'

interface ProtectedRouteProps {
  children: ReactNode
  fallback?: ReactNode
  requireAuth?: boolean
}

export function ProtectedRoute({ 
  children, 
  fallback, 
  requireAuth = true 
}: ProtectedRouteProps) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (!isLoading && requireAuth && !isAuthenticated) {
      // Store the intended destination for redirect after login
      const redirectUrl = `/auth/login?redirectTo=${encodeURIComponent(pathname)}`
      router.push(redirectUrl)
    }
  }, [isLoading, isAuthenticated, requireAuth, router, pathname])

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      )
    )
  }

  // If auth is required but user is not authenticated, show nothing
  // (useEffect will handle the redirect)
  if (requireAuth && !isAuthenticated) {
    return null
  }

  // If auth is not required or user is authenticated, render children
  return <>{children}</>
}

// Hook for easy route protection
export function useAuthGuard(requireAuth: boolean = true) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const redirectToLogin = () => {
    const redirectUrl = `/auth/login?redirectTo=${encodeURIComponent(pathname)}`
    router.push(redirectUrl)
  }

  const canAccess = !requireAuth || isAuthenticated

  return {
    isAuthenticated,
    isLoading,
    canAccess,
    redirectToLogin,
  }
}