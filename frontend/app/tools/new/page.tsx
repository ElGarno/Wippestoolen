'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Upload, X, DollarSign, MapPin, Shield, Info } from 'lucide-react'
import { ToolCategory } from '@/types'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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

// Mapping between German display values and English API values
const conditionMapping = {
  'excellent': 'Ausgezeichnet',
  'good': 'Gut', 
  'fair': 'Akzeptabel',
  'poor': 'Schlecht'
}

const toolFormSchema = z.object({
  title: z.string().min(3, 'Titel muss mindestens 3 Zeichen lang sein'),
  description: z.string().min(10, 'Beschreibung muss mindestens 10 Zeichen lang sein').optional(),
  category_id: z.string().min(1, 'Bitte wählen Sie eine Kategorie'),
  condition: z.enum(['excellent', 'good', 'fair', 'poor']),
  daily_rate: z.string().min(1, 'Tagesrate ist erforderlich'),
  deposit_amount: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  pickup_city: z.string().min(2, 'Stadt ist erforderlich'),
  pickup_postal_code: z.string().min(4, 'Postleitzahl ist erforderlich'),
  pickup_address: z.string().optional(),
  delivery_available: z.boolean(),
  delivery_radius_km: z.string().optional(),
  max_loan_days: z.string().optional(),
  usage_instructions: z.string().optional(),
  safety_notes: z.string().optional(),
})

type ToolFormData = z.infer<typeof toolFormSchema>

export default function NewToolPage() {
  const { isAuthenticated } = useAuth()
  const router = useRouter()
  
  const [categories, setCategories] = useState<ToolCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<ToolFormData>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category_id: '',
      condition: 'good',
      daily_rate: '',
      deposit_amount: '',
      brand: '',
      model: '',
      pickup_city: '',
      pickup_postal_code: '',
      pickup_address: '',
      delivery_available: false,
      delivery_radius_km: '',
      max_loan_days: '',
      usage_instructions: '',
      safety_notes: '',
    }
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    // Fetch categories from the API
    const fetchCategories = async () => {
      try {
        const categories = await apiClient.getToolCategories()
        // Use hardcoded categories if API returns empty array
        if (categories.length === 0) {
          setCategories([
            { id: 1, name: 'Elektrowerkzeuge', slug: 'power-tools', description: 'Bohrmaschinen, Sägen, etc.' },
            { id: 2, name: 'Handwerkzeuge', slug: 'hand-tools', description: 'Schraubendreher, Hammer, etc.' },
            { id: 3, name: 'Gartenwerkzeuge', slug: 'garden-tools', description: 'Rasenmäher, Spaten, etc.' },
            { id: 4, name: 'Leiter & Gerüste', slug: 'ladders', description: 'Leitern und Gerüstteile' },
            { id: 5, name: 'Reinigungsgeräte', slug: 'cleaning', description: 'Hochdruckreiniger, Staubsauger' },
          ])
        } else {
          setCategories(categories)
        }
      } catch (error) {
        console.error('Failed to fetch categories:', error)
        // Fallback to placeholder data if API fails
        setCategories([
          { id: 1, name: 'Elektrowerkzeuge', slug: 'power-tools', description: 'Bohrmaschinen, Sägen, etc.' },
          { id: 2, name: 'Handwerkzeuge', slug: 'hand-tools', description: 'Schraubendreher, Hammer, etc.' },
          { id: 3, name: 'Gartenwerkzeuge', slug: 'garden-tools', description: 'Rasenmäher, Spaten, etc.' },
          { id: 4, name: 'Leiter & Gerüste', slug: 'ladders', description: 'Leitern und Gerüstteile' },
          { id: 5, name: 'Reinigungsgeräte', slug: 'cleaning', description: 'Hochdruckreiniger, Staubsauger' },
        ])
      }
    }
    
    fetchCategories()
  }, [isAuthenticated, router])

  const onSubmit = async (data: ToolFormData) => {
    try {
      setLoading(true)
      setError(null)

      // Convert form data to API format
      const toolData = {
        title: data.title,
        description: data.description || '',
        category_id: parseInt(data.category_id),
        condition: data.condition,
        daily_rate: parseFloat(data.daily_rate),
        deposit_amount: data.deposit_amount ? parseFloat(data.deposit_amount) : 0,
        brand: data.brand || '',
        model: data.model || '',
        pickup_city: data.pickup_city,
        pickup_postal_code: data.pickup_postal_code,
        pickup_address: data.pickup_address || '',
        delivery_available: data.delivery_available,
        delivery_radius_km: data.delivery_radius_km ? parseInt(data.delivery_radius_km) : 0,
        max_loan_days: data.max_loan_days ? parseInt(data.max_loan_days) : 7,
        usage_instructions: data.usage_instructions || '',
        safety_notes: data.safety_notes || '',
        is_available: true,
        pickup_latitude: null,
        pickup_longitude: null,
      }

      const newTool = await apiClient.createTool(toolData)
      setSuccess(true)
      
      // Redirect to the new tool after a brief delay
      setTimeout(() => {
        router.push(`/tools/${newTool.id}`)
      }, 2000)
    } catch (err: any) {
      console.error('Error creating tool:', err)
      // Try to extract a more specific error message
      if (err.response?.data?.detail) {
        setError(`Fehler: ${err.response.data.detail}`)
      } else if (err.message) {
        setError(`Fehler: ${err.message}`)
      } else {
        setError('Werkzeug konnte nicht erstellt werden. Bitte versuchen Sie es erneut.')
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return <div>Weiterleitung...</div>
  }

  if (success) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <div className="bg-green-50 border border-green-200 rounded-lg p-8">
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">
              Werkzeug erfolgreich hinzugefügt!
            </h1>
            <p className="text-green-700">
              Ihr Werkzeug ist jetzt verfügbar und kann von anderen Nutzern gemietet werden.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <Button onClick={() => router.back()} variant="outline" className="mb-4">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Zurück
          </Button>
          <h1 className="text-3xl font-bold">Neues Werkzeug hinzufügen</h1>
          <p className="text-gray-600 mt-2">
            Fügen Sie ein Werkzeug hinzu und beginnen Sie zu verdienen
          </p>
        </div>

        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <Shield className="h-4 w-4" />
            <div>
              <h4 className="font-semibold text-red-800">Fehler</h4>
              <p className="text-red-700">{error}</p>
            </div>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Info className="w-5 h-5" />
                  <span>Grundinformationen</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Titel *</FormLabel>
                      <FormControl>
                        <Input placeholder="z.B. Bosch Professional Schlagbohrmaschine" {...field} />
                      </FormControl>
                      <FormDescription>
                        Geben Sie einen aussagekräftigen Titel für Ihr Werkzeug ein
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Beschreibung</FormLabel>
                      <FormControl>
                        <textarea
                          className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Beschreiben Sie Ihr Werkzeug und seine Eigenschaften..."
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Detaillierte Beschreibung hilft Mietern bei der Entscheidung
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="category_id"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kategorie *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Kategorie wählen" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {categories.map((category) => (
                              <SelectItem key={category.id} value={category.id.toString()}>
                                {category.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="condition"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Zustand *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="excellent">Ausgezeichnet</SelectItem>
                            <SelectItem value="good">Gut</SelectItem>
                            <SelectItem value="fair">Akzeptabel</SelectItem>
                            <SelectItem value="poor">Schlecht</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="brand"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Marke</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. Bosch, Makita, Festool" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="model"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modell</FormLabel>
                        <FormControl>
                          <Input placeholder="z.B. GSB 19-2 RE" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Pricing */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="w-5 h-5" />
                  <span>Preisgestaltung</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="daily_rate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tagesrate (€) *</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="25.00" {...field} />
                        </FormControl>
                        <FormDescription>
                          Preis pro Tag in Euro
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="deposit_amount"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Kaution (€)</FormLabel>
                        <FormControl>
                          <Input type="number" step="0.01" placeholder="50.00" {...field} />
                        </FormControl>
                        <FormDescription>
                          Optional - Sicherheitskaution
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="max_loan_days"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Maximale Leihdauer (Tage)</FormLabel>
                      <FormControl>
                        <Input type="number" placeholder="7" {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional - Maximale Anzahl Tage für eine Buchung
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Location & Delivery */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="w-5 h-5" />
                  <span>Standort & Lieferung</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="pickup_city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Stadt *</FormLabel>
                        <FormControl>
                          <Input placeholder="Berlin" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="pickup_postal_code"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Postleitzahl *</FormLabel>
                        <FormControl>
                          <Input placeholder="10115" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="pickup_address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adresse</FormLabel>
                      <FormControl>
                        <Input placeholder="Musterstraße 123" {...field} />
                      </FormControl>
                      <FormDescription>
                        Optional - Genaue Adresse für Abholung
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex items-center space-x-2">
                  <FormField
                    control={form.control}
                    name="delivery_available"
                    render={({ field }) => (
                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                        <FormControl>
                          <input
                            type="checkbox"
                            checked={field.value}
                            onChange={field.onChange}
                            className="mt-1"
                          />
                        </FormControl>
                        <div className="space-y-1 leading-none">
                          <FormLabel>
                            Lieferung verfügbar
                          </FormLabel>
                          <FormDescription>
                            Ich kann das Werkzeug liefern
                          </FormDescription>
                        </div>
                      </FormItem>
                    )}
                  />
                </div>

                {form.watch('delivery_available') && (
                  <FormField
                    control={form.control}
                    name="delivery_radius_km"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Lieferradius (km)</FormLabel>
                        <FormControl>
                          <Input type="number" placeholder="15" {...field} />
                        </FormControl>
                        <FormDescription>
                          Maximaler Umkreis für Lieferungen
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
              </CardContent>
            </Card>

            {/* Additional Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Shield className="w-5 h-5" />
                  <span>Zusätzliche Informationen</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <FormField
                  control={form.control}
                  name="usage_instructions"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nutzungshinweise</FormLabel>
                      <FormControl>
                        <textarea
                          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Besondere Bedienungshinweise, Tipps zur Nutzung..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="safety_notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Sicherheitshinweise</FormLabel>
                      <FormControl>
                        <textarea
                          className="min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                          placeholder="Wichtige Sicherheitshinweise für die Nutzung..."
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Photo Upload Placeholder */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Upload className="w-5 h-5" />
                  <span>Fotos</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    Foto-Upload
                  </h3>
                  <p className="text-gray-600 mb-4">
                    Die Foto-Upload-Funktion wird in einem späteren Update verfügbar sein.
                  </p>
                  <Badge variant="secondary">Kommt bald</Badge>
                </div>
              </CardContent>
            </Card>

            {/* Submit */}
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? 'Erstelle...' : 'Werkzeug hinzufügen'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}