#!/bin/bash
# Wippestoolen Deployment Script
# This script builds and pushes the Docker image, then deploys infrastructure

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
AWS_REGION=${AWS_REGION:-eu-central-1}
AWS_PROFILE=${AWS_PROFILE:-private-account}
APP_NAME="wippestoolen"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it."
        exit 1
    fi
    
    if ! command -v tofu &> /dev/null; then
        log_error "OpenTofu not found. Please install it."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker not found. Please install it."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE &> /dev/null; then
        log_error "AWS credentials not configured or expired. Please run 'assume $AWS_PROFILE' or configure AWS CLI."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Initialize OpenTofu
init_tofu() {
    log_info "Initializing OpenTofu..."
    cd infrastructure/environments/production
    
    tofu init
    
    log_info "OpenTofu initialized."
}

# Plan infrastructure deployment
plan_deployment() {
    log_info "Planning infrastructure deployment..."
    
    tofu plan -out=tfplan \
        -var="aws_profile=$AWS_PROFILE" \
        -var="aws_region=$AWS_REGION"
    
    log_info "Infrastructure plan created. Review the plan above."
    
    read -p "Do you want to proceed with deployment? (yes/no): " PROCEED
    if [ "$PROCEED" != "yes" ]; then
        log_info "Deployment cancelled."
        exit 0
    fi
}

# Apply infrastructure
apply_infrastructure() {
    log_info "Applying infrastructure..."
    
    tofu apply tfplan
    
    # Get outputs
    ECR_REPO=$(tofu output -raw ecr_repository_url 2>/dev/null || echo "")
    APP_URL=$(tofu output -raw application_url 2>/dev/null || echo "")
    
    if [ -n "$ECR_REPO" ]; then
        echo "ECR_REPO=$ECR_REPO" > ../../../.env.deploy
        echo "APP_URL=$APP_URL" >> ../../../.env.deploy
        log_info "ECR Repository: $ECR_REPO"
        log_info "Application URL: $APP_URL"
    fi
    
    cd ../../..
}

# Build and push Docker image
build_and_push_image() {
    if [ ! -f .env.deploy ]; then
        log_error ".env.deploy not found. Please run infrastructure deployment first."
        exit 1
    fi
    
    source .env.deploy
    
    if [ -z "$ECR_REPO" ]; then
        log_error "ECR repository URL not found in .env.deploy"
        exit 1
    fi
    
    log_info "Building Docker image..."
    
    # Login to ECR
    aws ecr get-login-password --region $AWS_REGION --profile $AWS_PROFILE | \
        docker login --username AWS --password-stdin $ECR_REPO
    
    # Build image
    docker build -t $APP_NAME:latest .
    
    # Tag image
    docker tag $APP_NAME:latest $ECR_REPO:latest
    docker tag $APP_NAME:latest $ECR_REPO:$(git rev-parse --short HEAD 2>/dev/null || echo "manual")
    
    # Push image
    log_info "Pushing Docker image to ECR..."
    docker push $ECR_REPO:latest
    docker push $ECR_REPO:$(git rev-parse --short HEAD 2>/dev/null || echo "manual")
    
    log_info "Docker image pushed successfully."
}

# Update ECS service
update_service() {
    source .env.deploy
    
    log_info "Updating ECS service..."
    
    # Force new deployment
    aws ecs update-service \
        --cluster "$APP_NAME-$ENVIRONMENT" \
        --service "$APP_NAME-$ENVIRONMENT" \
        --force-new-deployment \
        --region $AWS_REGION \
        --profile $AWS_PROFILE > /dev/null
    
    log_info "ECS service update initiated."
    
    # Wait for deployment to complete
    log_info "Waiting for deployment to complete..."
    aws ecs wait services-stable \
        --cluster "$APP_NAME-$ENVIRONMENT" \
        --services "$APP_NAME-$ENVIRONMENT" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
    
    log_info "Deployment completed successfully!"
    log_info "Application URL: $APP_URL"
}

# Run database migrations
run_migrations() {
    log_warning "Database migrations need to be run manually."
    log_info "Connect to your ECS task and run: alembic upgrade head"
}

# Main deployment function
deploy() {
    log_info "Starting Wippestoolen deployment..."
    
    check_prerequisites
    
    case ${1:-all} in
        "infra")
            init_tofu
            plan_deployment
            apply_infrastructure
            ;;
        "app")
            build_and_push_image
            update_service
            ;;
        "all")
            init_tofu
            plan_deployment
            apply_infrastructure
            build_and_push_image
            update_service
            run_migrations
            ;;
        *)
            log_error "Invalid option. Use: infra, app, or all"
            exit 1
            ;;
    esac
    
    log_info "Deployment process completed!"
}

# Run deployment
deploy "$@"