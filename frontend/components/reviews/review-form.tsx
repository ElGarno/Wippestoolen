'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Star, Send } from 'lucide-react'
import { apiClient } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { RatingStars } from './rating-stars'

const reviewFormSchema = z.object({
  rating: z.number().min(1, 'Bitte vergeben Sie eine Bewertung').max(5),
  comment: z.string().min(10, 'Kommentar muss mindestens 10 Zeichen lang sein').max(500, 'Kommentar darf maximal 500 Zeichen lang sein'),
})

type ReviewFormData = z.infer<typeof reviewFormSchema>

interface ReviewFormProps {
  bookingId: string
  reviewType: 'tool_review' | 'borrower_review'
  reviewTitle: string
  onSuccess?: () => void
  className?: string
}

export function ReviewForm({ 
  bookingId, 
  reviewType, 
  reviewTitle, 
  onSuccess,
  className 
}: ReviewFormProps) {
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const form = useForm<ReviewFormData>({
    resolver: zodResolver(reviewFormSchema),
    defaultValues: {
      rating: 0,
      comment: '',
    }
  })

  const onSubmit = async (data: ReviewFormData) => {
    try {
      setSubmitting(true)
      setError(null)

      await apiClient.createReview({
        booking_id: bookingId,
        review_type: reviewType,
        rating: data.rating,
        comment: data.comment,
      })

      setSuccess(true)
      form.reset()
      
      if (onSuccess) {
        setTimeout(() => {
          onSuccess()
        }, 2000)
      }
    } catch (err) {
      console.error('Error submitting review:', err)
      setError('Bewertung konnte nicht gesendet werden. Bitte versuchen Sie es erneut.')
    } finally {
      setSubmitting(false)
    }
  }

  if (success) {
    return (
      <Card className={className}>
        <CardContent className="pt-6 text-center">
          <div className="text-green-600 text-5xl mb-4">✓</div>
          <h3 className="text-lg font-semibold text-green-800 mb-2">
            Bewertung gesendet!
          </h3>
          <p className="text-green-700 text-sm">
            Vielen Dank für Ihre Bewertung. Sie hilft anderen Nutzern bei ihrer Entscheidung.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Star className="w-5 h-5" />
          <span>{reviewTitle}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {error && (
          <Alert className="mb-6 border-red-200 bg-red-50">
            <div>
              <h4 className="font-semibold text-red-800">Fehler</h4>
              <p className="text-red-700">{error}</p>
            </div>
          </Alert>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="rating"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Bewertung *</FormLabel>
                  <FormControl>
                    <div>
                      <RatingStars
                        rating={field.value}
                        interactive
                        size="lg"
                        onRatingChange={field.onChange}
                        className="mb-2"
                      />
                      <div className="text-sm text-gray-600">
                        {field.value === 0 && 'Klicken Sie auf die Sterne um zu bewerten'}
                        {field.value === 1 && 'Sehr schlecht'}
                        {field.value === 2 && 'Schlecht'}
                        {field.value === 3 && 'Durchschnittlich'}
                        {field.value === 4 && 'Gut'}
                        {field.value === 5 && 'Ausgezeichnet'}
                      </div>
                    </div>
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
                  <FormLabel>Kommentar *</FormLabel>
                  <FormControl>
                    <textarea
                      className="min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      placeholder={
                        reviewType === 'tool_review'
                          ? 'Wie war der Zustand des Werkzeugs? Funktionierte alles einwandfrei?'
                          : 'Wie verlief die Kommunikation und Abwicklung mit dem Mieter?'
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    {field.value.length}/500 Zeichen
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-3">
              <Button type="submit" disabled={submitting || form.getValues('rating') === 0}>
                <Send className="w-4 h-4 mr-2" />
                {submitting ? 'Sende...' : 'Bewertung senden'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}