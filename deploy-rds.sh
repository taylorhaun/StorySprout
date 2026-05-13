#!/bin/bash
# StorySprout — Create RDS PostgreSQL instance
# Run ONCE before deploy-apprunner.sh
set -e

AWS_REGION="${AWS_REGION:-us-east-1}"
DB_INSTANCE_ID="storysprout-db"
DB_NAME="storysprout"
DB_USER="storysprout_user"
DB_PASSWORD="${DB_PASSWORD:-}"

if [ -z "$DB_PASSWORD" ]; then
  echo "Error: Set DB_PASSWORD before running this script."
  echo "  export DB_PASSWORD=\$(openssl rand -hex 16)"
  exit 1
fi

echo ""
echo "=== Creating RDS PostgreSQL instance ==="
echo "Instance ID: $DB_INSTANCE_ID"
echo "Region:      $AWS_REGION"
echo ""

# Create a security group for RDS that allows inbound Postgres from anywhere
# (we'll lock this down further with App Runner VPC connector if needed)
VPC_ID=$(aws ec2 describe-vpcs \
  --filters "Name=is-default,Values=true" \
  --query "Vpcs[0].VpcId" \
  --output text \
  --region "$AWS_REGION")

echo "Using default VPC: $VPC_ID"

# Create security group for RDS
SG_ID=$(aws ec2 create-security-group \
  --group-name "storysprout-rds-sg" \
  --description "StorySprout RDS access" \
  --vpc-id "$VPC_ID" \
  --region "$AWS_REGION" \
  --query "GroupId" \
  --output text 2>/dev/null || \
  aws ec2 describe-security-groups \
    --filters "Name=group-name,Values=storysprout-rds-sg" \
    --query "SecurityGroups[0].GroupId" \
    --output text \
    --region "$AWS_REGION")

echo "Security group: $SG_ID"

# Allow Postgres from anywhere (App Runner has dynamic IPs)
aws ec2 authorize-security-group-ingress \
  --group-id "$SG_ID" \
  --protocol tcp \
  --port 5432 \
  --cidr 0.0.0.0/0 \
  --region "$AWS_REGION" 2>/dev/null || echo "Ingress rule already exists."

# Create RDS instance (free tier eligible: db.t3.micro, 20GB gp2)
echo ""
echo "Creating RDS instance (this takes ~5 minutes)..."
aws rds create-db-instance \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version "16" \
  --master-username "$DB_USER" \
  --master-user-password "$DB_PASSWORD" \
  --db-name "$DB_NAME" \
  --allocated-storage 20 \
  --storage-type gp2 \
  --no-multi-az \
  --publicly-accessible \
  --vpc-security-group-ids "$SG_ID" \
  --backup-retention-period 0 \
  --region "$AWS_REGION" \
  --no-deletion-protection \
  2>/dev/null || echo "RDS instance may already exist, checking status..."

echo ""
echo "Waiting for RDS to be available (grab a coffee, ~5 min)..."
aws rds wait db-instance-available \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --region "$AWS_REGION"

# Get the endpoint
ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier "$DB_INSTANCE_ID" \
  --query "DBInstances[0].Endpoint.Address" \
  --output text \
  --region "$AWS_REGION")

echo ""
echo "=== RDS ready! ==="
echo ""
echo "Endpoint: $ENDPOINT"
echo ""
echo "DATABASE_URL (save this for App Runner env vars):"
echo "  postgresql://$DB_USER:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME"
echo ""
echo "Run this to seed the database:"
echo "  DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME\" npx prisma migrate deploy"
echo "  DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@$ENDPOINT:5432/$DB_NAME\" npx prisma db seed"
