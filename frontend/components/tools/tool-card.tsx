import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { MapPin, Star, DollarSign, Calendar, User } from 'lucide-react'
import { Tool } from '@/types'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'

interface ToolCardProps {
  tool: Tool
  className?: string
}

export function ToolCard({ tool, className = '' }: ToolCardProps) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0)

  const handleImageNavigation = (direction: 'prev' | 'next') => {
    if (tool.photos.length <= 1) return
    
    if (direction === 'next') {
      setCurrentImageIndex((prev) => (prev + 1) % tool.photos.length)
    } else {
      setCurrentImageIndex((prev) => (prev - 1 + tool.photos.length) % tool.photos.length)
    }
  }

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(price)
  }

  return (
    <Card className={`group hover:shadow-lg transition-shadow duration-300 ${className}`}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg">
        {/* Main Image */}
        <Link href={`/tools/${tool.id}`}>
          <div className="relative w-full h-full bg-gray-100">
            {tool.photos.length > 0 ? (
              <Image
                src={tool.photos[currentImageIndex]}
                alt={tool.title}
                fill
                className="object-cover transition-transform duration-300 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-200">
                <User className="w-12 h-12 text-gray-400" />
              </div>
            )}
          </div>
        </Link>

        {/* Image Navigation */}
        {tool.photos.length > 1 && (
          <>
            <button
              onClick={() => handleImageNavigation('prev')}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Previous image"
            >
              ←
            </button>
            <button
              onClick={() => handleImageNavigation('next')}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/50 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Next image"
            >
              →
            </button>

            {/* Image Indicators */}
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
              {tool.photos.map((_, index) => (
                <button
                  key={index}
                  onClick={() => setCurrentImageIndex(index)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    index === currentImageIndex ? 'bg-white' : 'bg-white/50'
                  }`}
                  aria-label={`View image ${index + 1}`}
                />
              ))}
            </div>
          </>
        )}

        {/* Availability Badge */}
        <div className="absolute top-2 left-2">
          <Badge variant={tool.is_available ? 'default' : 'secondary'}>
            {tool.is_available ? 'Available' : 'Unavailable'}
          </Badge>
        </div>

        {/* Category Badge */}
        <div className="absolute top-2 right-2">
          <Badge variant="outline" className="bg-white/90">
            {tool.category}
          </Badge>
        </div>
      </div>

      <CardContent className="p-4">
        <Link href={`/tools/${tool.id}`}>
          <div className="space-y-2">
            {/* Title */}
            <h3 className="font-semibold text-lg line-clamp-2 group-hover:text-primary transition-colors">
              {tool.title}
            </h3>

            {/* Description */}
            <p className="text-gray-600 text-sm line-clamp-2">
              {tool.description}
            </p>

            {/* Owner and Location */}
            <div className="flex items-center justify-between text-sm text-gray-500">
              <div className="flex items-center space-x-1">
                <Avatar className="w-5 h-5">
                  <AvatarFallback className="text-xs">
                    {tool.owner?.full_name?.charAt(0) || 'U'}
                  </AvatarFallback>
                </Avatar>
                <span>{tool.owner?.full_name || 'Anonymous'}</span>
              </div>
              
              {tool.location && (
                <div className="flex items-center space-x-1">
                  <MapPin className="w-4 h-4" />
                  <span className="truncate">{tool.location}</span>
                </div>
              )}
            </div>

            {/* Rating */}
            {tool.review_count > 0 && (
              <div className="flex items-center space-x-1">
                <div className="flex items-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`w-4 h-4 ${
                        star <= tool.average_rating
                          ? 'text-yellow-400 fill-current'
                          : 'text-gray-300'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-sm text-gray-600">
                  {tool.average_rating.toFixed(1)} ({tool.review_count})
                </span>
              </div>
            )}

            {/* Additional Details */}
            <div className="flex flex-wrap gap-2 text-xs text-gray-500">
              {tool.brand && (
                <span className="flex items-center">
                  <span className="font-medium">Brand:</span> {tool.brand}
                </span>
              )}
              {tool.condition && (
                <span className="flex items-center">
                  <span className="font-medium">Condition:</span> {tool.condition}
                </span>
              )}
            </div>
          </div>
        </Link>
      </CardContent>

      <CardFooter className="p-4 pt-0 flex items-center justify-between">
        {/* Pricing */}
        <div className="space-y-1">
          <div className="flex items-center space-x-1">
            <DollarSign className="w-4 h-4 text-green-600" />
            <span className="font-semibold text-lg">
              {formatPrice(tool.daily_rate)}
            </span>
            <span className="text-sm text-gray-500">/day</span>
          </div>
          
          {tool.deposit_required > 0 && (
            <div className="text-xs text-gray-500">
              + {formatPrice(tool.deposit_required)} deposit
            </div>
          )}
          
          {tool.delivery_available && tool.delivery_fee && (
            <div className="text-xs text-gray-500">
              Delivery: {formatPrice(tool.delivery_fee)}
            </div>
          )}
        </div>

        {/* Action Button */}
        <div className="flex flex-col space-y-1">
          <Button 
            size="sm" 
            asChild 
            disabled={!tool.is_available}
            className="min-w-[80px]"
          >
            <Link href={`/tools/${tool.id}`}>
              {tool.is_available ? 'Book Now' : 'View'}
            </Link>
          </Button>
          
          {tool.delivery_available && (
            <div className="text-xs text-center text-green-600 flex items-center">
              <Calendar className="w-3 h-3 mr-1" />
              Delivery
            </div>
          )}
        </div>
      </CardFooter>
    </Card>
  )
}