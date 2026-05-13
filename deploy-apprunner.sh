#!/bin/bash
# StorySprout — Create App Runner service
# Run AFTER deploy.sh (ECR push) and deploy-rds.sh
# Usage: ./deploy-apprunner.sh
set -e

APP_NAME="storysprout"
AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME"

# ─── Required env vars ─────────────────────────────────────────────────────
: "${DATABASE_URL:?Set DATABASE_URL (postgresql://user:pass@host:5432/db)}"
: "${SESSION_SECRET:?Set SESSION_SECRET (run: openssl rand -hex 32)}"
: "${ANTHROPIC_API_KEY:?Set ANTHROPIC_API_KEY}"
: "${OPENAI_API_KEY:?Set OPENAI_API_KEY}"

echo ""
echo "=== Creating App Runner service ==="
echo "App:     $APP_NAME"
echo "Region:  $AWS_REGION"
echo "Image:   $ECR_REPO:latest"
echo ""

# Create an IAM role for App Runner to pull from ECR
ROLE_NAME="AppRunnerECRRole"
ROLE_ARN=$(aws iam get-role --role-name "$ROLE_NAME" --query "Role.Arn" --output text 2>/dev/null || echo "")

if [ -z "$ROLE_ARN" ]; then
  echo "Creating IAM role for App Runner ECR access..."
  ROLE_ARN=$(aws iam create-role \
    --role-name "$ROLE_NAME" \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "build.apprunner.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --query "Role.Arn" \
    --output text)

  aws iam attach-role-policy \
    --role-name "$ROLE_NAME" \
    --policy-arn "arn:aws:iam::aws:policy/service-role/AWSAppRunnerServicePolicyForECRAccess"

  echo "IAM role created: $ROLE_ARN"
  sleep 10  # wait for role to propagate
else
  echo "IAM role exists: $ROLE_ARN"
fi

# Create the App Runner service
echo ""
echo "Creating App Runner service..."

SERVICE_ARN=$(aws apprunner create-service \
  --service-name "$APP_NAME" \
  --region "$AWS_REGION" \
  --source-configuration "{
    \"AuthenticationConfiguration\": {
      \"AccessRoleArn\": \"$ROLE_ARN\"
    },
    \"AutoDeploymentsEnabled\": false,
    \"ImageRepository\": {
      \"ImageIdentifier\": \"$ECR_REPO:latest\",
      \"ImageConfiguration\": {
        \"Port\": \"3000\",
        \"RuntimeEnvironmentVariables\": {
          \"NODE_ENV\": \"production\",
          \"DATABASE_URL\": \"$DATABASE_URL\",
          \"SESSION_SECRET\": \"$SESSION_SECRET\",
          \"ANTHROPIC_API_KEY\": \"$ANTHROPIC_API_KEY\",
          \"OPENAI_API_KEY\": \"$OPENAI_API_KEY\",
          \"AI_PROVIDER\": \"anthropic\",
          \"PORT\": \"3000\"
        }
      },
      \"ImageRepositoryType\": \"ECR\"
    }
  }" \
  --instance-configuration "Cpu=0.25 vCPU,Memory=0.5 GB" \
  --health-check-configuration "Protocol=HTTP,Path=/,Interval=10,Timeout=5,HealthyThreshold=1,UnhealthyThreshold=5" \
  --query "Service.ServiceArn" \
  --output text)

echo "Service created: $SERVICE_ARN"
echo ""
echo "Waiting for service to be running (2-3 min)..."
aws apprunner wait service-running \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION"

# Get the service URL
SERVICE_URL=$(aws apprunner describe-service \
  --service-arn "$SERVICE_ARN" \
  --region "$AWS_REGION" \
  --query "Service.ServiceUrl" \
  --output text)

echo ""
echo "==================================================="
echo " StorySprout is live on AWS!"
echo "==================================================="
echo ""
echo " URL: https://$SERVICE_URL"
echo ""
echo "==================================================="
