# Wippestoolen Frontend - Missing Features Implementation Plan

## Current State Assessment

**✅ Implemented Features:**
- Next.js 14 with TypeScript and Tailwind CSS + shadcn/ui
- Complete authentication system (login, register, profile)
- Advanced tool browsing with search, filters, pagination
- Secure API client with JWT cookie-based authentication
- German localization throughout the application
- Mobile-responsive design with touch-friendly interfaces

**❌ Missing Core Features:**
1. Individual tool detail pages (`/tools/[id]`)
2. Booking flow UI (calendar, requests, status management)
3. Review system UI (rating forms, review display)
4. User's "My Tools" management page (`/my-tools`)
5. User's "My Bookings" tracking page (`/bookings`)
6. Categories overview page (`/categories`)
7. Tool creation/editing forms (`/tools/new`, `/tools/[id]/edit`)

## Implementation Priority & Timeline

### Phase 1 - Foundation (Week 1) - 28 hours
1. **Tool Detail Pages** (`/tools/[id]`) - 16 hours
   - Hero section with image gallery
   - Tool specifications and description
   - Owner profile card
   - Booking interface integration
   - Reviews display section
   
2. **Categories Page** (`/categories`) - 8 hours
   - Category grid with tool counts
   - Search and filter integration
   - Mobile-responsive design
   
3. **Additional shadcn/ui components** - 4 hours
   - Calendar component setup
   - Dialog/modal components
   - Textarea and additional form components

### Phase 2 - Tool Management (Week 2) - 48 hours
4. **Tool Creation Form** (`/tools/new`) - 20 hours
   - Multi-step form with validation
   - Image upload with preview
   - Location picker integration
   - Category selection
   
5. **Tool Editing Form** (`/tools/[id]/edit`) - 12 hours
   - Pre-populated form with existing data
   - Image management (add/remove/reorder)
   - Validation and error handling
   
6. **My Tools Management** (`/my-tools`) - 16 hours
   - Tools dashboard with statistics
   - Quick actions (edit, delete, availability)
   - Performance analytics
   - Responsive data table

### Phase 3 - Booking System (Week 3) - 40 hours
7. **Booking Flow UI** - 24 hours
   - Interactive calendar with availability
   - Booking request form
   - Status management interface
   - Conflict resolution handling
   
8. **My Bookings Page** (`/bookings`) - 16 hours
   - Booking history with filtering
   - Status tracking with timeline
   - Action buttons (confirm, decline, etc.)
   - Mobile-optimized list view

### Phase 4 - Review System (Week 4) - 28 hours
9. **Review Forms & Display** - 20 hours
   - Star rating component
   - Review creation modal
   - Review list with pagination
   - Moderation indicators
   
10. **Review Integration** - 8 hours
    - Integration with booking flow
    - Tool detail page reviews
    - User profile reviews
    - Review notifications

**Total Estimated Effort: 144 hours (4 weeks)**

## Component Architecture

### Tool Detail Components
```
components/tools/
├── tool-detail/
│   ├── tool-hero.tsx          # Image gallery + main info
│   ├── tool-info.tsx          # Specifications, description
│   ├── tool-owner-card.tsx    # Owner profile + contact
│   ├── tool-booking-card.tsx  # Booking interface
│   ├── tool-reviews.tsx       # Reviews display
│   └── tool-availability.tsx  # Calendar availability
```

### Booking Components
```
components/bookings/
├── booking-calendar.tsx       # Date selection calendar
├── booking-form.tsx          # Request form
├── booking-card.tsx          # Booking item display
├── booking-status-badge.tsx  # Status indicators
├── booking-actions.tsx       # Status change buttons
└── booking-timeline.tsx      # Status history
```

### Review Components
```
components/reviews/
├── review-form.tsx           # Rating + comment form
├── review-card.tsx          # Individual review display
├── review-list.tsx          # Reviews list with pagination
├── rating-display.tsx       # Star rating component
└── review-modal.tsx         # Review creation modal
```

### Form Components
```
components/forms/
├── tool-form.tsx            # Tool creation/editing
├── image-upload.tsx         # Photo upload component
├── location-picker.tsx      # Address/location input
└── validation-schemas.ts    # Zod schemas
```

## State Management Strategy

### Server State (SWR)
- **Tool Data**: Individual tools, search results, categories
- **Booking Data**: User bookings, availability checks
- **Review Data**: Tool reviews, pending reviews
- **User Tools**: Owner's tool management

### Client State (React State + Context)
- **Form State**: React Hook Form for all forms
- **Modal State**: Dialog/drawer open/close states
- **Filter State**: Search and filter preferences
- **Calendar State**: Selected dates and availability

### Data Fetching Patterns
```typescript
// Tool detail with SWR
const { data: tool, error, mutate } = useSWR(
  `/api/v1/tools/${id}`, 
  apiClient.getTool
)

// Bookings with pagination
const { data: bookings } = useSWR(
  [`/api/v1/bookings`, page, filters], 
  ([url, page, filters]) => apiClient.getBookings({ ...filters, page })
)

// Optimistic updates for bookings
const updateBookingStatus = async (id: string, status: string) => {
  mutate(optimisticUpdate, false)
  await apiClient.updateBookingStatus(id, status)
  mutate()
}
```

## Form Validation Approach

### Zod Schemas
```typescript
// Tool creation schema
const toolSchema = z.object({
  title: z.string().min(3, 'Titel muss mindestens 3 Zeichen haben'),
  description: z.string().min(20, 'Beschreibung muss mindestens 20 Zeichen haben'),
  category_id: z.number().positive('Bitte Kategorie auswählen'),
  daily_rate: z.number().positive('Tagespreis muss positiv sein'),
  condition: z.enum(['neu', 'sehr_gut', 'gut', 'gebraucht']),
  delivery_available: z.boolean(),
  pickup_address: z.string().min(5, 'Adresse erforderlich'),
  pickup_postal_code: z.string().regex(/^\d{5}$/, 'Ungültige PLZ'),
  photos: z.array(z.object({
    file: z.instanceof(File),
    preview: z.string()
  })).min(1, 'Mindestens ein Foto erforderlich').max(10, 'Maximal 10 Fotos')
})

// Booking request schema
const bookingSchema = z.object({
  start_date: z.string().refine(
    date => new Date(date) > new Date(), 
    'Startdatum muss in der Zukunft liegen'
  ),
  end_date: z.string(),
  pickup_method: z.enum(['pickup', 'delivery']),
  delivery_address: z.string().optional(),
  notes: z.string().max(500, 'Notizen max. 500 Zeichen').optional()
}).refine(data => new Date(data.end_date) > new Date(data.start_date), {
  message: 'Enddatum muss nach Startdatum liegen',
  path: ['end_date']
})

// Review schema
const reviewSchema = z.object({
  rating: z.number().min(1, 'Bewertung erforderlich').max(5),
  comment: z.string()
    .min(10, 'Kommentar muss mindestens 10 Zeichen haben')
    .max(1000, 'Kommentar max. 1000 Zeichen')
})
```

### Real-time Validation Features
- **React Hook Form** with Zod resolver
- **Field-level validation** with immediate feedback
- **Server-side validation** error handling
- **Optimistic UI updates** with rollback on error
- **Form state persistence** in sessionStorage for multi-step forms

## Calendar Component Implementation

### shadcn/ui Calendar with Booking Overlay
```typescript
import { Calendar } from '@/components/ui/calendar'
import { addDays, isSameDay, format } from 'date-fns'
import { de } from 'date-fns/locale'

interface BookingCalendarProps {
  toolId: string
  onDateSelect: (dates: { from: Date; to?: Date }) => void
  selectedDates?: { from: Date; to?: Date }
}

const BookingCalendar = ({ toolId, onDateSelect, selectedDates }) => {
  const { data: availability } = useSWR(
    `/api/v1/tools/${toolId}/availability`,
    () => apiClient.getToolAvailability(toolId)
  )

  const bookedDates = availability?.booked_dates?.map(d => new Date(d)) || []
  const unavailableDates = availability?.unavailable_dates?.map(d => new Date(d)) || []
  
  const modifiers = {
    booked: bookedDates,
    unavailable: unavailableDates,
    selected: selectedDates ? [selectedDates.from, selectedDates.to].filter(Boolean) : []
  }

  const modifiersStyles = {
    booked: { 
      backgroundColor: '#fee2e2', 
      color: '#991b1b',
      textDecoration: 'line-through'
    },
    unavailable: { 
      backgroundColor: '#f3f4f6', 
      color: '#6b7280',
      cursor: 'not-allowed'
    },
    selected: {
      backgroundColor: '#3b82f6',
      color: 'white'
    }
  }

  const isDateDisabled = (date: Date) => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    
    return date < today || 
           bookedDates.some(d => isSameDay(d, date)) ||
           unavailableDates.some(d => isSameDay(d, date))
  }

  return (
    <div className="space-y-4">
      <Calendar
        mode="range"
        selected={selectedDates}
        onSelect={onDateSelect}
        locale={de}
        modifiers={modifiers}
        modifiersStyles={modifiersStyles}
        disabled={isDateDisabled}
        numberOfMonths={2}
        className="rounded-md border"
      />
      
      {/* Legend */}
      <div className="flex flex-wrap gap-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-blue-500 rounded"></div>
          <span>Verfügbar</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-red-200 rounded"></div>
          <span>Belegt</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 bg-gray-200 rounded"></div>
          <span>Nicht verfügbar</span>
        </div>
      </div>
    </div>
  )
}
```

## Review/Rating Component Patterns

### Star Rating Component
```typescript
interface StarRatingProps {
  rating: number
  onRatingChange?: (rating: number) => void
  readonly?: boolean
  size?: 'sm' | 'md' | 'lg'
  showLabel?: boolean
}

const StarRating = ({ 
  rating, 
  onRatingChange, 
  readonly = false, 
  size = 'md',
  showLabel = false 
}) => {
  const sizes = { 
    sm: 'h-4 w-4', 
    md: 'h-5 w-5', 
    lg: 'h-6 w-6' 
  }
  
  const labels = ['Sehr schlecht', 'Schlecht', 'OK', 'Gut', 'Sehr gut']
  
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map(star => (
          <Star
            key={star}
            className={cn(
              sizes[size],
              star <= rating 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300',
              !readonly && 'cursor-pointer hover:text-yellow-400 transition-colors'
            )}
            onClick={() => !readonly && onRatingChange?.(star)}
            onMouseEnter={() => !readonly && setHoverRating(star)}
            onMouseLeave={() => !readonly && setHoverRating(0)}
          />
        ))}
      </div>
      
      {showLabel && rating > 0 && (
        <span className="text-sm text-gray-600">
          {labels[rating - 1]}
        </span>
      )}
      
      {!readonly && (
        <span className="text-xs text-gray-500 ml-2">
          Klicken Sie auf einen Stern
        </span>
      )}
    </div>
  )
}
```

### Review Form Modal
```typescript
interface ReviewModalProps {
  booking: Booking
  reviewType: 'tool_review' | 'borrower_review'
  isOpen: boolean
  onSubmit: (data: ReviewFormData) => Promise<void>
  onClose: () => void
}

const ReviewModal = ({ booking, reviewType, isOpen, onSubmit, onClose }) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: ''
    }
  })

  const handleSubmit = async (data: ReviewFormData) => {
    setIsSubmitting(true)
    try {
      await onSubmit(data)
      form.reset()
      onClose()
    } catch (error) {
      console.error('Fehler beim Absenden der Bewertung:', error)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {reviewType === 'tool_review' 
              ? `Werkzeug "${booking.tool?.title}" bewerten`
              : `Benutzer ${booking.borrower?.display_name} bewerten`
            }
          </DialogTitle>
          <DialogDescription>
            Teilen Sie Ihre Erfahrung mit anderen Nutzern
          </DialogDescription>
        </DialogHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bewertung *</FormLabel>
                  <StarRating
                    rating={field.value}
                    onRatingChange={field.onChange}
                    showLabel
                    size="lg"
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kommentar *</FormLabel>
                  <Textarea
                    placeholder={
                      reviewType === 'tool_review'
                        ? 'Wie war der Zustand des Werkzeugs? War es wie beschrieben?'
                        : 'Wie war die Kommunikation? Wurde das Werkzeug ordnungsgemäß behandelt?'
                    }
                    className="min-h-[100px]"
                    {...field}
                  />
                  <FormDescription>
                    Mindestens 10 Zeichen, maximal 1000 Zeichen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Abbrechen
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || form.watch('rating') === 0}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Bewertung absenden
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
```

## Technical Challenges & Solutions

### 1. Image Upload & Management
**Challenge**: Multiple photo upload with preview, reordering, and S3 integration

**Solution**:
```typescript
const ImageUpload = ({ onImagesChange, maxImages = 10, existingImages = [] }) => {
  const [images, setImages] = useState<ImageFile[]>(existingImages)
  const [uploading, setUploading] = useState(false)

  const handleFileSelect = async (files: FileList) => {
    const newImages = Array.from(files).map(file => ({
      id: uuidv4(),
      file,
      preview: URL.createObjectURL(file),
      uploaded: false
    }))

    setImages(prev => [...prev, ...newImages].slice(0, maxImages))
    
    // Upload to S3 with presigned URLs
    for (const image of newImages) {
      await uploadImageToS3(image)
    }
  }

  return (
    <div className="space-y-4">
      <DragDropArea onFileSelect={handleFileSelect} />
      <ImageGrid 
        images={images}
        onReorder={setImages}
        onRemove={removeImage}
      />
    </div>
  )
}
```

### 2. Real-time Availability Updates
**Challenge**: Show real-time booking availability and handle conflicts

**Solution**:
- **SWR with short revalidation**: 30-second intervals for availability
- **WebSocket integration**: Real-time booking status updates
- **Optimistic UI**: Immediate feedback with rollback on conflict
- **Conflict resolution**: Clear messaging when bookings overlap

### 3. Complex Form State Management
**Challenge**: Multi-step forms with validation and persistence

**Solution**:
```typescript
// Form state persistence hook
const useFormPersistence = (formKey: string, defaultValues: any) => {
  const [storedData, setStoredData] = useSessionStorage(formKey, defaultValues)
  
  const form = useForm({
    resolver: zodResolver(schema),
    defaultValues: storedData
  })

  useEffect(() => {
    const subscription = form.watch((data) => {
      setStoredData(data)
    })
    return () => subscription.unsubscribe()
  }, [form.watch])

  return form
}
```

### 4. Mobile Calendar UX
**Challenge**: Calendar interaction on touch devices

**Solution**:
- **Bottom sheet modal**: Full-screen calendar on mobile
- **Touch-friendly targets**: Minimum 44px touch areas
- **Swipe navigation**: Month navigation with gestures
- **Haptic feedback**: Touch feedback for better UX

## Performance Optimizations

### Code Splitting
```typescript
// Lazy load heavy components
const BookingCalendar = lazy(() => 
  import('@/components/bookings/booking-calendar')
)
const ImageUpload = lazy(() => 
  import('@/components/forms/image-upload')
)
const ReviewModal = lazy(() => 
  import('@/components/reviews/review-modal')
)

// Loading fallbacks
const CalendarSkeleton = () => (
  <div className="animate-pulse">
    <div className="h-64 bg-gray-200 rounded"></div>
  </div>
)
```

### Image Optimization
```typescript
// Optimized image component
const OptimizedImage = ({ src, alt, ...props }) => (
  <Image
    src={src}
    alt={alt}
    placeholder="blur"
    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyaqkVEsWl3hJJiEZRltqhe9yrv6w1wFJFXMj45iR1tC2lMqbHZRoVMkf3LuMzYrQJltTHqN9EH5vYbBQ="
    quality={85}
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    {...props}
  />
)
```

### Data Fetching Optimization
```typescript
// SWR configuration for optimal performance
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  refreshInterval: 30000, // 30 seconds for availability data
  dedupingInterval: 2000,
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  loadingTimeout: 10000
}

// Prefetch critical data
const prefetchToolData = (toolId: string) => {
  mutate(`/api/v1/tools/${toolId}`, apiClient.getTool(toolId))
  mutate(`/api/v1/tools/${toolId}/reviews`, apiClient.getReviews({ tool_id: toolId }))
  mutate(`/api/v1/tools/${toolId}/availability`, apiClient.getToolAvailability(toolId))
}
```

## Mobile-First Design Patterns

### Responsive Grid Systems
```css
/* Tool cards grid */
.tools-grid {
  @apply grid gap-4;
  grid-template-columns: 1fr; /* Mobile: 1 column */
}

@media (min-width: 640px) {
  .tools-grid {
    grid-template-columns: repeat(2, 1fr); /* Tablet: 2 columns */
  }
}

@media (min-width: 1024px) {
  .tools-grid {
    grid-template-columns: repeat(3, 1fr); /* Desktop: 3 columns */
  }
}

@media (min-width: 1280px) {
  .tools-grid {
    grid-template-columns: repeat(4, 1fr); /* Large: 4 columns */
  }
}
```

### Touch-Friendly Components
```typescript
// Mobile-optimized booking card
const BookingCard = ({ booking, onStatusChange }) => (
  <Card className="w-full">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between">
        <div>
          <CardTitle className="text-base">{booking.tool?.title}</CardTitle>
          <CardDescription>
            {format(new Date(booking.start_date), 'dd.MM.yyyy', { locale: de })} - 
            {format(new Date(booking.end_date), 'dd.MM.yyyy', { locale: de })}
          </CardDescription>
        </div>
        <BookingStatusBadge status={booking.status} />
      </div>
    </CardHeader>
    
    <CardContent className="pt-0">
      {/* Tool image */}
      <div className="aspect-video mb-3 rounded-lg overflow-hidden bg-gray-100">
        <OptimizedImage
          src={booking.tool?.primary_photo?.medium_url || '/placeholder.jpg'}
          alt={booking.tool?.title || ''}
          fill
          className="object-cover"
        />
      </div>
      
      {/* Booking details */}
      <div className="space-y-2 text-sm">
        <div className="flex justify-between">
          <span className="text-gray-600">Gesamtkosten:</span>
          <span className="font-semibold">€{booking.total_cost}</span>
        </div>
        {booking.delivery_address && (
          <div className="flex justify-between">
            <span className="text-gray-600">Lieferung:</span>
            <span className="text-right">{booking.delivery_address}</span>
          </div>
        )}
      </div>
    </CardContent>
    
    {/* Action buttons - touch-friendly */}
    <CardFooter className="pt-3">
      <BookingActions
        booking={booking}
        onStatusChange={onStatusChange}
        isMobile={true}
      />
    </CardFooter>
  </Card>
)
```

## German Localization Integration

### Consistent Label System
```typescript
export const GERMAN_LABELS = {
  // Tool management
  tools: {
    title: 'Werkzeuge',
    create: 'Werkzeug inserieren',
    edit: 'Werkzeug bearbeiten',
    myTools: 'Meine Werkzeuge',
    categories: 'Kategorien',
    condition: {
      new: 'Neu',
      very_good: 'Sehr gut',
      good: 'Gut',
      used: 'Gebraucht'
    },
    availability: 'Verfügbarkeit',
    dailyRate: 'Tagespreis',
    deposit: 'Kaution'
  },
  
  // Booking system
  bookings: {
    title: 'Buchungen',
    myBookings: 'Meine Buchungen',
    request: 'Buchung anfragen',
    startDate: 'Startdatum',
    endDate: 'Enddatum',
    pickupMethod: 'Abholung/Lieferung',
    deliveryAddress: 'Lieferadresse',
    notes: 'Anmerkungen',
    totalCost: 'Gesamtkosten',
    status: {
      pending: 'Ausstehend',
      confirmed: 'Bestätigt',
      declined: 'Abgelehnt',
      cancelled: 'Storniert',
      active: 'Aktiv',
      overdue: 'Überfällig',
      completed: 'Abgeschlossen',
      disputed: 'Streitfall'
    }
  },
  
  // Review system
  reviews: {
    title: 'Bewertungen',
    create: 'Bewertung abgeben',
    rating: 'Bewertung',
    comment: 'Kommentar',
    toolReview: 'Werkzeug bewerten',
    borrowerReview: 'Benutzer bewerten',
    ratingLabels: {
      1: 'Sehr schlecht',
      2: 'Schlecht', 
      3: 'OK',
      4: 'Gut',
      5: 'Sehr gut'
    }
  },
  
  // Form validation
  validation: {
    required: 'Dieses Feld ist erforderlich',
    minLength: (n: number) => `Mindestens ${n} Zeichen erforderlich`,
    maxLength: (n: number) => `Maximal ${n} Zeichen erlaubt`,
    email: 'Ungültige E-Mail-Adresse',
    positiveNumber: 'Wert muss positiv sein',
    futureDate: 'Datum muss in der Zukunft liegen',
    endAfterStart: 'Enddatum muss nach Startdatum liegen'
  },
  
  // Common actions
  actions: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    view: 'Anzeigen',
    submit: 'Absenden',
    close: 'Schließen',
    confirm: 'Bestätigen',
    back: 'Zurück',
    next: 'Weiter',
    loading: 'Laden...',
    success: 'Erfolgreich',
    error: 'Fehler'
  }
}

// Usage in components
const BookingForm = () => {
  const t = GERMAN_LABELS.bookings
  
  return (
    <form>
      <Label>{t.startDate}</Label>
      <Input type="date" />
      
      <Label>{t.endDate}</Label>
      <Input type="date" />
      
      <Button type="submit">{GERMAN_LABELS.actions.submit}</Button>
    </form>
  )
}
```

### Date and Number Formatting
```typescript
// Consistent German formatting
export const formatters = {
  date: (date: string | Date) => 
    format(new Date(date), 'dd.MM.yyyy', { locale: de }),
    
  dateTime: (date: string | Date) => 
    format(new Date(date), 'dd.MM.yyyy HH:mm', { locale: de }),
    
  currency: (amount: number | string) => 
    new Intl.NumberFormat('de-DE', {
      style: 'currency',
      currency: 'EUR'
    }).format(Number(amount)),
    
  number: (value: number) =>
    new Intl.NumberFormat('de-DE').format(value)
}
```

## Quality Assurance & Testing

### Component Testing Strategy
```typescript
// Example test for BookingCalendar
describe('BookingCalendar', () => {
  it('should disable booked dates', async () => {
    const mockAvailability = {
      booked_dates: ['2024-01-15', '2024-01-16'],
      available_dates: []
    }
    
    render(<BookingCalendar toolId="123" onDateSelect={jest.fn()} />)
    
    // Test that booked dates are disabled
    const bookedDate = screen.getByRole('button', { name: /15/ })
    expect(bookedDate).toHaveAttribute('disabled')
  })
  
  it('should call onDateSelect when valid date range selected', () => {
    const onDateSelect = jest.fn()
    render(<BookingCalendar toolId="123" onDateSelect={onDateSelect} />)
    
    // Select date range
    fireEvent.click(screen.getByRole('button', { name: /20/ }))
    fireEvent.click(screen.getByRole('button', { name: /22/ }))
    
    expect(onDateSelect).toHaveBeenCalledWith({
      from: expect.any(Date),
      to: expect.any(Date)
    })
  })
})
```

### Integration Testing
- **API integration tests** with MSW mocking
- **End-to-end workflows** with Playwright
- **Accessibility testing** with automated tools
- **Performance testing** with Lighthouse CI

This comprehensive implementation plan provides all the necessary details to complete the missing frontend features while maintaining consistency with the existing codebase and following best practices for performance, accessibility, and user experience.