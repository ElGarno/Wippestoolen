# Wippestoolen System Architecture

## Executive Summary

This document outlines the system architecture for Wippestoolen, a neighborhood tool-sharing platform MVP. The architecture prioritizes cost-efficiency (<$40/month), scalability (10-40 → 10,000+ users), and maintainability while delivering core MVP features.

**Key Architectural Decisions:**
- **Framework**: Django (Python) - rapid development, built-in admin, ORM, security features
- **Database**: PostgreSQL on AWS RDS (t3.micro) - ACID compliance, full-text search, JSON support
- **Frontend**: Server-side rendering with progressive enhancement - cost-effective, SEO-friendly
- **File Storage**: AWS S3 - scalable image storage for tool photos
- **Deployment**: AWS ECS Fargate with Application Load Balancer - managed, scalable container orchestration
- **Infrastructure**: OpenTofu (Terraform) - version-controlled, reproducible infrastructure

## High-Level Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                           Internet                              │
└─────────────────────┬───────────────────────────────────────────┘
                      │
              ┌───────▼────────┐
              │ CloudFront CDN │ (Optional, for static assets)
              └───────┬────────┘
                      │
            ┌─────────▼─────────┐
            │ Application Load  │
            │    Balancer       │
            └─────────┬─────────┘
                      │
        ┌─────────────▼─────────────┐
        │     ECS Fargate           │
        │  ┌─────────────────────┐  │
        │  │   Django Web App    │  │ (Auto-scaling 1-3 tasks)
        │  │   (Gunicorn/uWSGI)  │  │
        │  └─────────────────────┘  │
        └─────────────┬─────────────┘
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
┌───▼────┐    ┌──────▼──────┐    ┌─────▼─────┐
│   S3   │    │ PostgreSQL  │    │   SES     │
│Buckets │    │   RDS       │    │  Email    │
│        │    │(t3.micro)   │    │ Service   │
└────────┘    └─────────────┘    └───────────┘
```

## Component Architecture

### 1. Frontend Layer
**Technology**: Django Templates + JavaScript (Progressive Enhancement)
**Rationale**: Server-side rendering reduces client complexity, improves SEO, and works well on mobile devices with limited resources.

**Key Components:**
- **Responsive UI**: Bootstrap/Tailwind CSS for mobile-first design
- **Progressive Enhancement**: Basic functionality works without JavaScript
- **Image Optimization**: Lazy loading, WebP format support
- **Accessibility**: WCAG 2.1 AA compliance built-in

### 2. Application Layer
**Technology**: Django 5.x + Python 3.13
**Architecture Pattern**: Layered Architecture with Service Layer

**Core Modules:**
```
wippestoolen/
├── apps/
│   ├── accounts/          # User management & authentication
│   ├── tools/            # Tool listings & search
│   ├── bookings/         # Booking workflow & state management
│   ├── reviews/          # Rating & review system
│   ├── notifications/    # In-app notifications
│   └── core/             # Shared utilities & base models
├── services/             # Business logic layer
├── api/                  # REST API endpoints (future)
└── config/               # Django settings & configuration
```

**Service Layer Pattern:**
- **UserService**: Profile management, authentication
- **ToolService**: CRUD operations, search, availability
- **BookingService**: Workflow management, state transitions
- **ReviewService**: Rating calculations, mutual reviews
- **NotificationService**: Message delivery, preferences

### 3. Data Layer
**Primary Database**: PostgreSQL 15 on AWS RDS
**Storage**: AWS S3 for images and static files

**Core Data Models:**
```python
User
├── id, email, username, password_hash
├── profile: first_name, last_name, location, bio
├── rating_avg, rating_count
└── created_at, updated_at, is_active

Tool
├── id, title, category, description
├── manufacturer, model, photos[]
├── location (lat/lng), max_loan_days
├── deposit_amount, availability_status
├── owner_id → User
└── created_at, updated_at, is_active

Booking
├── id, borrower_id → User, tool_id → Tool
├── start_date, end_date, status
├── request_message, decline_reason
├── deposit_paid, handover_notes
└── created_at, updated_at, status_changed_at

Review
├── id, reviewer_id → User, reviewee_id → User
├── booking_id → Booking, rating (1-5)
├── comment, review_type (lender/borrower)
└── created_at, updated_at

Notification
├── id, user_id → User, type, title, message
├── related_booking_id, is_read, sent_via_email
└── created_at, updated_at
```

### 4. External Integrations

**AWS Services:**
- **S3**: Image storage with lifecycle policies
- **SES**: Transactional email delivery
- **CloudWatch**: Logging and monitoring
- **Parameter Store**: Configuration management

**Third-party Services (Future):**
- **MapBox/Google Maps**: Location services and mapping
- **Stripe**: Payment processing (post-MVP)

## Data Flow for Key User Journeys

### Journey 1: Tool Listing Creation
```
User → Django View → ToolService.create_tool() 
     → PostgreSQL (tool record) + S3 (photos) 
     → Response → User
```

### Journey 2: Booking Request Flow
```
1. Borrower Request:
   User → BookingService.create_booking() → PostgreSQL 
   → NotificationService.notify_owner() → Owner

2. Owner Response:
   Owner → BookingService.update_status() → PostgreSQL
   → NotificationService.notify_borrower() → Borrower

3. Status Transitions:
   requested → confirmed → active → returned
   (Each transition triggers notifications)
```

### Journey 3: Search and Discovery
```
User Input → ToolService.search() 
          → PostgreSQL (full-text search + filters) 
          → Results with pagination → User
```

## Technology Stack Recommendations

### Backend Framework: Django
**Justification:**
- **Rapid Development**: Built-in admin panel, ORM, authentication
- **Security**: CSRF protection, SQL injection prevention, secure defaults
- **Scalability**: Proven at scale (Instagram, Pinterest)
- **Ecosystem**: Rich package ecosystem, excellent documentation
- **Cost-Effective**: Single language stack, reduces development time

### Database: PostgreSQL on AWS RDS
**Configuration**: db.t3.micro (1 vCPU, 1GB RAM, 20GB storage)
**Justification:**
- **ACID Compliance**: Critical for booking transactions
- **Full-text Search**: Built-in search capabilities
- **JSON Support**: Flexible schema for notifications, metadata
- **Scalability**: Read replicas, connection pooling support
- **Cost**: ~$13/month for t3.micro

### Container Orchestration: AWS ECS Fargate
**Configuration**: 0.25 vCPU, 512MB RAM per task
**Justification:**
- **Serverless**: No EC2 management overhead
- **Auto-scaling**: Scale based on CPU/memory utilization
- **Cost-Effective**: Pay only for running tasks
- **Zero-downtime Deployments**: Built-in rolling updates

### CDN and Static Assets: AWS S3 + CloudFront
**Justification:**
- **Global Distribution**: Fast image loading worldwide
- **Cost-Effective**: Pay-per-use pricing
- **Automatic Scaling**: Handles traffic spikes
- **Image Optimization**: WebP conversion, resizing

## Scalability Strategy

### Phase 1: MVP (10-40 users)
**Infrastructure:**
- 1 ECS Fargate task (0.25 vCPU, 512MB)
- RDS t3.micro (1 vCPU, 1GB RAM)
- S3 bucket for images
- **Estimated Cost**: $25-30/month

### Phase 2: Growth (100-1,000 users)
**Scaling Actions:**
- Increase Fargate task resources (0.5 vCPU, 1GB RAM)
- Enable ECS auto-scaling (2-5 tasks)
- Add Redis ElastiCache for session caching
- Implement database connection pooling
- **Estimated Cost**: $60-80/month

### Phase 3: Scale (1,000-10,000+ users)
**Architecture Evolution:**
- Multi-AZ RDS deployment (db.t3.small or larger)
- ECS auto-scaling with target tracking
- CloudFront CDN for static assets
- Separate read replicas for analytics
- API rate limiting with Redis
- **Estimated Cost**: $200-400/month

### Horizontal Scaling Patterns
- **Database**: Read replicas, connection pooling, query optimization
- **Application**: Stateless design, session storage in Redis
- **File Storage**: S3 with CloudFront for global distribution
- **Caching**: Redis for frequently accessed data (user profiles, tool listings)

## Security Architecture

### Authentication & Authorization
- **Django Authentication**: Built-in user management
- **Session-based Auth**: Secure session handling with HttpOnly cookies
- **CSRF Protection**: Built-in Django CSRF middleware
- **Rate Limiting**: django-ratelimit for form submissions and API calls

### Data Protection
- **Encryption in Transit**: HTTPS/TLS 1.2+ everywhere
- **Encryption at Rest**: RDS encryption, S3 server-side encryption
- **PII Minimization**: Store only necessary user data
- **GDPR Compliance**: Data export/deletion capabilities

### Infrastructure Security
- **VPC**: Private subnets for database, public for load balancer
- **Security Groups**: Restrictive inbound/outbound rules
- **IAM**: Principle of least privilege for AWS services
- **Secrets Management**: AWS Systems Manager Parameter Store

## API Design (Future-Ready)

### RESTful API Structure
```
/api/v1/
├── auth/          # Authentication endpoints
├── users/         # User profiles and management
├── tools/         # Tool CRUD and search
├── bookings/      # Booking workflow
├── reviews/       # Rating and review system
└── notifications/ # Notification management
```

### API Design Principles
- **RESTful**: Standard HTTP methods and status codes
- **Versioning**: URL-based versioning (/api/v1/)
- **Pagination**: Cursor-based for large datasets
- **Filtering**: Query parameter-based filtering and sorting
- **Rate Limiting**: Per-user and per-endpoint limits

## Deployment Architecture

### Infrastructure as Code (OpenTofu/Terraform)
```
infrastructure/
├── modules/
│   ├── vpc/           # Network infrastructure
│   ├── ecs/           # Container orchestration
│   ├── rds/           # Database infrastructure
│   ├── s3/            # File storage
│   └── monitoring/    # CloudWatch, alarms
├── environments/
│   ├── dev/           # Development environment
│   ├── staging/       # Staging environment
│   └── prod/          # Production environment
└── main.tf            # Root configuration
```

### CI/CD Pipeline
```
GitHub → GitHub Actions → Docker Build → ECR Push → ECS Deploy
```

**Pipeline Stages:**
1. **Test**: Run pytest, black, ruff, mypy
2. **Build**: Create Docker image with multi-stage build
3. **Deploy**: Update ECS service with zero-downtime deployment
4. **Verify**: Health checks and smoke tests

### Environment Strategy
- **Development**: Local Docker Compose + remote database
- **Staging**: Mirror of production with synthetic data
- **Production**: Full AWS infrastructure with monitoring

## Monitoring and Observability

### Application Monitoring
- **Health Checks**: Django health check endpoints
- **Error Tracking**: Django logging + CloudWatch Logs
- **Performance**: Django Debug Toolbar (dev), APM (production)
- **User Analytics**: Simple page view tracking

### Infrastructure Monitoring
- **ECS**: CPU, memory, task health
- **RDS**: Connection count, CPU, storage
- **S3**: Request metrics, error rates
- **ALB**: Response times, error rates

### Alerting Strategy
- **Critical**: Database down, application errors >5%
- **Warning**: High response times, resource utilization >80%
- **Info**: Deployment success, scaling events

## Cost Optimization Strategies

### Development Phase
- **Shared Resources**: Single RDS instance, minimal Fargate resources
- **Spot Instances**: Use spot pricing for non-critical workloads
- **Reserved Capacity**: 1-year reserved instances for predictable workloads

### Operational Optimizations
- **Image Optimization**: WebP format, lazy loading, responsive images
- **Database Optimization**: Proper indexing, query optimization
- **Caching Strategy**: Browser caching, CDN caching, application-level caching
- **Resource Rightsizing**: Monitor and adjust Fargate task resources

### AWS Cost Controls
- **Budgets**: Set up AWS budgets with alerts
- **Cost Explorer**: Regular cost analysis and optimization
- **Lifecycle Policies**: S3 intelligent tiering for image storage

## Risk Mitigation

### High Availability
- **Multi-AZ**: RDS deployed across availability zones
- **Auto-scaling**: ECS tasks scale based on demand
- **Health Checks**: Application and infrastructure health monitoring
- **Backup Strategy**: RDS automated backups, S3 versioning

### Disaster Recovery
- **RTO**: 4 hours (Recovery Time Objective)
- **RPO**: 1 hour (Recovery Point Objective)
- **Backup**: Daily RDS snapshots, S3 cross-region replication
- **Runbook**: Documented recovery procedures

### Performance Risks
- **Database Bottlenecks**: Connection pooling, read replicas
- **Image Loading**: CDN, optimization, lazy loading
- **Search Performance**: Database indexing, caching, pagination

## Migration and Evolution Path

### Phase 1: MVP Launch
- Single Django monolith
- Simple deployment pipeline
- Basic monitoring

### Phase 2: Optimization
- Add caching layer (Redis)
- Optimize database queries
- Implement comprehensive monitoring

### Phase 3: Scaling
- Consider microservices for specific domains
- Advanced caching strategies
- Performance optimization

### Phase 4: Feature Expansion
- Mobile app (React Native/Flutter)
- Real-time features (WebSockets)
- Advanced search (Elasticsearch)
- Payment integration

## Architectural Decision Records (ADRs)

### ADR-001: Django Framework Selection
**Status**: Accepted
**Decision**: Use Django as the primary web framework
**Rationale**: Rapid development, built-in security, excellent ORM, admin interface
**Consequences**: Python expertise required, some performance trade-offs vs. FastAPI

### ADR-002: PostgreSQL Database Choice
**Status**: Accepted  
**Decision**: Use PostgreSQL on AWS RDS
**Rationale**: ACID compliance, full-text search, JSON support, proven scalability
**Consequences**: Slightly higher cost vs. MySQL, learning curve for team

### ADR-003: Server-Side Rendering
**Status**: Accepted
**Decision**: Use Django templates with progressive enhancement
**Rationale**: Better SEO, mobile performance, reduced complexity
**Consequences**: Limited interactivity vs. SPA, requires JavaScript for enhancements

### ADR-004: ECS Fargate for Deployment  
**Status**: Accepted
**Decision**: Deploy using AWS ECS Fargate
**Rationale**: Serverless containers, auto-scaling, managed infrastructure
**Consequences**: AWS vendor lock-in, learning curve for container orchestration

## Conclusion

This architecture provides a solid foundation for the Wippestoolen MVP while ensuring cost-effectiveness and future scalability. The chosen technologies balance development speed, operational simplicity, and growth potential.

**Key Success Factors:**
- Start simple with Django monolith
- Leverage managed AWS services
- Implement proper monitoring from day one  
- Plan for gradual scaling and optimization
- Maintain focus on user value over technical complexity

The architecture supports the business goal of creating a sustainable tool-sharing platform that can grow from a neighborhood initiative to a city-wide service while maintaining operational excellence and cost control.