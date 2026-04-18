variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "node_type" { type = string }

resource "aws_elasticache_subnet_group" "main" {
  name       = "deuna-loyalty-${var.environment}-redis-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "redis" {
  name   = "deuna-loyalty-${var.environment}-redis-sg"
  vpc_id = var.vpc_id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }
}

resource "aws_elasticache_replication_group" "redis" {
  replication_group_id = "deuna-loyalty-${var.environment}"
  description          = "Redis para antifraude y caché de fidelización Deuna"
  node_type            = var.node_type
  num_cache_clusters   = 1
  port                 = 6379
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]
}

output "endpoint" {
  value     = aws_elasticache_replication_group.redis.primary_endpoint_address
  sensitive = true
}
output "redis_url" {
  value     = "rediss://${aws_elasticache_replication_group.redis.primary_endpoint_address}:6379"
  sensitive = true
}
