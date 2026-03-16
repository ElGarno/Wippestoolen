'use client'

import { useState, useEffect } from 'react'
import { format } from 'date-fns'
import { de } from 'date-fns/locale'
import { User, Flag, ThumbsUp, MessageSquare } from 'lucide-react'
import { Review, PaginatedResponse } from '@/types'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Alert } from '@/components/ui/alert'
import { RatingStars } from './rating-stars'

interface ReviewListProps {
  toolId?: string
  userId?: string
  reviewType?: 'tool_review' | 'borrower_review'
  limit?: number
  showPagination?: boolean
  className?: string
}

export function ReviewList({
  toolId,
  userId,
  reviewType,
  limit = 10,
  showPagination = true,
  className
}: ReviewListProps) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)

  useEffect(() => {
    fetchReviews()
  }, [toolId, userId, reviewType, currentPage])

  const fetchReviews = async () => {
    try {
      setLoading(true)
      setError(null)

      const params = {
        skip: (currentPage - 1) * limit,
        limit,
        ...(toolId && { tool_id: toolId }),
        ...(userId && { user_id: userId }),
      }

      const response = await apiClient.getReviews(params)
      setReviews(response.items)
      setTotalPages(response.pages)
    } catch (err) {
      console.error('Error fetching reviews:', err)
      setError('Bewertungen konnten nicht geladen werden')
    } finally {
      setLoading(false)
    }
  }

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd. MMMM yyyy', { locale: de })
  }

  const getReviewTypeLabel = (type: string) => {
    return type === 'tool_review' ? 'Werkzeug-Bewertung' : 'Mieter-Bewertung'
  }

  if (loading) {
    return (
      <div className={className}>
        <div className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-32 bg-gray-200 rounded-lg"></div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={className}>
        <Alert className="border-red-200 bg-red-50">
          <MessageSquare className="h-4 w-4" />
          <div>
            <h4 className="font-semibold text-red-800">Fehler</h4>
            <p className="text-red-700">{error}</p>
          </div>
        </Alert>
      </div>
    )
  }

  if (reviews.length === 0) {
    return (
      <div className={className}>
        <Card className="text-center py-8">
          <CardContent>
            <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Noch keine Bewertungen</h3>
            <p className="text-gray-600">
              Seien Sie der Erste, der eine Bewertung hinterlässt.
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className={className}>
      <div className="space-y-4">
        {reviews.map((review) => (
          <Card key={review.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <Avatar className="w-10 h-10">
                    <AvatarFallback>
                      {review.reviewer?.display_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">
                      {review.reviewer?.display_name || 'Anonymer Nutzer'}
                    </h4>
                    <div className="flex items-center space-x-2 mt-1">
                      <RatingStars rating={review.rating} size="sm" />
                      <span className="text-sm text-gray-500">
                        {formatDate(review.created_at)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <Badge variant="outline" className="text-xs">
                    {getReviewTypeLabel(review.review_type)}
                  </Badge>
                  {review.is_flagged && (
                    <Badge variant="destructive" className="text-xs">
                      <Flag className="w-3 h-3 mr-1" />
                      Gemeldet
                    </Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <p className="text-gray-700 leading-relaxed">
                {review.comment}
              </p>
              
              {/* Tool or Booking Context */}
              {review.booking?.tool && (
                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm font-medium text-gray-700">Werkzeug:</span>
                    <span className="text-sm text-gray-600">
                      {review.booking.tool.title}
                    </span>
                  </div>
                </div>
              )}

              {/* Review Actions */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-4">
                  <Button variant="ghost" size="sm" className="text-gray-500">
                    <ThumbsUp className="w-4 h-4 mr-1" />
                    Hilfreich (0)
                  </Button>
                </div>
                
                <Button variant="ghost" size="sm" className="text-gray-500">
                  <Flag className="w-4 h-4 mr-1" />
                  Melden
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pagination */}
      {showPagination && totalPages > 1 && (
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
  )
}