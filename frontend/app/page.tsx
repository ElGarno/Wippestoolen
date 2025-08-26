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
              Leihen Sie was Sie brauchen,
              <br />
              <span className="text-primary">teilen Sie was Sie haben</span>
            </h1>
            <p className="text-xl text-gray-600 mb-8 max-w-3xl mx-auto">
              Verbinden Sie sich mit Ihren Nachbarn in Attendorn zum Leihen und Verleihen von Werkzeugen. 
              Sparen Sie Geld, reduzieren Sie Abfall und bauen Sie Gemeinschaftsverbindungen auf.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/tools">
                  <Search className="w-4 h-4 mr-2" />
                  Werkzeuge durchsuchen
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/auth/register">
                  Der Gemeinschaft beitreten
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
              Wie Wippestoolen funktioniert
            </h2>
            <p className="text-lg text-gray-600">
              Einfaches, sicheres und gemeinschaftsorientiertes Werkzeug-Sharing
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Search className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Werkzeuge finden</CardTitle>
                <CardDescription>
                  Suchen Sie nach Werkzeugen, die Sie in Ihrer Nachbarschaft benötigen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Durchsuchen Sie tausende von Werkzeugen, die in der Nähe zu mieten sind. Von Elektrowerkzeugen bis Gartengeräten, finden Sie was Sie brauchen, wann Sie es brauchen.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Wrench className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Buchen & Nutzen</CardTitle>
                <CardDescription>
                  Anfragen, abholen und Werkzeuge sicher nutzen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Senden Sie Buchungsanfragen, vereinbaren Sie Abholzeiten und nutzen Sie Werkzeuge mit Vertrauen, wissend dass sie versichert und gewartet sind.
                </p>
              </CardContent>
            </Card>

            <Card className="text-center">
              <CardHeader>
                <div className="mx-auto w-12 h-12 bg-primary rounded-lg flex items-center justify-center mb-4">
                  <Star className="w-6 h-6 text-white" />
                </div>
                <CardTitle>Bewerten & Rezensieren</CardTitle>
                <CardDescription>
                  Vertrauen durch Gemeinschaftsfeedback aufbauen
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Hinterlassen Sie Bewertungen und Ratings, um eine vertrauensvolle Gemeinschaft aufzubauen, in der sich jeder beim Leihen und Verleihen sicher fühlt.
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
            Bereit, der Gemeinschaft beizutreten?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Beginnen Sie heute mit dem Leihen und Verleihen von Werkzeugen mit Ihren Nachbarn in Attendorn
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="secondary" size="lg" asChild>
              <Link href="/auth/register">
                Kostenlos registrieren
              </Link>
            </Button>
            <Button variant="outline" size="lg" asChild className="text-white border-white hover:bg-white hover:text-primary">
              <Link href="/tools">
                <Search className="w-4 h-4 mr-2" />
                Werkzeuge durchsuchen
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </Layout>
  )
}
