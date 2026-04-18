terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  backend "s3" {
    bucket         = "deuna-loyalty-tfstate-dev"
    key            = "dev/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "deuna-loyalty-tflock-dev"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "deuna-loyalty"
      Environment = "dev"
      ManagedBy   = "terraform"
    }
  }
}

module "vpc" {
  source = "../../modules/vpc"

  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
}

module "rds" {
  source = "../../modules/rds"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  db_name            = var.db_name
  db_username        = var.db_username
  db_password        = var.db_password
  instance_class     = var.db_instance_class
}

module "elasticache" {
  source = "../../modules/elasticache"

  environment        = var.environment
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_type          = var.redis_node_type
}

module "ecs" {
  source = "../../modules/ecs"

  environment                       = var.environment
  vpc_id                            = module.vpc.vpc_id
  public_subnet_ids                 = module.vpc.public_subnet_ids
  private_subnet_ids                = module.vpc.private_subnet_ids
  app_image                         = var.app_image
  app_port                          = var.app_port
  database_url                      = module.rds.database_url
  redis_url                         = module.elasticache.redis_url
  jwt_secret                        = var.jwt_secret
  jwt_expiration                    = var.jwt_expiration
  antifraud_velocity_window_seconds = var.antifraud_velocity_window_seconds
}
