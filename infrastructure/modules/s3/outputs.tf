# S3 Module Outputs

output "bucket_name" {
  description = "Name of the S3 bucket"
  value       = aws_s3_bucket.main.id
}

output "bucket_arn" {
  description = "ARN of the S3 bucket"
  value       = aws_s3_bucket.main.arn
}

output "bucket_domain_name" {
  description = "Domain name of the S3 bucket"
  value       = aws_s3_bucket.main.bucket_domain_name
}

output "s3_access_policy_arn" {
  description = "ARN of the IAM policy for S3 access"
  value       = aws_iam_policy.s3_access.arn
}