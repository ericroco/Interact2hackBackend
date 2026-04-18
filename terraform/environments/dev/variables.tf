variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Deployment environment"
  type        = string
  default     = "dev"
}

variable "vpc_cidr" {
  description = "CIDR block for the VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones to deploy resources into"
  type        = list(string)
  default     = ["us-east-1a", "us-east-1b"]
}

variable "db_name" {
  description = "PostgreSQL database name"
  type        = string
  default     = "deuna_loyalty"
}

variable "db_username" {
  description = "PostgreSQL master username"
  type        = string
  sensitive   = true
}

variable "db_password" {
  description = "PostgreSQL master password"
  type        = string
  sensitive   = true
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.micro"
}

variable "redis_node_type" {
  description = "ElastiCache Redis node type"
  type        = string
  default     = "cache.t3.micro"
}

variable "app_image" {
  description = "Docker image URI for the NestJS application (ECR)"
  type        = string
}

variable "app_port" {
  description = "Port the NestJS application listens on"
  type        = number
  default     = 3000
}

variable "jwt_secret" {
  description = "JWT signing secret (use a long random string)"
  type        = string
  sensitive   = true
}

variable "jwt_expiration" {
  description = "JWT token expiration (e.g. 86400s = 24h)"
  type        = string
  default     = "86400s"
}

variable "antifraud_velocity_window_seconds" {
  description = "Ventana de antifraud en segundos (0 = desactivado, 14400 = 4h)"
  type        = number
  default     = 14400
}
