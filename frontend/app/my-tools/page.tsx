'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, Edit, Trash2, Eye, MoreHorizontal, Search, Calendar, DollarSign } from 'lucide-react'
import { Tool, PaginatedResponse } from '@/types'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { ToolCard } from '@/components/tools/tool-card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export default function MyToolsPage() {
  const { user, isAuthenticated } = useAuth()
  const router = useRouter()
  
  const [tools, setTools] = useState<Tool[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalTools, setTotalTools] = useState(0)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    fetchMyTools()
  }, [isAuthenticated, currentPage, router])

  const fetchMyTools = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiClient.getMyTools({
        skip: (currentPage - 1) * 12,
        limit: 12
      })
      
      setTools(response.items)
      setTotalPages(response.pages)
      setTotalTools(response.total)
    } catch (err) {
      console.error('Error fetching tools:', err)
      setError('Werkzeuge konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteTool = async (toolId: string) => {
    if (!confirm('Möchten Sie dieses Werkzeug wirklich löschen?')) {
      return
    }

    try {
      await apiClient.deleteTool(toolId)
      await fetchMyTools() // Refresh the list
    } catch (err) {
      console.error('Error deleting tool:', err)
      setError('Werkzeug konnte nicht gelöscht werden')
    }
  }

  const formatPrice = (price: string | number) => {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(numericPrice)
  }

  const filteredTools = tools.filter(tool =>
    tool.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    tool.category.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const availableTools = filteredTools.filter(tool => tool.is_available)
  const unavailableTools = filteredTools.filter(tool => !tool.is_available)

  if (!isAuthenticated) {
    return <div>Weiterleitung...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">Meine Werkzeuge</h1>
            <p className="text-gray-600 mt-2">
              Verwalten Sie Ihre {totalTools} Werkzeuge
            </p>
          </div>
          <Button asChild className="mt-4 md:mt-0">
            <Link href="/tools/new">
              <Plus className="w-4 h-4 mr-2" />
              Neues Werkzeug hinzufügen
            </Link>
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Gesamt Werkzeuge
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalTools}</div>
              <p className="text-xs text-muted-foreground">
                {availableTools.length} verfügbar, {unavailableTools.length} nicht verfügbar
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Durchschn. Tagesrate
              </CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {tools.length > 0 ? formatPrice(
                  tools.reduce((sum, tool) => {
                    const rate = typeof tool.daily_rate === 'string' ? parseFloat(tool.daily_rate) : tool.daily_rate
                    return sum + rate
                  }, 0) / tools.length
                ) : '€0,00'}
              </div>
              <p className="text-xs text-muted-foreground">
                Basierend auf allen Werkzeugen
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Durchschn. Bewertung
              </CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {user?.average_rating ? user.average_rating.toFixed(1) : '—'}
              </div>
              <p className="text-xs text-muted-foreground">
                Aus {user?.total_ratings || 0} Bewertungen
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Werkzeuge durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {error && (
          <Alert className="mb-6">
            <div>
              <h4 className="font-semibold">Fehler</h4>
              <p>{error}</p>
            </div>
          </Alert>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-[4/3] bg-gray-200 rounded-lg mb-4"></div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                  <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                </div>
              </div>
            ))}
          </div>
        ) : filteredTools.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              {tools.length === 0 ? (
                <>
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Noch keine Werkzeuge</h3>
                  <p className="text-gray-600 mb-6">
                    Fügen Sie Ihr erstes Werkzeug hinzu und beginnen Sie zu verdienen.
                  </p>
                  <Button asChild>
                    <Link href="/tools/new">
                      <Plus className="w-4 h-4 mr-2" />
                      Erstes Werkzeug hinzufügen
                    </Link>
                  </Button>
                </>
              ) : (
                <>
                  <Search className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Keine Ergebnisse</h3>
                  <p className="text-gray-600">
                    Keine Werkzeuge gefunden für "{searchQuery}"
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">
                Alle ({filteredTools.length})
              </TabsTrigger>
              <TabsTrigger value="available">
                Verfügbar ({availableTools.length})
              </TabsTrigger>
              <TabsTrigger value="unavailable">
                Nicht verfügbar ({unavailableTools.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {filteredTools.map((tool) => (
                  <div key={tool.id} className="relative group">
                    <ToolCard tool={tool} />
                    
                    {/* Management Overlay */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/tools/${tool.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Anzeigen
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/tools/${tool.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteTool(tool.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Quick Status Badge */}
                    <div className="absolute bottom-2 right-2">
                      <Badge 
                        variant={tool.is_available ? 'default' : 'secondary'}
                        className="text-xs"
                      >
                        {tool.is_available ? 'Aktiv' : 'Inaktiv'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="available" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {availableTools.map((tool) => (
                  <div key={tool.id} className="relative group">
                    <ToolCard tool={tool} />
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/tools/${tool.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Anzeigen
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/tools/${tool.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteTool(tool.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            <TabsContent value="unavailable" className="mt-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {unavailableTools.map((tool) => (
                  <div key={tool.id} className="relative group">
                    <ToolCard tool={tool} />
                    
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="secondary" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/tools/${tool.id}`}>
                              <Eye className="h-4 w-4 mr-2" />
                              Anzeigen
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem asChild>
                            <Link href={`/tools/${tool.id}/edit`}>
                              <Edit className="h-4 w-4 mr-2" />
                              Bearbeiten
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            onClick={() => handleDeleteTool(tool.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Löschen
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          </Tabs>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
              >
                Vorherige
              </Button>
              <span className="text-sm text-gray-600">
                Seite {currentPage} von {totalPages}
              </span>
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages}
              >
                Nächste
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}