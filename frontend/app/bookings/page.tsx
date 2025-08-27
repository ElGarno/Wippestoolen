'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { 
  Calendar, 
  Clock, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  Eye, 
  MessageSquare,
  DollarSign,
  Filter,
  Search
} from 'lucide-react'
import { Booking, PaginatedResponse } from '@/types'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

const statusColors = {
  pending: 'bg-yellow-50 text-yellow-800 border-yellow-200',
  confirmed: 'bg-blue-50 text-blue-800 border-blue-200',
  declined: 'bg-red-50 text-red-800 border-red-200',
  cancelled: 'bg-gray-50 text-gray-800 border-gray-200',
  active: 'bg-green-50 text-green-800 border-green-200',
  overdue: 'bg-red-50 text-red-800 border-red-200',
  completed: 'bg-green-50 text-green-800 border-green-200',
  disputed: 'bg-orange-50 text-orange-800 border-orange-200',
}

const statusLabels = {
  pending: 'Ausstehend',
  confirmed: 'Bestätigt',
  declined: 'Abgelehnt', 
  cancelled: 'Storniert',
  active: 'Aktiv',
  overdue: 'Überfällig',
  completed: 'Abgeschlossen',
  disputed: 'Streitfall',
}

const statusIcons = {
  pending: Clock,
  confirmed: CheckCircle,
  declined: XCircle,
  cancelled: XCircle,
  active: CheckCircle,
  overdue: AlertCircle,
  completed: CheckCircle,
  disputed: AlertCircle,
}

export default function BookingsPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  
  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    fetchBookings()
  }, [isAuthenticated, currentPage, router])

  const fetchBookings = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const response = await apiClient.getBookings({
        skip: (currentPage - 1) * 20,
        limit: 20
      })
      
      // Ensure we always have an array
      setBookings(response.items || [])
      setTotalPages(Math.ceil(response.total / 20) || 1)
    } catch (err) {
      console.error('Error fetching bookings:', err)
      setError('Buchungen konnten nicht geladen werden')
      // Ensure bookings is still an array on error
      setBookings([])
    } finally {
      setLoading(false)
    }
  }

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await apiClient.updateBookingStatus(bookingId, status)
      await fetchBookings() // Refresh the list
    } catch (err) {
      console.error('Error updating booking status:', err)
      setError('Status konnte nicht aktualisiert werden')
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(price)
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd.MM.yyyy', { locale: de })
  }

  const filteredBookings = bookings.filter(booking => {
    const matchesSearch = booking.tool?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         booking.borrower?.display_name.toLowerCase().includes(searchQuery.toLowerCase())
    
    const matchesStatus = statusFilter === 'all' || booking.status === statusFilter

    return matchesSearch && matchesStatus
  })

  // Note: For now we'll show all bookings in both tabs since we don't have user context
  // In a real implementation, we'd filter by actual user ID from auth context
  const borrowedBookings = filteredBookings
  const lentBookings = filteredBookings

  if (!isAuthenticated) {
    return <div>Weiterleitung...</div>
  }

  const BookingCard = ({ booking }: { booking: Booking }) => {
    const StatusIcon = statusIcons[booking.status as keyof typeof statusIcons]
    
    return (
      <Card className="hover:shadow-md transition-shadow">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h3 className="font-semibold text-lg mb-2">{booking.tool?.title}</h3>
              <div className="flex items-center space-x-4 text-sm text-gray-600">
                <div className="flex items-center space-x-1">
                  <Calendar className="w-4 h-4" />
                  <span>{formatDate(booking.start_date)} - {formatDate(booking.end_date)}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <DollarSign className="w-4 h-4" />
                  <span>{formatPrice(booking.total_cost)}</span>
                </div>
              </div>
            </div>
            
            <div className={`px-3 py-1 rounded-full text-xs font-medium border ${statusColors[booking.status as keyof typeof statusColors]}`}>
              <div className="flex items-center space-x-1">
                <StatusIcon className="w-3 h-3" />
                <span>{statusLabels[booking.status as keyof typeof statusLabels]}</span>
              </div>
            </div>
          </div>

          <div className="space-y-2 mb-4">
            {booking.borrower && (
              <div className="text-sm">
                <span className="text-gray-600">Mieter:</span> {booking.borrower.display_name}
              </div>
            )}
            
            <div className="text-sm">
              <span className="text-gray-600">Abholung:</span> {booking.pickup_method === 'delivery' ? 'Lieferung' : 'Selbstabholung'}
            </div>
            
            {booking.notes && (
              <div className="text-sm">
                <span className="text-gray-600">Notizen:</span> {booking.notes}
              </div>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              {booking.status === 'pending' && (
                <>
                  <Button 
                    size="sm" 
                    onClick={() => updateBookingStatus(booking.id, 'confirmed')}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    Bestätigen
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => updateBookingStatus(booking.id, 'declined')}
                  >
                    Ablehnen
                  </Button>
                </>
              )}
              
              {booking.status === 'confirmed' && (
                <Button 
                  size="sm" 
                  onClick={() => updateBookingStatus(booking.id, 'active')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  Als aktiv markieren
                </Button>
              )}
              
              {booking.status === 'active' && (
                <Button 
                  size="sm" 
                  onClick={() => updateBookingStatus(booking.id, 'completed')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Abschließen
                </Button>
              )}
            </div>

            <div className="flex items-center space-x-2">
              <Button size="sm" variant="outline" asChild>
                <Link href={`/bookings/${booking.id}`}>
                  <Eye className="w-4 h-4 mr-1" />
                  Details
                </Link>
              </Button>
              <Button size="sm" variant="outline">
                <MessageSquare className="w-4 h-4 mr-1" />
                Nachricht
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Meine Buchungen</h1>
          <p className="text-gray-600 mt-2">
            Verwalten Sie Ihre Leihgeschäfte und Vermietungen
          </p>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamt Buchungen</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{bookings.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ausstehende Anfragen</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bookings.filter(b => b.status === 'pending').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Aktive Buchungen</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bookings.filter(b => b.status === 'active').length}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Abgeschlossen</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {bookings.filter(b => b.status === 'completed').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              type="text"
              placeholder="Werkzeuge oder Personen durchsuchen..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <Filter className="w-4 h-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Alle Status</SelectItem>
              <SelectItem value="pending">Ausstehend</SelectItem>
              <SelectItem value="confirmed">Bestätigt</SelectItem>
              <SelectItem value="active">Aktiv</SelectItem>
              <SelectItem value="completed">Abgeschlossen</SelectItem>
              <SelectItem value="declined">Abgelehnt</SelectItem>
              <SelectItem value="cancelled">Storniert</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <AlertCircle className="h-4 w-4" />
            <div>
              <h4 className="font-semibold text-red-800">Fehler</h4>
              <p className="text-red-700">{error}</p>
            </div>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="h-32 bg-gray-200 rounded-lg"></div>
              </div>
            ))}
          </div>
        ) : filteredBookings.length === 0 ? (
          <Card className="text-center py-12">
            <CardContent>
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">
                {bookings.length === 0 ? 'Noch keine Buchungen' : 'Keine Ergebnisse'}
              </h3>
              <p className="text-gray-600 mb-6">
                {bookings.length === 0 
                  ? 'Sie haben noch keine Buchungen erstellt oder erhalten.'
                  : `Keine Buchungen gefunden für "${searchQuery}"`
                }
              </p>
              {bookings.length === 0 && (
                <Button asChild>
                  <Link href="/tools">
                    Werkzeuge durchsuchen
                  </Link>
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="all" className="w-full">
            <TabsList>
              <TabsTrigger value="all">
                Alle ({filteredBookings.length})
              </TabsTrigger>
              <TabsTrigger value="borrowed">
                Geliehen ({borrowedBookings.length})
              </TabsTrigger>
              <TabsTrigger value="lent">
                Vermietet ({lentBookings.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-6">
              <div className="space-y-4">
                {filteredBookings.map((booking) => (
                  <BookingCard key={booking.id} booking={booking} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="borrowed" className="mt-6">
              <div className="space-y-4">
                {borrowedBookings.length > 0 ? (
                  borrowedBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <Card className="text-center py-8">
                    <CardContent>
                      <p className="text-gray-600">Sie haben noch keine Werkzeuge geliehen.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="lent" className="mt-6">
              <div className="space-y-4">
                {lentBookings.length > 0 ? (
                  lentBookings.map((booking) => (
                    <BookingCard key={booking.id} booking={booking} />
                  ))
                ) : (
                  <Card className="text-center py-8">
                    <CardContent>
                      <p className="text-gray-600">Sie haben noch keine Werkzeuge vermietet.</p>
                    </CardContent>
                  </Card>
                )}
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