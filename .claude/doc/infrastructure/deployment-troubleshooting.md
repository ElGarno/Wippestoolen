# Deployment Troubleshooting Guide for Wippestoolen

This guide provides solutions for common issues encountered during Docker image building, ECR pushing, ECS deployment, and database migrations.

## Quick Reference Commands

```bash
# Emergency rollback
./scripts/deploy.sh app  # Uses previous working version

# Check service status
aws ecs describe-services --cluster wippestoolen-production --services wippestoolen-production --region eu-central-1 --profile private-account

# View application logs
aws logs tail "/ecs/wippestoolen-production" --follow --region eu-central-1 --profile private-account

# Run database migrations
./scripts/migrate-production.sh migrate

# Health check
curl http://wippestoolen-production-alb-842123303.eu-central-1.elb.amazonaws.com/health
```

## Docker Build Issues

### Issue: Docker Build Fails with "uv sync" Error

**Symptoms:**
```bash
ERROR: Could not find a version that satisfies the requirement ...
ERROR: No matching distribution found for ...
```

**Solutions:**

1. **Clean Docker cache:**
```bash
docker system prune -f
docker builder prune -f
```

2. **Rebuild without cache:**
```bash
docker build --no-cache -t wippestoolen:latest .
```

3. **Check pyproject.toml and uv.lock consistency:**
```bash
# In your local environment
uv sync
uv lock --refresh
```

4. **Verify Python version compatibility:**
```bash
# Check if all dependencies support Python 3.13
uv add --dry-run python==3.13
```

### Issue: Multi-stage Build Fails

**Symptoms:**
```bash
ERROR: failed to solve: failed to copy files: no such file or directory
```

**Solutions:**

1. **Check .dockerignore file:**
```bash
# Ensure these aren't accidentally ignored:
cat .dockerignore | grep -E "(pyproject.toml|uv.lock|wippestoolen/|alembic/)"
```

2. **Verify file paths in Dockerfile:**
```bash
# From project root, check files exist:
ls -la pyproject.toml uv.lock
ls -la wippestoolen/ alembic/
```

3. **Build with verbose output:**
```bash
docker build --progress=plain -t wippestoolen:latest .
```

### Issue: Permission Denied in Container

**Symptoms:**
```bash
Permission denied: '/app/logs'
```

**Solutions:**

1. **Check user creation in Dockerfile:**
```bash
# Verify these lines exist in Dockerfile:
# RUN groupadd -r wippestoolen && useradd -r -g wippestoolen wippestoolen
# RUN chown -R wippestoolen:wippestoolen /app
# USER wippestoolen
```

2. **Test container locally:**
```bash
docker run -it --rm wippestoolen:latest /bin/bash
whoami
ls -la /app
```

## ECR Push Issues

### Issue: Authentication Failed

**Symptoms:**
```bash
Error saving credentials: error storing credentials
no basic auth credentials
```

**Solutions:**

1. **Re-authenticate with ECR:**
```bash
aws ecr get-login-password --region eu-central-1 --profile private-account | \
    docker login --username AWS --password-stdin <ECR_REPO_URL>
```

2. **Check AWS credentials:**
```bash
aws sts get-caller-identity --profile private-account
```

3. **Verify ECR repository exists:**
```bash
aws ecr describe-repositories --repository-names wippestoolen-production --region eu-central-1 --profile private-account
```

### Issue: Push Timeout or Network Issues

**Symptoms:**
```bash
timeout: dial tcp: lookup on ...
net/http: TLS handshake timeout
```

**Solutions:**

1. **Check Docker daemon settings:**
```bash
# Increase timeout in Docker Desktop settings
# Or via daemon.json:
echo '{
  "max-concurrent-uploads": 1,
  "registry-mirrors": [],
  "insecure-registries": [],
  "debug": false,
  "experimental": false
}' > ~/.docker/daemon.json
```

2. **Retry with smaller concurrent uploads:**
```bash
docker push --disable-content-trust $ECR_REPO:latest
```

3. **Check network connectivity:**
```bash
ping amazonaws.com
telnet $ECR_REPO_HOST 443
```

## ECS Deployment Issues

### Issue: Service Fails to Start

**Symptoms:**
```bash
Task stopped with exit code 1
Health check failed
```

**Diagnostic Steps:**

1. **Check ECS service events:**
```bash
aws ecs describe-services \
    --cluster wippestoolen-production \
    --services wippestoolen-production \
    --region eu-central-1 \
    --profile private-account \
    --query 'services[0].events[0:5]'
```

2. **Check task definition:**
```bash
aws ecs describe-task-definition \
    --task-definition wippestoolen-production \
    --region eu-central-1 \
    --profile private-account
```

3. **View container logs:**
```bash
# Get task ARN first
TASK_ARN=$(aws ecs list-tasks \
    --cluster wippestoolen-production \
    --service-name wippestoolen-production \
    --region eu-central-1 \
    --profile private-account \
    --query 'taskArns[0]' --output text)

# View logs
aws logs get-log-events \
    --log-group-name "/ecs/wippestoolen-production" \
    --log-stream-name "ecs/wippestoolen-production/$(basename $TASK_ARN)" \
    --region eu-central-1 \
    --profile private-account
```

**Common Solutions:**

1. **Database connection issues:**
```bash
# Check security groups allow port 5432
# Verify DATABASE_URL environment variable
# Test connection from ECS task:
aws ecs execute-command \
    --cluster wippestoolen-production \
    --task $TASK_ARN \
    --container wippestoolen-production \
    --interactive \
    --command "python -c 'import psycopg2; print(\"DB connection test\")'"
```

2. **Environment variables missing:**
```bash
# Check task definition has required env vars:
aws ecs describe-task-definition \
    --task-definition wippestoolen-production \
    --region eu-central-1 \
    --profile private-account \
    --query 'taskDefinition.containerDefinitions[0].environment'
```

3. **Health check failing:**
```bash
# Test health endpoint manually
curl -f http://wippestoolen-production-alb-842123303.eu-central-1.elb.amazonaws.com/health

# Check if port 8000 is exposed in Dockerfile
# Verify ALB target group health check path
```

### Issue: Tasks Keep Restarting

**Symptoms:**
```bash
Task stopped (Essential container in task exited)
Service has reached a steady state with 0 running tasks
```

**Diagnostic Steps:**

1. **Check resource limits:**
```bash
# Monitor CPU/Memory usage
aws ecs describe-tasks \
    --cluster wippestoolen-production \
    --tasks $TASK_ARN \
    --include TAGS \
    --region eu-central-1 \
    --profile private-account
```

2. **Check application logs for OOM or crashes:**
```bash
aws logs filter-log-events \
    --log-group-name "/ecs/wippestoolen-production" \
    --filter-pattern "ERROR" \
    --start-time $(date -d '10 minutes ago' +%s)000 \
    --region eu-central-1 \
    --profile private-account
```

**Solutions:**

1. **Increase resource allocation:**
```bash
# Update task definition with more CPU/memory
# Typical values:
# CPU: 512 (0.5 vCPU) or 1024 (1 vCPU)
# Memory: 1024 MB or 2048 MB
```

2. **Fix application startup issues:**
```bash
# Common FastAPI issues:
# - Wrong port in CMD (should be 8000)
# - Missing database connection
# - Import errors
```

### Issue: Load Balancer Health Checks Fail

**Symptoms:**
```bash
Target group shows "unhealthy" targets
HTTP 503 errors from ALB
```

**Solutions:**

1. **Check ALB target group settings:**
```bash
# Health check path should be: /health
# Health check port: 8000 (or traffic port)
# Healthy threshold: 2
# Unhealthy threshold: 3
# Timeout: 5 seconds
# Interval: 30 seconds
```

2. **Verify security groups:**
```bash
# ECS security group should allow:
# - Port 8000 from ALB security group
# - Port 5432 outbound to RDS

# ALB security group should allow:
# - Port 80/443 from 0.0.0.0/0
```

3. **Test health endpoint:**
```bash
# From within VPC or using ECS exec:
curl -v http://localhost:8000/health
```

## Database Migration Issues

### Issue: Migration Script Cannot Connect

**Symptoms:**
```bash
The Session Manager plugin was installed successfully. Use the Session Manager...
command not found: alembic
```

**Solutions:**

1. **Enable ECS Exec:**
```bash
./scripts/migrate-production.sh status
# Script will automatically enable exec if needed
```

2. **Verify task is running:**
```bash
aws ecs list-tasks \
    --cluster wippestoolen-production \
    --service-name wippestoolen-production \
    --region eu-central-1 \
    --profile private-account
```

3. **Check Session Manager plugin:**
```bash
# Install or update AWS CLI Session Manager plugin
curl "https://s3.amazonaws.com/session-manager-downloads/plugin/latest/mac/sessionmanager-bundle.zip" -o "sessionmanager-bundle.zip"
unzip sessionmanager-bundle.zip
sudo ./sessionmanager-bundle/install -i /usr/local/sessionmanagerplugin -b /usr/local/bin/session-manager-plugin
```

### Issue: Migration Fails with Database Lock

**Symptoms:**
```bash
psycopg2.errors.LockNotAvailable: could not obtain lock on row
Alembic migration failed
```

**Solutions:**

1. **Check for long-running transactions:**
```sql
-- Connect to database and check:
SELECT pid, state, query, query_start 
FROM pg_stat_activity 
WHERE state != 'idle' 
ORDER BY query_start;
```

2. **Kill blocking processes (carefully):**
```sql
-- Only if you're sure:
SELECT pg_terminate_backend(pid) 
FROM pg_stat_activity 
WHERE state = 'active' AND pid != pg_backend_pid();
```

3. **Run migration during low-traffic time:**
```bash
# Scale down service to 0 tasks temporarily
aws ecs update-service \
    --cluster wippestoolen-production \
    --service wippestoolen-production \
    --desired-count 0 \
    --region eu-central-1 \
    --profile private-account

# Run migration
./scripts/migrate-production.sh migrate

# Scale back up
aws ecs update-service \
    --cluster wippestoolen-production \
    --service wippestoolen-production \
    --desired-count 1 \
    --region eu-central-1 \
    --profile private-account
```

## Application-Specific Issues

### Issue: FastAPI Returns 500 Errors

**Symptoms:**
```bash
curl http://your-app-url/ returns 500
Internal Server Error
```

**Diagnostic Steps:**

1. **Check application logs:**
```bash
aws logs tail "/ecs/wippestoolen-production" \
    --follow \
    --filter-pattern "ERROR" \
    --region eu-central-1 \
    --profile private-account
```

2. **Test database connectivity:**
```bash
aws ecs execute-command \
    --cluster wippestoolen-production \
    --task $TASK_ARN \
    --container wippestoolen-production \
    --interactive \
    --command "python -c 'from wippestoolen.app.core.database import engine; print(engine.url)'" \
    --region eu-central-1 \
    --profile private-account
```

3. **Check environment variables:**
```bash
aws ecs execute-command \
    --cluster wippestoolen-production \
    --task $TASK_ARN \
    --container wippestoolen-production \
    --interactive \
    --command "printenv | grep -E '(DATABASE|SECRET|CORS)'" \
    --region eu-central-1 \
    --profile private-account
```

**Common Solutions:**

1. **Fix database URL format:**
```bash
# Correct format:
DATABASE_URL="postgresql://username:password@wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com:5432/wippestoolen"
```

2. **Update secret key:**
```bash
# Generate new secret key:
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

3. **Check CORS settings:**
```bash
# For production, set specific origins:
CORS_ORIGINS='["https://your-frontend-domain.com"]'
```

### Issue: JWT Authentication Not Working

**Symptoms:**
```bash
401 Unauthorized on protected endpoints
Invalid token errors
```

**Solutions:**

1. **Verify JWT secret consistency:**
```bash
# Ensure SECRET_KEY is same between deployments
# Check it's not accidentally reset
```

2. **Test token generation:**
```bash
# Create test user and get token:
curl -X POST "$APP_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d '{"email":"test@test.com","password":"TestPass123!","full_name":"Test","location":"Test"}'
```

3. **Check token expiration settings:**
```bash
# Ensure reasonable expiration time:
ACCESS_TOKEN_EXPIRE_MINUTES=30
```

## Performance Issues

### Issue: Slow Response Times

**Diagnostic Steps:**

1. **Check CloudWatch metrics:**
```bash
# CPU and memory utilization
# Request count and response time
# Database connection pool
```

2. **Profile database queries:**
```sql
-- Enable slow query logging
SELECT * FROM pg_stat_statements 
ORDER BY total_exec_time DESC 
LIMIT 10;
```

3. **Monitor container resources:**
```bash
aws ecs execute-command \
    --cluster wippestoolen-production \
    --task $TASK_ARN \
    --container wippestoolen-production \
    --interactive \
    --command "top" \
    --region eu-central-1 \
    --profile private-account
```

**Solutions:**

1. **Scale up resources:**
```bash
# Increase task CPU/memory
# Add more task replicas
# Use larger RDS instance
```

2. **Optimize database:**
```sql
-- Add indexes for frequently queried columns
-- Optimize connection pooling settings
-- Enable query caching
```

3. **Enable application caching:**
```bash
# Add Redis for session caching
# Implement response caching
# Use CDN for static assets
```

## Emergency Procedures

### Immediate Rollback

```bash
# 1. Quick rollback to previous version
aws ecs update-service \
    --cluster wippestoolen-production \
    --service wippestoolen-production \
    --task-definition wippestoolen-production:PREVIOUS_REVISION \
    --region eu-central-1 \
    --profile private-account

# 2. Alternative: redeploy with previous Docker tag
docker pull $ECR_REPO:PREVIOUS_COMMIT_HASH
docker tag $ECR_REPO:PREVIOUS_COMMIT_HASH $ECR_REPO:latest
docker push $ECR_REPO:latest
./scripts/deploy.sh app
```

### Scale to Zero (Emergency Stop)

```bash
# Stop all tasks immediately
aws ecs update-service \
    --cluster wippestoolen-production \
    --service wippestoolen-production \
    --desired-count 0 \
    --region eu-central-1 \
    --profile private-account
```

### Database Emergency Access

```bash
# Connect directly to RDS (if in VPC)
psql -h wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com \
     -U your_username \
     -d wippestoolen

# Or via ECS exec
./scripts/migrate-production.sh shell
# Then: psql $DATABASE_URL
```

## Monitoring and Alerts

### Set Up CloudWatch Alarms

```bash
# High CPU usage
aws cloudwatch put-metric-alarm \
    --alarm-name "wippestoolen-high-cpu" \
    --alarm-description "ECS CPU utilization high" \
    --metric-name CPUUtilization \
    --namespace AWS/ECS \
    --statistic Average \
    --period 300 \
    --evaluation-periods 2 \
    --threshold 80 \
    --comparison-operator GreaterThanThreshold

# Application errors
aws logs put-metric-filter \
    --log-group-name "/ecs/wippestoolen-production" \
    --filter-name "ErrorCount" \
    --filter-pattern "ERROR" \
    --metric-transformations \
        metricName=ApplicationErrors,metricNamespace=Wippestoolen,metricValue=1
```

### Health Check Monitoring

```bash
# Continuous health monitoring script
while true; do
    if curl -f "$APP_URL/health" > /dev/null 2>&1; then
        echo "$(date): ✅ Health check passed"
    else
        echo "$(date): ❌ Health check failed" | tee -a health_failures.log
    fi
    sleep 30
done
```

This troubleshooting guide covers the most common deployment issues. For additional help:

1. Check CloudWatch logs for detailed error messages
2. Review AWS service quotas and limits
3. Verify network connectivity and security groups
4. Test components individually before full deployment
5. Keep backups of working configurations

Remember to always test changes in a staging environment before applying to production.