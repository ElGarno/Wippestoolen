# Variables for Wippestoolen Production Environment

variable "aws_region" {
  description = "AWS region for deployment"
  type        = string
  default     = "eu-central-1"
}

variable "aws_profile" {
  description = "AWS CLI profile to use"
  type        = string
  default     = "private-account"
}

variable "domain_name" {
  description = "Domain name for the application (optional for initial deployment)"
  type        = string
  default     = ""
}

variable "enable_ssl" {
  description = "Enable SSL certificate (requires domain_name)"
  type        = bool
  default     = false
}

variable "create_route53_zone" {
  description = "Create Route 53 hosted zone for domain (set to false if using external DNS)"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Existing Route 53 zone ID (required if create_route53_zone is false and enable_ssl is true)"
  type        = string
  default     = ""
}

# Database configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"  # Free tier eligible
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 20  # Free tier eligible
}

# ECS configuration
variable "ecs_cpu" {
  description = "CPU units for ECS task (1024 = 1 vCPU)"
  type        = number
  default     = 512  # 0.5 vCPU for cost optimization
}

variable "ecs_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 1024  # 1 GB RAM
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1  # Single instance for MVP
}

# Environment variables for the application
variable "jwt_secret_key" {
  description = "JWT secret key for authentication"
  type        = string
  sensitive   = true
  default     = ""  # Will be auto-generated if not provided
}

variable "app_environment" {
  description = "Application environment (production, development)"
  type        = string
  default     = "production"
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["https://wippestoolen.de", "https://www.wippestoolen.de"]
}