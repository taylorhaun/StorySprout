#!/bin/bash
# StorySprout — AWS Deployment Script
# Deploys to ECR + App Runner + RDS
# Usage: ./deploy.sh
set -e

# ─── Config ────────────────────────────────────────────────────────────────
APP_NAME="storysprout"
AWS_REGION="${AWS_REGION:-us-east-1}"
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
ECR_REPO="$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com/$APP_NAME"
IMAGE_TAG="latest"

echo ""
echo "=== StorySprout Deployment ==="
echo "Account:  $ACCOUNT_ID"
echo "Region:   $AWS_REGION"
echo "ECR repo: $ECR_REPO"
echo ""

# ─── Step 1: Create ECR repository (idempotent) ────────────────────────────
echo "--- Step 1: ECR repository ---"
aws ecr describe-repositories --repository-names "$APP_NAME" --region "$AWS_REGION" > /dev/null 2>&1 || \
  aws ecr create-repository \
    --repository-name "$APP_NAME" \
    --region "$AWS_REGION" \
    --image-scanning-configuration scanOnPush=true \
    --query 'repository.repositoryUri' \
    --output text
echo "ECR repository ready."

# ─── Step 2: Authenticate Docker to ECR ────────────────────────────────────
echo ""
echo "--- Step 2: Docker login to ECR ---"
aws ecr get-login-password --region "$AWS_REGION" | \
  docker login --username AWS --password-stdin "$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com"

# ─── Step 3: Build and push image ──────────────────────────────────────────
echo ""
echo "--- Step 3: Build and push Docker image ---"
docker build --platform linux/amd64 -t "$APP_NAME:$IMAGE_TAG" .
docker tag "$APP_NAME:$IMAGE_TAG" "$ECR_REPO:$IMAGE_TAG"
docker push "$ECR_REPO:$IMAGE_TAG"
echo "Image pushed: $ECR_REPO:$IMAGE_TAG"

echo ""
echo "=== ECR push complete ==="
echo ""
echo "Next steps (run manually or follow the guide):"
echo "  1. Create RDS Postgres instance (see deploy-rds.sh)"
echo "  2. Create App Runner service (see deploy-apprunner.sh)"
echo ""
echo "ECR image URI (save this):"
echo "  $ECR_REPO:$IMAGE_TAG"
