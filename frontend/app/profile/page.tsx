'use client'

import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { User, MapPin, Phone, Mail, Star, Edit2, Save, X, Loader2 } from 'lucide-react'

import { useAuth } from '@/contexts/auth-context'
import { Layout } from '@/components/layout/layout'
import { ProtectedRoute } from '@/components/auth/protected-route'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'

const profileSchema = z.object({
  display_name: z.string()
    .min(2, 'Display name must be at least 2 characters')
    .max(100, 'Display name must be less than 100 characters'),
  first_name: z.string()
    .max(50, 'First name must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  last_name: z.string()
    .max(50, 'Last name must be less than 50 characters')
    .optional()
    .or(z.literal('')),
  phone_number: z.string()
    .regex(/^[\+]?[1-9][\d]{0,15}$/, 'Please enter a valid phone number')
    .optional()
    .or(z.literal('')),
  bio: z.string()
    .max(500, 'Bio must be less than 500 characters')
    .optional(),
})

type ProfileFormData = z.infer<typeof profileSchema>

const StarRating = ({ rating, count }: { rating: number; count: number }) => {
  return (
    <div className="flex items-center space-x-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          className={`h-4 w-4 ${
            star <= rating 
              ? 'text-yellow-400 fill-current' 
              : 'text-gray-300'
          }`}
        />
      ))}
      <span className="text-sm text-gray-600 ml-2">
        {rating.toFixed(1)} ({count} reviews)
      </span>
    </div>
  )
}

export default function ProfilePage() {
  const { user, updateProfile } = useAuth()
  const [isEditing, setIsEditing] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
  })

  // Reset form when user data changes
  useEffect(() => {
    if (user) {
      reset({
        display_name: user.display_name,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        phone_number: user.phone_number || '',
        bio: user.bio || '',
      })
    }
  }, [user, reset])

  // Clear messages after 5 seconds
  useEffect(() => {
    if (successMessage || updateError) {
      const timer = setTimeout(() => {
        setSuccessMessage(null)
        setUpdateError(null)
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [successMessage, updateError])

  if (!user) {
    return (
      <Layout>
        <div className="container mx-auto py-8">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        </div>
      </Layout>
    )
  }

  const onSubmit = async (data: ProfileFormData) => {
    try {
      setIsUpdating(true)
      setUpdateError(null)
      await updateProfile(data)
      setSuccessMessage('Profile updated successfully!')
      setIsEditing(false)
    } catch (error) {
      setUpdateError('Failed to update profile. Please try again.')
      console.error('Profile update failed:', error)
    } finally {
      setIsUpdating(false)
    }
  }

  const handleCancel = () => {
    reset()
    setIsEditing(false)
    setUpdateError(null)
  }

  return (
    <ProtectedRoute>
      <Layout>
        <div className="container mx-auto py-8 px-4 max-w-2xl">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold">My Profile</h1>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)} variant="outline">
              <Edit2 className="h-4 w-4 mr-2" />
              Edit Profile
            </Button>
          )}
        </div>

        {successMessage && (
          <Alert className="mb-6">
            <AlertDescription className="text-green-700">
              {successMessage}
            </AlertDescription>
          </Alert>
        )}

        {updateError && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{updateError}</AlertDescription>
          </Alert>
        )}

        <div className="grid gap-6">
          {/* Profile Overview Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-4">
                <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="h-10 w-10 text-gray-500" />
                </div>
                <div>
                  <CardTitle className="text-xl">{user.display_name}</CardTitle>
                  <CardDescription className="flex items-center mt-1">
                    <Mail className="h-4 w-4 mr-1" />
                    {user.email}
                  </CardDescription>
                  {user.location && (
                    <CardDescription className="flex items-center mt-1">
                      <MapPin className="h-4 w-4 mr-1" />
                      {user.location}
                    </CardDescription>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-2">Community Rating</h4>
                  <StarRating rating={user.average_rating} count={user.total_ratings} />
                </div>
                
                <Separator />
                
                <div>
                  <h4 className="font-semibold mb-2">Member Since</h4>
                  <p className="text-gray-600">
                    {new Date(user.created_at).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Profile Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                {isEditing ? 'Update your profile information' : 'Your personal details'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isEditing ? (
                <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="display_name">Display Name</Label>
                    <Input
                      id="display_name"
                      {...register('display_name')}
                      className={errors.display_name ? 'border-red-500' : ''}
                    />
                    {errors.display_name && (
                      <p className="text-sm text-red-600">{errors.display_name.message}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-2">
                      <Label htmlFor="first_name">First Name</Label>
                      <Input
                        id="first_name"
                        {...register('first_name')}
                        className={errors.first_name ? 'border-red-500' : ''}
                      />
                      {errors.first_name && (
                        <p className="text-sm text-red-600">{errors.first_name.message}</p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="last_name">Last Name</Label>
                      <Input
                        id="last_name"
                        {...register('last_name')}
                        className={errors.last_name ? 'border-red-500' : ''}
                      />
                      {errors.last_name && (
                        <p className="text-sm text-red-600">{errors.last_name.message}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone_number">Phone Number</Label>
                    <Input
                      id="phone_number"
                      type="tel"
                      placeholder="+1234567890"
                      {...register('phone_number')}
                      className={errors.phone_number ? 'border-red-500' : ''}
                    />
                    {errors.phone_number && (
                      <p className="text-sm text-red-600">{errors.phone_number.message}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="bio">Bio</Label>
                    <textarea
                      id="bio"
                      rows={4}
                      placeholder="Tell your neighbors about yourself..."
                      className="w-full px-3 py-2 border rounded-md resize-none"
                      {...register('bio')}
                    />
                    {errors.bio && (
                      <p className="text-sm text-red-600">{errors.bio.message}</p>
                    )}
                  </div>

                  <div className="flex space-x-3 pt-4">
                    <Button type="submit" disabled={isUpdating || !isDirty}>
                      {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </Button>
                    <Button type="button" variant="outline" onClick={handleCancel}>
                      <X className="h-4 w-4 mr-2" />
                      Cancel
                    </Button>
                  </div>
                </form>
              ) : (
                <div className="space-y-4">
                  <div>
                    <Label>Display Name</Label>
                    <p className="text-gray-900 mt-1">{user.display_name}</p>
                  </div>

                  <div>
                    <Label>First Name</Label>
                    <p className="text-gray-900 mt-1">{user.first_name || 'Not specified'}</p>
                  </div>

                  <div>
                    <Label>Last Name</Label>
                    <p className="text-gray-900 mt-1">{user.last_name || 'Not specified'}</p>
                  </div>

                  <div>
                    <Label>Phone Number</Label>
                    <p className="text-gray-900 mt-1 flex items-center">
                      {user.phone_number ? (
                        <>
                          <Phone className="h-4 w-4 mr-2" />
                          {user.phone_number}
                        </>
                      ) : (
                        'Not specified'
                      )}
                    </p>
                  </div>

                  <div>
                    <Label>Bio</Label>
                    <p className="text-gray-900 mt-1">
                      {user.bio || 'No bio added yet'}
                    </p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </Layout>
    </ProtectedRoute>
  )
}