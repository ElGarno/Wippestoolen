# Authentication UI Components Documentation

## Overview

This document provides comprehensive specifications for implementing authentication UI components in the Wippestoolen tool-sharing platform. The authentication system integrates with the existing Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui foundation to provide secure, accessible, and user-friendly authentication experiences.

## Table of Contents

1. [Authentication Forms Design](#authentication-forms-design)
2. [User Profile Interface](#user-profile-interface)
3. [Protected Route Implementation](#protected-route-implementation)
4. [Error Handling & UX](#error-handling--ux)
5. [Component Architecture](#component-architecture)
6. [Accessibility & Best Practices](#accessibility--best-practices)

## Authentication Forms Design

### 1.1 Login Form (`/auth/login`)

#### Design Specifications

```typescript
// components/auth/LoginForm.tsx
interface LoginFormData {
  email: string;
  password: string;
  rememberMe?: boolean;
}

interface LoginFormProps {
  redirectTo?: string;
  onSuccess?: (user: User) => void;
  className?: string;
}
```

#### Visual Layout (Mobile-First)

```jsx
<Card className="w-full max-w-md mx-auto">
  <CardHeader className="space-y-1">
    <CardTitle className="text-2xl font-bold text-center">
      Welcome back
    </CardTitle>
    <CardDescription className="text-center">
      Sign in to your Wippestoolen account
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Email Input */}
    <div className="space-y-2">
      <Label htmlFor="email">Email address</Label>
      <Input
        id="email"
        type="email"
        placeholder="your@email.com"
        className="w-full"
        aria-describedby="email-error"
      />
      {/* Error state */}
      <p id="email-error" className="text-sm text-red-600" role="alert">
        {emailError}
      </p>
    </div>

    {/* Password Input */}
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label htmlFor="password">Password</Label>
        <Button
          variant="link"
          size="sm"
          className="px-0 font-normal"
          asChild
        >
          <Link href="/auth/forgot-password">Forgot password?</Link>
        </Button>
      </div>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          placeholder="Enter your password"
          className="w-full pr-10"
          aria-describedby="password-error"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      <p id="password-error" className="text-sm text-red-600" role="alert">
        {passwordError}
      </p>
    </div>

    {/* Remember Me */}
    <div className="flex items-center space-x-2">
      <Checkbox id="remember-me" />
      <Label
        htmlFor="remember-me"
        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
      >
        Keep me signed in
      </Label>
    </div>

    {/* Submit Button */}
    <Button
      type="submit"
      className="w-full"
      disabled={isLoading}
      aria-describedby="login-error"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Signing in...
        </>
      ) : (
        "Sign in"
      )}
    </Button>

    {/* General Error */}
    {generalError && (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription id="login-error">
          {generalError}
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
  <CardFooter>
    <p className="text-center text-sm text-gray-600 w-full">
      Don't have an account?{" "}
      <Button variant="link" className="p-0 font-semibold" asChild>
        <Link href="/auth/register">Sign up here</Link>
      </Button>
    </p>
  </CardFooter>
</Card>
```

#### Form Validation Rules

```typescript
const loginValidationSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(8, "Password must be at least 8 characters"),
  rememberMe: z.boolean().optional(),
});

// Real-time validation patterns
const useLoginValidation = () => {
  const [errors, setErrors] = useState<Record<string, string>>({});
  
  const validateField = useCallback((field: string, value: string) => {
    try {
      loginValidationSchema.pick({ [field]: true }).parse({ [field]: value });
      setErrors(prev => ({ ...prev, [field]: "" }));
    } catch (error) {
      if (error instanceof z.ZodError) {
        setErrors(prev => ({
          ...prev,
          [field]: error.errors[0].message
        }));
      }
    }
  }, []);

  return { errors, validateField };
};
```

### 1.2 Registration Form (`/auth/register`)

#### Design Specifications

```typescript
interface RegisterFormData {
  email: string;
  password: string;
  confirmPassword: string;
  full_name: string;
  phone: string;
  location: string;
  termsAccepted: boolean;
}
```

#### Visual Layout

```jsx
<Card className="w-full max-w-md mx-auto">
  <CardHeader className="space-y-1">
    <CardTitle className="text-2xl font-bold text-center">
      Create your account
    </CardTitle>
    <CardDescription className="text-center">
      Join the Wippestoolen community
    </CardDescription>
  </CardHeader>
  <CardContent className="space-y-4">
    {/* Full Name */}
    <div className="space-y-2">
      <Label htmlFor="full_name">Full name</Label>
      <Input
        id="full_name"
        type="text"
        placeholder="John Doe"
        className="w-full"
        aria-describedby="full_name-error"
      />
      <p id="full_name-error" className="text-sm text-red-600" role="alert">
        {fullNameError}
      </p>
    </div>

    {/* Email */}
    <div className="space-y-2">
      <Label htmlFor="email">Email address</Label>
      <Input
        id="email"
        type="email"
        placeholder="your@email.com"
        className="w-full"
        aria-describedby="email-error"
      />
      <p id="email-error" className="text-sm text-red-600" role="alert">
        {emailError}
      </p>
    </div>

    {/* Phone */}
    <div className="space-y-2">
      <Label htmlFor="phone">Phone number</Label>
      <Input
        id="phone"
        type="tel"
        placeholder="+1 (555) 123-4567"
        className="w-full"
        aria-describedby="phone-error"
      />
      <p id="phone-error" className="text-sm text-red-600" role="alert">
        {phoneError}
      </p>
    </div>

    {/* Location */}
    <div className="space-y-2">
      <Label htmlFor="location">Location</Label>
      <Input
        id="location"
        type="text"
        placeholder="City, State/Province"
        className="w-full"
        aria-describedby="location-error"
      />
      <p id="location-error" className="text-sm text-red-600" role="alert">
        {locationError}
      </p>
    </div>

    {/* Password with Strength Indicator */}
    <div className="space-y-2">
      <Label htmlFor="password">Password</Label>
      <div className="relative">
        <Input
          id="password"
          type={showPassword ? "text" : "password"}
          placeholder="Create a strong password"
          className="w-full pr-10"
          aria-describedby="password-error password-strength"
        />
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
          onClick={() => setShowPassword(!showPassword)}
          aria-label={showPassword ? "Hide password" : "Show password"}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </Button>
      </div>
      
      {/* Password Strength Indicator */}
      <div id="password-strength" className="space-y-1">
        <div className="flex space-x-1">
          {[1, 2, 3, 4].map((level) => (
            <div
              key={level}
              className={cn(
                "h-2 flex-1 rounded-full",
                passwordStrength >= level
                  ? passwordStrength === 1
                    ? "bg-red-500"
                    : passwordStrength === 2
                    ? "bg-orange-500"
                    : passwordStrength === 3
                    ? "bg-yellow-500"
                    : "bg-green-500"
                  : "bg-gray-200"
              )}
            />
          ))}
        </div>
        <p className="text-xs text-gray-600">
          Password strength: {passwordStrengthText}
        </p>
      </div>
      
      <p id="password-error" className="text-sm text-red-600" role="alert">
        {passwordError}
      </p>
    </div>

    {/* Confirm Password */}
    <div className="space-y-2">
      <Label htmlFor="confirmPassword">Confirm password</Label>
      <Input
        id="confirmPassword"
        type="password"
        placeholder="Re-enter your password"
        className="w-full"
        aria-describedby="confirmPassword-error"
      />
      <p id="confirmPassword-error" className="text-sm text-red-600" role="alert">
        {confirmPasswordError}
      </p>
    </div>

    {/* Terms and Conditions */}
    <div className="flex items-start space-x-2">
      <Checkbox 
        id="terms" 
        className="mt-1"
        aria-describedby="terms-error"
      />
      <div className="space-y-1">
        <Label
          htmlFor="terms"
          className="text-sm font-medium leading-5 cursor-pointer"
        >
          I agree to the{" "}
          <Button variant="link" className="p-0 h-auto font-semibold underline" asChild>
            <Link href="/terms" target="_blank">Terms of Service</Link>
          </Button>{" "}
          and{" "}
          <Button variant="link" className="p-0 h-auto font-semibold underline" asChild>
            <Link href="/privacy" target="_blank">Privacy Policy</Link>
          </Button>
        </Label>
        <p id="terms-error" className="text-sm text-red-600" role="alert">
          {termsError}
        </p>
      </div>
    </div>

    {/* Submit Button */}
    <Button
      type="submit"
      className="w-full"
      disabled={isLoading || !termsAccepted}
      aria-describedby="register-error"
    >
      {isLoading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating account...
        </>
      ) : (
        "Create account"
      )}
    </Button>

    {/* General Error */}
    {generalError && (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription id="register-error">
          {generalError}
        </AlertDescription>
      </Alert>
    )}
  </CardContent>
  <CardFooter>
    <p className="text-center text-sm text-gray-600 w-full">
      Already have an account?{" "}
      <Button variant="link" className="p-0 font-semibold" asChild>
        <Link href="/auth/login">Sign in here</Link>
      </Button>
    </p>
  </CardFooter>
</Card>
```

#### Password Strength Validation

```typescript
interface PasswordStrength {
  score: number; // 0-4
  feedback: string;
  requirements: {
    length: boolean;
    uppercase: boolean;
    lowercase: boolean;
    numbers: boolean;
    symbols: boolean;
  };
}

const calculatePasswordStrength = (password: string): PasswordStrength => {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    symbols: /[^A-Za-z0-9]/.test(password),
  };

  const score = Object.values(requirements).filter(Boolean).length;
  
  const feedback = {
    0: "Very weak",
    1: "Weak", 
    2: "Fair",
    3: "Good",
    4: "Strong",
    5: "Very strong"
  }[score] || "Very weak";

  return { score, feedback, requirements };
};
```

### 1.3 Form Validation Patterns

#### Real-time Validation Hook

```typescript
const useFormValidation = <T extends Record<string, any>>(
  schema: z.ZodSchema<T>,
  initialData: T
) => {
  const [data, setData] = useState<T>(initialData);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});

  const validateField = useCallback(
    (field: keyof T, value: any) => {
      try {
        schema.pick({ [field]: true }).parse({ [field]: value });
        setErrors(prev => ({ ...prev, [field]: undefined }));
      } catch (error) {
        if (error instanceof z.ZodError) {
          setErrors(prev => ({
            ...prev,
            [field]: error.errors[0].message
          }));
        }
      }
    },
    [schema]
  );

  const handleChange = useCallback(
    (field: keyof T, value: any) => {
      setData(prev => ({ ...prev, [field]: value }));
      if (touched[field]) {
        validateField(field, value);
      }
    },
    [validateField, touched]
  );

  const handleBlur = useCallback(
    (field: keyof T) => {
      setTouched(prev => ({ ...prev, [field]: true }));
      validateField(field, data[field]);
    },
    [validateField, data]
  );

  const validateAll = useCallback(() => {
    try {
      schema.parse(data);
      setErrors({});
      return true;
    } catch (error) {
      if (error instanceof z.ZodError) {
        const newErrors: Partial<Record<keyof T, string>> = {};
        error.errors.forEach(err => {
          const field = err.path[0] as keyof T;
          newErrors[field] = err.message;
        });
        setErrors(newErrors);
      }
      return false;
    }
  }, [schema, data]);

  return {
    data,
    errors,
    touched,
    handleChange,
    handleBlur,
    validateAll,
    isValid: Object.keys(errors).length === 0
  };
};
```

## User Profile Interface

### 2.1 Profile View Component

```typescript
interface ProfileViewProps {
  user: User;
  canEdit: boolean;
  onEditClick?: () => void;
}

interface UserProfileData {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  location: string;
  rating: number;
  total_reviews: number;
  joined_date: string;
  avatar_url?: string;
  is_verified: boolean;
}
```

#### Visual Layout

```jsx
<Card className="w-full max-w-2xl mx-auto">
  <CardHeader className="text-center">
    {/* Avatar Section */}
    <div className="relative mx-auto w-24 h-24 mb-4">
      {user.avatar_url ? (
        <Image
          src={user.avatar_url}
          alt={`${user.full_name}'s avatar`}
          fill
          className="rounded-full object-cover"
        />
      ) : (
        <div className="w-full h-full rounded-full bg-gray-200 flex items-center justify-center">
          <User className="h-12 w-12 text-gray-500" />
        </div>
      )}
      {user.is_verified && (
        <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
          <Check className="h-4 w-4 text-white" />
        </div>
      )}
    </div>

    <CardTitle className="text-2xl">{user.full_name}</CardTitle>
    <CardDescription className="flex items-center justify-center gap-2">
      <MapPin className="h-4 w-4" />
      {user.location}
    </CardDescription>

    {/* Rating Display */}
    <div className="flex items-center justify-center gap-2 mt-2">
      <div className="flex items-center">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "h-5 w-5",
              star <= Math.floor(user.rating)
                ? "fill-yellow-400 text-yellow-400"
                : star <= user.rating
                ? "fill-yellow-200 text-yellow-400"
                : "text-gray-300"
            )}
          />
        ))}
      </div>
      <span className="text-sm font-medium">
        {user.rating.toFixed(1)} ({user.total_reviews} reviews)
      </span>
    </div>
  </CardHeader>

  <CardContent className="space-y-4">
    {/* Contact Information */}
    <div className="grid gap-4 sm:grid-cols-2">
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Email</Label>
        <div className="flex items-center gap-2">
          <Mail className="h-4 w-4 text-gray-500" />
          <span className="text-sm">{user.email}</span>
        </div>
      </div>
      
      <div className="space-y-2">
        <Label className="text-sm font-medium text-gray-700">Phone</Label>
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-gray-500" />
          <span className="text-sm">{user.phone}</span>
        </div>
      </div>
    </div>

    {/* Member Since */}
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">Member since</Label>
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-gray-500" />
        <span className="text-sm">
          {new Date(user.joined_date).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </span>
      </div>
    </div>

    {/* Verification Status */}
    <div className="space-y-2">
      <Label className="text-sm font-medium text-gray-700">Verification</Label>
      <div className="flex items-center gap-2">
        {user.is_verified ? (
          <>
            <CheckCircle className="h-4 w-4 text-green-500" />
            <span className="text-sm text-green-700">Verified member</span>
          </>
        ) : (
          <>
            <AlertCircle className="h-4 w-4 text-orange-500" />
            <span className="text-sm text-orange-700">Unverified</span>
            <Button variant="link" size="sm" className="p-0 h-auto">
              Verify now
            </Button>
          </>
        )}
      </div>
    </div>
  </CardContent>

  {canEdit && (
    <CardFooter>
      <Button onClick={onEditClick} className="w-full">
        <Edit className="mr-2 h-4 w-4" />
        Edit Profile
      </Button>
    </CardFooter>
  )}
</Card>
```

### 2.2 Profile Edit Modal

```jsx
<Dialog open={isOpen} onOpenChange={onClose}>
  <DialogContent className="sm:max-w-md">
    <DialogHeader>
      <DialogTitle>Edit Profile</DialogTitle>
      <DialogDescription>
        Update your profile information. Changes will be saved automatically.
      </DialogDescription>
    </DialogHeader>
    
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Avatar Upload Placeholder */}
      <div className="flex items-center space-x-4">
        <div className="relative w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center">
          {currentUser.avatar_url ? (
            <Image
              src={currentUser.avatar_url}
              alt="Avatar preview"
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <User className="h-8 w-8 text-gray-500" />
          )}
        </div>
        <div className="space-y-1">
          <Button type="button" variant="outline" size="sm" disabled>
            Change Photo
          </Button>
          <p className="text-xs text-gray-500">
            Photo upload coming soon
          </p>
        </div>
      </div>

      {/* Form Fields */}
      <div className="grid gap-4">
        <div className="space-y-2">
          <Label htmlFor="edit-full-name">Full name</Label>
          <Input
            id="edit-full-name"
            value={formData.full_name}
            onChange={(e) => handleFieldChange('full_name', e.target.value)}
            onBlur={() => handleFieldBlur('full_name')}
            aria-describedby="edit-full-name-error"
          />
          {errors.full_name && (
            <p id="edit-full-name-error" className="text-sm text-red-600">
              {errors.full_name}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-phone">Phone number</Label>
          <Input
            id="edit-phone"
            value={formData.phone}
            onChange={(e) => handleFieldChange('phone', e.target.value)}
            onBlur={() => handleFieldBlur('phone')}
            aria-describedby="edit-phone-error"
          />
          {errors.phone && (
            <p id="edit-phone-error" className="text-sm text-red-600">
              {errors.phone}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="edit-location">Location</Label>
          <Input
            id="edit-location"
            value={formData.location}
            onChange={(e) => handleFieldChange('location', e.target.value)}
            onBlur={() => handleFieldBlur('location')}
            aria-describedby="edit-location-error"
          />
          {errors.location && (
            <p id="edit-location-error" className="text-sm text-red-600">
              {errors.location}
            </p>
          )}
        </div>
      </div>

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isLoading || !isFormValid}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save Changes"
          )}
        </Button>
      </DialogFooter>
    </form>
  </DialogContent>
</Dialog>
```

### 2.3 Profile Completion Indicator

```jsx
const ProfileCompletionBanner = ({ user }: { user: User }) => {
  const completionItems = [
    { key: 'avatar', label: 'Profile photo', completed: !!user.avatar_url },
    { key: 'phone', label: 'Phone number', completed: !!user.phone },
    { key: 'location', label: 'Location', completed: !!user.location },
    { key: 'verified', label: 'Email verification', completed: user.is_verified },
  ];

  const completedCount = completionItems.filter(item => item.completed).length;
  const completionPercentage = Math.round((completedCount / completionItems.length) * 100);

  if (completionPercentage === 100) return null;

  return (
    <Alert className="mb-4">
      <User className="h-4 w-4" />
      <AlertTitle>Complete your profile ({completionPercentage}%)</AlertTitle>
      <AlertDescription className="mt-2">
        <div className="space-y-2">
          <Progress value={completionPercentage} className="w-full" />
          <div className="text-sm">
            Complete these steps to build trust with other users:
            <ul className="mt-2 space-y-1">
              {completionItems
                .filter(item => !item.completed)
                .map(item => (
                  <li key={item.key} className="flex items-center gap-2">
                    <Circle className="h-3 w-3" />
                    Add {item.label}
                  </li>
                ))}
            </ul>
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};
```

## Protected Route Implementation

### 3.1 Route Protection Middleware

```typescript
// hooks/useAuthGuard.ts
interface UseAuthGuardOptions {
  redirectTo?: string;
  requireAuth?: boolean;
  requireGuest?: boolean;
}

const useAuthGuard = (options: UseAuthGuardOptions = {}) => {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const { 
    redirectTo = '/auth/login', 
    requireAuth = true, 
    requireGuest = false 
  } = options;

  useEffect(() => {
    if (isLoading) return; // Wait for auth state to load

    if (requireAuth && !user) {
      // Store the intended destination
      const currentPath = window.location.pathname;
      if (currentPath !== '/auth/login' && currentPath !== '/auth/register') {
        localStorage.setItem('auth.redirectAfterLogin', currentPath);
      }
      router.replace(redirectTo);
      return;
    }

    if (requireGuest && user) {
      // User is logged in but accessing guest-only page
      const intendedPath = localStorage.getItem('auth.redirectAfterLogin') || '/dashboard';
      localStorage.removeItem('auth.redirectAfterLogin');
      router.replace(intendedPath);
      return;
    }
  }, [user, isLoading, router, redirectTo, requireAuth, requireGuest]);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    canAccess: requireAuth ? !!user : requireGuest ? !user : true
  };
};
```

### 3.2 Protected Route Component

```tsx
// components/auth/ProtectedRoute.tsx
interface ProtectedRouteProps {
  children: React.ReactNode;
  requireAuth?: boolean;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

const ProtectedRoute = ({ 
  children, 
  requireAuth = true, 
  fallback,
  redirectTo 
}: ProtectedRouteProps) => {
  const { canAccess, isLoading } = useAuthGuard({
    requireAuth,
    redirectTo
  });

  if (isLoading) {
    return fallback || (
      <div className="flex items-center justify-center min-h-screen">
        <div className="space-y-4 text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto" />
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!canAccess) {
    return fallback || null;
  }

  return <>{children}</>;
};
```

### 3.3 Page-Level Implementation Examples

```tsx
// pages/profile.tsx
const ProfilePage = () => {
  const { user, isLoading } = useAuthGuard({
    requireAuth: true,
    redirectTo: '/auth/login'
  });

  if (isLoading) {
    return <PageSkeleton />;
  }

  return (
    <Layout>
      <div className="container mx-auto px-4 py-8">
        <ProfileView user={user} canEdit={true} />
      </div>
    </Layout>
  );
};

// pages/auth/login.tsx  
const LoginPage = () => {
  const { canAccess } = useAuthGuard({
    requireAuth: false,
    requireGuest: true
  });

  if (!canAccess) {
    return null; // Will redirect to dashboard
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
};
```

## Error Handling & UX

### 4.1 API Error Display Patterns

```typescript
// types/errors.ts
interface ApiError {
  message: string;
  code: string;
  field?: string;
  details?: Record<string, any>;
}

interface ErrorState {
  general?: string;
  fields: Record<string, string>;
  network?: boolean;
}

// hooks/useErrorHandler.ts
const useErrorHandler = () => {
  const [errorState, setErrorState] = useState<ErrorState>({
    fields: {}
  });

  const handleApiError = useCallback((error: any) => {
    if (axios.isAxiosError(error)) {
      if (!error.response) {
        // Network error
        setErrorState({
          general: "Unable to connect to server. Please check your internet connection.",
          fields: {},
          network: true
        });
        return;
      }

      const { status, data } = error.response;
      
      switch (status) {
        case 400:
          // Validation errors
          if (data.detail && Array.isArray(data.detail)) {
            const fieldErrors: Record<string, string> = {};
            data.detail.forEach((err: any) => {
              if (err.loc && err.loc.length > 1) {
                fieldErrors[err.loc[1]] = err.msg;
              }
            });
            setErrorState({
              general: undefined,
              fields: fieldErrors,
              network: false
            });
          } else {
            setErrorState({
              general: data.message || "Invalid request. Please check your input.",
              fields: {},
              network: false
            });
          }
          break;

        case 401:
          setErrorState({
            general: "Invalid email or password. Please try again.",
            fields: {},
            network: false
          });
          break;

        case 409:
          setErrorState({
            general: data.message || "This email is already registered.",
            fields: {},
            network: false
          });
          break;

        case 429:
          setErrorState({
            general: "Too many attempts. Please wait a moment and try again.",
            fields: {},
            network: false
          });
          break;

        default:
          setErrorState({
            general: "An unexpected error occurred. Please try again later.",
            fields: {},
            network: false
          });
      }
    } else {
      setErrorState({
        general: "An unexpected error occurred. Please try again.",
        fields: {},
        network: false
      });
    }
  }, []);

  const clearErrors = useCallback(() => {
    setErrorState({ fields: {} });
  }, []);

  const clearFieldError = useCallback((field: string) => {
    setErrorState(prev => ({
      ...prev,
      fields: { ...prev.fields, [field]: undefined }
    }));
  }, []);

  return {
    errorState,
    handleApiError,
    clearErrors,
    clearFieldError
  };
};
```

### 4.2 Network Error Handling Component

```jsx
const NetworkErrorBoundary = ({ children }: { children: React.ReactNode }) => {
  const [hasNetworkError, setHasNetworkError] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      // Test connectivity
      await fetch('/api/health', { method: 'HEAD' });
      setHasNetworkError(false);
    } catch (error) {
      // Still offline
    } finally {
      setIsRetrying(false);
    }
  };

  useEffect(() => {
    const handleOnline = () => setHasNetworkError(false);
    const handleOffline = () => setHasNetworkError(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (hasNetworkError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center space-y-4">
            <WifiOff className="h-12 w-12 mx-auto text-gray-400" />
            <div>
              <h3 className="text-lg font-semibold">Connection Lost</h3>
              <p className="text-sm text-gray-600 mt-1">
                Please check your internet connection and try again.
              </p>
            </div>
            <Button 
              onClick={handleRetry}
              disabled={isRetrying}
              className="w-full"
            >
              {isRetrying ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Retrying...
                </>
              ) : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Try Again
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
```

### 4.3 Success Notifications

```typescript
// hooks/useToast.ts (extending shadcn/ui toast)
const useAuthToast = () => {
  const { toast } = useToast();

  const showLoginSuccess = (userName: string) => {
    toast({
      title: `Welcome back, ${userName}!`,
      description: "You have been successfully signed in.",
      duration: 3000,
    });
  };

  const showRegistrationSuccess = () => {
    toast({
      title: "Account created successfully!",
      description: "Welcome to Wippestoolen. You can now start exploring tools.",
      duration: 5000,
    });
  };

  const showProfileUpdateSuccess = () => {
    toast({
      title: "Profile updated",
      description: "Your changes have been saved successfully.",
      duration: 3000,
    });
  };

  const showLogoutSuccess = () => {
    toast({
      title: "Signed out",
      description: "You have been successfully signed out.",
      duration: 2000,
    });
  };

  return {
    showLoginSuccess,
    showRegistrationSuccess,
    showProfileUpdateSuccess,
    showLogoutSuccess
  };
};
```

## Component Architecture

### 5.1 Reusable Form Components

#### Custom Input Component with Validation

```tsx
interface ValidatedInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  required?: boolean;
  description?: string;
}

const ValidatedInput = forwardRef<HTMLInputElement, ValidatedInputProps>(
  ({ label, error, required, description, className, id, ...props }, ref) => {
    const inputId = id || `input-${label.toLowerCase().replace(/\s+/g, '-')}`;
    const errorId = `${inputId}-error`;
    const descriptionId = `${inputId}-description`;

    return (
      <div className="space-y-2">
        <Label htmlFor={inputId} className="text-sm font-medium">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
        
        <Input
          {...props}
          ref={ref}
          id={inputId}
          className={cn(
            error && "border-red-500 focus:border-red-500 focus:ring-red-200",
            className
          )}
          aria-describedby={cn(
            error && errorId,
            description && descriptionId
          )}
          aria-invalid={!!error}
        />
        
        {description && !error && (
          <p id={descriptionId} className="text-sm text-gray-600">
            {description}
          </p>
        )}
        
        {error && (
          <p id={errorId} className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }
);
ValidatedInput.displayName = "ValidatedInput";
```

#### Form Submit Button Component

```tsx
interface SubmitButtonProps {
  isLoading: boolean;
  disabled?: boolean;
  children: React.ReactNode;
  loadingText?: string;
  className?: string;
}

const SubmitButton = ({ 
  isLoading, 
  disabled, 
  children, 
  loadingText,
  className 
}: SubmitButtonProps) => (
  <Button
    type="submit"
    disabled={isLoading || disabled}
    className={cn("w-full", className)}
  >
    {isLoading ? (
      <>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {loadingText || "Please wait..."}
      </>
    ) : (
      children
    )}
  </Button>
);
```

### 5.2 Authentication Status Indicators

```tsx
// components/auth/AuthStatus.tsx
const AuthStatus = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-4 w-20" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/auth/login">Sign In</Link>
        </Button>
        <Button asChild size="sm">
          <Link href="/auth/register">Sign Up</Link>
        </Button>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-8 w-8 rounded-full">
          {user.avatar_url ? (
            <Image
              src={user.avatar_url}
              alt={user.full_name}
              fill
              className="rounded-full object-cover"
            />
          ) : (
            <User className="h-4 w-4" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56" align="end">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none">{user.full_name}</p>
            <p className="text-xs leading-none text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/profile">
            <User className="mr-2 h-4 w-4" />
            Profile
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/dashboard">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout()}>
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
```

### 5.3 Input Validation Hooks

```typescript
// hooks/useDebounce.ts
const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

// hooks/useAsyncValidation.ts
const useAsyncValidation = (
  validateFn: (value: string) => Promise<boolean>,
  delay: number = 500
) => {
  const [isValidating, setIsValidating] = useState(false);
  const [isValid, setIsValid] = useState<boolean | null>(null);
  const [error, setError] = useState<string>("");

  const validate = useCallback(async (value: string) => {
    if (!value) {
      setIsValid(null);
      setError("");
      return;
    }

    setIsValidating(true);
    try {
      const result = await validateFn(value);
      setIsValid(result);
      setError(result ? "" : "This value is not available");
    } catch (err) {
      setIsValid(false);
      setError("Validation failed. Please try again.");
    } finally {
      setIsValidating(false);
    }
  }, [validateFn]);

  const debouncedValidate = useMemo(
    () => debounce(validate, delay),
    [validate, delay]
  );

  return {
    isValidating,
    isValid,
    error,
    validate: debouncedValidate
  };
};
```

## Accessibility & Best Practices

### 6.1 WCAG Compliance Checklist

#### Keyboard Navigation Support

```tsx
// Enhanced form navigation hook
const useKeyboardNavigation = (formRef: RefObject<HTMLFormElement>) => {
  useEffect(() => {
    const form = formRef.current;
    if (!form) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Enter key on input fields should not submit form unless it's the submit button
      if (e.key === 'Enter' && e.target instanceof HTMLInputElement) {
        e.preventDefault();
        
        // Find next focusable element
        const focusableElements = form.querySelectorAll(
          'input, select, textarea, button, [tabindex]:not([tabindex="-1"])'
        );
        const currentIndex = Array.from(focusableElements).indexOf(e.target);
        const nextElement = focusableElements[currentIndex + 1] as HTMLElement;
        
        if (nextElement) {
          nextElement.focus();
        }
      }
    };

    form.addEventListener('keydown', handleKeyDown);
    return () => form.removeEventListener('keydown', handleKeyDown);
  }, [formRef]);
};
```

#### Screen Reader Optimization

```tsx
// Screen reader announcements hook
const useScreenReader = () => {
  const announce = useCallback((message: string, priority: 'polite' | 'assertive' = 'polite') => {
    const announcement = document.createElement('div');
    announcement.setAttribute('aria-live', priority);
    announcement.setAttribute('aria-atomic', 'true');
    announcement.className = 'sr-only';
    announcement.textContent = message;
    
    document.body.appendChild(announcement);
    
    setTimeout(() => {
      document.body.removeChild(announcement);
    }, 1000);
  }, []);

  return { announce };
};

// Usage in forms
const LoginForm = () => {
  const { announce } = useScreenReader();
  
  const handleSubmit = async (data: LoginFormData) => {
    try {
      await login(data);
      announce("Successfully signed in", "assertive");
    } catch (error) {
      announce("Sign in failed. Please check your credentials", "assertive");
    }
  };
  
  // ... rest of component
};
```

### 6.2 Focus Management

```tsx
// Focus trap for modals
const useFocusTrap = (isActive: boolean) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive || !containerRef.current) return;

    const container = containerRef.current;
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          lastElement.focus();
          e.preventDefault();
        }
      } else {
        if (document.activeElement === lastElement) {
          firstElement.focus();
          e.preventDefault();
        }
      }
    };

    const handleEscapeKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        const closeButton = container.querySelector('[data-close-modal]') as HTMLElement;
        if (closeButton) closeButton.click();
      }
    };

    document.addEventListener('keydown', handleTabKey);
    document.addEventListener('keydown', handleEscapeKey);
    firstElement?.focus();

    return () => {
      document.removeEventListener('keydown', handleTabKey);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, [isActive]);

  return containerRef;
};
```

### 6.3 Form Accessibility Patterns

```tsx
const AccessibleFormField = ({ 
  label, 
  error, 
  description, 
  required = false,
  children 
}: {
  label: string;
  error?: string;
  description?: string;
  required?: boolean;
  children: React.ReactElement;
}) => {
  const fieldId = useId();
  const errorId = `${fieldId}-error`;
  const descriptionId = `${fieldId}-description`;

  const childWithProps = React.cloneElement(children, {
    id: fieldId,
    'aria-describedby': [
      description && descriptionId,
      error && errorId
    ].filter(Boolean).join(' '),
    'aria-invalid': !!error,
    'aria-required': required
  });

  return (
    <div className="space-y-2">
      <Label htmlFor={fieldId} className="text-sm font-medium">
        {label}
        {required && (
          <span className="text-red-500 ml-1" aria-label="required">
            *
          </span>
        )}
      </Label>
      
      {childWithProps}
      
      {description && !error && (
        <p id={descriptionId} className="text-sm text-gray-600">
          {description}
        </p>
      )}
      
      {error && (
        <p id={errorId} className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
};
```

### 6.4 Color Contrast and Visual Accessibility

```css
/* tailwind.config.js additions for accessibility */
module.exports = {
  theme: {
    extend: {
      colors: {
        // High contrast error colors (WCAG AA compliant)
        error: {
          50: '#fef2f2',
          500: '#dc2626', // 4.5:1 contrast ratio on white
          600: '#b91c1c', // 7:1 contrast ratio on white
        },
        // High contrast success colors  
        success: {
          50: '#f0fdf4',
          500: '#16a34a', // 4.5:1 contrast ratio
          600: '#15803d', // 7:1 contrast ratio
        }
      },
      // Focus ring styles
      ringColor: {
        'focus': '#3b82f6', // High visibility focus rings
      },
      ringWidth: {
        'focus': '3px', // Thick enough to be visible
      }
    }
  }
}
```

```tsx
// High contrast focus styles component
const FocusRing = ({ children, className }: { 
  children: React.ReactNode; 
  className?: string;
}) => (
  <div className={cn(
    "focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 rounded-md",
    className
  )}>
    {children}
  </div>
);
```

## Implementation Timeline

### Phase 1: Authentication Forms (Week 1)
- [ ] Implement LoginForm component with validation
- [ ] Implement RegisterForm component with password strength
- [ ] Create form validation hooks and error handling
- [ ] Add loading states and success notifications

### Phase 2: Profile Management (Week 1-2)  
- [ ] Implement ProfileView component with rating display
- [ ] Create ProfileEdit modal with form validation
- [ ] Add profile completion indicator
- [ ] Implement avatar placeholder (upload coming later)

### Phase 3: Route Protection (Week 2)
- [ ] Implement useAuthGuard hook with redirect logic
- [ ] Create ProtectedRoute component
- [ ] Add page-level authentication checks
- [ ] Test authentication flow end-to-end

### Phase 4: Polish & Accessibility (Week 2)
- [ ] Complete WCAG compliance audit
- [ ] Add comprehensive keyboard navigation
- [ ] Implement screen reader optimizations
- [ ] Test with accessibility tools (axe, lighthouse)

## Performance Considerations

### Optimistic UI Updates
```typescript
const useOptimisticAuth = () => {
  const { user, setUser } = useAuth();
  
  const updateProfileOptimistically = async (updates: Partial<User>) => {
    const originalUser = user;
    const optimisticUser = { ...user, ...updates };
    
    // Update UI immediately
    setUser(optimisticUser);
    
    try {
      const updatedUser = await api.updateProfile(updates);
      setUser(updatedUser);
    } catch (error) {
      // Revert to original state on error
      setUser(originalUser);
      throw error;
    }
  };
  
  return { updateProfileOptimistically };
};
```

### Code Splitting Authentication Pages
```typescript
// Lazy load authentication pages for better performance
const LoginPage = lazy(() => import('../pages/auth/LoginPage'));
const RegisterPage = lazy(() => import('../pages/auth/RegisterPage'));
const ProfilePage = lazy(() => import('../pages/ProfilePage'));

// In router configuration
{
  path: '/auth/login',
  element: (
    <Suspense fallback={<AuthPageSkeleton />}>
      <LoginPage />
    </Suspense>
  )
}
```

## Integration Points

### API Client Integration
The authentication UI components integrate with the existing API client that handles:
- Automatic JWT token refresh
- Request/response interceptors for auth headers
- Error handling for 401/403 responses

### State Management Integration  
Components work with the existing authentication context:
- React Context for user state management
- Persistent login across browser sessions
- Real-time user state synchronization

### Backend API Compatibility
All components are designed to work with the documented FastAPI endpoints:
- POST `/api/v1/auth/register` - User registration
- POST `/api/v1/auth/token` - User login (JWT tokens)  
- POST `/api/v1/auth/refresh` - Token refresh
- GET `/api/v1/auth/me` - Current user profile
- PUT `/api/v1/auth/me` - Update user profile

This documentation provides a complete specification for implementing secure, accessible, and user-friendly authentication components in the Wippestoolen platform.