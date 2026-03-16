'use client'

import { useState, useEffect, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { Search, SlidersHorizontal, Grid3X3, List, Loader2 } from 'lucide-react'
import useSWR from 'swr'

import { apiClient } from '@/lib/api'
import { Tool, ToolCategory, PaginatedResponse } from '@/types'
import { Layout } from '@/components/layout/layout'
import { ToolCard } from '@/components/tools/tool-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Slider } from '@/components/ui/slider'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'

const ITEMS_PER_PAGE = 12
const SORT_OPTIONS = [
  { value: 'newest', label: 'Neueste zuerst' },
  { value: 'price_low', label: 'Preis: Niedrig bis Hoch' },
  { value: 'price_high', label: 'Preis: Hoch bis Niedrig' },
  { value: 'rating', label: 'Beste Bewertung' },
  { value: 'popular', label: 'Beliebteste' },
]

function ToolsPageContent() {
  const searchParams = useSearchParams()
  const [searchTerm, setSearchTerm] = useState(searchParams?.get('search') || '')
  const [selectedCategory, setSelectedCategory] = useState(searchParams?.get('category') || '')
  const [priceRange, setPriceRange] = useState([0, 200])
  const [sortBy, setSortBy] = useState(searchParams?.get('sort') || 'newest')
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showFilters, setShowFilters] = useState(false)
  const [page, setPage] = useState(1)

  // Debounced search term
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState(searchTerm)
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm)
      setPage(1) // Reset to first page on search
    }, 300)

    return () => clearTimeout(handler)
  }, [searchTerm])

  // Fetch tools with current filters
  const toolsQuery = useSWR<PaginatedResponse<Tool>>(
    ['tools', debouncedSearchTerm, selectedCategory, priceRange, sortBy, page],
    () => apiClient.getTools({
      search: debouncedSearchTerm || undefined,
      category: selectedCategory || undefined,
      skip: (page - 1) * ITEMS_PER_PAGE,
      limit: ITEMS_PER_PAGE,
      // Note: Backend would need to support these filters
      sort: sortBy,
      min_price: priceRange[0],
      max_price: priceRange[1],
    } as any),
    {
      keepPreviousData: true,
      revalidateOnFocus: false,
    }
  )

  // Fetch categories
  const categoriesQuery = useSWR<ToolCategory[]>('categories', () => apiClient.getToolCategories())

  const tools = toolsQuery.data?.items || []
  const totalPages = toolsQuery.data ? Math.ceil(toolsQuery.data.total / ITEMS_PER_PAGE) : 0
  const isLoading = toolsQuery.isLoading
  const error = toolsQuery.error

  // Applied filters count
  const appliedFiltersCount = useMemo(() => {
    let count = 0
    if (debouncedSearchTerm) count++
    if (selectedCategory) count++
    if (priceRange[0] > 0 || priceRange[1] < 200) count++
    return count
  }, [debouncedSearchTerm, selectedCategory, priceRange])

  const clearFilters = () => {
    setSearchTerm('')
    setSelectedCategory('')
    setPriceRange([0, 200])
    setSortBy('newest')
    setPage(1)
  }

  const handleCategoryChange = (category: string) => {
    setSelectedCategory(category === 'all' ? '' : category)
    setPage(1)
  }

  const handleSortChange = (sort: string) => {
    setSortBy(sort)
    setPage(1)
  }

  return (
    <Layout>
      <div className="bg-white">
        {/* Header */}
        <div className="border-b">
          <div className="container mx-auto px-4 py-6">
            <div className="flex flex-col space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold">Werkzeuge durchsuchen</h1>
                  <p className="text-gray-600 mt-1">
                    Finden Sie das perfekte Werkzeug für Ihr Projekt
                  </p>
                </div>
                
                {/* View Toggle */}
                <div className="flex items-center space-x-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <Grid3X3 className="w-4 h-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
              </div>

              {/* Search and Filters */}
              <div className="flex flex-col lg:flex-row gap-4">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Nach Werkzeugen suchen..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>

                {/* Quick Filters */}
                <div className="flex flex-wrap gap-2 lg:gap-4">
                  <Select value={selectedCategory} onValueChange={handleCategoryChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Alle Kategorien" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Alle Kategorien</SelectItem>
                      {categoriesQuery.data?.map((category) => (
                        <SelectItem key={category.id} value={category.slug}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={sortBy} onValueChange={handleSortChange}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SORT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button
                    variant="outline"
                    onClick={() => setShowFilters(!showFilters)}
                    className="relative"
                  >
                    <SlidersHorizontal className="w-4 h-4 mr-2" />
                    Filter
                    {appliedFiltersCount > 0 && (
                      <Badge 
                        variant="secondary" 
                        className="ml-2 px-1.5 py-0.5 text-xs min-w-[20px] h-5"
                      >
                        {appliedFiltersCount}
                      </Badge>
                    )}
                  </Button>
                </div>
              </div>

              {/* Advanced Filters Panel */}
              {showFilters && (
                <Card>
                  <CardHeader className="pb-4">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Erweiterte Filter</CardTitle>
                      <Button variant="ghost" size="sm" onClick={clearFilters}>
                        Alle löschen
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Price Range */}
                    <div className="space-y-3">
                      <Label>Tagespreis Bereich</Label>
                      <div className="px-3">
                        <Slider
                          value={priceRange}
                          onValueChange={setPriceRange}
                          max={200}
                          min={0}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex justify-between text-sm text-gray-500 mt-2">
                          <span>${priceRange[0]}</span>
                          <span>${priceRange[1]}+</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Active Filters */}
              {appliedFiltersCount > 0 && (
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm text-gray-600">Aktive Filter:</span>
                  {debouncedSearchTerm && (
                    <Badge variant="secondary" className="gap-2">
                      Suche: {debouncedSearchTerm}
                      <button
                        onClick={() => setSearchTerm('')}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {selectedCategory && (
                    <Badge variant="secondary" className="gap-2">
                      {selectedCategory}
                      <button
                        onClick={() => setSelectedCategory('')}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                  {(priceRange[0] > 0 || priceRange[1] < 200) && (
                    <Badge variant="secondary" className="gap-2">
                      ${priceRange[0]} - ${priceRange[1]}
                      <button
                        onClick={() => setPriceRange([0, 200])}
                        className="text-gray-500 hover:text-gray-700"
                      >
                        ×
                      </button>
                    </Badge>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Results */}
        <div className="container mx-auto px-4 py-8">
          {/* Results Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="text-sm text-gray-600">
              {isLoading ? (
                'Lade...'
              ) : error ? (
                'Fehler beim Laden der Werkzeuge'
              ) : (
                `${tools.length} von ${toolsQuery.data?.total || 0} Werkzeugen angezeigt`
              )}
            </div>
          </div>

          {/* Loading State */}
          {isLoading && (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          )}

          {/* Error State */}
          {error && (
            <Card className="p-8 text-center">
              <CardDescription>
                Werkzeuge konnten nicht geladen werden. Bitte versuchen Sie es später erneut.
              </CardDescription>
            </Card>
          )}

          {/* No Results */}
          {!isLoading && !error && tools.length === 0 && (
            <Card className="p-8 text-center">
              <CardTitle className="mb-2">Keine Werkzeuge gefunden</CardTitle>
              <CardDescription className="mb-4">
                Versuchen Sie, Ihre Suchkriterien oder Filter anzupassen
              </CardDescription>
              <Button onClick={clearFilters}>Filter löschen</Button>
            </Card>
          )}

          {/* Tools Grid */}
          {!isLoading && !error && tools.length > 0 && (
            <>
              <div className={
                viewMode === 'grid' 
                  ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6'
                  : 'space-y-4'
              }>
                {tools.map((tool) => (
                  <ToolCard key={tool.id} tool={tool} />
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center space-x-2 mt-8">
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.max(1, page - 1))}
                    disabled={page <= 1}
                  >
                    Zurück
                  </Button>
                  
                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const pageNum = i + 1
                      return (
                        <Button
                          key={pageNum}
                          variant={page === pageNum ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      )
                    })}
                    
                    {totalPages > 5 && (
                      <>
                        <span className="text-gray-400">...</span>
                        <Button
                          variant={page === totalPages ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setPage(totalPages)}
                        >
                          {totalPages}
                        </Button>
                      </>
                    )}
                  </div>
                  
                  <Button
                    variant="outline"
                    onClick={() => setPage(Math.min(totalPages, page + 1))}
                    disabled={page >= totalPages}
                  >
                    Weiter
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  )
}

export default function ToolsPage() {
  return (
    <Suspense fallback={
      <Layout>
        <div className="container mx-auto py-8 px-4 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </Layout>
    }>
      <ToolsPageContent />
    </Suspense>
  )
}