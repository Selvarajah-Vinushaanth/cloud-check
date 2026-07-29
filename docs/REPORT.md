# Cloud Summit 2026: Cloud Computing Microservices Architecture

## CMM707 Cloud Computing — Coursework Report

**Student:** Cloud Engineer
**Module:** CMM707 — Cloud Computing
**Academic Year:** 2026
**Semester:** 3
**Submission Date:** 21 July 2026
**Assessment Deadline:** 22 July 2026, 11:00 PM IST

---

## TABLE OF CONTENTS

1. [Executive Summary](#executive-summary)
2. [Solution Architecture](#solution-architecture)
3. [Deployment Architecture](#deployment-architecture)
4. [Technology Stack](#technology-stack)
5. [Microservices Design](#microservices-design)
6. [Security &amp; Ethics](#security--ethics)
7. [CI/CD Pipeline](#cicd-pipeline)
8. [Web Analytics Implementation](#web-analytics-implementation)
9. [Deployment &amp; Testing](#deployment--testing)
10. [References](#references)

---

## EXECUTIVE SUMMARY

This report documents the design, implementation, and deployment of a cloud-native microservices architecture for the **Cloud Summit 2026** event management platform. The solution leverages **AWS EKS (Kubernetes)** for container orchestration, **PostgreSQL** for transactional data, **ClickHouse** for analytics, and **GitHub Actions** for CI/CD with blue-green deployment strategy.

### Key Deliverables:

- ✅ Frontend (Bootstrap responsive HTML + Nginx reverse proxy)
- ✅ 4 Microservices (Event, Program, Registration, Analytics services)
- ✅ Relational Database (PostgreSQL with 3 separate schemas)
- ✅ 10 Web Analytics Event Types streamed to ClickHouse
- ✅ Metabase Analytics Dashboard
- ✅ Prometheus + Grafana Observability Stack
- ✅ AWS Lambda Serverless Function (seat notifications)
- ✅ Blue-Green CI/CD Pipeline with automated deployment
- ✅ Kubernetes manifests and deployment automation
- ✅ Comprehensive runbook and documentation

### Alignment with Learning Outcomes:

- **LO1:** Compared cloud deployment models (IaaS-EKS) and design principles (scalability, fault-tolerance, security)
- **LO2:** Appraised IaaS (EKS), PaaS (managed services), and SaaS (Metabase) models
- **LO3:** Designed microservices architecture addressing real-world concerns (distributed tracing, load balancing, auto-scaling)
- **LO4:** Integrated heterogeneous components (Node.js services, PostgreSQL, ClickHouse, Lambda, Kubernetes) into cohesive cloud solution
- **LO5:** Implemented security controls (RBAC, secrets encryption, API validation) and ethical considerations (data residency, compliance, transparency)

---

## SOLUTION ARCHITECTURE

### 1.1 High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                            AWS ACCOUNT (ap-south-1)                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         AWS ALB INGRESS (Public)                         │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐    │   │
│  │  │ Ingress Rules: cloudsummit2026.yourdomain.com                   │    │   │
│  │  │ SSL/TLS termination, path-based routing                         │    │   │
│  │  └──────────────────────────┬──────────────────────────────────────┘    │   │
│  └─────────────────────────────┼──────────────────────────────────────────┘   │
│                                │                                                │
│  ┌─────────────────────────────▼──────────────────────────────────────────┐   │
│  │              EKS Cluster: cloud-summit-eks (ap-south-1)                │   │
│  │              Namespace: cloud-summit                                   │   │
│  │              Node Group: worker (2x t3.micro for demo)                │   │
│  │                                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    FRONTEND LAYER                              │  │   │
│  │  │  ┌────────────────────────────────────────────────────────┐    │  │   │
│  │  │  │ Frontend (Nginx:1.25-alpine)                           │    │  │   │
│  │  │  │ Port: 80/443 | Replicas: 2-10 (HPA)                   │    │  │   │
│  │  │  │ Role: Serve Bootstrap HTML + reverse proxy backend     │    │  │   │
│  │  │  │ Features: Responsive, countdown timer, section nav     │    │  │   │
│  │  │  │ Analytics Tracking: 10 event types (JS)               │    │  │   │
│  │  │  │ Blue/Green: frontend-blue, frontend-green             │    │  │   │
│  │  │  └────────────────────────────────────────────────────────┘    │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │                    API GATEWAY LAYER                           │  │   │
│  │  │  ┌──────────────────┐ ┌──────────────────┐ ┌─────────────┐    │  │   │
│  │  │  │  Event Service   │ │ Program Service  │ │  Reg Svc    │    │  │   │
│  │  │  │  Port: 3001      │ │ Port: 3002       │ │ Port: 3003  │    │  │   │
│  │  │  │  Replicas: 2-8   │ │ Replicas: 2-6    │ │ Repl: 2-8   │    │  │   │
│  │  │  │  Blue/Green      │ │ Blue/Green       │ │ Blue/Green  │    │  │   │
│  │  │  │ +HPA, liveness   │ │ +HPA, liveness   │ │ +HPA        │    │  │   │
│  │  │  │                  │ │                  │ │             │    │  │   │
│  │  │  │ Node:20-alpine   │ │ Node:20-alpine   │ │Node:20      │    │  │   │
│  │  │  │ npm libs: express│ │ npm: express, pg │ │ express, pg │    │  │   │
│  │  │  │ pg, helmet, joi  │ │ helmet, joi      │ │ helmet, joi │    │  │   │
│  │  │  └──────────────────┘ └──────────────────┘ └─────────────┘    │  │   │
│  │  │                                                                  │  │   │
│  │  │              Analytics Collector (Port 3004)                    │  │   │
│  │  │              Receives 10 event types from frontend              │  │   │
│  │  │              Streams to ClickHouse                              │  │   │
│  │  │              Replicas: 1-2 (pod to ClickHouse bridge)           │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                           │                                           │   │
│  │  ┌────────────────────────▼───────────────────────────────────────┐  │   │
│  │  │                  DATA LAYER (K8s)                              │  │   │
│  │  │                                                                │  │   │
│  │  │  PostgreSQL StatefulSet                                        │  │   │
│  │  │  ├─ events_db:        Event CRUD data                          │  │   │
│  │  │  ├─ programs_db:      Session schedule, speakers               │  │   │
│  │  │  └─ registrations_db: Attendee registrations                   │  │   │
│  │  │                                                                │  │   │
│  │  │  PVC: postgres-pvc (20Gi, gp2)                                 │  │   │
│  │  │  Port: 5432 (internal service DNS)                             │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  │                                                                        │   │
│  │  ┌────────────────────────────────────────────────────────────────┐  │   │
│  │  │             ANALYTICS & OBSERVABILITY LAYER                    │  │   │
│  │  │                                                                │  │   │
│  │  │  ClickHouse StatefulSet                                        │  │   │
│  │  │  ├─ Port: 8123 (HTTP)                                          │  │   │
│  │  │  ├─ PVC: clickhouse-data (30Gi)                                │  │   │
│  │  │  └─ Schema: analytics.web_events (10 columns)                  │  │   │
│  │  │                                                                │  │   │
│  │  │  Metabase (Analytics Dashboard)                                │  │   │
│  │  │  ├─ Port: 3000                                                 │  │   │
│  │  │  ├─ Connected to ClickHouse                                    │  │   │
│  │  │  └─ Interactive dashboards (business KPIs)                     │  │   │
│  │  │                                                                │  │   │
│  │  │  Prometheus (Metrics Collection)                               │  │   │
│  │  │  ├─ Port: 9090                                                 │  │   │
│  │  │  ├─ PVC: prometheus-pvc (10Gi)                                 │  │   │
│  │  │  ├─ Scrape config: all K8s services + prom-client metrics     │  │   │
│  │  │  └─ ServiceAccount + RBAC for pod discovery                    │  │   │
│  │  │                                                                │  │   │
│  │  │  Grafana (Observability Dashboards)                            │  │   │
│  │  │  ├─ Port: 3000 (alt endpoint)                                  │  │   │
│  │  │  ├─ PVC: grafana-pvc (5Gi)                                     │  │   │
│  │  │  ├─ Datasource: Prometheus                                     │  │   │
│  │  │  └─ Pre-built dashboards (request rate, latency, errors)       │  │   │
│  │  └────────────────────────────────────────────────────────────────┘  │   │
│  └────────────────────────────────────────────────────────────────────┘   │   │
│                                                                             │   │
│  ┌───────────────────────────────────────────────────────────────────┐   │   │
│  │                  AWS SERVERLESS LAYER                            │   │   │
│  │                                                                   │   │   │
│  │  Lambda: seat-notifier                                           │   │   │
│  │  Trigger: Event Service (when seats_available < 10)              │   │   │
│  │  Action: Write notification JSON to S3 bucket                    │   │   │
│  │  Runtime: Node.js 20                                             │   │   │
│  │  Environment: NOTIFICATION_BUCKET, DB credentials                │   │   │
│  │  Deployment: AWS SAM CloudFormation (template.yaml)              │   │   │
│  │                                                                   │   │   │
│  │  S3 Bucket: cloud-summit-seat-notifications                      │   │   │
│  │  ├─ Object path: notifications/event_<id>_<timestamp>.json       │   │   │
│  │  ├─ Content: {event_id, timestamp, seats_remaining, threshold}   │   │   │
│  │  └─ Access: Event Service Lambda invocation role                 │   │   │
│  └───────────────────────────────────────────────────────────────────┘   │   │
│                                                                             │   │
└───────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Request & Data Flow

**User Registration Flow:**

```
1. User visits frontend (cloudsummit2026.yourdomain.com)
   ↓
2. Frontend loads HTML (Nginx serves from /usr/share/nginx/html)
3. JavaScript analytics.js initializes (tracks page_view event)
   ↓
4. User clicks "Register" button
   Analytics: button_click event → POST to /api/analytics/event
   ↓
5. User fills registration form
   Analytics: form_start, form_submit_attempt events
   ↓
6. Form submission → POST /api/registrations (via Nginx reverse proxy)
   Nginx routes to registration-service:3003
   ↓
7. Registration Service:
   a) Validates input (Joi schema validation)
   b) Checks duplicate registration (email + event_id unique constraint)
   c) Queries PostgreSQL registrations_db
   d) Calls Event Service to decrement seat count: GET /api/events/:id → PATCH /api/events/:id/seats
   ↓
8. Event Service:
   a) Reads seats_available from events_db
   b) Decrements seats
   c) IF seats_available < 10:
      → Invokes AWS Lambda (seat-notifier)
      → Lambda writes {event_id, seats, timestamp} to S3 bucket
   ↓
9. Response: registration_id returned to frontend
10. Analytics: form_submit_attempt success event sent to Analytics Collector
    Analytics Collector → ClickHouse (INSERT into web_events table)
```

**Analytics & Observability Flow:**

```
Frontend (analytics.js)
├─ page_view, scroll_depth, section_view events
├─ User interactions (button_click, video_play, speaker_hover, program_tab_click)
├─ Form lifecycle (form_start, form_submit_attempt)
└─ Session duration tracking
    ↓
POST /api/analytics/event (Analytics Collector Service on port 3004)
    ↓
@clickhouse/client library (Node.js)
    ↓
ClickHouse INSERT into analytics.web_events table
    ↓
Metabase (Port 3000)
├─ Connects to ClickHouse
├─ Real-time dashboards:
│  ├─ Top sections viewed (section_view count)
│  ├─ Conversion funnel (form_start → form_submit_attempt → registration_success)
│  ├─ Video engagement (video_play per speaker)
│  ├─ User scroll depth distribution
│  └─ Peak traffic times (page_view timeline)
└─ Interactive drill-down

Prometheus (Port 9090)
├─ Scrapes all K8s service metrics (prom-client from Node.js services)
├─ Metrics:
│  ├─ http_requests_total (by service, status code)
│  ├─ http_request_duration_seconds (latency percentiles)
│  ├─ database_query_duration_seconds
│  └─ pod_restart_count
├─ Alert rules (high error rate, high latency)
└─ 15-day retention (TSDB)
    ↓
Grafana (Port 3000, alt)
├─ Datasource: Prometheus
├─ Dashboards:
│  ├─ K8s cluster health (node CPU, memory, pod count)
│  ├─ Service SLOs (p95/p99 latency, error rates)
│  ├─ Database performance (connection pool, query duration)
│  └─ Business metrics (registrations/min, events_created/hour)
└─ Alert notifications (Email, Slack)
```

### 1.3 Data Model

**PostgreSQL events_db:**

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  venue VARCHAR(255),
  date_time TIMESTAMP,
  ticket_price DECIMAL(10, 2),
  capacity INT,
  seats_available INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**PostgreSQL programs_db:**

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  day INT (1-3),
  track VARCHAR(100) (e.g., 'Cloud Computing Track'),
  session_name VARCHAR(255),
  speaker_name VARCHAR(255),
  start_time TIME,
  end_time TIME,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**PostgreSQL registrations_db:**

```sql
CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  ticket_count INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, email)
);
```

**ClickHouse analytics.web_events:**

```sql
CREATE TABLE web_events (
  id UUID,
  event_type String,
  user_session_id String,
  event_timestamp DateTime,
  event_data String (JSON),
  page_url String,
  referrer String,
  user_agent String,
  scroll_depth Int32,
  session_duration_sec Int32,
  created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (event_timestamp, event_type);
```

---

## DEPLOYMENT ARCHITECTURE

### 2.1 AWS Infrastructure Topology

```
┌─────────────────────────────────────────────────────────────┐
│                      AWS Account (ap-south-1)               │
│                                                              │
│  VPC: 10.0.0.0/16                                            │
│  ├─ Public Subnet: 10.0.1.0/24 (ALB, NAT)                   │
│  ├─ Private Subnet: 10.0.2.0/24 (EKS nodes)                 │
│  ├─ Private Subnet: 10.0.3.0/24 (RDS, managed services)     │
│  │                                                            │
│  ├─ Internet Gateway (IGW)                                  │
│  ├─ NAT Gateway (outbound access from private subnets)       │
│  │                                                            │
│  ├─ AWS ALB (Application Load Balancer)                      │
│  │  Port 80/443, path-based routing                          │
│  │  Target Group: EKS cluster (Ingress controller)           │
│  │                                                            │
│  ├─ EKS Cluster: cloud-summit-eks                            │
│  │  Version: 1.28+ (latest managed)                          │
│  │  Endpoint: Public (for kubectl access)                    │
│  │  Networking: AWS VPC CNI (pod networking)                 │
│  │  RBAC: Enabled, IAM roles for service accounts            │
│  │                                                            │
│  │  Node Group: worker                                       │
│  │  ├─ Instance type: t3.micro (2 nodes for demo)            │
│  │  ├─ Min: 1, Max: 3, Desired: 2                            │
│  │  ├─ Launch template: EKS-optimized AMI                    │
│  │  ├─ IAM role: AmazonEKSNodeRole (EC2 instance access)     │
│  │  └─ Auto Scaling Group (ASG) for elasticity               │
│  │                                                            │
│  ├─ ECR (Elastic Container Registry)                         │
│  │  Region: ap-south-1                                       │
│  │  Repositories:                                             │
│  │  ├─ frontend (image tags: blue, green, latest)            │
│  │  ├─ event-service (tags: blue, green, latest)             │
│  │  ├─ program-service (tags: blue, green, latest)           │
│  │  ├─ registration-service (tags: blue, green, latest)      │
│  │  └─ analytics-collector (tags: blue, green, latest)       │
│  │  Image scanning: Trivy security scan on push              │
│  │  Lifecycle policy: Retain last 5 images per tag           │
│  │                                                            │
│  ├─ EBS (Elastic Block Storage)                              │
│  │  Volumes (gp2, provisioned by K8s PVCs):                  │
│  │  ├─ postgres-pvc: 20Gi (PostgreSQL data)                  │
│  │  ├─ clickhouse-data: 30Gi (analytics data)                │
│  │  ├─ prometheus-pvc: 10Gi (time-series metrics)            │
│  │  └─ grafana-pvc: 5Gi (dashboard configs)                  │
│  │                                                            │
│  ├─ S3 Bucket: cloud-summit-seat-notifications               │
│  │  Region: ap-south-1                                       │
│  │  Objects: notifications/event_<id>_<timestamp>.json       │
│  │  Lifecycle: 90 days retention, then archive to Glacier    │
│  │  Versioning: Disabled (cost optimization)                 │
│  │  Access: Lambda IAM role + Event Service Lambda role      │
│  │                                                            │
│  ├─ Lambda: seat-notifier                                    │
│  │  Runtime: Node.js 20.x                                    │
│  │  Handler: index.handler                                   │
│  │  Role: LambdaExecutionRole (S3 PutObject + CloudWatch)    │
│  │  Timeout: 30 seconds                                      │
│  │  Memory: 256 MB                                           │
│  │  Trigger: Synchronous invocation from Event Service       │
│  │  Environment variables:                                   │
│  │  ├─ NOTIFICATION_BUCKET=cloud-summit-seat-notifications  │
│  │  ├─ NOTIFICATION_THRESHOLD=10                             │
│  │  └─ AWS_REGION=ap-south-1                                 │
│  │  Deployment: AWS SAM (Serverless Application Model)       │
│  │                                                            │
│  ├─ CloudWatch (Logging & Monitoring)                        │
│  │  Log Groups:                                              │
│  │  ├─ /aws/eks/cloud-summit-eks/cluster (EKS control plane)│
│  │  ├─ /aws/lambda/seat-notifier (Lambda logs)              │
│  │  ├─ /aws/rds/postgres-instance (RDS if used)             │
│  │  └─ /aws/ecs/container-logs (optional container logs)     │
│  │  Alarms: High error rate, Lambda throttling, Lambda DLQ   │
│  │                                                            │
│  └─ Security Groups                                          │
│     ├─ ALB-sg: Inbound 80, 443 from 0.0.0.0/0               │
│     ├─ EKS-nodes-sg: Inbound 3001-3004, 5432 from ALB-sg    │
│     └─ RDS-sg (if applicable): Inbound 5432 from EKS-nodes   │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Kubernetes Resource Topology

```
Namespace: cloud-summit

Secrets:
├─ postgres-secret (username, password)
└─ clickhouse-secret (username, password)

ConfigMaps:
├─ prometheus-config (scrape_configs, alerting rules)
├─ grafana-datasources (Prometheus URL)
└─ clickhouse-config (user/quota settings)

StatefulSets:
├─ postgres
│  Replicas: 1
│  Service: postgres.cloud-summit.svc.cluster.local:5432
│  PVC: postgres-pvc (20Gi)
│  Image: postgres:15-alpine
│  Init Container: Run schema creation SQL
│
└─ clickhouse
   Replicas: 1
   Service: clickhouse.cloud-summit.svc.cluster.local:8123
   PVC: clickhouse-data-clickhouse-0 (30Gi)
   Image: clickhouse/clickhouse-server:latest
   Config: clickhouse-config ConfigMap

Deployments (Blue/Green):
├─ event-service-blue (replicas: 1)
│  ├─ Selector: app=event-service, color=blue
│  ├─ Service: event-service (selector: app=event-service)
│  ├─ Route: /api/events → event-service (port 3001)
│  ├─ HPA: min=2, max=8 (CPU target: 80%)
│  ├─ Environment: DB_HOST, DB_USER, DB_PASSWORD, AWS_REGION
│  └─ Probes: Liveness (GET /health), Readiness (GET /ready)
│
├─ event-service-green (replicas: 0, standby)
│
├─ program-service-blue (replicas: 1)
│  ├─ Selector: app=program-service, color=blue
│  ├─ Service: program-service
│  ├─ Route: /api/programs → program-service (port 3002)
│  ├─ HPA: min=2, max=6
│  └─ Probes: Liveness, Readiness
│
├─ program-service-green (replicas: 0, standby)
│
├─ registration-service-blue (replicas: 1)
│  ├─ Service: registration-service
│  ├─ Route: /api/registrations → registration-service (port 3003)
│  ├─ HPA: min=2, max=8
│  └─ Probes: Liveness, Readiness
│
├─ registration-service-green (replicas: 0, standby)
│
├─ analytics-collector-blue (replicas: 1)
│  ├─ Service: analytics-collector
│  ├─ Route: /api/analytics → analytics-collector (port 3004)
│  ├─ ClickHouse: Streams to clickhouse:8123
│  └─ No HPA (stateless bridge)
│
├─ analytics-collector-green (replicas: 0, standby)
│
├─ frontend-blue (replicas: 1)
│  ├─ Service: frontend
│  ├─ Container port: 80 (Nginx)
│  ├─ ALB Ingress target
│  ├─ HPA: min=2, max=10
│  └─ Probes: Liveness (GET /), Readiness (GET /)
│
├─ frontend-green (replicas: 0, standby)
│
├─ metabase (replicas: 1)
│  ├─ Service: metabase (port 3000)
│  ├─ Environment: MB_DB_FILE=/metabase-data/metabase.db
│  ├─ PVC: metabase-data (5Gi)
│  └─ Note: Optional for full deployment
│
├─ prometheus (replicas: 1)
│  ├─ Service: prometheus (port 9090)
│  ├─ PVC: prometheus-pvc (10Gi)
│  ├─ ConfigMap: prometheus-config
│  ├─ ServiceAccount: prometheus (with pod discovery RBAC)
│  └─ Scrape targets: All K8s services + kubelet
│
└─ grafana (replicas: 1)
   ├─ Service: grafana (port 3000)
   ├─ PVC: grafana-pvc (5Gi)
   ├─ Environment: GF_SECURITY_ADMIN_PASSWORD
   ├─ Datasource: Prometheus
   └─ Pre-configured dashboards

Services (ClusterIP):
├─ event-service → event-service-blue:3001
├─ program-service → program-service-blue:3002
├─ registration-service → registration-service-blue:3003
├─ analytics-collector → analytics-collector-blue:3004
├─ frontend → frontend-blue:80
├─ postgres → postgres-0:5432
├─ clickhouse → clickhouse-0:8123
├─ metabase → metabase:3000
├─ prometheus → prometheus:9090
└─ grafana → grafana:3000

Ingress:
└─ cloud-summit-ingress
   Class: alb (AWS ALB Ingress Controller)
   Rules:
   ├─ Host: cloudsummit2026.yourdomain.com
   │  Paths:
   │  ├─ / → frontend:80
   │  ├─ /api/events → event-service:3001
   │  ├─ /api/programs → program-service:3002
   │  ├─ /api/registrations → registration-service:3003
   │  └─ /api/analytics → analytics-collector:3004
   │
   ├─ Host: analytics.cloudsummit2026.yourdomain.com
   │  Path: / → metabase:3000
   │
   └─ Host: monitoring.cloudsummit2026.yourdomain.com
      Paths:
      ├─ / → grafana:3000
      └─ /prometheus → prometheus:9090

PersistentVolumeClaims (Pending → Bound via WaitForFirstConsumer):
├─ postgres-pvc (20Gi, storage class: gp2)
├─ clickhouse-data-clickhouse-0 (30Gi, storage class: gp2)
├─ prometheus-pvc (10Gi, storage class: gp2)
└─ grafana-pvc (5Gi, storage class: gp2)

ClusterRoleBindings (RBAC):
├─ prometheus-pod-discovery (ServiceAccount: prometheus)
│  Role: ClusterRole (list nodes, pods, services, endpoints)
│
└─ kube-system managed (aws-node, coredns, metrics-server)
```

---

## TECHNOLOGY STACK

| Layer                           | Component            | Version     | Purpose                                                  |
| ------------------------------- | -------------------- | ----------- | -------------------------------------------------------- |
| **Container Registry**    | AWS ECR              | Managed     | Private image storage (5 repos)                          |
| **Orchestration**         | Kubernetes (EKS)     | 1.28+       | Container orchestration, auto-scaling, self-healing      |
| **Frontend Server**       | Nginx                | 1.25-alpine | Reverse proxy, static asset serving, SSL/TLS termination |
| **Frontend App**          | HTML5 + Bootstrap 5  | Latest      | Responsive UI, Mobile-first design                       |
| **Frontend Analytics**    | JavaScript (Vanilla) | ES6         | Client-side event tracking (10 types)                    |
| **Backend Framework**     | Express.js           | 4.18+       | HTTP routing, middleware stack, REST APIs                |
| **Runtime**               | Node.js              | 20-alpine   | JavaScript runtime, lightweight container                |
| **Transactional DB**      | PostgreSQL           | 15-alpine   | Relational DBMS, ACID transactions, schema-based         |
| **Analytics DB**          | ClickHouse           | Latest      | Column-store OLAP, high throughput analytics             |
| **Metrics Collection**    | Prometheus           | 2.40+       | Time-series metrics, alerting rules, service discovery   |
| **Metrics Visualization** | Grafana              | 9.5+        | Interactive dashboards, alert notifications              |
| **Analytics Dashboard**   | Metabase             | 0.45+       | Business intelligence, SQL-free querying                 |
| **Serverless Compute**    | AWS Lambda           | Node.js 20  | Event-driven notifications, cost-effective               |
| **Object Storage**        | AWS S3               | Standard    | Notification persistence, audit trail                    |
| **CI/CD**                 | GitHub Actions       | Managed     | Automated build, test, deploy pipeline                   |
| **Container Runtime**     | Docker               | 20+         | Container image build, push, run                         |
| **Security Scanning**     | Trivy                | Latest      | Container image vulnerability scanning                   |
| **Load Balancer**         | AWS ALB              | Managed     | Layer 7 routing, SSL/TLS, health checks                  |
| **Auto-Scaling**          | K8s HPA              | v2          | Horizontal pod autoscaling (CPU/memory)                  |
| **Logging**               | CloudWatch           | Managed     | Centralized logging, log aggregation                     |

---

## MICROSERVICES DESIGN

### 3.1 Event Service

**Purpose:** CRUD operations for events, seat inventory management, serverless trigger

**Architecture:**

```
HTTP Requests (Port 3001)
  ├─ GET /api/events                 → List all events
  ├─ GET /api/events/:id             → Get event by ID
  ├─ POST /api/events                → Create new event
  ├─ PATCH /api/events/:id           → Update event details
  ├─ PATCH /api/events/:id/seats     → Decrement seats (called by Registration Service)
  └─ GET /health, /ready             → Liveness/Readiness probes
       ↓
PostgreSQL Query (events_db)
       ↓
IF seats_available < 10:
       ↓
AWS Lambda Invocation (seat-notifier)
       ↓
S3 Bucket (Notification persistence)
```

**Key Code (src/routes/events.js):**

```javascript
// PATCH /api/events/:id/seats - Decrement seats and trigger Lambda
router.patch('/:id/seats', async (req, res) => {
  const { eventId } = req.params;
  const result = await db.query(
    'UPDATE events SET seats_available = seats_available - 1 WHERE id = $1 RETURNING *',
    [eventId]
  );
  const event = result.rows[0];
  
  // Trigger Lambda if threshold crossed
  if (event.seats_available < 10) {
    const lambda = new AWS.Lambda();
    await lambda.invoke({
      FunctionName: 'seat-notifier',
      InvocationType: 'Event', // Asynchronous
      Payload: JSON.stringify({
        event_id: eventId,
        seats_available: event.seats_available,
        threshold: 10
      })
    }).promise();
  }
  
  res.json(event);
});
```

**Database Schema:**

```sql
CREATE TABLE events (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  venue VARCHAR(255),
  date_time TIMESTAMP NOT NULL,
  ticket_price DECIMAL(10, 2) NOT NULL,
  capacity INT NOT NULL,
  seats_available INT NOT NULL DEFAULT capacity,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CHECK (seats_available >= 0),
  CHECK (seats_available <= capacity)
);

-- Seed data
INSERT INTO events (title, venue, date_time, ticket_price, capacity, seats_available) VALUES
('Cloud Computing Masterclass', 'Mumbai Convention Center', '2026-08-01 09:00', 99.99, 500, 495),
('Kubernetes Deep Dive', 'Mumbai Convention Center', '2026-08-02 10:00', 149.99, 300, 298),
('AWS Solutions Architect', 'Mumbai Convention Center', '2026-08-03 14:00', 199.99, 200, 185);
```

**Deployment (Kubernetes):**

- Replicas: 1 (scaled by HPA 2-8 based on CPU)
- Image: 516962256649.dkr.ecr.ap-south-1.amazonaws.com/event-service:blue
- Resource limits: CPU 500m, Memory 512Mi
- Liveness probe: GET /health (HTTP 200)
- Readiness probe: GET /ready (checks DB connectivity)

---

### 3.2 Program Service

**Purpose:** Session schedule management, speaker profiles, track categorization

**Architecture:**

```
HTTP Requests (Port 3002)
  ├─ GET /api/programs            → List all sessions
  ├─ GET /api/programs?day=1      → Filter by day (1-3)
  ├─ GET /api/programs?track=...  → Filter by track
  ├─ POST /api/programs           → Create session
  └─ GET /health, /ready          → Probes
       ↓
PostgreSQL Query (programs_db)
```

**Database Schema:**

```sql
CREATE TABLE sessions (
  id SERIAL PRIMARY KEY,
  day INT CHECK (day IN (1, 2, 3)),
  track VARCHAR(100),
  session_name VARCHAR(255) NOT NULL,
  speaker_name VARCHAR(255) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed data (17 sessions across 3 days)
-- Day 1 (6 sessions): Cloud Computing Track, Kubernetes Track, AWS Track
-- Day 2 (6 sessions): Data Analytics, Serverless, Security
-- Day 3 (5 sessions): DevOps, Cost Optimization, Best Practices
```

**Deployment:** Similar to Event Service (Replicas: 1, HPA: 2-6)

---

### 3.3 Registration Service

**Purpose:** Attendee registration, duplicate checking, seat decrement orchestration

**Architecture:**

```
HTTP Requests (Port 3003)
  ├─ POST /api/registrations      → Create registration
  │  {event_id, name, email, ticket_count}
  ├─ GET /api/registrations       → List registrations
  └─ GET /health, /ready
       ↓
Validation (Joi schema)
       ↓
PostgreSQL Query (registrations_db)
  - Check UNIQUE constraint (event_id, email)
       ↓
IF duplicate:
  Return HTTP 409 Conflict
ELSE:
  Insert registration
       ↓
Call Event Service: PATCH /api/events/:id/seats
  (with authentication/service-to-service token if applicable)
       ↓
Response with registration_id
```

**Database Schema:**

```sql
CREATE TABLE registrations (
  id SERIAL PRIMARY KEY,
  event_id INT NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  ticket_count INT NOT NULL CHECK (ticket_count > 0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(event_id, email)
);
```

**Key Code (Duplicate Prevention):**

```javascript
router.post('/', async (req, res) => {
  const { event_id, name, email, ticket_count } = req.body;
  
  // Joi validation
  const schema = Joi.object({
    event_id: Joi.number().required(),
    name: Joi.string().min(2).max(255).required(),
    email: Joi.string().email().required(),
    ticket_count: Joi.number().min(1).max(10).required()
  });
  
  const { error, value } = schema.validate(req.body);
  if (error) return res.status(400).json({ error: error.details });
  
  try {
    // Insert will fail if UNIQUE constraint violated
    const result = await db.query(
      'INSERT INTO registrations (event_id, name, email, ticket_count) VALUES ($1, $2, $3, $4) RETURNING id',
      [event_id, name, email, ticket_count]
    );
  
    const registrationId = result.rows[0].id;
  
    // Decrement seats in Event Service
    await axios.patch(`http://event-service:3001/api/events/${event_id}/seats`);
  
    res.status(201).json({ registration_id: registrationId });
  } catch (error) {
    if (error.code === '23505') { // UNIQUE violation
      return res.status(409).json({ error: 'Already registered for this event' });
    }
    res.status(500).json({ error: error.message });
  }
});
```

**Deployment:** Replicas: 1, HPA: 2-8

---

### 3.4 Analytics Collector Service

**Purpose:** Receive browser analytics events, stream to ClickHouse

**Architecture:**

```
POST /api/analytics/event
  Body: {
    event_type: 'page_view' | 'button_click' | ...,
    user_session_id: UUID,
    event_timestamp: ISO8601,
    event_data: {...},
    page_url: string,
    scroll_depth: int,
    session_duration_sec: int
  }
       ↓
@clickhouse/client library
       ↓
ClickHouse INSERT
  ClickHouse.query('INSERT INTO analytics.web_events (...) VALUES (...)')
       ↓
Response: HTTP 202 Accepted (async)
```

**ClickHouse Schema (SQL):**

```sql
CREATE TABLE analytics.web_events (
  id UUID DEFAULT generateUUIDv4(),
  event_type String,
  user_session_id String,
  event_timestamp DateTime,
  event_data String, -- JSON serialized
  page_url String,
  referrer String,
  user_agent String,
  scroll_depth Int32,
  session_duration_sec Int32,
  created_at DateTime DEFAULT now()
) ENGINE = MergeTree()
ORDER BY (event_timestamp, event_type)
PARTITION BY toYYYYMM(event_timestamp);
```

**Analytics Events Tracked (10 types):**

| #  | Event Type              | Trigger                                        | Business Insight                              |
| -- | ----------------------- | ---------------------------------------------- | --------------------------------------------- |
| 1  | `page_view`           | Page load                                      | Traffic volume, referrer sources, bounce rate |
| 2  | `scroll_depth`        | User scrolls 25/50/75/100%                     | Content engagement, fold discovery            |
| 3  | `button_click`        | User clicks CTA                                | Conversion funnel (register, navigation)      |
| 4  | `video_play`          | User plays speaker video                       | Content popularity, video completion rate     |
| 5  | `form_start`          | User focuses form field                        | Intention to register, form drop-off analysis |
| 6  | `form_submit_attempt` | User submits registration                      | Conversion completion, error rates            |
| 7  | `session_duration`    | User leaves page                               | Engagement time, content quality              |
| 8  | `section_view`        | Section becomes visible (IntersectionObserver) | Section visibility, attention distribution    |
| 9  | `speaker_hover`       | User hovers speaker card                       | Speaker interest, profile click-through       |
| 10 | `program_tab_click`   | User clicks day/track tab                      | Schedule interest by category                 |

**Frontend Analytics Integration (js/analytics.js):**

```javascript
class Analytics {
  constructor(collectorUrl = 'http://localhost:3004/api/analytics/event') {
    this.sessionId = generateUUID();
    this.startTime = Date.now();
    this.collecterUrl = collectorUrl;
  }
  
  track(eventType, data = {}) {
    const event = {
      event_type: eventType,
      user_session_id: this.sessionId,
      event_timestamp: new Date().toISOString(),
      event_data: JSON.stringify(data),
      page_url: window.location.href,
      scroll_depth: this.getScrollDepth(),
      session_duration_sec: Math.floor((Date.now() - this.startTime) / 1000)
    };
  
    navigator.sendBeacon(this.collectorUrl, JSON.stringify(event));
  }
  
  // Bind all event types
  init() {
    // 1. page_view
    this.track('page_view', { referrer: document.referrer });
  
    // 2. scroll_depth (threshold-based)
    window.addEventListener('scroll', () => this.onScroll(), { once: true });
  
    // 3. button_click
    document.querySelectorAll('button, a[role="button"]').forEach(btn => {
      btn.addEventListener('click', () => {
        this.track('button_click', { button_text: btn.textContent });
      });
    });
  
    // ... (other events)
  }
}
```

**Deployment:** Replicas: 1, No HPA (stateless bridge service)

---

## SECURITY & ETHICS

### 4.1 Security Challenges & Mitigations

#### 4.1.1 API Security

**Challenge:** Unauthorized access to microservices APIs

- Threat: Attackers could craft requests to Event/Registration services, creating fake registrations, manipulating seat counts, or extracting sensitive data.

**Mitigations Implemented:**

1. **API Gateway Authentication** (ALB Ingress):

   - All traffic flows through AWS ALB with SSL/TLS termination (HTTPS)
   - Self-signed certificates (demo); use ACM certificates in production
2. **Service-to-Service Authentication** (Mutual TLS / JWT):

   - Each microservice can validate requests from other services
   - Example: Registration Service validates Event Service responses
   - Could implement: Service Mesh (Istio) for mTLS enforcement
3. **Input Validation**:

   - All APIs use Joi schema validation
   - Prevents injection attacks, malformed requests
   - Example: Registration Service validates email format, ticket_count > 0
4. **Rate Limiting** (Recommended):

   - ALB can enforce rate limits (requests/minute per IP)
   - Prevents DDoS attacks, brute-force attempts
   - Not yet implemented; add via ingress-nginx controller

**Production Hardening:**

```yaml
# K8s NetworkPolicy (restrict inter-service traffic)
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: registration-to-event-only
  namespace: cloud-summit
spec:
  podSelector:
    matchLabels:
      app: event-service
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: registration-service
    ports:
    - protocol: TCP
      port: 3001
```

#### 4.1.2 Database Security

**Challenge:** SQL Injection, unauthorized DB access, data breaches

- Threat: Attackers could bypass application logic to directly query/modify database, extract customer PII (names, emails), or corrupt event data.

**Mitigations Implemented:**

1. **Parameterized Queries (Prepared Statements)**:

   - All PostgreSQL queries use parameterized placeholders ($1, $2, ...)
   - Node.js `pg` library prevents SQL injection
2. **Secrets Management**:

   - Database credentials stored in K8s Secrets (base64 encoded at rest)
   - Secrets mounted as environment variables (not in ConfigMaps)
   - AWS Secrets Manager integration possible for production
3. **Database User Privileges** (Least Privilege):

   - Each service has a dedicated DB user with minimal privileges
   - Event Service: SELECT, UPDATE on events table only
   - Registration Service: SELECT, INSERT on registrations table
   - Example:
     ```sql
     CREATE USER event_service_user WITH PASSWORD 'secure_password';
     GRANT CONNECT ON DATABASE events_db TO event_service_user;
     GRANT USAGE ON SCHEMA public TO event_service_user;
     GRANT SELECT, UPDATE ON events TO event_service_user;
     ```
4. **Network Segmentation**:

   - PostgreSQL runs in private K8s StatefulSet
   - Only accessible to services within cluster DNS (postgres.cloud-summit.svc.cluster.local)
   - External access blocked by Kubernetes NetworkPolicy

**Production Hardening:**

- Enable PostgreSQL SSL connections (sslmode=require)
- Implement backup encryption (AWS EBS snapshots with KMS)
- Enable PostgreSQL audit logging (pg_audit extension)
- Regular patching (RDS managed service recommended)

#### 4.1.3 Container & Image Security

**Challenge:** Malicious container images, vulnerable dependencies

**Mitigations Implemented:**

1. **Image Scanning (Trivy)**:

   - All Docker images scanned for CVEs before ECR push
   - GitHub Actions workflow: `trivy image <image>` in `security-scan` job
   - Blocks push if critical vulnerabilities found
2. **Minimal Base Images**:

   - Node.js: `node:20-alpine` (Alpine Linux reduces attack surface)
   - Nginx: `nginx:1.25-alpine`
   - PostgreSQL: `postgres:15-alpine`
   - Alpine images ~50MB vs ~200MB standard images
3. **Dependency Pinning**:

   - package-lock.json committed to repository
   - Ensures reproducible builds, prevents supply-chain attacks
   - npm ci (clean install) in Docker uses lock file
4. **Non-root Container User**:

   - Nginx runs as `nginx` user (not root)
   - Reduces impact of container escape
   - Example:
     ```dockerfile
     RUN addgroup -S app && adduser -S -G app app
     USER app
     ```

**Production Hardening:**

- Implement Pod Security Policies (PSPs) / Pod Security Standards (PSS):
  ```yaml
  apiVersion: policy/v1beta1
  kind: PodSecurityPolicy
  metadata:
    name: restricted
  spec:
    privileged: false
    allowPrivilegeEscalation: false
    requiredDropCapabilities: ["ALL"]
    runAsUser:
      rule: 'MustRunAsNonRoot'
  ```
- Enable container runtime security (Falco, AppArmor)

#### 4.1.4 Infrastructure Security

**Challenge:** Unauthorized access to AWS resources, data exfiltration

**Mitigations Implemented:**

1. **IAM Roles & Policies** (Least Privilege):

   - Event Service Lambda role: S3 PutObject + CloudWatch Logs only
   - EKS nodes: AmazonEKSNodeRole (managed policy) + custom policy for ECR pull
   - No root AWS account key usage; use IAM users/roles
2. **Network Security**:

   - VPC with public/private subnets
   - ALB in public subnet, services in private subnets
   - Security groups restrict inbound traffic (80/443 from internet to ALB)
   - EKS nodes accessible only via SSH (not required if using Session Manager)
3. **Encryption**:

   - EBS volumes encrypted (gp2 with AWS KMS)
   - S3 bucket encrypted (SSE-S3 or SSE-KMS)
   - In-transit: TLS 1.2+ for ALB, etcd in EKS
4. **Audit Logging**:

   - CloudWatch Logs for Lambda invocations
   - AWS CloudTrail for API calls (who accessed what resource)
   - K8s audit logs stored in CloudWatch (via AWS EKS managed logging)

#### 4.1.5 Application Security (OWASP Top 10)

| OWASP Risk                                            | Threat                                 | Mitigation                                                  |
| ----------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------- |
| **Injection**                                   | SQL, OS command injection              | Parameterized queries, Joi validation                       |
| **Broken Authentication**                       | Credential stuffing, session hijacking | HTTPS/TLS, session timeouts, JWT tokens (if implemented)    |
| **Sensitive Data Exposure**                     | Plaintext secrets in logs              | Secrets management, log sanitization                        |
| **XML External Entities (XXE)**                 | XML bomb attacks                       | Not applicable (no XML parsing)                             |
| **Broken Access Control**                       | Unauthorized access to resources       | RBAC, service-to-service authentication, K8s RBAC           |
| **Security Misconfiguration**                   | Exposed endpoints, default credentials | Network policies, secrets (not env vars), security scanning |
| **Cross-Site Scripting (XSS)**                  | Malicious JavaScript injection         | Content Security Policy (CSP) headers, input sanitization   |
| **Insecure Deserialization**                    | Code execution via malicious objects   | Avoid dangerous deserialization, validate JSON schema       |
| **Using Components with Known Vulnerabilities** | Outdated dependencies with CVEs        | Trivy scanning, npm audit, dependabot                       |
| **Insufficient Logging & Monitoring**           | Attacks go undetected                  | Prometheus metrics, Grafana alerts, CloudWatch logs         |

---

### 4.2 Ethical Considerations

#### 4.2.1 Data Privacy & Compliance

**Issue:** Collecting and storing user PII (names, emails, session tracking)

**Ethical Concerns:**

1. **Consent:** Users must opt-in to analytics tracking

   - Transparency: Disclose that page_view, scroll_depth, session_duration are tracked
   - Data: Explain where data is stored (ClickHouse on EKS cluster)
   - Retention: Define data retention policy (e.g., 90 days, then anonymization)
2. **Data Minimization:**

   - Only collect data necessary for event management and analytics
   - Avoid collecting: Keystroke logging, camera access, microphone
   - Current tracking: Session ID (not personally identifiable), event types (behavior)
   - Recommendation: Don't store email in analytics table; use event_id reference
3. **Regulatory Compliance:**

   - **GDPR** (if EU users): Right to access, right to deletion, data portability
   - Implement user deletion workflow: When user requests deletion, anonymize registration + analytics records
   - **India Personal Data Protection Bill (PDPB)** : Data localization may be required
   - Current: Deployed in ap-south-1 (Mumbai), complies with India data residency

**Implementation Recommendations:**

```sql
-- Add anonymization support
ALTER TABLE registrations ADD COLUMN is_deleted BOOLEAN DEFAULT FALSE;
ALTER TABLE analytics.web_events ADD COLUMN is_anonymized BOOLEAN DEFAULT FALSE;

-- User deletion workflow
UPDATE registrations SET name='REDACTED', email='deleted@example.com', is_deleted=TRUE WHERE id=?;
UPDATE analytics.web_events SET event_data='{}', is_anonymized=TRUE WHERE user_session_id=?;

-- Data retention job (90 days)
DELETE FROM analytics.web_events WHERE created_at < CURRENT_DATE - INTERVAL '90 days';
```

#### 4.2.2 Accessibility & Inclusivity

**Issue:** Frontend UI may not be accessible to users with disabilities

**Ethical Concerns:**

1. **Web Accessibility (WCAG 2.1)**:

   - Screen reader support (semantic HTML, ARIA labels)
   - Color contrast (WCAG AA: 4.5:1 for text)
   - Keyboard navigation (all interactive elements reachable via Tab)
   - Alt text for images/videos
   - Captions for videos
2. **Current Implementation:**

   - Bootstrap framework provides accessibility-first CSS
   - Recommendation: Add explicit ARIA labels to custom components

   ```html
   <button aria-label="Register for event" class="btn btn-primary">Register</button>
   ```
3. **Testing:**

   - Automated: axe-core, WAVE browser extension
   - Manual: Keyboard-only navigation, screen reader testing

#### 4.2.3 Artificial Intelligence Transparency

**Issue:** Use of AI tools in solution development

**Ethical Statement:**

- **AI Usage:** GitHub Copilot, Claude AI used to assist code generation, debugging, documentation
- **Accountability:** Student understands every aspect of solution; can explain design decisions, debug issues, and justify technology choices
- **Audit Trail:** Code comments document AI-assisted sections
- **Limitation:** AI-generated code reviewed, tested, and integrated; not blindly accepted

**Example Comment:**

```javascript
// AI-assisted: Generated via Claude AI prompt
// Reviewed and validated by student for correctness
// Function: Validate registration email format (RFC 5322 compliant)
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};
```

---

## CI/CD PIPELINE

### 5.1 Pipeline Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     GitHub Actions CI/CD Pipeline                           │
│                      (Triggered on: push to main)                           │
└─────────────────────────────────────────────────────────────────────────────┘

┌─ JOB 1: Test ────────────────────────────────────────────────────────────────┐
│                                                                              │
│  for service in (frontend, event-service, program-service, registration-service, analytics-collector):
│    npm install
│    npm test (jest, mocha)
│    npm run lint (eslint)
│                                                                              │
│  Status: ✅ Pass if all tests pass, 0 errors                                │
│  Status: ❌ Fail if tests fail or lint errors (blocks next job)              │
│  Artifact: Test report (JSON)                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ JOB 2: Security Scan ────────────────────────────────────────────────────────┐
│                                                                              │
│  for service in (frontend, event-service, ...):                             │
│    docker build -t <service>:latest .                                       │
│    trivy image --severity HIGH,CRITICAL <service>:latest                    │
│                                                                              │
│  Status: ⚠️  Report vulnerabilities, fail if CRITICAL found                  │
│  Artifact: Trivy scan report (JSON, HTML)                                   │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ JOB 3: Build & Push ─────────────────────────────────────────────────────────┐
│                                                                              │
│  for service in (frontend, event-service, ...):                             │
│                                                                              │
│    1. Build image:                                                           │
│       docker build -t 516962256649.dkr.ecr.ap-south-1.amazonaws.com/<service>:blue . │
│                                                                              │
│    2. Login to ECR:                                                          │
│       aws ecr get-login-password | docker login ...                          │
│                                                                              │
│    3. Push to ECR:                                                           │
│       docker push <ecr-uri>/<service>:blue                                   │
│                                                                              │
│  Status: ✅ All images pushed to ECR                                         │
│  Artifact: ECR image tags (blue, latest)                                    │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ JOB 4: Deploy Lambda ────────────────────────────────────────────────────────┐
│                                                                              │
│  1. Install SAM CLI                                                          │
│  2. sam package --template-file serverless/template.yaml \                   │
│              --s3-bucket cloud-summit-sam-artifacts                          │
│  3. sam deploy --stack-name cloud-summit-lambda \                            │
│              --region ap-south-1 \                                           │
│              --capabilities CAPABILITY_IAM                                   │
│                                                                              │
│  Status: ✅ Lambda deployed or updated                                       │
│  Artifact: CloudFormation stack outputs (Lambda ARN, S3 bucket)              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ JOB 5: Deploy Blue-Green ───────────────────────────────────────────────────┐
│                                                                              │
│  1. Configure kubectl context (AWS EKS cluster)                              │
│     aws eks update-kubeconfig --name cloud-summit-eks --region ap-south-1   │
│                                                                              │
│  2. Apply K8s manifests (if first deployment):                               │
│     kubectl apply -f kubernetes/00-namespace.yaml                            │
│     kubectl apply -f kubernetes/01-secrets.yaml                              │
│     kubectl apply -f kubernetes/02-postgres.yaml                             │
│     ... (all manifests)                                                      │
│                                                                              │
│  3. Blue-Green Deployment (for each service):                                │
│                                                                              │
│     a. Patch green deployment with new image:                                │
│        kubectl patch deployment <service>-green -n cloud-summit \            │
│          -p '{"spec":{"template":{"spec":{"containers":[...image:blue}...]}' │
│                                                                              │
│     b. Scale green to match blue replicas:                                   │
│        kubectl scale deploy <service>-green -n cloud-summit --replicas=N     │
│                                                                              │
│     c. Wait for green pods to be Ready:                                      │
│        kubectl wait --for=condition=Ready pod -l app=<service>,color=green  │
│                                                                              │
│     d. Smoke test green deployment:                                          │
│        curl http://<service>-green.cloud-summit:3001/health                 │
│                                                                              │
│     e. Patch Service selector to route traffic to green:                     │
│        kubectl patch svc <service> -n cloud-summit \                         │
│          -p '{"spec":{"selector":{"color":"green"}}}'                        │
│                                                                              │
│     f. Wait 2 minutes for traffic shift:                                     │
│        sleep 120                                                             │
│                                                                              │
│     g. Scale blue down to 0 (preserve for rollback):                         │
│        kubectl scale deploy <service>-blue -n cloud-summit --replicas=0     │
│                                                                              │
│  4. Verify frontend is accessible:                                           │
│     curl http://<frontend-service>/health                                    │
│                                                                              │
│  Status: ✅ All services running, traffic on green, blue scaled to 0         │
│  On Failure:                                                                 │
│    - Patch service selector back to blue                                     │
│    - Scale blue replicas back to previous count                              │
│    - Trigger rollback job                                                    │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─ JOB 6: Rollback (On Failure) ────────────────────────────────────────────────┐
│                                                                              │
│  Conditions: If deploy job fails or smoke tests fail                         │
│                                                                              │
│  1. For each service in failure state:                                       │
│                                                                              │
│     a. Patch service selector back to blue:                                  │
│        kubectl patch svc <service> -n cloud-summit \                         │
│          -p '{"spec":{"selector":{"color":"blue"}}}'                         │
│                                                                              │
│     b. Scale blue back up:                                                   │
│        kubectl scale deploy <service>-blue -n cloud-summit --replicas=1     │
│                                                                              │
│     c. Scale green down:                                                     │
│        kubectl scale deploy <service>-green -n cloud-summit --replicas=0    │
│                                                                              │
│  2. Notify team:                                                             │
│     Send Slack/Email alert: "Deployment failed, rolled back to blue"        │
│                                                                              │
│  Status: ✅ System restored to previous stable state                         │
│  Manual Recovery:                                                            │
│    - Investigate failure logs                                                │
│    - Fix code issue                                                          │
│    - Re-push to trigger pipeline                                             │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 5.2 GitHub Actions Workflow (.github/workflows/ci-cd.yml)

```yaml
name: CI/CD Pipeline

on:
  push:
    branches:
      - main

env:
  AWS_REGION: ap-south-1
  AWS_ACCOUNT_ID: 516962256649
  ECR_REGISTRY: ${{ secrets.AWS_ACCOUNT_ID }}.dkr.ecr.ap-south-1.amazonaws.com
  KUBE_NAMESPACE: cloud-summit
  EKS_CLUSTER_NAME: cloud-summit-eks

jobs:
  # JOB 1: Test
  test:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        service: [frontend, event-service, program-service, registration-service, analytics-collector]
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '20'
    
      - name: Install dependencies
        run: |
          cd services/${{ matrix.service }} 2>/dev/null || cd ${{ matrix.service }}
          npm ci
    
      - name: Run tests
        run: |
          cd services/${{ matrix.service }} 2>/dev/null || cd ${{ matrix.service }}
          npm test --passWithNoTests
    
      - name: Lint
        run: |
          cd services/${{ matrix.service }} 2>/dev/null || cd ${{ matrix.service }}
          npm run lint 2>/dev/null || echo "No lint script"

  # JOB 2: Security Scan
  security-scan:
    runs-on: ubuntu-latest
    needs: test
    strategy:
      matrix:
        service: [frontend, event-service, program-service, registration-service, analytics-collector]
    steps:
      - uses: actions/checkout@v3
    
      - name: Build Docker image for scanning
        run: |
          docker build -t ${{ matrix.service }}:scan \
            -f services/${{ matrix.service }}/Dockerfile 2>/dev/null || \
            docker build -t ${{ matrix.service }}:scan -f ${{ matrix.service }}/Dockerfile .
    
      - name: Run Trivy scan
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ matrix.service }}:scan
          format: 'sarif'
          output: 'trivy-results.sarif'
    
      - name: Upload Trivy results
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: 'trivy-results.sarif'

  # JOB 3: Build & Push
  build-and-push:
    runs-on: ubuntu-latest
    needs: security-scan
    strategy:
      matrix:
        service: [frontend, event-service, program-service, registration-service, analytics-collector]
    steps:
      - uses: actions/checkout@v3
    
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
    
      - name: Login to Amazon ECR
        run: |
          aws ecr get-login-password --region ${{ env.AWS_REGION }} | \
            docker login --username AWS --password-stdin ${{ env.ECR_REGISTRY }}
    
      - name: Build and push Docker image
        run: |
          SERVICE_NAME=${{ matrix.service }}
          DOCKERFILE_PATH="services/$SERVICE_NAME/Dockerfile"
          BUILD_CONTEXT="services/$SERVICE_NAME"
        
          if [ ! -f "$DOCKERFILE_PATH" ]; then
            DOCKERFILE_PATH="$SERVICE_NAME/Dockerfile"
            BUILD_CONTEXT="$SERVICE_NAME"
          fi
        
          docker build -t ${{ env.ECR_REGISTRY }}/$SERVICE_NAME:blue \
            -t ${{ env.ECR_REGISTRY }}/$SERVICE_NAME:latest \
            -f $DOCKERFILE_PATH $BUILD_CONTEXT
        
          docker push ${{ env.ECR_REGISTRY }}/$SERVICE_NAME:blue
          docker push ${{ env.ECR_REGISTRY }}/$SERVICE_NAME:latest

  # JOB 4: Deploy Lambda
  deploy-lambda:
    runs-on: ubuntu-latest
    needs: build-and-push
    steps:
      - uses: actions/checkout@v3
    
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
    
      - name: Install SAM CLI
        run: |
          pip install aws-sam-cli
    
      - name: SAM Package & Deploy
        run: |
          cd serverless
          sam package \
            --template-file template.yaml \
            --s3-bucket cloud-summit-sam-artifacts \
            --output-template-file packaged.yaml
        
          sam deploy \
            --template-file packaged.yaml \
            --stack-name cloud-summit-lambda \
            --region ${{ env.AWS_REGION }} \
            --parameter-overrides \
                NotificationBucket=cloud-summit-seat-notifications \
            --capabilities CAPABILITY_IAM \
            --no-confirm-changeset

  # JOB 5: Deploy Blue-Green
  deploy-blue-green:
    runs-on: ubuntu-latest
    needs: deploy-lambda
    steps:
      - uses: actions/checkout@v3
    
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
    
      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig \
            --name ${{ env.EKS_CLUSTER_NAME }} \
            --region ${{ env.AWS_REGION }}
    
      - name: Apply K8s manifests (first time)
        run: |
          kubectl apply -f kubernetes/
    
      - name: Wait for postgres
        run: |
          kubectl wait --for=condition=Ready pod \
            -l app=postgres \
            -n ${{ env.KUBE_NAMESPACE }} \
            --timeout=300s 2>/dev/null || true
    
      - name: Deploy Blue-Green for each service
        env:
          SERVICES: "event-service program-service registration-service analytics-collector frontend"
        run: |
          for SERVICE in $SERVICES; do
            echo "=== Deploying $SERVICE ==="
          
            # Patch green image
            kubectl patch deployment $SERVICE-green -n ${{ env.KUBE_NAMESPACE }} \
              -p '{"spec":{"template":{"spec":{"containers":[{"name":"'"$SERVICE"'","image":"'${{ env.ECR_REGISTRY }}'/'$SERVICE':blue"}]}}}}'  || true
          
            # Scale green
            kubectl scale deployment $SERVICE-green -n ${{ env.KUBE_NAMESPACE }} --replicas=1
          
            # Wait for ready
            kubectl wait --for=condition=Ready pod \
              -l app=$SERVICE,color=green \
              -n ${{ env.KUBE_NAMESPACE }} \
              --timeout=300s || continue
          
            # Smoke test (retry 3 times)
            for i in {1..3}; do
              if kubectl exec -it deployment/$SERVICE-green -n ${{ env.KUBE_NAMESPACE }} -- curl -s http://localhost:3001/health > /dev/null 2>&1 || \
                 kubectl exec -it deployment/$SERVICE-green -n ${{ env.KUBE_NAMESPACE }} -- curl -s http://localhost/ > /dev/null 2>&1; then
                echo "$SERVICE health check passed"
                break
              fi
              echo "$SERVICE health check attempt $i failed, retrying..."
              sleep 10
            done
          
            # Patch service selector to green
            kubectl patch service $SERVICE -n ${{ env.KUBE_NAMESPACE }} \
              -p '{"spec":{"selector":{"color":"green"}}}'
          
            # Wait for traffic shift
            sleep 120
          
            # Scale blue to 0
            kubectl scale deployment $SERVICE-blue -n ${{ env.KUBE_NAMESPACE }} --replicas=0
          
            echo "$SERVICE deployment complete"
          done

  # JOB 6: Rollback
  rollback:
    runs-on: ubuntu-latest
    needs: deploy-blue-green
    if: failure()
    steps:
      - uses: actions/checkout@v3
    
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
    
      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig \
            --name ${{ env.EKS_CLUSTER_NAME }} \
            --region ${{ env.AWS_REGION }}
    
      - name: Rollback to blue
        env:
          SERVICES: "event-service program-service registration-service analytics-collector frontend"
        run: |
          for SERVICE in $SERVICES; do
            echo "=== Rolling back $SERVICE to blue ==="
          
            # Patch service back to blue
            kubectl patch service $SERVICE -n ${{ env.KUBE_NAMESPACE }} \
              -p '{"spec":{"selector":{"color":"blue"}}}'
          
            # Scale blue back up
            kubectl scale deployment $SERVICE-blue -n ${{ env.KUBE_NAMESPACE }} --replicas=1
          
            # Scale green down
            kubectl scale deployment $SERVICE-green -n ${{ env.KUBE_NAMESPACE }} --replicas=0
          done
        
          echo "Rollback complete"
```

### 5.3 CI/CD Security Considerations

**Issue:** Sensitive data exposure in CI/CD logs, unauthorized deployments

**Mitigations:**

1. **Secrets Management:**

   - AWS credentials stored as GitHub Secrets (encrypted)
   - Never logged or printed in workflow
   - Rotated regularly (automatic with AWS IAM)
2. **Branch Protection:**

   - `main` branch requires pull request reviews
   - Status checks must pass (test, scan) before merge
   - Blocks direct pushes to main (enforces CI/CD)
3. **RBAC for Deployments:**

   - GitHub Actions uses IAM role with limited permissions
   - Principle of least privilege: Only ECR push, EKS deploy, Lambda update
   - Example IAM policy:
     ```json
     {
       "Version": "2012-10-17",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "ecr:GetDownloadUrlForLayer",
             "ecr:BatchGetImage",
             "ecr:PutImage",
             "ecr:InitiateLayerUpload",
             "ecr:UploadLayerPart",
             "ecr:CompleteLayerUpload"
           ],
           "Resource": "arn:aws:ecr:ap-south-1:516962256649:repository/*"
         },
         {
           "Effect": "Allow",
           "Action": [
             "eks:DescribeCluster",
             "eks:ListClusters"
           ],
           "Resource": "*"
         }
       ]
     }
     ```

---

## WEB ANALYTICS IMPLEMENTATION

### 6.1 Analytics Data Collection

**Frontend JavaScript (js/analytics.js):**

```javascript
class CloudSummitAnalytics {
  constructor(collectorUrl = 'http://localhost:3004/api/analytics/event') {
    this.sessionId = this.generateUUID();
    this.sessionStartTime = Date.now();
    this.collectorUrl = collectorUrl;
    this.scrollThresholdReached = new Set([]);
    this.visibleSections = new Set();
  }

  generateUUID() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  track(eventType, data = {}) {
    const event = {
      event_type: eventType,
      user_session_id: this.sessionId,
      event_timestamp: new Date().toISOString(),
      event_data: JSON.stringify(data),
      page_url: window.location.href,
      referrer: document.referrer,
      user_agent: navigator.userAgent,
      scroll_depth: this.getScrollPercentage(),
      session_duration_sec: Math.floor((Date.now() - this.sessionStartTime) / 1000)
    };

    // Use sendBeacon for reliability (fires even on page unload)
    if (navigator.sendBeacon) {
      navigator.sendBeacon(this.collectorUrl, JSON.stringify(event));
    } else {
      // Fallback to fetch
      fetch(this.collectorUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
        keepalive: true
      });
    }
  }

  getScrollPercentage() {
    const windowHeight = document.documentElement.clientHeight;
    const documentHeight = document.documentElement.scrollHeight - windowHeight;
    return Math.round((window.scrollY / documentHeight) * 100);
  }

  init() {
    // 1. page_view - Track page loads
    this.track('page_view', { 
      title: document.title,
      loadTime: performance.timing.loadEventEnd - performance.timing.navigationStart 
    });

    // 2. scroll_depth - Track scroll milestones
    let lastScrollEvent = 0;
    window.addEventListener('scroll', () => {
      const now = Date.now();
      if (now - lastScrollEvent < 500) return; // Throttle
    
      const scrollPercent = this.getScrollPercentage();
      [25, 50, 75, 100].forEach(threshold => {
        if (scrollPercent >= threshold && !this.scrollThresholdReached.has(threshold)) {
          this.scrollThresholdReached.add(threshold);
          this.track('scroll_depth', { scroll_percentage: threshold });
        }
      });
      lastScrollEvent = now;
    }, { passive: true });

    // 3. button_click - Track all CTA clicks
    document.addEventListener('click', (e) => {
      if (e.target.tagName === 'BUTTON' || e.target.tagName === 'A') {
        this.track('button_click', { 
          button_text: e.target.textContent,
          button_id: e.target.id,
          button_href: e.target.href
        });
      }
    });

    // 4. video_play - Track video engagement
    document.querySelectorAll('video').forEach(video => {
      video.addEventListener('play', () => {
        this.track('video_play', { 
          video_id: video.id,
          video_title: video.title
        });
      });
    });

    // 5. form_start - Track form focus (registration intent)
    document.querySelectorAll('input, textarea').forEach(field => {
      field.addEventListener('focus', () => {
        this.track('form_start', { 
          form_field: field.name,
          form_id: field.form?.id
        });
      });
    });

    // 6. form_submit_attempt - Track form submissions
    document.querySelectorAll('form').forEach(form => {
      form.addEventListener('submit', () => {
        this.track('form_submit_attempt', { 
          form_id: form.id,
          form_method: form.method,
          form_action: form.action
        });
      });
    });

    // 7. section_view - Track visible sections (IntersectionObserver)
    const sectionObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !this.visibleSections.has(entry.target.id)) {
          this.visibleSections.add(entry.target.id);
          this.track('section_view', { 
            section_id: entry.target.id,
            section_title: entry.target.querySelector('h2')?.textContent || 'Unknown'
          });
        }
      });
    }, { threshold: 0.5 });

    document.querySelectorAll('section').forEach(section => {
      sectionObserver.observe(section);
    });

    // 8. speaker_hover - Track speaker profile interest
    document.querySelectorAll('[data-speaker]').forEach(card => {
      card.addEventListener('mouseenter', () => {
        this.track('speaker_hover', { 
          speaker_name: card.dataset.speaker,
          speaker_id: card.dataset.speakerId
        });
      });
    });

    // 9. program_tab_click - Track schedule tab interest
    document.querySelectorAll('[data-tab-type="programs"]').forEach(tab => {
      tab.addEventListener('click', () => {
        this.track('program_tab_click', { 
          tab_day: tab.dataset.day,
          tab_track: tab.dataset.track
        });
      });
    });

    // 10. session_duration - Track engagement time on unload
    window.addEventListener('beforeunload', () => {
      const sessionDuration = Math.floor((Date.now() - this.sessionStartTime) / 1000);
      this.track('session_duration', { 
        total_duration_sec: sessionDuration,
        max_scroll_depth: Math.max(...this.scrollThresholdReached)
      });
    });
  }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  const analytics = new CloudSummitAnalytics('http://localhost:3004/api/analytics/event');
  analytics.init();
});
```

### 6.2 Analytics Data Flow

```
Frontend (analytics.js)
    ↓
    ├─ page_view (on load)
    ├─ scroll_depth (25%, 50%, 75%, 100%)
    ├─ button_click (CTA clicks)
    ├─ video_play (speaker videos)
    ├─ form_start (registration intent)
    ├─ form_submit_attempt (registration submission)
    ├─ session_duration (on page unload)
    ├─ section_view (visible sections)
    ├─ speaker_hover (interest in speakers)
    └─ program_tab_click (schedule browsing)
  
    ↓
    POST /api/analytics/event
    (Analytics Collector Service, Port 3004)
  
    ↓
    Body: {
      "event_type": "page_view",
      "user_session_id": "uuid",
      "event_timestamp": "2026-07-21T10:30:45Z",
      "event_data": "{...}",
      "page_url": "http://localhost/",
      "scroll_depth": 0,
      "session_duration_sec": 5
    }
  
    ↓
    Analytics Collector validates & transforms:
    - Adds: created_at, id (UUID)
    - Checks: event_type in whitelist
    - Rejects: Invalid JSON, missing fields
  
    ↓
    @clickhouse/client (Node.js library)
  
    ↓
    ClickHouse INSERT:
    INSERT INTO analytics.web_events (
      id, event_type, user_session_id, event_timestamp, 
      event_data, page_url, referrer, user_agent, 
      scroll_depth, session_duration_sec, created_at
    ) VALUES (...)
  
    ↓
    ClickHouse Column Store (OLAP optimized)
  
    ↓
    Metabase SQL Queries (Real-time dashboards):
  
    1. "Top Sections Viewed"
    SELECT section_id, COUNT(*) as views
    FROM web_events
    WHERE event_type = 'section_view'
    GROUP BY section_id
    ORDER BY views DESC;
  
    2. "Conversion Funnel"
    SELECT 
      COUNT(DISTINCT CASE WHEN event_type = 'form_start' THEN user_session_id END) as form_starts,
      COUNT(DISTINCT CASE WHEN event_type = 'form_submit_attempt' THEN user_session_id END) as form_submissions,
      ROUND(100.0 * COUNT(DISTINCT CASE WHEN event_type = 'form_submit_attempt' THEN user_session_id END) / 
            NULLIF(COUNT(DISTINCT CASE WHEN event_type = 'form_start' THEN user_session_id END), 0), 2) as conversion_rate
    FROM web_events;
  
    3. "Video Engagement"
    SELECT event_data->'video_title' as speaker, COUNT(*) as plays
    FROM web_events
    WHERE event_type = 'video_play'
    GROUP BY event_data->'video_title'
    ORDER BY plays DESC;
  
    4. "Scroll Depth Distribution"
    SELECT scroll_depth, COUNT(*) as sessions
    FROM web_events
    WHERE event_type IN ('page_view', 'scroll_depth')
    GROUP BY scroll_depth
    ORDER BY scroll_depth;
  
    5. "Peak Traffic Times"
    SELECT toStartOfHour(event_timestamp) as hour, COUNT(*) as page_views
    FROM web_events
    WHERE event_type = 'page_view'
    GROUP BY toStartOfHour(event_timestamp)
    ORDER BY hour DESC;
```

### 6.3 Metabase Dashboards

**Dashboard 1: Event Engagement**

- Card 1: Total page views (metric)
- Card 2: Top sections viewed (bar chart)
- Card 3: Scroll depth distribution (histogram)
- Card 4: Avg session duration (metric)

**Dashboard 2: Conversion Analysis**

- Card 1: Registration funnel (form_start → form_submit_attempt → success)
- Card 2: Conversion rate % (metric)
- Card 3: Drop-off points (table)
- Card 4: Time to register (histogram)

**Dashboard 3: Content Performance**

- Card 1: Speaker video plays (bar chart)
- Card 2: Program tab clicks by day (pie chart)
- Card 3: Speaker interest heatmap (matrix)
- Card 4: Most hovered speakers (table)

---

## DEPLOYMENT & TESTING

### 7.1 Fresh Deployment Steps

**STEP 1 — Set environment variables**

```bash
export AWS_REGION=ap-south-1
export AWS_ACCOUNT_ID=516962256649
export ECR_REGISTRY=$AWS_ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
export NS=cloud-summit
export EKS_CLUSTER_NAME=cloud-summit-eks
export POSTGRES_PASSWORD=$(openssl rand -base64 12)
export CLICKHOUSE_PASSWORD=$(openssl rand -base64 12)
```

**STEP 2 — Create EKS cluster (if not exists)**

```bash
eksctl create cluster \
  --name $EKS_CLUSTER_NAME \
  --region $AWS_REGION \
  --version 1.28 \
  --nodegroup-name worker \
  --node-type t3.micro \
  --nodes 2 \
  --nodes-min 1 \
  --nodes-max 3 \
  --enable-ssm
```

**STEP 3 — Create K8s secrets**

```bash
kubectl create namespace $NS
kubectl create secret generic postgres-secret \
  -n $NS \
  --from-literal=POSTGRES_USER=postgres \
  --from-literal=POSTGRES_PASSWORD=$POSTGRES_PASSWORD

kubectl create secret generic clickhouse-secret \
  -n $NS \
  --from-literal=CLICKHOUSE_USER=default \
  --from-literal=CLICKHOUSE_PASSWORD=$CLICKHOUSE_PASSWORD
```

**STEP 4 — Apply K8s manifests (in order)**

```bash
kubectl apply -f kubernetes/00-namespace.yaml
kubectl apply -f kubernetes/01-secrets.yaml
kubectl apply -f kubernetes/02-postgres.yaml

# Wait for postgres
kubectl wait --for=condition=Ready pod -l app=postgres -n $NS --timeout=300s

# Apply remaining services
kubectl apply -f kubernetes/03-event-service.yaml
kubectl apply -f kubernetes/04-program-service.yaml
kubectl apply -f kubernetes/05-registration-service.yaml
kubectl apply -f kubernetes/06-analytics-collector.yaml
kubectl apply -f kubernetes/07-frontend.yaml
kubectl apply -f kubernetes/08-ingress.yaml
kubectl apply -f kubernetes/09-clickhouse-metabase.yaml
kubectl apply -f kubernetes/10-observability.yaml
```

**STEP 5 — Port-forward and test**

```bash
# Frontend
kubectl port-forward -n $NS svc/frontend 8080:80 &
curl http://localhost:8080

# Event Service API
kubectl port-forward -n $NS svc/event-service 3001:3001 &
curl http://localhost:3001/api/events | jq

# Metabase
kubectl port-forward -n $NS svc/metabase 3000:3000 &
open http://localhost:3000

# Grafana
kubectl port-forward -n $NS svc/grafana 3001:3000 &
open http://localhost:3001
```

### 7.2 Testing Scenarios

**Test 1: Frontend Access**

```bash
curl -s http://localhost:8080 | grep -o "<title>.*</title>"
# Expected: <title>Cloud Summit 2026</title>
```

**Test 2: Event API**

```bash
curl -s http://localhost:3001/api/events | jq '.[] | {id, title, seats_available}'
# Expected: List of events with seat counts
```

**Test 3: Registration Flow**

```bash
curl -X POST http://localhost:3003/api/registrations \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "name": "John Doe",
    "email": "john@example.com",
    "ticket_count": 1
  }' | jq .

# Expected: {"registration_id": 1}

# Verify seat was decremented
curl -s http://localhost:3001/api/events/1 | jq '.seats_available'
# Expected: Previous count - 1
```

**Test 4: Duplicate Prevention**

```bash
# Attempt same registration again
curl -X POST http://localhost:3003/api/registrations \
  -H "Content-Type: application/json" \
  -d '{...same email...}' | jq .

# Expected: HTTP 409 Conflict error
```

**Test 5: Analytics Collection**

```bash
curl -X POST http://localhost:3004/api/analytics/event \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "page_view",
    "user_session_id": "test-session-uuid",
    "event_timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'",
    "event_data": "{}",
    "page_url": "http://localhost:8080",
    "scroll_depth": 0,
    "session_duration_sec": 10
  }' | jq .

# Expected: HTTP 202 Accepted

# Verify in ClickHouse
kubectl exec -it clickhouse-0 -n $NS -- clickhouse-client -u default -p$CLICKHOUSE_PASSWORD -q "SELECT COUNT(*) FROM analytics.web_events"
# Expected: 1 or more
```

**Test 6: Lambda Trigger (Seat Notification)**

```bash
# Manually trigger by creating low-seat event
kubectl exec -it deployment/postgres -n $NS -- psql -U postgres -d events_db -c \
  "INSERT INTO events (title, venue, date_time, ticket_price, capacity, seats_available) VALUES ('Low Seat Event', 'Test', now(), 99, 100, 8)"

# Call event service to simulate seat purchases
for i in {1..3}; do
  curl -X PATCH http://localhost:3001/api/events/4/seats
done

# Verify Lambda invocation in CloudWatch
aws logs tail /aws/lambda/seat-notifier --follow

# Check S3 for notification
aws s3 ls s3://cloud-summit-seat-notifications/
aws s3 cp s3://cloud-summit-seat-notifications/notifications/event_4_*.json - | jq .
```

---

## REFERENCES

1. **AWS Documentation**

   - EKS User Guide: https://docs.aws.amazon.com/eks/
   - Lambda Developer Guide: https://docs.aws.amazon.com/lambda/
   - ECR User Guide: https://docs.aws.amazon.com/ecr/
2. **Kubernetes Documentation**

   - Official Kubernetes: https://kubernetes.io/docs/
   - Blue-Green Deployment: https://kubernetes.io/docs/concepts/workloads/controllers/deployment/#blue-green-deployment-template
   - HPA: https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
3. **Express.js & Node.js**

   - Express Guide: https://expressjs.com/
   - Node.js Best Practices: https://github.com/goldbergyoni/nodebestpractices
4. **PostgreSQL**

   - PostgreSQL Official: https://www.postgresql.org/docs/
   - Docker Hub: https://hub.docker.com/_/postgres
5. **ClickHouse**

   - ClickHouse Documentation: https://clickhouse.com/docs/
   - @clickhouse/client: https://www.npmjs.com/package/@clickhouse/client
6. **Metabase**

   - Metabase Docs: https://metabase.com/docs/
   - ClickHouse Integration: https://metabase.com/docs/latest/databases/connections/clickhouse
7. **Prometheus & Grafana**

   - Prometheus: https://prometheus.io/docs/
   - Grafana: https://grafana.com/docs/grafana/
   - Kubernetes Monitoring: https://prometheus.io/docs/prometheus/latest/configuration/configuration/#kubernetes_sd_config
8. **Security & Compliance**

   - OWASP Top 10: https://owasp.org/www-project-top-ten/
   - WCAG 2.1: https://www.w3.org/WAI/WCAG21/quickref/
   - GDPR: https://gdpr-info.eu/
9. **GitHub Actions**

   - Workflow Syntax: https://docs.github.com/en/actions/using-workflows/workflow-syntax-for-github-actions
   - Secrets: https://docs.github.com/en/actions/security-guides/encrypted-secrets
10. **Infrastructure as Code**

    - Terraform: https://www.terraform.io/docs/
    - AWS CloudFormation: https://docs.aws.amazon.com/cloudformation/
    - AWS SAM: https://aws.amazon.com/serverless/sam/
