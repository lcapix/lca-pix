# AWS Infrastructure Setup Guide - LCA Project v3 (Production-Ready with Ecoinvent Integration)

## Executive Summary

This guide provides a complete AWS infrastructure setup for LCA Project v3, including:
- **Database**: RDS MySQL/PostgreSQL for your 13-table schema
- **Caching**: ElastiCache Redis for Ecoinvent API response caching
- **Compute**: ECS Fargate for containerized Next.js application
- **Storage**: S3 for reports, backups, and static assets
- **CDN**: CloudFront for global distribution
- **API Integration**: Ecoinvent API proxy with caching strategy
- **Monitoring**: CloudWatch for comprehensive observability
- **Security**: Secrets Manager, WAF, IAM roles

**Estimated Monthly Cost**: $300-1,200/month (depending on traffic and Ecoinvent API usage)

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [AWS Services Breakdown](#2-aws-services-breakdown)
3. [Cost Estimation](#3-cost-estimation)
4. [Ecoinvent API Integration](#4-ecoinvent-api-integration)
5. [Setup Instructions](#5-setup-instructions)
6. [Security Configuration](#6-security-configuration)
7. [Monitoring & Alerts](#7-monitoring--alerts)
8. [Cost Optimization](#8-cost-optimization)

---

## 1. Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    USERS (Web Browsers)                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│            Route 53 DNS (lca-project.com)                        │
│                  Health Checks Enabled                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│              CloudFront CDN (Global Edge Caching)                │
│   - Static Assets (JS, CSS, Images)                             │
│   - SSL/TLS Termination                                          │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│           Application Load Balancer (ALB)                        │
│   - Health Checks on /api/health                                 │
│   - SSL Certificate (ACM)                                        │
│   - WAF Rules (Rate Limiting, DDoS Protection)                   │
└───────────┬───────────────────────────────┬─────────────────────┘
            │                               │
            ▼                               ▼
┌───────────────────────┐       ┌───────────────────────┐
│  ECS Fargate Task 1   │       │  ECS Fargate Task 2   │
│  (Next.js App)        │       │  (Next.js App)        │
│  - 1 vCPU, 2GB RAM    │       │  - Auto-scaling       │
└───────────┬───────────┘       └───────────┬───────────┘
            │                               │
            └───────────────┬───────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
        ▼                   ▼                   ▼
┌───────────────┐  ┌────────────────┐  ┌──────────────────┐
│  RDS MySQL    │  │ ElastiCache    │  │ S3 Buckets       │
│  - Primary    │  │ Redis          │  │ - Reports        │
│  - Multi-AZ   │  │ - Session      │  │ - Backups        │
│  - Backups    │  │ - API Cache    │  │ - Static Assets  │
└───────────────┘  └────────────────┘  └──────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │  Lambda Functions  │
                   │  (Ecoinvent Proxy) │
                   │  - API Caching     │
                   │  - Rate Limiting   │
                   └────────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │  Ecoinvent API     │
                   │  (External)        │
                   └────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│              Monitoring & Security Layer                         │
│  - CloudWatch (Logs, Metrics, Alarms)                           │
│  - Secrets Manager (API Keys, DB Credentials)                   │
│  - AWS WAF (Web Application Firewall)                           │
│  - CloudTrail (Audit Logging)                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 2. AWS Services Breakdown

### Core Services

#### **1. Amazon RDS (Relational Database Service)**

**Purpose**: Host your MySQL/PostgreSQL database with 13 tables

**Configuration Options**:

| Environment | Instance Type | Storage | Multi-AZ | Monthly Cost |
|-------------|---------------|---------|----------|--------------|
| **Development** | db.t3.small (2GB RAM) | 50GB GP3 | No | $45 |
| **Production (Small)** | db.t3.medium (4GB RAM) | 100GB GP3 | Yes | $180 |
| **Production (Large)** | db.r5.large (16GB RAM) | 500GB GP3 | Yes | $600 |

**Recommended for Production**:
```
Instance Class: db.t3.medium
vCPUs: 2
RAM: 4GB
Storage: 100GB GP3 (auto-scaling to 500GB)
Engine: MySQL 8.0 or PostgreSQL 15
Multi-AZ: Yes (high availability)
Backup Retention: 7 days
Read Replicas: 1 (for reporting queries)
Performance Insights: Enabled (7-day retention)
Enhanced Monitoring: 60-second granularity
```

**Why RDS over self-managed?**
- Automated backups and point-in-time recovery
- Automatic minor version upgrades
- Multi-AZ failover in ~60 seconds
- Performance Insights for query optimization
- Managed scaling and maintenance

---

#### **2. Amazon ElastiCache for Redis**

**Purpose**: Critical for caching Ecoinvent API responses (saves $$$)

**Configuration Options**:

| Environment | Node Type | Nodes | Cache Size | Monthly Cost |
|-------------|-----------|-------|------------|--------------|
| **Development** | cache.t3.micro | 1 | 0.5GB | $15 |
| **Production (Small)** | cache.t3.medium | 2 | 3.09GB | $85 |
| **Production (Large)** | cache.r5.large | 3 | 13.07GB | $350 |

**Recommended for Production**:
```
Node Type: cache.t3.medium
Number of Nodes: 2 (primary + replica)
Engine: Redis 7.0+
Automatic Failover: Enabled
Encryption at Rest: Yes
Encryption in Transit: Yes
Multi-AZ: Yes
```

**Cache Strategy for Ecoinvent API**:
```javascript
// Cache hierarchy
Level 1: Redis (7 days) - Hot cache for frequently accessed data
Level 2: DynamoDB (1 year) - Warm cache for occasional access
Level 3: Ecoinvent API - Cold (only on cache miss)

// Expected cache hit rate: 90-95%
// Example: 10,000 requests → 500-1,000 API calls
// Savings: $50-95/month (at $0.01/request)
```

---

#### **3. Amazon ECS with Fargate**

**Purpose**: Run your Next.js application in containers (serverless)

**Configuration Options**:

| Environment | vCPU | RAM | Containers | Monthly Cost |
|-------------|------|-----|------------|--------------|
| **Development** | 0.5 | 1GB | 1 | $30 |
| **Production (Small)** | 1 | 2GB | 2-4 | $90-180 |
| **Production (Large)** | 2 | 4GB | 4-10 | $300-750 |

**Recommended for Production**:
```
Task Definition:
  - vCPU: 1
  - Memory: 2GB
  - Container Port: 3000

Service:
  - Desired Count: 2 (minimum for high availability)
  - Auto Scaling: 2-10 tasks
  - Scale Up Trigger: CPU > 70% or Request Count > 1000/min
  - Scale Down Trigger: CPU < 30% for 10 minutes

Launch Type: FARGATE (no server management)
Network Mode: awsvpc
```

**Why Fargate over EC2?**
- No server management (no SSH, no patching)
- Pay only for running containers (per second billing)
- Automatic scaling without managing cluster
- Better resource utilization

---

#### **4. Amazon S3 (Simple Storage Service)**

**Purpose**: Store reports, backups, static assets

**Bucket Structure**:
```
lca-project-static-assets/
  ├── css/
  ├── js/
  ├── images/
  └── fonts/

lca-project-user-data/
  ├── reports/
  │   ├── pdf/        # Assessment reports
  │   └── excel/      # Data exports
  └── temp-uploads/   # Temporary file uploads

lca-project-backups/
  ├── database/       # RDS snapshots
  ├── audit-logs/     # Compliance logs
  └── dr-copies/      # Disaster recovery

lca-project-ecoinvent-cache/
  └── long-term/      # Archived API responses
```

**Storage Classes & Lifecycle**:
```
Static Assets: Standard (frequent access)
User Reports: Standard → Intelligent-Tiering after 30 days
Backups: Standard → Glacier after 30 days → Deep Archive after 90 days
Temp Uploads: Delete after 7 days
```

**Estimated Storage & Cost**:
```
Development: 10GB → $0.23/month
Production (Small): 100GB → $2.30/month
Production (Large): 500GB → $11.50/month
```

---

#### **5. Amazon CloudFront (CDN)**

**Purpose**: Global content delivery, reduce latency, protect origin

**Configuration**:
```
Origins:
  1. S3 bucket (static assets)
  2. ALB (dynamic API requests)

Behaviors:
  /assets/*     → S3 origin (cache for 1 year)
  /api/*        → ALB origin (no caching)
  /*            → ALB origin (cache for 5 minutes)

Cache Settings:
  - Static files (CSS, JS, images): 31536000 seconds (1 year)
  - HTML pages: 300 seconds (5 minutes)
  - API responses: No caching

Security:
  - HTTPS only (TLS 1.2+)
  - Geo-restrictions: Optional
  - AWS WAF integration: Yes
```

**Cost Estimate**:
```
Data Transfer Out:
  - First 10TB: $0.085/GB
  - 10TB-50TB: $0.080/GB

Expected Usage:
  - Small: 500GB/month → $42.50
  - Medium: 2TB/month → $170
  - Large: 5TB/month → $425
```

---

#### **6. Application Load Balancer (ALB)**

**Purpose**: Distribute traffic across ECS tasks, SSL termination

**Configuration**:
```
Scheme: Internet-facing
IP Address Type: IPv4
Listeners:
  - HTTP (80) → Redirect to HTTPS
  - HTTPS (443) → Forward to ECS target group

Target Group:
  - Protocol: HTTP
  - Port: 3000
  - Health Check Path: /api/health
  - Health Check Interval: 30 seconds
  - Healthy Threshold: 2 consecutive successes
  - Unhealthy Threshold: 3 consecutive failures

Sticky Sessions: Enabled (cookie-based, 1 hour)

SSL Certificate: AWS Certificate Manager (ACM) - FREE
```

**Cost**:
```
Base: $16.20/month (730 hours)
LCU (Load Balancer Capacity Units): $0.008/hour
  - Small traffic: $8/month
  - Medium traffic: $25/month
  - Large traffic: $80/month

Total: $24-96/month
```

---

#### **7. AWS Lambda (Optional but Recommended)**

**Purpose**: Ecoinvent API proxy with intelligent caching

**Use Cases**:
1. Ecoinvent API proxy (add caching, rate limiting)
2. Scheduled tasks (daily data sync, cleanup jobs)
3. Webhooks (assessment completion notifications)
4. Heavy calculations (offload from ECS)

**Lambda Function: Ecoinvent Proxy**
```javascript
// Lambda configuration
Runtime: Node.js 20.x
Memory: 512MB
Timeout: 30 seconds
Concurrent Executions: 10 (reserved)
Environment Variables:
  - REDIS_URL: (from Secrets Manager)
  - ECOINVENT_API_KEY: (from Secrets Manager)
```

**Cost**:
```
Requests: $0.20 per 1M requests
Duration: $0.0000166667 per GB-second

Example (10,000 API calls/month):
  - Requests: 10,000 × $0.0000002 = $0.002
  - Duration: 10,000 × 0.5 seconds × 0.5GB × $0.0000166667 = $0.042
  - Total: ~$0.05/month

FREE TIER: 1M requests/month + 400,000 GB-seconds/month
```

---

#### **8. AWS Secrets Manager**

**Purpose**: Securely store API keys, database credentials

**Secrets to Store**:
```json
{
  "lca/database-credentials": {
    "host": "lca-db.xxxxx.rds.amazonaws.com",
    "port": 3306,
    "username": "lcaadmin",
    "password": "auto-generated-secure-password",
    "database": "lca_production"
  },
  "lca/redis-url": {
    "url": "redis://lca-redis.xxxxx.cache.amazonaws.com:6379"
  },
  "lca/ecoinvent-api": {
    "api_key": "your-ecoinvent-api-key",
    "username": "your-ecoinvent-username",
    "password": "your-ecoinvent-password",
    "base_url": "https://ecoinvent.org/api/v3"
  },
  "lca/jwt-secret": {
    "secret": "auto-generated-256-bit-key"
  },
  "lca/session-secret": {
    "secret": "auto-generated-256-bit-key"
  }
}
```

**Cost**:
```
Storage: $0.40/secret/month
API Calls: $0.05 per 10,000 calls

Estimated (5 secrets, 50,000 API calls/month):
  - Storage: 5 × $0.40 = $2.00
  - API Calls: 5 × $0.05 = $0.25
  - Total: $2.25/month
```

**Benefits**:
- Automatic rotation for database credentials
- Encrypted at rest (AWS KMS)
- Fine-grained access control (IAM)
- Audit trail (CloudTrail)

---

#### **9. Amazon CloudWatch**

**Purpose**: Logging, monitoring, alerting

**Components**:

**A. CloudWatch Logs**
```
Log Groups:
  /ecs/lca-project              # Application logs
  /aws/rds/instance/lca-db      # Database logs
  /aws/lambda/ecoinvent-proxy   # Lambda logs
  /aws/cloudfront/lca-cdn       # CDN access logs

Retention: 30 days (configurable)
```

**B. CloudWatch Metrics**
```
Default Metrics (FREE):
  - ECS: CPUUtilization, MemoryUtilization
  - RDS: CPUUtilization, DatabaseConnections, FreeStorageSpace
  - ALB: RequestCount, TargetResponseTime, HTTPCode_Target_5XX_Count
  - ElastiCache: CPUUtilization, CacheHits, CacheMisses

Custom Metrics:
  - API response time (p50, p95, p99)
  - Ecoinvent API call count
  - Cache hit rate
  - Assessment calculation time
```

**C. CloudWatch Alarms**
```
Critical Alarms (immediate action required):
  1. ECS CPU > 90% for 5 minutes
  2. RDS CPU > 90% for 5 minutes
  3. RDS Storage < 5GB
  4. ALB 5xx errors > 10 in 5 minutes
  5. ECS task count = 0 (all containers crashed)

Warning Alarms (investigate soon):
  6. ECS Memory > 80% for 10 minutes
  7. RDS Connections > 80% of max
  8. ElastiCache Cache Miss Rate > 50%
  9. Slow API responses (p95 > 2 seconds)
  10. Daily API cost > $50
```

**Cost**:
```
Logs: $0.50/GB ingested + $0.03/GB stored
Metrics: First 10 custom metrics free, then $0.30/metric/month
Alarms: First 10 free, then $0.10/alarm/month

Estimated (20GB logs, 20 custom metrics, 15 alarms):
  - Logs: 20 × $0.50 + 20 × $0.03 = $10.60
  - Metrics: 10 × $0.30 = $3.00
  - Alarms: 5 × $0.10 = $0.50
  - Total: $14.10/month
```

---

#### **10. AWS WAF (Web Application Firewall)**

**Purpose**: Protect against common web attacks

**Rules to Implement**:
```
1. Rate Limiting: 2,000 requests per 5 minutes per IP
2. SQL Injection Protection: Block common SQL injection patterns
3. XSS Protection: Block cross-site scripting attempts
4. Known Bad IPs: Block IPs from threat intelligence feeds
5. Geo-blocking (optional): Allow only specific countries
```

**Cost**:
```
Base: $5/month
Rules: $1/rule/month × 5 = $5/month
Requests: $0.60 per 1 million requests

Estimated (1M requests/month):
  - Base + Rules: $10
  - Requests: $0.60
  - Total: $10.60/month
```

---

#### **11. Amazon Route 53 (DNS)**

**Purpose**: Domain management, health checks, routing

**Configuration**:
```
Hosted Zone: lca-project.com

Records:
  A Record: @ → CloudFront distribution
  A Record: www → CloudFront distribution
  A Record: api → ALB (if separate API domain)
  CNAME: cdn → CloudFront domain

Health Check:
  - Type: HTTPS
  - Domain: lca-project.com
  - Path: /api/health
  - Interval: 30 seconds
  - Failure Threshold: 3
  - Action: SNS notification
```

**Cost**:
```
Hosted Zone: $0.50/month
Queries: $0.40 per 1 million queries (first 1 billion)
Health Check: $0.50/month

Estimated:
  - Hosted Zone: $0.50
  - Queries (1M): $0.40
  - Health Check: $0.50
  - Total: $1.40/month
```

---

#### **12. AWS Certificate Manager (ACM)**

**Purpose**: Free SSL/TLS certificates

**Configuration**:
```
Domain: lca-project.com
Subject Alternative Names:
  - *.lca-project.com
  - www.lca-project.com

Validation: DNS (automatic via Route 53)
Renewal: Automatic (before expiration)

Cost: FREE (when used with CloudFront, ALB, API Gateway)
```

---

## 3. Cost Estimation

### Development Environment

**Target**: Testing, staging, low traffic (<100 users)

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| **ECS Fargate** | 0.5 vCPU, 1GB RAM, 1 task, 50% uptime | $15 |
| **RDS MySQL** | db.t3.small, 50GB, Single-AZ | $45 |
| **ElastiCache** | cache.t3.micro, 1 node | $15 |
| **S3** | 10GB storage + 50GB transfer | $2 |
| **CloudFront** | 50GB data transfer | $5 |
| **ALB** | Basic usage | $24 |
| **Route 53** | 1 hosted zone + health check | $1.50 |
| **Secrets Manager** | 5 secrets | $2.25 |
| **CloudWatch** | 5GB logs, 5 alarms | $5 |
| **Ecoinvent API** | 500 requests/month (90% cached) | $5 |
| **NAT Gateway** | For private subnets | $35 |
| **Data Transfer** | Minimal | $5 |
| **TOTAL DEVELOPMENT** | | **~$159.75/month** |

**Optimization for Dev**:
- Shut down RDS during non-working hours (save $20/month)
- Use 1 AZ instead of Multi-AZ
- No read replicas
- Smaller cache size

**Optimized Dev Cost**: ~$120-140/month

---

### Production Environment (Small)

**Target**: 500-1,000 active users, 50-100 concurrent users

**Assumptions**:
- 1 million page views/month
- 100,000 API requests/month
- 10,000 LCA assessments/month
- 5,000 Ecoinvent API requests/month (95% cache hit rate)

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| **ECS Fargate** | 1 vCPU, 2GB RAM, 2-4 tasks (auto-scale) | $120 |
| **RDS MySQL** | db.t3.medium, 100GB GP3, Multi-AZ | $180 |
| **RDS Read Replica** | db.t3.medium, 100GB GP3 | $90 |
| **ElastiCache** | cache.t3.medium, 2 nodes (replica) | $85 |
| **S3** | 100GB storage, 500GB transfer | $15 |
| **CloudFront** | 1TB data transfer, 5M requests | $95 |
| **ALB** | 1M LCU-hours | $40 |
| **Route 53** | 1 hosted zone, 5M queries | $3 |
| **ACM** | SSL certificate | FREE |
| **Secrets Manager** | 10 secrets, 100K API calls | $5 |
| **CloudWatch** | 20GB logs, 20 metrics, 15 alarms | $15 |
| **AWS WAF** | 5 rules, 1M requests | $11 |
| **Lambda** | 10,000 invocations/month | $0.50 |
| **NAT Gateway** | 2 AZs, moderate bandwidth | $70 |
| **Data Transfer** | Out to internet | $50 |
| **Ecoinvent API** | 5,000 requests @ $0.01/request | $50 |
| **Backup Storage** | 200GB (RDS + S3 snapshots) | $20 |
| **TOTAL PRODUCTION (SMALL)** | | **~$849.50/month** |

**Annual Cost**: ~$10,194

---

### Production Environment (Medium)

**Target**: 5,000-10,000 active users, 500 concurrent users

**Assumptions**:
- 10 million page views/month
- 1 million API requests/month
- 50,000 LCA assessments/month
- 25,000 Ecoinvent API requests/month (95% cache hit rate)

| Service | Configuration | Monthly Cost |
|---------|---------------|--------------|
| **ECS Fargate** | 2 vCPU, 4GB RAM, 4-8 tasks (auto-scale) | $400 |
| **RDS MySQL** | db.r5.large, 500GB GP3, Multi-AZ | $600 |
| **RDS Read Replicas** | 2× db.r5.large | $600 |
| **ElastiCache** | cache.r5.large, 3 nodes (cluster mode) | $350 |
| **S3** | 500GB storage, 2TB transfer | $80 |
| **CloudFront** | 5TB data transfer, 50M requests | $450 |
| **ALB** | 10M LCU-hours | $90 |
| **Route 53** | 1 hosted zone, 50M queries | $20 |
| **Secrets Manager** | 15 secrets, 500K API calls | $10 |
| **CloudWatch** | 100GB logs, 50 metrics, 30 alarms | $65 |
| **AWS WAF** | 10 rules, 10M requests | $21 |
| **Lambda** | 50,000 invocations/month | $2 |
| **NAT Gateway** | 2 AZs, high bandwidth | $120 |
| **Data Transfer** | Out to internet | $200 |
| **Ecoinvent API** | 25,000 requests @ $0.01/request | $250 |
| **Backup Storage** | 1TB (RDS + S3 snapshots) | $100 |
| **TOTAL PRODUCTION (MEDIUM)** | | **~$3,358/month** |

**Annual Cost**: ~$40,296

---

### Cost Breakdown by Category

| Category | Dev | Prod (Small) | Prod (Medium) |
|----------|-----|--------------|---------------|
| **Compute (ECS)** | $15 | $120 | $400 |
| **Database (RDS)** | $45 | $270 | $1,200 |
| **Cache (Redis)** | $15 | $85 | $350 |
| **Storage (S3)** | $2 | $15 | $80 |
| **CDN (CloudFront)** | $5 | $95 | $450 |
| **Networking (ALB, NAT, Transfer)** | $64 | $160 | $410 |
| **Monitoring & Security** | $7.25 | $31 | $96 |
| **External APIs (Ecoinvent)** | $5 | $50 | $250 |
| **Other (Route 53, Secrets, etc.)** | $6.50 | $23.50 | $122 |
| **TOTAL** | **$159.75** | **$849.50** | **$3,358** |

---

## 4. Ecoinvent API Integration

### Understanding Ecoinvent API Costs

**Ecoinvent Pricing** (estimated - contact Ecoinvent for actual pricing):

| Tier | Monthly Requests | Cost/Month | Cost per Request |
|------|------------------|------------|------------------|
| **Academic** | Up to 10,000 | $0-100 | $0-0.01 |
| **Basic** | Up to 50,000 | $100-500 | $0.002-0.01 |
| **Professional** | Up to 500,000 | $500-2,000 | $0.001-0.004 |
| **Enterprise** | Unlimited | Custom | Negotiated |

**Important Notes**:
- Actual pricing depends on access level (database version, datasets)
- Academic/educational users get significant discounts
- Commercial use is more expensive
- Some data may require one-time purchase + API access

---

### Caching Strategy (CRITICAL for Cost Savings)

**Problem**:
- Without caching: 100,000 requests/month × $0.01 = **$1,000/month**
- With 95% cache hit rate: 5,000 requests/month × $0.01 = **$50/month**
- **Savings: $950/month = $11,400/year**

**3-Tier Caching Strategy**:

```
┌─────────────────────────────────────────────────────────────────┐
│                    User Request for Impact Data                  │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
                   ┌────────────────────┐
                   │ Check In-Memory    │ ← Level 0: App Memory Cache
                   │ Cache (5 minutes)  │    (No cost, instant)
                   └─────────┬──────────┘
                             │ Cache Miss
                             ▼
                   ┌────────────────────┐
                   │ Check Redis Cache  │ ← Level 1: Redis (Hot Cache)
                   │ (7 days TTL)       │    (~1ms latency)
                   └─────────┬──────────┘
                             │ Cache Miss
                             ▼
                   ┌────────────────────┐
                   │ Check DynamoDB     │ ← Level 2: DynamoDB (Warm Cache)
                   │ (1 year TTL)       │    (~50ms latency)
                   └─────────┬──────────┘
                             │ Cache Miss
                             ▼
                   ┌────────────────────┐
                   │ Call Ecoinvent API │ ← Level 3: External API (Cold)
                   │ (Real Cost)        │    (~500ms latency, $$)
                   └─────────┬──────────┘
                             │
                             ▼
                   ┌────────────────────┐
                   │ Update All Caches  │
                   │ Return to User     │
                   └────────────────────┘
```

**Expected Cache Hit Rates**:
- Level 0 (In-Memory): 60-70% of requests
- Level 1 (Redis): 25-30% of requests
- Level 2 (DynamoDB): 3-5% of requests
- Level 3 (Ecoinvent API): 1-5% of requests (95-99% cache hit rate overall)

---

### Implementation: Ecoinvent API Proxy Lambda

**File**: `lambda/ecoinvent-proxy.js`

```javascript
const AWS = require('aws-sdk');
const axios = require('axios');
const { createClient } = require('redis');

// AWS clients
const secretsManager = new AWS.SecretsManager();
const dynamoDB = new AWS.DynamoDB.DocumentClient();
const cloudwatch = new AWS.CloudWatch();

// Redis client (persistent across Lambda invocations)
let redisClient;

// Get Ecoinvent credentials from Secrets Manager
async function getEcoinventCredentials() {
  const secret = await secretsManager.getSecretValue({
    SecretId: 'lca/ecoinvent-api'
  }).promise();

  return JSON.parse(secret.SecretString);
}

// Initialize Redis connection
async function getRedisClient() {
  if (!redisClient) {
    const redisUrl = process.env.REDIS_URL;
    redisClient = createClient({ url: redisUrl });
    await redisClient.connect();
  }
  return redisClient;
}

// Log metrics to CloudWatch
async function logMetrics(cacheType, requestCount, cost) {
  await cloudwatch.putMetricData({
    Namespace: 'LCA/Ecoinvent',
    MetricData: [
      {
        MetricName: 'CacheHit',
        Value: cacheType !== 'API' ? 1 : 0,
        Unit: 'Count',
        Dimensions: [{ Name: 'CacheType', Value: cacheType }]
      },
      {
        MetricName: 'ApiCost',
        Value: cost,
        Unit: 'None'
      }
    ]
  }).promise();
}

exports.handler = async (event) => {
  const startTime = Date.now();

  try {
    const {
      substanceName,
      impactCategory,
      geographicRegion = 'global'
    } = JSON.parse(event.body);

    // Generate cache key
    const cacheKey = `ecoinvent:${substanceName}:${impactCategory}:${geographicRegion}`;

    // --- LEVEL 1: Check Redis Cache (7-day TTL) ---
    const redis = await getRedisClient();
    const cachedData = await redis.get(cacheKey);

    if (cachedData) {
      console.log('✅ Redis cache HIT');
      await logMetrics('Redis', 1, 0);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT-Redis',
          'X-Response-Time': `${Date.now() - startTime}ms`
        },
        body: cachedData
      };
    }

    console.log('❌ Redis cache MISS');

    // --- LEVEL 2: Check DynamoDB Cache (1-year TTL) ---
    const dbResult = await dynamoDB.get({
      TableName: 'EcoinventCache',
      Key: { cacheKey }
    }).promise();

    if (dbResult.Item && dbResult.Item.expiresAt > Date.now()) {
      console.log('✅ DynamoDB cache HIT');
      const data = dbResult.Item.data;

      // Repopulate Redis cache
      await redis.set(cacheKey, JSON.stringify(data), {
        EX: 604800 // 7 days
      });

      await logMetrics('DynamoDB', 1, 0);

      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'X-Cache': 'HIT-DynamoDB',
          'X-Response-Time': `${Date.now() - startTime}ms`
        },
        body: JSON.stringify(data)
      };
    }

    console.log('❌ DynamoDB cache MISS');

    // --- LEVEL 3: Fetch from Ecoinvent API ---
    console.log('🌐 Fetching from Ecoinvent API');

    const credentials = await getEcoinventCredentials();

    const response = await axios.get(`${credentials.base_url}/datasets`, {
      params: {
        substance: substanceName,
        impact_category: impactCategory,
        geographic_region: geographicRegion
      },
      headers: {
        'Authorization': `Bearer ${credentials.api_key}`,
        'User-Agent': 'LCA-Project-v3',
        'Accept': 'application/json'
      },
      timeout: 10000 // 10-second timeout
    });

    const data = response.data;
    const apiCost = 0.01; // $0.01 per request (estimate)

    // --- Cache in Redis (7 days) ---
    await redis.set(cacheKey, JSON.stringify(data), {
      EX: 604800
    });

    // --- Cache in DynamoDB (1 year) ---
    await dynamoDB.put({
      TableName: 'EcoinventCache',
      Item: {
        cacheKey,
        data,
        substanceName,
        impactCategory,
        geographicRegion,
        createdAt: Date.now(),
        expiresAt: Date.now() + (365 * 24 * 60 * 60 * 1000) // 1 year
      }
    }).promise();

    // --- Log API usage for cost tracking ---
    await dynamoDB.put({
      TableName: 'ApiUsageLog',
      Item: {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        service: 'ecoinvent',
        substanceName,
        impactCategory,
        geographicRegion,
        cost: apiCost,
        responseTime: Date.now() - startTime
      }
    }).promise();

    await logMetrics('API', 1, apiCost);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'MISS',
        'X-Response-Time': `${Date.now() - startTime}ms`
      },
      body: JSON.stringify(data)
    };

  } catch (error) {
    console.error('❌ Error:', error);

    // Log error to DynamoDB
    await dynamoDB.put({
      TableName: 'ApiErrorLog',
      Item: {
        id: `${Date.now()}-${Math.random()}`,
        timestamp: Date.now(),
        error: error.message,
        stack: error.stack,
        requestBody: event.body
      }
    }).promise();

    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: 'Failed to fetch data from Ecoinvent',
        message: error.message
      })
    };
  }
};
```

---

### DynamoDB Tables for Caching

**Table 1: EcoinventCache** (long-term cache)

```javascript
// Create table via AWS CLI
aws dynamodb create-table \
  --table-name EcoinventCache \
  --attribute-definitions \
    AttributeName=cacheKey,AttributeType=S \
  --key-schema \
    AttributeName=cacheKey,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --table-class STANDARD_INFREQUENT_ACCESS
```

**Schema**:
```javascript
{
  cacheKey: "ecoinvent:Electricity:GlobalWarming:US",
  data: { /* Ecoinvent API response */ },
  substanceName: "Electricity",
  impactCategory: "GlobalWarming",
  geographicRegion: "US",
  createdAt: 1705536000000,
  expiresAt: 1737072000000 // 1 year later
}
```

**Cost**: $0.25/GB/month (Standard-IA class) + $1.25 per million read requests

---

**Table 2: ApiUsageLog** (cost tracking)

```javascript
// Create table
aws dynamodb create-table \
  --table-name ApiUsageLog \
  --attribute-definitions \
    AttributeName=id,AttributeType=S \
    AttributeName=timestamp,AttributeType=N \
  --key-schema \
    AttributeName=id,KeyType=HASH \
  --global-secondary-indexes \
    '[{
      "IndexName": "timestamp-index",
      "KeySchema": [{"AttributeName": "timestamp", "KeyType": "HASH"}],
      "Projection": {"ProjectionType": "ALL"}
    }]' \
  --billing-mode PAY_PER_REQUEST
```

**Schema**:
```javascript
{
  id: "1705536000000-0.123456",
  timestamp: 1705536000000,
  service: "ecoinvent",
  substanceName: "Electricity",
  impactCategory: "GlobalWarming",
  cost: 0.01,
  responseTime: 523
}
```

---

### Usage from Next.js Application

**File**: `lib/ecoinvent.ts`

```typescript
import axios from 'axios';

const LAMBDA_ENDPOINT = process.env.ECOINVENT_LAMBDA_URL;

interface EcoinventRequest {
  substanceName: string;
  impactCategory: string;
  geographicRegion?: string;
}

interface EcoinventResponse {
  substance: string;
  impactFactor: number;
  unit: string;
  dataQuality: string;
}

export async function fetchImpactFactor(
  request: EcoinventRequest
): Promise<EcoinventResponse> {
  try {
    const response = await axios.post(LAMBDA_ENDPOINT, request, {
      headers: {
        'Content-Type': 'application/json'
      },
      timeout: 30000 // 30-second timeout (includes Lambda cold start)
    });

    // Log cache performance
    const cacheStatus = response.headers['x-cache'];
    const responseTime = response.headers['x-response-time'];

    console.log(`Ecoinvent API: ${cacheStatus} (${responseTime})`);

    return response.data;
  } catch (error) {
    console.error('Failed to fetch impact factor:', error);

    // Fallback to default/cached value if available
    throw new Error('Unable to fetch impact factor from Ecoinvent');
  }
}

// Batch request for multiple substances
export async function fetchMultipleImpactFactors(
  requests: EcoinventRequest[]
): Promise<EcoinventResponse[]> {
  const promises = requests.map(req => fetchImpactFactor(req));

  // Execute in parallel
  return Promise.all(promises);
}
```

---

### Pre-loading Common Substances

To reduce API calls even further, pre-load common substances into your database:

**Script**: `scripts/preload-ecoinvent-data.ts`

```typescript
import { fetchImpactFactor } from '../lib/ecoinvent';
import db from '../lib/database';

const COMMON_SUBSTANCES = [
  'Electricity, medium voltage, at grid',
  'Steel, low-alloyed, at plant',
  'Concrete, normal, at plant',
  'Transport, freight, lorry',
  'Natural gas, burned in industrial furnace',
  'Diesel, burned in diesel-electric generating set',
  'Aluminium, primary, at plant',
  'Polypropylene, granulate, at plant',
  'Water, cooling, unspecified natural origin',
  // ... add 50-100 common substances
];

const IMPACT_CATEGORIES = [
  'GlobalWarming',
  'OzoneDepletion',
  'Acidification',
  'Eutrophication',
  'SmogFormation',
  // ... all categories from your schema
];

const REGIONS = ['global', 'US', 'EU', 'Asia'];

async function preloadData() {
  console.log('🚀 Starting Ecoinvent data pre-loading...');

  let totalCalls = 0;
  let cachedCalls = 0;

  for (const substance of COMMON_SUBSTANCES) {
    for (const category of IMPACT_CATEGORIES) {
      for (const region of REGIONS) {
        try {
          const data = await fetchImpactFactor({
            substanceName: substance,
            impactCategory: category,
            geographicRegion: region
          });

          // Store in database
          await db.query(`
            INSERT INTO driver_impact_factors
            (driver_name, category_id, impact_factor, geographic_region, data_source)
            VALUES (?, ?, ?, ?, 'ecoinvent')
            ON DUPLICATE KEY UPDATE
              impact_factor = VALUES(impact_factor),
              updated_at = NOW()
          `, [substance, getCategoryId(category), data.impactFactor, region]);

          totalCalls++;

          if (totalCalls % 10 === 0) {
            console.log(`✅ Processed ${totalCalls} combinations...`);
          }

        } catch (error) {
          console.error(`❌ Failed: ${substance} - ${category} - ${region}`);
        }

        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  }

  console.log(`✅ Pre-loading complete!`);
  console.log(`Total API calls: ${totalCalls}`);
  console.log(`Estimated cost: $${(totalCalls * 0.01).toFixed(2)}`);
}

// Run monthly to update data
preloadData();
```

**Benefits of Pre-loading**:
- Reduces real-time API calls by 80-90%
- Instant response time (no API latency)
- Works offline (if Ecoinvent API is down)
- One-time cost (run monthly): ~$50-100

---

### Cost Monitoring Dashboard

Create a CloudWatch dashboard to track Ecoinvent API costs:

```javascript
// CloudWatch Dashboard configuration
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "title": "Ecoinvent API Calls (Last 24 Hours)",
        "metrics": [
          ["LCA/Ecoinvent", "CacheHit", { "stat": "Sum", "label": "Cached" }],
          [".", "ApiCost", { "stat": "Sum", "label": "API Calls ($)" }]
        ],
        "period": 300,
        "region": "us-east-1"
      }
    },
    {
      "type": "metric",
      "properties": {
        "title": "Cache Hit Rate",
        "metrics": [
          ["LCA/Ecoinvent", "CacheHit", { "stat": "Average" }]
        ],
        "yAxis": {
          "left": { "min": 0, "max": 100 }
        }
      }
    }
  ]
}
```

**Set up cost alarm**:
```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "Ecoinvent-Daily-Cost-High" \
  --alarm-description "Alert when daily Ecoinvent API cost exceeds $20" \
  --metric-name ApiCost \
  --namespace LCA/Ecoinvent \
  --statistic Sum \
  --period 86400 \
  --threshold 20 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:us-east-1:123456789012:alert-topic
```

---

## 5. Setup Instructions

### Phase 1: Prerequisites (30 minutes)

#### 1. AWS Account Setup
```bash
# Create AWS account at aws.amazon.com
# Enable MFA on root account
# Create IAM admin user for daily operations
```

#### 2. Install AWS CLI
```bash
# macOS
brew install awscli

# Linux
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Configure AWS CLI
aws configure
# Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
```

#### 3. Install Docker
```bash
# macOS: Download Docker Desktop
# Linux:
sudo apt-get update
sudo apt-get install docker.io docker-compose
```

---

### Phase 2: Networking Setup (1 hour)

#### 4. Create VPC and Subnets

**Option A: Use AWS Console (Recommended for beginners)**
- Go to VPC Console → Create VPC
- Use "VPC and more" wizard
- Select "VPC, subnets, NAT Gateway, etc."
- CIDR: 10.0.0.0/16
- 2 Availability Zones
- 2 public subnets, 2 private subnets
- 1 NAT Gateway per AZ

**Option B: Use AWS CLI**
```bash
# Create VPC
VPC_ID=$(aws ec2 create-vpc --cidr-block 10.0.0.0/16 --tag-specifications 'ResourceType=vpc,Tags=[{Key=Name,Value=lca-vpc}]' --query 'Vpc.VpcId' --output text)

# Enable DNS hostnames
aws ec2 modify-vpc-attribute --vpc-id $VPC_ID --enable-dns-hostnames

# Create Internet Gateway
IGW_ID=$(aws ec2 create-internet-gateway --tag-specifications 'ResourceType=internet-gateway,Tags=[{Key=Name,Value=lca-igw}]' --query 'InternetGateway.InternetGatewayId' --output text)
aws ec2 attach-internet-gateway --vpc-id $VPC_ID --internet-gateway-id $IGW_ID

# Create public subnets
PUBLIC_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.1.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=lca-public-1a}]' --query 'Subnet.SubnetId' --output text)
PUBLIC_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.2.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=lca-public-1b}]' --query 'Subnet.SubnetId' --output text)

# Create private subnets
PRIVATE_SUBNET_1=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.11.0/24 --availability-zone us-east-1a --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=lca-private-1a}]' --query 'Subnet.SubnetId' --output text)
PRIVATE_SUBNET_2=$(aws ec2 create-subnet --vpc-id $VPC_ID --cidr-block 10.0.12.0/24 --availability-zone us-east-1b --tag-specifications 'ResourceType=subnet,Tags=[{Key=Name,Value=lca-private-1b}]' --query 'Subnet.SubnetId' --output text)

# Create NAT Gateway (one per AZ for high availability)
EIP_1=$(aws ec2 allocate-address --domain vpc --query 'AllocationId' --output text)
NAT_GW_1=$(aws ec2 create-nat-gateway --subnet-id $PUBLIC_SUBNET_1 --allocation-id $EIP_1 --tag-specifications 'ResourceType=natgateway,Tags=[{Key=Name,Value=lca-nat-1a}]' --query 'NatGateway.NatGatewayId' --output text)

# Wait for NAT Gateway to become available
aws ec2 wait nat-gateway-available --nat-gateway-ids $NAT_GW_1

# Create route tables
PUBLIC_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=lca-public-rt}]' --query 'RouteTable.RouteTableId' --output text)
PRIVATE_RT=$(aws ec2 create-route-table --vpc-id $VPC_ID --tag-specifications 'ResourceType=route-table,Tags=[{Key=Name,Value=lca-private-rt}]' --query 'RouteTable.RouteTableId' --output text)

# Add routes
aws ec2 create-route --route-table-id $PUBLIC_RT --destination-cidr-block 0.0.0.0/0 --gateway-id $IGW_ID
aws ec2 create-route --route-table-id $PRIVATE_RT --destination-cidr-block 0.0.0.0/0 --nat-gateway-id $NAT_GW_1

# Associate subnets with route tables
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_1 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PUBLIC_SUBNET_2 --route-table-id $PUBLIC_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_1 --route-table-id $PRIVATE_RT
aws ec2 associate-route-table --subnet-id $PRIVATE_SUBNET_2 --route-table-id $PRIVATE_RT
```

---

#### 5. Create Security Groups

```bash
# ALB Security Group (allow HTTPS from internet)
ALB_SG=$(aws ec2 create-security-group \
  --group-name lca-alb-sg \
  --description "Security group for Application Load Balancer" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 443 --cidr 0.0.0.0/0
aws ec2 authorize-security-group-ingress --group-id $ALB_SG --protocol tcp --port 80 --cidr 0.0.0.0/0

# ECS Security Group (allow traffic from ALB only)
ECS_SG=$(aws ec2 create-security-group \
  --group-name lca-ecs-sg \
  --description "Security group for ECS tasks" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 3000 --source-group $ALB_SG

# Allow ECS to connect to RDS and ElastiCache
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 3306 --source-group $ECS_SG
aws ec2 authorize-security-group-ingress --group-id $ECS_SG --protocol tcp --port 6379 --source-group $ECS_SG

# RDS Security Group (allow traffic from ECS only)
RDS_SG=$(aws ec2 create-security-group \
  --group-name lca-rds-sg \
  --description "Security group for RDS database" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $RDS_SG --protocol tcp --port 3306 --source-group $ECS_SG

# ElastiCache Security Group
REDIS_SG=$(aws ec2 create-security-group \
  --group-name lca-redis-sg \
  --description "Security group for ElastiCache Redis" \
  --vpc-id $VPC_ID \
  --query 'GroupId' --output text)

aws ec2 authorize-security-group-ingress --group-id $REDIS_SG --protocol tcp --port 6379 --source-group $ECS_SG
```

---

### Phase 3: Database Setup (1 hour)

#### 6. Create RDS MySQL Instance

```bash
# Create DB subnet group
aws rds create-db-subnet-group \
  --db-subnet-group-name lca-db-subnet-group \
  --db-subnet-group-description "Subnet group for LCA database" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2

# Create RDS instance (Production configuration)
aws rds create-db-instance \
  --db-instance-identifier lca-db-prod \
  --db-instance-class db.t3.medium \
  --engine mysql \
  --engine-version 8.0.35 \
  --master-username lcaadmin \
  --master-user-password $(openssl rand -base64 32) \
  --allocated-storage 100 \
  --storage-type gp3 \
  --storage-encrypted \
  --multi-az \
  --db-subnet-group-name lca-db-subnet-group \
  --vpc-security-group-ids $RDS_SG \
  --backup-retention-period 7 \
  --preferred-backup-window "03:00-04:00" \
  --preferred-maintenance-window "sun:04:00-sun:05:00" \
  --enable-performance-insights \
  --performance-insights-retention-period 7 \
  --enable-cloudwatch-logs-exports '["error","general","slowquery"]' \
  --db-name lca_production \
  --tags Key=Name,Value=lca-db-prod Key=Environment,Value=production

# Wait for RDS to become available (takes ~10 minutes)
aws rds wait db-instance-available --db-instance-identifier lca-db-prod

# Get RDS endpoint
RDS_ENDPOINT=$(aws rds describe-db-instances \
  --db-instance-identifier lca-db-prod \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text)

echo "RDS Endpoint: $RDS_ENDPOINT"
```

#### 7. Import Database Schema

```bash
# Download your schema file
# Assuming you're in project directory
mysql -h $RDS_ENDPOINT -u lcaadmin -p lca_production < lca_v3_drawsql_schema.sql
```

---

### Phase 4: Caching Layer (30 minutes)

#### 8. Create ElastiCache Redis Cluster

```bash
# Create subnet group
aws elasticache create-cache-subnet-group \
  --cache-subnet-group-name lca-redis-subnet-group \
  --cache-subnet-group-description "Subnet group for Redis cluster" \
  --subnet-ids $PRIVATE_SUBNET_1 $PRIVATE_SUBNET_2

# Create Redis cluster with replication
aws elasticache create-replication-group \
  --replication-group-id lca-redis-cluster \
  --replication-group-description "LCA Project Redis Cache" \
  --engine redis \
  --cache-node-type cache.t3.medium \
  --num-cache-clusters 2 \
  --automatic-failover-enabled \
  --cache-subnet-group-name lca-redis-subnet-group \
  --security-group-ids $REDIS_SG \
  --at-rest-encryption-enabled \
  --transit-encryption-enabled \
  --auth-token $(openssl rand -base64 32) \
  --engine-version 7.0 \
  --preferred-cache-cluster-azs us-east-1a us-east-1b \
  --tags Key=Name,Value=lca-redis Key=Environment,Value=production

# Wait for Redis to become available (takes ~5 minutes)
aws elasticache wait replication-group-available --replication-group-id lca-redis-cluster

# Get Redis endpoint
REDIS_ENDPOINT=$(aws elasticache describe-replication-groups \
  --replication-group-id lca-redis-cluster \
  --query 'ReplicationGroups[0].NodeGroups[0].PrimaryEndpoint.Address' \
  --output text)

echo "Redis Endpoint: $REDIS_ENDPOINT"
```

---

### Phase 5: Secrets Management (15 minutes)

#### 9. Store Credentials in Secrets Manager

```bash
# Store RDS credentials
aws secretsmanager create-secret \
  --name lca/database-credentials \
  --secret-string "{\"host\":\"$RDS_ENDPOINT\",\"port\":3306,\"username\":\"lcaadmin\",\"password\":\"YOUR_PASSWORD\",\"database\":\"lca_production\"}"

# Store Redis credentials
aws secretsmanager create-secret \
  --name lca/redis-url \
  --secret-string "{\"url\":\"redis://$REDIS_ENDPOINT:6379\"}"

# Store Ecoinvent API credentials (replace with your actual credentials)
aws secretsmanager create-secret \
  --name lca/ecoinvent-api \
  --secret-string "{\"api_key\":\"YOUR_ECOINVENT_KEY\",\"username\":\"YOUR_USERNAME\",\"password\":\"YOUR_PASSWORD\",\"base_url\":\"https://ecoinvent.org/api/v3\"}"

# Store JWT secret
aws secretsmanager create-secret \
  --name lca/jwt-secret \
  --secret-string "{\"secret\":\"$(openssl rand -base64 32)\"}"

# Store session secret
aws secretsmanager create-secret \
  --name lca/session-secret \
  --secret-string "{\"secret\":\"$(openssl rand -base64 32)\"}"
```

---

### Phase 6: Application Deployment (2 hours)

#### 10. Create ECR Repository

```bash
# Create repository for Docker images
aws ecr create-repository \
  --repository-name lca-project \
  --image-scanning-configuration scanOnPush=true \
  --encryption-configuration encryptionType=AES256

# Get repository URI
ECR_REPO_URI=$(aws ecr describe-repositories \
  --repository-names lca-project \
  --query 'repositories[0].repositoryUri' \
  --output text)

echo "ECR Repository: $ECR_REPO_URI"

# Get login credentials for Docker
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin $ECR_REPO_URI
```

#### 11. Build and Push Docker Image

Create `Dockerfile` in your project root:

```dockerfile
# Multi-stage build for smaller image size
FROM node:18-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --only=production

FROM node:18-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app

ENV NODE_ENV production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

ENV PORT 3000

CMD ["node", "server.js"]
```

Update `next.config.js`:
```javascript
module.exports = {
  output: 'standalone',
  // ... other config
};
```

Build and push:
```bash
# Build Docker image
docker build -t lca-project:latest .

# Tag for ECR
docker tag lca-project:latest $ECR_REPO_URI:latest
docker tag lca-project:latest $ECR_REPO_URI:$(git rev-parse --short HEAD)

# Push to ECR
docker push $ECR_REPO_URI:latest
docker push $ECR_REPO_URI:$(git rev-parse --short HEAD)
```

---

#### 12. Create ECS Cluster and Task Definition

```bash
# Create ECS cluster
aws ecs create-cluster \
  --cluster-name lca-cluster \
  --capacity-providers FARGATE FARGATE_SPOT \
  --default-capacity-provider-strategy capacityProvider=FARGATE,weight=1 \
  --tags key=Name,value=lca-cluster key=Environment,value=production

# Create IAM role for ECS task execution
# (This role allows ECS to pull images from ECR and write logs to CloudWatch)
# Do this via AWS Console: IAM → Roles → Create Role → ECS Task Execution Role
```

Create `task-definition.json`:
```json
{
  "family": "lca-task",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "1024",
  "memory": "2048",
  "executionRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskExecutionRole",
  "taskRoleArn": "arn:aws:iam::YOUR_ACCOUNT_ID:role/ecsTaskRole",
  "containerDefinitions": [
    {
      "name": "lca-app",
      "image": "YOUR_ECR_REPO_URI:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "NODE_ENV",
          "value": "production"
        }
      ],
      "secrets": [
        {
          "name": "DATABASE_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:lca/database-credentials"
        },
        {
          "name": "REDIS_URL",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:lca/redis-url"
        },
        {
          "name": "ECOINVENT_API_KEY",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:lca/ecoinvent-api"
        },
        {
          "name": "JWT_SECRET",
          "valueFrom": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:lca/jwt-secret"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/lca-project",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs",
          "awslogs-create-group": "true"
        }
      },
      "healthCheck": {
        "command": ["CMD-SHELL", "wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1"],
        "interval": 30,
        "timeout": 5,
        "retries": 3,
        "startPeriod": 60
      }
    }
  ]
}
```

Register task definition:
```bash
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

---

#### 13. Create Application Load Balancer

```bash
# Create ALB
ALB_ARN=$(aws elbv2 create-load-balancer \
  --name lca-alb \
  --subnets $PUBLIC_SUBNET_1 $PUBLIC_SUBNET_2 \
  --security-groups $ALB_SG \
  --scheme internet-facing \
  --type application \
  --ip-address-type ipv4 \
  --tags Key=Name,Value=lca-alb Key=Environment,Value=production \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Create target group
TARGET_GROUP_ARN=$(aws elbv2 create-target-group \
  --name lca-targets \
  --protocol HTTP \
  --port 3000 \
  --vpc-id $VPC_ID \
  --target-type ip \
  --health-check-protocol HTTP \
  --health-check-path /api/health \
  --health-check-interval-seconds 30 \
  --health-check-timeout-seconds 5 \
  --healthy-threshold-count 2 \
  --unhealthy-threshold-count 3 \
  --tags Key=Name,Value=lca-targets \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Create HTTPS listener (requires ACM certificate)
# First, request a certificate via AWS Console: ACM → Request Certificate → lca-project.com
# Then create listener:
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTPS \
  --port 443 \
  --certificates CertificateArn=YOUR_ACM_CERTIFICATE_ARN \
  --default-actions Type=forward,TargetGroupArn=$TARGET_GROUP_ARN

# Create HTTP listener (redirect to HTTPS)
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=redirect,RedirectConfig="{Protocol=HTTPS,Port=443,StatusCode=HTTP_301}"

# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --load-balancer-arns $ALB_ARN \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "ALB DNS: $ALB_DNS"
```

---

#### 14. Create ECS Service

```bash
# Create ECS service
aws ecs create-service \
  --cluster lca-cluster \
  --service-name lca-service \
  --task-definition lca-task \
  --desired-count 2 \
  --launch-type FARGATE \
  --platform-version LATEST \
  --network-configuration "awsvpcConfiguration={subnets=[$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2],securityGroups=[$ECS_SG],assignPublicIp=DISABLED}" \
  --load-balancers "targetGroupArn=$TARGET_GROUP_ARN,containerName=lca-app,containerPort=3000" \
  --health-check-grace-period-seconds 60 \
  --tags key=Name,value=lca-service key=Environment,value=production

# Enable auto-scaling
aws application-autoscaling register-scalable-target \
  --service-namespace ecs \
  --resource-id service/lca-cluster/lca-service \
  --scalable-dimension ecs:service:DesiredCount \
  --min-capacity 2 \
  --max-capacity 10

# Scale on CPU utilization
aws application-autoscaling put-scaling-policy \
  --service-namespace ecs \
  --resource-id service/lca-cluster/lca-service \
  --scalable-dimension ecs:service:DesiredCount \
  --policy-name lca-cpu-scaling \
  --policy-type TargetTrackingScaling \
  --target-tracking-scaling-policy-configuration '{
    "TargetValue": 70.0,
    "PredefinedMetricSpecification": {
      "PredefinedMetricType": "ECSServiceAverageCPUUtilization"
    },
    "ScaleInCooldown": 300,
    "ScaleOutCooldown": 60
  }'
```

---

### Phase 7: Lambda Setup (Ecoinvent Proxy) (1 hour)

#### 15. Create Lambda Function

Create `lambda` directory in your project:

```bash
mkdir lambda
cd lambda
npm init -y
npm install axios redis aws-sdk
```

Copy the Lambda function code from section 4 above into `lambda/index.js`.

Package Lambda:
```bash
cd lambda
zip -r ../lambda-function.zip .
cd ..
```

Create Lambda:
```bash
# Create IAM role for Lambda (do this via AWS Console first)
# IAM → Roles → Create Role → Lambda → Attach policies:
#   - AWSLambdaBasicExecutionRole
#   - AWSLambdaVPCAccessExecutionRole
#   - SecretsManagerReadWrite
#   - DynamoDBFullAccess

# Create Lambda function
aws lambda create-function \
  --function-name ecoinvent-proxy \
  --runtime nodejs20.x \
  --role arn:aws:iam::YOUR_ACCOUNT_ID:role/lambda-execution-role \
  --handler index.handler \
  --zip-file fileb://lambda-function.zip \
  --timeout 30 \
  --memory-size 512 \
  --environment Variables="{REDIS_URL=$REDIS_ENDPOINT}" \
  --vpc-config SubnetIds=$PRIVATE_SUBNET_1,$PRIVATE_SUBNET_2,SecurityGroupIds=$ECS_SG

# Create API Gateway to invoke Lambda
# (Do this via AWS Console for easier setup)
# API Gateway → Create API → REST API → New API
# Create resource: /impact-factors
# Create method: POST
# Integration type: Lambda Function
# Lambda Function: ecoinvent-proxy
# Deploy API to stage: prod
```

---

### Phase 8: Monitoring Setup (30 minutes)

#### 16. Create CloudWatch Dashboard

```bash
# Create dashboard (do this via AWS Console for visual editing)
# CloudWatch → Dashboards → Create Dashboard → lca-prod-dashboard
# Add widgets:
#   - ECS CPU/Memory
#   - RDS CPU/Connections
#   - ALB Request Count/Response Time
#   - ElastiCache Cache Hit Rate
```

#### 17. Create CloudWatch Alarms

```bash
# High CPU alarm (ECS)
aws cloudwatch put-metric-alarm \
  --alarm-name lca-ecs-cpu-high \
  --alarm-description "ECS CPU > 80% for 5 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/ECS \
  --statistic Average \
  --period 300 \
  --threshold 80 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=ServiceName,Value=lca-service Name=ClusterName,Value=lca-cluster

# High CPU alarm (RDS)
aws cloudwatch put-metric-alarm \
  --alarm-name lca-rds-cpu-high \
  --alarm-description "RDS CPU > 90% for 5 minutes" \
  --metric-name CPUUtilization \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 90 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=lca-db-prod

# Low storage alarm (RDS)
aws cloudwatch put-metric-alarm \
  --alarm-name lca-rds-storage-low \
  --alarm-description "RDS storage < 10GB" \
  --metric-name FreeStorageSpace \
  --namespace AWS/RDS \
  --statistic Average \
  --period 300 \
  --threshold 10737418240 \
  --comparison-operator LessThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=DBInstanceIdentifier,Value=lca-db-prod

# High error rate (ALB)
aws cloudwatch put-metric-alarm \
  --alarm-name lca-alb-5xx-high \
  --alarm-description "ALB 5xx errors > 10 in 5 minutes" \
  --metric-name HTTPCode_Target_5XX_Count \
  --namespace AWS/ApplicationELB \
  --statistic Sum \
  --period 300 \
  --threshold 10 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --dimensions Name=LoadBalancer,Value=$(echo $ALB_ARN | cut -d':' -f6-)
```

---

## 6. Security Configuration

### IAM Roles

#### ECS Task Execution Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "ecr:GetAuthorizationToken",
        "ecr:BatchCheckLayerAvailability",
        "ecr:GetDownloadUrlForLayer",
        "ecr:BatchGetImage",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:CreateLogGroup"
      ],
      "Resource": "*"
    }
  ]
}
```

#### ECS Task Role
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:us-east-1:*:secret:lca/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::lca-project-user-data/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudwatch:PutMetricData"
      ],
      "Resource": "*"
    }
  ]
}
```

---

## 7. Monitoring & Alerts

### Key Metrics to Monitor

| Metric | Threshold | Action |
|--------|-----------|--------|
| **ECS CPU** | > 80% for 5 min | Scale up tasks |
| **ECS Memory** | > 80% for 5 min | Investigate memory leaks |
| **RDS CPU** | > 90% for 5 min | Optimize queries or scale up |
| **RDS Connections** | > 80% of max | Increase max connections |
| **RDS Storage** | < 10GB free | Expand storage |
| **ALB 5xx Errors** | > 10 in 5 min | Check application logs |
| **Cache Hit Rate** | < 70% | Review caching strategy |
| **API Response Time (p95)** | > 2 seconds | Optimize database queries |
| **Daily API Cost** | > $50 | Review Ecoinvent usage |

---

## 8. Cost Optimization

### Immediate Optimizations

1. **Use Reserved Instances** (save 30-60%)
   - RDS: 1-year commitment
   - ElastiCache: 1-year commitment

2. **Use Savings Plans for Fargate** (save 50%)
   - Compute Savings Plan: 1-year commitment

3. **Enable S3 Intelligent-Tiering** (save 68% on infrequent access)

4. **Aggressive Ecoinvent API Caching** (save 90-95%)
   - 7-day Redis cache
   - 1-year DynamoDB cache
   - Pre-load common substances

5. **Right-Size Resources**
   - Monitor for 2 weeks
   - Scale down if CPU/Memory < 40%

6. **Use Spot Instances for Fargate** (save 70%)
   - For non-critical workloads

7. **Optimize Data Transfer**
   - Enable CloudFront compression
   - Use VPC Endpoints for AWS services

### Cost Monitoring

```bash
# Enable Cost Explorer
# AWS Console → Cost Management → Cost Explorer → Enable

# Set up budget alerts
aws budgets create-budget \
  --account-id YOUR_ACCOUNT_ID \
  --budget file://budget.json \
  --notifications-with-subscribers file://notifications.json
```

**budget.json**:
```json
{
  "BudgetName": "LCA-Monthly-Budget",
  "BudgetLimit": {
    "Amount": "1000",
    "Unit": "USD"
  },
  "TimeUnit": "MONTHLY",
  "BudgetType": "COST"
}
```

**notifications.json**:
```json
[
  {
    "Notification": {
      "NotificationType": "ACTUAL",
      "ComparisonOperator": "GREATER_THAN",
      "Threshold": 80,
      "ThresholdType": "PERCENTAGE"
    },
    "Subscribers": [
      {
        "SubscriptionType": "EMAIL",
        "Address": "your-email@example.com"
      }
    ]
  }
]
```

---

## Summary

### Estimated Setup Time
- **Phase 1-2**: 1.5 hours (Prerequisites + Networking)
- **Phase 3-4**: 1.5 hours (Database + Cache)
- **Phase 5**: 15 minutes (Secrets)
- **Phase 6**: 2 hours (Application Deployment)
- **Phase 7**: 1 hour (Lambda)
- **Phase 8**: 30 minutes (Monitoring)
- **TOTAL**: ~7 hours

### Monthly Cost Summary

| Environment | Cost | Best For |
|-------------|------|----------|
| **Development** | $120-160 | Testing, staging |
| **Production (Small)** | $850 | 500-1,000 users |
| **Production (Medium)** | $3,360 | 5,000-10,000 users |

### Cost Optimization Potential
- **Reserved Instances**: Save $100-500/month
- **Aggressive Caching**: Save $400-1,800/month (Ecoinvent API)
- **S3 Lifecycle Policies**: Save $50-200/month
- **Right-Sizing**: Save $100-300/month
- **TOTAL SAVINGS**: $650-2,800/month

### Key Success Factors
1. ✅ Multi-AZ deployment for high availability
2. ✅ Automated backups and disaster recovery
3. ✅ Comprehensive monitoring and alerting
4. ✅ Aggressive caching for cost optimization
5. ✅ Security best practices (encryption, IAM roles)
6. ✅ Auto-scaling for traffic spikes
7. ✅ CI/CD pipeline for fast deployments

---

**Next Steps**:
1. Contact Ecoinvent for API pricing and access
2. Create AWS account and enable billing alerts
3. Start with Development environment
4. Implement caching strategy
5. Monitor for 2 weeks and optimize
6. Scale to Production when ready

**Questions?** Review AWS documentation or consult with a DevOps engineer for implementation assistance.
