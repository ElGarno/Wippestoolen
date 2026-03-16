# UI Component Architecture for Wippestoolen Tool-Sharing Platform

## Component Hierarchy Overview

```
App Layout
├── Navigation (Header/Footer)
├── Authentication Components
│   ├── LoginForm
│   ├── RegisterForm
│   └── ProfileSettings
├── Tool Components
│   ├── ToolCard
│   ├── ToolGrid
│   ├── ToolDetails
│   ├── ToolForm
│   └── ToolSearch
├── Booking Components
│   ├── BookingCalendar
│   ├── BookingForm
│   ├── BookingCard
│   └── BookingStatus
├── Review Components
│   ├── ReviewForm
│   ├── ReviewCard
│   ├── StarRating
│   └── ReviewsList
├── Notification Components
│   ├── NotificationToast
│   ├── NotificationBell
│   └── NotificationsList
└── Shared Components
    ├── LoadingSpinner
    ├── ErrorBoundary
    ├── ImageUpload
    └── ConfirmDialog
```

## Core Component Specifications

### 1. Navigation Components

#### AppHeader Component
```typescript
interface AppHeaderProps {
  user?: User
  notificationCount?: number
}

// Mobile-first responsive header
const AppHeader = ({ user, notificationCount }: AppHeaderProps) => (
  <header className="sticky top-0 z-50 bg-white border-b">
    <div className="container mx-auto px-4 h-16 flex items-center justify-between">
      {/* Mobile menu button */}
      <Sheet>
        <SheetTrigger asChild className="lg:hidden">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-80">
          <MobileNav user={user} />
        </SheetContent>
      </Sheet>

      {/* Logo */}
      <Link href="/" className="flex items-center space-x-2">
        <Wrench className="h-6 w-6 text-primary" />
        <span className="font-bold text-xl hidden sm:inline">Wippestoolen</span>
      </Link>

      {/* Desktop navigation */}
      <NavigationMenu className="hidden lg:flex">
        <NavigationMenuList>
          <NavigationMenuItem>
            <Link href="/tools" className="px-4 py-2">Browse Tools</Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/my-tools" className="px-4 py-2">My Tools</Link>
          </NavigationMenuItem>
          <NavigationMenuItem>
            <Link href="/bookings" className="px-4 py-2">My Bookings</Link>
          </NavigationMenuItem>
        </NavigationMenuList>
      </NavigationMenu>

      {/* User actions */}
      <div className="flex items-center space-x-2">
        <NotificationBell count={notificationCount} />
        <UserMenu user={user} />
      </div>
    </div>
  </header>
)
```

**Design System:**
- **Colors**: Primary blue (#3B82F6), Secondary gray (#6B7280)
- **Typography**: Inter font family, responsive text sizes
- **Spacing**: 4px base unit, consistent padding/margins
- **Breakpoints**: Mobile <768px, Tablet 768-1024px, Desktop >1024px

#### MobileNav Component
```typescript
const MobileNav = ({ user }: { user?: User }) => (
  <div className="flex flex-col space-y-4 py-4">
    <div className="px-4">
      {user ? (
        <div className="flex items-center space-x-3">
          <Avatar>
            <AvatarFallback>{user.name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium">{user.name}</p>
            <p className="text-sm text-muted-foreground">{user.email}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <Button asChild className="w-full">
            <Link href="/login">Login</Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href="/register">Sign Up</Link>
          </Button>
        </div>
      )}
    </div>
    
    <Separator />
    
    <nav className="flex flex-col space-y-2 px-4">
      <Link href="/tools" className="flex items-center space-x-3 py-2">
        <Search className="h-5 w-5" />
        <span>Browse Tools</span>
      </Link>
      <Link href="/my-tools" className="flex items-center space-x-3 py-2">
        <Wrench className="h-5 w-5" />
        <span>My Tools</span>
      </Link>
      <Link href="/bookings" className="flex items-center space-x-3 py-2">
        <Calendar className="h-5 w-5" />
        <span>My Bookings</span>
      </Link>
    </nav>
  </div>
)
```

### 2. Tool Components

#### ToolCard Component
```typescript
interface ToolCardProps {
  tool: {
    id: string
    title: string
    description: string
    image_url?: string
    daily_rate: number
    category: string
    owner_name: string
    owner_rating: number
    is_available: boolean
  }
  onBook?: (toolId: string) => void
  showOwnerInfo?: boolean
}

const ToolCard = ({ tool, onBook, showOwnerInfo = true }: ToolCardProps) => (
  <Card className="overflow-hidden hover:shadow-lg transition-shadow">
    <div className="relative aspect-video">
      <Image
        src={tool.image_url || '/images/tool-placeholder.jpg'}
        alt={tool.title}
        fill
        className="object-cover"
      />
      {!tool.is_available && (
        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
          <Badge variant="secondary">Unavailable</Badge>
        </div>
      )}
    </div>
    
    <CardContent className="p-4">
      <div className="space-y-2">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-lg leading-tight">{tool.title}</h3>
          <Badge variant="outline">{tool.category}</Badge>
        </div>
        
        <p className="text-sm text-muted-foreground line-clamp-2">
          {tool.description}
        </p>
        
        <div className="flex items-center justify-between">
          <div className="text-lg font-bold text-primary">
            ${tool.daily_rate}/day
          </div>
          
          {showOwnerInfo && (
            <div className="flex items-center space-x-1 text-sm">
              <User className="h-4 w-4" />
              <span>{tool.owner_name}</span>
              <StarRating value={tool.owner_rating} size="sm" readonly />
            </div>
          )}
        </div>
      </div>
    </CardContent>
    
    <CardFooter className="p-4 pt-0">
      <Button 
        className="w-full" 
        onClick={() => onBook?.(tool.id)}
        disabled={!tool.is_available}
      >
        {tool.is_available ? 'Book Tool' : 'Not Available'}
      </Button>
    </CardFooter>
  </Card>
)
```

#### ToolSearch Component
```typescript
const ToolSearch = ({ onSearch }: { onSearch: (params: SearchParams) => void }) => {
  const [searchTerm, setSearchTerm] = useState('')
  const [category, setCategory] = useState('')
  const [location, setLocation] = useState('')
  const [priceRange, setPriceRange] = useState([0, 100])

  return (
    <Card className="p-4">
      <div className="space-y-4">
        {/* Search input */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search for tools..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        {/* Filters - Mobile collapsible */}
        <Collapsible>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between lg:hidden">
              Filters
              <ChevronDown className="h-4 w-4" />
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent className="space-y-4 pt-4 lg:block">
            {/* Category filter */}
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All categories</SelectItem>
                  <SelectItem value="power-tools">Power Tools</SelectItem>
                  <SelectItem value="hand-tools">Hand Tools</SelectItem>
                  <SelectItem value="garden">Garden Tools</SelectItem>
                  {/* More categories */}
                </SelectContent>
              </Select>
            </div>
            
            {/* Price range */}
            <div className="space-y-2">
              <Label>Price Range (per day)</Label>
              <Slider
                value={priceRange}
                onValueChange={setPriceRange}
                max={100}
                step={5}
                className="w-full"
              />
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>${priceRange[0]}</span>
                <span>${priceRange[1]}+</span>
              </div>
            </div>
            
            {/* Location */}
            <div className="space-y-2">
              <Label>Location</Label>
              <Input
                placeholder="Enter location..."
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </CollapsibleContent>
        </Collapsible>
        
        <Button 
          onClick={() => onSearch({ searchTerm, category, location, priceRange })}
          className="w-full"
        >
          Search Tools
        </Button>
      </div>
    </Card>
  )
}
```

### 3. Booking Components

#### BookingCalendar Component
```typescript
interface BookingCalendarProps {
  toolId: string
  unavailableDates: Date[]
  onDateSelect: (startDate: Date, endDate: Date) => void
  dailyRate: number
}

const BookingCalendar = ({ toolId, unavailableDates, onDateSelect, dailyRate }: BookingCalendarProps) => {
  const [selectedRange, setSelectedRange] = useState<{start: Date, end: Date} | null>(null)
  
  const calculateTotal = () => {
    if (!selectedRange) return 0
    const days = differenceInDays(selectedRange.end, selectedRange.start) + 1
    return days * dailyRate
  }

  return (
    <Card className="p-4">
      <CardHeader>
        <CardTitle>Select Booking Dates</CardTitle>
        <CardDescription>
          Choose your rental period. Unavailable dates are marked in red.
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <Calendar
          mode="range"
          selected={selectedRange}
          onSelect={(range) => {
            if (range?.from && range?.to) {
              setSelectedRange({ start: range.from, end: range.to })
            }
          }}
          disabled={(date) => 
            isBefore(date, new Date()) || 
            unavailableDates.some(unavailable => 
              isSameDay(date, unavailable)
            )
          }
          className="rounded-md border"
        />
        
        {selectedRange && (
          <div className="space-y-2 p-4 bg-muted rounded-lg">
            <div className="flex justify-between">
              <span>Duration:</span>
              <span className="font-medium">
                {differenceInDays(selectedRange.end, selectedRange.start) + 1} days
              </span>
            </div>
            <div className="flex justify-between">
              <span>Daily Rate:</span>
              <span className="font-medium">${dailyRate}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>Total:</span>
              <span>${calculateTotal()}</span>
            </div>
          </div>
        )}
      </CardContent>
      
      <CardFooter>
        <Button 
          className="w-full" 
          disabled={!selectedRange}
          onClick={() => selectedRange && onDateSelect(selectedRange.start, selectedRange.end)}
        >
          Request Booking
        </Button>
      </CardFooter>
    </Card>
  )
}
```

#### BookingStatusCard Component
```typescript
interface BookingStatusCardProps {
  booking: {
    id: string
    tool_title: string
    tool_image_url?: string
    start_date: string
    end_date: string
    status: BookingStatus
    total_cost: number
    owner_name?: string
    borrower_name?: string
  }
  userRole: 'owner' | 'borrower'
  onStatusChange?: (bookingId: string, newStatus: BookingStatus) => void
}

const BookingStatusCard = ({ booking, userRole, onStatusChange }: BookingStatusCardProps) => {
  const getStatusColor = (status: BookingStatus) => {
    const colors = {
      'pending': 'bg-yellow-100 text-yellow-800',
      'confirmed': 'bg-blue-100 text-blue-800',
      'active': 'bg-green-100 text-green-800',
      'completed': 'bg-gray-100 text-gray-800',
      'cancelled': 'bg-red-100 text-red-800'
    }
    return colors[status] || 'bg-gray-100 text-gray-800'
  }

  const getAvailableActions = () => {
    if (userRole === 'owner') {
      switch (booking.status) {
        case 'pending':
          return ['confirm', 'decline']
        case 'confirmed':
          return ['start']
        case 'active':
          return ['complete']
        default:
          return []
      }
    } else {
      switch (booking.status) {
        case 'pending':
        case 'confirmed':
          return ['cancel']
        default:
          return []
      }
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start space-x-4">
          <div className="relative w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
            <Image
              src={booking.tool_image_url || '/images/tool-placeholder.jpg'}
              alt={booking.tool_title}
              fill
              className="object-cover"
            />
          </div>
          
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold">{booking.tool_title}</h3>
                <p className="text-sm text-muted-foreground">
                  {userRole === 'owner' ? `Rented to ${booking.borrower_name}` : `From ${booking.owner_name}`}
                </p>
              </div>
              <Badge className={getStatusColor(booking.status)}>
                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
              </Badge>
            </div>
            
            <div className="flex items-center space-x-4 text-sm text-muted-foreground">
              <div className="flex items-center space-x-1">
                <Calendar className="h-4 w-4" />
                <span>{format(new Date(booking.start_date), 'MMM dd')} - {format(new Date(booking.end_date), 'MMM dd')}</span>
              </div>
              <div className="flex items-center space-x-1">
                <DollarSign className="h-4 w-4" />
                <span>${booking.total_cost}</span>
              </div>
            </div>
            
            {getAvailableActions().length > 0 && (
              <div className="flex space-x-2 pt-2">
                {getAvailableActions().map(action => (
                  <Button
                    key={action}
                    size="sm"
                    variant={action === 'decline' || action === 'cancel' ? 'destructive' : 'default'}
                    onClick={() => onStatusChange?.(booking.id, action as BookingStatus)}
                  >
                    {action.charAt(0).toUpperCase() + action.slice(1)}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
```

### 4. Review Components

#### StarRating Component
```typescript
interface StarRatingProps {
  value: number
  onChange?: (value: number) => void
  size?: 'sm' | 'md' | 'lg'
  readonly?: boolean
}

const StarRating = ({ value, onChange, size = 'md', readonly = false }: StarRatingProps) => {
  const [hoveredStar, setHoveredStar] = useState(0)
  
  const sizes = {
    sm: 'h-4 w-4',
    md: 'h-5 w-5',
    lg: 'h-6 w-6'
  }
  
  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          className={`${readonly ? 'cursor-default' : 'cursor-pointer'} transition-colors`}
          onMouseEnter={() => !readonly && setHoveredStar(star)}
          onMouseLeave={() => !readonly && setHoveredStar(0)}
          onClick={() => !readonly && onChange?.(star)}
          disabled={readonly}
        >
          <Star 
            className={`${sizes[size]} ${
              star <= (hoveredStar || value) 
                ? 'fill-yellow-400 text-yellow-400' 
                : 'text-gray-300'
            }`}
          />
        </button>
      ))}
      {readonly && (
        <span className="text-sm text-muted-foreground ml-2">
          ({value.toFixed(1)})
        </span>
      )}
    </div>
  )
}
```

#### ReviewForm Component
```typescript
interface ReviewFormProps {
  bookingId: string
  type: 'tool' | 'borrower'
  onSubmit: (review: ReviewData) => void
}

const ReviewForm = ({ bookingId, type, onSubmit }: ReviewFormProps) => {
  const form = useForm({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 5,
      comment: ''
    }
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          Leave a Review for {type === 'tool' ? 'this Tool' : 'the Borrower'}
        </CardTitle>
        <CardDescription>
          Help other users by sharing your experience
        </CardDescription>
      </CardHeader>
      
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <CardContent className="space-y-4">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Rating</FormLabel>
                  <FormControl>
                    <StarRating
                      value={field.value}
                      onChange={field.onChange}
                      size="lg"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="comment"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Comment</FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Share your experience..."
                      rows={4}
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Optional: Share specific details about your experience
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
          
          <CardFooter>
            <Button type="submit" className="w-full">
              Submit Review
            </Button>
          </CardFooter>
        </form>
      </Form>
    </Card>
  )
}
```

### 5. Shared Components

#### ImageUpload Component
```typescript
interface ImageUploadProps {
  onUpload: (files: File[]) => void
  maxFiles?: number
  acceptedFileTypes?: string[]
  maxFileSize?: number // in MB
}

const ImageUpload = ({ 
  onUpload, 
  maxFiles = 5, 
  acceptedFileTypes = ['image/jpeg', 'image/png', 'image/webp'],
  maxFileSize = 5 
}: ImageUploadProps) => {
  const [isDragOver, setIsDragOver] = useState(false)
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragOver(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFiles = (files: File[]) => {
    const validFiles = files.filter(file => {
      if (!acceptedFileTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: `${file.name} is not a supported image format`,
          variant: "destructive"
        })
        return false
      }
      
      if (file.size > maxFileSize * 1024 * 1024) {
        toast({
          title: "File too large",
          description: `${file.name} is larger than ${maxFileSize}MB`,
          variant: "destructive"
        })
        return false
      }
      
      return true
    }).slice(0, maxFiles - uploadedFiles.length)
    
    if (validFiles.length > 0) {
      const newFiles = [...uploadedFiles, ...validFiles]
      setUploadedFiles(newFiles)
      onUpload(newFiles)
    }
  }

  return (
    <div className="space-y-4">
      <div
        className={`
          border-2 border-dashed rounded-lg p-8 text-center transition-colors
          ${isDragOver ? 'border-primary bg-primary/5' : 'border-muted-foreground/25'}
          ${uploadedFiles.length >= maxFiles ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
        `}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={acceptedFileTypes.join(',')}
          onChange={(e) => handleFiles(Array.from(e.target.files || []))}
          className="hidden"
          disabled={uploadedFiles.length >= maxFiles}
        />
        
        <ImageIcon className="mx-auto h-12 w-12 text-muted-foreground" />
        <div className="mt-4">
          <p className="text-lg font-medium">
            {uploadedFiles.length >= maxFiles 
              ? `Maximum ${maxFiles} files reached`
              : 'Drag & drop images here, or click to select'
            }
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            PNG, JPG, WebP up to {maxFileSize}MB each
          </p>
        </div>
      </div>
      
      {uploadedFiles.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {uploadedFiles.map((file, index) => (
            <div key={index} className="relative group">
              <div className="aspect-square rounded-lg overflow-hidden bg-muted">
                <img
                  src={URL.createObjectURL(file)}
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                onClick={() => {
                  const newFiles = uploadedFiles.filter((_, i) => i !== index)
                  setUploadedFiles(newFiles)
                  onUpload(newFiles)
                }}
                className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

## Responsive Design Patterns

### Mobile-First Breakpoint Strategy
```css
/* Tailwind CSS breakpoints */
/* Mobile: < 768px (default) */
/* Tablet: sm: 768px */
/* Desktop: lg: 1024px */
/* Large Desktop: xl: 1280px */

/* Component responsive patterns */
.tool-grid {
  @apply grid grid-cols-1 gap-4;
  @apply sm:grid-cols-2 sm:gap-6;
  @apply lg:grid-cols-3;
  @apply xl:grid-cols-4;
}

.booking-layout {
  @apply flex flex-col space-y-4;
  @apply lg:flex-row lg:space-y-0 lg:space-x-6;
}
```

### Accessibility Considerations

#### WCAG Compliance Checklist
```typescript
// Keyboard navigation
const AccessibleButton = ({ children, ...props }) => (
  <Button
    {...props}
    onKeyDown={(e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        props.onClick?.(e)
      }
    }}
  >
    {children}
  </Button>
)

// Screen reader support
const ScreenReaderText = ({ children }) => (
  <span className="sr-only">{children}</span>
)

// Focus management
const FocusableCard = ({ children, ...props }) => (
  <Card
    {...props}
    tabIndex={0}
    className="focus:ring-2 focus:ring-primary focus:ring-offset-2"
  >
    {children}
  </Card>
)
```

## Performance Optimization

### Image Optimization Strategy
```typescript
// Next.js Image component configuration
const OptimizedToolImage = ({ src, alt, priority = false }) => (
  <Image
    src={src}
    alt={alt}
    fill
    className="object-cover"
    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
    priority={priority}
    placeholder="blur"
    blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQ..."
  />
)
```

### Component Lazy Loading
```typescript
// Dynamic imports for code splitting
const BookingCalendar = dynamic(() => import('./BookingCalendar'), {
  loading: () => <div className="h-96 bg-muted animate-pulse rounded-lg" />,
  ssr: false
})

const ReviewForm = dynamic(() => import('./ReviewForm'), {
  loading: () => <Skeleton className="h-64 w-full" />
})
```

## Testing Strategy for Components

### Component Testing Template
```typescript
// ToolCard.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import { ToolCard } from '../ToolCard'

const mockTool = {
  id: '1',
  title: 'Electric Drill',
  description: 'Powerful electric drill',
  image_url: '/drill.jpg',
  daily_rate: 10.00,
  category: 'Power Tools',
  owner_name: 'John Doe',
  owner_rating: 4.5,
  is_available: true
}

describe('ToolCard', () => {
  test('renders tool information correctly', () => {
    render(<ToolCard tool={mockTool} />)
    
    expect(screen.getByText('Electric Drill')).toBeInTheDocument()
    expect(screen.getByText('$10.00/day')).toBeInTheDocument()
    expect(screen.getByText('Power Tools')).toBeInTheDocument()
  })

  test('calls onBook when book button is clicked', () => {
    const onBook = jest.fn()
    render(<ToolCard tool={mockTool} onBook={onBook} />)
    
    fireEvent.click(screen.getByText('Book Tool'))
    expect(onBook).toHaveBeenCalledWith('1')
  })

  test('shows unavailable state correctly', () => {
    const unavailableTool = { ...mockTool, is_available: false }
    render(<ToolCard tool={unavailableTool} />)
    
    expect(screen.getByText('Not Available')).toBeInTheDocument()
    expect(screen.getByText('Unavailable')).toBeInTheDocument()
  })
})
```

## Component Library Integration

### shadcn/ui Components Used
```typescript
// Core components from shadcn/ui
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Calendar } from "@/components/ui/calendar"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Toast, ToastAction } from "@/components/ui/toast"
import { Skeleton } from "@/components/ui/skeleton"
```

### Custom Component Extensions
```typescript
// Extended components built on shadcn/ui base
export { ToolCard } from './tool/ToolCard'
export { ToolSearch } from './tool/ToolSearch'
export { BookingCalendar } from './booking/BookingCalendar'
export { StarRating } from './review/StarRating'
export { ImageUpload } from './shared/ImageUpload'
export { NotificationBell } from './notification/NotificationBell'
```

This component architecture provides a comprehensive foundation for the Wippestoolen frontend, ensuring consistency, accessibility, and maintainability while supporting rapid MVP development.