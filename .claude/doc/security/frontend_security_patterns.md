# Frontend Security Patterns - Wippestoolen Tool-Sharing Platform

## Executive Summary

**Risk Assessment**: CRITICAL - Current implementation has HIGH security vulnerabilities requiring immediate remediation.

**Key Security Risks Identified**:
- JWT tokens stored in localStorage (HIGH risk - XSS vulnerability)
- No Content Security Policy configured (HIGH risk - XSS/injection attacks)  
- Missing CSRF protection (MEDIUM risk - state-changing operations vulnerable)
- No input sanitization patterns documented (HIGH risk - XSS attacks)
- Error messages may leak sensitive information (MEDIUM risk - information disclosure)

This document provides comprehensive security patterns and remediation strategies for the Next.js frontend authenticating with the FastAPI backend.

## 1. Authentication Security Patterns

### Current Architecture Analysis

**CRITICAL VULNERABILITY**: JWT tokens currently stored in localStorage
```typescript
// INSECURE - Current implementation in lib/api.ts
setTokens(accessToken: string, refreshToken: string) {
  this.accessToken = accessToken
  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', accessToken)    // ❌ HIGH RISK
    localStorage.setItem('refreshToken', refreshToken)  // ❌ HIGH RISK
  }
}
```

**Risk Level**: HIGH
- Vulnerable to XSS attacks (malicious scripts can steal tokens)
- Accessible via JavaScript in browser dev tools
- Persists across browser sessions indefinitely
- No secure HttpOnly protection

### Secure Token Storage Recommendations

#### Option 1: HttpOnly Cookies (RECOMMENDED)

**Risk Level**: LOW - Most secure option

```typescript
// SECURE - HttpOnly cookie implementation
class SecureApiClient {
  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      withCredentials: true, // Enable cookies
      headers: {
        'Content-Type': 'application/json',
      },
    })

    // Remove Authorization header - cookies handled automatically
    this.client.interceptors.request.use(
      (config) => {
        // Add CSRF token if available
        const csrfToken = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content')
        if (csrfToken) {
          config.headers['X-CSRF-Token'] = csrfToken
        }
        return config
      }
    )
  }

  // No token storage needed - cookies handled by browser
  async login(credentials: LoginRequest): Promise<void> {
    await this.client.post('/api/v1/auth/login', credentials)
    // Access token stored in HttpOnly cookie by backend
  }

  async logout(): Promise<void> {
    await this.client.post('/api/v1/auth/logout')
    // Cookie cleared by backend
  }
}
```

**Backend Configuration Required**:
```python
# FastAPI backend changes needed
from fastapi import FastAPI, Response, Request
from fastapi.security import HTTPBearer
import secrets

# Set HttpOnly cookie after login
@app.post("/api/v1/auth/login")
async def login(response: Response, credentials: LoginRequest):
    access_token = create_access_token(user.id)
    
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        max_age=3600,  # 1 hour
        httponly=True,  # Prevents XSS access
        secure=True,    # HTTPS only
        samesite="strict"  # CSRF protection
    )
    
    return {"message": "Login successful"}
```

#### Option 2: Memory + SessionStorage Hybrid (ALTERNATIVE)

**Risk Level**: MEDIUM - Acceptable for development

```typescript
// IMPROVED - Memory + sessionStorage implementation
class HybridApiClient {
  private accessToken: string | null = null
  private tokenExpiry: number | null = null

  constructor() {
    this.client = axios.create({
      baseURL: process.env.NEXT_PUBLIC_API_URL,
      headers: { 'Content-Type': 'application/json' },
    })

    this.loadStoredToken()
    this.setupInterceptors()
  }

  private loadStoredToken() {
    if (typeof window !== 'undefined') {
      const storedToken = sessionStorage.getItem('at_hash') // Store hash only
      const storedExpiry = sessionStorage.getItem('token_expiry')
      
      if (storedToken && storedExpiry) {
        const expiry = parseInt(storedExpiry)
        if (expiry > Date.now()) {
          // Token still valid, but we need to re-authenticate
          this.scheduleTokenRefresh(expiry)
        } else {
          this.clearTokens()
        }
      }
    }
  }

  setTokens(accessToken: string, refreshToken: string) {
    this.accessToken = accessToken
    
    // Extract expiry from JWT
    const payload = JSON.parse(atob(accessToken.split('.')[1]))
    this.tokenExpiry = payload.exp * 1000

    if (typeof window !== 'undefined') {
      // Store only hash and expiry, not actual tokens
      const tokenHash = btoa(accessToken.substring(0, 16)) // Store partial hash
      sessionStorage.setItem('at_hash', tokenHash)
      sessionStorage.setItem('token_expiry', this.tokenExpiry.toString())
      
      // Store refresh token encrypted (requires crypto library)
      const encrypted = this.encryptToken(refreshToken)
      sessionStorage.setItem('rt_enc', encrypted)
    }

    this.scheduleTokenRefresh(this.tokenExpiry)
  }

  private encryptToken(token: string): string {
    // Use Web Crypto API for client-side encryption
    // Implementation depends on crypto library choice
    return btoa(token) // Simplified - use proper encryption
  }

  private scheduleTokenRefresh(expiry: number) {
    const refreshTime = expiry - Date.now() - 60000 // Refresh 1 min before expiry
    if (refreshTime > 0) {
      setTimeout(() => this.refreshToken(), refreshTime)
    }
  }

  clearTokens() {
    this.accessToken = null
    this.tokenExpiry = null
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('at_hash')
      sessionStorage.removeItem('token_expiry') 
      sessionStorage.removeItem('rt_enc')
    }
  }
}
```

### JWT Token Security Best Practices

**Access Token Configuration**:
```typescript
// Short-lived access tokens
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000 // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000 // 7 days

// Secure JWT claims
interface SecureJWTPayload {
  sub: string      // User ID
  iat: number      // Issued at
  exp: number      // Expires at
  aud: string      // Audience (app domain)
  iss: string      // Issuer (API domain)
  scope: string[]  // Permissions
  session_id: string // For session invalidation
}
```

### Session Management Security

#### Multi-tab Synchronization

```typescript
// Secure cross-tab session management
class SessionManager {
  private static instance: SessionManager
  private broadcastChannel: BroadcastChannel

  constructor() {
    if (typeof window !== 'undefined') {
      this.broadcastChannel = new BroadcastChannel('auth_sync')
      this.setupEventListeners()
    }
  }

  private setupEventListeners() {
    // Listen for auth changes across tabs
    this.broadcastChannel.addEventListener('message', (event) => {
      const { type, payload } = event.data
      
      switch (type) {
        case 'AUTH_LOGOUT':
          this.handleRemoteLogout()
          break
        case 'AUTH_TOKEN_REFRESH':
          this.handleRemoteTokenRefresh(payload)
          break
        case 'AUTH_SESSION_EXPIRED':
          this.handleSessionExpired()
          break
      }
    })

    // Handle tab focus - check session validity
    window.addEventListener('focus', this.validateSession.bind(this))
  }

  private async validateSession() {
    try {
      await apiClient.getCurrentUser()
    } catch (error) {
      if (error.response?.status === 401) {
        this.broadcastLogout()
      }
    }
  }

  broadcastLogout() {
    this.broadcastChannel.postMessage({
      type: 'AUTH_LOGOUT',
      timestamp: Date.now()
    })
  }

  broadcastTokenRefresh(tokens: TokenResponse) {
    this.broadcastChannel.postMessage({
      type: 'AUTH_TOKEN_REFRESH', 
      payload: { timestamp: Date.now() }
    })
  }
}
```

#### Automatic Logout Strategies

```typescript
// Secure automatic logout implementation
class AutoLogoutManager {
  private inactivityTimer: NodeJS.Timeout | null = null
  private readonly INACTIVITY_TIMEOUT = 30 * 60 * 1000 // 30 minutes
  
  constructor(private authContext: AuthContextType) {
    this.setupInactivityDetection()
    this.setupSessionValidation()
  }

  private setupInactivityDetection() {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    
    const resetTimer = () => {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer)
      }
      
      this.inactivityTimer = setTimeout(() => {
        this.handleInactivityLogout()
      }, this.INACTIVITY_TIMEOUT)
    }

    events.forEach(event => {
      document.addEventListener(event, resetTimer, true)
    })

    resetTimer() // Start timer
  }

  private async handleInactivityLogout() {
    console.warn('Session expired due to inactivity')
    await this.authContext.logout()
    
    // Show user notification
    this.showLogoutNotification('Session expired due to inactivity')
  }

  private setupSessionValidation() {
    // Validate session every 5 minutes
    setInterval(async () => {
      if (this.authContext.isAuthenticated) {
        try {
          await apiClient.getCurrentUser()
        } catch (error) {
          if (error.response?.status === 401) {
            await this.authContext.logout()
            this.showLogoutNotification('Session expired')
          }
        }
      }
    }, 5 * 60 * 1000)
  }

  private showLogoutNotification(message: string) {
    // Use toast notification or modal
    if (typeof window !== 'undefined') {
      // Ensure user sees the logout reason
      alert(message) // Replace with proper toast notification
    }
  }
}
```

### Secure Logout Implementation

```typescript
// Comprehensive logout with token invalidation
async logout(): Promise<void> {
  try {
    setIsLoading(true)
    
    // 1. Invalidate tokens on backend
    await this.client.post('/api/v1/auth/logout')
    
    // 2. Clear all client-side storage
    this.clearAllTokens()
    
    // 3. Broadcast logout to other tabs
    sessionManager.broadcastLogout()
    
    // 4. Clear sensitive data from memory
    this.clearSensitiveData()
    
    // 5. Redirect to login page
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?reason=logout'
    }
    
  } catch (error) {
    // Even if backend call fails, clear local tokens
    this.clearAllTokens()
    console.error('Logout API call failed, but tokens cleared locally:', error)
  } finally {
    setUser(null)
    setIsLoading(false)
  }
}

private clearAllTokens() {
  this.accessToken = null
  if (typeof window !== 'undefined') {
    // Clear all possible storage locations
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    sessionStorage.removeItem('at_hash')
    sessionStorage.removeItem('token_expiry')
    sessionStorage.removeItem('rt_enc')
    
    // Clear any cached user data
    sessionStorage.removeItem('user_profile')
    localStorage.removeItem('user_preferences')
  }
}

private clearSensitiveData() {
  // Clear any sensitive data from component state
  // Clear form data, temporary files, etc.
}
```

## 2. XSS Prevention

### Content Security Policy Configuration

**Current Risk**: CRITICAL - No CSP configured

#### Next.js Security Headers Configuration

```typescript
// next.config.ts - SECURE configuration
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' blob: data: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://api.wippestoolen.com wss://api.wippestoolen.com",
              "media-src 'self'",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          // Security Headers
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload'
          },
          {
            key: 'Permissions-Policy',
            value: [
              'camera=self',
              'microphone=()',
              'geolocation=self',
              'payment=()',
              'usb=()',
              'magnetometer=()',
              'accelerometer=()'
            ].join(', ')
          }
        ]
      }
    ]
  },
  
  // Image optimization security
  images: {
    domains: ['api.wippestoolen.com', 's3.amazonaws.com'],
    formats: ['image/webp', 'image/avif'],
  },

  // Build-time security
  typescript: {
    ignoreBuildErrors: false, // Enforce type safety
  },
  
  eslint: {
    ignoreDuringBuilds: false, // Enforce linting
  }
};

export default nextConfig;
```

#### CSP Nonce Implementation for Dynamic Scripts

```typescript
// lib/csp.ts - CSP nonce utility
import { headers } from 'next/headers'
import { randomBytes } from 'crypto'

export function generateCSPNonce(): string {
  return randomBytes(16).toString('base64')
}

export function getCSPNonce(): string | undefined {
  const headersList = headers()
  return headersList.get('x-nonce') || undefined
}

// app/layout.tsx - CSP nonce injection
import { generateCSPNonce } from '@/lib/csp'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const nonce = generateCSPNonce()

  return (
    <html lang="en">
      <head>
        <meta name="csrf-token" content={nonce} />
        <script nonce={nonce} dangerouslySetInnerHTML={{
          __html: `
            window.__NONCE__ = '${nonce}';
            window.__CSRF_TOKEN__ = '${nonce}';
          `
        }} />
      </head>
      <body>
        {children}
      </body>
    </html>
  )
}
```

### Input Sanitization Patterns

#### User-Generated Content Sanitization

```typescript
// lib/sanitization.ts - Content sanitization utility
import DOMPurify from 'isomorphic-dompurify'

export class ContentSanitizer {
  private static readonly ALLOWED_TAGS = [
    'p', 'br', 'strong', 'em', 'u', 'ol', 'ul', 'li'
  ]

  private static readonly ALLOWED_ATTRIBUTES = {
    '*': ['class'],
  }

  static sanitizeHTML(dirty: string): string {
    return DOMPurify.sanitize(dirty, {
      ALLOWED_TAGS: this.ALLOWED_TAGS,
      ALLOWED_ATTR: this.ALLOWED_ATTRIBUTES,
      KEEP_CONTENT: true,
      RETURN_DOM: false,
    })
  }

  static sanitizeText(text: string): string {
    return text
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
  }

  static sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url)
      
      // Only allow http/https protocols
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return ''
      }
      
      // Block known malicious patterns
      if (url.includes('javascript:') || url.includes('data:')) {
        return ''
      }
      
      return url
    } catch {
      return '' // Invalid URL
    }
  }
}

// Usage in components
function ToolDescription({ description }: { description: string }) {
  const sanitizedDescription = ContentSanitizer.sanitizeHTML(description)
  
  return (
    <div 
      dangerouslySetInnerHTML={{ __html: sanitizedDescription }}
      className="prose prose-sm"
    />
  )
}
```

#### Form Input Validation

```typescript
// lib/validation.ts - Input validation patterns
import { z } from 'zod'

export const secureValidationSchemas = {
  email: z.string()
    .email('Invalid email format')
    .max(254, 'Email too long')
    .transform(email => email.toLowerCase().trim()),

  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, 
           'Password must contain uppercase, lowercase, number and special character'),

  toolTitle: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title too long')
    .transform(title => ContentSanitizer.sanitizeText(title.trim())),

  toolDescription: z.string()
    .max(2000, 'Description too long')
    .transform(desc => ContentSanitizer.sanitizeHTML(desc.trim())),

  address: z.string()
    .max(200, 'Address too long')
    .transform(addr => ContentSanitizer.sanitizeText(addr.trim())),

  phoneNumber: z.string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Invalid phone number format')
    .transform(phone => phone.replace(/[^\d\+]/g, '')),
}

// Secure form component example
function SecureToolForm() {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
  })
  
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleInputChange = (field: string, value: string) => {
    // Real-time validation and sanitization
    try {
      let sanitizedValue = value
      
      switch (field) {
        case 'title':
          sanitizedValue = secureValidationSchemas.toolTitle.parse(value)
          break
        case 'description':
          sanitizedValue = secureValidationSchemas.toolDescription.parse(value)
          break
      }
      
      setFormData(prev => ({ ...prev, [field]: sanitizedValue }))
      setErrors(prev => ({ ...prev, [field]: '' }))
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({ 
          ...prev, 
          [field]: error.errors[0]?.message || 'Invalid input' 
        }))
      }
    }
  }

  return (
    <form onSubmit={handleSecureSubmit}>
      <Input
        value={formData.title}
        onChange={(e) => handleInputChange('title', e.target.value)}
        maxLength={100}
        error={errors.title}
      />
      <textarea
        value={formData.description}
        onChange={(e) => handleInputChange('description', e.target.value)}
        maxLength={2000}
      />
      {errors.description && <span className="error">{errors.description}</span>}
    </form>
  )
}
```

### Safe HTML Rendering with React

```typescript
// components/ui/safe-content.tsx - Safe content rendering
import React from 'react'
import { ContentSanitizer } from '@/lib/sanitization'

interface SafeContentProps {
  content: string
  allowHtml?: boolean
  className?: string
}

export function SafeContent({ content, allowHtml = false, className }: SafeContentProps) {
  if (!allowHtml) {
    // Plain text rendering - safe by default
    return <span className={className}>{content}</span>
  }

  // Sanitized HTML rendering
  const sanitizedContent = ContentSanitizer.sanitizeHTML(content)
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  )
}

// Usage examples
function ToolCard({ tool }: { tool: Tool }) {
  return (
    <div className="tool-card">
      <SafeContent content={tool.title} className="tool-title" />
      <SafeContent 
        content={tool.description} 
        allowHtml={true} 
        className="tool-description" 
      />
    </div>
  )
}
```

### Third-Party Script Security

```typescript
// components/analytics/secure-analytics.tsx - Secure third-party integration
'use client'

import Script from 'next/script'
import { getCSPNonce } from '@/lib/csp'

export function SecureAnalytics() {
  const nonce = getCSPNonce()

  return (
    <>
      {/* Secure Google Analytics integration */}
      <Script
        id="gtag-base"
        strategy="afterInteractive"
        nonce={nonce}
        src={`https://www.googletagmanager.com/gtag/js?id=${process.env.NEXT_PUBLIC_GA_ID}`}
      />
      <Script
        id="gtag-config"
        strategy="afterInteractive"
        nonce={nonce}
        dangerouslySetInnerHTML={{
          __html: `
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${process.env.NEXT_PUBLIC_GA_ID}', {
              page_title: document.title,
              page_location: window.location.href,
              custom_map: {'custom_parameter': 'value'}
            });
          `,
        }}
      />
    </>
  )
}
```

## 3. CSRF Protection

### Token-Based CSRF Protection

**Current Risk**: MEDIUM - No CSRF protection implemented

```typescript
// lib/csrf.ts - CSRF token management
class CSRFManager {
  private static instance: CSRFManager
  private csrfToken: string | null = null

  static getInstance(): CSRFManager {
    if (!this.instance) {
      this.instance = new CSRFManager()
    }
    return this.instance
  }

  async getCSRFToken(): Promise<string> {
    if (!this.csrfToken) {
      await this.fetchCSRFToken()
    }
    return this.csrfToken!
  }

  private async fetchCSRFToken(): Promise<void> {
    try {
      const response = await fetch('/api/v1/auth/csrf-token', {
        method: 'GET',
        credentials: 'include',
      })
      
      const { csrf_token } = await response.json()
      this.csrfToken = csrf_token
      
      // Store in meta tag for easy access
      this.updateCSRFMetaTag(csrf_token)
      
    } catch (error) {
      console.error('Failed to fetch CSRF token:', error)
      throw error
    }
  }

  private updateCSRFMetaTag(token: string) {
    let metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
    
    if (!metaTag) {
      metaTag = document.createElement('meta')
      metaTag.name = 'csrf-token'
      document.head.appendChild(metaTag)
    }
    
    metaTag.content = token
  }

  validateCSRFToken(token: string): boolean {
    return token === this.csrfToken && token.length > 0
  }
}

// Enhanced API client with CSRF protection
class SecureApiClient extends ApiClient {
  private csrfManager = CSRFManager.getInstance()

  constructor() {
    super()
    
    // Add CSRF token to requests
    this.client.interceptors.request.use(async (config) => {
      // Add CSRF token for state-changing operations
      if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
        try {
          const csrfToken = await this.csrfManager.getCSRFToken()
          config.headers['X-CSRF-Token'] = csrfToken
        } catch (error) {
          console.error('CSRF token fetch failed:', error)
          // Continue without token - backend will reject if required
        }
      }
      
      return config
    })
  }
}
```

### Double Submit Cookie Pattern

```typescript
// lib/csrf-cookie.ts - Double Submit Cookie implementation
class CSRFCookieManager {
  private readonly CSRF_COOKIE_NAME = '__Host-csrf-token'
  
  generateCSRFToken(): string {
    // Generate cryptographically secure random token
    const array = new Uint8Array(32)
    crypto.getRandomValues(array)
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
  }

  setCSRFCookie(token: string) {
    document.cookie = `${this.CSRF_COOKIE_NAME}=${token}; Path=/; Secure; SameSite=Strict; Max-Age=3600`
  }

  getCSRFTokenFromCookie(): string | null {
    const cookies = document.cookie.split(';')
    
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split('=')
      if (name === this.CSRF_COOKIE_NAME) {
        return value
      }
    }
    
    return null
  }

  validateDoubleSubmit(headerToken: string): boolean {
    const cookieToken = this.getCSRFTokenFromCookie()
    return cookieToken !== null && headerToken === cookieToken
  }
}

// Usage in forms
function SecureForm() {
  const [csrfToken, setCSRFToken] = useState<string>('')
  const csrfManager = new CSRFCookieManager()

  useEffect(() => {
    const token = csrfManager.generateCSRFToken()
    csrfManager.setCSRFCookie(token)
    setCSRFToken(token)
  }, [])

  const handleSubmit = async (formData: FormData) => {
    try {
      await apiClient.post('/api/v1/tools', formData, {
        headers: {
          'X-CSRF-Token': csrfToken
        }
      })
    } catch (error) {
      if (error.response?.status === 403) {
        console.error('CSRF token validation failed')
        // Refresh CSRF token and retry
      }
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <input type="hidden" name="csrf_token" value={csrfToken} />
      {/* form fields */}
    </form>
  )
}
```

### Same-Site Cookie Security

```typescript
// Backend configuration needed for secure cookies
interface SecureCookieOptions {
  name: string
  value: string
  domain?: string
  path: string
  secure: boolean      // HTTPS only
  httpOnly: boolean    // No JavaScript access
  sameSite: 'strict' | 'lax' | 'none'
  maxAge: number      // Seconds
}

const secureSessionConfig: SecureCookieOptions = {
  name: '__Host-session',
  value: 'session_token_here',
  path: '/',
  secure: true,
  httpOnly: true,
  sameSite: 'strict',  // Strongest CSRF protection
  maxAge: 3600        // 1 hour
}

// SameSite cookie attributes explanation:
// - strict: Cookie only sent with same-site requests (strongest protection)
// - lax: Cookie sent with same-site requests + top-level navigation (good balance)  
// - none: Cookie sent with all cross-site requests (requires Secure flag)

// Frontend cookie handling
function CookieManager {
  static setSecureCookie(options: SecureCookieOptions) {
    const cookieString = [
      `${options.name}=${options.value}`,
      `Path=${options.path}`,
      options.secure ? 'Secure' : '',
      options.httpOnly ? 'HttpOnly' : '',
      `SameSite=${options.sameSite}`,
      `Max-Age=${options.maxAge}`
    ].filter(Boolean).join('; ')

    document.cookie = cookieString
  }
}
```

## 4. Input Validation & Sanitization

### Client-Side Validation Security

**CRITICAL**: Client-side validation is NOT a security control - only UX enhancement

```typescript
// lib/validation-security.ts - Secure validation patterns
export class ValidationSecurity {
  static readonly MAX_INPUT_LENGTHS = {
    email: 254,
    password: 128,
    name: 100,
    description: 2000,
    address: 200,
    phone: 20,
    toolTitle: 100,
    categoryName: 50,
  }

  static validateInputLength(input: string, maxLength: number): boolean {
    return input.length <= maxLength
  }

  static detectMaliciousPatterns(input: string): boolean {
    const maliciousPatterns = [
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
      /javascript:/gi,                                        // JavaScript URLs
      /vbscript:/gi,                                         // VBScript URLs
      /on\w+\s*=/gi,                                         // Event handlers
      /expression\(/gi,                                      // CSS expressions
      /@import/gi,                                           // CSS imports
      /\beval\(/gi,                                          // eval() calls
      /\bdocument\./gi,                                      // DOM access
      /\bwindow\./gi,                                        // Window access
    ]

    return maliciousPatterns.some(pattern => pattern.test(input))
  }

  static sanitizeForDatabase(input: string): string {
    // Remove null bytes and other dangerous characters
    return input
      .replace(/\0/g, '')     // Null bytes
      .replace(/\r\n/g, '\n') // Normalize line endings
      .replace(/\r/g, '\n')   // Convert old Mac line endings
      .trim()
  }

  static validateFileType(file: File, allowedTypes: string[]): boolean {
    // Validate both MIME type and file extension
    const fileExtension = file.name.split('.').pop()?.toLowerCase()
    const mimeType = file.type.toLowerCase()

    return allowedTypes.some(type => {
      const [category, subtype] = type.split('/')
      return mimeType.startsWith(`${category}/${subtype}`) &&
             (fileExtension === subtype || 
              (subtype === 'jpeg' && fileExtension === 'jpg'))
    })
  }
}

// Secure form validation hook
export function useSecureValidation<T extends Record<string, any>>(
  schema: z.ZodSchema<T>
) {
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isValid, setIsValid] = useState(false)

  const validate = useCallback((data: T): boolean => {
    try {
      // 1. Check for malicious patterns first
      Object.entries(data).forEach(([field, value]) => {
        if (typeof value === 'string') {
          if (ValidationSecurity.detectMaliciousPatterns(value)) {
            throw new Error(`Malicious content detected in ${field}`)
          }
        }
      })

      // 2. Run schema validation
      schema.parse(data)
      
      setErrors({})
      setIsValid(true)
      return true
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Record<string, string> = {}
        error.errors.forEach(err => {
          const path = err.path.join('.')
          newErrors[path] = err.message
        })
        setErrors(newErrors)
      } else {
        setErrors({ general: error.message })
      }
      
      setIsValid(false)
      return false
    }
  }, [schema])

  return { validate, errors, isValid }
}
```

### File Upload Security

```typescript
// lib/file-security.ts - Secure file upload handling
export class FileUploadSecurity {
  private static readonly ALLOWED_IMAGE_TYPES = [
    'image/jpeg',
    'image/png', 
    'image/webp',
    'image/avif'
  ]

  private static readonly MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
  private static readonly MAX_FILES = 10

  static validateFile(file: File): ValidationResult {
    const errors: string[] = []

    // 1. File size check
    if (file.size > this.MAX_FILE_SIZE) {
      errors.push(`File size exceeds ${this.MAX_FILE_SIZE / 1024 / 1024}MB limit`)
    }

    // 2. MIME type validation
    if (!this.ALLOWED_IMAGE_TYPES.includes(file.type)) {
      errors.push('File type not allowed. Please use JPEG, PNG, WebP, or AVIF')
    }

    // 3. File extension validation
    const extension = file.name.split('.').pop()?.toLowerCase()
    const allowedExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif']
    if (!extension || !allowedExtensions.includes(extension)) {
      errors.push('Invalid file extension')
    }

    // 4. Filename security check
    if (this.hasInsecureFilename(file.name)) {
      errors.push('Filename contains invalid characters')
    }

    return {
      isValid: errors.length === 0,
      errors
    }
  }

  private static hasInsecureFilename(filename: string): boolean {
    const insecurePatterns = [
      /\.\./,           // Directory traversal
      /[<>:"|?*]/,      // Windows reserved chars
      /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i, // Windows reserved names
      /\s+$/,           // Trailing whitespace
      /^\./             // Hidden files
    ]

    return insecurePatterns.some(pattern => pattern.test(filename))
  }

  static sanitizeFilename(filename: string): string {
    return filename
      .replace(/[^a-zA-Z0-9.-]/g, '_') // Replace special chars with underscore
      .replace(/\.+/g, '.')           // Collapse multiple dots
      .replace(/^\.+|\.+$/g, '')      // Remove leading/trailing dots
      .substring(0, 100)              // Limit length
  }

  static async validateImageFile(file: File): Promise<ValidationResult> {
    const basicValidation = this.validateFile(file)
    if (!basicValidation.isValid) {
      return basicValidation
    }

    try {
      // Create image element to validate it's actually an image
      const img = new Image()
      const url = URL.createObjectURL(file)

      return new Promise((resolve) => {
        img.onload = () => {
          URL.revokeObjectURL(url)
          
          // Additional image validation
          const errors: string[] = []
          
          if (img.width < 100 || img.height < 100) {
            errors.push('Image must be at least 100x100 pixels')
          }
          
          if (img.width > 4000 || img.height > 4000) {
            errors.push('Image dimensions too large (max 4000x4000)')
          }

          resolve({
            isValid: errors.length === 0,
            errors,
            metadata: {
              width: img.width,
              height: img.height,
              aspectRatio: img.width / img.height
            }
          })
        }

        img.onerror = () => {
          URL.revokeObjectURL(url)
          resolve({
            isValid: false,
            errors: ['Invalid image file - corrupted or unsupported format']
          })
        }

        img.src = url
      })
    } catch (error) {
      return {
        isValid: false,
        errors: ['Failed to validate image file']
      }
    }
  }
}

interface ValidationResult {
  isValid: boolean
  errors: string[]
  metadata?: {
    width: number
    height: number
    aspectRatio: number
  }
}

// Secure file upload component
function SecureFileUpload() {
  const [files, setFiles] = useState<File[]>([])
  const [uploadErrors, setUploadErrors] = useState<string[]>([])

  const handleFileSelect = async (selectedFiles: FileList) => {
    const newErrors: string[] = []
    const validFiles: File[] = []

    // Validate each file
    for (const file of Array.from(selectedFiles)) {
      const validation = await FileUploadSecurity.validateImageFile(file)
      
      if (validation.isValid) {
        // Sanitize filename
        const sanitizedName = FileUploadSecurity.sanitizeFilename(file.name)
        const sanitizedFile = new File([file], sanitizedName, { type: file.type })
        validFiles.push(sanitizedFile)
      } else {
        newErrors.push(`${file.name}: ${validation.errors.join(', ')}`)
      }
    }

    setFiles(prev => [...prev, ...validFiles])
    setUploadErrors(newErrors)
  }

  return (
    <div className="file-upload">
      <input
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/avif"
        onChange={(e) => e.target.files && handleFileSelect(e.target.files)}
        max={FileUploadSecurity.MAX_FILES}
      />
      
      {uploadErrors.length > 0 && (
        <div className="error-messages">
          {uploadErrors.map((error, index) => (
            <p key={index} className="text-red-600">{error}</p>
          ))}
        </div>
      )}
    </div>
  )
}
```

### SQL Injection Prevention

**Note**: Primary responsibility is backend, but frontend can help prevent

```typescript
// lib/query-security.ts - Frontend query parameter security
export class QuerySecurity {
  // Sanitize search queries before sending to API
  static sanitizeSearchQuery(query: string): string {
    return query
      .replace(/['"`;\\]/g, '') // Remove SQL-dangerous characters
      .replace(/\s+/g, ' ')     // Normalize whitespace
      .trim()
      .substring(0, 100)        // Limit length
  }

  // Validate sort parameters against whitelist
  static validateSortParameter(sortField: string, allowedFields: string[]): boolean {
    return allowedFields.includes(sortField)
  }

  // Sanitize pagination parameters
  static sanitizePaginationParams(params: PaginationParams): PaginationParams {
    return {
      page: Math.max(1, Math.min(params.page || 1, 1000)), // Limit page range
      limit: Math.max(1, Math.min(params.limit || 20, 100)), // Limit page size
      sort_by: params.sort_by && this.validateSortParameter(
        params.sort_by, 
        ['created_at', 'title', 'rating', 'price']
      ) ? params.sort_by : 'created_at',
      sort_order: ['asc', 'desc'].includes(params.sort_order || 'desc') 
        ? params.sort_order : 'desc'
    }
  }
}

// Secure search component
function SecureSearch() {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearching, setIsSearching] = useState(false)

  const handleSearch = async (query: string) => {
    // Sanitize search query
    const sanitizedQuery = QuerySecurity.sanitizeSearchQuery(query)
    
    if (sanitizedQuery.length < 2) {
      return // Require minimum 2 characters
    }

    setIsSearching(true)
    
    try {
      const results = await apiClient.searchTools({
        query: sanitizedQuery,
        page: 1,
        limit: 20
      })
      
      // Handle results
    } catch (error) {
      console.error('Search failed:', error)
    } finally {
      setIsSearching(false)
    }
  }

  return (
    <div className="search-container">
      <input
        type="text"
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        onKeyPress={(e) => {
          if (e.key === 'Enter') {
            handleSearch(searchQuery)
          }
        }}
        placeholder="Search tools..."
        maxLength={100}
      />
      <button 
        onClick={() => handleSearch(searchQuery)}
        disabled={isSearching || searchQuery.length < 2}
      >
        {isSearching ? 'Searching...' : 'Search'}
      </button>
    </div>
  )
}
```

### Rate Limiting on Frontend

```typescript
// lib/rate-limiting.ts - Client-side rate limiting
class ClientRateLimit {
  private requests: Map<string, number[]> = new Map()
  
  constructor(
    private maxRequests: number = 100,
    private windowMs: number = 60000 // 1 minute
  ) {}

  canMakeRequest(key: string): boolean {
    const now = Date.now()
    const requests = this.requests.get(key) || []
    
    // Remove expired requests
    const validRequests = requests.filter(timestamp => 
      now - timestamp < this.windowMs
    )
    
    if (validRequests.length >= this.maxRequests) {
      return false
    }
    
    // Add current request
    validRequests.push(now)
    this.requests.set(key, validRequests)
    
    return true
  }

  getTimeUntilReset(key: string): number {
    const requests = this.requests.get(key) || []
    if (requests.length === 0) return 0
    
    const oldestRequest = Math.min(...requests)
    return this.windowMs - (Date.now() - oldestRequest)
  }
}

// Usage in API client
class RateLimitedApiClient extends ApiClient {
  private rateLimiter = new ClientRateLimit(60, 60000) // 60 requests per minute

  async makeRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    const key = `${config.method}:${config.url}`
    
    if (!this.rateLimiter.canMakeRequest(key)) {
      const waitTime = this.rateLimiter.getTimeUntilReset(key)
      throw new Error(`Rate limit exceeded. Try again in ${Math.ceil(waitTime / 1000)} seconds`)
    }

    return this.client.request(config)
  }
}
```

## 5. API Security Patterns

### Secure HTTP Communication

```typescript
// lib/secure-api-client.ts - Enhanced secure API client
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'

export class SecureApiClient {
  private client: AxiosInstance
  private readonly baseURL: string
  private readonly timeout: number = 30000 // 30 seconds

  constructor() {
    this.baseURL = this.validateBaseURL(process.env.NEXT_PUBLIC_API_URL!)
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      withCredentials: true, // Include cookies
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest', // CSRF protection
      },
    })

    this.setupInterceptors()
  }

  private validateBaseURL(url: string): string {
    try {
      const urlObj = new URL(url)
      
      // Ensure HTTPS in production
      if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
        throw new Error('API URL must use HTTPS in production')
      }
      
      // Validate allowed domains
      const allowedDomains = [
        'localhost',
        'api.wippestoolen.com',
        '127.0.0.1'
      ]
      
      if (!allowedDomains.includes(urlObj.hostname)) {
        throw new Error(`API domain not allowed: ${urlObj.hostname}`)
      }
      
      return url
    } catch (error) {
      throw new Error(`Invalid API URL: ${error.message}`)
    }
  }

  private setupInterceptors() {
    // Request interceptor
    this.client.interceptors.request.use(
      (config) => {
        // Add security headers
        config.headers = {
          ...config.headers,
          'X-Client-Version': process.env.NEXT_PUBLIC_APP_VERSION || '1.0.0',
          'X-Request-ID': this.generateRequestId(),
        }

        // Add CSRF token for state-changing requests
        if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase() || '')) {
          const csrfToken = this.getCSRFToken()
          if (csrfToken) {
            config.headers['X-CSRF-Token'] = csrfToken
          }
        }

        // Log request for debugging (remove sensitive data)
        this.logRequest(config)

        return config
      },
      (error) => {
        console.error('Request interceptor error:', error)
        return Promise.reject(error)
      }
    )

    // Response interceptor
    this.client.interceptors.response.use(
      (response) => {
        this.logResponse(response)
        return response
      },
      async (error) => {
        this.logError(error)
        return this.handleResponseError(error)
      }
    )
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }

  private getCSRFToken(): string | null {
    const metaTag = document.querySelector('meta[name="csrf-token"]')
    return metaTag?.getAttribute('content') || null
  }

  private logRequest(config: AxiosRequestConfig) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${config.method?.toUpperCase()} ${config.url}`)
    }
  }

  private logResponse(response: AxiosResponse) {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[API] ${response.status} ${response.config.method?.toUpperCase()} ${response.config.url}`)
    }
  }

  private logError(error: any) {
    console.error('[API Error]', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      message: error.message,
    })
  }

  private async handleResponseError(error: any): Promise<never> {
    const status = error.response?.status
    const config = error.config

    switch (status) {
      case 401:
        // Unauthorized - token expired or invalid
        await this.handleUnauthorized()
        break
        
      case 403:
        // Forbidden - CSRF token invalid or insufficient permissions
        if (error.response?.data?.detail?.includes('CSRF')) {
          await this.refreshCSRFToken()
          // Retry request with new CSRF token
          return this.client.request(config)
        }
        break
        
      case 429:
        // Rate limited
        const retryAfter = error.response?.headers['retry-after']
        if (retryAfter && !config._retryCount) {
          const delay = parseInt(retryAfter) * 1000
          config._retryCount = 1
          
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.client.request(config)
        }
        break
        
      case 500:
      case 502:
      case 503:
      case 504:
        // Server errors - retry with exponential backoff
        if (!config._retryCount || config._retryCount < 3) {
          const retryCount = config._retryCount || 0
          const delay = Math.pow(2, retryCount) * 1000 // 1s, 2s, 4s
          
          config._retryCount = retryCount + 1
          
          await new Promise(resolve => setTimeout(resolve, delay))
          return this.client.request(config)
        }
        break
    }

    return Promise.reject(error)
  }

  private async handleUnauthorized() {
    // Clear tokens and redirect to login
    this.clearAuthData()
    
    if (typeof window !== 'undefined') {
      window.location.href = '/auth/login?reason=session-expired'
    }
  }

  private async refreshCSRFToken() {
    try {
      const response = await fetch(`${this.baseURL}/api/v1/auth/csrf-token`, {
        method: 'GET',
        credentials: 'include',
      })
      
      const { csrf_token } = await response.json()
      
      // Update CSRF token in meta tag
      let metaTag = document.querySelector('meta[name="csrf-token"]') as HTMLMetaElement
      if (!metaTag) {
        metaTag = document.createElement('meta')
        metaTag.name = 'csrf-token'
        document.head.appendChild(metaTag)
      }
      metaTag.content = csrf_token
      
    } catch (error) {
      console.error('Failed to refresh CSRF token:', error)
    }
  }

  private clearAuthData() {
    // Clear all authentication data
    localStorage.removeItem('accessToken')
    localStorage.removeItem('refreshToken')
    sessionStorage.clear()
    
    // Clear cookies (if possible from client-side)
    document.cookie.split(';').forEach(cookie => {
      const eqPos = cookie.indexOf('=')
      const name = eqPos > -1 ? cookie.substr(0, eqPos) : cookie
      document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/`
    })
  }

  // Secure request methods
  async get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.get<T>(url, config)
    return response.data
  }

  async post<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.post<T>(url, data, config)
    return response.data
  }

  async put<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.put<T>(url, data, config)
    return response.data
  }

  async patch<T>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.patch<T>(url, data, config)
    return response.data
  }

  async delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
    const response = await this.client.delete<T>(url, config)
    return response.data
  }
}

// Create singleton with enhanced security
export const secureApiClient = new SecureApiClient()
```

### Request/Response Header Security

```typescript
// lib/security-headers.ts - Security header management
export class SecurityHeaders {
  // Headers to always send with API requests
  static getSecureRequestHeaders(): Record<string, string> {
    return {
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'X-Permitted-Cross-Domain-Policies': 'none',
    }
  }

  // Validate security headers in responses
  static validateResponseHeaders(headers: Record<string, string>): SecurityValidation {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for security headers
    const expectedHeaders = {
      'x-content-type-options': 'nosniff',
      'x-frame-options': ['DENY', 'SAMEORIGIN'],
      'strict-transport-security': true, // Should be present
      'x-xss-protection': '1; mode=block',
    }

    Object.entries(expectedHeaders).forEach(([header, expected]) => {
      const value = headers[header.toLowerCase()]
      
      if (!value) {
        warnings.push(`Missing security header: ${header}`)
      } else if (Array.isArray(expected)) {
        if (!expected.includes(value)) {
          warnings.push(`Unexpected value for ${header}: ${value}`)
        }
      } else if (typeof expected === 'string' && value !== expected) {
        warnings.push(`Unexpected value for ${header}: ${value}, expected: ${expected}`)
      }
    })

    // Check for sensitive information in headers
    const sensitivePatterns = [
      /server:/i,      // Server version disclosure
      /x-powered-by:/i, // Technology stack disclosure
      /x-debug/i,      // Debug information
    ]

    Object.keys(headers).forEach(header => {
      if (sensitivePatterns.some(pattern => pattern.test(header))) {
        warnings.push(`Potentially sensitive header exposed: ${header}`)
      }
    })

    return {
      isSecure: errors.length === 0,
      warnings,
      errors
    }
  }
}

interface SecurityValidation {
  isSecure: boolean
  warnings: string[]
  errors: string[]
}
```

### API Key Management

```typescript
// lib/api-key-management.ts - Secure API key handling
class ApiKeyManager {
  private static readonly API_KEY_STORAGE_KEY = '__api_preferences'
  
  // Never store API keys in localStorage - use environment variables
  static getApiKey(): string | null {
    // API keys should ONLY come from environment variables
    return process.env.NEXT_PUBLIC_API_KEY || null
  }

  // For user-specific API tokens (different from main API key)
  static setUserApiToken(token: string, expiresIn: number) {
    const expiry = Date.now() + (expiresIn * 1000)
    
    // Store in sessionStorage with expiry
    const tokenData = {
      token: token,
      expiry: expiry,
      created: Date.now()
    }
    
    sessionStorage.setItem(this.API_KEY_STORAGE_KEY, JSON.stringify(tokenData))
    
    // Auto-cleanup when expired
    setTimeout(() => {
      this.clearUserApiToken()
    }, expiresIn * 1000)
  }

  static getUserApiToken(): string | null {
    const stored = sessionStorage.getItem(this.API_KEY_STORAGE_KEY)
    if (!stored) return null

    try {
      const { token, expiry } = JSON.parse(stored)
      
      if (Date.now() > expiry) {
        this.clearUserApiToken()
        return null
      }
      
      return token
    } catch {
      this.clearUserApiToken()
      return null
    }
  }

  static clearUserApiToken() {
    sessionStorage.removeItem(this.API_KEY_STORAGE_KEY)
  }

  // Rotate API key (for user tokens)
  static async rotateUserApiToken(): Promise<string> {
    try {
      const response = await secureApiClient.post<{ token: string, expires_in: number }>(
        '/api/v1/auth/rotate-token'
      )
      
      this.setUserApiToken(response.token, response.expires_in)
      return response.token
      
    } catch (error) {
      console.error('Failed to rotate API token:', error)
      throw error
    }
  }
}

// Environment variable validation
export function validateEnvironmentVariables() {
  const required = [
    'NEXT_PUBLIC_API_URL',
    'NEXT_PUBLIC_APP_VERSION'
  ]

  const missing = required.filter(key => !process.env[key])
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }

  // Validate API URL format
  try {
    new URL(process.env.NEXT_PUBLIC_API_URL!)
  } catch {
    throw new Error('NEXT_PUBLIC_API_URL must be a valid URL')
  }

  // Warn about development-only keys in production
  if (process.env.NODE_ENV === 'production') {
    const devKeys = Object.keys(process.env).filter(key => 
      key.includes('DEV') || key.includes('DEBUG') || key.includes('TEST')
    )
    
    if (devKeys.length > 0) {
      console.warn('Development environment variables detected in production:', devKeys)
    }
  }
}
```

### Error Response Sanitization

```typescript
// lib/error-sanitization.ts - Secure error handling
export class ErrorSanitizer {
  private static readonly SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /key/i,
    /secret/i,
    /api[_-]?key/i,
    /auth/i,
    /session/i,
    /database/i,
    /sql/i,
    /query/i,
    /server/i,
    /internal/i,
    /stack\s*trace/i,
  ]

  static sanitizeErrorMessage(error: any): string {
    let message = 'An unexpected error occurred'

    try {
      // Extract error message safely
      if (typeof error === 'string') {
        message = error
      } else if (error?.message) {
        message = error.message
      } else if (error?.response?.data?.detail) {
        message = error.response.data.detail
      } else if (error?.response?.data?.message) {
        message = error.response.data.message
      }

      // Remove sensitive information
      message = this.removeSensitiveInfo(message)
      
      // Limit message length
      if (message.length > 200) {
        message = message.substring(0, 200) + '...'
      }

    } catch {
      message = 'An unexpected error occurred'
    }

    return message
  }

  private static removeSensitiveInfo(message: string): string {
    let sanitized = message

    // Remove stack traces
    sanitized = sanitized.replace(/\s+at\s+.*/g, '')
    
    // Remove file paths
    sanitized = sanitized.replace(/\/[^\s]*\.(js|ts|py|java|php)[:\d\s]*/g, '')
    
    // Remove sensitive patterns
    this.SENSITIVE_PATTERNS.forEach(pattern => {
      sanitized = sanitized.replace(new RegExp(`\\b\\w*${pattern.source}\\w*`, 'gi'), '[REDACTED]')
    })

    // Remove SQL-like patterns
    sanitized = sanitized.replace(/SELECT\s+.*FROM\s+/gi, '[SQL_QUERY]')
    sanitized = sanitized.replace(/INSERT\s+INTO\s+/gi, '[SQL_INSERT]')
    sanitized = sanitized.replace(/UPDATE\s+.*SET\s+/gi, '[SQL_UPDATE]')
    sanitized = sanitized.replace(/DELETE\s+FROM\s+/gi, '[SQL_DELETE]')

    // Remove URLs and email addresses
    sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, '[URL]')
    sanitized = sanitized.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/gi, '[EMAIL]')

    return sanitized.trim()
  }

  static getErrorCodeFromResponse(error: any): string {
    try {
      if (error?.response?.data?.code) {
        return error.response.data.code
      }
      if (error?.response?.status) {
        return `HTTP_${error.response.status}`
      }
    } catch {
      // Fallback
    }
    
    return 'UNKNOWN_ERROR'
  }

  static shouldLogError(error: any): boolean {
    const status = error?.response?.status
    
    // Don't log client errors (4xx) except authentication issues
    if (status >= 400 && status < 500) {
      return [401, 403, 429].includes(status) // Only log auth/rate limit issues
    }
    
    // Log server errors (5xx)
    if (status >= 500) {
      return true
    }
    
    // Log network errors
    if (!status && error?.code) {
      return true
    }
    
    return false
  }
}

// Enhanced error boundary component
export class SecurityErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errorId: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, errorId: '' }
  }

  static getDerivedStateFromError(error: Error) {
    const errorId = `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    
    // Log error securely
    console.error(`[ErrorBoundary:${errorId}]`, {
      message: ErrorSanitizer.sanitizeErrorMessage(error),
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href,
    })

    return { hasError: true, errorId }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Send error to monitoring service (sanitized)
    this.reportError(error, errorInfo)
  }

  private reportError(error: Error, errorInfo: React.ErrorInfo) {
    const sanitizedError = {
      message: ErrorSanitizer.sanitizeErrorMessage(error),
      errorId: this.state.errorId,
      componentStack: errorInfo.componentStack?.split('\n')[0], // Only first line
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.pathname, // Don't include query params
    }

    // Send to error monitoring service
    if (process.env.NEXT_PUBLIC_ERROR_REPORTING_URL) {
      fetch(process.env.NEXT_PUBLIC_ERROR_REPORTING_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sanitizedError),
      }).catch(() => {
        // Silently fail - don't throw errors in error handler
      })
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h2>Something went wrong</h2>
          <p>We've been notified about this issue.</p>
          <p>Error ID: {this.state.errorId}</p>
          <button onClick={() => window.location.reload()}>
            Refresh Page
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
```

### Request Timeout and Retry Security

```typescript
// lib/request-timeout.ts - Secure timeout and retry handling
export class SecureRequestManager {
  private static readonly DEFAULT_TIMEOUT = 30000 // 30 seconds
  private static readonly MAX_RETRIES = 3
  private static readonly RETRY_DELAYS = [1000, 2000, 4000] // Exponential backoff

  static async makeSecureRequest<T>(
    requestFn: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T> {
    const {
      timeout = this.DEFAULT_TIMEOUT,
      maxRetries = this.MAX_RETRIES,
      retryOn = [500, 502, 503, 504, 'ECONNRESET', 'ETIMEDOUT'],
      onRetry = () => {}
    } = options

    let lastError: any

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Request timeout after ${timeout}ms`))
          }, timeout)
        })

        // Race between request and timeout
        const result = await Promise.race([
          requestFn(),
          timeoutPromise
        ])

        return result
        
      } catch (error) {
        lastError = error
        
        // Check if error is retryable
        if (attempt === maxRetries || !this.shouldRetry(error, retryOn)) {
          throw error
        }

        // Wait before retry
        const delay = this.RETRY_DELAYS[attempt] || this.RETRY_DELAYS[this.RETRY_DELAYS.length - 1]
        await this.sleep(delay)

        // Call retry callback
        onRetry(attempt + 1, error)
      }
    }

    throw lastError
  }

  private static shouldRetry(error: any, retryOn: (number | string)[]): boolean {
    // HTTP status codes
    if (error?.response?.status && retryOn.includes(error.response.status)) {
      return true
    }

    // Network error codes
    if (error?.code && retryOn.includes(error.code)) {
      return true
    }

    // Timeout errors
    if (error?.message?.includes('timeout') && retryOn.includes('ETIMEDOUT')) {
      return true
    }

    return false
  }

  private static sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // Circuit breaker pattern
  static createCircuitBreaker<T>(
    requestFn: () => Promise<T>,
    options: CircuitBreakerOptions = {}
  ): () => Promise<T> {
    const {
      failureThreshold = 5,
      recoveryTimeout = 60000,
      monitoringPeriod = 60000
    } = options

    let failures = 0
    let lastFailureTime = 0
    let state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

    return async (): Promise<T> => {
      const now = Date.now()

      // Reset failure count if monitoring period has passed
      if (now - lastFailureTime > monitoringPeriod) {
        failures = 0
      }

      // Check circuit breaker state
      if (state === 'OPEN') {
        if (now - lastFailureTime < recoveryTimeout) {
          throw new Error('Circuit breaker is OPEN - service unavailable')
        }
        state = 'HALF_OPEN'
      }

      try {
        const result = await requestFn()
        
        // Success - reset failure count and close circuit
        failures = 0
        state = 'CLOSED'
        
        return result
        
      } catch (error) {
        failures++
        lastFailureTime = now

        // Open circuit if failure threshold reached
        if (failures >= failureThreshold) {
          state = 'OPEN'
        }

        throw error
      }
    }
  }
}

interface RequestOptions {
  timeout?: number
  maxRetries?: number
  retryOn?: (number | string)[]
  onRetry?: (attempt: number, error: any) => void
}

interface CircuitBreakerOptions {
  failureThreshold?: number
  recoveryTimeout?: number
  monitoringPeriod?: number
}

// Usage examples
export const secureApiRequest = {
  // Create tool with retry and timeout
  async createTool(data: CreateToolRequest): Promise<Tool> {
    return SecureRequestManager.makeSecureRequest(
      () => secureApiClient.post<Tool>('/api/v1/tools', data),
      {
        timeout: 15000, // 15 seconds for file uploads
        maxRetries: 2,
        retryOn: [500, 502, 503, 'ECONNRESET'],
        onRetry: (attempt, error) => {
          console.log(`Retrying tool creation (attempt ${attempt}):`, error.message)
        }
      }
    )
  },

  // Search with circuit breaker
  searchTools: SecureRequestManager.createCircuitBreaker(
    () => secureApiClient.get<PaginatedResponse<Tool>>('/api/v1/tools/search'),
    {
      failureThreshold: 3,
      recoveryTimeout: 30000,
      monitoringPeriod: 60000
    }
  )
}
```

## 6. Route & Data Protection

### Client-Side Route Protection Limitations

**CRITICAL UNDERSTANDING**: Client-side route protection is NOT a security control

```typescript
// lib/auth-guard.ts - Route protection (UX only, not security)
'use client'

import { useAuth } from '@/contexts/auth-context'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'

export function useAuthGuard(requireAuth: boolean = true) {
  const { isAuthenticated, isLoading } = useAuth()
  const router = useRouter()
  const [isAuthorized, setIsAuthorized] = useState(false)

  useEffect(() => {
    if (isLoading) return // Wait for auth check to complete

    if (requireAuth && !isAuthenticated) {
      // Redirect to login - UX improvement only
      const currentPath = encodeURIComponent(window.location.pathname + window.location.search)
      router.push(`/auth/login?redirect=${currentPath}`)
      setIsAuthorized(false)
    } else if (!requireAuth && isAuthenticated) {
      // Already logged in, redirect from auth pages
      const redirect = new URLSearchParams(window.location.search).get('redirect')
      router.push(redirect || '/dashboard')
      setIsAuthorized(false)
    } else {
      setIsAuthorized(true)
    }
  }, [isAuthenticated, isLoading, requireAuth, router])

  return { isAuthorized, isLoading }
}

// Higher-order component for protected routes
export function withAuthGuard<P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requireAuth: boolean = true
) {
  const AuthGuardedComponent = (props: P) => {
    const { isAuthorized, isLoading } = useAuthGuard(requireAuth)

    if (isLoading) {
      return <div className="loading-spinner">Checking authentication...</div>
    }

    if (!isAuthorized) {
      return <div className="auth-redirect">Redirecting...</div>
    }

    return <WrappedComponent {...props} />
  }

  AuthGuardedComponent.displayName = `withAuthGuard(${WrappedComponent.displayName || WrappedComponent.name})`
  
  return AuthGuardedComponent
}

// Protected route component
export function ProtectedRoute({ 
  children, 
  requireAuth = true,
  fallback = <div>Loading...</div>
}: {
  children: React.ReactNode
  requireAuth?: boolean
  fallback?: React.ReactNode
}) {
  const { isAuthorized, isLoading } = useAuthGuard(requireAuth)

  if (isLoading) {
    return fallback
  }

  if (!isAuthorized) {
    return null // Component will handle redirect in useAuthGuard
  }

  return <>{children}</>
}
```

**IMPORTANT SECURITY NOTE**: Route protection must be implemented on the backend API. Frontend protection only improves UX.

### Sensitive Data Handling

```typescript
// lib/data-security.ts - Secure data handling patterns
export class SensitiveDataHandler {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'token',
    'key',
    'secret',
    'ssn',
    'credit_card',
    'bank_account',
    'api_key',
    'private_key'
  ]

  // Remove sensitive data before logging or storage
  static sanitizeForLogging(data: any): any {
    if (data === null || data === undefined) return data
    
    if (typeof data === 'string') {
      return this.containsSensitiveInfo(data) ? '[REDACTED]' : data
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitizeForLogging(item))
    }

    if (typeof data === 'object') {
      const sanitized: any = {}
      
      for (const [key, value] of Object.entries(data)) {
        if (this.isSensitiveField(key)) {
          sanitized[key] = '[REDACTED]'
        } else {
          sanitized[key] = this.sanitizeForLogging(value)
        }
      }
      
      return sanitized
    }

    return data
  }

  private static isSensitiveField(fieldName: string): boolean {
    const lowerField = fieldName.toLowerCase()
    return this.SENSITIVE_FIELDS.some(sensitive => 
      lowerField.includes(sensitive)
    )
  }

  private static containsSensitiveInfo(value: string): boolean {
    const patterns = [
      /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
      /\b\d{3}-\d{2}-\d{4}\b/,                       // SSN
      /[A-Za-z0-9+/]{40,}={0,2}/,                    // Base64 tokens
      /[A-Fa-f0-9]{32,}/,                            // Hex tokens
      /pk_[a-zA-Z0-9]{24}/,                          // Stripe keys
      /sk_[a-zA-Z0-9]{24}/,                          // Stripe secrets
    ]

    return patterns.some(pattern => pattern.test(value))
  }

  // Secure storage patterns
  static secureSessionStorage = {
    setItem(key: string, value: any): void {
      try {
        // Encrypt sensitive data before storage
        const serialized = JSON.stringify(value)
        const encrypted = this.encryptData(serialized)
        sessionStorage.setItem(key, encrypted)
      } catch (error) {
        console.error('Failed to store data securely:', error)
      }
    },

    getItem<T>(key: string): T | null {
      try {
        const encrypted = sessionStorage.getItem(key)
        if (!encrypted) return null

        const decrypted = this.decryptData(encrypted)
        return JSON.parse(decrypted)
      } catch (error) {
        console.error('Failed to retrieve data securely:', error)
        return null
      }
    },

    removeItem(key: string): void {
      sessionStorage.removeItem(key)
    },

    clear(): void {
      sessionStorage.clear()
    }
  }

  private static encryptData(data: string): string {
    // Simple XOR encryption (use proper crypto library in production)
    const key = this.getEncryptionKey()
    let result = ''
    
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    
    return btoa(result)
  }

  private static decryptData(encryptedData: string): string {
    const data = atob(encryptedData)
    const key = this.getEncryptionKey()
    let result = ''
    
    for (let i = 0; i < data.length; i++) {
      result += String.fromCharCode(data.charCodeAt(i) ^ key.charCodeAt(i % key.length))
    }
    
    return result
  }

  private static getEncryptionKey(): string {
    // Generate key from browser fingerprint (basic approach)
    const fingerprint = [
      navigator.userAgent,
      navigator.language,
      screen.width,
      screen.height,
      new Date().getTimezoneOffset()
    ].join('|')
    
    return btoa(fingerprint).substring(0, 32)
  }
}

// Secure user preferences storage
export class SecurePreferences {
  private static readonly PREFS_KEY = '__user_prefs'

  static setPreference(key: string, value: any): void {
    const prefs = this.getAllPreferences()
    prefs[key] = value
    
    SensitiveDataHandler.secureSessionStorage.setItem(this.PREFS_KEY, prefs)
  }

  static getPreference<T>(key: string, defaultValue?: T): T | undefined {
    const prefs = this.getAllPreferences()
    return prefs[key] !== undefined ? prefs[key] : defaultValue
  }

  static getAllPreferences(): Record<string, any> {
    return SensitiveDataHandler.secureSessionStorage.getItem(this.PREFS_KEY) || {}
  }

  static removePreference(key: string): void {
    const prefs = this.getAllPreferences()
    delete prefs[key]
    
    SensitiveDataHandler.secureSessionStorage.setItem(this.PREFS_KEY, prefs)
  }

  static clearAllPreferences(): void {
    SensitiveDataHandler.secureSessionStorage.removeItem(this.PREFS_KEY)
  }
}
```

### Component-Level Security Checks

```typescript
// components/security/secure-component.tsx - Component-level security
import React, { useEffect, useState } from 'react'
import { useAuth } from '@/contexts/auth-context'

interface SecureComponentProps {
  children: React.ReactNode
  requiredPermissions?: string[]
  fallback?: React.ReactNode
  onUnauthorized?: () => void
}

export function SecureComponent({ 
  children, 
  requiredPermissions = [], 
  fallback = <div>Access denied</div>,
  onUnauthorized
}: SecureComponentProps) {
  const { user, isAuthenticated } = useAuth()
  const [hasAccess, setHasAccess] = useState(false)

  useEffect(() => {
    const checkPermissions = async () => {
      if (!isAuthenticated || !user) {
        setHasAccess(false)
        onUnauthorized?.()
        return
      }

      // Check if user has required permissions
      const userPermissions = user.permissions || []
      const hasAllPermissions = requiredPermissions.every(permission =>
        userPermissions.includes(permission)
      )

      setHasAccess(hasAllPermissions)

      if (!hasAllPermissions) {
        onUnauthorized?.()
      }
    }

    checkPermissions()
  }, [user, isAuthenticated, requiredPermissions, onUnauthorized])

  if (!hasAccess) {
    return <>{fallback}</>
  }

  return <>{children}</>
}

// Usage examples
function AdminPanel() {
  return (
    <SecureComponent 
      requiredPermissions={['admin', 'user_management']}
      fallback={<div>Admin access required</div>}
      onUnauthorized={() => console.log('Unauthorized admin access attempt')}
    >
      <div className="admin-content">
        {/* Admin-only content */}
      </div>
    </SecureComponent>
  )
}

function ToolOwnerActions({ tool }: { tool: Tool }) {
  const { user } = useAuth()
  const isOwner = user?.id === tool.owner_id

  return (
    <SecureComponent 
      requiredPermissions={[]} // Custom check below
      fallback={null}
    >
      {isOwner && (
        <div className="owner-actions">
          <button>Edit Tool</button>
          <button>Delete Tool</button>
        </div>
      )}
    </SecureComponent>
  )
}
```

### Data Exposure Prevention

```typescript
// lib/data-exposure-prevention.ts - Prevent data leaks
export class DataExposurePrevention {
  // Remove sensitive data from objects before rendering
  static sanitizeForDisplay<T extends Record<string, any>>(
    data: T,
    allowedFields: (keyof T)[]
  ): Partial<T> {
    const sanitized: Partial<T> = {}
    
    allowedFields.forEach(field => {
      if (data[field] !== undefined) {
        sanitized[field] = data[field]
      }
    })
    
    return sanitized
  }

  // Mask sensitive data for display
  static maskSensitiveData(value: string, type: 'email' | 'phone' | 'card' | 'generic'): string {
    switch (type) {
      case 'email':
        const [username, domain] = value.split('@')
        return `${username.substring(0, 2)}***@${domain}`
        
      case 'phone':
        return value.replace(/(\d{3})\d{3}(\d{4})/, '$1-***-$2')
        
      case 'card':
        return `****-****-****-${value.slice(-4)}`
        
      default:
        return `${value.substring(0, 2)}***${value.slice(-2)}`
    }
  }

  // Prevent data inspection in dev tools
  static hideFromDevTools(data: any): any {
    if (process.env.NODE_ENV === 'production') {
      // In production, make data less accessible in dev tools
      Object.defineProperty(data, '_sensitive', {
        value: true,
        enumerable: false,
        writable: false
      })
      
      // Override toString to hide sensitive data
      if (typeof data === 'object' && data !== null) {
        data.toString = () => '[SecureObject]'
        data.valueOf = () => '[SecureObject]'
        data.toJSON = () => ({ _secure: true })
      }
    }
    
    return data
  }

  // Clear data from memory
  static secureDelete(obj: any): void {
    if (typeof obj !== 'object' || obj === null) return

    Object.keys(obj).forEach(key => {
      if (typeof obj[key] === 'object') {
        this.secureDelete(obj[key])
      }
      delete obj[key]
    })
  }

  // Prevent console logging in production
  static secureLog(...args: any[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.log(...args.map(arg => 
        SensitiveDataHandler.sanitizeForLogging(arg)
      ))
    }
    // Never log in production
  }
}

// Secure data component wrapper
export function SecureDataDisplay<T extends Record<string, any>>({
  data,
  allowedFields,
  maskFields = {},
  children
}: {
  data: T
  allowedFields: (keyof T)[]
  maskFields?: Partial<Record<keyof T, 'email' | 'phone' | 'card' | 'generic'>>
  children: (sanitizedData: Partial<T>) => React.ReactNode
}) {
  const sanitizedData = DataExposurePrevention.sanitizeForDisplay(data, allowedFields)
  
  // Mask specified fields
  Object.entries(maskFields).forEach(([field, maskType]) => {
    if (sanitizedData[field] && typeof sanitizedData[field] === 'string') {
      sanitizedData[field] = DataExposurePrevention.maskSensitiveData(
        sanitizedData[field] as string,
        maskType
      )
    }
  })

  return <>{children(sanitizedData)}</>
}

// Usage example
function UserProfile({ user }: { user: User }) {
  return (
    <SecureDataDisplay
      data={user}
      allowedFields={['id', 'full_name', 'email', 'phone', 'created_at']}
      maskFields={{ email: 'email', phone: 'phone' }}
    >
      {(sanitizedUser) => (
        <div className="user-profile">
          <h2>{sanitizedUser.full_name}</h2>
          <p>Email: {sanitizedUser.email}</p>
          <p>Phone: {sanitizedUser.phone}</p>
          <p>Member since: {sanitizedUser.created_at}</p>
        </div>
      )}
    </SecureDataDisplay>
  )
}
```

## 7. Production Security Hardening

### Next.js Security Headers Configuration

```typescript
// next.config.ts - Production-ready security configuration
import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === 'development'
const isProd = process.env.NODE_ENV === 'production'

const nextConfig: NextConfig = {
  // Security headers
  async headers() {
    const cspDirectives = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'" + 
        (isDev ? " 'unsafe-eval'" : "") + 
        " https://vercel.live https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' blob: data: https: *.amazonaws.com *.vercel.com",
      "font-src 'self' https://fonts.gstatic.com",
      "connect-src 'self' " +
        (isDev ? "ws://localhost:3000 ws://localhost:8002" : "") +
        " https://api.wippestoolen.com wss://api.wippestoolen.com" +
        " https://js.stripe.com https://api.stripe.com" +
        " https://vitals.vercel-insights.com",
      "media-src 'self' *.amazonaws.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "worker-src 'self' blob:",
      "manifest-src 'self'",
    ]

    if (isProd) {
      cspDirectives.push("upgrade-insecure-requests")
    }

    return [
      {
        source: '/(.*)',
        headers: [
          // Content Security Policy
          {
            key: 'Content-Security-Policy',
            value: cspDirectives.join('; ')
          },
          // Strict Transport Security (HTTPS only)
          ...(isProd ? [{
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload'
          }] : []),
          // Prevent XSS attacks
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block'
          },
          // Prevent MIME type sniffing
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff'
          },
          // Prevent clickjacking
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          // Referrer policy
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          // Permissions policy
          {
            key: 'Permissions-Policy',
            value: [
              'camera=self',
              'microphone=()',
              'geolocation=self',
              'payment=self',
              'usb=()',
              'magnetometer=()',
              'accelerometer=()',
              'ambient-light-sensor=()',
              'gyroscope=()',
              'speaker=()'
            ].join(', ')
          },
          // Cross-origin policies
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin'
          },
          {
            key: 'Cross-Origin-Embedder-Policy',
            value: 'require-corp'
          },
          {
            key: 'Cross-Origin-Resource-Policy',
            value: 'same-origin'
          },
          // Remove server information
          {
            key: 'Server',
            value: '' // Hide server information
          },
        ]
      }
    ]
  },

  // Image security
  images: {
    domains: isDev ? ['localhost'] : ['api.wippestoolen.com'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.amazonaws.com',
        port: '',
        pathname: '/wippestoolen-assets/**',
      }
    ],
    formats: ['image/webp', 'image/avif'],
    minimumCacheTTL: 300,
    dangerouslyAllowSVG: false, // Prevent SVG XSS
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Compiler security
  compiler: {
    // Remove console.* in production
    removeConsole: isProd ? {
      exclude: ['error']
    } : false
  },

  // Build-time security
  typescript: {
    ignoreBuildErrors: false, // Enforce type safety
  },
  
  eslint: {
    ignoreDuringBuilds: false, // Enforce linting
  },

  // Experimental features
  experimental: {
    // Enable strict mode
    strictMode: true,
  },

  // Security-focused redirects
  async redirects() {
    return [
      // Redirect HTTP to HTTPS in production
      ...(isProd ? [{
        source: '/(.*)',
        has: [
          {
            type: 'header',
            key: 'x-forwarded-proto',
            value: 'http',
          },
        ],
        destination: 'https://wippestoolen.com/$1',
        permanent: true,
      }] : []),
      // Redirect old API endpoints
      {
        source: '/api/:path*',
        destination: '/404',
        permanent: true,
      }
    ]
  },

  // Rewrites for security
  async rewrites() {
    return [
      // Hide API proxy
      {
        source: '/api-proxy/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL}/:path*`,
      }
    ]
  }
};

export default nextConfig;
```

### Environment Variable Security

```typescript
// lib/env-security.ts - Secure environment variable handling
interface EnvironmentConfig {
  // Public variables (safe to expose to client)
  NEXT_PUBLIC_API_URL: string
  NEXT_PUBLIC_APP_VERSION: string
  NEXT_PUBLIC_ENVIRONMENT: 'development' | 'staging' | 'production'
  NEXT_PUBLIC_SENTRY_DSN?: string
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?: string
  
  // Server-only variables (never exposed to client)
  DATABASE_URL?: string
  JWT_SECRET?: string
  STRIPE_SECRET_KEY?: string
  AWS_ACCESS_KEY_ID?: string
  AWS_SECRET_ACCESS_KEY?: string
}

export class EnvironmentSecurity {
  private static validatedConfig: EnvironmentConfig | null = null

  static validateEnvironment(): EnvironmentConfig {
    if (this.validatedConfig) {
      return this.validatedConfig
    }

    const config: EnvironmentConfig = {
      NEXT_PUBLIC_API_URL: this.requireEnvVar('NEXT_PUBLIC_API_URL'),
      NEXT_PUBLIC_APP_VERSION: this.requireEnvVar('NEXT_PUBLIC_APP_VERSION'),
      NEXT_PUBLIC_ENVIRONMENT: this.validateEnvironmentType(
        this.requireEnvVar('NEXT_PUBLIC_ENVIRONMENT')
      ),
      NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    }

    // Validate API URL format
    this.validateApiUrl(config.NEXT_PUBLIC_API_URL)

    // Check for development keys in production
    if (config.NEXT_PUBLIC_ENVIRONMENT === 'production') {
      this.validateProductionEnvironment()
    }

    this.validatedConfig = config
    return config
  }

  private static requireEnvVar(name: string): string {
    const value = process.env[name]
    if (!value) {
      throw new Error(`Missing required environment variable: ${name}`)
    }
    return value
  }

  private static validateEnvironmentType(env: string): 'development' | 'staging' | 'production' {
    if (!['development', 'staging', 'production'].includes(env)) {
      throw new Error(`Invalid NEXT_PUBLIC_ENVIRONMENT: ${env}`)
    }
    return env as 'development' | 'staging' | 'production'
  }

  private static validateApiUrl(url: string): void {
    try {
      const urlObj = new URL(url)
      
      // Ensure HTTPS in production
      if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
        throw new Error('API URL must use HTTPS in production')
      }

      // Validate allowed domains
      const allowedDomains = [
        'localhost',
        '127.0.0.1',
        'api.wippestoolen.com',
        'staging-api.wippestoolen.com'
      ]

      if (!allowedDomains.includes(urlObj.hostname)) {
        throw new Error(`API domain not allowed: ${urlObj.hostname}`)
      }

    } catch (error) {
      throw new Error(`Invalid NEXT_PUBLIC_API_URL: ${error.message}`)
    }
  }

  private static validateProductionEnvironment(): void {
    const warnings: string[] = []
    const errors: string[] = []

    // Check for development-only variables
    const devOnlyVars = Object.keys(process.env).filter(key =>
      key.includes('DEV') || 
      key.includes('DEBUG') || 
      key.includes('TEST') ||
      key.includes('LOCAL')
    )

    if (devOnlyVars.length > 0) {
      warnings.push(`Development variables found in production: ${devOnlyVars.join(', ')}`)
    }

    // Check for required production variables
    const requiredProdVars = [
      'SENTRY_DSN',
      'STRIPE_SECRET_KEY',
      'DATABASE_URL'
    ]

    const missingProdVars = requiredProdVars.filter(varName => !process.env[varName])
    
    if (missingProdVars.length > 0) {
      warnings.push(`Missing recommended production variables: ${missingProdVars.join(', ')}`)
    }

    // Log warnings
    if (warnings.length > 0) {
      console.warn('[ENV SECURITY]', warnings.join('; '))
    }

    if (errors.length > 0) {
      throw new Error(`Production environment validation failed: ${errors.join('; ')}`)
    }
  }

  static getSecureConfig(): EnvironmentConfig {
    return this.validateEnvironment()
  }

  // Client-side safe config (only public variables)
  static getClientConfig(): Pick<EnvironmentConfig, 
    'NEXT_PUBLIC_API_URL' | 
    'NEXT_PUBLIC_APP_VERSION' | 
    'NEXT_PUBLIC_ENVIRONMENT' |
    'NEXT_PUBLIC_SENTRY_DSN' |
    'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY'
  > {
    const config = this.getSecureConfig()
    
    return {
      NEXT_PUBLIC_API_URL: config.NEXT_PUBLIC_API_URL,
      NEXT_PUBLIC_APP_VERSION: config.NEXT_PUBLIC_APP_VERSION,
      NEXT_PUBLIC_ENVIRONMENT: config.NEXT_PUBLIC_ENVIRONMENT,
      NEXT_PUBLIC_SENTRY_DSN: config.NEXT_PUBLIC_SENTRY_DSN,
      NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: config.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
    }
  }
}

// Initialize environment validation at startup
try {
  EnvironmentSecurity.validateEnvironment()
  console.log('✅ Environment variables validated successfully')
} catch (error) {
  console.error('❌ Environment validation failed:', error.message)
  process.exit(1)
}

// Export validated config for use throughout app
export const secureConfig = EnvironmentSecurity.getSecureConfig()
export const clientConfig = EnvironmentSecurity.getClientConfig()
```

### Build-Time Security Checks

```typescript
// scripts/security-check.js - Run during build process
const fs = require('fs')
const path = require('path')

class BuildSecurityChecker {
  constructor() {
    this.errors = []
    this.warnings = []
  }

  async runAllChecks() {
    console.log('🔍 Running security checks...')
    
    await this.checkDependencyVulnerabilities()
    await this.checkSourceCodeSecurity()
    await this.checkConfigurationSecurity()
    await this.checkBuildArtifacts()

    this.reportResults()
  }

  async checkDependencyVulnerabilities() {
    const { execSync } = require('child_process')
    
    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', { encoding: 'utf8' })
      const auditData = JSON.parse(auditOutput)

      if (auditData.metadata.vulnerabilities.total > 0) {
        const { high, critical } = auditData.metadata.vulnerabilities
        
        if (critical > 0) {
          this.errors.push(`${critical} critical vulnerabilities found in dependencies`)
        }
        
        if (high > 0) {
          this.warnings.push(`${high} high-severity vulnerabilities found in dependencies`)
        }
      }

    } catch (error) {
      if (error.status !== 0) {
        this.errors.push('Dependency security audit failed')
      }
    }
  }

  async checkSourceCodeSecurity() {
    const srcDir = path.join(process.cwd(), 'src')
    
    await this.scanDirectory(srcDir, (filePath, content) => {
      // Check for hardcoded secrets
      const secretPatterns = [
        /api[_-]?key\s*[:=]\s*['""][^'""]+['""]/i,
        /secret[_-]?key\s*[:=]\s*['""][^'""]+['""]]/i,
        /password\s*[:=]\s*['""][^'""]+['""]]/i,
        /token\s*[:=]\s*['""][^'""]+['""]]/i,
        /private[_-]?key\s*[:=]\s*['""][^'""]+['""]]/i,
      ]

      secretPatterns.forEach(pattern => {
        if (pattern.test(content)) {
          this.errors.push(`Potential hardcoded secret in ${filePath}`)
        }
      })

      // Check for insecure patterns
      const insecurePatterns = [
        { pattern: /dangerouslySetInnerHTML/g, message: 'dangerouslySetInnerHTML usage found' },
        { pattern: /eval\s*\(/g, message: 'eval() usage found' },
        { pattern: /Function\s*\(/g, message: 'Function() constructor usage found' },
        { pattern: /innerHTML\s*=/g, message: 'innerHTML assignment found' },
        { pattern: /document\.write/g, message: 'document.write usage found' },
      ]

      insecurePatterns.forEach(({ pattern, message }) => {
        const matches = content.match(pattern)
        if (matches) {
          this.warnings.push(`${message} in ${filePath} (${matches.length} occurrences)`)
        }
      })
    })
  }

  async checkConfigurationSecurity() {
    // Check Next.js config
    const nextConfigPath = path.join(process.cwd(), 'next.config.ts')
    if (fs.existsSync(nextConfigPath)) {
      const configContent = fs.readFileSync(nextConfigPath, 'utf8')
      
      if (!configContent.includes('Content-Security-Policy')) {
        this.warnings.push('No Content Security Policy found in next.config.ts')
      }
      
      if (!configContent.includes('X-Frame-Options')) {
        this.warnings.push('No X-Frame-Options header found in next.config.ts')
      }
    }

    // Check environment variables
    if (!process.env.NEXT_PUBLIC_API_URL) {
      this.errors.push('NEXT_PUBLIC_API_URL environment variable not set')
    }

    if (process.env.NODE_ENV === 'production') {
      const devEnvVars = Object.keys(process.env).filter(key => 
        key.includes('DEV') || key.includes('DEBUG') || key.includes('TEST')
      )
      
      if (devEnvVars.length > 0) {
        this.warnings.push(`Development environment variables in production: ${devEnvVars.join(', ')}`)
      }
    }
  }

  async checkBuildArtifacts() {
    const buildDir = path.join(process.cwd(), '.next')
    
    if (fs.existsSync(buildDir)) {
      await this.scanDirectory(buildDir, (filePath, content) => {
        // Check for exposed secrets in build artifacts
        if (filePath.endsWith('.js') || filePath.endsWith('.html')) {
          const secretPatterns = [
            /sk_[a-zA-Z0-9]{24,}/g, // Stripe secret keys
            /pk_[a-zA-Z0-9]{24,}/g, // Stripe public keys (should be public but verify)
            /[A-Za-z0-9+/]{40,}={0,2}/g, // Long base64 strings (potential tokens)
          ]

          secretPatterns.forEach(pattern => {
            const matches = content.match(pattern)
            if (matches) {
              this.warnings.push(`Potential secret in build artifact: ${filePath}`)
            }
          })
        }
      })
    }
  }

  async scanDirectory(dir, callback) {
    if (!fs.existsSync(dir)) return

    const files = fs.readdirSync(dir)
    
    for (const file of files) {
      const filePath = path.join(dir, file)
      const stat = fs.statSync(filePath)
      
      if (stat.isDirectory()) {
        await this.scanDirectory(filePath, callback)
      } else if (stat.isFile() && this.shouldScanFile(filePath)) {
        const content = fs.readFileSync(filePath, 'utf8')
        callback(filePath, content)
      }
    }
  }

  shouldScanFile(filePath) {
    const ext = path.extname(filePath).toLowerCase()
    const scanExtensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.env', '.config.js']
    return scanExtensions.includes(ext)
  }

  reportResults() {
    console.log('\n📋 Security Check Results:')
    
    if (this.errors.length > 0) {
      console.log('\n❌ ERRORS (Build should fail):')
      this.errors.forEach(error => console.log(`  • ${error}`))
    }
    
    if (this.warnings.length > 0) {
      console.log('\n⚠️  WARNINGS (Review recommended):')
      this.warnings.forEach(warning => console.log(`  • ${warning}`))
    }
    
    if (this.errors.length === 0 && this.warnings.length === 0) {
      console.log('✅ No security issues found')
    }

    console.log(`\n📊 Summary: ${this.errors.length} errors, ${this.warnings.length} warnings`)
    
    // Fail build if critical errors found
    if (this.errors.length > 0) {
      process.exit(1)
    }
  }
}

// Run security checks
if (require.main === module) {
  new BuildSecurityChecker().runAllChecks().catch(error => {
    console.error('Security check failed:', error)
    process.exit(1)
  })
}

module.exports = BuildSecurityChecker
```

### Dependency Vulnerability Scanning

```json
// package.json - Add security scripts
{
  "scripts": {
    "security:audit": "npm audit --audit-level=high",
    "security:check": "node scripts/security-check.js",
    "security:dependencies": "npm audit && npm outdated",
    "prebuild": "npm run security:check",
    "prestart": "npm run security:audit"
  },
  "devDependencies": {
    "@types/node": "^20",
    "audit-ci": "^6.6.1"
  }
}
```

```yaml
# .github/workflows/security.yml - GitHub Actions security workflow
name: Security Scan

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  security:
    runs-on: ubuntu-latest
    
    steps:
    - uses: actions/checkout@v4
    
    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run dependency audit
      run: npm audit --audit-level=high
      
    - name: Run security checks
      run: npm run security:check
      
    - name: Check for known vulnerabilities
      run: npx audit-ci --high --critical
      
    - name: CodeQL Analysis
      uses: github/codeql-action/analyze@v3
      with:
        languages: typescript
```

### Security Monitoring and Logging

```typescript
// lib/security-monitoring.ts - Production security monitoring
export class SecurityMonitor {
  private static instance: SecurityMonitor
  private securityLog: SecurityEvent[] = []
  
  static getInstance(): SecurityMonitor {
    if (!this.instance) {
      this.instance = new SecurityMonitor()
    }
    return this.instance
  }

  logSecurityEvent(event: SecurityEvent): void {
    const enhancedEvent: SecurityEvent = {
      ...event,
      id: `sec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.pathname,
      referrer: document.referrer,
      sessionId: this.getSessionId(),
    }

    this.securityLog.push(enhancedEvent)
    
    // Send to monitoring service in production
    if (process.env.NODE_ENV === 'production') {
      this.sendToMonitoring(enhancedEvent)
    } else {
      console.warn('[SECURITY EVENT]', enhancedEvent)
    }

    // Check for attack patterns
    this.analyzeSecurityEvent(enhancedEvent)
  }

  private async sendToMonitoring(event: SecurityEvent): Promise<void> {
    try {
      const monitoringUrl = process.env.NEXT_PUBLIC_SECURITY_MONITORING_URL
      if (!monitoringUrl) return

      await fetch(monitoringUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_MONITORING_TOKEN}`
        },
        body: JSON.stringify(event)
      })
    } catch (error) {
      console.error('Failed to send security event to monitoring:', error)
    }
  }

  private analyzeSecurityEvent(event: SecurityEvent): void {
    // Detect suspicious patterns
    const recentEvents = this.getRecentEvents(5 * 60 * 1000) // Last 5 minutes
    
    // Check for rapid authentication failures
    const authFailures = recentEvents.filter(e => 
      e.type === 'auth_failure' && e.sessionId === event.sessionId
    )
    
    if (authFailures.length >= 5) {
      this.logSecurityEvent({
        type: 'potential_brute_force',
        severity: 'high',
        description: `${authFailures.length} authentication failures in 5 minutes`,
        metadata: { sessionId: event.sessionId }
      })
    }

    // Check for XSS attempts
    if (event.type === 'xss_attempt') {
      this.logSecurityEvent({
        type: 'security_alert',
        severity: 'high',
        description: 'XSS attempt detected',
        metadata: event.metadata
      })
    }

    // Check for suspicious form submissions
    const formSubmissions = recentEvents.filter(e => 
      e.type === 'form_submission' && e.sessionId === event.sessionId
    )
    
    if (formSubmissions.length >= 10) {
      this.logSecurityEvent({
        type: 'potential_bot_activity',
        severity: 'medium',
        description: `${formSubmissions.length} form submissions in 5 minutes`,
        metadata: { sessionId: event.sessionId }
      })
    }
  }

  private getRecentEvents(timeWindow: number): SecurityEvent[] {
    const cutoff = new Date(Date.now() - timeWindow).toISOString()
    return this.securityLog.filter(event => event.timestamp > cutoff)
  }

  private getSessionId(): string {
    let sessionId = sessionStorage.getItem('security_session_id')
    if (!sessionId) {
      sessionId = `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      sessionStorage.setItem('security_session_id', sessionId)
    }
    return sessionId
  }

  // Public methods for logging specific security events
  logAuthFailure(reason: string, metadata?: any): void {
    this.logSecurityEvent({
      type: 'auth_failure',
      severity: 'medium',
      description: `Authentication failed: ${reason}`,
      metadata
    })
  }

  logXSSAttempt(payload: string, location: string): void {
    this.logSecurityEvent({
      type: 'xss_attempt',
      severity: 'high',
      description: 'XSS payload detected',
      metadata: {
        payload: payload.substring(0, 100), // Limit payload length
        location
      }
    })
  }

  logCSRFFailure(expectedToken: string, receivedToken: string): void {
    this.logSecurityEvent({
      type: 'csrf_failure',
      severity: 'high',
      description: 'CSRF token mismatch',
      metadata: {
        expected: expectedToken?.substring(0, 8) + '***',
        received: receivedToken?.substring(0, 8) + '***'
      }
    })
  }

  logFormSubmission(formType: string, isValid: boolean, errors?: string[]): void {
    this.logSecurityEvent({
      type: 'form_submission',
      severity: isValid ? 'info' : 'medium',
      description: `Form submission: ${formType}`,
      metadata: {
        formType,
        isValid,
        errors: errors?.slice(0, 3) // Limit error details
      }
    })
  }

  logUnauthorizedAccess(resource: string, requiredPermission: string): void {
    this.logSecurityEvent({
      type: 'unauthorized_access',
      severity: 'high',
      description: `Unauthorized access attempt to ${resource}`,
      metadata: {
        resource,
        requiredPermission
      }
    })
  }
}

interface SecurityEvent {
  id?: string
  type: 'auth_failure' | 'xss_attempt' | 'csrf_failure' | 'form_submission' | 
        'unauthorized_access' | 'potential_brute_force' | 'potential_bot_activity' |
        'security_alert'
  severity: 'info' | 'low' | 'medium' | 'high' | 'critical'
  description: string
  timestamp?: string
  userAgent?: string
  url?: string
  referrer?: string
  sessionId?: string
  metadata?: any
}

// Create singleton instance
export const securityMonitor = SecurityMonitor.getInstance()

// Hook for form security monitoring
export function useFormSecurity(formType: string) {
  const submitWithSecurity = useCallback((
    data: any, 
    validationFn: (data: any) => { isValid: boolean; errors?: string[] }
  ) => {
    const validation = validationFn(data)
    
    securityMonitor.logFormSubmission(
      formType,
      validation.isValid,
      validation.errors
    )

    return validation
  }, [formType])

  return { submitWithSecurity }
}
```

## Implementation Priority and Risk Matrix

| Security Pattern | Current Risk Level | Implementation Priority | Estimated Effort |
|---|---|---|---|
| **Token Storage (localStorage → HttpOnly)** | CRITICAL | P0 (Immediate) | 2-3 days |
| **Content Security Policy** | HIGH | P0 (Immediate) | 1-2 days |
| **Input Sanitization** | HIGH | P1 (Week 1) | 3-4 days |
| **CSRF Protection** | MEDIUM | P1 (Week 1) | 2-3 days |
| **Error Message Sanitization** | MEDIUM | P2 (Week 2) | 1-2 days |
| **Security Headers** | MEDIUM | P2 (Week 2) | 1 day |
| **File Upload Security** | MEDIUM | P2 (Week 2) | 2-3 days |
| **Rate Limiting** | LOW | P3 (Week 3) | 1-2 days |
| **Security Monitoring** | LOW | P3 (Week 3) | 2-3 days |

## Quick Win Security Improvements

1. **Immediate (< 1 hour)**:
   - Add basic CSP header to Next.js config
   - Enable security headers (X-Frame-Options, etc.)
   - Remove console.log statements from production build

2. **Same Day (< 8 hours)**:
   - Implement input length validation on all forms
   - Add basic XSS pattern detection
   - Set up environment variable validation

3. **This Week (< 40 hours)**:
   - Replace localStorage with httpOnly cookies for tokens
   - Implement comprehensive input sanitization
   - Add CSRF token protection
   - Set up basic security monitoring

## Conclusion

The current Wippestoolen frontend implementation has several critical security vulnerabilities that must be addressed immediately. The highest priority issues are:

1. **JWT tokens in localStorage** - Replace with httpOnly cookies
2. **Missing Content Security Policy** - Implement comprehensive CSP
3. **No input sanitization** - Add client and server-side validation
4. **Missing CSRF protection** - Implement token-based CSRF protection

Following this security documentation and implementing the recommended patterns will significantly improve the application's security posture and protect user data from common web vulnerabilities.

**Next Steps**:
1. Review and implement P0 security patterns immediately
2. Set up security monitoring and logging
3. Conduct security testing of implemented patterns
4. Schedule regular security audits and dependency updates
5. Train development team on secure coding practices

All security implementations should be tested thoroughly in a staging environment before production deployment.