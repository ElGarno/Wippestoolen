#!/bin/bash
# Production Database Migration Script for Wippestoolen
# Safely runs Alembic migrations in production ECS environment

set -e  # Exit on any error

# Configuration
ENVIRONMENT=${ENVIRONMENT:-production}
AWS_REGION=${AWS_REGION:-eu-central-1}
AWS_PROFILE=${AWS_PROFILE:-private-account}
APP_NAME="wippestoolen"
CLUSTER_NAME="$APP_NAME-$ENVIRONMENT"
SERVICE_NAME="$APP_NAME-$ENVIRONMENT"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

log_step() {
    echo -e "${BLUE}[STEP]${NC} $1"
}

# Check prerequisites
check_prerequisites() {
    log_step "Checking prerequisites..."
    
    if ! command -v aws &> /dev/null; then
        log_error "AWS CLI not found. Please install it."
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity --profile $AWS_PROFILE &> /dev/null; then
        log_error "AWS credentials not configured or expired. Please run 'assume $AWS_PROFILE' or configure AWS CLI."
        exit 1
    fi
    
    log_info "Prerequisites check passed."
}

# Get running task information
get_task_info() {
    log_step "Getting ECS task information..."
    
    # Check if service exists and is running
    SERVICE_STATUS=$(aws ecs describe-services \
        --cluster "$CLUSTER_NAME" \
        --services "$SERVICE_NAME" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'services[0].status' --output text 2>/dev/null)
    
    if [ "$SERVICE_STATUS" != "ACTIVE" ]; then
        log_error "Service $SERVICE_NAME is not active or doesn't exist. Status: $SERVICE_STATUS"
        exit 1
    fi
    
    # Get running task ARN
    TASK_ARN=$(aws ecs list-tasks \
        --cluster "$CLUSTER_NAME" \
        --service-name "$SERVICE_NAME" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'taskArns[0]' --output text)
    
    if [ "$TASK_ARN" == "None" ] || [ -z "$TASK_ARN" ]; then
        log_error "No running tasks found for service $SERVICE_NAME"
        exit 1
    fi
    
    log_info "Found running task: $(basename $TASK_ARN)"
    
    # Check if execute command is enabled
    EXEC_ENABLED=$(aws ecs describe-tasks \
        --cluster "$CLUSTER_NAME" \
        --tasks $TASK_ARN \
        --region $AWS_REGION \
        --profile $AWS_PROFILE \
        --query 'tasks[0].enableExecuteCommand' --output text)
    
    if [ "$EXEC_ENABLED" != "True" ]; then
        log_warning "Execute command is not enabled on this task."
        log_info "Enabling execute command for the service..."
        
        aws ecs update-service \
            --cluster "$CLUSTER_NAME" \
            --service "$SERVICE_NAME" \
            --enable-execute-command \
            --region $AWS_REGION \
            --profile $AWS_PROFILE > /dev/null
        
        log_warning "Execute command enabled. You may need to restart the service for this to take effect."
        log_warning "Run: aws ecs update-service --cluster $CLUSTER_NAME --service $SERVICE_NAME --force-new-deployment"
        
        read -p "Do you want to restart the service now? (yes/no): " RESTART
        if [ "$RESTART" == "yes" ]; then
            log_info "Restarting service..."
            aws ecs update-service \
                --cluster "$CLUSTER_NAME" \
                --service "$SERVICE_NAME" \
                --force-new-deployment \
                --region $AWS_REGION \
                --profile $AWS_PROFILE > /dev/null
            
            log_info "Waiting for service to stabilize..."
            aws ecs wait services-stable \
                --cluster "$CLUSTER_NAME" \
                --services "$SERVICE_NAME" \
                --region $AWS_REGION \
                --profile $AWS_PROFILE
            
            # Get new task ARN
            TASK_ARN=$(aws ecs list-tasks \
                --cluster "$CLUSTER_NAME" \
                --service-name "$SERVICE_NAME" \
                --region $AWS_REGION \
                --profile $AWS_PROFILE \
                --query 'taskArns[0]' --output text)
            
            log_info "Service restarted. New task: $(basename $TASK_ARN)"
        else
            log_error "Cannot proceed without execute command enabled."
            exit 1
        fi
    fi
}

# Check current database schema version
check_current_version() {
    log_step "Checking current database schema version..."
    
    CURRENT_VERSION=$(aws ecs execute-command \
        --cluster "$CLUSTER_NAME" \
        --task $TASK_ARN \
        --container "$SERVICE_NAME" \
        --interactive \
        --command "python -c 'from alembic import command; from alembic.config import Config; config = Config(\"alembic.ini\"); from alembic.script import ScriptDirectory; from alembic.runtime.environment import EnvironmentContext; script = ScriptDirectory.from_config(config); with EnvironmentContext(config, script, as_sql=False, starting_rev=None, destination_rev=\"head\") as context: context.configure(connection=None); print(context.get_current_revision() or \"No version\")'" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE 2>/dev/null | grep -v "^The Session Manager" | tail -1)
    
    log_info "Current database version: ${CURRENT_VERSION:-Unknown}"
}

# Show pending migrations
show_pending_migrations() {
    log_step "Checking for pending migrations..."
    
    log_info "Getting migration status..."
    aws ecs execute-command \
        --cluster "$CLUSTER_NAME" \
        --task $TASK_ARN \
        --container "$SERVICE_NAME" \
        --interactive \
        --command "alembic current -v" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
    
    echo
    log_info "Showing migration history..."
    aws ecs execute-command \
        --cluster "$CLUSTER_NAME" \
        --task $TASK_ARN \
        --container "$SERVICE_NAME" \
        --interactive \
        --command "alembic history -v" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
}

# Backup database (optional)
backup_database() {
    log_step "Creating database backup..."
    
    BACKUP_NAME="wippestoolen-backup-$(date +%Y%m%d-%H%M%S)"
    
    log_info "Creating RDS snapshot: $BACKUP_NAME"
    
    # Get RDS instance identifier
    DB_IDENTIFIER="wippestoolen-production"
    
    aws rds create-db-snapshot \
        --db-instance-identifier "$DB_IDENTIFIER" \
        --db-snapshot-identifier "$BACKUP_NAME" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
    
    log_info "Backup snapshot '$BACKUP_NAME' creation initiated."
    log_warning "Note: Snapshot creation runs in background. Migration will proceed."
}

# Run migrations
run_migrations() {
    log_step "Running database migrations..."
    
    log_warning "This will run 'alembic upgrade head' in the production database."
    read -p "Are you sure you want to proceed? (yes/no): " PROCEED
    
    if [ "$PROCEED" != "yes" ]; then
        log_info "Migration cancelled."
        exit 0
    fi
    
    log_info "Starting migration..."
    
    # Run the migration
    aws ecs execute-command \
        --cluster "$CLUSTER_NAME" \
        --task $TASK_ARN \
        --container "$SERVICE_NAME" \
        --interactive \
        --command "alembic upgrade head" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
    
    MIGRATION_EXIT_CODE=$?
    
    if [ $MIGRATION_EXIT_CODE -eq 0 ]; then
        log_info "Migration completed successfully!"
    else
        log_error "Migration failed with exit code $MIGRATION_EXIT_CODE"
        exit 1
    fi
}

# Verify migration success
verify_migration() {
    log_step "Verifying migration success..."
    
    # Check application health
    APP_URL=$(cd ../../infrastructure/environments/production && tofu output -raw application_url 2>/dev/null || echo "")
    
    if [ -n "$APP_URL" ]; then
        log_info "Testing application health endpoint..."
        
        if curl -f "$APP_URL/health" > /dev/null 2>&1; then
            log_info "✅ Application health check passed"
        else
            log_error "❌ Application health check failed"
        fi
        
        log_info "Testing API root endpoint..."
        
        if curl -f "$APP_URL/" > /dev/null 2>&1; then
            log_info "✅ API root endpoint accessible"
        else
            log_warning "⚠️  API root endpoint test failed"
        fi
    else
        log_warning "Application URL not found. Skipping external health checks."
    fi
    
    # Check final database version
    log_info "Checking final database version..."
    check_current_version
}

# Interactive migration session
interactive_session() {
    log_step "Starting interactive migration session..."
    
    log_info "Opening shell session in ECS task..."
    log_info "Available commands:"
    log_info "  - alembic current: Show current version"
    log_info "  - alembic history: Show migration history"
    log_info "  - alembic upgrade head: Run all pending migrations"
    log_info "  - alembic upgrade +1: Run one migration forward"
    log_info "  - alembic downgrade -1: Run one migration backward (DANGEROUS)"
    log_info "  - exit: Exit the session"
    
    aws ecs execute-command \
        --cluster "$CLUSTER_NAME" \
        --task $TASK_ARN \
        --container "$SERVICE_NAME" \
        --interactive \
        --command "/bin/bash" \
        --region $AWS_REGION \
        --profile $AWS_PROFILE
}

# Main function
main() {
    log_info "Starting Wippestoolen Production Database Migration"
    log_info "================================================="
    log_info "Environment: $ENVIRONMENT"
    log_info "AWS Region: $AWS_REGION"
    log_info "AWS Profile: $AWS_PROFILE"
    log_info "Cluster: $CLUSTER_NAME"
    log_info "Service: $SERVICE_NAME"
    echo
    
    check_prerequisites
    get_task_info
    
    case ${1:-migrate} in
        "status")
            check_current_version
            show_pending_migrations
            ;;
        "backup")
            backup_database
            ;;
        "migrate")
            show_pending_migrations
            echo
            read -p "Do you want to create a backup before migration? (yes/no): " BACKUP
            if [ "$BACKUP" == "yes" ]; then
                backup_database
                echo
            fi
            run_migrations
            verify_migration
            ;;
        "shell")
            interactive_session
            ;;
        "verify")
            verify_migration
            ;;
        *)
            log_error "Invalid option. Available commands:"
            log_info "  status  - Show current migration status"
            log_info "  backup  - Create database backup"
            log_info "  migrate - Run pending migrations (default)"
            log_info "  shell   - Start interactive shell session"
            log_info "  verify  - Verify application health"
            exit 1
            ;;
    esac
    
    log_info "Migration process completed!"
}

# Run main function
main "$@"