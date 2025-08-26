# ECS Module Outputs

output "cluster_name" {
  description = "Name of the ECS cluster"
  value       = aws_ecs_cluster.main.name
}

output "service_name" {
  description = "Name of the ECS service"
  value       = aws_ecs_service.main.name
}

output "load_balancer_dns" {
  description = "DNS name of the load balancer"
  value       = aws_lb.main.dns_name
}

output "load_balancer_arn" {
  description = "ARN of the load balancer"
  value       = aws_lb.main.arn
}

output "application_url" {
  description = "URL to access the application"
  value       = "http://${aws_lb.main.dns_name}"
}

output "ecr_repository_url" {
  description = "URL of the ECR repository"
  value       = aws_ecr_repository.main.repository_url
}

output "task_definition_arn" {
  description = "ARN of the ECS task definition"
  value       = aws_ecs_task_definition.main.arn
}

# SSL-related outputs
output "certificate_arn" {
  description = "ARN of the SSL certificate"
  value       = var.enable_ssl ? aws_acm_certificate.main[0].arn : null
}

output "route53_zone_id" {
  description = "Route 53 zone ID"
  value       = var.enable_ssl ? (
    var.create_route53_zone ? aws_route53_zone.main[0].zone_id : data.aws_route53_zone.existing[0].zone_id
  ) : null
}

output "route53_name_servers" {
  description = "Route 53 name servers"
  value       = var.enable_ssl ? (
    var.create_route53_zone ? aws_route53_zone.main[0].name_servers : data.aws_route53_zone.existing[0].name_servers
  ) : null
}

output "domain_url" {
  description = "Full domain URL"
  value       = var.enable_ssl ? "https://${var.domain_name}" : "http://${aws_lb.main.dns_name}"
}