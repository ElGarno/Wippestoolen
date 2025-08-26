# Bootstrap Configuration for Terraform State Backend
# Run this first to create the S3 bucket and DynamoDB table for remote state

terraform {
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# Configure the AWS Provider
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

# Create the state backend resources
module "state_backend" {
  source = "../modules/state-backend"

  bucket_name         = "wippestoolen-terraform-state-${random_string.bucket_suffix.result}"
  dynamodb_table_name = "wippestoolen-terraform-locks"

  tags = {
    Project     = "Wippestoolen"
    Environment = "production"
    ManagedBy   = "OpenTofu"
    Component   = "StateBackend"
  }
}

# Random suffix to ensure bucket name is unique
resource "random_string" "bucket_suffix" {
  length  = 8
  special = false
  upper   = false
}