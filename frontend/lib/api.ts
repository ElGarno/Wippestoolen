import axios, { AxiosInstance, AxiosResponse, AxiosError } from 'axios'
import Cookies from 'js-cookie'
import DOMPurify from 'dompurify'
import { z } from 'zod'
import { 
  User, 
  Tool, 
  Booking, 
  Review, 
  Notification, 
  LoginRequest, 
  RegisterRequest, 
  TokenResponse, 
  PaginatedResponse,
  PaginationParams,
  ApiError
} from '@/types'

// Input validation schemas
const emailSchema = z.string().email('Invalid email address')
const passwordSchema = z.string().min(8, 'Password must be at least 8 characters')

// CSRF token management
let csrfToken: string | null = null

class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      headers: {
        'Content-Type': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      },
      withCredentials: true, // Enable cookie support
      timeout: 10000, // 10 second timeout
    })

    // Initialize tokens from cookies
    this.initializeFromCookies()

    // Request interceptor for auth and CSRF
    this.client.interceptors.request.use(
      (config) => {
        // Add auth token
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        
        // Add CSRF token for state-changing operations
        if (csrfToken && ['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
          config.headers['X-CSRF-Token'] = csrfToken
        }
        
        // Sanitize request data
        if (config.data && typeof config.data === 'object') {
          config.data = this.sanitizeObject(config.data)
        }
        
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling and security
    this.client.interceptors.response.use(
      (response) => {
        // Extract CSRF token from response headers
        const newCsrfToken = response.headers['x-csrf-token']
        if (newCsrfToken) {
          csrfToken = newCsrfToken
        }
        
        // Sanitize response data
        if (response.data && typeof response.data === 'object') {
          response.data = this.sanitizeObject(response.data)
        }
        
        return response
      },
      async (error: AxiosError) => {
        // Handle authentication errors
        if (error.response?.status === 401 && this.accessToken) {
          try {
            await this.refreshToken()
            // Retry original request
            return this.client.request(error.config!)
          } catch (refreshError) {
            this.clearTokens()
            if (typeof window !== 'undefined') {
              // Emit custom event for auth context to handle
              window.dispatchEvent(new CustomEvent('auth:logout'))
            }
          }
        }
        
        // Sanitize error messages
        if (error.response?.data && typeof error.response.data === 'object') {
          error.response.data = this.sanitizeObject(error.response.data)
        }
        
        return Promise.reject(error)
      }
    )
  }

  private initializeFromCookies() {
    if (typeof window !== 'undefined') {
      const token = Cookies.get('accessToken')
      if (token) {
        this.accessToken = token
      }
    }
  }

  private sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj
    
    if (typeof obj === 'string') {
      return typeof window !== 'undefined' ? DOMPurify.sanitize(obj) : obj
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item))
    }
    
    if (typeof obj === 'object') {
      const sanitized: any = {}
      for (const [key, value] of Object.entries(obj)) {
        sanitized[key] = this.sanitizeObject(value)
      }
      return sanitized
    }
    
    return obj
  }

  private validateEmail(email: string): void {
    emailSchema.parse(email)
  }

  private validatePassword(password: string): void {
    passwordSchema.parse(password)
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken
    if (typeof window !== 'undefined') {
      // Use secure, httpOnly-like cookies where possible
      Cookies.set('accessToken', accessToken, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: 1, // 1 day
      })
      Cookies.set('refreshToken', refreshToken, {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        expires: 7, // 7 days
      })
    }
  }

  getStoredTokens() {
    if (typeof window !== 'undefined') {
      const accessToken = Cookies.get('accessToken')
      const refreshToken = Cookies.get('refreshToken')
      if (accessToken) {
        this.accessToken = accessToken
      }
      return { accessToken, refreshToken }
    }
    return { accessToken: null, refreshToken: null }
  }

  clearTokens() {
    this.accessToken = null
    csrfToken = null
    if (typeof window !== 'undefined') {
      Cookies.remove('accessToken')
      Cookies.remove('refreshToken')
    }
  }

  async refreshToken(): Promise<void> {
    const refreshToken = Cookies.get('refreshToken')
    if (!refreshToken) {
      throw new Error('No refresh token available')
    }

    const response = await this.client.post<TokenResponse>('/api/v1/auth/refresh', {
      refresh_token: refreshToken
    })

    this.setTokens(response.data.access_token, response.data.refresh_token)
  }

  // Auth endpoints
  async login(credentials: LoginRequest): Promise<TokenResponse> {
    // Validate input
    this.validateEmail(credentials.email) // API expects email field
    this.validatePassword(credentials.password)
    
    const response = await this.client.post<TokenResponse>('/api/v1/auth/login', credentials)
    this.setTokens(response.data.access_token, response.data.refresh_token)
    return response.data
  }

  async register(data: RegisterRequest): Promise<TokenResponse> {
    // Validate input
    this.validateEmail(data.email)
    this.validatePassword(data.password)
    
    if (!data.display_name || data.display_name.trim().length < 2) {
      throw new Error('Display name must be at least 2 characters long')
    }
    
    const response = await this.client.post<TokenResponse>('/api/v1/auth/register', data)
    this.setTokens(response.data.access_token, response.data.refresh_token)
    return response.data
  }

  async logout(): Promise<void> {
    try {
      await this.client.post('/api/v1/auth/logout')
    } finally {
      this.clearTokens()
    }
  }

  async getCurrentUser(): Promise<User> {
    const response = await this.client.get<User>('/api/v1/auth/me')
    return response.data
  }

  async updateProfile(data: Partial<User>): Promise<User> {
    const response = await this.client.put<User>('/api/v1/auth/me', data)
    return response.data
  }

  // Tools endpoints
  async getTools(params?: PaginationParams & { search?: string; category?: string }): Promise<PaginatedResponse<Tool>> {
    const response = await this.client.get<PaginatedResponse<Tool>>('/api/v1/tools', { params })
    return response.data
  }

  async getTool(id: string): Promise<Tool> {
    const response = await this.client.get<Tool>(`/api/v1/tools/${id}`)
    return response.data
  }

  async createTool(data: Omit<Tool, 'id' | 'owner_id' | 'created_at' | 'updated_at' | 'average_rating' | 'review_count'>): Promise<Tool> {
    const response = await this.client.post<Tool>('/api/v1/tools', data)
    return response.data
  }

  async updateTool(id: string, data: Partial<Tool>): Promise<Tool> {
    const response = await this.client.put<Tool>(`/api/v1/tools/${id}`, data)
    return response.data
  }

  async deleteTool(id: string): Promise<void> {
    await this.client.delete(`/api/v1/tools/${id}`)
  }

  async getMyTools(params?: PaginationParams): Promise<PaginatedResponse<Tool>> {
    const response = await this.client.get<PaginatedResponse<Tool>>('/api/v1/tools/my-tools', { params })
    return response.data
  }

  async getToolCategories(): Promise<any[]> {
    const response = await this.client.get<any[]>('/api/v1/tools/categories')
    return response.data
  }

  // Bookings endpoints
  async getBookings(params?: PaginationParams): Promise<PaginatedResponse<Booking>> {
    // Convert skip/limit to page/size for backend API
    let queryParams: any = {}
    if (params) {
      if (params.skip !== undefined && params.limit !== undefined) {
        queryParams.page = Math.floor(params.skip / params.limit) + 1
        queryParams.size = params.limit
      } else {
        queryParams = params
      }
    }
    const response = await this.client.get<{bookings: Booking[], pagination: any}>('/api/v1/bookings', { params: queryParams })
    
    // Transform the response to match expected format
    return {
      items: response.data.bookings || [],
      total: response.data.pagination?.total || 0,
      pages: response.data.pagination?.pages || 1,
      skip: params?.skip || 0,
      limit: params?.limit || 20
    }
  }

  async getBooking(id: string): Promise<Booking> {
    const response = await this.client.get<Booking>(`/api/v1/bookings/${id}`)
    return response.data
  }

  async createBooking(data: {
    tool_id: string
    start_date: string
    end_date: string
    delivery_address?: string
    pickup_method: string
    notes?: string
  }): Promise<Booking> {
    const response = await this.client.post<Booking>('/api/v1/bookings', data)
    return response.data
  }

  async updateBookingStatus(id: string, status: string): Promise<Booking> {
    const response = await this.client.patch<Booking>(`/api/v1/bookings/${id}/status`, { status })
    return response.data
  }

  async checkAvailability(toolId: string, startDate: string, endDate: string): Promise<{ available: boolean }> {
    const response = await this.client.get<{ available: boolean }>(
      `/api/v1/bookings/availability/${toolId}`,
      { params: { start_date: startDate, end_date: endDate } }
    )
    return response.data
  }

  // Reviews endpoints
  async getReviews(params?: PaginationParams & { tool_id?: string; user_id?: string }): Promise<PaginatedResponse<Review>> {
    const response = await this.client.get<PaginatedResponse<Review>>('/api/v1/reviews', { params })
    return response.data
  }

  async createReview(data: {
    booking_id: string
    review_type: 'tool_review' | 'borrower_review'
    rating: number
    comment: string
  }): Promise<Review> {
    const response = await this.client.post<Review>('/api/v1/reviews', data)
    return response.data
  }

  async getPendingReviews(): Promise<Review[]> {
    const response = await this.client.get<Review[]>('/api/v1/reviews/pending')
    return response.data
  }

  // Notifications endpoints  
  async getNotifications(params?: PaginationParams): Promise<PaginatedResponse<Notification>> {
    const response = await this.client.get<PaginatedResponse<Notification>>('/api/v1/notifications', { params })
    return response.data
  }

  async markNotificationAsRead(id: string): Promise<void> {
    await this.client.patch(`/api/v1/notifications/${id}/read`)
  }

  async markAllNotificationsAsRead(): Promise<void> {
    await this.client.patch('/api/v1/notifications/read-all')
  }

  async deleteNotification(id: string): Promise<void> {
    await this.client.delete(`/api/v1/notifications/${id}`)
  }
}

// Create singleton instance
export const apiClient = new ApiClient()

// Helper function to handle API errors
export const handleApiError = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const apiError = error.response?.data as ApiError
    return apiError?.detail || 'An unexpected error occurred'
  }
  return 'An unexpected error occurred'
}