# ECS Module Variables

variable "app_name" {
  description = "Name of the application"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "vpc_id" {
  description = "ID of the VPC"
  type        = string
}

variable "public_subnet_ids" {
  description = "IDs of the public subnets"
  type        = list(string)
}

variable "private_subnet_ids" {
  description = "IDs of the private subnets"
  type        = list(string)
}

variable "rds_access_security_group_id" {
  description = "Security group ID for RDS access"
  type        = string
}

# Database connection variables
variable "db_host" {
  description = "Database host"
  type        = string
}

variable "db_name" {
  description = "Database name"
  type        = string
}

variable "db_username" {
  description = "Database username"
  type        = string
}

variable "db_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

# S3 variables
variable "s3_bucket" {
  description = "S3 bucket name"
  type        = string
}

variable "s3_access_policy_arn" {
  description = "ARN of the S3 access policy"
  type        = string
}

# ECS configuration
variable "ecs_cpu" {
  description = "CPU units for ECS task"
  type        = number
  default     = 512
}

variable "ecs_memory" {
  description = "Memory for ECS task in MB"
  type        = number
  default     = 1024
}

variable "ecs_desired_count" {
  description = "Desired number of ECS tasks"
  type        = number
  default     = 1
}

# Application configuration
variable "domain_name" {
  description = "Domain name for the application"
  type        = string
  default     = ""
}

variable "jwt_secret_key" {
  description = "JWT secret key"
  type        = string
  sensitive   = true
  default     = ""
}

# SSL Configuration
variable "enable_ssl" {
  description = "Enable SSL certificate and HTTPS listener"
  type        = bool
  default     = false
}

variable "create_route53_zone" {
  description = "Create Route 53 hosted zone for domain"
  type        = bool
  default     = false
}

variable "route53_zone_id" {
  description = "Existing Route 53 zone ID (if not creating new zone)"
  type        = string
  default     = ""
}

variable "cors_origins" {
  description = "CORS allowed origins"
  type        = list(string)
  default     = ["*"]
}

variable "tags" {
  description = "Common tags to apply to all resources"
  type        = map(string)
  default     = {}
}