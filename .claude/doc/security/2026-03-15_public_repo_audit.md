# PUBLIC REPOSITORY SECURITY AUDIT - CRITICAL FINDINGS

**Date**: 2026-03-15 | **Repository**: Wippestoolen (now public on GitHub)

---

## STOP - ROTATE THESE CREDENTIALS IMMEDIATELY

The following production secrets are **confirmed publicly exposed in git history since August 2025** (7 months):

**JWT Secret Key** (in `new-task-def.json` and `.env.nas`/`.env.production` locally):
```
]:U*LTtdeld5&7(w4[%8(bEJ7K!!}Xov%6zPfbv0VN{e!OZ[-48+H$Q&w[-(zGES
```

**Production RDS Database Password** (in `new-task-def.json`, `task-def.json`, `add_prod_categories.py`):
```
Z4%ASK{S*mqY<DrFL36}4e*[X0Mx}9nw
(user: wippestoolen_user / wippestoolen_admin)
(host: wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com)
```

Anyone who cloned the repo can forge JWT tokens for any user and connect directly to the production database.

---

## Complete Findings Table

| # | Severity | File | Secret Type | In Git History |
|---|----------|------|-------------|----------------|
| F1 | **CRITICAL** | `infrastructure/.../new-task-def.json` | Production JWT SECRET_KEY (plaintext) | YES - since Aug 2025 |
| F2 | **CRITICAL** | `infrastructure/.../new-task-def.json` | Production DB password (full connection URL) | YES - since Aug 2025 |
| F3 | **CRITICAL** | `infrastructure/.../task-def.json` | Production DB password (full connection URL) | YES - since Aug 2025 |
| F4 | **CRITICAL** | `add_prod_categories.py` | Hardcoded production DB user + password | YES - tracked file |
| F5 | HIGH | `create_table_script.py` | Hardcoded production RDS hostname + credentials | YES - tracked/untracked |
| F6 | HIGH | `infrastructure/bootstrap/terraform.tfstate` | AWS Account ID, S3 bucket, DynamoDB table ARNs | YES |
| F7 | HIGH | `infrastructure/.../api-subdomain-setup/terraform.tfstate` | VPC ID, Subnet IDs, SG ID, ALB ARN, ACM cert ARN, Route53 Zone ID | YES |
| F8 | HIGH | `infrastructure/.../terraform.tfstate` | AWS infrastructure details | YES |
| F9 | MEDIUM | `infrastructure/.../terraform.tfvars` | Route53 Zone ID, prod config | YES |
| F10 | MEDIUM | `.env.nas` (untracked) | Cloudflare Tunnel Token, NAS DB password, JWT secret | NO - local only |
| F11 | MEDIUM | `.env.production` (untracked) | Same JWT secret + prod DB password | NO - local only |

---

## What Is Safe

- `.env`, `.env.development`, `.env.production`, `.env.deploy`, `.env.nas` - never committed (gitignored)
- Mobile app (`mobile/constants/config.ts`) - no hardcoded API keys
- Application source code (`wippestoolen/`) - uses environment variables correctly
- AWS credentials / IAM keys - none found anywhere
- SSH keys / certificates - none found

---

## Priority Action Plan

### Priority 1 - Do Right Now (within the hour)

1. **Rotate the JWT Secret Key** - generate new with `openssl rand -hex 32`, update in Portainer stack
2. **Rotate RDS production DB password** - via AWS RDS console, update in Portainer
3. **Revoke Cloudflare Tunnel Token** - in Cloudflare Zero Trust dashboard, recreate tunnel
4. **Verify RDS Security Group** - confirm port 5432 is NOT open to `0.0.0.0/0`

### Priority 2 - Do Today (history cleanup)

5. **Rewrite git history** to remove the sensitive files using `bfg` or `git filter-repo`:
   ```bash
   brew install bfg
   bfg --delete-files task-def.json --no-blob-protection
   bfg --delete-files new-task-def.json --no-blob-protection
   bfg --delete-files terraform.tfstate --no-blob-protection
   bfg --delete-files add_prod_categories.py --no-blob-protection
   git reflog expire --expire=now --all && git gc --prune=now --aggressive
   git push --force --all
   ```
   Then contact GitHub Support to request a cache purge.

6. **Untrack files without deleting from disk**:
   ```bash
   git rm --cached infrastructure/bootstrap/terraform.tfstate
   git rm --cached infrastructure/environments/production/terraform.tfstate
   git rm --cached infrastructure/environments/production/api-subdomain-setup/terraform.tfstate
   git rm --cached infrastructure/environments/production/api-subdomain-setup/task-def.json
   git rm --cached infrastructure/environments/production/api-subdomain-setup/new-task-def.json
   git rm --cached infrastructure/environments/production/terraform.tfvars
   git rm --cached add_prod_categories.py
   git rm --cached create_table_script.py
   git rm --cached production_test_results.json
   ```

### Priority 3 - Do This Week

7. Fix hardcoded credentials in scripts - use `os.environ.get()` instead
8. Add `.env.nas` to .gitignore
9. Install gitleaks pre-commit hook

### Priority 4 - Long Term

10. Enable GitHub Secret Scanning on repository settings
11. Review RDS CloudWatch logs for unauthorized access during exposure window

---

## AWS Infrastructure Exposed (in tfstate files)

- AWS Account ID: `142695682135`
- VPC ID: `vpc-02073097323eeb3e7`
- Security Group ID: `sg-02b6aa49541b102d4`
- RDS Endpoint: `wippestoolen-production.cvx466dfq2il.eu-central-1.rds.amazonaws.com`
- ALB DNS: `wippestoolen-production-alb-842123303.eu-central-1.elb.amazonaws.com`
- Route53 Zone ID: `Z0512940YC8V2DLW3ROB`
- ECR Repo: `142695682135.dkr.ecr.eu-central-1.amazonaws.com/wippestoolen-production`
- Terraform State Bucket: `wippestoolen-terraform-state-qy7taft8`

None of this gives direct access without credentials, but significantly lowers effort for targeted attacks.