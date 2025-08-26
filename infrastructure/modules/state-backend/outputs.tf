# Outputs for State Backend Module

output "s3_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.id
}

output "s3_bucket_arn" {
  description = "ARN of the S3 bucket for Terraform state"
  value       = aws_s3_bucket.terraform_state.arn
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_locks.name
}

output "dynamodb_table_arn" {
  description = "ARN of the DynamoDB table for state locking"
  value       = aws_dynamodb_table.terraform_locks.arn
}

output "backend_configuration" {
  description = "Backend configuration to use in main Terraform files"
  value = {
    bucket         = aws_s3_bucket.terraform_state.id
    key            = "production/terraform.tfstate"
    region         = var.bucket_name != "" ? split("-", var.bucket_name)[1] : "eu-central-1"
    dynamodb_table = aws_dynamodb_table.terraform_locks.name
    encrypt        = true
  }
}