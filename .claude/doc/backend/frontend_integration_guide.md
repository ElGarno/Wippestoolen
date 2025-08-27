# Frontend Integration Guide - Wippestoolen FastAPI Backend

## Overview

This guide provides comprehensive API integration documentation for completing the missing frontend features in the Wippestoolen tool-sharing platform. The FastAPI backend is running on port 8002 with complete functionality for authentication, tools, bookings, reviews, and notifications.

**Missing Frontend Features:**
- Tool details page with booking integration
- Complete booking flow (request → confirm → active → returned)
- Review system (creation, display, mutual reviews)
- My tools dashboard with management
- My bookings dashboard with status tracking

## 1. API Endpoint Mapping

### 1.1 Authentication Endpoints ✅ (Implemented)
- `POST /api/v1/auth/register` - User registration
- `POST /api/v1/auth/login` - User login (JWT cookies)
- `POST /api/v1/auth/refresh` - Token refresh
- `GET /api/v1/auth/me` - Get current user profile
- `PUT /api/v1/auth/me` - Update user profile
- `POST /api/v1/auth/logout` - User logout
- `POST /api/v1/auth/change-password` - Change password

### 1.2 Tool Management Endpoints ✅ (Implemented)

#### Basic CRUD Operations
```typescript
// Browse all tools with pagination
GET /api/v1/tools?page=1&page_size=20&sort_by=created_at&sort_order=desc

// Get tool details
GET /api/v1/tools/{tool_id}

// Get user's tools
GET /api/v1/tools/my-tools?status=active&page=1&page_size=20

// Create new tool
POST /api/v1/tools

// Update tool
PUT /api/v1/tools/{tool_id}

// Delete tool (soft delete)
DELETE /api/v1/tools/{tool_id}
```

#### Category Operations
```typescript
// Get categories with tool counts
GET /api/v1/tools/categories?active_only=true

// Get tools by category
GET /api/v1/tools/categories/{category_id}/tools?page=1&page_size=20
```

#### **⚠️ MISSING: Search Functionality**
The following endpoint needs to be implemented:
```typescript
// Search tools with filters
GET /api/v1/tools/search?q=drill&category_id=1&min_price=10&max_price=50&location=Berlin&radius_km=10&available_from=2024-01-01&available_to=2024-01-07
```

### 1.3 Booking System Endpoints ✅ (Complete Implementation)

#### Core Booking Flow
```typescript
// Create booking request
POST /api/v1/bookings
{
  "tool_id": "uuid",
  "requested_start_date": "2024-01-15",
  "requested_end_date": "2024-01-17",
  "borrower_message": "Need for weekend project",
  "pickup_method": "delivery",
  "pickup_address": "Hauptstraße 1, Berlin"
}

// Get booking details
GET /api/v1/bookings/{booking_id}

// Update booking status (generic)
PATCH /api/v1/bookings/{booking_id}/status
{
  "status": "confirmed",
  "owner_response": "Tool available, please pick up after 9 AM"
}

// List user's bookings with filters
GET /api/v1/bookings?role=borrower&status=pending&page=1&size=20&sort=created_at&order=desc

// Get booking calendar view
GET /api/v1/bookings/calendar?start_date=2024-01-01&end_date=2024-01-31&role=borrower
```

#### Convenience Endpoints for Status Updates
```typescript
// Tool owner confirms booking
POST /api/v1/bookings/{booking_id}/confirm?owner_response=Available%20tomorrow

// Tool owner declines booking
POST /api/v1/bookings/{booking_id}/decline?owner_response=Not%20available%20those%20dates

// Either party cancels booking
POST /api/v1/bookings/{booking_id}/cancel?cancellation_reason=Change%20of%20plans

// Mark tool as picked up (active)
POST /api/v1/bookings/{booking_id}/pickup?pickup_notes=All%20good

// Mark tool as returned
POST /api/v1/bookings/{booking_id}/return?return_notes=Returned%20in%20good%20condition
```

#### Availability Checking
```typescript
// Check tool availability for date range
GET /api/v1/bookings/tools/{tool_id}/availability?start_date=2024-01-15&end_date=2024-01-17
```

### 1.4 Review System Endpoints ✅ (Complete Implementation)

#### Core Review Operations
```typescript
// Create review after booking completion
POST /api/v1/reviews
{
  "booking_id": "uuid",
  "rating": 5,
  "title": "Great tool and owner",
  "comment": "Drill worked perfectly, owner was very helpful",
  "tool_condition_rating": 5  // Only for borrower reviews
}

// Get review details
GET /api/v1/reviews/{review_id}

// Update review (within 48-hour window)
PUT /api/v1/reviews/{review_id}
{
  "rating": 4,
  "comment": "Updated comment"
}

// Delete review (within 48-hour window)
DELETE /api/v1/reviews/{review_id}

// Add response to received review
POST /api/v1/reviews/{review_id}/response
{
  "response_comment": "Thank you for the feedback!"
}

// Flag review for moderation
POST /api/v1/reviews/{review_id}/flag
{
  "reason": "inappropriate",
  "details": "Reason for flagging"
}
```

#### Review Queries
```typescript
// Check review eligibility for booking
GET /api/v1/reviews/bookings/{booking_id}/review-eligibility

// Get all reviews for specific booking
GET /api/v1/reviews/bookings/{booking_id}/reviews

// Get user's reviews (given or received)
GET /api/v1/reviews/users/{user_id}/reviews?as_reviewer=true&page=1&size=20

// Get current user's reviews
GET /api/v1/reviews/my-reviews?as_reviewer=false&rating=5&page=1&size=20

// Get tool reviews and statistics
GET /api/v1/reviews/tools/{tool_id}/reviews?rating=5&size=10

// Get platform review statistics
GET /api/v1/reviews/statistics
```

### 1.5 Notification System Endpoints ✅ (Complete Implementation)

#### Basic Operations
```typescript
// Get user notifications
GET /api/v1/notifications?type=booking_request&status=unread&page=1&size=20

// Get unread count
GET /api/v1/notifications/unread-count

// Mark notification as read
PATCH /api/v1/notifications/{notification_id}/read

// Mark all notifications as read
POST /api/v1/notifications/mark-all-read

// Delete notification
DELETE /api/v1/notifications/{notification_id}
```

#### Preferences and Settings
```typescript
// Get notification preferences
GET /api/v1/notifications/preferences

// Update preferences
PUT /api/v1/notifications/preferences
{
  "email_notifications": true,
  "push_notifications": true,
  "booking_requests": true,
  "booking_updates": true,
  "review_notifications": false
}
```

#### WebSocket Real-time Notifications
```typescript
// WebSocket connection for real-time notifications
WSS /api/v1/notifications/ws/{user_id}
```

## 2. Request/Response Schemas for Critical Flows

### 2.1 Booking Creation Flow

#### Request Schema
```typescript
interface BookingCreateRequest {
  tool_id: string;           // UUID of the tool
  requested_start_date: string;  // YYYY-MM-DD format
  requested_end_date: string;    // YYYY-MM-DD format
  borrower_message?: string;     // Optional message (max 1000 chars)
  pickup_method: 'pickup' | 'delivery';
  pickup_address?: string;       // Required if delivery method
}

// Validation Rules:
// - start_date cannot be in the past
// - start_date cannot be more than 1 year in advance
// - end_date must be after start_date
// - booking period: minimum 1 day, maximum 30 days
// - borrower_message is sanitized (HTML tags removed)
```

#### Response Schema
```typescript
interface BookingCreatedResponse {
  booking: {
    id: string;
    tool: {
      id: string;
      title: string;
      category: string;
      daily_rate: number;
      owner: UserBasic;
    };
    borrower: UserBasic;
    requested_start_date: string;
    requested_end_date: string;
    status: 'pending';
    total_cost: number;
    deposit_amount: number;
    borrower_message?: string;
    pickup_method: string;
    pickup_address?: string;
    created_at: string;
    updated_at: string;
  };
  message: string;
}
```

### 2.2 Booking Status Transitions

#### Valid Status Flow
```
pending → confirmed (owner only)
pending → declined (owner only)
pending → cancelled (borrower only)
confirmed → active (either party)
confirmed → cancelled (either party)
active → returned (either party)
returned → completed (automatic)
```

#### Status Update Request
```typescript
interface BookingStatusUpdateRequest {
  status: 'confirmed' | 'declined' | 'cancelled' | 'active' | 'returned';
  owner_response?: string;      // For confirm/decline actions
  cancellation_reason?: string; // For cancellation
  pickup_notes?: string;        // For pickup action
  return_notes?: string;        // For return action
}
```

### 2.3 Review Submission Flow

#### Create Review Request
```typescript
interface ReviewCreateRequest {
  booking_id: string;              // Must be completed booking
  rating: number;                  // 1-5 stars
  title?: string;                  // Optional title (max 200 chars)
  comment?: string;                // Optional comment (max 2000 chars)
  tool_condition_rating?: number;  // 1-5, borrower reviews only
}

// Business Rules:
// - Reviews can only be created after booking completion
// - 30-day deadline for review submission
// - Each user can only review once per booking
// - Borrowers review tools/owners, owners review borrowers
```

#### Review Response Schema
```typescript
interface ReviewResponse {
  id: string;
  booking: {
    id: string;
    tool_title: string;
    start_date: string;
    end_date: string;
  };
  reviewer: UserBasic;
  reviewee: UserBasic;
  rating: number;
  title?: string;
  comment?: string;
  tool_condition_rating?: number;
  review_type: 'borrower_to_owner' | 'owner_to_borrower';
  response?: {
    comment: string;
    created_at: string;
  };
  created_at: string;
  updated_at: string;
  can_edit: boolean;        // True if within 48-hour edit window
  can_respond: boolean;     // True if user can add response
}
```

## 3. Authentication Requirements

### 3.1 JWT Cookie-Based Authentication ✅ (Implemented)
```typescript
// Authentication headers not needed - cookies used automatically
const apiClient = axios.create({
  baseURL: 'http://localhost:8002',
  withCredentials: true,  // Include cookies in requests
  headers: {
    'Content-Type': 'application/json',
  },
});
```

### 3.2 Protected Endpoints
All endpoints except these require authentication:
- `GET /api/v1/tools` (browse tools)
- `GET /api/v1/tools/{tool_id}` (view tool details)
- `GET /api/v1/tools/categories` (view categories)
- `POST /api/v1/auth/register` (register)
- `POST /api/v1/auth/login` (login)

### 3.3 Authentication Error Handling
```typescript
// 401 Unauthorized - Token expired or invalid
if (error.response?.status === 401) {
  // Try refresh token
  await refreshToken();
  // Retry original request
  return apiClient.request(originalRequest);
}

// 403 Forbidden - Insufficient permissions
if (error.response?.status === 403) {
  // Show permission denied message
  showError('Sie haben nicht die erforderlichen Berechtigungen');
}
```

## 4. Pagination Patterns

### 4.1 Consistent Pagination Schema
```typescript
interface PaginationMeta {
  page: number;           // Current page (1-based)
  per_page: number;      // Items per page
  total_items: number;   // Total items available
  total_pages: number;   // Total pages
  has_next: boolean;     // Has next page
  has_previous: boolean; // Has previous page
}

interface PaginatedResponse<T> {
  items: T[];
  pagination: PaginationMeta;
}
```

### 4.2 Query Parameters
```typescript
// Standard pagination parameters across all list endpoints
interface PaginationParams {
  page?: number;         // Default: 1
  size?: number;         // Default: 20, max: 100
  sort?: string;         // Field to sort by
  order?: 'asc' | 'desc'; // Sort order, default: 'desc'
}

// Usage examples:
// GET /api/v1/tools?page=2&size=10&sort=daily_rate&order=asc
// GET /api/v1/bookings?page=1&size=20&sort=created_at&order=desc
// GET /api/v1/reviews/my-reviews?page=3&size=5&sort=rating&order=desc
```

## 5. Error Handling Patterns

### 5.1 HTTP Status Codes
```typescript
// Success responses
200 // GET requests - success
201 // POST requests - created
204 // DELETE requests - no content

// Client errors
400 // Bad request - validation errors
401 // Unauthorized - authentication required
403 // Forbidden - insufficient permissions
404 // Not found - resource doesn't exist
409 // Conflict - resource conflict (e.g., booking conflict)
422 // Unprocessable Entity - validation errors
429 // Too many requests - rate limit exceeded

// Server errors
500 // Internal server error
```

### 5.2 Error Response Schema
```typescript
interface ErrorResponse {
  detail: string | string[] | object; // Error message(s)
  code?: string;                      // Error code for programmatic handling
  field?: string;                     // Field causing validation error
}

// Examples:
// 400 Bad Request
{
  "detail": "Start date cannot be in the past"
}

// 422 Validation Error
{
  "detail": [
    {
      "loc": ["body", "requested_start_date"],
      "msg": "Start date cannot be in the past",
      "type": "value_error"
    }
  ]
}
```

### 5.3 German Error Messages for Localization

```typescript
const errorMessages = {
  // Authentication
  'Invalid credentials': 'Ungültige Anmeldedaten',
  'User already exists': 'Benutzer existiert bereits',
  'Authentication required': 'Anmeldung erforderlich',
  
  // Booking errors
  'Tool not available': 'Werkzeug nicht verfügbar',
  'Booking conflict': 'Buchungskonflikt - Werkzeug bereits reserviert',
  'Invalid status transition': 'Ungültiger Statuswechsel',
  'Start date cannot be in the past': 'Startdatum darf nicht in der Vergangenheit liegen',
  'Booking period cannot exceed 30 days': 'Buchungszeitraum darf 30 Tage nicht überschreiten',
  
  // Review errors
  'Review not eligible': 'Bewertung nicht möglich - Buchung muss abgeschlossen sein',
  'Review deadline expired': 'Bewertungsfrist abgelaufen (30 Tage nach Buchungsende)',
  'Duplicate review': 'Sie haben diese Buchung bereits bewertet',
  
  // Permission errors
  'Can only edit own tools': 'Sie können nur Ihre eigenen Werkzeuge bearbeiten',
  'Can only cancel own bookings': 'Sie können nur Ihre eigenen Buchungen stornieren',
  
  // General validation
  'Field is required': 'Feld ist erforderlich',
  'Invalid email format': 'Ungültiges E-Mail-Format',
  'Password too weak': 'Passwort zu schwach - mindestens 8 Zeichen erforderlich'
};
```

## 6. File Upload Strategy (Currently Missing)

### 6.1 Required Implementation: Tool Image Uploads

The current API lacks file upload endpoints. These need to be added:

```typescript
// Upload tool images (TO BE IMPLEMENTED)
POST /api/v1/tools/{tool_id}/photos
Content-Type: multipart/form-data

// Delete tool image (TO BE IMPLEMENTED)
DELETE /api/v1/tools/{tool_id}/photos/{photo_id}

// Reorder tool images (TO BE IMPLEMENTED)
PATCH /api/v1/tools/{tool_id}/photos/reorder
{
  "photo_ids": ["uuid1", "uuid2", "uuid3"]
}
```

### 6.2 Frontend Image Upload Implementation

```typescript
// Tool image upload component
const uploadToolImage = async (toolId: string, file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);
  
  const response = await apiClient.post(
    `/api/v1/tools/${toolId}/photos`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  
  return response.data.photo_url;
};

// Image validation
const validateImage = (file: File): string | null => {
  const maxSize = 5 * 1024 * 1024; // 5MB
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  
  if (file.size > maxSize) {
    return 'Bild zu groß - maximum 5MB erlaubt';
  }
  
  if (!allowedTypes.includes(file.type)) {
    return 'Ungültiges Bildformat - nur JPEG, PNG und WebP erlaubt';
  }
  
  return null; // Valid
};
```

### 6.3 S3 Integration Pattern (Backend Implementation Needed)
```python
# Backend implementation needed for S3 uploads
# Current infrastructure supports S3, but upload endpoints missing

@router.post("/{tool_id}/photos")
async def upload_tool_photo(
    tool_id: UUID,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db),
):
    # Validate file type and size
    # Upload to S3
    # Save photo record to database
    # Return photo URL
    pass
```

## 7. WebSocket Integration Points

### 7.1 Real-time Notifications ✅ (Implemented)

```typescript
// WebSocket connection for real-time notifications
const connectNotificationWebSocket = (userId: string): WebSocket => {
  const ws = new WebSocket(`ws://localhost:8002/api/v1/notifications/ws/${userId}`);
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    
    switch (data.type) {
      case 'notification':
        // New notification received
        showNotification(data.notification);
        updateNotificationBadge(data.unread_count);
        break;
        
      case 'unread_count':
        // Unread count update
        updateNotificationBadge(data.count);
        break;
        
      case 'connection_status':
        // Connection status update
        setConnectionStatus(data.status);
        break;
    }
  };
  
  return ws;
};
```

### 7.2 WebSocket Message Types
```typescript
interface NotificationWebSocketMessage {
  type: 'notification';
  notification: {
    id: string;
    title: string;
    message: string;
    notification_type: string;
    created_at: string;
    data?: object;
  };
  unread_count: number;
}

interface UnreadCountWebSocketMessage {
  type: 'unread_count';
  count: number;
}

interface ConnectionStatusMessage {
  type: 'connection_status';
  status: 'connected' | 'disconnected' | 'reconnecting';
}
```

## 8. API Optimization Suggestions

### 8.1 Frontend Performance Optimizations

```typescript
// Use SWR for intelligent caching and data synchronization
import useSWR from 'swr';

const useToolDetails = (toolId: string) => {
  const { data, error, mutate } = useSWR(
    `/api/v1/tools/${toolId}`,
    fetcher,
    {
      revalidateOnFocus: false,
      dedupingInterval: 60000, // 1 minute deduplication
    }
  );
  
  return {
    tool: data,
    loading: !error && !data,
    error,
    refresh: mutate,
  };
};

// Optimistic updates for better UX
const updateBookingStatus = async (bookingId: string, status: string) => {
  // Optimistically update UI
  mutate(
    `/api/v1/bookings/${bookingId}`,
    { ...currentBooking, status },
    false // Don't revalidate
  );
  
  try {
    const result = await apiClient.patch(`/api/v1/bookings/${bookingId}/status`, {
      status
    });
    
    // Update cache with actual response
    mutate(`/api/v1/bookings/${bookingId}`, result.data.booking);
  } catch (error) {
    // Revert optimistic update
    mutate(`/api/v1/bookings/${bookingId}`);
    throw error;
  }
};
```

### 8.2 Batch Operations for Better Performance

```typescript
// Batch mark notifications as read
const markMultipleAsRead = async (notificationIds: string[]) => {
  if (notificationIds.length === 0) return;
  
  // If marking all as read
  if (notificationIds.length > 10) {
    return apiClient.post('/api/v1/notifications/mark-all-read');
  }
  
  // Otherwise, batch individual requests
  const promises = notificationIds.map(id =>
    apiClient.patch(`/api/v1/notifications/${id}/read`)
  );
  
  return Promise.all(promises);
};
```

### 8.3 Image Loading Optimization

```typescript
// Lazy loading with Next.js Image component
import Image from 'next/image';

const ToolImage = ({ src, alt, ...props }) => (
  <Image
    src={src}
    alt={alt}
    loading="lazy"
    placeholder="blur"
    blurDataURL="data:image/jpeg;base64,..." // Low-quality placeholder
    {...props}
  />
);

// Progressive image loading
const useProgressiveImage = (src: string) => {
  const [imgSrc, setImgSrc] = useState(lowQualityPlaceholder);
  
  useEffect(() => {
    const img = new window.Image();
    img.src = src;
    img.onload = () => setImgSrc(src);
  }, [src]);
  
  return imgSrc;
};
```

## 9. Missing Endpoints Analysis

### 9.1 Critical Missing Endpoints

#### Tool Search (High Priority)
```typescript
// MISSING: Advanced tool search
GET /api/v1/tools/search?q=drill&category_id=1&min_price=10&max_price=50&location=Berlin&radius_km=10

interface ToolSearchRequest {
  q?: string;              // Text search query
  category_id?: number;    // Category filter
  min_price?: number;      // Minimum daily rate
  max_price?: number;      // Maximum daily rate
  location?: string;       // Location search
  radius_km?: number;      // Search radius
  available_from?: string; // Availability start date
  available_to?: string;   // Availability end date
  sort_by?: string;        // Sort field
  sort_order?: string;     // Sort order
  page?: number;           // Pagination
  size?: number;           // Page size
}
```

#### Image Upload Endpoints (High Priority)
```typescript
// MISSING: File upload for tool images
POST /api/v1/tools/{tool_id}/photos
DELETE /api/v1/tools/{tool_id}/photos/{photo_id}
PATCH /api/v1/tools/{tool_id}/photos/reorder

// MISSING: User avatar upload
POST /api/v1/auth/avatar
DELETE /api/v1/auth/avatar
```

#### Dashboard Statistics (Medium Priority)
```typescript
// MISSING: User dashboard statistics
GET /api/v1/users/dashboard-stats
{
  "active_bookings": 3,
  "pending_requests": 2,
  "total_earnings": 150.00,
  "tools_rented": 12,
  "average_rating": 4.8,
  "pending_reviews": 1
}

// MISSING: Tool performance analytics
GET /api/v1/tools/{tool_id}/analytics
{
  "total_bookings": 25,
  "total_revenue": 750.00,
  "booking_rate": 0.75,
  "average_booking_duration": 3.2,
  "monthly_trends": [...],
  "popular_months": [...]
}
```

### 9.2 Nice-to-Have Endpoints (Lower Priority)

```typescript
// Tool favorites/watchlist
POST /api/v1/tools/{tool_id}/favorite
DELETE /api/v1/tools/{tool_id}/favorite
GET /api/v1/tools/favorites

// Message system between users
GET /api/v1/messages/conversations
GET /api/v1/messages/conversations/{user_id}
POST /api/v1/messages

// Admin endpoints
GET /api/v1/admin/users
GET /api/v1/admin/bookings
GET /api/v1/admin/reports
```

## 10. Implementation Priorities for Frontend

### Phase 1: Core Booking Flow (Week 1-2)
1. **Tool Details Page with Booking**
   - Tool detail view with image gallery
   - Availability calendar integration
   - Booking request form with validation
   - Owner contact information display

2. **Booking Status Management**
   - Booking detail pages for borrowers/owners
   - Status transition buttons (confirm/decline/cancel)
   - Real-time status updates via WebSocket

### Phase 2: Review System (Week 3)
1. **Review Creation**
   - Review eligibility checking
   - Review form with rating stars
   - Tool condition rating for borrowers
   - 30-day deadline enforcement

2. **Review Display**
   - Review lists with pagination
   - Review responses and moderation
   - Tool review summaries
   - User review profiles

### Phase 3: User Dashboards (Week 4)
1. **My Tools Dashboard**
   - Tool list with statistics
   - Booking requests management
   - Tool performance analytics
   - Quick actions (edit/deactivate)

2. **My Bookings Dashboard**
   - Booking history with filters
   - Calendar view integration
   - Action buttons for each status
   - Review reminders

### Phase 4: Enhanced Features (Week 5-6)
1. **Search Implementation** (Backend + Frontend)
   - Advanced search API endpoint
   - Filter UI with price/location/availability
   - Search result optimization
   - Search history and suggestions

2. **Image Upload** (Backend + Frontend)
   - Tool photo upload with S3 integration
   - Image optimization and validation
   - Drag-and-drop interface
   - Photo reordering

## 11. Testing Strategy

### 11.1 API Integration Testing
```typescript
// Test booking flow
describe('Booking Flow', () => {
  test('should create booking request', async () => {
    const bookingData = {
      tool_id: 'test-tool-id',
      requested_start_date: '2024-02-01',
      requested_end_date: '2024-02-03',
      pickup_method: 'pickup'
    };
    
    const response = await apiClient.post('/api/v1/bookings', bookingData);
    expect(response.status).toBe(201);
    expect(response.data.booking.status).toBe('pending');
  });
  
  test('should handle booking conflicts', async () => {
    // Test conflicting date ranges
    await expect(
      apiClient.post('/api/v1/bookings', conflictingBookingData)
    ).rejects.toHaveProperty('response.status', 409);
  });
});
```

### 11.2 Error Handling Testing
```typescript
// Test error scenarios
describe('Error Handling', () => {
  test('should handle authentication errors', async () => {
    // Remove auth cookies
    apiClient.defaults.headers.common = {};
    
    await expect(
      apiClient.get('/api/v1/bookings')
    ).rejects.toHaveProperty('response.status', 401);
  });
  
  test('should validate booking dates', async () => {
    const invalidBooking = {
      requested_start_date: '2023-01-01', // Past date
      requested_end_date: '2023-01-02'
    };
    
    await expect(
      apiClient.post('/api/v1/bookings', invalidBooking)
    ).rejects.toHaveProperty('response.status', 400);
  });
});
```

## 12. German Localization Patterns

### 12.1 Date and Time Formatting
```typescript
const formatGermanDate = (date: string): string => {
  return new Date(date).toLocaleDateString('de-DE', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const formatGermanCurrency = (amount: number): string => {
  return new Intl.NumberFormat('de-DE', {
    style: 'currency',
    currency: 'EUR'
  }).format(amount);
};
```

### 12.2 Booking Status Labels
```typescript
const bookingStatusLabels = {
  pending: 'Ausstehend',
  confirmed: 'Bestätigt', 
  declined: 'Abgelehnt',
  cancelled: 'Storniert',
  active: 'Aktiv',
  returned: 'Zurückgegeben',
  completed: 'Abgeschlossen'
};

const bookingStatusDescriptions = {
  pending: 'Wartet auf Bestätigung des Eigentümers',
  confirmed: 'Buchung wurde bestätigt - bereit zur Abholung',
  active: 'Werkzeug wurde abgeholt und ist im Gebrauch',
  returned: 'Werkzeug wurde zurückgegeben - bereit für Bewertung'
};
```

## Conclusion

The FastAPI backend provides a robust foundation with complete CRUD operations for all core features. The main gaps requiring immediate attention are:

1. **Tool search functionality** - Critical for user experience
2. **File upload system** - Essential for tool images and user avatars
3. **Frontend integration** - Complete the missing UI components using this API documentation

The existing WebSocket integration, comprehensive error handling, and pagination patterns provide excellent building blocks for a polished frontend implementation. The API design follows REST principles and provides consistent response formats that will integrate smoothly with the Next.js frontend.

This documentation should serve as the definitive guide for completing the frontend implementation and addressing any missing backend functionality.