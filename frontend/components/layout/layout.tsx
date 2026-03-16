import { ReactNode } from 'react'
import { Navbar } from './navbar'
import { Footer } from './footer'

interface LayoutProps {
  children: ReactNode
  showFooter?: boolean
}

export function Layout({ children, showFooter = true }: LayoutProps) {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <main className="flex-1">
        {children}
      </main>
      {showFooter && <Footer />}
    </div>
  )
}