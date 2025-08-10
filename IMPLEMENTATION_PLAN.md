# Enhanced Wippestoolen Implementation Plan

## Technology Stack
- **Framework**: Django (Python ≥3.13) with GeoDjango for spatial features
- **Database**: PostgreSQL with PostGIS extension for geospatial data
- **Frontend**: Bootstrap 5 + Leaflet.js for interactive maps
- **AI Integration**: OpenAI API (GPT-4V) for automated tool descriptions
- **Background Tasks**: Celery + Redis for async AI processing

## Enhanced Database Models
1. **User Profile** - extends Django User with display_name, location, average_rating
2. **Tool** - Enhanced with:
   - Geospatial fields (latitude, longitude) for map display
   - JSONField for structured descriptions with AI/manual flags
   - Multiple photo support for AI analysis
3. **Booking** - tool requests with status flow (requested → confirmed → active → returned)
4. **Review** - mutual ratings (1-5) after booking completion  
5. **Notification** - in-app messaging system

## Key New Features

### Map Integration
- **Interactive Map View**: Leaflet.js-powered map showing all available tools
- **Geospatial Search**: Filter tools by distance, draw search radius
- **Location Services**: "Near me" functionality using browser geolocation  
- **Clustering**: Efficient display of many tools in dense areas

### AI-Powered Descriptions
- **Photo Analysis**: OpenAI Vision API analyzes tool photos to generate structured JSON descriptions
- **Manual Override**: Users can always edit or replace AI-generated content
- **Structured Data**: JSON format with features, condition, category suggestions, brand/model detection
- **Background Processing**: Async AI calls to prevent UI blocking

## Implementation Phases
1. **Foundation Setup** - Django project, PostGIS setup, basic auth
2. **User Management** - profiles, registration/login flows  
3. **Enhanced Tool Listings** - CRUD with geospatial fields and JSON descriptions
4. **Map Integration** - Interactive map view, spatial search, clustering
5. **AI Description Generation** - OpenAI API integration, background processing
6. **Booking System** - request/confirm workflow, status tracking
7. **Reviews & Ratings** - post-booking rating system
8. **Notifications & Polish** - in-app notifications, mobile optimization

## Security & Performance
- **API Security**: OpenAI API keys in environment variables, rate limiting
- **Privacy**: User consent for AI photo analysis, optional location fuzzing
- **Performance**: Spatial database indexing, async AI processing, image optimization
- **Cost Management**: Usage tracking, caching of AI responses

## Additional Dependencies
- `django-leaflet` - Map integration
- `geodjango` - Spatial database operations  
- `openai` - AI API integration
- `celery[redis]` - Background task processing
- `pillow` - Image processing
- `django-environ` - Environment variable management

## Django Apps Structure
- `accounts` - authentication, profiles, registration
- `tools` - CRUD operations, search, filtering, AI integration
- `bookings` - request flow, status management
- `reviews` - rating system
- `notifications` - in-app notifications
- `core` - shared utilities, templates

## File Structure
```
wippestoolen/
├── manage.py
├── wippestoolen/
│   ├── settings/
│   │   ├── base.py
│   │   ├── development.py
│   │   └── production.py
│   ├── urls.py
│   └── wsgi.py
├── apps/
│   ├── accounts/
│   ├── tools/
│   ├── bookings/
│   ├── reviews/
│   ├── notifications/
│   └── core/
├── templates/
├── static/
├── media/
├── celery_app/
└── tests/
```

## Key Views/URLs
- Authentication: login, logout, register, profile
- Tool management: list, detail, create, edit, delete, search, map view
- AI integration: generate description, manual override
- Booking flow: request, confirm/decline, mark active/returned
- Reviews: create review, view ratings
- Dashboard: user's tools, bookings, notifications

## Non-Functional Requirements
- **Accessibility**: WCAG-compliant design
- **Mobile-Responsive**: Bootstrap 5 responsive framework
- **GDPR Compliance**: Minimal PII collection, user consent for AI processing
- **Auditability**: Logging for booking changes and AI usage
- **Rate Limiting**: Authentication and AI API calls
- **Testing**: Unit and integration tests for all components