# Wippestoolen Production Infrastructure
# OpenTofu configuration for AWS deployment

terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.1"
    }
  }
  
  # Backend configuration for state management - temporarily disabled for certificate update
  # backend "s3" {
  #   bucket         = "wippestoolen-terraform-state-qy7taft8"
  #   key            = "production/terraform.tfstate"
  #   region         = "eu-central-1"
  #   dynamodb_table = "wippestoolen-terraform-locks"
  #   encrypt        = true
  # }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile

  default_tags {
    tags = {
      Project     = "Wippestoolen"
      Environment = "production"
      ManagedBy   = "OpenTofu"
      Owner       = "woerenkaemper"
    }
  }
}

locals {
  app_name = "wippestoolen"
  environment = "production"
  
  common_tags = {
    Project     = "Wippestoolen"
    Environment = local.environment
    ManagedBy   = "OpenTofu"
  }
}

# Data sources
data "aws_availability_zones" "available" {
  state = "available"
}

data "aws_caller_identity" "current" {}

# Generate random password for RDS
resource "random_password" "db_password" {
  length  = 32
  special = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"
  
  app_name           = local.app_name
  environment        = local.environment
  availability_zones = data.aws_availability_zones.available.names
  
  tags = local.common_tags
}

# RDS Module
module "rds" {
  source = "../../modules/rds"
  
  app_name           = local.app_name
  environment        = local.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_password        = random_password.db_password.result
  
  tags = local.common_tags
}

# S3 Module for file storage
module "s3" {
  source = "../../modules/s3"
  
  app_name    = local.app_name
  environment = local.environment
  
  tags = local.common_tags
}

# ECS Module
module "ecs" {
  source = "../../modules/ecs"
  
  app_name           = local.app_name
  environment        = local.environment
  vpc_id             = module.vpc.vpc_id
  public_subnet_ids  = module.vpc.public_subnet_ids
  private_subnet_ids = module.vpc.private_subnet_ids
  
  # Database connection
  db_host     = module.rds.db_endpoint
  db_name     = module.rds.db_name
  db_username = module.rds.db_username
  db_password = random_password.db_password.result
  rds_access_security_group_id = module.rds.rds_access_security_group_id
  
  # S3 bucket
  s3_bucket = module.s3.bucket_name
  s3_access_policy_arn = module.s3.s3_access_policy_arn
  
  # Domain and SSL configuration
  domain_name         = var.domain_name
  enable_ssl          = var.enable_ssl
  create_route53_zone = var.create_route53_zone
  route53_zone_id     = var.route53_zone_id
  
  # CORS origins
  cors_origins = var.cors_origins
  
  tags = local.common_tags
}

# Store database password in AWS Systems Manager
resource "aws_ssm_parameter" "db_password" {
  name  = "/${local.app_name}/${local.environment}/db/password"
  type  = "SecureString"
  value = random_password.db_password.result

  tags = local.common_tags
}