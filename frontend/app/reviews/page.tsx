'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { Star, Clock, CheckCircle, AlertCircle, Calendar } from 'lucide-react'
import { Review } from '@/types'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ReviewForm } from '@/components/reviews/review-form'
import { ReviewList } from '@/components/reviews/review-list'

interface PendingReview {
  booking_id: string
  tool_title: string
  other_party_name: string
  review_type: 'tool_review' | 'borrower_review'
  booking_end_date: string
  days_remaining: number
}

export default function ReviewsPage() {
  const { isAuthenticated, user } = useAuth()
  const router = useRouter()
  
  const [pendingReviews, setPendingReviews] = useState<PendingReview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeReviewForm, setActiveReviewForm] = useState<string | null>(null)

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    fetchPendingReviews()
  }, [isAuthenticated, router])

  const fetchPendingReviews = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // In a real implementation, this would fetch pending reviews from the API
      // For now, we'll use placeholder data
      const mockPendingReviews: PendingReview[] = [
        {
          booking_id: '1',
          tool_title: 'Bosch Professional Schlagbohrmaschine',
          other_party_name: 'Max Mustermann',
          review_type: 'tool_review',
          booking_end_date: '2024-08-20',
          days_remaining: 5
        },
        {
          booking_id: '2',
          tool_title: 'Makita Akkuschrauber Set',
          other_party_name: 'Anna Schmidt',
          review_type: 'borrower_review',
          booking_end_date: '2024-08-18',
          days_remaining: 7
        },
      ]

      setPendingReviews(mockPendingReviews)
    } catch (err) {
      console.error('Error fetching pending reviews:', err)
      setError('Ausstehende Bewertungen konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd. MMMM yyyy', { locale: de })
  }

  const handleReviewSuccess = () => {
    setActiveReviewForm(null)
    fetchPendingReviews() // Refresh pending reviews
  }

  const getReviewTypeLabel = (type: string) => {
    return type === 'tool_review' ? 'Werkzeug bewerten' : 'Mieter bewerten'
  }

  const getReviewDescription = (type: string, otherParty: string) => {
    return type === 'tool_review'
      ? `Bewerten Sie das Werkzeug von ${otherParty}`
      : `Bewerten Sie ${otherParty} als Mieter`
  }

  if (!isAuthenticated) {
    return <div>Weiterleitung...</div>
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Bewertungen</h1>
          <p className="text-gray-600 mt-2">
            Verwalten Sie Ihre ausstehenden Bewertungen und sehen Sie erhaltene Bewertungen ein
          </p>
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Ausstehende Bewertungen</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pendingReviews.length}</div>
              <p className="text-xs text-muted-foreground">
                Bewertungen ausstehend
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Durchschnittsbewertung</CardTitle>
              <Star className="h-4 w-4 text-muted-foreground" />
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

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Gesamt Bewertungen</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{user?.total_ratings || 0}</div>
              <p className="text-xs text-muted-foreground">
                Erhaltene Bewertungen
              </p>
            </CardContent>
          </Card>
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

        <Tabs defaultValue="pending" className="w-full">
          <TabsList>
            <TabsTrigger value="pending">
              Ausstehend ({pendingReviews.length})
            </TabsTrigger>
            <TabsTrigger value="received">
              Erhalten
            </TabsTrigger>
            <TabsTrigger value="given">
              Gegeben
            </TabsTrigger>
          </TabsList>

          <TabsContent value="pending" className="mt-6">
            {loading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-32 bg-gray-200 rounded-lg"></div>
                  </div>
                ))}
              </div>
            ) : pendingReviews.length === 0 ? (
              <Card className="text-center py-12">
                <CardContent>
                  <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Alle Bewertungen erledigt!</h3>
                  <p className="text-gray-600">
                    Sie haben derzeit keine ausstehenden Bewertungen.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-6">
                {pendingReviews.map((pendingReview) => (
                  <Card key={pendingReview.booking_id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-lg">{pendingReview.tool_title}</CardTitle>
                          <p className="text-gray-600 mt-1">
                            {getReviewDescription(pendingReview.review_type, pendingReview.other_party_name)}
                          </p>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 mt-2">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>Buchung beendet: {formatDate(pendingReview.booking_end_date)}</span>
                            </div>
                            <Badge 
                              variant={pendingReview.days_remaining <= 3 ? 'destructive' : 'secondary'}
                              className="text-xs"
                            >
                              {pendingReview.days_remaining} Tage verbleibend
                            </Badge>
                          </div>
                        </div>
                        
                        <Button
                          onClick={() => setActiveReviewForm(
                            activeReviewForm === pendingReview.booking_id ? null : pendingReview.booking_id
                          )}
                          variant={activeReviewForm === pendingReview.booking_id ? 'secondary' : 'default'}
                        >
                          {activeReviewForm === pendingReview.booking_id ? 'Abbrechen' : 'Jetzt bewerten'}
                        </Button>
                      </div>
                    </CardHeader>

                    {activeReviewForm === pendingReview.booking_id && (
                      <CardContent className="pt-0">
                        <ReviewForm
                          bookingId={pendingReview.booking_id}
                          reviewType={pendingReview.review_type}
                          reviewTitle={getReviewTypeLabel(pendingReview.review_type)}
                          onSuccess={handleReviewSuccess}
                        />
                      </CardContent>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="received" className="mt-6">
            <ReviewList
              userId={user?.id}
              limit={20}
              className="space-y-4"
            />
          </TabsContent>

          <TabsContent value="given" className="mt-6">
            <div className="text-center py-8">
              <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Von Ihnen gegebene Bewertungen</h3>
              <p className="text-gray-600">
                Diese Funktion wird in einem späteren Update verfügbar sein.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}