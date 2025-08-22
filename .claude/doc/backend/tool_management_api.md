# Tool Management API Specification

## Overview

This document provides comprehensive API specifications for the tool management system in Wippestoolen, a neighborhood tool-sharing platform. The API enables users to manage tool listings, discover available tools, and handle tool photos.

## Base Configuration

- **Base URL**: `/api/v1`
- **Authentication**: JWT Bearer tokens required for most endpoints
- **Content-Type**: `application/json` for JSON payloads, `multipart/form-data` for file uploads
- **Rate Limiting**: 100 requests/minute per user for standard endpoints, 20 requests/minute for uploads

## Data Models & Schemas

### Core Pydantic Schemas

```python
# Request Schemas
class ToolCreateRequest(BaseModel):
    title: str = Field(..., min_length=3, max_length=200, description="Tool title")
    description: str = Field(..., min_length=10, max_length=2000, description="Detailed description")
    category_id: int = Field(..., gt=0, description="Tool category ID")
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    condition: str = Field(..., regex="^(excellent|good|fair|poor)$")
    max_loan_days: int = Field(..., ge=1, le=90, description="Maximum loan period in days")
    deposit_amount: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    daily_rate: Decimal = Field(..., ge=0, max_digits=10, decimal_places=2)
    pickup_address: Optional[str] = Field(None, max_length=500)
    pickup_city: Optional[str] = Field(None, max_length=100)
    pickup_postal_code: Optional[str] = Field(None, max_length=20)
    pickup_latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    pickup_longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    delivery_available: bool = Field(default=False)
    delivery_radius_km: int = Field(default=0, ge=0, le=50)
    usage_instructions: Optional[str] = Field(None, max_length=2000)
    safety_notes: Optional[str] = Field(None, max_length=2000)

class ToolUpdateRequest(BaseModel):
    title: Optional[str] = Field(None, min_length=3, max_length=200)
    description: Optional[str] = Field(None, min_length=10, max_length=2000)
    category_id: Optional[int] = Field(None, gt=0)
    brand: Optional[str] = Field(None, max_length=100)
    model: Optional[str] = Field(None, max_length=100)
    condition: Optional[str] = Field(None, regex="^(excellent|good|fair|poor)$")
    is_available: Optional[bool] = None
    max_loan_days: Optional[int] = Field(None, ge=1, le=90)
    deposit_amount: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    daily_rate: Optional[Decimal] = Field(None, ge=0, max_digits=10, decimal_places=2)
    pickup_address: Optional[str] = Field(None, max_length=500)
    pickup_city: Optional[str] = Field(None, max_length=100)
    pickup_postal_code: Optional[str] = Field(None, max_length=20)
    pickup_latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    pickup_longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    delivery_available: Optional[bool] = None
    delivery_radius_km: Optional[int] = Field(None, ge=0, le=50)
    usage_instructions: Optional[str] = Field(None, max_length=2000)
    safety_notes: Optional[str] = Field(None, max_length=2000)

# Response Schemas
class ToolPhotoResponse(BaseModel):
    id: UUID
    original_url: str
    thumbnail_url: Optional[str]
    medium_url: Optional[str]
    large_url: Optional[str]
    display_order: int
    is_primary: bool

class ToolCategoryResponse(BaseModel):
    id: int
    name: str
    slug: str
    description: Optional[str]
    icon_name: Optional[str]

class ToolOwnerResponse(BaseModel):
    id: UUID
    first_name: str
    last_name: str
    avatar_url: Optional[str]
    average_rating: Optional[Decimal]
    total_ratings: int
    is_verified: bool

class ToolResponse(BaseModel):
    id: UUID
    title: str
    description: str
    category: ToolCategoryResponse
    brand: Optional[str]
    model: Optional[str]
    condition: str
    is_available: bool
    max_loan_days: int
    deposit_amount: Decimal
    daily_rate: Decimal
    pickup_address: Optional[str]
    pickup_city: Optional[str]
    pickup_postal_code: Optional[str]
    pickup_latitude: Optional[Decimal]
    pickup_longitude: Optional[Decimal]
    delivery_available: bool
    delivery_radius_km: int
    usage_instructions: Optional[str]
    safety_notes: Optional[str]
    last_maintenance_date: Optional[date]
    next_maintenance_due: Optional[date]
    total_bookings: int
    average_rating: Optional[Decimal]
    total_ratings: int
    photos: List[ToolPhotoResponse]
    owner: ToolOwnerResponse
    created_at: datetime
    updated_at: datetime
    
    # Distance field for location-based searches
    distance_km: Optional[float] = Field(None, description="Distance from search origin in km")

class ToolListResponse(BaseModel):
    id: UUID
    title: str
    category: ToolCategoryResponse
    condition: str
    is_available: bool
    daily_rate: Decimal
    pickup_city: Optional[str]
    pickup_postal_code: Optional[str]
    delivery_available: bool
    average_rating: Optional[Decimal]
    total_ratings: int
    primary_photo: Optional[ToolPhotoResponse]
    owner: ToolOwnerResponse
    distance_km: Optional[float] = None

# Search & Filter Schemas
class ToolSearchFilters(BaseModel):
    query: Optional[str] = Field(None, max_length=200, description="Search in title/description")
    category_ids: Optional[List[int]] = Field(None, description="Filter by category IDs")
    condition: Optional[List[str]] = Field(None, description="Filter by condition")
    min_daily_rate: Optional[Decimal] = Field(None, ge=0)
    max_daily_rate: Optional[Decimal] = Field(None, ge=0)
    max_deposit: Optional[Decimal] = Field(None, ge=0)
    available_only: bool = Field(default=True, description="Show only available tools")
    delivery_available: Optional[bool] = None
    min_rating: Optional[Decimal] = Field(None, ge=1, le=5)
    
    # Location-based filters
    latitude: Optional[Decimal] = Field(None, ge=-90, le=90)
    longitude: Optional[Decimal] = Field(None, ge=-180, le=180)
    max_distance_km: Optional[int] = Field(None, ge=1, le=100)
    postal_codes: Optional[List[str]] = Field(None, description="Filter by postal codes")
    cities: Optional[List[str]] = Field(None, description="Filter by cities")

class ToolSearchRequest(BaseModel):
    filters: ToolSearchFilters = Field(default_factory=ToolSearchFilters)
    sort_by: str = Field(default="created_at", regex="^(created_at|daily_rate|distance|rating|title)$")
    sort_order: str = Field(default="desc", regex="^(asc|desc)$")
    page: int = Field(default=1, ge=1)
    page_size: int = Field(default=20, ge=1, le=100)

# Paginated Response
class PaginatedToolResponse(BaseModel):
    items: List[ToolListResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    has_next: bool
    has_previous: bool
```

## API Endpoints

### 1. Tool CRUD Operations

#### Create Tool
```
POST /api/v1/tools
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "title": "Bosch Hammer Drill",
  "description": "Professional grade hammer drill, perfect for concrete and masonry work...",
  "category_id": 15,
  "brand": "Bosch",
  "model": "RH328VC",
  "condition": "excellent",
  "max_loan_days": 7,
  "deposit_amount": "50.00",
  "daily_rate": "15.00",
  "pickup_address": "123 Main St",
  "pickup_city": "Berlin",
  "pickup_postal_code": "10115",
  "pickup_latitude": "52.5200",
  "pickup_longitude": "13.4050",
  "delivery_available": true,
  "delivery_radius_km": 5,
  "usage_instructions": "Always wear safety glasses and ear protection...",
  "safety_notes": "Check drill bits are secure before use..."
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "title": "Bosch Hammer Drill",
  // ... full tool response
  "photos": [],
  "created_at": "2024-03-15T10:30:00Z"
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Invalid/missing JWT token
- `404 Not Found`: Category not found
- `422 Unprocessable Entity`: Business logic validation failed

#### Get Tool Details
```
GET /api/v1/tools/{tool_id}
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  // ... full tool details with photos and owner info
}
```

**Error Responses:**
- `404 Not Found`: Tool not found or inactive

#### Update Tool
```
PUT /api/v1/tools/{tool_id}
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body:** (Partial update supported)
```json
{
  "daily_rate": "18.00",
  "is_available": false,
  "safety_notes": "Updated safety information..."
}
```

**Response:** `200 OK`
```json
{
  // ... updated tool response
}
```

**Error Responses:**
- `400 Bad Request`: Validation errors
- `401 Unauthorized`: Invalid/missing JWT token
- `403 Forbidden`: User is not the tool owner
- `404 Not Found`: Tool not found
- `409 Conflict`: Tool has active bookings and cannot be modified

#### Delete/Deactivate Tool
```
DELETE /api/v1/tools/{tool_id}
Authorization: Bearer {jwt_token}
```

**Response:** `204 No Content`

**Error Responses:**
- `401 Unauthorized`: Invalid/missing JWT token
- `403 Forbidden`: User is not the tool owner
- `404 Not Found`: Tool not found
- `409 Conflict`: Tool has active bookings

#### List User's Tools
```
GET /api/v1/tools/my-tools
Authorization: Bearer {jwt_token}
Query Parameters:
  - status: active|inactive|all (default: active)
  - page: int (default: 1)
  - page_size: int (default: 20, max: 100)
```

**Response:** `200 OK`
```json
{
  "items": [
    {
      // ... tool list responses
    }
  ],
  "total": 15,
  "page": 1,
  "page_size": 20,
  "total_pages": 1,
  "has_next": false,
  "has_previous": false
}
```

### 2. Tool Discovery & Search

#### Browse All Tools
```
GET /api/v1/tools
Query Parameters:
  - page: int (default: 1)
  - page_size: int (default: 20, max: 100)
  - sort_by: created_at|daily_rate|distance|rating|title (default: created_at)
  - sort_order: asc|desc (default: desc)
```

**Response:** `200 OK` (Same paginated format as above)

#### Advanced Tool Search
```
POST /api/v1/tools/search
Content-Type: application/json
```

**Request Body:**
```json
{
  "filters": {
    "query": "drill hammer",
    "category_ids": [15, 16],
    "condition": ["excellent", "good"],
    "min_daily_rate": "10.00",
    "max_daily_rate": "25.00",
    "max_deposit": "100.00",
    "available_only": true,
    "delivery_available": true,
    "min_rating": "4.0",
    "latitude": "52.5200",
    "longitude": "13.4050",
    "max_distance_km": 10,
    "cities": ["Berlin", "Potsdam"]
  },
  "sort_by": "distance",
  "sort_order": "asc",
  "page": 1,
  "page_size": 20
}
```

**Response:** `200 OK` (Paginated tool list with distance calculations)

### 3. Tool Categories

#### List All Categories
```
GET /api/v1/tools/categories
Query Parameters:
  - active_only: bool (default: true)
```

**Response:** `200 OK`
```json
[
  {
    "id": 1,
    "name": "Power Tools",
    "slug": "power-tools",
    "description": "Electric and battery-powered tools",
    "icon_name": "drill",
    "tool_count": 45
  }
]
```

#### Get Tools by Category
```
GET /api/v1/tools/categories/{category_id}/tools
Query Parameters: (Same pagination as browse all tools)
```

**Response:** `200 OK` (Paginated tool list)

### 4. Tool Photo Management

#### Upload Tool Photos
```
POST /api/v1/tools/{tool_id}/photos
Authorization: Bearer {jwt_token}
Content-Type: multipart/form-data
```

**Request Body:**
- `files`: File[] (Max 10 files, each max 10MB)
- `display_orders`: int[] (Optional, array of display orders)
- `primary_photo_index`: int (Optional, which uploaded photo should be primary)

**Response:** `201 Created`
```json
{
  "uploaded_photos": [
    {
      "id": "photo-uuid-1",
      "original_url": "https://s3.../photo1.jpg",
      "thumbnail_url": "https://s3.../photo1_thumb.jpg",
      "display_order": 1,
      "is_primary": true
    }
  ],
  "total_photos": 3
}
```

**Error Responses:**
- `400 Bad Request`: Invalid file format, size exceeded
- `401 Unauthorized`: Invalid/missing JWT token
- `403 Forbidden`: User is not the tool owner
- `413 Payload Too Large`: File size exceeded
- `422 Unprocessable Entity`: Too many photos (max 10)

#### Update Photo Order/Primary
```
PUT /api/v1/tools/{tool_id}/photos/reorder
Authorization: Bearer {jwt_token}
Content-Type: application/json
```

**Request Body:**
```json
{
  "photo_orders": [
    {
      "photo_id": "photo-uuid-1",
      "display_order": 1,
      "is_primary": true
    },
    {
      "photo_id": "photo-uuid-2",
      "display_order": 2,
      "is_primary": false
    }
  ]
}
```

**Response:** `200 OK`

#### Delete Tool Photo
```
DELETE /api/v1/tools/{tool_id}/photos/{photo_id}
Authorization: Bearer {jwt_token}
```

**Response:** `204 No Content`

**Error Responses:**
- `400 Bad Request`: Cannot delete last photo if tool has bookings
- `401 Unauthorized`: Invalid/missing JWT token
- `403 Forbidden`: User is not the tool owner
- `404 Not Found`: Photo not found

## Service Layer Patterns

### Tool Service Implementation

```python
# services/tool_service.py
from typing import List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_, func, text
from geoalchemy2 import functions as geo_func
from decimal import Decimal

class ToolService:
    def __init__(self, db: Session):
        self.db = db
    
    async def create_tool(
        self, 
        user_id: UUID, 
        tool_data: ToolCreateRequest
    ) -> Tool:
        """Create a new tool listing."""
        # Validate category exists and is active
        category = self.db.query(ToolCategory).filter(
            ToolCategory.id == tool_data.category_id,
            ToolCategory.is_active == True
        ).first()
        
        if not category:
            raise HTTPException(
                status_code=404, 
                detail="Tool category not found"
            )
        
        # Create tool instance
        tool = Tool(
            **tool_data.dict(),
            owner_id=user_id,
            is_available=True,
            is_active=True,
            total_bookings=0,
            total_ratings=0,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        self.db.add(tool)
        self.db.commit()
        self.db.refresh(tool)
        
        return tool
    
    async def search_tools(
        self,
        search_request: ToolSearchRequest,
        current_user_id: Optional[UUID] = None
    ) -> Tuple[List[Tool], int]:
        """Advanced tool search with filters and pagination."""
        query = self.db.query(Tool).filter(
            Tool.is_active == True,
            Tool.deleted_at.is_(None)
        )
        
        filters = search_request.filters
        
        # Exclude current user's tools from results
        if current_user_id:
            query = query.filter(Tool.owner_id != current_user_id)
        
        # Text search
        if filters.query:
            search_term = f"%{filters.query}%"
            query = query.filter(
                or_(
                    Tool.title.ilike(search_term),
                    Tool.description.ilike(search_term),
                    Tool.brand.ilike(search_term),
                    Tool.model.ilike(search_term)
                )
            )
        
        # Category filter
        if filters.category_ids:
            query = query.filter(Tool.category_id.in_(filters.category_ids))
        
        # Condition filter
        if filters.condition:
            query = query.filter(Tool.condition.in_(filters.condition))
        
        # Availability filter
        if filters.available_only:
            query = query.filter(Tool.is_available == True)
        
        # Price filters
        if filters.min_daily_rate:
            query = query.filter(Tool.daily_rate >= filters.min_daily_rate)
        if filters.max_daily_rate:
            query = query.filter(Tool.daily_rate <= filters.max_daily_rate)
        if filters.max_deposit:
            query = query.filter(Tool.deposit_amount <= filters.max_deposit)
        
        # Delivery filter
        if filters.delivery_available is not None:
            query = query.filter(Tool.delivery_available == filters.delivery_available)
        
        # Rating filter
        if filters.min_rating:
            query = query.filter(
                or_(
                    Tool.average_rating >= filters.min_rating,
                    Tool.average_rating.is_(None)
                )
            )
        
        # Location-based filtering
        if filters.latitude and filters.longitude:
            user_point = func.ST_SetSRID(
                func.ST_Point(filters.longitude, filters.latitude), 
                4326
            )
            
            # Add distance calculation
            query = query.add_columns(
                (geo_func.ST_Distance(
                    func.ST_Transform(
                        func.ST_SetSRID(
                            func.ST_Point(Tool.pickup_longitude, Tool.pickup_latitude),
                            4326
                        ),
                        3857
                    ),
                    func.ST_Transform(user_point, 3857)
                ) / 1000).label('distance_km')
            ).filter(
                and_(
                    Tool.pickup_latitude.isnot(None),
                    Tool.pickup_longitude.isnot(None)
                )
            )
            
            # Distance filter
            if filters.max_distance_km:
                distance_filter = text(
                    "ST_DWithin("
                    "ST_Transform(ST_SetSRID(ST_Point(pickup_longitude, pickup_latitude), 4326), 3857), "
                    "ST_Transform(ST_SetSRID(ST_Point(:lng, :lat), 4326), 3857), "
                    ":max_distance_m"
                    ")"
                ).params(
                    lng=filters.longitude,
                    lat=filters.latitude,
                    max_distance_m=filters.max_distance_km * 1000
                )
                query = query.filter(distance_filter)
        
        # Location text filters
        if filters.postal_codes:
            query = query.filter(Tool.pickup_postal_code.in_(filters.postal_codes))
        if filters.cities:
            query = query.filter(Tool.pickup_city.in_(filters.cities))
        
        # Get total count before pagination
        total_count = query.count()
        
        # Sorting
        sort_column = getattr(Tool, search_request.sort_by)
        if search_request.sort_by == "distance" and filters.latitude and filters.longitude:
            if search_request.sort_order == "asc":
                query = query.order_by(text("distance_km ASC"))
            else:
                query = query.order_by(text("distance_km DESC"))
        else:
            if search_request.sort_order == "asc":
                query = query.order_by(sort_column.asc())
            else:
                query = query.order_by(sort_column.desc())
        
        # Pagination
        offset = (search_request.page - 1) * search_request.page_size
        query = query.offset(offset).limit(search_request.page_size)
        
        results = query.all()
        
        # Extract tools and distances if location search was performed
        if filters.latitude and filters.longitude:
            tools = []
            for result in results:
                tool = result[0] if isinstance(result, tuple) else result
                if isinstance(result, tuple) and len(result) > 1:
                    # Add distance to tool object
                    tool.distance_km = float(result[1]) if result[1] else None
                tools.append(tool)
        else:
            tools = results
        
        return tools, total_count
    
    async def update_tool(
        self, 
        tool_id: UUID, 
        user_id: UUID, 
        update_data: ToolUpdateRequest
    ) -> Tool:
        """Update tool information."""
        tool = self.db.query(Tool).filter(
            Tool.id == tool_id,
            Tool.owner_id == user_id,
            Tool.is_active == True
        ).first()
        
        if not tool:
            raise HTTPException(
                status_code=404,
                detail="Tool not found"
            )
        
        # Check for active bookings if making unavailable
        if update_data.is_available is False:
            active_bookings = self.db.query(Booking).filter(
                Booking.tool_id == tool_id,
                Booking.status.in_(['confirmed', 'active'])
            ).count()
            
            if active_bookings > 0:
                raise HTTPException(
                    status_code=409,
                    detail="Cannot make tool unavailable with active bookings"
                )
        
        # Update only provided fields
        update_dict = update_data.dict(exclude_unset=True)
        for field, value in update_dict.items():
            setattr(tool, field, value)
        
        tool.updated_at = datetime.utcnow()
        
        self.db.commit()
        self.db.refresh(tool)
        
        return tool
    
    async def delete_tool(self, tool_id: UUID, user_id: UUID) -> bool:
        """Soft delete a tool."""
        tool = self.db.query(Tool).filter(
            Tool.id == tool_id,
            Tool.owner_id == user_id,
            Tool.is_active == True
        ).first()
        
        if not tool:
            raise HTTPException(
                status_code=404,
                detail="Tool not found"
            )
        
        # Check for active bookings
        active_bookings = self.db.query(Booking).filter(
            Booking.tool_id == tool_id,
            Booking.status.in_(['confirmed', 'active'])
        ).count()
        
        if active_bookings > 0:
            raise HTTPException(
                status_code=409,
                detail="Cannot delete tool with active bookings"
            )
        
        # Soft delete
        tool.is_active = False
        tool.deleted_at = datetime.utcnow()
        
        self.db.commit()
        return True
```

## Error Handling Strategy

### Custom Exception Classes

```python
# exceptions/tool_exceptions.py
class ToolException(HTTPException):
    """Base tool exception."""
    pass

class ToolNotFoundError(ToolException):
    def __init__(self):
        super().__init__(status_code=404, detail="Tool not found")

class ToolOwnershipError(ToolException):
    def __init__(self):
        super().__init__(status_code=403, detail="You can only modify your own tools")

class ToolHasActiveBookingsError(ToolException):
    def __init__(self, action: str):
        super().__init__(
            status_code=409,
            detail=f"Cannot {action} tool with active bookings"
        )

class ToolCategoryNotFoundError(ToolException):
    def __init__(self):
        super().__init__(status_code=404, detail="Tool category not found")

class TooManyPhotosError(ToolException):
    def __init__(self):
        super().__init__(
            status_code=422,
            detail="Maximum 10 photos allowed per tool"
        )
```

### Global Error Handler

```python
# error_handlers.py
from fastapi import Request
from fastapi.responses import JSONResponse

async def tool_exception_handler(request: Request, exc: ToolException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": exc.detail,
                "type": "tool_error",
                "timestamp": datetime.utcnow().isoformat()
            }
        }
    )
```

## Security Considerations

### Authorization Middleware

```python
# middleware/tool_auth.py
async def verify_tool_ownership(tool_id: UUID, current_user: User, db: Session):
    """Verify user owns the tool."""
    tool = db.query(Tool).filter(
        Tool.id == tool_id,
        Tool.is_active == True
    ).first()
    
    if not tool:
        raise ToolNotFoundError()
    
    if tool.owner_id != current_user.id:
        raise ToolOwnershipError()
    
    return tool
```

### Input Validation

```python
# validators/tool_validators.py
def validate_photo_files(files: List[UploadFile]):
    """Validate uploaded photo files."""
    allowed_types = {'image/jpeg', 'image/png', 'image/webp'}
    max_size = 10 * 1024 * 1024  # 10MB
    max_files = 10
    
    if len(files) > max_files:
        raise HTTPException(
            status_code=422,
            detail=f"Maximum {max_files} photos allowed"
        )
    
    for file in files:
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400,
                detail="Only JPEG, PNG, and WebP images are allowed"
            )
        
        if file.size > max_size:
            raise HTTPException(
                status_code=413,
                detail="File size must be less than 10MB"
            )
```

## Database Query Optimization

### Indexed Queries

```python
# Database indexes for optimal performance
CREATE INDEX CONCURRENTLY idx_tools_location ON tools 
USING GIST (ST_Point(pickup_longitude, pickup_latitude));

CREATE INDEX CONCURRENTLY idx_tools_search ON tools 
USING GIN (to_tsvector('english', title || ' ' || description));

CREATE INDEX CONCURRENTLY idx_tools_category_available ON tools 
(category_id, is_available, is_active) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_tools_owner_active ON tools 
(owner_id, is_active) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY idx_tools_daily_rate ON tools 
(daily_rate) WHERE is_active = true AND is_available = true;
```

### Eager Loading

```python
# Optimize database queries with eager loading
def get_tool_with_relations(db: Session, tool_id: UUID) -> Tool:
    return db.query(Tool)\
        .options(
            joinedload(Tool.category),
            joinedload(Tool.photos),
            joinedload(Tool.owner).load_only(
                User.id, User.first_name, User.last_name, 
                User.avatar_url, User.average_rating, User.total_ratings
            )
        )\
        .filter(Tool.id == tool_id, Tool.is_active == True)\
        .first()
```

## File Upload Implementation

### Photo Upload Service

```python
# services/photo_service.py
import boto3
from PIL import Image
import io
from typing import List, Tuple

class PhotoService:
    def __init__(self, s3_client, bucket_name: str):
        self.s3_client = s3_client
        self.bucket_name = bucket_name
    
    async def upload_tool_photos(
        self, 
        tool_id: UUID, 
        files: List[UploadFile],
        display_orders: Optional[List[int]] = None,
        primary_index: Optional[int] = None
    ) -> List[ToolPhoto]:
        """Upload and process tool photos."""
        uploaded_photos = []
        
        for index, file in enumerate(files):
            # Generate unique filename
            file_ext = file.filename.split('.')[-1].lower()
            photo_id = str(uuid.uuid4())
            base_filename = f"tools/{tool_id}/{photo_id}"
            
            # Read file content
            content = await file.read()
            
            # Upload original
            original_key = f"{base_filename}_original.{file_ext}"
            await self._upload_to_s3(original_key, content, file.content_type)
            
            # Generate thumbnails
            thumbnails = await self._generate_thumbnails(content, base_filename, file_ext)
            
            # Create database record
            photo = ToolPhoto(
                id=UUID(photo_id),
                tool_id=tool_id,
                original_url=f"https://{self.bucket_name}.s3.amazonaws.com/{original_key}",
                thumbnail_url=thumbnails.get('thumbnail'),
                medium_url=thumbnails.get('medium'),
                large_url=thumbnails.get('large'),
                filename=file.filename,
                file_size_bytes=len(content),
                mime_type=file.content_type,
                display_order=display_orders[index] if display_orders else index + 1,
                is_primary=primary_index == index if primary_index is not None else index == 0,
                is_active=True,
                created_at=datetime.utcnow()
            )
            
            uploaded_photos.append(photo)
        
        return uploaded_photos
    
    async def _generate_thumbnails(
        self, 
        content: bytes, 
        base_filename: str, 
        file_ext: str
    ) -> Dict[str, str]:
        """Generate different sized thumbnails."""
        sizes = {
            'thumbnail': (200, 200),
            'medium': (500, 500),
            'large': (1200, 1200)
        }
        
        thumbnails = {}
        image = Image.open(io.BytesIO(content))
        
        # Convert to RGB if necessary
        if image.mode in ('RGBA', 'LA', 'P'):
            image = image.convert('RGB')
        
        for size_name, (width, height) in sizes.items():
            # Create thumbnail
            thumbnail = image.copy()
            thumbnail.thumbnail((width, height), Image.Resampling.LANCZOS)
            
            # Save to bytes
            thumb_bytes = io.BytesIO()
            thumbnail.save(thumb_bytes, format='JPEG', quality=85, optimize=True)
            thumb_bytes.seek(0)
            
            # Upload to S3
            key = f"{base_filename}_{size_name}.jpg"
            await self._upload_to_s3(key, thumb_bytes.getvalue(), "image/jpeg")
            
            thumbnails[size_name] = f"https://{self.bucket_name}.s3.amazonaws.com/{key}"
        
        return thumbnails
    
    async def _upload_to_s3(self, key: str, content: bytes, content_type: str):
        """Upload file to S3."""
        self.s3_client.put_object(
            Bucket=self.bucket_name,
            Key=key,
            Body=content,
            ContentType=content_type,
            CacheControl="max-age=31536000"  # 1 year cache
        )
```

## Rate Limiting Implementation

```python
# middleware/rate_limiting.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)

# Apply to router
@router.post("/tools", dependencies=[Depends(get_current_user)])
@limiter.limit("20/minute")  # Lower limit for resource creation
async def create_tool(request: Request, ...):
    pass

@router.get("/tools/search")
@limiter.limit("100/minute")  # Higher limit for read operations
async def search_tools(request: Request, ...):
    pass

@router.post("/tools/{tool_id}/photos", dependencies=[Depends(get_current_user)])
@limiter.limit("10/minute")  # Very low limit for file uploads
async def upload_photos(request: Request, ...):
    pass
```

## Implementation Guidelines

1. **Service Layer Pattern**: Separate business logic from API endpoints
2. **Repository Pattern**: Abstract database queries for testability
3. **Dependency Injection**: Use FastAPI's dependency injection for services
4. **Async Operations**: Use async/await for all I/O operations
5. **Error Handling**: Implement comprehensive error handling with proper HTTP codes
6. **Input Validation**: Use Pydantic models for request validation
7. **Authentication**: Verify JWT tokens and user permissions for all protected endpoints
8. **Pagination**: Implement consistent pagination across all list endpoints
9. **Geographic Queries**: Use PostGIS for efficient location-based searches
10. **File Handling**: Implement secure file uploads with validation and thumbnail generation

This specification provides a comprehensive foundation for implementing the tool management API with proper security, validation, and performance considerations.