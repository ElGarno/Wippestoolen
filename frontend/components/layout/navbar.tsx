'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Menu, X, Bell, User, Search, Plus } from 'lucide-react'

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuth()

  const handleLogout = async () => {
    try {
      await logout()
    } catch (error) {
      console.error('Logout failed:', error)
    }
  }

  return (
    <nav className="bg-white shadow-sm border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex-shrink-0">
            <Link href="/" className="text-xl font-bold text-primary">
              Wippestoolen
            </Link>
          </div>

          {/* Desktop Navigation */}
          <div className="hidden md:block">
            <div className="ml-10 flex items-baseline space-x-4">
              <Link href="/tools" className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-sm font-medium">
                Browse Tools
              </Link>
              <Link href="/categories" className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-sm font-medium">
                Categories
              </Link>
              {isAuthenticated && (
                <>
                  <Link href="/bookings" className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-sm font-medium">
                    My Bookings
                  </Link>
                  <Link href="/my-tools" className="text-gray-600 hover:text-primary px-3 py-2 rounded-md text-sm font-medium">
                    My Tools
                  </Link>
                </>
              )}
            </div>
          </div>

          {/* Desktop Actions */}
          <div className="hidden md:flex items-center space-x-4">
            {isAuthenticated ? (
              <>
                <Button variant="outline" size="sm" asChild>
                  <Link href="/tools/new">
                    <Plus className="h-4 w-4 mr-2" />
                    List Tool
                  </Link>
                </Button>
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/notifications">
                    <Bell className="h-4 w-4" />
                  </Link>
                </Button>
                <div className="relative">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/profile">
                      <User className="h-4 w-4 mr-2" />
                      {user?.full_name}
                    </Link>
                  </Button>
                </div>
                <Button variant="ghost" size="sm" onClick={handleLogout}>
                  Logout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" asChild>
                  <Link href="/auth/login">Login</Link>
                </Button>
                <Button asChild>
                  <Link href="/auth/register">Sign Up</Link>
                </Button>
              </>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsOpen(!isOpen)}
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isOpen && (
        <div className="md:hidden">
          <div className="px-2 pt-2 pb-3 space-y-1 sm:px-3 bg-gray-50">
            <Link
              href="/tools"
              className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsOpen(false)}
            >
              Browse Tools
            </Link>
            <Link
              href="/categories"
              className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
              onClick={() => setIsOpen(false)}
            >
              Categories
            </Link>
            
            {isAuthenticated ? (
              <>
                <Link
                  href="/bookings"
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  My Bookings
                </Link>
                <Link
                  href="/my-tools"
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  My Tools
                </Link>
                <Link
                  href="/tools/new"
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  List Tool
                </Link>
                <Link
                  href="/notifications"
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  Notifications
                </Link>
                <Link
                  href="/profile"
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  Profile
                </Link>
                <button
                  onClick={() => {
                    handleLogout()
                    setIsOpen(false)
                  }}
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium w-full text-left"
                >
                  Logout
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/auth/login"
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  Login
                </Link>
                <Link
                  href="/auth/register"
                  className="text-gray-600 hover:text-primary block px-3 py-2 rounded-md text-base font-medium"
                  onClick={() => setIsOpen(false)}
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  )
}