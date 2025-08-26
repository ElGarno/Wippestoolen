# Frontend Architecture Documentation
## Wippestoolen Tool-Sharing Platform

**Version**: 1.0  
**Date**: 2025-08-25  
**Status**: Architecture Design  

---

## Executive Summary

This document defines the comprehensive frontend architecture for the Wippestoolen tool-sharing platform. The architecture supports rapid MVP development while maintaining scalability from 10 to 10,000+ users within a <$40/month budget constraint.

**Technology Stack**:
- Next.js 14 with React 18 and TypeScript
- Tailwind CSS + shadcn/ui components
- Zustand for state management + SWR for data fetching
- JWT authentication with automatic refresh
- WebSocket integration for real-time features
- Progressive Web App (PWA) capabilities

---

## 1. Architecture Patterns

### 1.1 Client-Server Communication Patterns

#### REST API Integration
```typescript
// API client configuration with automatic retry and error handling
export const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for JWT token attachment
apiClient.interceptors.request.use(
  (config) => {
    const token = getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);

// Response interceptor for token refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      const newToken = await refreshToken();
      if (newToken) {
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return apiClient.request(error.config);
      }
    }
    return Promise.reject(error);
  }
);
```

#### WebSocket Integration Pattern
```typescript
// WebSocket connection manager for real-time notifications
class WebSocketManager {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: string) {
    const token = getAccessToken();
    this.ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/notifications/${userId}?token=${token}`
    );

    this.ws.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      notificationStore.addNotification(notification);
    };

    this.ws.onclose = () => this.handleReconnect();
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        this.reconnectAttempts++;
        this.connect();
      }, Math.pow(2, this.reconnectAttempts) * 1000);
    }
  }
}
```

#### Server-Sent Events (SSE) Fallback
```typescript
// SSE implementation for browsers without WebSocket support
export const useSSENotifications = (userId: string) => {
  useEffect(() => {
    const eventSource = new EventSource(
      `${process.env.NEXT_PUBLIC_API_URL}/notifications/stream/${userId}`
    );

    eventSource.onmessage = (event) => {
      const notification = JSON.parse(event.data);
      notificationStore.addNotification(notification);
    };

    return () => eventSource.close();
  }, [userId]);
};
```

### 1.2 Authentication Architecture

#### JWT Token Management Strategy
```typescript
// Secure token storage using httpOnly cookies (recommended)
export class AuthTokenManager {
  private static readonly ACCESS_TOKEN_KEY = 'access_token';
  private static readonly REFRESH_TOKEN_KEY = 'refresh_token';

  static setTokens(accessToken: string, refreshToken: string) {
    // Store in httpOnly cookies via API call
    document.cookie = `${this.ACCESS_TOKEN_KEY}=${accessToken}; HttpOnly; Secure; SameSite=Strict`;
    document.cookie = `${this.REFRESH_TOKEN_KEY}=${refreshToken}; HttpOnly; Secure; SameSite=Strict`;
  }

  static async refreshAccessToken(): Promise<string | null> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include', // Include httpOnly cookies
      });
      
      if (response.ok) {
        const { access_token } = await response.json();
        return access_token;
      }
      return null;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return null;
    }
  }
}
```

#### Authentication Context Pattern
```typescript
// Global authentication state management
const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  login: async (credentials) => {
    set({ isLoading: true });
    try {
      const { user, access_token, refresh_token } = await authAPI.login(credentials);
      AuthTokenManager.setTokens(access_token, refresh_token);
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  logout: async () => {
    await authAPI.logout();
    AuthTokenManager.clearTokens();
    set({ user: null, isAuthenticated: false });
  },

  checkAuth: async () => {
    try {
      const user = await authAPI.getProfile();
      set({ user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      set({ isAuthenticated: false, isLoading: false });
    }
  },
}));
```

### 1.3 State Synchronization Patterns

#### Optimistic UI Updates
```typescript
// Optimistic booking confirmation with rollback
export const useBookingActions = () => {
  const { mutate } = useSWR('/bookings/my-bookings');

  const confirmBooking = async (bookingId: string) => {
    // Optimistic update
    mutate(
      (bookings) =>
        bookings?.map((booking) =>
          booking.id === bookingId
            ? { ...booking, status: 'CONFIRMED', optimistic: true }
            : booking
        ),
      false // Don't revalidate immediately
    );

    try {
      await bookingAPI.confirm(bookingId);
      // Revalidate to get server state
      mutate();
    } catch (error) {
      // Rollback optimistic update
      mutate();
      throw error;
    }
  };

  return { confirmBooking };
};
```

#### Real-time State Synchronization
```typescript
// WebSocket state synchronization
export const useRealtimeBookings = () => {
  const { mutate } = useSWR('/bookings/my-bookings');

  useEffect(() => {
    const handleBookingUpdate = (event: MessageEvent) => {
      const { type, data } = JSON.parse(event.data);
      
      if (type === 'BOOKING_UPDATE') {
        mutate(
          (bookings) =>
            bookings?.map((booking) =>
              booking.id === data.id ? { ...booking, ...data } : booking
            ),
          false
        );
      }
    };

    websocketManager.addEventListener('message', handleBookingUpdate);
    return () => websocketManager.removeEventListener('message', handleBookingUpdate);
  }, [mutate]);
};
```

### 1.4 Caching Strategies

#### SWR Configuration
```typescript
// Global SWR configuration with caching strategies
export const swrConfig: SWRConfiguration = {
  fetcher: (url: string) => apiClient.get(url).then(res => res.data),
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 60000, // 1 minute
  errorRetryCount: 3,
  errorRetryInterval: 5000,
  
  // Cache strategies by data type
  fallback: {
    '/tools/categories': [], // Static data cached indefinitely
  },
  
  // Conditional revalidation
  revalidateIfStale: (key) => {
    if (key.includes('/bookings/')) return true; // Always fresh booking data
    if (key.includes('/notifications/')) return true; // Fresh notifications
    if (key.includes('/tools/categories')) return false; // Static categories
    return true;
  },
};
```

#### Browser Cache Integration
```typescript
// Service worker cache configuration
const CACHE_STRATEGIES = {
  static: {
    strategy: 'CacheFirst',
    cacheName: 'static-resources',
    expiration: { maxAgeSeconds: 60 * 60 * 24 * 30 }, // 30 days
  },
  api: {
    strategy: 'NetworkFirst',
    cacheName: 'api-cache',
    expiration: { maxAgeSeconds: 60 * 5 }, // 5 minutes
  },
  images: {
    strategy: 'CacheFirst',
    cacheName: 'images',
    expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 * 7 }, // 7 days
  },
};
```

### 1.5 Error Boundary Architecture

#### Global Error Boundary
```typescript
// React Error Boundary with automatic recovery
export class GlobalErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log to monitoring service
    logger.error('Global error caught', { error, errorInfo });
    
    this.setState({ errorInfo });
  }

  retry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          retry={this.retry}
          severity={this.getSeverity(this.state.error)}
        />
      );
    }

    return this.props.children;
  }
}
```

#### API Error Handling
```typescript
// Centralized API error handling
export const useApiErrorHandler = () => {
  const showToast = useToast();
  const router = useRouter();

  const handleError = useCallback((error: ApiError) => {
    switch (error.status) {
      case 401:
        // Redirect to login
        router.push('/login');
        break;
      case 403:
        showToast.error('You do not have permission to perform this action');
        break;
      case 422:
        // Handle validation errors
        return error.details; // Return for form handling
      case 500:
        showToast.error('Something went wrong. Please try again later');
        break;
      default:
        showToast.error(error.message || 'An unexpected error occurred');
    }
  }, [showToast, router]);

  return { handleError };
};
```

### 1.6 Progressive Web App (PWA) Architecture

#### Service Worker Registration
```typescript
// PWA service worker with offline capabilities
export const registerServiceWorker = () => {
  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', async () => {
      try {
        const registration = await navigator.serviceWorker.register('/sw.js');
        
        registration.addEventListener('updatefound', () => {
          // Notify user of app update
          showUpdateAvailableNotification();
        });
      } catch (error) {
        console.error('SW registration failed:', error);
      }
    });
  }
};
```

#### Offline Data Synchronization
```typescript
// Background sync for offline actions
export const useOfflineSync = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingActions, setPendingActions] = useState<PendingAction[]>([]);

  useEffect(() => {
    const handleOnline = async () => {
      setIsOnline(true);
      // Sync pending actions when back online
      await syncPendingActions(pendingActions);
      setPendingActions([]);
    };

    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pendingActions]);

  const queueAction = (action: PendingAction) => {
    if (!isOnline) {
      setPendingActions(prev => [...prev, action]);
      return;
    }
    return executeAction(action);
  };

  return { isOnline, queueAction };
};
```

---

## 2. Data Flow Architecture

### 2.1 Unidirectional Data Flow

#### Zustand Store Architecture
```typescript
// Centralized store with slices pattern
interface AppState {
  auth: AuthSlice;
  tools: ToolsSlice;
  bookings: BookingsSlice;
  notifications: NotificationsSlice;
}

const useAppStore = create<AppState>()(
  devtools(
    subscribeWithSelector(
      immer((set, get) => ({
        auth: createAuthSlice(set, get),
        tools: createToolsSlice(set, get),
        bookings: createBookingsSlice(set, get),
        notifications: createNotificationsSlice(set, get),
      }))
    )
  )
);

// Individual slice with actions
const createBookingsSlice: StateCreator<AppState, [], [], BookingsSlice> = (
  set,
  get
) => ({
  bookings: [],
  loading: false,
  
  fetchBookings: async () => {
    set((state) => {
      state.bookings.loading = true;
    });
    
    try {
      const bookings = await bookingAPI.getMyBookings();
      set((state) => {
        state.bookings.bookings = bookings;
        state.bookings.loading = false;
      });
    } catch (error) {
      set((state) => {
        state.bookings.loading = false;
      });
      throw error;
    }
  },
});
```

### 2.2 Optimistic UI Updates

#### Booking Flow Optimistic Updates
```typescript
// Optimistic booking request with conflict resolution
export const useOptimisticBooking = () => {
  const { bookings, updateBooking } = useBookingsStore();
  const { mutate } = useSWR('/bookings/my-bookings');

  const requestBooking = async (toolId: string, dates: DateRange) => {
    const optimisticBooking: Booking = {
      id: `temp-${Date.now()}`,
      tool_id: toolId,
      start_date: dates.start,
      end_date: dates.end,
      status: 'PENDING',
      optimistic: true,
    };

    // Immediate UI update
    updateBooking(optimisticBooking);

    try {
      const actualBooking = await bookingAPI.create({
        tool_id: toolId,
        start_date: dates.start,
        end_date: dates.end,
      });

      // Replace optimistic booking with real data
      updateBooking(actualBooking);
      mutate(); // Revalidate server state
      
      return actualBooking;
    } catch (error) {
      // Remove optimistic booking on error
      removeOptimisticBooking(optimisticBooking.id);
      throw error;
    }
  };

  return { requestBooking };
};
```

### 2.3 Real-time Notification Architecture

#### WebSocket Event Processing
```typescript
// Notification event processor with type safety
type NotificationEvent = 
  | { type: 'BOOKING_REQUEST'; data: BookingRequest }
  | { type: 'BOOKING_CONFIRMED'; data: BookingConfirmation }
  | { type: 'REVIEW_RECEIVED'; data: ReviewReceived }
  | { type: 'MESSAGE_RECEIVED'; data: Message };

export const notificationProcessor = {
  process: (event: NotificationEvent) => {
    switch (event.type) {
      case 'BOOKING_REQUEST':
        notificationStore.addNotification({
          id: generateId(),
          type: 'booking_request',
          title: 'New Booking Request',
          message: `${event.data.requester_name} wants to borrow ${event.data.tool_name}`,
          data: event.data,
          created_at: new Date().toISOString(),
        });
        
        // Update booking count in real-time
        bookingStore.incrementPendingCount();
        break;
        
      case 'BOOKING_CONFIRMED':
        showToast.success('Your booking request was approved!');
        bookingStore.updateBookingStatus(event.data.booking_id, 'CONFIRMED');
        break;
        
      // Handle other notification types...
    }
  },
};
```

### 2.4 Offline-First Data Sync

#### Offline Queue Management
```typescript
// Offline action queue with conflict resolution
interface OfflineAction {
  id: string;
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  resource: string;
  data: any;
  timestamp: number;
  retries: number;
}

export const useOfflineQueue = () => {
  const [queue, setQueue] = useState<OfflineAction[]>([]);
  const { isOnline } = useNetworkStatus();

  const queueAction = (action: Omit<OfflineAction, 'id' | 'retries' | 'timestamp'>) => {
    const queuedAction: OfflineAction = {
      ...action,
      id: generateId(),
      timestamp: Date.now(),
      retries: 0,
    };

    setQueue(prev => [...prev, queuedAction]);
    
    // Store in IndexedDB for persistence
    indexedDBStore.add('offline_queue', queuedAction);
  };

  const processQueue = async () => {
    if (!isOnline || queue.length === 0) return;

    const processedActions: string[] = [];

    for (const action of queue) {
      try {
        await executeOfflineAction(action);
        processedActions.push(action.id);
      } catch (error) {
        if (action.retries < 3) {
          // Retry with exponential backoff
          setTimeout(() => {
            action.retries++;
            processQueue();
          }, Math.pow(2, action.retries) * 1000);
        } else {
          // Max retries reached, show user notification
          showToast.error(`Failed to sync ${action.type.toLowerCase()} action`);
          processedActions.push(action.id);
        }
      }
    }

    // Remove processed actions
    setQueue(prev => prev.filter(action => !processedActions.includes(action.id)));
  };

  useEffect(() => {
    if (isOnline) {
      processQueue();
    }
  }, [isOnline]);

  return { queueAction, queueLength: queue.length };
};
```

### 2.5 Image Upload Pipeline

#### Multi-step Upload Process
```typescript
// Progressive image upload with optimization
export const useImageUpload = () => {
  const [uploads, setUploads] = useState<Map<string, UploadProgress>>(new Map());

  const uploadImage = async (file: File, context: 'tool' | 'profile') => {
    const uploadId = generateId();
    const maxSize = context === 'tool' ? 2048 : 512; // pixels

    // Initialize upload tracking
    setUploads(prev => new Map(prev).set(uploadId, {
      file: file.name,
      progress: 0,
      stage: 'processing',
    }));

    try {
      // Stage 1: Client-side optimization
      const optimizedFile = await optimizeImage(file, {
        maxWidth: maxSize,
        maxHeight: maxSize,
        quality: 0.85,
        format: 'webp',
      });

      updateUploadProgress(uploadId, 25, 'uploading');

      // Stage 2: Upload to S3 via presigned URL
      const { upload_url, asset_url } = await getPresignedUploadUrl({
        filename: optimizedFile.name,
        content_type: optimizedFile.type,
        context,
      });

      await uploadToS3(upload_url, optimizedFile, (progress) => {
        updateUploadProgress(uploadId, 25 + (progress * 0.7), 'uploading');
      });

      updateUploadProgress(uploadId, 100, 'complete');

      return asset_url;
    } catch (error) {
      updateUploadProgress(uploadId, 0, 'error');
      throw error;
    } finally {
      // Cleanup after 5 seconds
      setTimeout(() => {
        setUploads(prev => {
          const newMap = new Map(prev);
          newMap.delete(uploadId);
          return newMap;
        });
      }, 5000);
    }
  };

  return { uploadImage, uploads };
};
```

---

## 3. Performance Architecture

### 3.1 Code Splitting Strategies

#### Route-Based Code Splitting
```typescript
// Dynamic imports for route-level splitting
const HomePage = dynamic(() => import('../pages/Home'), {
  loading: () => <PageSkeleton />,
});

const ToolsPage = dynamic(() => import('../pages/Tools'), {
  loading: () => <PageSkeleton />,
});

const BookingsPage = dynamic(() => import('../pages/Bookings'), {
  loading: () => <PageSkeleton />,
  ssr: false, // Client-side only for authenticated routes
});

// App router with lazy loading
export const AppRouter = () => {
  return (
    <Suspense fallback={<GlobalSpinner />}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/tools" element={<ToolsPage />} />
        <Route 
          path="/bookings" 
          element={
            <ProtectedRoute>
              <BookingsPage />
            </ProtectedRoute>
          } 
        />
      </Routes>
    </Suspense>
  );
};
```

#### Component-Level Code Splitting
```typescript
// Heavy components loaded on demand
const MapView = lazy(() => import('../components/MapView'));
const ImageEditor = lazy(() => import('../components/ImageEditor'));
const ReviewForm = lazy(() => import('../components/ReviewForm'));

// Usage with loading states
export const ToolDetailsPage = ({ toolId }: Props) => {
  const [showMap, setShowMap] = useState(false);
  
  return (
    <div>
      <ToolInfo toolId={toolId} />
      
      {showMap && (
        <Suspense fallback={<MapSkeleton />}>
          <MapView toolId={toolId} />
        </Suspense>
      )}
      
      <Button onClick={() => setShowMap(true)}>
        Show Location
      </Button>
    </div>
  );
};
```

### 3.2 Lazy Loading Patterns

#### Intersection Observer for Images
```typescript
// Lazy loading image component
export const LazyImage = ({ src, alt, ...props }: ImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInView, setIsInView] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={imgRef} className="relative overflow-hidden">
      {isInView && (
        <>
          <Image
            src={src}
            alt={alt}
            onLoad={() => setIsLoaded(true)}
            className={`transition-opacity duration-300 ${
              isLoaded ? 'opacity-100' : 'opacity-0'
            }`}
            {...props}
          />
          {!isLoaded && <ImageSkeleton />}
        </>
      )}
    </div>
  );
};
```

#### Virtual Scrolling for Large Lists
```typescript
// Virtual scrolling for tool listings
export const VirtualToolList = ({ tools }: Props) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  
  const ITEM_HEIGHT = 200;
  const BUFFER_SIZE = 5;

  useEffect(() => {
    const handleScroll = throttle(() => {
      if (!containerRef.current) return;

      const scrollTop = containerRef.current.scrollTop;
      const containerHeight = containerRef.current.clientHeight;
      
      const start = Math.max(0, Math.floor(scrollTop / ITEM_HEIGHT) - BUFFER_SIZE);
      const end = Math.min(
        tools.length,
        start + Math.ceil(containerHeight / ITEM_HEIGHT) + BUFFER_SIZE * 2
      );
      
      setVisibleRange({ start, end });
    }, 16);

    const container = containerRef.current;
    container?.addEventListener('scroll', handleScroll);
    
    return () => container?.removeEventListener('scroll', handleScroll);
  }, [tools.length]);

  const visibleTools = tools.slice(visibleRange.start, visibleRange.end);

  return (
    <div ref={containerRef} className="h-full overflow-auto">
      {/* Spacer for items above visible range */}
      <div style={{ height: visibleRange.start * ITEM_HEIGHT }} />
      
      {visibleTools.map((tool, index) => (
        <ToolCard
          key={tool.id}
          tool={tool}
          style={{
            height: ITEM_HEIGHT,
            transform: `translateY(${(visibleRange.start + index) * ITEM_HEIGHT}px)`,
          }}
        />
      ))}
      
      {/* Spacer for items below visible range */}
      <div style={{ height: (tools.length - visibleRange.end) * ITEM_HEIGHT }} />
    </div>
  );
};
```

### 3.3 Image Optimization

#### Next.js Image Integration
```typescript
// Optimized image component with automatic format selection
export const OptimizedImage = ({ src, alt, priority = false, ...props }: ImageProps) => {
  return (
    <Image
      src={src}
      alt={alt}
      priority={priority}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD..." // Low-quality placeholder
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      quality={85}
      {...props}
    />
  );
};

// Tool gallery with progressive loading
export const ToolGallery = ({ images }: Props) => {
  const [currentIndex, setCurrentIndex] = useState(0);

  return (
    <div className="relative">
      {/* Main image - high priority */}
      <OptimizedImage
        src={images[currentIndex]}
        alt="Tool image"
        priority={true}
        fill
        className="object-cover"
      />
      
      {/* Thumbnail strip - lazy loaded */}
      <div className="flex gap-2 mt-4">
        {images.map((image, index) => (
          <button
            key={index}
            onClick={() => setCurrentIndex(index)}
            className="relative w-16 h-16"
          >
            <OptimizedImage
              src={image}
              alt={`Tool image ${index + 1}`}
              fill
              sizes="64px"
              className="object-cover rounded"
            />
          </button>
        ))}
      </div>
    </div>
  );
};
```

### 3.4 Bundle Optimization

#### Webpack Bundle Analysis
```typescript
// Dynamic imports for heavy dependencies
const DatePicker = lazy(() => 
  import('react-datepicker').then(module => ({
    default: module.default
  }))
);

const MapLibrary = lazy(() =>
  import('react-leaflet').then(module => ({
    default: module.MapContainer
  }))
);

// Tree shaking optimization
export { Button, Card, Input } from './components/ui'; // Only import used components
```

#### Critical CSS Extraction
```css
/* Critical CSS for above-the-fold content */
@layer critical {
  .hero-section {
    @apply bg-gradient-to-r from-blue-500 to-green-500;
    @apply text-white py-16;
  }
  
  .search-bar {
    @apply w-full max-w-md mx-auto;
    @apply bg-white rounded-lg shadow-md;
  }
}

/* Non-critical CSS loaded asynchronously */
@layer components {
  .tool-card-detailed {
    @apply bg-white rounded-lg shadow-sm border;
    @apply hover:shadow-md transition-shadow;
  }
}
```

### 3.5 Service Worker Caching

#### Cache Strategy Configuration
```typescript
// Service worker with intelligent caching
const CACHE_STRATEGIES = {
  // Static assets - Cache First
  static: {
    urlPattern: /\.(js|css|woff2|png|jpg|svg)$/,
    handler: 'CacheFirst',
    options: {
      cacheName: 'static-assets',
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
      },
    },
  },
  
  // API calls - Network First with cache fallback
  api: {
    urlPattern: /^https:\/\/api\.wippestoolen\.com\//,
    handler: 'NetworkFirst',
    options: {
      cacheName: 'api-cache',
      networkTimeoutSeconds: 3,
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 60 * 5, // 5 minutes
      },
    },
  },
  
  // Images - Stale While Revalidate
  images: {
    urlPattern: /\.(png|jpg|jpeg|webp|avif)$/,
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: 'images',
      expiration: {
        maxEntries: 200,
        maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
      },
    },
  },
};
```

---

## 4. Security Architecture

### 4.1 JWT Token Storage Patterns

#### Secure Token Management
```typescript
// Secure token storage using httpOnly cookies
export class SecureTokenManager {
  private static readonly TOKEN_ENDPOINT = '/api/auth/token';
  
  // Store tokens securely on server-side
  static async setTokens(accessToken: string, refreshToken: string) {
    await fetch('/api/auth/set-tokens', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ accessToken, refreshToken }),
    });
  }
  
  // Get access token through API call (never exposed to client JS)
  static async getAccessToken(): Promise<string | null> {
    try {
      const response = await fetch('/api/auth/access-token', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const { token } = await response.json();
        return token;
      }
      return null;
    } catch {
      return null;
    }
  }
  
  // Automatic token refresh
  static async refreshToken(): Promise<boolean> {
    try {
      const response = await fetch('/api/auth/refresh', {
        method: 'POST',
        credentials: 'include',
      });
      
      return response.ok;
    } catch {
      return false;
    }
  }
}
```

#### API Route Protection
```typescript
// Next.js API middleware for token validation
export async function authMiddleware(
  request: NextRequest,
  context: { params: any }
) {
  const accessToken = request.cookies.get('access_token');
  
  if (!accessToken) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  try {
    const user = await validateToken(accessToken.value);
    
    // Add user to request context
    const response = NextResponse.next();
    response.headers.set('x-user-id', user.id);
    return response;
  } catch (error) {
    return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
  }
}
```

### 4.2 CSRF Protection

#### CSRF Token Implementation
```typescript
// CSRF protection for state-changing operations
export const useCSRFProtection = () => {
  const [csrfToken, setCSRFToken] = useState<string | null>(null);

  useEffect(() => {
    // Fetch CSRF token on app initialization
    fetch('/api/auth/csrf-token', { credentials: 'include' })
      .then(res => res.json())
      .then(data => setCSRFToken(data.token));
  }, []);

  const makeProtectedRequest = async (url: string, options: RequestInit) => {
    const headers = {
      ...options.headers,
      'X-CSRF-Token': csrfToken,
    };

    return fetch(url, {
      ...options,
      headers,
      credentials: 'include',
    });
  };

  return { makeProtectedRequest };
};
```

### 4.3 XSS Prevention

#### Content Sanitization
```typescript
// XSS protection utilities
import DOMPurify from 'dompurify';

export const sanitizeHTML = (dirty: string): string => {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br'],
    ALLOWED_ATTR: [],
  });
};

export const SafeHTML = ({ content }: { content: string }) => {
  const sanitizedContent = useMemo(() => sanitizeHTML(content), [content]);
  
  return (
    <div
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
      className="prose"
    />
  );
};

// Input validation for user content
export const validateUserInput = (input: string): ValidationResult => {
  const errors: string[] = [];
  
  // Check for script tags
  if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(input)) {
    errors.push('Script tags are not allowed');
  }
  
  // Check for iframe tags
  if (/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi.test(input)) {
    errors.push('Iframe tags are not allowed');
  }
  
  // Length validation
  if (input.length > 1000) {
    errors.push('Input too long');
  }
  
  return { isValid: errors.length === 0, errors };
};
```

### 4.4 Content Security Policy

#### CSP Configuration
```typescript
// Next.js CSP configuration
const ContentSecurityPolicy = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline' *.vercel-analytics.com;
  child-src *.youtube.com *.vimeo.com;
  style-src 'self' 'unsafe-inline' *.googleapis.com;
  img-src * blob: data:;
  media-src 'none';
  connect-src *;
  font-src 'self' *.gstatic.com *.googleapis.com;
  frame-src 'self' *.youtube.com *.vimeo.com;
`;

const securityHeaders = [
  {
    key: 'Content-Security-Policy',
    value: ContentSecurityPolicy.replace(/\n/g, ''),
  },
  {
    key: 'Referrer-Policy',
    value: 'origin-when-cross-origin',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-DNS-Prefetch-Control',
    value: 'false',
  },
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=31536000; includeSubDomains; preload',
  },
];

// Next.js config
module.exports = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: securityHeaders,
      },
    ];
  },
};
```

### 4.5 Secure File Upload

#### Upload Security Implementation
```typescript
// Secure file upload with validation
export const useSecureFileUpload = () => {
  const validateFile = (file: File): ValidationResult => {
    const errors: string[] = [];
    
    // File type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      errors.push('Only JPEG, PNG, and WebP images are allowed');
    }
    
    // File size validation (5MB max)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      errors.push('File size must be less than 5MB');
    }
    
    // File name validation
    if (!/^[a-zA-Z0-9._-]+$/.test(file.name)) {
      errors.push('File name contains invalid characters');
    }
    
    return { isValid: errors.length === 0, errors };
  };

  const uploadFile = async (file: File): Promise<string> => {
    const validation = validateFile(file);
    if (!validation.isValid) {
      throw new Error(validation.errors.join(', '));
    }

    // Get presigned upload URL with security checks
    const { uploadUrl, assetUrl } = await getSecureUploadUrl({
      filename: file.name,
      contentType: file.type,
      size: file.size,
    });

    // Upload directly to S3 with virus scanning
    await uploadToS3(uploadUrl, file);

    return assetUrl;
  };

  return { uploadFile, validateFile };
};
```

---

## 5. Deployment Architecture

### 5.1 CI/CD Pipeline Design

#### GitHub Actions Workflow
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Run tests
        run: npm run test:ci
        
      - name: Run E2E tests
        run: npm run test:e2e
        
      - name: Check bundle size
        run: npm run analyze-bundle

  build:
    needs: test
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build application
        run: npm run build
        env:
          NEXT_PUBLIC_API_URL: ${{ secrets.API_URL }}
          NEXT_PUBLIC_WS_URL: ${{ secrets.WS_URL }}
          
      - name: Run security scan
        run: npm audit --audit-level high
        
      - name: Deploy to Vercel
        uses: amondnet/vercel-action@v20
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.ORG_ID }}
          vercel-project-id: ${{ secrets.PROJECT_ID }}
          vercel-args: '--prod'
```

### 5.2 Environment Configuration

#### Multi-Environment Setup
```typescript
// Environment-specific configurations
const config = {
  development: {
    API_URL: 'http://localhost:8002',
    WS_URL: 'ws://localhost:8002',
    ENABLE_ANALYTICS: false,
    LOG_LEVEL: 'debug',
  },
  
  staging: {
    API_URL: 'https://api-staging.wippestoolen.com',
    WS_URL: 'wss://api-staging.wippestoolen.com',
    ENABLE_ANALYTICS: true,
    LOG_LEVEL: 'info',
  },
  
  production: {
    API_URL: 'https://api.wippestoolen.com',
    WS_URL: 'wss://api.wippestoolen.com',
    ENABLE_ANALYTICS: true,
    LOG_LEVEL: 'error',
  },
};

export const getConfig = () => {
  const env = process.env.NODE_ENV || 'development';
  return config[env as keyof typeof config];
};
```

### 5.3 CDN Integration

#### Vercel Edge Network Configuration
```typescript
// next.config.js with optimized asset handling
module.exports = {
  images: {
    domains: ['wippestoolen-assets.s3.amazonaws.com'],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
  
  // Enable experimental features for performance
  experimental: {
    optimizeCss: true,
    optimizeImages: true,
    scrollRestoration: true,
  },
  
  // Compression and caching
  compress: true,
  poweredByHeader: false,
  
  // Custom headers for caching
  async headers() {
    return [
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=31536000, immutable',
          },
        ],
      },
      {
        source: '/api/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store, must-revalidate',
          },
        ],
      },
    ];
  },
};
```

### 5.4 Monitoring and Logging

#### Application Performance Monitoring
```typescript
// Performance monitoring setup
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';

// Custom performance tracking
export const trackPerformance = () => {
  // Core Web Vitals tracking
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      // Log to monitoring service
      analytics.track('performance_metric', {
        name: entry.name,
        value: entry.value,
        rating: entry.rating,
      });
    }
  });

  observer.observe({ entryTypes: ['navigation', 'paint', 'layout-shift'] });
  
  // Custom metrics
  const navigationStart = performance.timeOrigin;
  const loadComplete = performance.now();
  
  analytics.track('page_load_time', {
    duration: loadComplete - navigationStart,
    page: window.location.pathname,
  });
};

// Error boundary with error tracking
export const ErrorTracker = ({ children }: PropsWithChildren) => {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        analytics.track('frontend_error', {
          error: error.message,
          stack: error.stack,
          componentStack: errorInfo.componentStack,
          url: window.location.href,
        });
      }}
    >
      {children}
    </ErrorBoundary>
  );
};
```

### 5.5 A/B Testing Integration

#### Feature Flag Implementation
```typescript
// Feature flag system for A/B testing
export const useFeatureFlag = (flagName: string): boolean => {
  const [isEnabled, setIsEnabled] = useState(false);
  const { user } = useAuthStore();

  useEffect(() => {
    const checkFlag = async () => {
      try {
        const response = await fetch('/api/feature-flags', {
          headers: {
            'X-User-ID': user?.id || '',
          },
        });
        
        const flags = await response.json();
        setIsEnabled(flags[flagName] || false);
      } catch {
        // Default to false if flag service unavailable
        setIsEnabled(false);
      }
    };

    checkFlag();
  }, [flagName, user?.id]);

  return isEnabled;
};

// Usage in components
export const BookingFlow = () => {
  const newBookingFlowEnabled = useFeatureFlag('new_booking_flow_v2');
  
  return newBookingFlowEnabled ? (
    <NewBookingFlowV2 />
  ) : (
    <OriginalBookingFlow />
  );
};
```

---

## 6. Scalability Patterns

### 6.1 Horizontal Scaling Strategies

#### Component Architecture for Scale
```typescript
// Scalable component architecture with micro-frontends approach
export const ModuleRegistry = {
  auth: () => import('./modules/auth'),
  tools: () => import('./modules/tools'),
  bookings: () => import('./modules/bookings'),
  reviews: () => import('./modules/reviews'),
  notifications: () => import('./modules/notifications'),
};

// Dynamic module loading based on user permissions/features
export const DynamicModule = ({ moduleName, ...props }) => {
  const [Module, setModule] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ModuleRegistry[moduleName]()
      .then(module => {
        setModule(() => module.default);
        setLoading(false);
      })
      .catch(error => {
        console.error(`Failed to load module ${moduleName}:`, error);
        setLoading(false);
      });
  }, [moduleName]);

  if (loading) return <ModuleSkeleton />;
  if (!Module) return <ModuleError moduleName={moduleName} />;

  return <Module {...props} />;
};
```

### 6.2 Database Query Optimization

#### Smart Query Patterns
```typescript
// Optimized data fetching with batching and caching
export const useBatchedQueries = () => {
  const batchQueue = useRef<Map<string, QueryBatch>>(new Map());
  const processBatch = useCallback(
    debounce(async () => {
      const batches = Array.from(batchQueue.current.values());
      batchQueue.current.clear();

      const promises = batches.map(async (batch) => {
        try {
          const response = await fetch('/api/batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ queries: batch.queries }),
          });
          
          const results = await response.json();
          batch.resolvers.forEach((resolve, index) => {
            resolve(results[index]);
          });
        } catch (error) {
          batch.resolvers.forEach(resolve => resolve({ error }));
        }
      });

      await Promise.all(promises);
    }, 10),
    []
  );

  const batchQuery = useCallback((query: QueryRequest) => {
    return new Promise((resolve) => {
      const batchId = query.type;
      
      if (!batchQueue.current.has(batchId)) {
        batchQueue.current.set(batchId, {
          queries: [],
          resolvers: [],
        });
      }
      
      const batch = batchQueue.current.get(batchId)!;
      batch.queries.push(query);
      batch.resolvers.push(resolve);
      
      processBatch();
    });
  }, [processBatch]);

  return { batchQuery };
};
```

### 6.3 Asset Optimization and CDN

#### Progressive Asset Loading
```typescript
// Intelligent asset loading based on user context
export const AssetManager = {
  // Preload critical assets based on user flow
  preloadCriticalAssets: (userFlow: UserFlow) => {
    const criticalAssets = getCriticalAssets(userFlow);
    
    criticalAssets.forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.href = asset.url;
      link.as = asset.type;
      if (asset.type === 'image') {
        link.type = asset.mimeType;
      }
      document.head.appendChild(link);
    });
  },

  // Lazy load non-critical assets
  lazyLoadAssets: (assets: Asset[]) => {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => {
        assets.forEach(asset => loadAsset(asset));
      });
    } else {
      setTimeout(() => {
        assets.forEach(asset => loadAsset(asset));
      }, 100);
    }
  },

  // Adaptive image loading based on network conditions
  getOptimalImageSrc: (imageSrc: string, options: ImageOptions) => {
    const connection = (navigator as any).connection;
    
    if (connection && connection.effectiveType === 'slow-2g') {
      return `${imageSrc}?w=${options.width / 2}&q=60`;
    } else if (connection && connection.effectiveType === '2g') {
      return `${imageSrc}?w=${options.width}&q=70`;
    } else {
      return `${imageSrc}?w=${options.width}&q=85`;
    }
  },
};
```

### 6.4 WebSocket Scaling

#### WebSocket Connection Management
```typescript
// Scalable WebSocket connection management
export class ScalableWebSocketManager {
  private connections: Map<string, WebSocket> = new Map();
  private heartbeatInterval: NodeJS.Timer | null = null;
  private reconnectAttempts: Map<string, number> = new Map();

  connect(userId: string, channels: string[]) {
    const connectionKey = `${userId}-${channels.sort().join(',')}`;
    
    if (this.connections.has(connectionKey)) {
      return; // Already connected
    }

    const ws = new WebSocket(
      `${process.env.NEXT_PUBLIC_WS_URL}/connect?user_id=${userId}&channels=${channels.join(',')}`
    );

    ws.onopen = () => {
      this.connections.set(connectionKey, ws);
      this.reconnectAttempts.delete(connectionKey);
      this.startHeartbeat(connectionKey);
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      this.handleMessage(message, userId);
    };

    ws.onclose = () => {
      this.connections.delete(connectionKey);
      this.scheduleReconnect(connectionKey, userId, channels);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };
  }

  private scheduleReconnect(
    connectionKey: string,
    userId: string,
    channels: string[]
  ) {
    const attempts = this.reconnectAttempts.get(connectionKey) || 0;
    
    if (attempts < 5) {
      const delay = Math.min(1000 * Math.pow(2, attempts), 30000);
      
      setTimeout(() => {
        this.reconnectAttempts.set(connectionKey, attempts + 1);
        this.connect(userId, channels);
      }, delay);
    }
  }

  private startHeartbeat(connectionKey: string) {
    this.heartbeatInterval = setInterval(() => {
      const ws = this.connections.get(connectionKey);
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, 30000);
  }

  disconnect(userId: string, channels: string[]) {
    const connectionKey = `${userId}-${channels.sort().join(',')}`;
    const ws = this.connections.get(connectionKey);
    
    if (ws) {
      ws.close();
      this.connections.delete(connectionKey);
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
  }
}
```

### 6.5 Microservices Frontend Architecture

#### Module Federation Setup
```typescript
// Micro-frontend architecture for future scaling
const ModuleFederationConfig = {
  name: 'shell',
  remotes: {
    toolsModule: 'toolsModule@/modules/tools/remoteEntry.js',
    bookingsModule: 'bookingsModule@/modules/bookings/remoteEntry.js',
    reviewsModule: 'reviewsModule@/modules/reviews/remoteEntry.js',
  },
  shared: {
    react: { singleton: true },
    'react-dom': { singleton: true },
    '@wippestoolen/shared': { singleton: true },
  },
};

// Dynamic module loading with error boundaries
export const MicroFrontend = ({ 
  module, 
  props, 
  fallback = <ModuleFallback /> 
}) => {
  const [Component, setComponent] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    import(module)
      .then(mod => setComponent(() => mod.default))
      .catch(err => setError(err));
  }, [module]);

  if (error) {
    return <ErrorBoundary error={error} />;
  }

  if (!Component) {
    return fallback;
  }

  return (
    <Suspense fallback={fallback}>
      <Component {...props} />
    </Suspense>
  );
};
```

---

## Cost Analysis and Optimization

### Development Phase Costs (Months 1-3)
- **Vercel Hobby**: $0/month
- **Development tools**: $0/month (using free tiers)
- **Total**: $0/month

### Production Phase Costs (Months 4-12)
- **Vercel Pro**: $20/month (for custom domains, advanced analytics)
- **CDN & Assets**: ~$5/month (S3 + CloudFront integration)
- **Monitoring**: $0 (using Vercel Analytics free tier)
- **Total Frontend**: $25/month

### Scaling Phase Costs (10,000+ users)
- **Vercel Pro**: $20/month
- **Additional compute**: $50-100/month (serverless function usage)
- **CDN costs**: $20-30/month (higher asset delivery)
- **Total Frontend at Scale**: $90-150/month

## Performance Targets

### Core Web Vitals Targets
- **First Contentful Paint (FCP)**: <1.5s
- **Largest Contentful Paint (LCP)**: <2.5s
- **First Input Delay (FID)**: <100ms
- **Cumulative Layout Shift (CLS)**: <0.1

### Bundle Size Targets
- **Initial bundle**: <250KB gzipped
- **Route chunks**: <150KB gzipped each
- **Third-party scripts**: <100KB total

### Network Performance
- **API response time**: <200ms (95th percentile)
- **WebSocket connection time**: <500ms
- **Image load time**: <1s (lazy loading)

## Implementation Phases

### Phase 1: MVP Frontend (Weeks 1-2)
1. Next.js project setup with TypeScript
2. Basic authentication flows (login/register/profile)
3. Tool listing and search functionality
4. Basic booking flow implementation
5. Core UI components with shadcn/ui

### Phase 2: Real-time Features (Weeks 3-4)
1. WebSocket integration for notifications
2. Real-time booking status updates
3. Review system implementation
4. Image upload and optimization
5. Mobile responsiveness

### Phase 3: Performance & PWA (Weeks 5-6)
1. Service worker implementation
2. Offline capability development
3. Performance optimization and monitoring
4. A/B testing setup
5. Production deployment

## Next Steps

1. **Frontend Implementation**: Start with Next.js setup and basic authentication
2. **Component Library**: Implement shadcn/ui based component system
3. **State Management**: Set up Zustand stores with SWR integration
4. **Real-time Integration**: Connect WebSocket for live notifications
5. **Performance Testing**: Implement monitoring and optimization
6. **Production Deployment**: Deploy to Vercel with CI/CD pipeline

This architecture provides a solid foundation for rapid MVP development while maintaining the ability to scale effectively as the platform grows.