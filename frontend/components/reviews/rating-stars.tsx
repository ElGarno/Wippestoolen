import React from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

interface RatingStarsProps {
  rating: number
  maxRating?: number
  size?: 'sm' | 'md' | 'lg'
  showValue?: boolean
  interactive?: boolean
  onRatingChange?: (rating: number) => void
  className?: string
}

export function RatingStars({
  rating,
  maxRating = 5,
  size = 'md',
  showValue = false,
  interactive = false,
  onRatingChange,
  className
}: RatingStarsProps) {
  const [hoverRating, setHoverRating] = React.useState<number | null>(null)

  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-5 h-5',
    lg: 'w-6 h-6'
  }

  const handleStarClick = (starRating: number) => {
    if (interactive && onRatingChange) {
      onRatingChange(starRating)
    }
  }

  const handleMouseEnter = (starRating: number) => {
    if (interactive) {
      setHoverRating(starRating)
    }
  }

  const handleMouseLeave = () => {
    if (interactive) {
      setHoverRating(null)
    }
  }

  const displayRating = hoverRating !== null ? hoverRating : rating
  const stars = Array.from({ length: maxRating }, (_, index) => index + 1)

  return (
    <div className={cn('flex items-center space-x-1', className)}>
      <div className="flex items-center">
        {stars.map((star) => {
          const isFilled = star <= displayRating
          const isHalfFilled = !isFilled && star - 0.5 <= displayRating

          return (
            <button
              key={star}
              type="button"
              className={cn(
                'transition-colors',
                interactive && 'hover:scale-110 cursor-pointer',
                !interactive && 'cursor-default'
              )}
              onClick={() => handleStarClick(star)}
              onMouseEnter={() => handleMouseEnter(star)}
              onMouseLeave={handleMouseLeave}
              disabled={!interactive}
            >
              <Star
                className={cn(
                  sizeClasses[size],
                  'transition-colors',
                  {
                    'text-yellow-400 fill-current': isFilled,
                    'text-yellow-300 fill-yellow-200': isHalfFilled,
                    'text-gray-300': !isFilled && !isHalfFilled,
                    'hover:text-yellow-400': interactive && !isFilled
                  }
                )}
              />
            </button>
          )
        })}
      </div>
      
      {showValue && (
        <span className="text-sm text-gray-600 ml-2">
          {rating.toFixed(1)}
        </span>
      )}
    </div>
  )
}