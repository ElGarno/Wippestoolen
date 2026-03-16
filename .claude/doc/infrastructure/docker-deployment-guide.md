# Docker Deployment Guide for Wippestoolen FastAPI Application

This guide provides specific steps and best practices for building and deploying the Wippestoolen FastAPI application to AWS ECS using Docker and ECR.

## Prerequisites

- AWS CLI configured with appropriate credentials
- Docker installed and running
- OpenTofu (Terraform) installed
- Access to AWS ECS, ECR, and RDS services
- Git repository with latest application code

## Current Infrastructure Status

✅ **AWS Infrastructure**: Deployed successfully with OpenTofu  
✅ **ECS Cluster**: `wippestoolen-production`  
✅ **ECR Repository**: `wippestoolen-production`  
✅ **RDS PostgreSQL**: `wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com`  
✅ **Application URL**: `http://wippestoolen-production-alb-842123303.eu-central-1.elb.amazonaws.com`

## Step 1: Docker Image Build and Push to ECR

### Quick Deployment (Recommended)

Your deploy script handles the complete process. Run:

```bash
# From project root directory
./scripts/deploy.sh app
```

This command will:
1. Authenticate with ECR
2. Build the Docker image
3. Tag with latest and git commit hash
4. Push to ECR repository
5. Update ECS service with new image
6. Wait for deployment completion

### Manual Deployment Steps

If you prefer to run steps manually:

#### 1.1 Authenticate with ECR

```bash
# Set your AWS profile and region
export AWS_PROFILE=private-account
export AWS_REGION=eu-central-1

# Get ECR login token and authenticate Docker
aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE | \
    docker login --username AWS --password-stdin <ECR_REPO_URL>
```

#### 1.2 Build Docker Image

```bash
# Build the Docker image (multi-stage build for optimization)
docker build -t wippestoolen:latest .

# Verify the build
docker images | grep wippestoolen
```

#### 1.3 Tag and Push to ECR

```bash
# Get your ECR repository URL from deployment outputs
ECR_REPO=$(cd infrastructure/environments/production && tofu output -raw ecr_repository_url)

# Tag the image for ECR
docker tag wippestoolen:latest $ECR_REPO:latest
docker tag wippestoolen:latest $ECR_REPO:$(git rev-parse --short HEAD)

# Push both tags
docker push $ECR_REPO:latest
docker push $ECR_REPO:$(git rev-parse --short HEAD)
```

## Step 2: ECS Service Update and Verification

### 2.1 Force New Deployment

```bash
# Update ECS service to pull new image
aws ecs update-service \
    --cluster "wippestoolen-production" \
    --service "wippestoolen-production" \
    --force-new-deployment \
    --region $AWS_REGION \
    --profile $AWS_PROFILE
```

### 2.2 Monitor Deployment Progress

```bash
# Wait for deployment to stabilize
aws ecs wait services-stable \
    --cluster "wippestoolen-production" \
    --services "wippestoolen-production" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE

# Check service status
aws ecs describe-services \
    --cluster "wippestoolen-production" \
    --services "wippestoolen-production" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE \
    --query 'services[0].{Status:status,Running:runningCount,Desired:desiredCount}'
```

### 2.3 Verify Task Health

```bash
# Get running tasks
TASK_ARN=$(aws ecs list-tasks \
    --cluster "wippestoolen-production" \
    --service-name "wippestoolen-production" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE \
    --query 'taskArns[0]' --output text)

# Check task status
aws ecs describe-tasks \
    --cluster "wippestoolen-production" \
    --tasks $TASK_ARN \
    --region $AWS_REGION \
    --profile $AWS_PROFILE \
    --query 'tasks[0].{Status:lastStatus,Health:healthStatus}'
```

## Step 3: Database Migrations

### 3.1 Run Migrations via ECS Exec

```bash
# Enable execute command on the service (if not already enabled)
aws ecs update-service \
    --cluster "wippestoolen-production" \
    --service "wippestoolen-production" \
    --enable-execute-command \
    --region $AWS_REGION \
    --profile $AWS_PROFILE

# Get the task ARN
TASK_ARN=$(aws ecs list-tasks \
    --cluster "wippestoolen-production" \
    --service-name "wippestoolen-production" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE \
    --query 'taskArns[0]' --output text)

# Execute migration command
aws ecs execute-command \
    --cluster "wippestoolen-production" \
    --task $TASK_ARN \
    --container "wippestoolen-production" \
    --interactive \
    --command "/bin/bash" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE

# Inside the container, run:
# cd /app
# alembic upgrade head
```

### 3.2 Alternative: One-time Migration Task

Create a temporary migration task:

```bash
# Create migration task definition (save as migrate-task.json)
cat > migrate-task.json << 'EOF'
{
    "family": "wippestoolen-migrate",
    "networkMode": "awsvpc",
    "requiresCompatibilities": ["FARGATE"],
    "cpu": "256",
    "memory": "512",
    "executionRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskExecutionRole",
    "taskRoleArn": "arn:aws:iam::ACCOUNT_ID:role/ecsTaskRole",
    "containerDefinitions": [
        {
            "name": "migrate",
            "image": "ECR_REPO_URL:latest",
            "command": ["alembic", "upgrade", "head"],
            "logConfiguration": {
                "logDriver": "awslogs",
                "options": {
                    "awslogs-group": "/ecs/wippestoolen-production",
                    "awslogs-region": "eu-central-1",
                    "awslogs-stream-prefix": "migration"
                }
            },
            "environment": [
                {"name": "DATABASE_URL", "value": "postgresql://username:password@host:5432/dbname"}
            ]
        }
    ]
}
EOF

# Register task definition
aws ecs register-task-definition \
    --cli-input-json file://migrate-task.json \
    --region $AWS_REGION \
    --profile $AWS_PROFILE

# Run migration task
aws ecs run-task \
    --cluster "wippestoolen-production" \
    --task-definition "wippestoolen-migrate" \
    --launch-type "FARGATE" \
    --network-configuration "awsvpcConfiguration={subnets=[subnet-xxx],securityGroups=[sg-xxx],assignPublicIp=ENABLED}" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE
```

## Step 4: Deployment Health Verification

### 4.1 Application Health Check

```bash
# Test health endpoint
APP_URL=$(cd infrastructure/environments/production && tofu output -raw application_url)
curl -f "$APP_URL/health"

# Expected response: {"status":"healthy"}
```

### 4.2 API Endpoint Verification

```bash
# Test API endpoints
curl "$APP_URL/"
# Expected: {"message":"Welcome to Wippestoolen API","version":"0.1.0"}

curl "$APP_URL/docs"
# Should return OpenAPI documentation HTML

# Test authentication endpoint
curl -X POST "$APP_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{
        "email": "test@example.com",
        "password": "TestPassword123!",
        "full_name": "Test User",
        "location": "Test Location"
    }'
```

### 4.3 Database Connectivity Check

```bash
# Check database connection from ECS task
aws ecs execute-command \
    --cluster "wippestoolen-production" \
    --task $TASK_ARN \
    --container "wippestoolen-production" \
    --interactive \
    --command "python -c 'from wippestoolen.app.core.database import engine; print(\"DB Connected:\", engine.url)'" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE
```

### 4.4 Log Monitoring

```bash
# View application logs
aws logs tail "/ecs/wippestoolen-production" \
    --follow \
    --region $AWS_REGION \
    --profile $AWS_PROFILE

# Filter for errors
aws logs filter-log-events \
    --log-group-name "/ecs/wippestoolen-production" \
    --filter-pattern "ERROR" \
    --start-time $(date -d '5 minutes ago' +%s)000 \
    --region $AWS_REGION \
    --profile $AWS_PROFILE
```

## Docker Image Optimization Best Practices

### Multi-stage Build Benefits

Your Dockerfile uses multi-stage builds with these optimizations:

1. **Separate build stage**: Dependencies are installed in a clean environment
2. **Production stage**: Only runtime dependencies and application code
3. **Security**: Non-root user (wippestoolen) for container execution
4. **Health checks**: Built-in health endpoint monitoring
5. **Layer caching**: Optimized layer order for Docker build cache

### Image Size Optimization

```bash
# Check image size
docker images wippestoolen:latest

# Analyze image layers
docker history wippestoolen:latest

# Optional: Use dive for detailed analysis
# docker run --rm -it -v /var/run/docker.sock:/var/run/docker.sock \
#   wagoodman/dive:latest wippestoolen:latest
```

## Environment Variables and Secrets

Ensure these environment variables are configured in your ECS task definition:

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://username:password@wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com:5432/wippestoolen

# Security
SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Application
ENVIRONMENT=production
DEBUG=false

# CORS (if frontend is deployed separately)
CORS_ORIGINS=["https://your-frontend-domain.com"]
```

### Secrets Management

For production, use AWS Secrets Manager or Parameter Store:

```bash
# Store database password in Secrets Manager
aws secretsmanager create-secret \
    --name "wippestoolen/production/db-password" \
    --secret-string "your-db-password" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE

# Reference in ECS task definition
# "secrets": [
#     {
#         "name": "DB_PASSWORD",
#         "valueFrom": "arn:aws:secretsmanager:eu-central-1:account:secret:wippestoolen/production/db-password"
#     }
# ]
```

## Rollback Strategy

### Quick Rollback

If deployment issues occur:

```bash
# Get previous task definition
PREV_TASK_DEF=$(aws ecs describe-services \
    --cluster "wippestoolen-production" \
    --services "wippestoolen-production" \
    --region $AWS_REGION \
    --profile $AWS_PROFILE \
    --query 'services[0].deployments[1].taskDefinition' --output text)

# Rollback to previous version
aws ecs update-service \
    --cluster "wippestoolen-production" \
    --service "wippestoolen-production" \
    --task-definition $PREV_TASK_DEF \
    --region $AWS_REGION \
    --profile $AWS_PROFILE
```

### Rollback with Docker Tag

```bash
# If you tagged with git hash, you can rollback to specific version
PREV_COMMIT="abc123"  # Previous working commit hash
docker pull $ECR_REPO:$PREV_COMMIT
docker tag $ECR_REPO:$PREV_COMMIT $ECR_REPO:latest
docker push $ECR_REPO:latest

# Then force new deployment
aws ecs update-service \
    --cluster "wippestoolen-production" \
    --service "wippestoolen-production" \
    --force-new-deployment \
    --region $AWS_REGION \
    --profile $AWS_PROFILE
```

## Performance Monitoring

### CloudWatch Metrics

Monitor these key metrics:

- **CPU Utilization**: Should be < 70% under normal load
- **Memory Utilization**: Should be < 80%
- **Task Count**: Should match desired count
- **Health Check**: Success rate should be > 95%

### Application Metrics

```bash
# Custom metrics from application
curl "$APP_URL/metrics" # If you implement metrics endpoint

# Response time monitoring
time curl "$APP_URL/health"
```

## Cost Optimization Tips

1. **Right-size containers**: Monitor resource usage and adjust CPU/memory
2. **Use Spot capacity**: For non-critical workloads
3. **Image optimization**: Keep Docker images lean
4. **Auto-scaling**: Configure based on CPU/memory thresholds
5. **Scheduled scaling**: Reduce capacity during low-usage periods

## Next Steps

1. Set up CloudWatch alarms for critical metrics
2. Implement application metrics and logging
3. Configure automated backups for RDS
4. Set up CI/CD pipeline with GitHub Actions
5. Implement blue-green deployment strategy
6. Add SSL/TLS certificate for HTTPS
7. Configure domain name with Route 53

This guide provides the foundation for reliable Docker deployments to AWS ECS. Monitor your application closely after deployment and adjust configurations based on actual usage patterns.