# Tool Browsing UI Implementation Documentation

## Overview

This document provides comprehensive specifications for implementing tool browsing functionality in the Wippestoolen platform using Next.js 14, TypeScript, Tailwind CSS, and shadcn/ui components. The implementation integrates with the existing FastAPI backend and authentication system.

## Table of Contents

1. [Tool Card Component Design](#tool-card-component-design)
2. [Search and Filter Interface](#search-and-filter-interface)
3. [Tool Detail Page Layout](#tool-detail-page-layout)
4. [Tool Management Interface](#tool-management-interface)
5. [Mobile-First Design Patterns](#mobile-first-design-patterns)
6. [Performance Optimizations](#performance-optimizations)
7. [Component Architecture](#component-architecture)
8. [State Management](#state-management)
9. [API Integration](#api-integration)
10. [Accessibility Guidelines](#accessibility-guidelines)

---

## Tool Card Component Design

### Compact Tool Card (`ToolCard`)

**File**: `components/tools/ToolCard.tsx`

```tsx
interface ToolCardProps {
  tool: Tool;
  variant?: 'grid' | 'list';
  priority?: boolean; // For above-the-fold loading
  onBookClick?: () => void;
  onFavorite?: () => void;
}
```

#### Layout Structure

**Grid Variant (Default)**:
- **Dimensions**: 320×400px (desktop), 280×360px (mobile)
- **Aspect Ratio**: 4:3 image, 1:1.5 total card
- **Spacing**: 16px internal padding, 8px gap between cards

**List Variant**:
- **Dimensions**: Full width × 120px height
- **Layout**: Horizontal image left, content right
- **Image**: 120×120px square

#### Visual Elements

```tsx
// Card Structure
<Card className="group hover:shadow-lg transition-shadow duration-200">
  {/* Image Section */}
  <div className="relative aspect-[4/3] overflow-hidden rounded-t-lg">
    <Image
      src={tool.photos[0] || '/placeholder-tool.jpg'}
      alt={tool.title}
      fill
      className="object-cover group-hover:scale-105 transition-transform duration-300"
      priority={priority}
    />
    
    {/* Overlays */}
    <div className="absolute top-2 left-2 flex gap-2">
      {!tool.is_available && (
        <Badge variant="destructive" className="text-xs">
          Unavailable
        </Badge>
      )}
      {tool.delivery_available && (
        <Badge variant="secondary" className="text-xs">
          <Truck className="w-3 h-3 mr-1" />
          Delivery
        </Badge>
      )}
    </div>
    
    <FavoriteButton 
      className="absolute top-2 right-2"
      toolId={tool.id}
      isFavorited={tool.is_favorited}
    />
  </div>
  
  {/* Content Section */}
  <CardContent className="p-4">
    <div className="space-y-2">
      {/* Title & Rating */}
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-sm line-clamp-2 leading-5">
          {tool.title}
        </h3>
        <div className="flex items-center ml-2 flex-shrink-0">
          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
          <span className="text-xs ml-1">{tool.average_rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground ml-1">
            ({tool.review_count})
          </span>
        </div>
      </div>
      
      {/* Category & Condition */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Badge variant="outline" className="text-xs">
          {tool.category}
        </Badge>
        <span>•</span>
        <span>{tool.condition}</span>
      </div>
      
      {/* Owner Info */}
      <div className="flex items-center gap-2">
        <Avatar className="w-5 h-5">
          <AvatarFallback className="text-xs">
            {tool.owner.full_name[0]}
          </AvatarFallback>
        </Avatar>
        <span className="text-xs text-muted-foreground truncate">
          {tool.owner.full_name}
        </span>
        <div className="flex items-center ml-auto">
          <MapPin className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground ml-1">
            {tool.distance}km
          </span>
        </div>
      </div>
      
      {/* Pricing */}
      <div className="flex items-center justify-between pt-1">
        <div>
          <span className="font-semibold text-lg">
            €{tool.daily_rate}
          </span>
          <span className="text-xs text-muted-foreground">/day</span>
        </div>
        {tool.deposit_required > 0 && (
          <span className="text-xs text-muted-foreground">
            €{tool.deposit_required} deposit
          </span>
        )}
      </div>
    </div>
    
    {/* Action Button */}
    <Button 
      className="w-full mt-3" 
      size="sm"
      disabled={!tool.is_available}
      onClick={onBookClick}
    >
      {tool.is_available ? 'Book Now' : 'Unavailable'}
    </Button>
  </CardContent>
</Card>
```

#### Responsive Grid Implementation

```tsx
// Grid Container Component
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 md:gap-6">
  {tools.map((tool, index) => (
    <ToolCard
      key={tool.id}
      tool={tool}
      priority={index < 8} // First 8 cards for LCP optimization
      onBookClick={() => router.push(`/tools/${tool.id}`)}
    />
  ))}
</div>
```

### Tool Image Carousel (`ToolImageCarousel`)

```tsx
interface ToolImageCarouselProps {
  images: string[];
  alt: string;
  className?: string;
  showThumbnails?: boolean;
}

// Implementation with Embla Carousel for smooth touch experience
const ToolImageCarousel = ({ images, alt, showThumbnails = true }) => {
  return (
    <div className="relative">
      {/* Main Image Display */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg">
        <EmblaCarousel
          options={{ loop: true, dragFree: false }}
          className="h-full"
        >
          {images.map((image, index) => (
            <div key={index} className="embla__slide relative">
              <Image
                src={image}
                alt={`${alt} - Image ${index + 1}`}
                fill
                className="object-cover"
                priority={index === 0}
              />
            </div>
          ))}
        </EmblaCarousel>
        
        {/* Navigation Buttons */}
        <Button
          variant="outline"
          size="icon"
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
        >
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm"
        >
          <ChevronRight className="w-4 h-4" />
        </Button>
        
        {/* Image Counter */}
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm">
            {currentIndex + 1} / {images.length}
          </Badge>
        </div>
      </div>
      
      {/* Thumbnail Navigation */}
      {showThumbnails && images.length > 1 && (
        <div className="flex gap-2 mt-3 overflow-x-auto pb-2">
          {images.map((image, index) => (
            <button
              key={index}
              className={cn(
                "flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden",
                index === currentIndex 
                  ? "border-primary" 
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => setCurrentIndex(index)}
            >
              <Image
                src={image}
                alt=""
                width={64}
                height={64}
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
```

---

## Search and Filter Interface

### Search Bar Component (`ToolSearchBar`)

**File**: `components/tools/ToolSearchBar.tsx`

```tsx
interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  suggestions?: SearchSuggestion[];
  isLoading?: boolean;
  onSuggestionSelect?: (suggestion: SearchSuggestion) => void;
}

const ToolSearchBar = ({ value, onChange, suggestions = [], isLoading }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedValue] = useDebounce(value, 300);
  
  return (
    <div className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Search tools, categories, brands..."
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => setIsOpen(true)}
          className="pl-10 pr-10"
          aria-label="Search tools"
          aria-expanded={isOpen && suggestions.length > 0}
          aria-haspopup="listbox"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-muted-foreground" />
        )}
        {value && !isLoading && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => onChange('')}
            aria-label="Clear search"
          >
            <X className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      {/* Search Suggestions Dropdown */}
      {isOpen && suggestions.length > 0 && (
        <Card className="absolute top-full left-0 right-0 mt-1 z-50 max-h-80 overflow-y-auto">
          <div role="listbox" aria-label="Search suggestions">
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.id}
                role="option"
                className="w-full px-4 py-3 text-left hover:bg-muted transition-colors flex items-center gap-3 border-b last:border-b-0"
                onClick={() => onSuggestionSelect?.(suggestion)}
              >
                <div className="flex-shrink-0">
                  {suggestion.type === 'tool' && <Wrench className="w-4 h-4" />}
                  {suggestion.type === 'category' && <Tag className="w-4 h-4" />}
                  {suggestion.type === 'brand' && <Building className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{suggestion.title}</div>
                  {suggestion.subtitle && (
                    <div className="text-sm text-muted-foreground truncate">
                      {suggestion.subtitle}
                    </div>
                  )}
                </div>
                {suggestion.count && (
                  <Badge variant="secondary" className="flex-shrink-0">
                    {suggestion.count}
                  </Badge>
                )}
              </button>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
```

### Filter Panel Component (`ToolFilterPanel`)

**File**: `components/tools/ToolFilterPanel.tsx`

```tsx
interface FilterPanelProps {
  filters: ToolFilters;
  categories: Category[];
  onFiltersChange: (filters: ToolFilters) => void;
  onClear: () => void;
  className?: string;
}

const ToolFilterPanel = ({ filters, categories, onFiltersChange, onClear }) => {
  return (
    <div className="space-y-6">
      {/* Filter Header */}
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-lg">Filters</h3>
        <Button
          variant="outline"
          size="sm"
          onClick={onClear}
          className="text-muted-foreground"
        >
          <X className="w-4 h-4 mr-2" />
          Clear All
        </Button>
      </div>
      
      {/* Category Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Category</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto">
          {categories.map((category) => (
            <div key={category.id} className="flex items-center space-x-2">
              <Checkbox
                id={`category-${category.id}`}
                checked={filters.categories.includes(category.id)}
                onCheckedChange={(checked) => {
                  const newCategories = checked
                    ? [...filters.categories, category.id]
                    : filters.categories.filter(id => id !== category.id);
                  onFiltersChange({
                    ...filters,
                    categories: newCategories
                  });
                }}
              />
              <Label 
                htmlFor={`category-${category.id}`}
                className="text-sm font-normal flex items-center justify-between flex-1 cursor-pointer"
              >
                <span>{category.name}</span>
                <Badge variant="secondary" className="text-xs">
                  {category.tool_count}
                </Badge>
              </Label>
            </div>
          ))}
        </div>
      </div>
      
      {/* Price Range Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Daily Rate (€)</Label>
        <div className="px-2">
          <Slider
            value={[filters.minPrice, filters.maxPrice]}
            onValueChange={([min, max]) => 
              onFiltersChange({
                ...filters,
                minPrice: min,
                maxPrice: max
              })
            }
            max={200}
            min={0}
            step={5}
            className="w-full"
          />
          <div className="flex justify-between text-sm text-muted-foreground mt-1">
            <span>€{filters.minPrice}</span>
            <span>€{filters.maxPrice}+</span>
          </div>
        </div>
      </div>
      
      {/* Distance Filter */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Maximum Distance</Label>
        <Select 
          value={filters.maxDistance.toString()} 
          onValueChange={(value) => 
            onFiltersChange({
              ...filters,
              maxDistance: parseInt(value)
            })
          }
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="5">Within 5 km</SelectItem>
            <SelectItem value="10">Within 10 km</SelectItem>
            <SelectItem value="25">Within 25 km</SelectItem>
            <SelectItem value="50">Within 50 km</SelectItem>
            <SelectItem value="100">Within 100 km</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Availability Toggle */}
      <div className="flex items-center space-x-2">
        <Switch
          id="available-only"
          checked={filters.availableOnly}
          onCheckedChange={(checked) =>
            onFiltersChange({
              ...filters,
              availableOnly: checked
            })
          }
        />
        <Label htmlFor="available-only" className="text-sm">
          Available now only
        </Label>
      </div>
      
      {/* Delivery Option */}
      <div className="flex items-center space-x-2">
        <Switch
          id="delivery-available"
          checked={filters.deliveryAvailable}
          onCheckedChange={(checked) =>
            onFiltersChange({
              ...filters,
              deliveryAvailable: checked
            })
          }
        />
        <Label htmlFor="delivery-available" className="text-sm">
          Delivery available
        </Label>
      </div>
      
      {/* Tool Condition */}
      <div className="space-y-3">
        <Label className="text-sm font-medium">Condition</Label>
        <div className="space-y-2">
          {['Excellent', 'Good', 'Fair'].map((condition) => (
            <div key={condition} className="flex items-center space-x-2">
              <Checkbox
                id={`condition-${condition.toLowerCase()}`}
                checked={filters.conditions.includes(condition)}
                onCheckedChange={(checked) => {
                  const newConditions = checked
                    ? [...filters.conditions, condition]
                    : filters.conditions.filter(c => c !== condition);
                  onFiltersChange({
                    ...filters,
                    conditions: newConditions
                  });
                }}
              />
              <Label 
                htmlFor={`condition-${condition.toLowerCase()}`}
                className="text-sm font-normal cursor-pointer"
              >
                {condition}
              </Label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
```

### Applied Filters Display (`AppliedFilters`)

```tsx
const AppliedFilters = ({ filters, categories, onRemoveFilter }) => {
  const getActiveFilters = () => {
    const active = [];
    
    // Category filters
    filters.categories.forEach(catId => {
      const category = categories.find(c => c.id === catId);
      if (category) {
        active.push({
          type: 'category',
          label: category.name,
          value: catId,
          onRemove: () => onRemoveFilter('category', catId)
        });
      }
    });
    
    // Price range
    if (filters.minPrice > 0 || filters.maxPrice < 200) {
      active.push({
        type: 'price',
        label: `€${filters.minPrice} - €${filters.maxPrice}`,
        value: 'price',
        onRemove: () => onRemoveFilter('price')
      });
    }
    
    // Distance
    if (filters.maxDistance < 100) {
      active.push({
        type: 'distance',
        label: `Within ${filters.maxDistance}km`,
        value: 'distance',
        onRemove: () => onRemoveFilter('distance')
      });
    }
    
    // Boolean filters
    if (filters.availableOnly) {
      active.push({
        type: 'availability',
        label: 'Available now',
        value: 'availability',
        onRemove: () => onRemoveFilter('availability')
      });
    }
    
    if (filters.deliveryAvailable) {
      active.push({
        type: 'delivery',
        label: 'Delivery available',
        value: 'delivery',
        onRemove: () => onRemoveFilter('delivery')
      });
    }
    
    return active;
  };
  
  const activeFilters = getActiveFilters();
  
  if (activeFilters.length === 0) return null;
  
  return (
    <div className="flex flex-wrap gap-2 mb-4">
      {activeFilters.map((filter, index) => (
        <Badge
          key={`${filter.type}-${index}`}
          variant="secondary"
          className="flex items-center gap-2 pr-2 pl-3 py-1.5"
        >
          <span className="text-xs">{filter.label}</span>
          <Button
            variant="ghost"
            size="icon"
            className="h-4 w-4 hover:bg-destructive hover:text-destructive-foreground"
            onClick={filter.onRemove}
            aria-label={`Remove ${filter.label} filter`}
          >
            <X className="w-3 h-3" />
          </Button>
        </Badge>
      ))}
    </div>
  );
};
```

### Sort Options Component (`ToolSortOptions`)

```tsx
const ToolSortOptions = ({ currentSort, onSortChange, className }) => {
  const sortOptions = [
    { value: 'relevance', label: 'Relevance' },
    { value: 'price_asc', label: 'Price: Low to High' },
    { value: 'price_desc', label: 'Price: High to Low' },
    { value: 'rating_desc', label: 'Highest Rated' },
    { value: 'distance_asc', label: 'Nearest First' },
    { value: 'created_desc', label: 'Newest First' }
  ];
  
  return (
    <Select value={currentSort} onValueChange={onSortChange}>
      <SelectTrigger className={cn("w-48", className)}>
        <SelectValue>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4" />
            <span>
              {sortOptions.find(opt => opt.value === currentSort)?.label || 'Sort by'}
            </span>
          </div>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {sortOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};
```

---

## Tool Detail Page Layout

### Tool Detail Page Structure (`/tools/[id]/page.tsx`)

```tsx
const ToolDetailPage = ({ params }: { params: { id: string } }) => {
  const { data: tool, isLoading, error } = useTool(params.id);
  const { user } = useAuth();
  const isOwner = user?.id === tool?.owner.id;
  
  if (isLoading) return <ToolDetailSkeleton />;
  if (error) return <ErrorBoundary error={error} />;
  if (!tool) return <NotFound />;
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Main Content - Left Side */}
        <div className="lg:col-span-8 space-y-6">
          {/* Breadcrumb */}
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink href="/tools">Tools</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbLink href={`/tools?category=${tool.category}`}>
                  {tool.category}
                </BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{tool.title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
          
          {/* Tool Images */}
          <ToolImageGallery
            images={tool.photos}
            alt={tool.title}
            className="w-full"
          />
          
          {/* Tool Information */}
          <div className="space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold tracking-tight">
                  {tool.title}
                </h1>
                <p className="text-muted-foreground mt-1">
                  {tool.category} • {tool.condition} condition
                </p>
              </div>
              <div className="flex items-center gap-2">
                <FavoriteButton toolId={tool.id} size="lg" />
                <ShareButton tool={tool} />
              </div>
            </div>
            
            {/* Rating */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={cn(
                        "w-5 h-5",
                        star <= Math.round(tool.average_rating)
                          ? "fill-amber-400 text-amber-400"
                          : "fill-muted text-muted"
                      )}
                    />
                  ))}
                </div>
                <span className="font-medium ml-2">
                  {tool.average_rating.toFixed(1)}
                </span>
                <span className="text-muted-foreground">
                  ({tool.review_count} reviews)
                </span>
              </div>
              {tool.review_count > 0 && (
                <Button 
                  variant="link" 
                  className="p-0 h-auto text-primary"
                  onClick={() => scrollToReviews()}
                >
                  See all reviews
                </Button>
              )}
            </div>
          </div>
          
          {/* Description */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Description</h2>
            <div className="prose prose-sm max-w-none">
              <p className="text-muted-foreground leading-relaxed">
                {tool.description}
              </p>
            </div>
          </div>
          
          {/* Specifications */}
          <div className="space-y-3">
            <h2 className="text-xl font-semibold">Specifications</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                {tool.brand && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Brand</span>
                    <span className="font-medium">{tool.brand}</span>
                  </div>
                )}
                {tool.model && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Model</span>
                    <span className="font-medium">{tool.model}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Condition</span>
                  <Badge variant="outline">{tool.condition}</Badge>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Category</span>
                  <span className="font-medium">{tool.category}</span>
                </div>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Daily Rate</span>
                  <span className="font-semibold text-lg">€{tool.daily_rate}</span>
                </div>
                {tool.deposit_required > 0 && (
                  <div className="flex justify-between py-2 border-b">
                    <span className="text-muted-foreground">Deposit</span>
                    <span className="font-medium">€{tool.deposit_required}</span>
                  </div>
                )}
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Delivery</span>
                  <span className="font-medium">
                    {tool.delivery_available 
                      ? `€${tool.delivery_fee || 0}` 
                      : 'Pickup only'
                    }
                  </span>
                </div>
                <div className="flex justify-between py-2 border-b">
                  <span className="text-muted-foreground">Location</span>
                  <span className="font-medium">{tool.location}</span>
                </div>
              </div>
            </div>
          </div>
          
          {/* Reviews Section */}
          <ToolReviewsSection toolId={tool.id} />
        </div>
        
        {/* Sidebar - Right Side */}
        <div className="lg:col-span-4">
          <div className="sticky top-24 space-y-6">
            {/* Owner Profile Card */}
            <OwnerProfileCard owner={tool.owner} />
            
            {/* Booking Card */}
            {!isOwner && (
              <ToolBookingCard
                tool={tool}
                onBookingRequest={(dates) => handleBookingRequest(tool.id, dates)}
              />
            )}
            
            {/* Owner Actions */}
            {isOwner && (
              <OwnerActionsCard
                tool={tool}
                onEdit={() => router.push(`/tools/${tool.id}/edit`)}
                onDelete={() => handleDeleteTool(tool.id)}
                onToggleAvailability={() => handleToggleAvailability(tool.id)}
              />
            )}
            
            {/* Similar Tools */}
            <SimilarToolsCard
              categoryId={tool.category_id}
              currentToolId={tool.id}
              location={tool.location}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
```

### Tool Image Gallery (`ToolImageGallery`)

```tsx
const ToolImageGallery = ({ images, alt }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  
  return (
    <div className="space-y-4">
      {/* Main Image */}
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg group cursor-pointer"
           onClick={() => setIsLightboxOpen(true)}>
        <Image
          src={images[currentIndex] || '/placeholder-tool.jpg'}
          alt={`${alt} - Main image`}
          fill
          className="object-cover transition-transform group-hover:scale-105"
          priority
        />
        
        {/* Zoom Indicator */}
        <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
          <div className="bg-black/50 text-white p-2 rounded-full">
            <ZoomIn className="w-4 h-4" />
          </div>
        </div>
        
        {/* Navigation Arrows */}
        {images.length > 1 && (
          <>
            <Button
              variant="outline"
              size="icon"
              className="absolute left-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(prev => 
                  prev === 0 ? images.length - 1 : prev - 1
                );
              }}
              aria-label="Previous image"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="absolute right-4 top-1/2 -translate-y-1/2 bg-background/80 backdrop-blur-sm opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIndex(prev => 
                  prev === images.length - 1 ? 0 : prev + 1
                );
              }}
              aria-label="Next image"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>
          </>
        )}
        
        {/* Image Counter */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <Badge variant="secondary" className="bg-black/50 text-white">
              {currentIndex + 1} / {images.length}
            </Badge>
          </div>
        )}
      </div>
      
      {/* Thumbnail Grid */}
      {images.length > 1 && (
        <div className="grid grid-cols-6 gap-2">
          {images.slice(0, 6).map((image, index) => (
            <button
              key={index}
              className={cn(
                "aspect-square overflow-hidden rounded border-2 relative",
                index === currentIndex 
                  ? "border-primary" 
                  : "border-border hover:border-primary/50"
              )}
              onClick={() => setCurrentIndex(index)}
            >
              <Image
                src={image}
                alt={`${alt} - Thumbnail ${index + 1}`}
                fill
                className="object-cover"
              />
              {index === 5 && images.length > 6 && (
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-sm font-medium">
                  +{images.length - 6}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
      
      {/* Lightbox */}
      {isLightboxOpen && (
        <ToolImageLightbox
          images={images}
          alt={alt}
          currentIndex={currentIndex}
          onClose={() => setIsLightboxOpen(false)}
          onIndexChange={setCurrentIndex}
        />
      )}
    </div>
  );
};
```

### Tool Booking Card (`ToolBookingCard`)

```tsx
const ToolBookingCard = ({ tool, onBookingRequest }) => {
  const [selectedDates, setSelectedDates] = useState({
    startDate: null,
    endDate: null
  });
  const [isCalculating, setIsCalculating] = useState(false);
  const [costBreakdown, setCostBreakdown] = useState(null);
  
  const calculateCost = async (dates) => {
    if (!dates.startDate || !dates.endDate) return;
    
    setIsCalculating(true);
    try {
      const response = await api.post(`/tools/${tool.id}/calculate-cost`, {
        start_date: dates.startDate,
        end_date: dates.endDate,
        delivery_requested: false
      });
      setCostBreakdown(response.data);
    } catch (error) {
      console.error('Cost calculation failed:', error);
    } finally {
      setIsCalculating(false);
    }
  };
  
  useEffect(() => {
    if (selectedDates.startDate && selectedDates.endDate) {
      calculateCost(selectedDates);
    }
  }, [selectedDates]);
  
  return (
    <Card className="p-6">
      <div className="space-y-6">
        {/* Price Header */}
        <div className="flex items-baseline gap-2">
          <span className="text-3xl font-bold">€{tool.daily_rate}</span>
          <span className="text-muted-foreground">per day</span>
        </div>
        
        {/* Availability Status */}
        <div className="flex items-center gap-2">
          <div className={cn(
            "w-3 h-3 rounded-full",
            tool.is_available ? "bg-green-500" : "bg-red-500"
          )} />
          <span className={cn(
            "font-medium",
            tool.is_available ? "text-green-700" : "text-red-700"
          )}>
            {tool.is_available ? "Available" : "Not Available"}
          </span>
        </div>
        
        {/* Date Picker */}
        <div className="space-y-3">
          <Label>Select Dates</Label>
          <ToolAvailabilityCalendar
            toolId={tool.id}
            selectedDates={selectedDates}
            onDatesChange={setSelectedDates}
            disabled={!tool.is_available}
          />
        </div>
        
        {/* Cost Breakdown */}
        {costBreakdown && (
          <div className="space-y-3 p-4 bg-muted rounded-lg">
            <h4 className="font-medium">Cost Breakdown</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>€{tool.daily_rate} × {costBreakdown.days} days</span>
                <span>€{costBreakdown.rental_cost}</span>
              </div>
              {costBreakdown.delivery_fee > 0 && (
                <div className="flex justify-between">
                  <span>Delivery</span>
                  <span>€{costBreakdown.delivery_fee}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-medium">
                <span>Subtotal</span>
                <span>€{costBreakdown.total_cost}</span>
              </div>
              {tool.deposit_required > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Security Deposit</span>
                  <span>€{tool.deposit_required}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold text-lg">
                <span>Total</span>
                <span>
                  €{costBreakdown.total_cost + (tool.deposit_required || 0)}
                </span>
              </div>
            </div>
          </div>
        )}
        
        {/* Booking Button */}
        <Button
          className="w-full"
          size="lg"
          disabled={
            !tool.is_available || 
            !selectedDates.startDate || 
            !selectedDates.endDate ||
            isCalculating
          }
          onClick={() => onBookingRequest(selectedDates)}
        >
          {isCalculating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calculating...
            </>
          ) : (
            'Request Booking'
          )}
        </Button>
        
        {/* Additional Info */}
        <div className="text-xs text-muted-foreground space-y-1">
          <p>• You won't be charged yet</p>
          <p>• Owner will respond within 24 hours</p>
          {tool.deposit_required > 0 && (
            <p>• Security deposit is refundable</p>
          )}
        </div>
      </div>
    </Card>
  );
};
```

### Owner Profile Card (`OwnerProfileCard`)

```tsx
const OwnerProfileCard = ({ owner }) => {
  return (
    <Card className="p-6">
      <div className="space-y-4">
        {/* Owner Header */}
        <div className="flex items-center gap-4">
          <Avatar className="w-16 h-16">
            <AvatarImage src={owner.avatar_url} alt={owner.full_name} />
            <AvatarFallback className="text-lg font-semibold">
              {owner.full_name.split(' ').map(n => n[0]).join('')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <h3 className="font-semibold text-lg">{owner.full_name}</h3>
            <div className="flex items-center gap-1 mt-1">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
              <span className="font-medium">{owner.average_rating.toFixed(1)}</span>
              <span className="text-muted-foreground text-sm">
                ({owner.review_count} reviews)
              </span>
            </div>
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="font-semibold text-lg">{owner.tools_count}</div>
            <div className="text-xs text-muted-foreground">Tools</div>
          </div>
          <div>
            <div className="font-semibold text-lg">{owner.bookings_count}</div>
            <div className="text-xs text-muted-foreground">Bookings</div>
          </div>
          <div>
            <div className="font-semibold text-lg">
              {owner.response_time || '< 1h'}
            </div>
            <div className="text-xs text-muted-foreground">Response</div>
          </div>
        </div>
        
        {/* Quick Info */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <span>{owner.location}</span>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <span>Joined {formatDate(owner.created_at, 'MMM yyyy')}</span>
          </div>
          {owner.verified && (
            <div className="flex items-center gap-2">
              <Shield className="w-4 h-4 text-green-600" />
              <span className="text-green-700">Verified Member</span>
            </div>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-2">
          <Button variant="outline" className="w-full" size="sm">
            <MessageCircle className="w-4 h-4 mr-2" />
            Contact Owner
          </Button>
          <Button variant="outline" className="w-full" size="sm">
            <Eye className="w-4 h-4 mr-2" />
            View All Tools
          </Button>
        </div>
      </div>
    </Card>
  );
};
```

---

## Tool Management Interface

### My Tools Dashboard (`/my-tools/page.tsx`)

```tsx
const MyToolsPage = () => {
  const { data: myTools, isLoading } = useMyTools();
  const { data: stats } = useMyToolsStats();
  
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">My Tools</h1>
            <p className="text-muted-foreground">
              Manage your tools and track performance
            </p>
          </div>
          <Button asChild>
            <Link href="/tools/new">
              <Plus className="w-4 h-4 mr-2" />
              Add Tool
            </Link>
          </Button>
        </div>
        
        {/* Statistics Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Tools
                </CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.total_tools}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.available_tools} available
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Earnings
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  €{stats.total_earnings.toFixed(0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  €{stats.monthly_earnings.toFixed(0)} this month
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Active Bookings
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.active_bookings}</div>
                <p className="text-xs text-muted-foreground">
                  {stats.pending_requests} pending requests
                </p>
              </CardContent>
            </Card>
            
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Average Rating
                </CardTitle>
                <Star className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {stats.average_rating.toFixed(1)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {stats.total_reviews} reviews
                </p>
              </CardContent>
            </Card>
          </div>
        )}
        
        {/* Tools Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Your Tools</h2>
            <div className="flex items-center gap-2">
              <ToolSortOptions 
                currentSort="created_desc"
                onSortChange={() => {}}
                className="w-40"
              />
              <Button variant="outline" size="sm">
                <Filter className="w-4 h-4 mr-2" />
                Filter
              </Button>
            </div>
          </div>
          
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <MyToolCardSkeleton key={i} />
              ))}
            </div>
          ) : myTools?.length === 0 ? (
            <EmptyMyToolsState />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myTools.map((tool) => (
                <MyToolCard
                  key={tool.id}
                  tool={tool}
                  onEdit={() => router.push(`/tools/${tool.id}/edit`)}
                  onToggleAvailability={() => handleToggleAvailability(tool.id)}
                  onDelete={() => handleDeleteTool(tool.id)}
                  onViewBookings={() => router.push(`/bookings?tool=${tool.id}`)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
```

### My Tool Card Component (`MyToolCard`)

```tsx
const MyToolCard = ({ tool, onEdit, onToggleAvailability, onDelete, onViewBookings }) => {
  const [isOptionsOpen, setIsOptionsOpen] = useState(false);
  
  return (
    <Card className="group relative overflow-hidden">
      {/* Status Indicator */}
      <div className={cn(
        "absolute top-0 left-0 right-0 h-1",
        tool.is_available ? "bg-green-500" : "bg-red-500"
      )} />
      
      <div className="aspect-[4/3] relative overflow-hidden">
        <Image
          src={tool.photos[0] || '/placeholder-tool.jpg'}
          alt={tool.title}
          fill
          className="object-cover transition-transform group-hover:scale-105"
        />
        
        {/* Performance Badge */}
        {tool.booking_stats && (
          <div className="absolute top-2 left-2">
            <Badge
              variant={tool.booking_stats.utilization_rate > 60 ? "default" : "secondary"}
              className="text-xs"
            >
              {tool.booking_stats.utilization_rate}% booked
            </Badge>
          </div>
        )}
        
        {/* Options Menu */}
        <div className="absolute top-2 right-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8 bg-background/80 backdrop-blur-sm"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-4 h-4 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onViewBookings}>
                <Calendar className="w-4 h-4 mr-2" />
                View Bookings
              </DropdownMenuItem>
              <DropdownMenuItem 
                onClick={onToggleAvailability}
                className={tool.is_available ? "text-orange-600" : "text-green-600"}
              >
                {tool.is_available ? (
                  <>
                    <Pause className="w-4 h-4 mr-2" />
                    Mark Unavailable
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Mark Available
                  </>
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem 
                onClick={onDelete}
                className="text-destructive focus:text-destructive"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      <CardContent className="p-4">
        <div className="space-y-3">
          {/* Title and Status */}
          <div className="flex items-start justify-between">
            <h3 className="font-semibold text-sm line-clamp-2 leading-5">
              {tool.title}
            </h3>
            <Badge
              variant={tool.is_available ? "outline" : "secondary"}
              className="ml-2 flex-shrink-0"
            >
              {tool.is_available ? "Available" : "Unavailable"}
            </Badge>
          </div>
          
          {/* Performance Metrics */}
          <div className="grid grid-cols-3 gap-3 text-center text-xs">
            <div>
              <div className="font-medium">{tool.view_count || 0}</div>
              <div className="text-muted-foreground">Views</div>
            </div>
            <div>
              <div className="font-medium">{tool.booking_count || 0}</div>
              <div className="text-muted-foreground">Bookings</div>
            </div>
            <div>
              <div className="font-medium">
                {tool.average_rating ? tool.average_rating.toFixed(1) : '—'}
              </div>
              <div className="text-muted-foreground">Rating</div>
            </div>
          </div>
          
          {/* Pricing and Earnings */}
          <div className="flex items-center justify-between pt-2 border-t">
            <div>
              <span className="font-semibold">€{tool.daily_rate}</span>
              <span className="text-xs text-muted-foreground">/day</span>
            </div>
            <div className="text-right">
              <div className="text-sm font-medium text-green-600">
                €{tool.total_earnings || 0}
              </div>
              <div className="text-xs text-muted-foreground">earned</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
```

### Tool Form Component (`ToolForm`)

```tsx
const ToolForm = ({ tool, onSubmit, isLoading }) => {
  const form = useForm({
    resolver: zodResolver(toolFormSchema),
    defaultValues: tool || {
      title: '',
      description: '',
      category_id: '',
      daily_rate: 0,
      deposit_required: 0,
      condition: 'Good',
      brand: '',
      model: '',
      delivery_available: false,
      delivery_fee: 0,
      photos: []
    }
  });
  
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Information */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Basic Information</h2>
          
          <FormField
            control={form.control}
            name="title"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tool Title *</FormLabel>
                <FormControl>
                  <Input 
                    placeholder="e.g., DeWalt 18V Cordless Drill"
                    {...field}
                  />
                </FormControl>
                <FormDescription>
                  Give your tool a clear, descriptive title
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Description *</FormLabel>
                <FormControl>
                  <Textarea 
                    placeholder="Describe your tool's features, condition, and any special instructions..."
                    rows={4}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="category_id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Category *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.id} value={category.id}>
                          {category.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="condition"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Condition *</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Excellent">Excellent</SelectItem>
                      <SelectItem value="Good">Good</SelectItem>
                      <SelectItem value="Fair">Fair</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="brand"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Brand</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., DeWalt, Bosch" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Model</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., DCD771C2" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Photos */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Photos</h2>
          <ToolPhotoUpload
            photos={form.watch('photos')}
            onPhotosChange={(photos) => form.setValue('photos', photos)}
            maxPhotos={8}
          />
        </div>
        
        {/* Pricing */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Pricing</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="daily_rate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Daily Rate (€) *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        €
                      </span>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-8"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    How much per day? Check similar tools for pricing guidance.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="deposit_required"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Security Deposit (€)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        €
                      </span>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-8"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Optional security deposit to protect against damage
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        
        {/* Delivery Options */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Delivery Options</h2>
          
          <FormField
            control={form.control}
            name="delivery_available"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <FormLabel className="text-base">Offer Delivery</FormLabel>
                  <FormDescription>
                    Deliver the tool to the borrower's location
                  </FormDescription>
                </div>
                <FormControl>
                  <Switch
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                </FormControl>
              </FormItem>
            )}
          />
          
          {form.watch('delivery_available') && (
            <FormField
              control={form.control}
              name="delivery_fee"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Delivery Fee (€)</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                        €
                      </span>
                      <Input 
                        type="number"
                        step="0.01"
                        min="0"
                        className="pl-8"
                        {...field}
                        onChange={(e) => field.onChange(parseFloat(e.target.value))}
                      />
                    </div>
                  </FormControl>
                  <FormDescription>
                    Additional fee for delivery service
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>
        
        {/* Submit Buttons */}
        <div className="flex items-center justify-end gap-4 pt-6 border-t">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              tool ? 'Update Tool' : 'Create Tool'
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
};
```

---

## Mobile-First Design Patterns

### Responsive Breakpoints

```tsx
// Tailwind CSS breakpoints used throughout
const breakpoints = {
  sm: '640px',   // Small devices (landscape phones)
  md: '768px',   // Medium devices (tablets)
  lg: '1024px',  // Large devices (laptops)
  xl: '1280px',  // Extra large devices (desktops)
  '2xl': '1536px' // 2X large devices (large desktops)
};

// Mobile-first grid system
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
```

### Touch-Friendly Interface Design

```tsx
// Minimum touch target sizes (44px minimum)
const touchTargets = {
  small: 'h-10 w-10',      // 40px - for secondary actions
  medium: 'h-11 w-11',     // 44px - standard touch target
  large: 'h-12 w-12'       // 48px - primary actions
};

// Swipeable components using React Spring
const SwipeableToolCard = ({ tool, onSwipeLeft, onSwipeRight }) => {
  const [{ x }, api] = useSpring(() => ({ x: 0 }));
  
  const bind = useDrag(({ down, movement: [mx], direction: [xDir], distance, cancel }) => {
    const trigger = distance > 100;
    if (trigger) {
      cancel();
      if (xDir > 0) {
        onSwipeRight(tool);
      } else {
        onSwipeLeft(tool);
      }
    }
    api.start({ x: down ? mx : 0 });
  });
  
  return (
    <animated.div {...bind()} style={{ x }} className="touch-none">
      <ToolCard tool={tool} />
    </animated.div>
  );
};
```

### Bottom Sheet Modals

```tsx
const FilterBottomSheet = ({ isOpen, onClose, children }) => {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent 
        side="bottom"
        className="h-[80vh] rounded-t-xl"
      >
        <div className="mx-auto w-12 h-1 bg-muted rounded-full mb-6" />
        <SheetHeader className="mb-6">
          <SheetTitle>Filter Tools</SheetTitle>
        </SheetHeader>
        <div className="overflow-y-auto pb-20">
          {children}
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 bg-background border-t">
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button className="flex-1">Apply Filters</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};
```

### Floating Action Button

```tsx
const FloatingActionButton = ({ onClick, className, children }) => {
  return (
    <Button
      size="icon"
      className={cn(
        "fixed bottom-6 right-6 h-14 w-14 rounded-full shadow-lg z-50",
        "sm:bottom-8 sm:right-8 lg:hidden", // Hide on desktop
        className
      )}
      onClick={onClick}
    >
      {children}
    </Button>
  );
};

// Usage in tool listing page
<FloatingActionButton onClick={() => setFilterOpen(true)}>
  <Filter className="w-6 h-6" />
</FloatingActionButton>
```

### Infinite Scroll Implementation

```tsx
const useInfiniteScroll = (fetchMore, hasMore, threshold = 1000) => {
  const [isFetching, setIsFetching] = useState(false);
  
  useEffect(() => {
    const handleScroll = () => {
      if (!hasMore || isFetching) return;
      
      const { scrollTop, scrollHeight, clientHeight } = document.documentElement;
      if (scrollHeight - scrollTop - clientHeight < threshold) {
        setIsFetching(true);
        fetchMore().finally(() => setIsFetching(false));
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [fetchMore, hasMore, isFetching, threshold]);
  
  return isFetching;
};

// Usage in tool listing
const ToolListingPage = () => {
  const { data, fetchNextPage, hasNextPage } = useInfiniteTools();
  const isLoadingMore = useInfiniteScroll(fetchNextPage, hasNextPage);
  
  return (
    <div>
      {/* Tool grid */}
      {isLoadingMore && <LoadingSpinner />}
    </div>
  );
};
```

---

## Performance Optimizations

### Image Optimization Strategy

```tsx
// Next.js Image component with optimization
const OptimizedToolImage = ({ 
  src, 
  alt, 
  priority = false,
  fill = false,
  width,
  height,
  className 
}) => {
  return (
    <Image
      src={src || '/placeholder-tool.jpg'}
      alt={alt}
      width={width}
      height={height}
      fill={fill}
      priority={priority}
      className={className}
      placeholder="blur"
      blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAhEQACAQIHAQAAAAAAAAAAAAABAgADBAUREiExQVFhkf/aAAwDAQACEQMRAD8A0XGARFIbQqRxnWKgXdC3XCjm2bW1cPi9gKQKW9xCBHYKdCgBwZ7OhfXx8Xql/9k="
      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      quality={85}
      onError={(e) => {
        e.currentTarget.src = '/placeholder-tool.jpg';
      }}
    />
  );
};

// Lazy loading with Intersection Observer
const LazyToolCard = ({ tool, ...props }) => {
  const [isVisible, setIsVisible] = useState(false);
  const ref = useRef();
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1 }
    );
    
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  
  return (
    <div ref={ref}>
      {isVisible ? <ToolCard tool={tool} {...props} /> : <ToolCardSkeleton />}
    </div>
  );
};
```

### Search Debouncing and Caching

```tsx
// Custom debounce hook
const useDebounce = (value, delay) => {
  const [debouncedValue, setDebouncedValue] = useState(value);
  
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);
    
    return () => clearTimeout(handler);
  }, [value, delay]);
  
  return debouncedValue;
};

// SWR configuration with caching
const swrConfig = {
  revalidateOnFocus: false,
  revalidateOnReconnect: true,
  dedupingInterval: 2000,
  focusThrottleInterval: 5000,
  errorRetryCount: 3,
  shouldRetryOnError: (error) => error.status !== 404
};

// Search with caching and deduplication
const useToolSearch = (query, filters) => {
  const debouncedQuery = useDebounce(query, 300);
  const cacheKey = `search:${debouncedQuery}:${JSON.stringify(filters)}`;
  
  return useSWR(
    debouncedQuery ? cacheKey : null,
    () => api.searchTools(debouncedQuery, filters),
    {
      ...swrConfig,
      keepPreviousData: true,
      dedupingInterval: 60000 // 1 minute cache
    }
  );
};
```

### Virtual Scrolling for Large Lists

```tsx
// Virtual scrolling with react-window
import { FixedSizeGrid as Grid } from 'react-window';

const VirtualizedToolGrid = ({ tools, onToolClick }) => {
  const containerRef = useRef();
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    return () => window.removeEventListener('resize', updateDimensions);
  }, []);
  
  const columnCount = Math.floor(dimensions.width / 320); // Card width + gap
  const rowCount = Math.ceil(tools.length / columnCount);
  
  const Cell = ({ columnIndex, rowIndex, style }) => {
    const index = rowIndex * columnCount + columnIndex;
    const tool = tools[index];
    
    if (!tool) return null;
    
    return (
      <div style={style} className="p-2">
        <ToolCard tool={tool} onBookClick={() => onToolClick(tool)} />
      </div>
    );
  };
  
  return (
    <div ref={containerRef} className="w-full h-96">
      {dimensions.width > 0 && (
        <Grid
          columnCount={columnCount}
          columnWidth={320}
          height={dimensions.height}
          rowCount={rowCount}
          rowHeight={400}
          width={dimensions.width}
        >
          {Cell}
        </Grid>
      )}
    </div>
  );
};
```

### Skeleton Loading States

```tsx
// Tool card skeleton
const ToolCardSkeleton = () => {
  return (
    <Card className="overflow-hidden">
      <div className="aspect-[4/3] bg-muted animate-pulse" />
      <CardContent className="p-4">
        <div className="space-y-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2 flex-1">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
            </div>
            <div className="h-4 w-12 bg-muted rounded animate-pulse" />
          </div>
          <div className="flex items-center justify-between">
            <div className="h-6 w-16 bg-muted rounded animate-pulse" />
            <div className="h-4 w-20 bg-muted rounded animate-pulse" />
          </div>
          <div className="h-9 bg-muted rounded animate-pulse" />
        </div>
      </CardContent>
    </Card>
  );
};

// Tool detail page skeleton
const ToolDetailSkeleton = () => {
  return (
    <div className="container mx-auto px-4 py-6">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="aspect-[4/3] bg-muted rounded-lg animate-pulse" />
          <div className="space-y-4">
            <div className="h-8 bg-muted rounded w-3/4 animate-pulse" />
            <div className="h-4 bg-muted rounded w-1/2 animate-pulse" />
            <div className="space-y-2">
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded animate-pulse" />
              <div className="h-4 bg-muted rounded w-2/3 animate-pulse" />
            </div>
          </div>
        </div>
        <div className="lg:col-span-4">
          <div className="h-96 bg-muted rounded-lg animate-pulse" />
        </div>
      </div>
    </div>
  );
};
```

### Bundle Optimization

```tsx
// Dynamic imports for heavy components
const ToolImageLightbox = dynamic(
  () => import('./ToolImageLightbox'),
  { 
    loading: () => <div className="animate-pulse bg-muted h-64 rounded" />,
    ssr: false 
  }
);

const ToolAvailabilityCalendar = dynamic(
  () => import('./ToolAvailabilityCalendar'),
  { loading: () => <CalendarSkeleton /> }
);

// Code splitting by route
const MyToolsPage = dynamic(() => import('./MyToolsPage'));
const ToolDetailPage = dynamic(() => import('./ToolDetailPage'));

// Preload critical components
import('./ToolCard');
import('./ToolSearchBar');
```

---

## Component Architecture

### File Structure

```
frontend/
├── components/
│   ├── ui/                  # shadcn/ui base components
│   ├── tools/
│   │   ├── ToolCard.tsx
│   │   ├── ToolGrid.tsx
│   │   ├── ToolSearchBar.tsx
│   │   ├── ToolFilterPanel.tsx
│   │   ├── ToolImageGallery.tsx
│   │   ├── ToolBookingCard.tsx
│   │   ├── ToolAvailabilityCalendar.tsx
│   │   ├── ToolForm.tsx
│   │   ├── MyToolCard.tsx
│   │   └── index.ts
│   ├── layout/
│   └── common/
├── app/
│   ├── tools/
│   │   ├── page.tsx         # Tool listing
│   │   ├── [id]/
│   │   │   ├── page.tsx     # Tool detail
│   │   │   └── edit/
│   │   │       └── page.tsx # Edit tool
│   │   ├── new/
│   │   │   └── page.tsx     # Create tool
│   │   └── categories/
│   │       └── page.tsx     # Categories page
│   └── my-tools/
│       └── page.tsx         # My tools dashboard
├── hooks/
│   ├── useTools.ts
│   ├── useToolSearch.ts
│   ├── useInfiniteScroll.ts
│   └── useDebounce.ts
├── types/
│   └── tool.ts
└── lib/
    ├── api.ts
    ├── utils.ts
    └── validations.ts
```

### Reusable Hook Patterns

```tsx
// useTools hook for data fetching
const useTools = (filters?: ToolFilters, options?: SWROptions) => {
  const queryString = filters ? new URLSearchParams(filters).toString() : '';
  const { data, error, mutate } = useSWR(
    `/tools?${queryString}`,
    api.getTools,
    options
  );
  
  return {
    tools: data?.tools || [],
    totalCount: data?.total_count || 0,
    isLoading: !error && !data,
    isError: error,
    refresh: mutate
  };
};

// useToolMutations for create/update/delete
const useToolMutations = () => {
  const { mutate } = useSWRConfig();
  
  const createTool = async (toolData: CreateToolRequest) => {
    const result = await api.createTool(toolData);
    mutate(key => typeof key === 'string' && key.startsWith('/tools'));
    return result;
  };
  
  const updateTool = async (id: string, toolData: UpdateToolRequest) => {
    const result = await api.updateTool(id, toolData);
    mutate(`/tools/${id}`);
    mutate(key => typeof key === 'string' && key.startsWith('/tools'));
    return result;
  };
  
  const deleteTool = async (id: string) => {
    await api.deleteTool(id);
    mutate(key => typeof key === 'string' && key.startsWith('/tools'));
  };
  
  return { createTool, updateTool, deleteTool };
};
```

---

## State Management

### Global State with Zustand

```tsx
// stores/toolStore.ts
interface ToolState {
  filters: ToolFilters;
  searchQuery: string;
  sortOrder: string;
  selectedCategories: string[];
  favoriteTools: string[];
  
  // Actions
  setFilters: (filters: Partial<ToolFilters>) => void;
  setSearchQuery: (query: string) => void;
  setSortOrder: (order: string) => void;
  toggleFavorite: (toolId: string) => void;
  clearFilters: () => void;
}

export const useToolStore = create<ToolState>((set, get) => ({
  filters: {
    categories: [],
    minPrice: 0,
    maxPrice: 200,
    maxDistance: 25,
    availableOnly: false,
    deliveryAvailable: false,
    conditions: []
  },
  searchQuery: '',
  sortOrder: 'relevance',
  selectedCategories: [],
  favoriteTools: [],
  
  setFilters: (newFilters) =>
    set((state) => ({
      filters: { ...state.filters, ...newFilters }
    })),
    
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  setSortOrder: (order) => set({ sortOrder: order }),
  
  toggleFavorite: (toolId) =>
    set((state) => ({
      favoriteTools: state.favoriteTools.includes(toolId)
        ? state.favoriteTools.filter(id => id !== toolId)
        : [...state.favoriteTools, toolId]
    })),
    
  clearFilters: () =>
    set({
      filters: {
        categories: [],
        minPrice: 0,
        maxPrice: 200,
        maxDistance: 25,
        availableOnly: false,
        deliveryAvailable: false,
        conditions: []
      },
      searchQuery: '',
      selectedCategories: []
    })
}));
```

### Server State with SWR

```tsx
// hooks/useTools.ts
export const useInfiniteTools = (filters: ToolFilters) => {
  const {
    data,
    error,
    size,
    setSize,
    isValidating,
    mutate
  } = useSWRInfinite(
    (index) => {
      const params = new URLSearchParams({
        ...filters,
        page: (index + 1).toString(),
        limit: '12'
      });
      return `/tools?${params}`;
    },
    api.getTools,
    {
      revalidateFirstPage: false,
      persistSize: true
    }
  );
  
  const tools = data ? data.flatMap(page => page.tools) : [];
  const hasMore = data ? data[data.length - 1]?.has_more : false;
  
  return {
    tools,
    error,
    isLoading: !error && !data,
    isLoadingMore: isValidating && size > 0 && data && typeof data[size - 1] === 'undefined',
    hasMore,
    loadMore: () => setSize(size + 1),
    refresh: mutate
  };
};
```

---

## API Integration

### API Client Implementation

```tsx
// lib/api.ts
class ToolAPI {
  private baseURL = process.env.NEXT_PUBLIC_API_URL;
  
  // Get tools with pagination and filtering
  async getTools(params: ToolSearchParams): Promise<ToolListResponse> {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`${this.baseURL}/tools?${queryString}`, {
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch tools');
    }
    
    return response.json();
  }
  
  // Get single tool
  async getTool(id: string): Promise<Tool> {
    const response = await fetch(`${this.baseURL}/tools/${id}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      if (response.status === 404) {
        throw new NotFoundError('Tool not found');
      }
      throw new Error('Failed to fetch tool');
    }
    
    return response.json();
  }
  
  // Search tools with suggestions
  async searchTools(query: string, limit = 10): Promise<SearchSuggestion[]> {
    const response = await fetch(
      `${this.baseURL}/tools/search/suggestions?q=${encodeURIComponent(query)}&limit=${limit}`,
      { credentials: 'include' }
    );
    
    return response.ok ? response.json() : [];
  }
  
  // Get tool categories
  async getCategories(): Promise<Category[]> {
    const response = await fetch(`${this.baseURL}/tools/categories`, {
      credentials: 'include'
    });
    
    return response.ok ? response.json() : [];
  }
  
  // Create new tool (authenticated)
  async createTool(toolData: CreateToolRequest): Promise<Tool> {
    const response = await fetch(`${this.baseURL}/tools`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toolData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.message, response.status, error.details);
    }
    
    return response.json();
  }
  
  // Update tool (authenticated)
  async updateTool(id: string, toolData: UpdateToolRequest): Promise<Tool> {
    const response = await fetch(`${this.baseURL}/tools/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(toolData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new APIError(error.message, response.status, error.details);
    }
    
    return response.json();
  }
  
  // Delete tool (authenticated)
  async deleteTool(id: string): Promise<void> {
    const response = await fetch(`${this.baseURL}/tools/${id}`, {
      method: 'DELETE',
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to delete tool');
    }
  }
  
  // Get my tools (authenticated)
  async getMyTools(params?: MyToolsParams): Promise<MyToolsResponse> {
    const queryString = params ? new URLSearchParams(params).toString() : '';
    const response = await fetch(`${this.baseURL}/tools/my-tools?${queryString}`, {
      credentials: 'include'
    });
    
    if (!response.ok) {
      throw new Error('Failed to fetch your tools');
    }
    
    return response.json();
  }
}

export const toolAPI = new ToolAPI();
```

### Error Handling

```tsx
// lib/errors.ts
export class APIError extends Error {
  constructor(
    message: string,
    public status: number,
    public details?: any
  ) {
    super(message);
    this.name = 'APIError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

// Error boundary component
export const ToolErrorBoundary = ({ error, reset }: ErrorBoundaryProps) => {
  if (error instanceof NotFoundError) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold mb-4">Tool Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The tool you're looking for doesn't exist or has been removed.
        </p>
        <Button asChild>
          <Link href="/tools">Browse All Tools</Link>
        </Button>
      </div>
    );
  }
  
  return (
    <div className="text-center py-12">
      <h2 className="text-2xl font-bold mb-4">Something went wrong</h2>
      <p className="text-muted-foreground mb-6">
        We encountered an error while loading the tools.
      </p>
      <div className="space-x-4">
        <Button onClick={reset}>Try Again</Button>
        <Button variant="outline" asChild>
          <Link href="/tools">Browse All Tools</Link>
        </Button>
      </div>
    </div>
  );
};
```

---

## Accessibility Guidelines

### WCAG Compliance Patterns

```tsx
// Accessible tool card with proper labeling
const AccessibleToolCard = ({ tool }) => {
  return (
    <Card
      className="focus-within:ring-2 focus-within:ring-primary group"
      role="article"
      aria-labelledby={`tool-title-${tool.id}`}
      aria-describedby={`tool-description-${tool.id}`}
    >
      <div className="aspect-[4/3] relative">
        <Image
          src={tool.photos[0]}
          alt={`${tool.title} - ${tool.condition} condition ${tool.category}`}
          fill
          className="object-cover"
        />
      </div>
      
      <CardContent className="p-4">
        <h3 
          id={`tool-title-${tool.id}`}
          className="font-semibold text-sm line-clamp-2"
        >
          <Link 
            href={`/tools/${tool.id}`}
            className="focus:outline-none focus:underline"
            aria-describedby={`tool-description-${tool.id}`}
          >
            {tool.title}
          </Link>
        </h3>
        
        <div id={`tool-description-${tool.id}`} className="sr-only">
          {tool.category} tool in {tool.condition} condition, 
          available for €{tool.daily_rate} per day,
          rated {tool.average_rating.toFixed(1)} stars,
          located {tool.distance}km away
        </div>
        
        {/* Rating with accessible label */}
        <div className="flex items-center gap-1" role="img" aria-label={`Rated ${tool.average_rating.toFixed(1)} out of 5 stars based on ${tool.review_count} reviews`}>
          {[1, 2, 3, 4, 5].map((star) => (
            <Star
              key={star}
              className={cn(
                "w-3 h-3",
                star <= Math.round(tool.average_rating)
                  ? "fill-amber-400 text-amber-400"
                  : "fill-muted text-muted"
              )}
              aria-hidden="true"
            />
          ))}
          <span className="text-xs ml-1" aria-hidden="true">
            ({tool.review_count})
          </span>
        </div>
        
        <Button
          className="w-full mt-3"
          size="sm"
          disabled={!tool.is_available}
          aria-label={
            tool.is_available 
              ? `Book ${tool.title} for €${tool.daily_rate} per day`
              : `${tool.title} is currently unavailable`
          }
        >
          {tool.is_available ? 'Book Now' : 'Unavailable'}
        </Button>
      </CardContent>
    </Card>
  );
};
```

### Keyboard Navigation

```tsx
// Accessible filter panel with keyboard support
const AccessibleFilterPanel = ({ filters, onFiltersChange }) => {
  const [focusedCategory, setFocusedCategory] = useState(0);
  
  const handleKeyDown = (event: KeyboardEvent, action: () => void) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      action();
    }
  };
  
  const handleCategoryKeyDown = (event: KeyboardEvent, index: number) => {
    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setFocusedCategory((prev) => 
          prev < categories.length - 1 ? prev + 1 : prev
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setFocusedCategory((prev) => prev > 0 ? prev - 1 : prev);
        break;
    }
  };
  
  return (
    <div className="space-y-6" role="form" aria-label="Filter tools">
      <fieldset>
        <legend className="text-sm font-medium mb-3">Category</legend>
        <div 
          className="space-y-2" 
          role="group" 
          aria-label="Tool categories"
          onKeyDown={handleCategoryKeyDown}
        >
          {categories.map((category, index) => (
            <div 
              key={category.id} 
              className={cn(
                "flex items-center space-x-2 p-2 rounded",
                focusedCategory === index && "bg-muted"
              )}
            >
              <Checkbox
                id={`category-${category.id}`}
                checked={filters.categories.includes(category.id)}
                onCheckedChange={(checked) => {
                  const newCategories = checked
                    ? [...filters.categories, category.id]
                    : filters.categories.filter(id => id !== category.id);
                  onFiltersChange({
                    ...filters,
                    categories: newCategories
                  });
                }}
                onFocus={() => setFocusedCategory(index)}
                aria-describedby={`category-${category.id}-count`}
              />
              <Label 
                htmlFor={`category-${category.id}`}
                className="text-sm font-normal flex items-center justify-between flex-1 cursor-pointer"
              >
                <span>{category.name}</span>
                <Badge 
                  variant="secondary" 
                  className="text-xs"
                  id={`category-${category.id}-count`}
                  aria-label={`${category.tool_count} tools available`}
                >
                  {category.tool_count}
                </Badge>
              </Label>
            </div>
          ))}
        </div>
      </fieldset>
    </div>
  );
};
```

### Screen Reader Support

```tsx
// Live regions for dynamic content updates
const SearchResults = ({ tools, isLoading, searchQuery }) => {
  const [announcement, setAnnouncement] = useState('');
  
  useEffect(() => {
    if (!isLoading && tools) {
      const count = tools.length;
      const message = searchQuery
        ? `Found ${count} tools matching "${searchQuery}"`
        : `Showing ${count} tools`;
      setAnnouncement(message);
    }
  }, [tools, isLoading, searchQuery]);
  
  return (
    <div>
      {/* Screen reader announcements */}
      <div 
        role="status" 
        aria-live="polite" 
        aria-atomic="true"
        className="sr-only"
      >
        {isLoading ? 'Loading tools...' : announcement}
      </div>
      
      {/* Skip link for keyboard users */}
      <a 
        href="#main-content" 
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 bg-primary text-primary-foreground px-4 py-2 rounded z-50"
      >
        Skip to search results
      </a>
      
      <main id="main-content" tabIndex={-1}>
        <h1 className="text-2xl font-bold mb-6">
          {searchQuery ? `Search results for "${searchQuery}"` : 'All tools'}
        </h1>
        
        {/* Results */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {tools.map((tool) => (
            <AccessibleToolCard key={tool.id} tool={tool} />
          ))}
        </div>
      </main>
    </div>
  );
};
```

---

## Implementation Timeline

### Phase 1: Core Components (Week 1-2)
1. **ToolCard component** with responsive design
2. **ToolSearchBar** with debounced search
3. **Basic tool listing page** with pagination
4. **Tool detail page** structure
5. **Integration with FastAPI backend**

### Phase 2: Advanced Features (Week 2-3)
1. **Filter panel** with category/price/location filters
2. **Image gallery** with lightbox functionality
3. **Tool booking card** with availability calendar
4. **Mobile-optimized interfaces**
5. **Search suggestions and autocomplete**

### Phase 3: Tool Management (Week 3-4)
1. **My Tools dashboard** with statistics
2. **Tool creation/editing forms**
3. **Photo upload functionality**
4. **Tool availability management**
5. **Performance analytics**

### Phase 4: Optimization (Week 4-5)
1. **Infinite scrolling** implementation
2. **Virtual scrolling** for large lists
3. **Image optimization** and lazy loading
4. **Bundle optimization** and code splitting
5. **Accessibility testing** and compliance

### Phase 5: Polish & Testing (Week 5-6)
1. **Error boundary** implementation
2. **Loading states** and skeletons
3. **Comprehensive testing**
4. **Performance monitoring**
5. **Final accessibility audit**

---

## Success Metrics

### Performance Targets
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Time to Interactive**: < 3s
- **Bundle Size**: < 250KB gzipped (initial)

### User Experience Goals
- **Mobile Usage**: > 60% of traffic
- **Search Conversion**: > 15% search-to-booking
- **Tool Discovery**: Average 5+ tools viewed per session
- **Accessibility Score**: WCAG AA compliance

### Technical Requirements
- **Browser Support**: Chrome, Firefox, Safari, Edge (last 2 versions)
- **Mobile Support**: iOS Safari, Android Chrome
- **Offline Capability**: Basic caching with service worker
- **SEO Optimization**: Server-side rendering for tool pages

This comprehensive documentation provides the foundation for implementing a production-ready tool browsing interface that delivers excellent user experience across all devices while maintaining performance and accessibility standards.