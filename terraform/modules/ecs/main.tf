variable "environment"                        { type = string }
variable "vpc_id"                              { type = string }
variable "public_subnet_ids"                   { type = list(string) }
variable "private_subnet_ids"                  { type = list(string) }
variable "app_image"                           { type = string }
variable "app_port"                            { type = number }
variable "database_url" {
  type      = string
  sensitive = true
}
variable "redis_url" {
  type      = string
  sensitive = true
}
variable "jwt_secret" {
  type      = string
  sensitive = true
}
variable "jwt_expiration" {
  type    = string
  default = "86400s"
}
variable "antifraud_velocity_window_seconds" {
  type    = number
  default = 14400
}

# ── IAM: Task Execution Role ──────────────────────────────────────────
# FIX: faltaba el IAM role — sin él, Fargate no puede descargar imágenes ni escribir a CloudWatch

data "aws_iam_policy_document" "ecs_assume_role" {
  statement {
    actions = ["sts:AssumeRole"]
    principals {
      type        = "Service"
      identifiers = ["ecs-tasks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "task_execution" {
  name               = "deuna-loyalty-${var.environment}-ecs-exec-role"
  assume_role_policy = data.aws_iam_policy_document.ecs_assume_role.json
}

resource "aws_iam_role_policy_attachment" "task_execution" {
  role       = aws_iam_role.task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

# ── CloudWatch Log Group ──────────────────────────────────────────────
# FIX: faltaba el log group — la task definition lo referenciaba pero no existía

resource "aws_cloudwatch_log_group" "app" {
  name              = "/ecs/deuna-loyalty-${var.environment}"
  retention_in_days = 14
}

# ── Security Groups ───────────────────────────────────────────────────
# FIX: faltaban los security groups — ALB sin SG no puede recibir tráfico externo
#      y los contenedores sin SG no pueden recibir del ALB ni salir a DB/Redis

resource "aws_security_group" "alb" {
  name        = "deuna-loyalty-${var.environment}-alb-sg"
  description = "Allow HTTP inbound to ALB"
  vpc_id      = var.vpc_id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_security_group" "app" {
  name        = "deuna-loyalty-${var.environment}-app-sg"
  description = "Allow traffic from ALB to ECS tasks"
  vpc_id      = var.vpc_id

  ingress {
    description     = "App port from ALB"
    from_port       = var.app_port
    to_port         = var.app_port
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# ── Application Load Balancer ─────────────────────────────────────────
resource "aws_lb" "main" {
  name               = "deuna-loyalty-${var.environment}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = var.public_subnet_ids
}

resource "aws_lb_target_group" "app" {
  name        = "deuna-loyalty-${var.environment}-tg"
  port        = var.app_port
  protocol    = "HTTP"
  vpc_id      = var.vpc_id
  target_type = "ip"

  health_check {
    path                = "/health"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    interval            = 30
  }
}

# FIX: faltaba el ALB Listener — sin él el ALB no sabe a qué target group redirigir
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}

# ── ECS Cluster ───────────────────────────────────────────────────────
resource "aws_ecs_cluster" "main" {
  name = "deuna-loyalty-${var.environment}"

  setting {
    name  = "containerInsights"
    value = "enabled"
  }
}

# ── Task Definition ───────────────────────────────────────────────────
resource "aws_ecs_task_definition" "app" {
  family                   = "deuna-loyalty-${var.environment}-app"
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  cpu                      = "512"
  memory                   = "1024"
  execution_role_arn       = aws_iam_role.task_execution.arn

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = var.app_image
      essential = true
      portMappings = [{ containerPort = var.app_port, protocol = "tcp" }]
      environment = [
        # FIX: faltaban JWT_SECRET y demás env vars — la app no arrancaría sin ellas
        { name = "NODE_ENV",                            value = "production" },
        { name = "PORT",                                value = tostring(var.app_port) },
        { name = "DATABASE_URL",                        value = var.database_url },
        { name = "REDIS_URL",                           value = var.redis_url },
        { name = "JWT_SECRET",                          value = var.jwt_secret },
        { name = "JWT_EXPIRATION",                      value = var.jwt_expiration },
        { name = "ANTIFRAUD_VELOCITY_WINDOW_SECONDS",   value = tostring(var.antifraud_velocity_window_seconds) },
        { name = "DB_SYNC",                              value = "true" },
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          "awslogs-group"         = aws_cloudwatch_log_group.app.name
          "awslogs-region"        = "us-east-1"
          "awslogs-stream-prefix" = "app"
        }
      }
    }
  ])
}

# ── ECS Service ───────────────────────────────────────────────────────
# FIX: FALTABA EL ECS SERVICE — sin este recurso NO SE INICIAN CONTENEDORES
#      El cluster y la task definition son "plantillas" — el Service es quien los ejecuta

resource "aws_ecs_service" "app" {
  name            = "deuna-loyalty-${var.environment}-svc"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "FARGATE"

  network_configuration {
    subnets          = var.private_subnet_ids
    security_groups  = [aws_security_group.app.id]
    assign_public_ip = false
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.app.arn
    container_name   = "app"
    container_port   = var.app_port
  }

  depends_on = [
    aws_lb_listener.http,
    aws_iam_role_policy_attachment.task_execution,
  ]
}

# ── Outputs ───────────────────────────────────────────────────────────
output "alb_dns_name"  { value = aws_lb.main.dns_name }
output "service_name"  { value = aws_ecs_service.app.name }
output "cluster_name"  { value = aws_ecs_cluster.main.name }
