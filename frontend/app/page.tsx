import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Layout } from '@/components/layout/layout'
import { Search, Wrench, Users, Star } from 'lucide-react'

export default function Home() {
  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-to-r from-blue-50 to-indigo-50 py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
              Borrow what you need,
              <br />
              <span className="text-primary">share what you have</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Connect with your neighbors to borrow and lend tools. 
              Save money, reduce waste, and build community connections.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/tools">
                  <Search className="w-4 h-4 mr-2" />
                  Browse Tools
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/auth/register">
                  Join Community
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              How Wippestoolen Works
            </h2>
            <p className="text-lg text-gray-600">
              Simple, safe, and community-focused tool sharing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Find Tools</CardTitle>
                <CardDescription>
                  Search for tools you need in your neighborhood
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Browse thousands of tools available for rent nearby. From power tools to garden equipment, find what you need when you need it.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Book & Use</CardTitle>
                <CardDescription>
                  Request, pickup, and use tools safely
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Send booking requests, arrange pickup times, and use tools with confidence knowing they're insured and maintained.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Rate & Review</CardTitle>
                <CardDescription>
                  Build trust through community feedback
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Leave reviews and ratings to help build a trusted community where everyone feels confident borrowing and lending.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-primary text-white py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <Users className="mx-auto w-16 h-16 mb-6" />
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to join the community?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Start borrowing and lending tools with your neighbors today
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg" asChild>
              <Link href="/auth/register">
                Sign Up Free
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-white border-white hover:bg-white hover:text-primary">
              <Link href="/tools">
                <Search className="w-4 h-4 mr-2" />
                Browse Tools
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  )
}
