'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Star, DollarSign, Calendar, User, Phone, Shield, Truck, ArrowLeft, Share2, Heart } from 'lucide-react'
import { Tool } from '@/types'
import { apiClient } from '@/lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert } from '@/components/ui/alert'

export default function ToolDetailPage() {
  const params = useParams()
  const router = useRouter()
  const toolId = params?.id as string
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  useEffect(() => {
    if (!toolId) return

    const fetchTool = async () => {
      try {
        setLoading(true)
        setError(null)
        const response = await apiClient.getTool(toolId)
        setTool(response)
      } catch (err) {
        console.error('Error fetching tool:', err)
        setError('Werkzeug konnte nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }

    fetchTool()
  }, [toolId])

  const handleImageNavigation = (direction: 'prev' | 'next') => {
    if (!tool?.photos || tool.photos.length <= 1) return
    
    if (direction === 'next') {
      setCurrentImageIndex((prev) => (prev + 1) % tool.photos!.length)
    } else {
      setCurrentImageIndex((prev) => (prev - 1 + tool.photos!.length) % tool.photos!.length)
    }
  }

  const formatPrice = (price: string | number) => {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(numericPrice)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('de-DE')
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="aspect-square bg-gray-200 rounded-lg"></div>
              <div className="space-y-4">
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 rounded w-full"></div>
                <div className="h-4 bg-gray-200 rounded w-2/3"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !tool) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-6xl mx-auto">
          <Alert className="mb-6">
            <Shield className="h-4 w-4" />
            <div>
              <h4 className="font-semibold">Fehler</h4>
              <p>{error || 'Werkzeug nicht gefunden'}</p>
            </div>
          </Alert>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
        </div>
      </div>
    )
  }

  const availablePhotos = tool.photos || (tool.primary_photo ? [tool.primary_photo] : [])

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <Button onClick={() => router.back()} variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück zur Übersicht
          </Button>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image Gallery */}
          <div className="space-y-4">
            {/* Main Image */}
            <div className="relative aspect-square overflow-hidden rounded-lg bg-gray-100">
              {availablePhotos.length > 0 ? (
                <Image
                  src={availablePhotos[currentImageIndex].original_url}
                  alt={tool.title}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-200">
                  <User className="w-24 h-24 text-gray-400" />
                </div>
              )}

              {/* Image Navigation */}
              {availablePhotos.length > 1 && (
                <>
                  <button
                    onClick={() => handleImageNavigation('prev')}
                    className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label="Vorheriges Bild"
                  >
                    ←
                  </button>
                  <button
                    onClick={() => handleImageNavigation('next')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-black/50 text-white flex items-center justify-center hover:bg-black/70 transition-colors"
                    aria-label="Nächstes Bild"
                  >
                    →
                  </button>
                </>
              )}

              {/* Status Badges */}
              <div className="absolute top-4 left-4">
                <Badge variant={tool.is_available ? 'default' : 'secondary'}>
                  {tool.is_available ? 'Verfügbar' : 'Nicht verfügbar'}
                </Badge>
              </div>

              <div className="absolute top-4 right-4 flex space-x-2">
                <Button size="sm" variant="secondary" className="w-10 h-10 p-0">
                  <Share2 className="w-4 h-4" />
                </Button>
                <Button size="sm" variant="secondary" className="w-10 h-10 p-0">
                  <Heart className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Thumbnail Gallery */}
            {availablePhotos.length > 1 && (
              <div className="grid grid-cols-4 gap-2">
                {availablePhotos.map((photo, index) => (
                  <button
                    key={photo.id || index}
                    onClick={() => setCurrentImageIndex(index)}
                    className={`relative aspect-square overflow-hidden rounded border-2 transition-colors ${
                      index === currentImageIndex ? 'border-primary' : 'border-gray-200'
                    }`}
                  >
                    <Image
                      src={photo.thumbnail_url || photo.original_url}
                      alt={`${tool.title} - Bild ${index + 1}`}
                      fill
                      className="object-cover"
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Tool Details */}
          <div className="space-y-6">
            {/* Title and Category */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline">{tool.category.name}</Badge>
                {tool.condition && (
                  <Badge variant="secondary">{tool.condition}</Badge>
                )}
              </div>
              <h1 className="text-3xl font-bold mb-2">{tool.title}</h1>
              {tool.description && (
                <p className="text-gray-600">{tool.description}</p>
              )}
            </div>

            {/* Owner Info */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback>
                        {tool.owner.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold">{tool.owner.display_name}</h3>
                      {tool.owner.total_ratings > 0 && tool.owner.average_rating && (
                        <div className="flex items-center space-x-1">
                          <Star className="w-4 h-4 text-yellow-400 fill-current" />
                          <span className="text-sm text-gray-600">
                            {tool.owner.average_rating.toFixed(1)} ({tool.owner.total_ratings})
                          </span>
                        </div>
                      )}
                      {tool.owner.is_verified && (
                        <Badge variant="default" className="text-xs">
                          <Shield className="w-3 h-3 mr-1" />
                          Verifiziert
                        </Badge>
                      )}
                    </div>
                  </div>
                  <Button variant="outline" size="sm">
                    <Phone className="w-4 h-4 mr-2" />
                    Kontakt
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardContent className="pt-6">
                <div className="space-y-4">
                  <div className="flex items-baseline space-x-2">
                    <span className="text-3xl font-bold">{formatPrice(tool.daily_rate)}</span>
                    <span className="text-gray-600">pro Tag</span>
                  </div>
                  
                  {tool.deposit_amount && (typeof tool.deposit_amount === 'string' ? parseFloat(tool.deposit_amount) : tool.deposit_amount) > 0 && (
                    <div className="flex items-center justify-between text-sm text-gray-600">
                      <span>Kaution:</span>
                      <span>{formatPrice(tool.deposit_amount)}</span>
                    </div>
                  )}
                  
                  {tool.delivery_available && (
                    <div className="flex items-center space-x-2 text-sm text-green-600">
                      <Truck className="w-4 h-4" />
                      <span>Lieferung verfügbar</span>
                      {tool.delivery_radius_km && (
                        <span className="text-gray-500">
                          (bis {tool.delivery_radius_km} km)
                        </span>
                      )}
                    </div>
                  )}

                  {tool.pickup_city && (
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4" />
                      <span>Abholung in {tool.pickup_city}</span>
                    </div>
                  )}
                </div>

                <Separator className="my-4" />

                <Button 
                  size="lg" 
                  className="w-full" 
                  disabled={!tool.is_available}
                  asChild
                >
                  <Link href={`/tools/${tool.id}/book`}>
                    <Calendar className="w-4 h-4 mr-2" />
                    {tool.is_available ? 'Jetzt buchen' : 'Nicht verfügbar'}
                  </Link>
                </Button>
              </CardContent>
            </Card>

            {/* Location */}
            {(tool.pickup_city || tool.pickup_address) && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <MapPin className="w-5 h-5" />
                    <span>Standort</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-gray-600">
                    {tool.pickup_address || `${tool.pickup_city}, ${tool.pickup_postal_code || ''}`}
                  </p>
                  {tool.distance_km && (
                    <p className="text-sm text-gray-500 mt-1">
                      Etwa {tool.distance_km.toFixed(1)} km entfernt
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Additional Information */}
        <div className="mt-8">
          <Tabs defaultValue="details" className="w-full">
            <TabsList>
              <TabsTrigger value="details">Details</TabsTrigger>
              <TabsTrigger value="reviews">Bewertungen ({tool.total_ratings})</TabsTrigger>
              <TabsTrigger value="owner">Vermieter</TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Technische Details</h3>
                      {tool.brand && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Marke:</span>
                          <span>{tool.brand}</span>
                        </div>
                      )}
                      {tool.model && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Modell:</span>
                          <span>{tool.model}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-gray-600">Zustand:</span>
                        <span>{tool.condition}</span>
                      </div>
                      {tool.max_loan_days && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Max. Leihdauer:</span>
                          <span>{tool.max_loan_days} Tage</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4">
                      <h3 className="font-semibold text-lg">Wartung & Sicherheit</h3>
                      {tool.last_maintenance_date && (
                        <div className="flex justify-between">
                          <span className="text-gray-600">Letzte Wartung:</span>
                          <span>{formatDate(tool.last_maintenance_date)}</span>
                        </div>
                      )}
                      {tool.safety_notes && (
                        <div>
                          <span className="text-gray-600 block mb-1">Sicherheitshinweise:</span>
                          <p className="text-sm">{tool.safety_notes}</p>
                        </div>
                      )}
                      {tool.usage_instructions && (
                        <div>
                          <span className="text-gray-600 block mb-1">Nutzungshinweise:</span>
                          <p className="text-sm">{tool.usage_instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-gray-500">
                    <Star className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                    <p>Bewertungen werden in einem späteren Update verfügbar sein.</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="owner" className="mt-6">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center space-x-4 mb-6">
                    <Avatar className="w-16 h-16">
                      <AvatarFallback className="text-lg">
                        {tool.owner.display_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="text-xl font-semibold">{tool.owner.display_name}</h3>
                      {tool.owner.total_ratings > 0 && tool.owner.average_rating && (
                        <div className="flex items-center space-x-2 mt-1">
                          <div className="flex items-center">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <Star
                                key={star}
                                className={`w-4 h-4 ${
                                  star <= tool.owner.average_rating!
                                    ? 'text-yellow-400 fill-current'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-sm text-gray-600">
                            {tool.owner.average_rating.toFixed(1)} ({tool.owner.total_ratings} Bewertungen)
                          </span>
                        </div>
                      )}
                      {tool.owner.is_verified && (
                        <Badge variant="default" className="mt-2">
                          <Shield className="w-3 h-3 mr-1" />
                          Verifizierter Vermieter
                        </Badge>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-3 text-sm text-gray-600">
                    <p>Mitglied seit {formatDate(tool.created_at)}</p>
                    {tool.total_bookings && tool.total_bookings > 0 && (
                      <p>{tool.total_bookings} erfolgreiche Vermietungen</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}