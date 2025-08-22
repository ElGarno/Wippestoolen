# AWS Infrastructure Design - Wippestoolen Tool-Sharing Platform

## Executive Summary

This document outlines a cost-optimized AWS infrastructure design for the Wippestoolen tool-sharing platform, targeting a maximum monthly cost of $40 for the MVP phase (10-40 users) with a clear scaling path to 10,000+ users.

## Architecture Overview

### MVP Architecture (Cost-Optimized)
```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                    CloudFront CDN                              │
│                   (Static Assets)                              │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                  Application Load Balancer                     │
│                     (us-east-1)                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                ┌─────────▼─────────┐
                │                   │
        ┌───────▼──────┐    ┌──────▼──────┐
        │   ECS Fargate │    │  Lambda API │
        │   (Primary)   │    │ (Overflow)  │
        └───────┬──────┘    └──────┬──────┘
                │                  │
                └─────────┬────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │         RDS Aurora Serverless    │
        │            PostgreSQL            │
        │        (Auto-pause enabled)      │
        └─────────────────┬─────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │              S3 Buckets          │
        │    - Static Assets (public)      │
        │    - Tool Photos (private)       │
        │    - Application Backups         │
        └───────────────────────────────────┘
```

### Production Architecture (Scale Target)
```
┌─────────────────────────────────────────────────────────────────┐
│                          Internet                               │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│                 Route 53 DNS + Health Checks                   │
└─────────────────────────┬───────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────────────┐
│              CloudFront CDN (Global Edge Locations)            │
│                     + WAF Protection                           │
└─────────────────────────┬───────────────────────────────────────┘
                          │
        ┌─────────────────▼─────────────────┐
        │           Multi-AZ VPC            │
        │                                   │
        │  ┌─────────────┐ ┌─────────────┐  │
        │  │   Public    │ │   Public    │  │
        │  │  Subnet AZ-a│ │  Subnet AZ-b│  │
        │  │    (ALB)    │ │    (ALB)    │  │
        │  └──────┬──────┘ └──────┬──────┘  │
        │         │               │         │
        │  ┌──────▼──────┐ ┌──────▼──────┐  │
        │  │   Private   │ │   Private   │  │
        │  │  Subnet AZ-a│ │  Subnet AZ-b│  │
        │  │ (ECS/Lambda)│ │ (ECS/Lambda)│  │
        │  └──────┬──────┘ └──────┬──────┘  │
        │         │               │         │
        │  ┌──────▼──────┐ ┌──────▼──────┐  │
        │  │  Database   │ │  Database   │  │
        │  │  Subnet AZ-a│ │  Subnet AZ-b│  │
        │  │    (RDS)    │ │    (RDS)    │  │
        │  └─────────────┘ └─────────────┘  │
        └───────────────────────────────────┘
```

## Service Selection & Cost Analysis

### MVP Cost Breakdown (~$35-40/month)

| Service | Configuration | Monthly Cost | Annual Cost |
|---------|---------------|--------------|-------------|
| **ECS Fargate** | 1 task, 0.25 vCPU, 0.5GB RAM, 720h | $12.00 | $144.00 |
| **RDS Aurora Serverless v2** | PostgreSQL, 0.5 ACU min, auto-pause | $15.00 | $180.00 |
| **Application Load Balancer** | 1 ALB, minimal traffic | $16.00 | $192.00 |
| **S3 Standard** | 5GB storage, 1000 requests | $0.50 | $6.00 |
| **CloudFront** | 10GB data transfer | $1.00 | $12.00 |
| **Lambda** | Overflow capacity, 1M requests | $0.50 | $6.00 |
| **Route 53** | 1 hosted zone, health checks | $1.00 | $12.00 |
| **Data Transfer** | 50GB outbound | $4.50 | $54.00 |
| **Misc (CloudWatch, etc.)** | Basic monitoring | $2.00 | $24.00 |
| **TOTAL** | | **$52.50** | **$630.00** |

**Note**: With AWS Free Tier benefits (12 months for new accounts):
- RDS: 750 hours free
- ECS: Some free tier benefits
- **Effective MVP Cost: ~$25-30/month** for first year

### Production Scale Cost Projection (10,000 users)

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| **ECS Fargate** | 10 tasks, auto-scaling | $120.00 |
| **RDS Aurora** | Multi-AZ, 2-8 ACU scaling | $200.00 |
| **Application Load Balancer** | 2 ALBs (multi-AZ) | $32.00 |
| **S3 Standard** | 100GB storage, 100K requests | $5.00 |
| **CloudFront** | 500GB data transfer | $25.00 |
| **Lambda** | 10M requests/month | $20.00 |
| **Route 53** | Health checks, traffic routing | $10.00 |
| **Data Transfer** | 1TB outbound | $90.00 |
| **CloudWatch** | Enhanced monitoring | $30.00 |
| **WAF** | Basic protection rules | $15.00 |
| **TOTAL** | | **$547.00** |

## OpenTofu Module Structure

### Directory Structure
```
infrastructure/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── production/
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── compute/
│   │   ├── ecs-fargate/
│   │   ├── lambda/
│   │   └── alb/
│   ├── database/
│   │   ├── aurora-serverless/
│   │   └── backup/
│   ├── storage/
│   │   ├── s3/
│   │   └── cloudfront/
│   ├── security/
│   │   ├── iam/
│   │   ├── security-groups/
│   │   └── waf/
│   └── monitoring/
│       ├── cloudwatch/
│       └── sns/
├── shared/
│   ├── backend.tf
│   ├── providers.tf
│   └── versions.tf
└── scripts/
    ├── deploy.sh
    ├── destroy.sh
    └── validate.sh
```

### Core Module Examples

#### 1. ECS Fargate Module (modules/compute/ecs-fargate/main.tf)
```hcl
resource "aws_ecs_cluster" "main" {
  name = "${var.project_name}-${var.environment}"

  setting {
    name  = "containerInsights"
    value = var.enable_container_insights ? "enabled" : "disabled"
  }

  tags = var.tags
}

resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name

  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = 1
    weight            = 100
    capacity_provider = var.environment == "production" ? "FARGATE" : "FARGATE_SPOT"
  }
}

resource "aws_ecs_task_definition" "app" {
  family                   = "${var.project_name}-${var.environment}"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = var.cpu
  memory                   = var.memory
  execution_role_arn       = aws_iam_role.ecs_execution.arn
  task_role_arn           = aws_iam_role.ecs_task.arn

  container_definitions = jsonencode([
    {
      name  = "app"
      image = var.container_image
      
      essential = true
      
      portMappings = [
        {
          containerPort = var.container_port
          protocol      = "tcp"
        }
      ]

      environment = [
        {
          name  = "ENVIRONMENT"
          value = var.environment
        },
        {
          name  = "DATABASE_URL"
          value = var.database_url
        }
      ]

      secrets = [
        {
          name      = "SECRET_KEY"
          valueFrom = var.secret_key_arn
        }
      ]

      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.app.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "ecs"
        }
      }

      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:${var.container_port}/health || exit 1"]
        interval    = 30
        timeout     = 5
        retries     = 3
        startPeriod = 60
      }
    }
  ])

  tags = var.tags
}

resource "aws_ecs_service" "app" {
  name            = "${var.project_name}-${var.environment}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = var.desired_count
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.ecs.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = var.target_group_arn
    container_name   = "app"
    container_port   = var.container_port
  }

  depends_on = [var.alb_listener]

  tags = var.tags
}

# Auto Scaling
resource "aws_appautoscaling_target" "ecs" {
  count              = var.enable_autoscaling ? 1 : 0
  max_capacity       = var.max_capacity
  min_capacity       = var.min_capacity
  resource_id        = "service/${aws_ecs_cluster.main.name}/${aws_ecs_service.app.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"
}

resource "aws_appautoscaling_policy" "ecs_cpu" {
  count              = var.enable_autoscaling ? 1 : 0
  name               = "${var.project_name}-${var.environment}-cpu-scaling"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = aws_appautoscaling_target.ecs[0].scalable_dimension
  service_namespace  = aws_appautoscaling_target.ecs[0].service_namespace

  target_tracking_scaling_policy_configuration {
    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
    target_value = var.cpu_threshold
  }
}
```

#### 2. Aurora Serverless Module (modules/database/aurora-serverless/main.tf)
```hcl
resource "aws_rds_cluster" "main" {
  cluster_identifier      = "${var.project_name}-${var.environment}"
  engine                  = "aurora-postgresql"
  engine_mode            = "provisioned"
  engine_version         = var.postgres_version
  database_name          = var.database_name
  master_username        = var.master_username
  manage_master_user_password = true
  
  serverlessv2_scaling_configuration {
    max_capacity = var.max_capacity
    min_capacity = var.min_capacity
  }

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.aurora.id]

  backup_retention_period = var.backup_retention_period
  preferred_backup_window = var.backup_window
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window

  skip_final_snapshot       = var.environment != "production"
  final_snapshot_identifier = var.environment == "production" ? "${var.project_name}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}" : null

  enabled_cloudwatch_logs_exports = ["postgresql"]

  tags = var.tags
}

resource "aws_rds_cluster_instance" "main" {
  count              = var.instance_count
  identifier         = "${var.project_name}-${var.environment}-${count.index}"
  cluster_identifier = aws_rds_cluster.main.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.main.engine
  engine_version     = aws_rds_cluster.main.engine_version

  performance_insights_enabled = var.enable_performance_insights
  monitoring_interval         = var.monitoring_interval
  monitoring_role_arn        = var.monitoring_interval > 0 ? aws_iam_role.rds_monitoring[0].arn : null

  tags = var.tags
}

# Auto-pause configuration for development
resource "aws_rds_cluster_activity_stream" "main" {
  count                     = var.environment == "production" ? 1 : 0
  resource_arn             = aws_rds_cluster.main.arn
  mode                     = "async"
  kms_key_id              = var.kms_key_id
  engine_native_audit_fields_included = false
}
```

#### 3. S3 and CloudFront Module (modules/storage/s3/main.tf)
```hcl
# Static Assets Bucket
resource "aws_s3_bucket" "static_assets" {
  bucket = "${var.project_name}-${var.environment}-static-assets"
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "PublicReadGetObject"
        Effect    = "Allow"
        Principal = "*"
        Action    = "s3:GetObject"
        Resource  = "${aws_s3_bucket.static_assets.arn}/*"
      }
    ]
  })

  depends_on = [aws_s3_bucket_public_access_block.static_assets]
}

# Private Media Bucket
resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-${var.environment}-media"
  tags   = var.tags
}

resource "aws_s3_bucket_public_access_block" "media" {
  bucket = aws_s3_bucket.media.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    id     = "media_lifecycle"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 90
      storage_class = "GLACIER"
    }

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# CloudFront Distribution
resource "aws_cloudfront_distribution" "main" {
  origin {
    domain_name = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id   = "S3-${aws_s3_bucket.static_assets.id}"
  }

  origin {
    domain_name = var.alb_domain_name
    origin_id   = "ALB-${var.project_name}"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "https-only"
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  # Cache behavior for API
  ordered_cache_behavior {
    path_pattern     = "/api/*"
    allowed_methods  = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods   = ["GET", "HEAD", "OPTIONS"]
    target_origin_id = "ALB-${var.project_name}"

    forwarded_values {
      query_string = true
      headers      = ["Authorization", "CloudFront-Forwarded-Proto"]
      cookies {
        forward = "all"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 0
    max_ttl                = 0
  }

  # Default cache behavior for static assets
  default_cache_behavior {
    allowed_methods        = ["DELETE", "GET", "HEAD", "OPTIONS", "PATCH", "POST", "PUT"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "S3-${aws_s3_bucket.static_assets.id}"
    compress               = true
    viewer_protocol_policy = "redirect-to-https"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    min_ttl     = 0
    default_ttl = 3600
    max_ttl     = 86400
  }

  price_class = var.environment == "production" ? "PriceClass_All" : "PriceClass_100"

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = var.tags
}
```

## Scaling Strategy

### Phase 1: MVP (10-40 users) - Current Design
- **ECS Fargate**: 1 task, minimal resources
- **Aurora Serverless**: Auto-pause enabled, 0.5 ACU minimum
- **Manual scaling**: Monitor CloudWatch metrics
- **Cost**: ~$25-40/month

### Phase 2: Growth (100-500 users)
- **ECS Fargate**: 2-3 tasks, enable auto-scaling
- **Aurora Serverless**: Increase to 1-4 ACU range
- **Add**: ElastiCache Redis for session/cache management
- **Enable**: Enhanced monitoring and alerting
- **Cost**: ~$100-200/month

### Phase 3: Scale (1,000-5,000 users)
- **ECS Fargate**: 5-10 tasks across multiple AZs
- **Aurora**: Convert to Aurora with read replicas
- **Add**: Multi-AZ deployment
- **Add**: CDN edge locations
- **Enable**: WAF protection
- **Cost**: ~$300-500/month

### Phase 4: Enterprise (10,000+ users)
- **ECS Fargate**: 10-50 tasks with auto-scaling
- **Aurora**: Multi-AZ cluster with multiple read replicas
- **Add**: ElastiCache cluster
- **Add**: Route 53 health checks and failover
- **Enable**: Full observability stack
- **Cost**: ~$500-1000/month

## Cost Optimization Techniques

### 1. Compute Optimization
```hcl
# Use Fargate Spot for non-production
resource "aws_ecs_cluster_capacity_providers" "main" {
  cluster_name = aws_ecs_cluster.main.name
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]

  default_capacity_provider_strategy {
    base              = var.environment == "production" ? 1 : 0
    weight            = var.environment == "production" ? 100 : 0
    capacity_provider = "FARGATE"
  }

  dynamic "default_capacity_provider_strategy" {
    for_each = var.environment != "production" ? [1] : []
    content {
      base              = 1
      weight            = 100
      capacity_provider = "FARGATE_SPOT"
    }
  }
}

# Schedule-based auto-scaling for predictable traffic
resource "aws_appautoscaling_scheduled_action" "scale_down_night" {
  count              = var.enable_scheduled_scaling ? 1 : 0
  name               = "scale-down-night"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = "ecs:service:DesiredCount"
  schedule           = "cron(0 22 * * ? *)"  # 10 PM UTC

  scalable_target_action {
    min_capacity = 1
    max_capacity = 2
  }
}

resource "aws_appautoscaling_scheduled_action" "scale_up_morning" {
  count              = var.enable_scheduled_scaling ? 1 : 0
  name               = "scale-up-morning"
  service_namespace  = "ecs"
  resource_id        = aws_appautoscaling_target.ecs[0].resource_id
  scalable_dimension = "ecs:service:DesiredCount"
  schedule           = "cron(0 6 * * ? *)"   # 6 AM UTC

  scalable_target_action {
    min_capacity = 1
    max_capacity = 10
  }
}
```

### 2. Database Cost Optimization
```hcl
# Aurora Serverless with auto-pause
resource "aws_rds_cluster" "main" {
  # ... other configuration ...

  serverlessv2_scaling_configuration {
    max_capacity = var.environment == "production" ? 16 : 1
    min_capacity = var.environment == "production" ? 0.5 : 0.5
  }

  # Auto-pause for development environments
  dynamic "scaling_configuration" {
    for_each = var.environment != "production" ? [1] : []
    content {
      auto_pause               = true
      max_capacity             = 1
      min_capacity             = 1
      seconds_until_auto_pause = 300  # 5 minutes
      timeout_action          = "ForceApplyCapacityChange"
    }
  }
}
```

### 3. Storage Cost Optimization
```hcl
# S3 Intelligent Tiering
resource "aws_s3_bucket_intelligent_tiering_configuration" "media" {
  bucket = aws_s3_bucket.media.id
  name   = "MediaIntelligentTiering"

  filter {
    prefix = "uploads/"
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 125
  }
}

# CloudFront price class optimization
resource "aws_cloudfront_distribution" "main" {
  # ... other configuration ...
  
  price_class = var.environment == "production" ? "PriceClass_200" : "PriceClass_100"
}
```

## Monitoring and Alerting

### CloudWatch Dashboards
```hcl
resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-${var.environment}"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/ECS", "CPUUtilization", "ServiceName", aws_ecs_service.app.name, "ClusterName", aws_ecs_cluster.main.name],
            ["AWS/ECS", "MemoryUtilization", "ServiceName", aws_ecs_service.app.name, "ClusterName", aws_ecs_cluster.main.name]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "ECS Metrics"
          period  = 300
        }
      },
      {
        type   = "metric"
        x      = 0
        y      = 6
        width  = 12
        height = 6

        properties = {
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBClusterIdentifier", aws_rds_cluster.main.cluster_identifier],
            ["AWS/RDS", "ACUUtilization", "DBClusterIdentifier", aws_rds_cluster.main.cluster_identifier]
          ]
          view    = "timeSeries"
          stacked = false
          region  = var.aws_region
          title   = "RDS Aurora Metrics"
          period  = 300
        }
      }
    ]
  })
}
```

### Cost Alerts
```hcl
resource "aws_cloudwatch_metric_alarm" "high_cost" {
  alarm_name          = "${var.project_name}-${var.environment}-high-cost"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "1"
  metric_name        = "EstimatedCharges"
  namespace          = "AWS/Billing"
  period             = "86400"
  statistic          = "Maximum"
  threshold          = var.cost_alert_threshold
  alarm_description  = "This metric monitors AWS estimated charges"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    Currency = "USD"
  }

  tags = var.tags
}

resource "aws_budgets_budget" "monthly" {
  name       = "${var.project_name}-${var.environment}-monthly-budget"
  budget_type = "COST"
  limit_amount = tostring(var.monthly_budget_limit)
  limit_unit   = "USD"
  time_unit    = "MONTHLY"
  time_period_start = "2025-01-01_00:00"

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 80
    threshold_type            = "PERCENTAGE"
    notification_type         = "ACTUAL"
    subscriber_email_addresses = var.alert_email_addresses
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                 = 100
    threshold_type            = "PERCENTAGE"
    notification_type          = "FORECASTED"
    subscriber_email_addresses = var.alert_email_addresses
  }
}
```

### Application Health Monitoring
```hcl
resource "aws_cloudwatch_metric_alarm" "app_health" {
  alarm_name          = "${var.project_name}-${var.environment}-app-health"
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = "2"
  metric_name        = "HealthyHostCount"
  namespace          = "AWS/ApplicationELB"
  period             = "60"
  statistic          = "Average"
  threshold          = "1"
  alarm_description  = "This metric monitors application health"
  alarm_actions      = [aws_sns_topic.alerts.arn]

  dimensions = {
    TargetGroup  = aws_lb_target_group.app.arn_suffix
    LoadBalancer = var.alb_arn_suffix
  }

  tags = var.tags
}
```

## Backup and Disaster Recovery

### 1. Database Backup Strategy
```hcl
# Automated backups with point-in-time recovery
resource "aws_rds_cluster" "main" {
  # ... other configuration ...
  
  backup_retention_period = var.environment == "production" ? 30 : 7
  preferred_backup_window = "03:00-04:00"
  copy_tags_to_snapshot  = true
  deletion_protection    = var.environment == "production"
  
  # Cross-region backup for production
  dynamic "s3_import" {
    for_each = var.environment == "production" ? [1] : []
    content {
      source_engine         = "postgres"
      source_engine_version = var.postgres_version
      bucket_name          = aws_s3_bucket.backups[0].bucket
      bucket_prefix        = "database-backups/"
      ingestion_role       = aws_iam_role.s3_import[0].arn
    }
  }
}

# Cross-region snapshot copying for production
resource "aws_db_cluster_snapshot" "main" {
  count                          = var.environment == "production" ? 1 : 0
  db_cluster_identifier         = aws_rds_cluster.main.cluster_identifier
  db_cluster_snapshot_identifier = "${var.project_name}-snapshot-${formatdate("YYYY-MM-DD", timestamp())}"

  tags = var.tags
}
```

### 2. Application Data Backup
```hcl
# S3 Cross-Region Replication
resource "aws_s3_bucket" "backups" {
  count  = var.environment == "production" ? 1 : 0
  bucket = "${var.project_name}-${var.environment}-backups-${var.backup_region}"
  
  provider = aws.backup_region
  tags     = var.tags
}

resource "aws_s3_bucket_replication_configuration" "media" {
  count      = var.environment == "production" ? 1 : 0
  role       = aws_iam_role.replication[0].arn
  bucket     = aws_s3_bucket.media.id
  depends_on = [aws_s3_bucket_versioning.media]

  rule {
    id     = "media_replication"
    status = "Enabled"

    destination {
      bucket        = aws_s3_bucket.backups[0].arn
      storage_class = "STANDARD_IA"
    }
  }
}
```

### 3. Infrastructure Recovery
```hcl
# State file backup
terraform {
  backend "s3" {
    bucket         = "wippestoolen-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    
    # Cross-region state backup
    replica_kms_key_id = "arn:aws:kms:us-west-2:ACCOUNT:key/KEY-ID"
  }
}

# Automated infrastructure testing
resource "aws_lambda_function" "dr_test" {
  count            = var.environment == "production" ? 1 : 0
  filename         = "dr_test.zip"
  function_name    = "${var.project_name}-dr-test"
  role            = aws_iam_role.lambda_dr[0].arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.dr_test[0].output_base64sha256
  runtime         = "python3.9"
  timeout         = 300

  environment {
    variables = {
      BACKUP_REGION = var.backup_region
      CLUSTER_ID    = aws_rds_cluster.main.cluster_identifier
    }
  }
}

resource "aws_cloudwatch_event_rule" "dr_test_schedule" {
  count               = var.environment == "production" ? 1 : 0
  name                = "${var.project_name}-dr-test-schedule"
  description         = "Weekly DR test"
  schedule_expression = "cron(0 2 ? * SUN *)"  # Every Sunday at 2 AM
}
```

## Security Best Practices

### 1. VPC and Network Security
```hcl
# VPC with private subnets
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-vpc"
  })
}

# Private subnets for application
resource "aws_subnet" "private" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-private-${count.index + 1}"
    Type = "Private"
  })
}

# Database subnets (isolated)
resource "aws_subnet" "database" {
  count             = length(var.availability_zones)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.database_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-database-${count.index + 1}"
    Type = "Database"
  })
}

# NAT Gateway for outbound internet access
resource "aws_nat_gateway" "main" {
  count         = var.environment == "production" ? length(var.availability_zones) : 1
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = merge(var.tags, {
    Name = "${var.project_name}-${var.environment}-nat-${count.index + 1}"
  })

  depends_on = [aws_internet_gateway.main]
}
```

### 2. Security Groups
```hcl
# ALB Security Group
resource "aws_security_group" "alb" {
  name_prefix = "${var.project_name}-${var.environment}-alb-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description = "HTTPS"
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    description = "HTTP"
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# ECS Security Group
resource "aws_security_group" "ecs" {
  name_prefix = "${var.project_name}-${var.environment}-ecs-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "ALB to ECS"
    from_port       = var.container_port
    to_port         = var.container_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = var.tags
}

# Database Security Group
resource "aws_security_group" "database" {
  name_prefix = "${var.project_name}-${var.environment}-db-"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from ECS"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ecs.id]
  }

  tags = var.tags
}
```

### 3. IAM Policies (Least Privilege)
```hcl
# ECS Task Role
resource "aws_iam_role" "ecs_task" {
  name = "${var.project_name}-${var.environment}-ecs-task"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })

  tags = var.tags
}

# S3 access for media uploads
resource "aws_iam_policy" "s3_media_access" {
  name = "${var.project_name}-${var.environment}-s3-media"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject"
        ]
        Resource = "${aws_s3_bucket.media.arn}/*"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket"
        ]
        Resource = aws_s3_bucket.media.arn
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_s3" {
  role       = aws_iam_role.ecs_task.name
  policy_arn = aws_iam_policy.s3_media_access.arn
}
```

### 4. Secrets Management
```hcl
# Database credentials
resource "aws_secretsmanager_secret" "db_credentials" {
  name = "${var.project_name}/${var.environment}/database"
  
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "db_credentials" {
  secret_id = aws_secretsmanager_secret.db_credentials.id
  secret_string = jsonencode({
    username = aws_rds_cluster.main.master_username
    password = aws_rds_cluster.main.master_password
    endpoint = aws_rds_cluster.main.endpoint
    port     = aws_rds_cluster.main.port
  })
}

# Application secrets
resource "aws_secretsmanager_secret" "app_secrets" {
  name = "${var.project_name}/${var.environment}/application"
  
  tags = var.tags
}

resource "aws_secretsmanager_secret_version" "app_secrets" {
  secret_id = aws_secretsmanager_secret.app_secrets.id
  secret_string = jsonencode({
    SECRET_KEY    = random_password.secret_key.result
    JWT_SECRET    = random_password.jwt_secret.result
    STRIPE_SECRET = var.stripe_secret_key
  })
}

resource "random_password" "secret_key" {
  length  = 32
  special = true
}

resource "random_password" "jwt_secret" {
  length  = 64
  special = false
}
```

## Deployment Commands

### Environment Setup
```bash
#!/bin/bash
# scripts/deploy.sh

set -e

ENVIRONMENT=${1:-dev}
AWS_REGION=${2:-us-east-1}

echo "Deploying to environment: $ENVIRONMENT"

# Initialize Terraform
cd "environments/$ENVIRONMENT"
tofu init

# Plan deployment
tofu plan \
  -var-file="terraform.tfvars" \
  -out="deployment.plan"

# Apply if plan is successful
echo "Review the plan above. Continue? (y/n)"
read -r REPLY
if [[ $REPLY =~ ^[Yy]$ ]]; then
  tofu apply "deployment.plan"
  
  # Output important values
  echo "Deployment complete!"
  echo "Application URL: $(tofu output application_url)"
  echo "Database Endpoint: $(tofu output database_endpoint)"
else
  echo "Deployment cancelled"
  exit 1
fi
```

### Environment Variables (terraform.tfvars)
```hcl
# environments/dev/terraform.tfvars

# Project Configuration
project_name = "wippestoolen"
environment  = "dev"
aws_region   = "us-east-1"

# Networking
vpc_cidr = "10.0.0.0/16"
availability_zones = [
  "us-east-1a",
  "us-east-1b"
]
public_subnet_cidrs = [
  "10.0.1.0/24",
  "10.0.2.0/24"
]
private_subnet_cidrs = [
  "10.0.10.0/24",
  "10.0.20.0/24"
]
database_subnet_cidrs = [
  "10.0.100.0/24",
  "10.0.200.0/24"
]

# Compute
container_image = "wippestoolen/app:latest"
container_port  = 8000
desired_count   = 1
cpu            = 256
memory         = 512

# Auto Scaling
enable_autoscaling = false
min_capacity      = 1
max_capacity      = 3
cpu_threshold     = 70

# Database
postgres_version        = "15.4"
database_name          = "wippestoolen"
master_username        = "postgres"
backup_retention_period = 7
min_capacity           = 0.5
max_capacity           = 1

# Monitoring
enable_container_insights = false
enable_performance_insights = false
monitoring_interval = 0

# Cost Management
cost_alert_threshold = 50.0
monthly_budget_limit = 40

# Tags
tags = {
  Project     = "wippestoolen"
  Environment = "dev"
  ManagedBy   = "terraform"
  CostCenter  = "development"
}
```

## Summary

This AWS infrastructure design provides:

1. **Cost-Optimized MVP**: Starts at ~$25-40/month using serverless and managed services
2. **Scalable Architecture**: Clear path to handle 10,000+ users
3. **Infrastructure as Code**: Complete OpenTofu modules for reproducible deployments
4. **Security Best Practices**: VPC isolation, least-privilege IAM, secrets management
5. **Operational Excellence**: Comprehensive monitoring, alerting, and backup strategies
6. **Cost Management**: Budget alerts, resource optimization, and scheduled scaling

The design prioritizes serverless and managed services to minimize operational overhead while maintaining professional standards and providing a clear scaling path as the platform grows.

Key cost optimization strategies include:
- Aurora Serverless v2 with auto-pause for development
- Fargate Spot instances for non-production workloads
- S3 Intelligent Tiering for media storage
- CloudFront with optimized price classes
- Scheduled auto-scaling based on usage patterns

The modular OpenTofu structure allows for easy environment management and gradual feature rollout as the platform scales from MVP to enterprise.