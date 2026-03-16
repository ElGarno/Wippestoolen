'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ArrowLeft, Save, Trash2, DollarSign, MapPin, Shield, Info } from 'lucide-react'
import { Tool, ToolCategory } from '@/types'
import { apiClient } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert } from '@/components/ui/alert'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'

const toolFormSchema = z.object({
  title: z.string().min(3, 'Titel muss mindestens 3 Zeichen lang sein'),
  description: z.string().optional(),
  category_id: z.string().min(1, 'Bitte wählen Sie eine Kategorie'),
  condition: z.enum(['Neu', 'Wie neu', 'Gut', 'Gebraucht', 'Beschädigt']),
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
  is_available: z.boolean(),
})

type ToolFormData = z.infer<typeof toolFormSchema>

export default function EditToolPage() {
  const { isAuthenticated } = useAuth()
  const params = useParams()
  const router = useRouter()
  const toolId = params?.id as string
  
  const [tool, setTool] = useState<Tool | null>(null)
  const [categories, setCategories] = useState<ToolCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<ToolFormData>({
    resolver: zodResolver(toolFormSchema),
    defaultValues: {
      title: '',
      description: '',
      category_id: '',
      condition: 'Gut',
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
      is_available: true,
    }
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/auth/login')
      return
    }

    if (!toolId) return

    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)

        // Fetch tool data
        const toolData = await apiClient.getTool(toolId)
        setTool(toolData)

        // Set form values
        form.reset({
          title: toolData.title,
          description: toolData.description || '',
          category_id: toolData.category.id.toString(),
          condition: toolData.condition as any,
          daily_rate: typeof toolData.daily_rate === 'string' 
            ? toolData.daily_rate 
            : toolData.daily_rate.toString(),
          deposit_amount: toolData.deposit_amount 
            ? (typeof toolData.deposit_amount === 'string' 
              ? toolData.deposit_amount 
              : toolData.deposit_amount.toString())
            : '',
          brand: toolData.brand || '',
          model: toolData.model || '',
          pickup_city: toolData.pickup_city || '',
          pickup_postal_code: toolData.pickup_postal_code || '',
          pickup_address: toolData.pickup_address || '',
          delivery_available: toolData.delivery_available,
          delivery_radius_km: toolData.delivery_radius_km 
            ? toolData.delivery_radius_km.toString() 
            : '',
          max_loan_days: toolData.max_loan_days 
            ? toolData.max_loan_days.toString() 
            : '',
          usage_instructions: toolData.usage_instructions || '',
          safety_notes: toolData.safety_notes || '',
          is_available: toolData.is_available,
        })

        // Fetch categories (placeholder data)
        setCategories([
          { id: 1, name: 'Elektrowerkzeuge', slug: 'power-tools', description: 'Bohrmaschinen, Sägen, etc.' },
          { id: 2, name: 'Handwerkzeuge', slug: 'hand-tools', description: 'Schraubendreher, Hammer, etc.' },
          { id: 3, name: 'Gartenwerkzeuge', slug: 'garden-tools', description: 'Rasenmäher, Spaten, etc.' },
          { id: 4, name: 'Leiter & Gerüste', slug: 'ladders', description: 'Leitern und Gerüstteile' },
          { id: 5, name: 'Reinigungsgeräte', slug: 'cleaning', description: 'Hochdruckreiniger, Staubsauger' },
        ])
      } catch (err) {
        console.error('Error fetching tool:', err)
        setError('Werkzeug konnte nicht geladen werden')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [isAuthenticated, toolId, router, form])

  const onSubmit = async (data: ToolFormData) => {
    try {
      setSaving(true)
      setError(null)

      // Convert form data to API format
      const updateData = {
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
        delivery_radius_km: data.delivery_radius_km ? parseInt(data.delivery_radius_km) : undefined,
        max_loan_days: data.max_loan_days ? parseInt(data.max_loan_days) : undefined,
        usage_instructions: data.usage_instructions || '',
        safety_notes: data.safety_notes || '',
        is_available: data.is_available,
      }

      await apiClient.updateTool(toolId, updateData)
      setSuccess(true)
      
      // Show success message and redirect
      setTimeout(() => {
        router.push(`/tools/${toolId}`)
      }, 2000)
    } catch (err) {
      console.error('Error updating tool:', err)
      setError('Werkzeug konnte nicht aktualisiert werden. Bitte versuchen Sie es erneut.')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Möchten Sie dieses Werkzeug wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.')) {
      return
    }

    try {
      await apiClient.deleteTool(toolId)
      router.push('/my-tools')
    } catch (err) {
      console.error('Error deleting tool:', err)
      setError('Werkzeug konnte nicht gelöscht werden')
    }
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
            <div className="space-y-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-32 bg-gray-200 rounded"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error && !tool) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <Alert className="mb-6 border-red-200 bg-red-50">
            <Shield className="h-4 w-4" />
            <div>
              <h4 className="font-semibold text-red-800">Fehler</h4>
              <p className="text-red-700">{error}</p>
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
            <div className="text-green-600 text-6xl mb-4">✓</div>
            <h1 className="text-2xl font-bold text-green-800 mb-2">
              Werkzeug erfolgreich aktualisiert!
            </h1>
            <p className="text-green-700">
              Die Änderungen wurden gespeichert.
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
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold">Werkzeug bearbeiten</h1>
              <p className="text-gray-600 mt-2">{tool?.title}</p>
            </div>
            <Button
              variant="destructive"
              onClick={handleDelete}
              className="flex items-center space-x-2"
            >
              <Trash2 className="w-4 h-4" />
              <span>Löschen</span>
            </Button>
          </div>
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
            {/* Availability Toggle */}
            <Card>
              <CardHeader>
                <CardTitle>Verfügbarkeit</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="is_available"
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
                          Werkzeug verfügbar machen
                        </FormLabel>
                        <FormDescription>
                          Wenn deaktiviert, wird das Werkzeug als nicht verfügbar angezeigt
                        </FormDescription>
                      </div>
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

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
                            <SelectItem value="Neu">Neu</SelectItem>
                            <SelectItem value="Wie neu">Wie neu</SelectItem>
                            <SelectItem value="Gut">Gut</SelectItem>
                            <SelectItem value="Gebraucht">Gebraucht</SelectItem>
                            <SelectItem value="Beschädigt">Beschädigt</SelectItem>
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

            {/* Submit */}
            <div className="flex justify-end space-x-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={saving}>
                <Save className="w-4 h-4 mr-2" />
                {saving ? 'Speichere...' : 'Änderungen speichern'}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  )
}