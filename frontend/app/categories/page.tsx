'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { 
  Hammer, 
  Wrench, 
  Scissors, 
  TreePine,
  Sparkles,
  Car,
  Home,
  Camera,
  Dumbbell,
  Baby,
  Gamepad2,
  Search,
  ArrowRight,
  Zap
} from 'lucide-react'
import { ToolCategory } from '@/types'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'

// Icon mapping for categories
const categoryIcons: { [key: string]: React.ComponentType<any> } = {
  'power-tools': Hammer,
  'hand-tools': Wrench,
  'garden-tools': TreePine,
  'ladders-scaffolding': Zap,
  'cleaning-equipment': Sparkles,
  'automotive': Car,
  'household': Home,
  'painting-tools': Camera,
  'sports': Dumbbell,
  'baby': Baby,
  'electrical-equipment': Gamepad2,
}

interface CategoryWithCount {
  id: number
  name: string
  slug: string
  description?: string
  icon_name?: string
  tool_count: number
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithCount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  useEffect(() => {
    fetchCategories()
  }, [])

  const fetchCategories = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch real categories from the backend
      const data = await apiClient.getToolCategories()
      
      setCategories(data)
    } catch (err) {
      console.error('Error fetching categories:', err)
      setError('Kategorien konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const filteredCategories = categories.filter(category =>
    category.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    category.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const totalTools = categories.reduce((sum, cat) => sum + cat.tool_count, 0)
  const popularCategories = [...categories]
    .sort((a, b) => b.tool_count - a.tool_count)
    .slice(0, 6)

  const CategoryCard = ({ category }: { category: CategoryWithCount }) => {
    const IconComponent = categoryIcons[category.slug] || Hammer

    return (
      <Card className="group hover:shadow-lg transition-all duration-300 hover:-translate-y-1">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <IconComponent className="w-6 h-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">{category.name}</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {category.tool_count} Werkzeuge
                </Badge>
              </div>
            </div>
            <ArrowRight className="w-5 h-5 text-gray-400 group-hover:text-primary transition-colors" />
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 text-sm leading-relaxed mb-4">
            {category.description}
          </p>
          <Button asChild variant="outline" className="w-full group-hover:bg-primary group-hover:text-white transition-colors">
            <Link href={`/tools?category=${category.slug}`}>
              Werkzeuge anzeigen
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold mb-4">Kategorien durchsuchen</h1>
          <p className="text-xl text-gray-600 mb-6">
            Finden Sie das passende Werkzeug in {categories.length} Kategorien
          </p>
          
          {/* Search */}
          <div className="max-w-md mx-auto relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <Input
              type="text"
              placeholder="Kategorien durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 py-3 text-lg"
            />
          </div>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary mb-2">{categories.length}</div>
              <p className="text-gray-600">Verfügbare Kategorien</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary mb-2">{totalTools}</div>
              <p className="text-gray-600">Werkzeuge insgesamt</p>
            </CardContent>
          </Card>
          
          <Card className="text-center">
            <CardContent className="pt-6">
              <div className="text-3xl font-bold text-primary mb-2">
                {categories.length > 0 ? Math.round(totalTools / categories.length) : 0}
              </div>
              <p className="text-gray-600">⌀ Werkzeuge pro Kategorie</p>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(9)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-48 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <div className="text-red-600 mb-4">
              <p className="text-lg">{error}</p>
            </div>
            <Button onClick={fetchCategories}>
              Erneut versuchen
            </Button>
          </div>
        ) : filteredCategories.length === 0 ? (
          <div className="text-center py-12">
            <Search className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">Keine Kategorien gefunden</h3>
            <p className="text-gray-600">
              Keine Kategorien entsprechen Ihrer Suche nach "{searchQuery}"
            </p>
          </div>
        ) : (
          <>
            {/* Popular Categories (if not searching) */}
            {!searchQuery && (
              <div className="mb-12">
                <h2 className="text-2xl font-bold mb-6">Beliebteste Kategorien</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {popularCategories.map((category) => (
                    <CategoryCard key={category.id} category={category} />
                  ))}
                </div>
              </div>
            )}

            {/* All Categories */}
            <div>
              <h2 className="text-2xl font-bold mb-6">
                {searchQuery ? `Suchergebnisse (${filteredCategories.length})` : 'Alle Kategorien'}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredCategories.map((category) => (
                  <CategoryCard key={category.id} category={category} />
                ))}
              </div>
            </div>
          </>
        )}

        {/* Call to Action */}
        {!searchQuery && (
          <div className="mt-16 text-center bg-gradient-to-r from-primary/10 to-primary/5 rounded-lg p-8">
            <h3 className="text-2xl font-bold mb-4">Nicht das Richtige gefunden?</h3>
            <p className="text-gray-600 mb-6 max-w-2xl mx-auto">
              Stöbern Sie durch alle verfügbaren Werkzeuge oder verwenden Sie unsere erweiterte Suche 
              mit Filtern für Preis, Standort und Verfügbarkeit.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button asChild size="lg">
                <Link href="/tools">
                  Alle Werkzeuge durchsuchen
                </Link>
              </Button>
              <Button variant="outline" size="lg" asChild>
                <Link href="/tools/new">
                  Werkzeug hinzufügen
                </Link>
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}