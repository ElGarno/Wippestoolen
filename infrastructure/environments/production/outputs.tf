# Outputs for Wippestoolen Production Environment

output "application_url" {
  description = "URL to access the application"
  value       = module.ecs.application_url
}

output "load_balancer_dns" {
  description = "DNS name of the load balancer"
  value       = module.ecs.load_balancer_dns
}

output "database_endpoint" {
  description = "RDS database endpoint"
  value       = module.rds.db_endpoint
  sensitive   = true
}

output "s3_bucket_name" {
  description = "S3 bucket name for file storage"
  value       = module.s3.bucket_name
}

output "ecs_cluster_name" {
  description = "Name of the ECS cluster"
  value       = module.ecs.cluster_name
}

output "ecs_service_name" {
  description = "Name of the ECS service"
  value       = module.ecs.service_name
}

output "vpc_id" {
  description = "ID of the VPC"
  value       = module.vpc.vpc_id
}

output "private_subnet_ids" {
  description = "IDs of the private subnets"
  value       = module.vpc.private_subnet_ids
}

output "public_subnet_ids" {
  description = "IDs of the public subnets"
  value       = module.vpc.public_subnet_ids
}

# SSL/Domain outputs
output "domain_url" {
  description = "Full domain URL"
  value       = module.ecs.domain_url
}

output "route53_name_servers" {
  description = "Route 53 name servers (for domain registrar configuration)"
  value       = module.ecs.route53_name_servers
}

output "certificate_arn" {
  description = "ACM certificate ARN"
  value       = module.ecs.certificate_arn
}

# Instructions for next steps
output "deployment_instructions" {
  description = "Next steps for deployment"
  value = <<-EOT
    Deployment completed successfully!
    
    Next steps:
    1. Application URL: ${module.ecs.application_url}
    2. Configure domain (if you have one): Update Route53 or your DNS provider
    3. Database migrations: Run Alembic migrations against the RDS endpoint
    4. Upload initial data: Categories, test users, sample tools
    
    Useful commands:
    - View logs: aws logs tail /aws/ecs/wippestoolen-production --follow
    - Scale service: aws ecs update-service --cluster ${module.ecs.cluster_name} --service ${module.ecs.service_name} --desired-count 2
    
    Monthly cost estimate: €35-50
  EOT
}