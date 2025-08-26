import Link from 'next/link'

export function Footer() {
  return (
    <footer className="bg-gray-50 border-t">
      <div className="max-w-7xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="col-span-1 md:col-span-2">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Wippestoolen</h3>
            <p className="text-gray-600 mb-4">
              Your neighborhood tool-sharing platform. Borrow what you need, share what you have.
            </p>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Platform
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/tools" className="text-gray-600 hover:text-primary">
                  Browse Tools
                </Link>
              </li>
              <li>
                <Link href="/categories" className="text-gray-600 hover:text-primary">
                  Categories
                </Link>
              </li>
              <li>
                <Link href="/how-it-works" className="text-gray-600 hover:text-primary">
                  How it Works
                </Link>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">
              Support
            </h4>
            <ul className="space-y-2">
              <li>
                <Link href="/help" className="text-gray-600 hover:text-primary">
                  Help Center
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-gray-600 hover:text-primary">
                  Contact Us
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-gray-600 hover:text-primary">
                  Terms of Service
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-gray-600 hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="mt-8 pt-8 border-t border-gray-200">
          <p className="text-center text-gray-500 text-sm">
            © {new Date().getFullYear()} Wippestoolen. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}