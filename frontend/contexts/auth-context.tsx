'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { User, LoginRequest, RegisterRequest } from '@/types'
import { apiClient, handleApiError } from '@/lib/api'

interface AuthContextType {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
  login: (credentials: LoginRequest) => Promise<void>
  register: (data: RegisterRequest) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (data: Partial<User>) => Promise<void>
  error: string | null
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const clearError = () => setError(null)

  // Check for stored tokens on mount
  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        const { accessToken } = apiClient.getStoredTokens()
        if (accessToken) {
          const userData = await apiClient.getCurrentUser()
          setUser(userData)
        }
      } catch (error) {
        // Token might be invalid, clear it
        apiClient.clearTokens()
        console.error('Auth check failed:', error)
      } finally {
        setIsLoading(false)
      }
    }

    // Listen for logout events from API client
    const handleLogout = () => {
      setUser(null)
      setError(null)
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('auth:logout', handleLogout)
    }

    checkAuthStatus()

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth:logout', handleLogout)
      }
    }
  }, [])

  const login = async (credentials: LoginRequest) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const tokenResponse = await apiClient.login(credentials)
      const userData = await apiClient.getCurrentUser()
      
      setUser(userData)
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const register = async (data: RegisterRequest) => {
    try {
      setIsLoading(true)
      setError(null)
      
      const tokenResponse = await apiClient.register(data)
      const userData = await apiClient.getCurrentUser()
      
      setUser(userData)
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      throw new Error(errorMessage)
    } finally {
      setIsLoading(false)
    }
  }

  const logout = async () => {
    try {
      setIsLoading(true)
      await apiClient.logout()
    } catch (error) {
      console.error('Logout error:', error)
      // Continue with logout even if API call fails
    } finally {
      setUser(null)
      setIsLoading(false)
    }
  }

  const updateProfile = async (data: Partial<User>) => {
    try {
      setError(null)
      const updatedUser = await apiClient.updateProfile(data)
      setUser(updatedUser)
    } catch (error) {
      const errorMessage = handleApiError(error)
      setError(errorMessage)
      throw new Error(errorMessage)
    }
  }

  const value: AuthContextType = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    updateProfile,
    error,
    clearError,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}