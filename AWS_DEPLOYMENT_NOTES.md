# StorySprout — AWS Deployment Notes

## Current State

**Live URL:** http://100.29.183.209:3000 (IP changes if task restarts)

**Deployed infrastructure (us-east-1):**
- **ECR repository:** `985368780848.dkr.ecr.us-east-1.amazonaws.com/storysprout`
- **RDS Postgres:** `storysprout-db.cmby6aqyeyvf.us-east-1.rds.amazonaws.com` (db.t3.micro, free tier)
- **ECS cluster:** `storysprout`
- **ECS service:** `storysprout` (1 task, Fargate, 0.5 vCPU / 1 GB)
- **Task definition:** `storysprout:3` (latest)
- **CloudWatch log group:** `/ecs/storysprout`
- **Security groups:** `storysprout-rds-sg`, `storysprout-ecs-sg`

**Deploy scripts (in repo root):**
- `deploy.sh` — build + push image to ECR
- `deploy-rds.sh` — create RDS instance (already run, idempotent)
- `deploy-apprunner.sh` — unused (App Runner subscription failed)

## TODO

### 🔥 Cost control (do first when picking this back up)
- [ ] Scale ECS service to 0 when not in use:
  ```bash
  aws ecs update-service --cluster storysprout --service storysprout --desired-count 0 --region us-east-1
  ```
- [ ] Bring it back with `--desired-count 1`
- [ ] Fargate runs ~$0.013/hour (~$10/month if 24/7). RDS free tier first 12 months.

### 🔑 Security cleanup
- [ ] Rotate the access key used today (`AKIA6K3EOMAYDVW6NTRW`) — go to IAM → Security credentials → delete it, create new one
- [ ] Stop using root credentials. Create an IAM user `storysprout-deploy` with scoped policies (ECR, ECS, RDS, EC2/VPC).
- [ ] Move secrets out of task definition env vars and into AWS Secrets Manager. Reference them by ARN in the task def. Currently exposed: `DATABASE_URL`, `SESSION_SECRET`, `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`.

## Improvements (ordered by interview ROI)

### Highest ROI

1. **CI/CD with GitHub Actions** (~30 min)
   - Auto-build + push to ECR + update ECS service on push to `main`
   - Most impressive for Playlab interview — modern engineering practice
   - File: `.github/workflows/deploy.yml`
   - Use `aws-actions/configure-aws-credentials` + OIDC (no long-lived keys)

2. **AWS Secrets Manager** (~20 min)
   - Replace plaintext env vars in task definition with Secrets Manager references
   - Shows security awareness
   - Use `secrets` field in container definition instead of `environment`

3. **HTTPS + custom domain** (~1-2 hours, ~$16/month for ALB)
   - Application Load Balancer in front of ECS service
   - ACM (free SSL cert) attached to ALB listener
   - Route 53 hosted zone → A/ALIAS record pointing at ALB
   - Options for domain:
     - Subdomain off existing domain (free) — e.g. `storysprout.something.com`
     - New `.com` via Route 53 ($12/year) — e.g. `storysprout.app`
   - Note: HanLab subdomain works technically but feels off-brand

### Medium ROI

4. **S3 for story images** (~45 min)
   - Currently images saved to container disk → lost on restart
   - Swap `writeFile` in `image-engine.server.ts` for S3 PutObject
   - Serve via CloudFront (optional) or direct S3 URLs
   - Update DB-stored URLs to S3 paths

5. **Health check endpoint** (~10 min)
   - Add `/health` route returning 200 with DB ping
   - Wire into ECS task health check + ALB target group health check
   - Unhealthy tasks auto-restart

6. **CloudWatch dashboard + alarms** (~30 min)
   - Graph CPU/memory utilization, task count, RDS connections
   - Alarm: app down or 5xx rate spike → SNS topic → email
   - Demonstrates production thinking

### Lower ROI (skip unless curious)

7. **Multi-AZ RDS** — costs ~2x, only matters for real production traffic
8. **ECS auto-scaling** — no traffic to scale for yet
9. **CloudFront CDN in front of ALB** — only matters with global users
10. **Fix `prisma migrate deploy` at startup** — currently disabled in task def revision 3 because `prisma.config.ts` env loading didn't work in container. Workaround: run migrations manually before deploying.
11. **Stable public URL even without ALB** — could use Elastic IP + assign to task ENI, but ALB is the better path.

## Things I learned today

- **App Runner requires manual validation** for new AWS accounts (got an email ~10 min after first attempt). ECS Fargate works immediately.
- **RDS requires SSL** but presents AWS-signed certs that Node.js doesn't trust by default. Fix: `ssl: { rejectUnauthorized: false }` in `pg.Pool` config.
- **Shell variable expansion inside JSON heredocs** mangled `:latest` tag → had to write JSON to file with `cat > file.json <<EOF` and reference with `--cli-input-json file://...`
- **Fargate task definition `command` field** overrides the Dockerfile CMD — useful for environment-specific tweaks without rebuilding the image.
