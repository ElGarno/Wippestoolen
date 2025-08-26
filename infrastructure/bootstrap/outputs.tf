# Outputs for Bootstrap Configuration

output "s3_bucket_name" {
  description = "Name of the S3 bucket for Terraform state"
  value       = module.state_backend.s3_bucket_name
}

output "dynamodb_table_name" {
  description = "Name of the DynamoDB table for state locking"
  value       = module.state_backend.dynamodb_table_name
}

output "backend_configuration" {
  description = "Backend configuration to add to your main Terraform files"
  value = <<-EOT
    terraform {
      backend "s3" {
        bucket         = "${module.state_backend.s3_bucket_name}"
        key            = "production/terraform.tfstate"
        region         = "eu-central-1"
        dynamodb_table = "${module.state_backend.dynamodb_table_name}"
        encrypt        = true
      }
    }
  EOT
}