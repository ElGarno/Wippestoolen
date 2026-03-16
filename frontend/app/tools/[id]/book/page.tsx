'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { format, addDays, differenceInDays } from 'date-fns'
import { de } from 'date-fns/locale'
import { CalendarDays, ArrowLeft, DollarSign, MapPin, Truck, Info, CheckCircle } from 'lucide-react'
import { Tool } from '@/types'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Alert } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const bookingFormSchema = z.object({
  start_date: z.string().min(1, 'Startdatum ist erforderlich'),
  end_date: z.string().min(1, 'Enddatum ist erforderlich'),
  pickup_method: z.enum(['pickup', 'delivery'], {
    message: 'Bitte wählen Sie eine Abholmethode'
  }),
  delivery_address: z.string().optional(),
  notes: z.string().optional(),
}).refine((data) => {
  if (data.pickup_method === 'delivery' && !data.delivery_address) {
    return false
  }
  return true
}, {
  message: 'Lieferadresse ist erforderlich bei Lieferung',
  path: ['delivery_address']
}).refine((data) => {
  const start = new Date(data.start_date)
  const end = new Date(data.end_date)
  return start <= end
}, {
  message: 'Enddatum muss nach Startdatum liegen',
  path: ['end_date']
})

type BookingFormData = z.infer<typeof bookingFormSchema>

export default function BookToolPage() {
  const { user, isAuthenticated } = useAuth()
  const params = useParams()
  const router = useRouter()
  const toolId = params?.id as string
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [availability, setAvailability] = useState<{ available: boolean } | null>(null)
  const [checkingAvailability, setCheckingAvailability] = useState(false)

  const form = useForm<BookingFormData>({
    resolver: zodResolver(bookingFormSchema),
    defaultValues: {
      start_date: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
      end_date: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
      pickup_method: 'pickup',
      delivery_address: '',
      notes: '',
    }
  })

  const watchedDates = form.watch(['start_date', 'end_date'])

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

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
  }, [isAuthenticated, toolId, router])

  // Check availability when dates change
  useEffect(() => {
    const checkAvailability = async () => {
      if (!watchedDates[0] || !watchedDates[1] || !toolId) return

      try {
        setCheckingAvailability(true)
        const result = await apiClient.checkAvailability(toolId, watchedDates[0], watchedDates[1])
        setAvailability(result)
      } catch (err) {
        console.error('Error checking availability:', err)
        setAvailability({ available: false })
      } finally {
        setCheckingAvailability(false)
      }
    }

    const timeoutId = setTimeout(() => {
      checkAvailability()
    }, 500) // Debounce API calls

    return () => clearTimeout(timeoutId)
  }, [watchedDates, toolId])

  const calculateCosts = () => {
    if (!tool || !watchedDates[0] || !watchedDates[1]) return null

    const startDate = new Date(watchedDates[0])
    const endDate = new Date(watchedDates[1])
    const days = differenceInDays(endDate, startDate) + 1 // Include both start and end day

    const dailyRate = typeof tool.daily_rate === 'string' 
      ? parseFloat(tool.daily_rate) 
      : tool.daily_rate

    const subtotal = dailyRate * days
    const depositAmount = tool.deposit_amount 
      ? (typeof tool.deposit_amount === 'string' ? parseFloat(tool.deposit_amount) : tool.deposit_amount)
      : 0

    return {
      days,
      dailyRate,
      subtotal,
      depositAmount,
      total: subtotal + depositAmount
    }
  }

  const onSubmit = async (data: BookingFormData) => {
    if (!tool || !availability?.available) return

    try {
      setBooking(true)
      setError(null)

      await apiClient.createBooking({
        tool_id: toolId,
        start_date: data.start_date,
        end_date: data.end_date,
        pickup_method: data.pickup_method,
        delivery_address: data.pickup_method === 'delivery' ? data.delivery_address : undefined,
        notes: data.notes || undefined,
      })

      setSuccess(true)
      
      // Redirect after showing success
      setTimeout(() => {
        router.push('/bookings')
      }, 3000)
    } catch (err) {
      console.error('Error creating booking:', err)
      setError('Buchung konnte nicht erstellt werden. Bitte versuchen Sie es erneut.')
    } finally {
      setBooking(false)
    }
  }

  const formatPrice = (price: string | number) => {
    const numericPrice = typeof price === 'string' ? parseFloat(price) : price
    return new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR',
    }).format(numericPrice)
  }

  if (!isAuthenticated) {
    return <div>Weiterleitung...</div>
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-4">
                <div className="h-64 bg-gray-200 rounded"></div>
              </div>
              <div className="space-y-4">
                <div className="h-32 bg-gray-200 rounded"></div>
                <div className="h-48 bg-gray-200 rounded"></div>
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
        <div className="max-w-4xl mx-auto">
          <Alert className="mb-6 border-red-200 bg-red-50">
            <Info className="h-4 w-4" />
            <div>
              <h4 className="font-semibold text-red-800">Fehler</h4>
              <p className="text-red-700">{error || 'Werkzeug nicht gefunden'}</p>
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

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8">
            <CheckCircle className="w-16 h-16 text-green-600 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-green-800 mb-2">
              Buchungsanfrage gesendet!
            </h1>
            <p className="text-green-700 mb-4">
              Ihre Anfrage wurde an {tool.owner.display_name} gesendet. Sie werden per E-Mail benachrichtigt, 
              sobald die Buchung bestätigt oder abgelehnt wurde.
            </p>
            <div className="text-sm text-green-600">
              Weiterleitung zu Ihren Buchungen...
            </div>
          </div>
        </div>
      </div>
    )
  }

  const costs = calculateCosts()

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button onClick={() => router.back()} variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <h1 className="text-3xl font-bold">Werkzeug buchen</h1>
          <p className="text-gray-600 mt-2">
            {tool.title}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Booking Form */}
          <div className="space-y-6">
            {error && (
              <Alert className="border-red-200 bg-red-50">
                <Info className="h-4 w-4" />
                <div>
                  <h4 className="font-semibold text-red-800">Fehler</h4>
                  <p className="text-red-700">{error}</p>
                </div>
              </Alert>
            )}

            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Date Selection */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <CalendarDays className="w-5 h-5" />
                      <span>Leihdauer</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="start_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Startdatum *</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                min={format(new Date(), 'yyyy-MM-dd')}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="end_date"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Enddatum *</FormLabel>
                            <FormControl>
                              <Input 
                                type="date" 
                                min={form.getValues('start_date') || format(new Date(), 'yyyy-MM-dd')}
                                {...field} 
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {/* Availability Check */}
                    {checkingAvailability && (
                      <div className="text-sm text-gray-600">
                        Verfügbarkeit wird geprüft...
                      </div>
                    )}
                    
                    {availability !== null && !checkingAvailability && (
                      <div className={`p-3 rounded-lg ${
                        availability.available 
                          ? 'bg-green-50 border border-green-200' 
                          : 'bg-red-50 border border-red-200'
                      }`}>
                        <div className={`flex items-center space-x-2 ${
                          availability.available ? 'text-green-800' : 'text-red-800'
                        }`}>
                          <div className={`w-3 h-3 rounded-full ${
                            availability.available ? 'bg-green-500' : 'bg-red-500'
                          }`} />
                          <span className="font-medium">
                            {availability.available 
                              ? 'Verfügbar für den gewählten Zeitraum' 
                              : 'Nicht verfügbar für den gewählten Zeitraum'
                            }
                          </span>
                        </div>
                      </div>
                    )}

                    {costs && (
                      <div className="text-sm text-gray-600">
                        Leihdauer: {costs.days} Tag{costs.days !== 1 ? 'e' : ''}
                      </div>
                    )}

                    {tool.max_loan_days && costs && costs.days > tool.max_loan_days && (
                      <Alert className="border-orange-200 bg-orange-50">
                        <Info className="h-4 w-4" />
                        <div>
                          <p className="text-orange-800">
                            Die maximale Leihdauer für dieses Werkzeug beträgt {tool.max_loan_days} Tage.
                          </p>
                        </div>
                      </Alert>
                    )}
                  </CardContent>
                </Card>

                {/* Pickup Method */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center space-x-2">
                      <MapPin className="w-5 h-5" />
                      <span>Abholung & Lieferung</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <FormField
                      control={form.control}
                      name="pickup_method"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Abholmethode *</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Wählen Sie eine Option" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="pickup">
                                <div className="flex items-center space-x-2">
                                  <MapPin className="w-4 h-4" />
                                  <span>Selbstabholung in {tool.pickup_city}</span>
                                </div>
                              </SelectItem>
                              {tool.delivery_available && (
                                <SelectItem value="delivery">
                                  <div className="flex items-center space-x-2">
                                    <Truck className="w-4 h-4" />
                                    <span>Lieferung</span>
                                  </div>
                                </SelectItem>
                              )}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {form.watch('pickup_method') === 'pickup' && (
                      <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-sm text-blue-800">
                          <strong>Abholadresse:</strong><br />
                          {tool.pickup_address 
                            ? `${tool.pickup_address}, ${tool.pickup_city} ${tool.pickup_postal_code}`
                            : `${tool.pickup_city} ${tool.pickup_postal_code}`
                          }
                        </p>
                      </div>
                    )}

                    {form.watch('pickup_method') === 'delivery' && (
                      <FormField
                        control={form.control}
                        name="delivery_address"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Lieferadresse *</FormLabel>
                            <FormControl>
                              <textarea
                                className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                                placeholder="Vollständige Lieferadresse..."
                                {...field}
                              />
                            </FormControl>
                            <FormDescription>
                              {tool.delivery_radius_km && 
                                `Lieferung möglich im Umkreis von ${tool.delivery_radius_km} km`
                              }
                            </FormDescription>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* Additional Notes */}
                <Card>
                  <CardHeader>
                    <CardTitle>Zusätzliche Hinweise</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <FormField
                      control={form.control}
                      name="notes"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nachricht an den Vermieter</FormLabel>
                          <FormControl>
                            <textarea
                              className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                              placeholder="Optional: Spezielle Anfragen oder Hinweise..."
                              {...field}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                </Card>

                {/* Submit Button */}
                <Button 
                  type="submit" 
                  size="lg" 
                  className="w-full" 
                  disabled={booking || !availability?.available || checkingAvailability}
                >
                  {booking ? 'Sende Anfrage...' : 'Buchungsanfrage senden'}
                </Button>
              </form>
            </Form>
          </div>

          {/* Summary Sidebar */}
          <div className="space-y-6">
            {/* Tool Summary */}
            <Card>
              <CardHeader>
                <CardTitle>Buchungsübersicht</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h4 className="font-semibold">{tool.title}</h4>
                  <p className="text-sm text-gray-600">{tool.category.name}</p>
                  <Badge variant={tool.is_available ? 'default' : 'secondary'} className="mt-2">
                    {tool.is_available ? 'Verfügbar' : 'Nicht verfügbar'}
                  </Badge>
                </div>

                <Separator />

                <div>
                  <h5 className="font-medium mb-2">Vermieter</h5>
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center">
                      {tool.owner.display_name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{tool.owner.display_name}</p>
                      {tool.owner.average_rating && (
                        <p className="text-xs text-gray-600">
                          ⭐ {tool.owner.average_rating.toFixed(1)} ({tool.owner.total_ratings})
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cost Breakdown */}
            {costs && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <DollarSign className="w-5 h-5" />
                    <span>Kostenübersicht</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between">
                    <span>Tagesrate × {costs.days} Tag{costs.days !== 1 ? 'e' : ''}</span>
                    <span>{formatPrice(costs.subtotal)}</span>
                  </div>
                  
                  {costs.depositAmount > 0 && (
                    <div className="flex justify-between">
                      <span>Kaution</span>
                      <span>{formatPrice(costs.depositAmount)}</span>
                    </div>
                  )}

                  <Separator />
                  
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Gesamt</span>
                    <span>{formatPrice(costs.total)}</span>
                  </div>

                  {costs.depositAmount > 0 && (
                    <p className="text-xs text-gray-600">
                      Die Kaution wird nach ordnungsgemäßer Rückgabe zurückerstattet
                    </p>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Important Notes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Info className="w-5 h-5" />
                  <span>Wichtige Hinweise</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-gray-600">
                <p>• Dies ist eine unverbindliche Anfrage</p>
                <p>• Der Vermieter kann die Anfrage annehmen oder ablehnen</p>
                <p>• Die Zahlung erfolgt erst nach Bestätigung der Buchung</p>
                {tool.usage_instructions && (
                  <div>
                    <p className="font-medium text-gray-800 mt-3">Nutzungshinweise:</p>
                    <p>{tool.usage_instructions}</p>
                  </div>
                )}
                {tool.safety_notes && (
                  <div>
                    <p className="font-medium text-gray-800 mt-3">Sicherheitshinweise:</p>
                    <p>{tool.safety_notes}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}