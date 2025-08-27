# 🎯 Wippestoolen Frontend Implementation Plan

## Executive Summary
This document outlines the comprehensive plan for implementing the remaining core features of the Wippestoolen tool-sharing platform frontend. The backend API is fully functional with 40+ endpoints, and the basic frontend structure is in place with authentication and tool browsing working.

## Current Status Analysis

### ✅ Completed Features (Working)
- **Authentication System**: Full login, registration, and profile management
- **Tool Browsing**: Advanced search with filters, pagination, and category selection
- **German Localization**: Consistent German UI throughout the application
- **API Integration**: Secure JWT cookie-based authentication with automatic refresh
- **Responsive Design**: Mobile-first approach with shadcn/ui components
- **Backend API**: Fully functional FastAPI backend with all required endpoints

### ❌ Missing Core Features
1. **Individual Tool Detail Pages** (`/tools/[id]`) - Returns 404
2. **Booking Flow UI** - Calendar, requests, status management
3. **Review System UI** - Rating forms and display
4. **User's "My Tools" Page** - Tool management dashboard
5. **User's "My Bookings" Page** - Booking tracking
6. **Categories Page** - Category overview with counts
7. **Tool Creation/Editing Forms** - Add and modify tools

### 🔧 Technical Issues to Address
- Category names still in English in database
- Frontend routing gaps for missing pages
- Image upload system not yet implemented in backend
- Some API endpoints need frontend integration testing

## Implementation Phases

### Phase 1: Tool Details & Categories (2 Days)

#### 1. Individual Tool Detail Page `/tools/[id]`
**Priority**: CRITICAL - Users can't view tool details

**Implementation Details**:
```typescript
// File: /app/tools/[id]/page.tsx
- Dynamic route with tool ID parameter
- Server-side data fetching for SEO
- Client-side SWR for real-time updates
```

**Features**:
- Image carousel with zoom capability
- Tool specifications and description
- Owner information with rating
- Availability calendar visualization
- Booking request button (conditional)
- Reviews section with pagination
- Similar tools recommendation

**API Endpoints**:
- `GET /api/v1/tools/{tool_id}` - Tool details
- `GET /api/v1/bookings/tools/{tool_id}/availability` - Availability check
- `GET /api/v1/tools/{tool_id}/reviews` - Tool reviews

#### 2. Categories Overview Page `/categories`
**Priority**: HIGH - Improves navigation

**Implementation Details**:
```typescript
// File: /app/categories/page.tsx
- Grid layout with category cards
- Tool count badges
- Category icons and descriptions
```

**Features**:
- Visual category cards with icons
- Tool count per category
- Link to filtered tools page
- Search within categories
- German category names

**API Endpoints**:
- `GET /api/v1/tools/categories` - All categories with counts

### Phase 2: Tool Management (3 Days)

#### 3. My Tools Dashboard `/my-tools`
**Priority**: CRITICAL - Owners need to manage tools

**Implementation Details**:
```typescript
// File: /app/my-tools/page.tsx
- Protected route with auth guard
- Tabbed interface for active/inactive tools
- Real-time booking request notifications
```

**Features**:
- List view with management options
- Edit/Delete actions per tool
- Booking requests badge
- Tool performance statistics
- Quick availability toggle
- Bulk actions support

**API Endpoints**:
- `GET /api/v1/tools/my-tools` - User's tools with pagination
- `DELETE /api/v1/tools/{tool_id}` - Delete tool
- `GET /api/v1/bookings?role=owner&status=pending` - Pending requests

#### 4. Tool Creation Form `/tools/new`
**Priority**: CRITICAL - Users can't add tools

**Implementation Details**:
```typescript
// File: /app/tools/new/page.tsx
- Multi-step form wizard
- React Hook Form + Zod validation
- Auto-save draft feature
```

**Form Steps**:
1. **Basic Information**
   - Title, description, category
   - Brand, model (optional)
   
2. **Images & Media**
   - Drag-and-drop upload
   - Image preview and reorder
   - Alt text for accessibility
   
3. **Pricing & Availability**
   - Daily rate, deposit amount
   - Delivery options and fees
   - Availability calendar setup
   
4. **Location & Pickup**
   - Address or area
   - Pickup instructions
   - Contact preferences

**API Endpoints**:
- `POST /api/v1/tools` - Create tool
- `GET /api/v1/tools/categories` - Category list

#### 5. Tool Edit Form `/tools/[id]/edit`
**Priority**: HIGH - Owners need to update listings

**Implementation Details**:
```typescript
// File: /app/tools/[id]/edit/page.tsx
- Pre-populated form with existing data
- Change tracking with unsaved changes warning
- Optimistic updates with rollback
```

**Features**:
- Same structure as creation form
- Highlight changed fields
- Preview changes before save
- Version history (future)

**API Endpoints**:
- `GET /api/v1/tools/{tool_id}` - Fetch current data
- `PUT /api/v1/tools/{tool_id}` - Update tool

### Phase 3: Booking System (4 Days)

#### 6. Bookings Management Page `/bookings`
**Priority**: CRITICAL - Core transaction feature

**Implementation Details**:
```typescript
// File: /app/bookings/page.tsx
- Dual-role interface (borrower/owner)
- Real-time status updates
- Calendar view option
```

**Features**:
- **As Borrower Tab**:
  - Active bookings with status
  - Booking history
  - Upcoming pickups/returns
  - Cancel/modify options
  
- **As Owner Tab**:
  - Pending requests with actions
  - Active rentals tracking
  - Calendar view of bookings
  - Quick approve/decline

**API Endpoints**:
- `GET /api/v1/bookings?role=borrower` - Borrower bookings
- `GET /api/v1/bookings?role=owner` - Owner bookings
- `GET /api/v1/bookings/calendar` - Calendar view

#### 7. Booking Request Flow
**Priority**: CRITICAL - Users can't book tools

**Components**:
```typescript
// Components in /components/bookings/
- BookingModal.tsx
- DateRangePicker.tsx
- AvailabilityCalendar.tsx
- CostCalculator.tsx
```

**Flow Steps**:
1. **Date Selection**
   - Interactive calendar with availability
   - Blocked dates visualization
   - Minimum/maximum duration enforcement
   
2. **Request Details**
   - Message to owner
   - Pickup/delivery preference
   - Agreement to terms
   
3. **Cost Summary**
   - Daily rate calculation
   - Deposit amount
   - Delivery fees (if applicable)
   - Total cost display

**API Endpoints**:
- `GET /api/v1/bookings/tools/{tool_id}/availability` - Check dates
- `POST /api/v1/bookings` - Create booking request

#### 8. Booking Status Management
**Priority**: HIGH - Transaction lifecycle

**Status Transitions**:
```typescript
// Status-specific action buttons
- Pending → Confirmed/Declined (Owner)
- Confirmed → Cancelled (Both before pickup)
- Confirmed → Active (On pickup)
- Active → Completed (On return)
```

**Components**:
- Status badge with color coding
- Action buttons with confirmations
- Status history timeline
- Notification triggers

**API Endpoints**:
- `POST /api/v1/bookings/{id}/confirm`
- `POST /api/v1/bookings/{id}/decline`
- `POST /api/v1/bookings/{id}/cancel`
- `POST /api/v1/bookings/{id}/pickup`
- `POST /api/v1/bookings/{id}/return`

### Phase 4: Review System (2 Days)

#### 9. Review Submission Flow
**Priority**: MEDIUM - Trust building feature

**Components**:
```typescript
// Components in /components/reviews/
- ReviewModal.tsx
- StarRating.tsx
- ReviewCard.tsx
```

**Review Process**:
1. **Eligibility Check**
   - Only after booking completion
   - Within 30-day window
   - Mutual review system
   
2. **Review Form**
   - 1-5 star rating
   - Comment text (optional)
   - Specific aspects rating
   
3. **Submission**
   - Validation and sanitization
   - Success confirmation
   - Points/badges earned

**API Endpoints**:
- `GET /api/v1/bookings/{id}/review-eligibility` - Check if can review
- `POST /api/v1/reviews` - Submit review
- `GET /api/v1/bookings/{id}/reviews` - Check review status

#### 10. Review Display & Management
**Priority**: MEDIUM - Social proof

**Display Locations**:
- Tool detail pages
- User profiles
- Booking history
- Search results (rating summary)

**Features**:
- Paginated review lists
- Sort by helpful/recent/rating
- Owner response capability
- Report inappropriate content
- Verified booking badge

**API Endpoints**:
- `GET /api/v1/tools/{tool_id}/reviews` - Tool reviews
- `GET /api/v1/users/{user_id}/reviews` - User reviews
- `POST /api/v1/reviews/{id}/response` - Owner response
- `POST /api/v1/reviews/{id}/flag` - Report review

## Technical Implementation Details

### Component Architecture
```
/components/
├── bookings/
│   ├── BookingModal.tsx
│   ├── BookingCard.tsx
│   ├── DateRangePicker.tsx
│   ├── AvailabilityCalendar.tsx
│   └── StatusBadge.tsx
├── reviews/
│   ├── ReviewModal.tsx
│   ├── ReviewCard.tsx
│   ├── StarRating.tsx
│   └── ReviewList.tsx
├── tools/
│   ├── ToolForm.tsx
│   ├── ImageUploader.tsx
│   ├── CategorySelector.tsx
│   └── PriceInput.tsx
└── shared/
    ├── ProtectedRoute.tsx
    ├── LoadingSpinner.tsx
    └── ErrorBoundary.tsx
```

### State Management Strategy

#### Data Fetching with SWR
```typescript
// Consistent SWR patterns
const { data, error, isLoading, mutate } = useSWR(
  `/api/v1/tools/${id}`,
  fetcher,
  {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 2000,
  }
);
```

#### Optimistic Updates
```typescript
// Example for status updates
const updateBookingStatus = async (status) => {
  // Optimistic update
  mutate({ ...data, status }, false);
  
  try {
    await api.updateBookingStatus(id, status);
    // Revalidate
    mutate();
  } catch (error) {
    // Rollback on error
    mutate(data, false);
    toast.error('Update failed');
  }
};
```

### Form Validation with Zod

```typescript
// Example schema for tool creation
const toolSchema = z.object({
  title: z.string()
    .min(5, 'Titel muss mindestens 5 Zeichen lang sein')
    .max(100, 'Titel darf maximal 100 Zeichen lang sein'),
  description: z.string()
    .min(20, 'Beschreibung muss mindestens 20 Zeichen lang sein'),
  category_id: z.string().uuid('Bitte wählen Sie eine Kategorie'),
  daily_rate: z.number()
    .min(0.5, 'Mindestpreis ist €0.50')
    .max(1000, 'Maximalpreis ist €1000'),
  deposit_amount: z.number()
    .min(0, 'Kaution kann nicht negativ sein'),
  is_available: z.boolean(),
  delivery_available: z.boolean(),
  delivery_fee: z.number().optional(),
});
```

### Authentication Guards

```typescript
// Protected route wrapper
export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!isLoading && !user) {
      router.push(`/auth/login?returnUrl=${encodeURIComponent(window.location.pathname)}`);
    }
  }, [user, isLoading, router]);
  
  if (isLoading) return <LoadingSpinner />;
  if (!user) return null;
  
  return <>{children}</>;
}
```

### Error Handling

```typescript
// Centralized error handler
export function handleApiError(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  
  const statusMessages: Record<number, string> = {
    400: 'Ungültige Anfrage. Bitte überprüfen Sie Ihre Eingaben.',
    401: 'Bitte melden Sie sich an, um fortzufahren.',
    403: 'Sie haben keine Berechtigung für diese Aktion.',
    404: 'Die angeforderte Ressource wurde nicht gefunden.',
    409: 'Es besteht ein Konflikt. Möglicherweise existiert dieser Eintrag bereits.',
    500: 'Ein Serverfehler ist aufgetreten. Bitte versuchen Sie es später erneut.',
  };
  
  return statusMessages[error.response?.status] || 'Ein unerwarteter Fehler ist aufgetreten.';
}
```

### Mobile Responsiveness

```typescript
// Mobile-first component example
export function BookingCard({ booking }: { booking: Booking }) {
  return (
    <Card className="w-full">
      {/* Mobile layout (default) */}
      <CardContent className="p-4 space-y-3 md:hidden">
        <div className="flex items-start justify-between">
          <h3 className="font-semibold text-sm">{booking.tool.title}</h3>
          <StatusBadge status={booking.status} size="sm" />
        </div>
        {/* ... mobile layout ... */}
      </CardContent>
      
      {/* Desktop layout */}
      <CardContent className="hidden md:block p-6">
        {/* ... desktop layout ... */}
      </CardContent>
    </Card>
  );
}
```

## Implementation Timeline

### Week 1 (Days 1-5)
- **Day 1-2**: Tool detail page + Categories page
- **Day 3-4**: My Tools dashboard
- **Day 5**: Tool creation form

### Week 2 (Days 6-10)
- **Day 6**: Tool edit form
- **Day 7-8**: Bookings management page
- **Day 9**: Booking request flow
- **Day 10**: Booking status management

### Week 3 (Days 11-14)
- **Day 11**: Review submission flow
- **Day 12**: Review display components
- **Day 13**: Integration testing
- **Day 14**: Bug fixes and polish

## Testing Strategy

### Unit Testing
- Component testing with React Testing Library
- Form validation testing
- API integration mocking

### Integration Testing
- User flow testing (booking complete cycle)
- Authentication flow testing
- Error handling scenarios

### E2E Testing
- Critical user journeys
- Cross-browser testing
- Mobile device testing

## Performance Optimization

### Code Splitting
```typescript
// Lazy load heavy components
const BookingModal = lazy(() => import('@/components/bookings/BookingModal'));
const ImageUploader = lazy(() => import('@/components/tools/ImageUploader'));
```

### Image Optimization
```typescript
// Next.js Image component
<Image
  src={tool.images[0]}
  alt={tool.title}
  width={400}
  height={300}
  loading="lazy"
  placeholder="blur"
  blurDataURL={tool.imagePlaceholder}
/>
```

### Bundle Size Monitoring
- Analyze with next-bundle-analyzer
- Tree-shake unused code
- Optimize dependencies

## Deployment Considerations

### Environment Variables
```bash
NEXT_PUBLIC_API_URL=https://api.wippestoolen.de
NEXT_PUBLIC_WEBSOCKET_URL=wss://api.wippestoolen.de
NEXT_PUBLIC_IMAGE_CDN_URL=https://images.wippestoolen.de
```

### Build Optimization
```javascript
// next.config.js
module.exports = {
  output: 'standalone',
  images: {
    domains: ['images.wippestoolen.de'],
    formats: ['image/avif', 'image/webp'],
  },
  i18n: {
    locales: ['de'],
    defaultLocale: 'de',
  },
};
```

## Risk Mitigation

### Technical Risks
1. **Image Upload**: Backend not implemented
   - **Mitigation**: Use placeholder images initially
   
2. **WebSocket Stability**: Real-time updates may fail
   - **Mitigation**: Fallback to polling

3. **Calendar Complexity**: Availability logic
   - **Mitigation**: Start with simple date picker

### Business Risks
1. **User Adoption**: Complex booking flow
   - **Mitigation**: Progressive disclosure, tooltips
   
2. **Trust Issues**: Review authenticity
   - **Mitigation**: Verified booking badge

## Success Metrics

### Technical KPIs
- Page load time < 2 seconds
- Time to Interactive < 3 seconds
- Error rate < 0.1%
- API response time < 200ms

### Business KPIs
- Booking completion rate > 60%
- Tool creation completion > 70%
- Review submission rate > 40%
- User return rate > 50%

## Conclusion

This implementation plan provides a structured approach to completing the Wippestoolen frontend with all core features. The phased approach ensures critical features are delivered first while maintaining code quality and user experience. The estimated timeline of 14 working days is achievable with focused development effort.

## Appendix

### API Endpoint Reference
Full list of 40+ endpoints available in the FastAPI backend documentation at `/api/v1/docs`

### Design System
Consistent use of shadcn/ui components with German localization

### Accessibility Checklist
- WCAG 2.1 AA compliance
- Keyboard navigation support
- Screen reader compatibility
- Color contrast requirements