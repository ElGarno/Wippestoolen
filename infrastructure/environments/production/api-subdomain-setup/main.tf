terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region  = "eu-central-1"
  profile = "private-account"
}

# Data source for existing Route53 zone
data "aws_route53_zone" "main" {
  zone_id      = "Z0512940YC8V2DLW3ROB"
  private_zone = false
}

# Data source for existing load balancer
data "aws_lb" "main" {
  name = "wippestoolen-production-alb"
}

# Request new certificate with api subdomain
resource "aws_acm_certificate" "new_cert" {
  domain_name               = "wippestoolen.de"
  subject_alternative_names = ["www.wippestoolen.de", "api.wippestoolen.de"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = {
    Name = "wippestoolen-production-cert-with-api"
  }
}

# Certificate validation records
resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.new_cert.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
  ttl             = 60
}

# Certificate validation
resource "aws_acm_certificate_validation" "new_cert" {
  certificate_arn         = aws_acm_certificate.new_cert.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]

  timeouts {
    create = "10m"
  }
}

# A Record for api subdomain pointing to existing load balancer
resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = "api.wippestoolen.de"
  type    = "A"

  alias {
    name                   = data.aws_lb.main.dns_name
    zone_id                = data.aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

# Output the new certificate ARN
output "new_certificate_arn" {
  value = aws_acm_certificate_validation.new_cert.certificate_arn
}

output "api_subdomain_created" {
  value = "api.wippestoolen.de points to ${data.aws_lb.main.dns_name}"
}