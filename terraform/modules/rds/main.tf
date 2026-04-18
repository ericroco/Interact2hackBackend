variable "environment"   { type = string }
variable "vpc_id"         { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "db_name"        { type = string }
variable "db_username" {
  type      = string
  sensitive = true
}
variable "db_password" {
  type      = string
  sensitive = true
}
variable "instance_class" { type = string }

resource "aws_db_subnet_group" "main" {
  name       = "deuna-loyalty-${var.environment}-rds-subnet-group"
  subnet_ids = var.private_subnet_ids
}

resource "aws_security_group" "rds" {
  name        = "deuna-loyalty-${var.environment}-rds-sg"
  description = "PostgreSQL access for ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description = "PostgreSQL from VPC"
    from_port   = 5432
    to_port     = 5432
    protocol    = "tcp"
    cidr_blocks = ["10.0.0.0/16"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "postgres" {
  identifier     = "deuna-loyalty-${var.environment}"
  engine         = "postgres"
  engine_version = "16"
  instance_class = var.instance_class

  # FIX: allocated_storage es REQUERIDO — sin esto Terraform falla con error
  allocated_storage = 20

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  multi_az            = false
  storage_encrypted   = true
  skip_final_snapshot = true

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
}

output "endpoint" {
  value     = aws_db_instance.postgres.endpoint
  sensitive = true
}
output "database_url" {
  value     = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.postgres.endpoint}/${var.db_name}"
  sensitive = true
}
