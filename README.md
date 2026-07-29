# Cloud Summit 2026 — CMM707 Cloud Computing Assignment

## Project Overview

This repository contains the complete cloud-native solution for the **New Event** web application deployed on **AWS EKS** as a microservices architecture.

---

## Architecture Summary

```
                    ┌──────────────────────────────────────────────────────────────┐
                    │                    AWS EKS Cluster (ap-south-1)               │
                    │   Namespace: cloud-summit                                    │
                    │                                                              │
  Internet          │  ┌──────────┐   ┌──────────────────────────────────────┐    │
  ──────────── ALB ─┼─▶│ Frontend │──▶│          Nginx Reverse Proxy         │    │
    (HTTPS)         │  │ (Nginx)  │   │  /api/events  → event-service:3001   │    │
                    │  └──────────┘   │  /api/programs → program-service:3002 │    │
                    │                 │  /api/registrations → reg-svc:3003    │    │
                    │                 │  /api/analytics → analytics-col:3004  │    │
                    │                 └──────────────────────────────────────┘    │
                    │                                                              │
                    │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
                    │  │ Event Service│  │Program Service│  │Registration Svc  │  │
                    │  │  Port 3001   │  │  Port 3002   │  │   Port 3003      │  │
                    │  │  Blue/Green  │  │  Blue/Green  │  │   Blue/Green     │  │
                    │  └──────┬───────┘  └──────┬───────┘  └────────┬─────────┘  │
                    │         │       
                    │                    │            │
                    │         └─────────────────┴──────────┬─────────┘            │
                    │                                       ▼                      │
                    │                            ┌──────────────────┐             │
                    │                            │  PostgreSQL DB   │             │
                    │                            │ events_db        │             │
                    │                            │ programs_db      │             │
                    │                            │ registrations_db │             │
                    │                            └──────────────────┘             │
                    │                                                              │
                    │  ┌─────────────────────┐  ┌─────────────┐                  │
                    │  │ Analytics Collector  │  │  ClickHouse │                  │
                    │  │  Port 3004          │──▶│  Port 8123  │                  │
                    │  │  Blue/Green         │  └─────────────┘                  │
                    │  └─────────────────────┘         │                          │
                    │                                   ▼                          │
                    │                         ┌──────────────────┐                │
                    │                         │    Metabase      │                │
                    │                         │ Analytics Dash   │                │
                    │                         └──────────────────┘                │
                    │                                                              │
                    │  ┌────────────┐  ┌────────────────────────────────────┐     │
                    │  │ Prometheus │  │        Grafana Dashboards           │     │
                    │  │  Metrics   │─▶│  Service Health & Performance       │     │
                    │  └────────────┘  └────────────────────────────────────┘     │
                    └──────────────────────────────────────────────────────────────┘
                                                │
                    ┌───────────────────────────┴────────────────────────────────┐
                    │              AWS Serverless                                │
                    │                                                            │
                    │  Event Service ──seats < 10──▶ Lambda (seat-notifier)     │
                    │                                       │                   │
                    │                                       ▼                   │
                    │                            S3 Bucket: seat-notifications  │
                    └────────────────────────────────────────────────────────────┘
```

---

## Solution Requirements Coverage

| Requirement                       | Implementation                                                                                                     |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **1. Frontend Deployment**  | Nginx serving Bootstrap HTML, deployed as K8s Deployment behind ALB Ingress                                        |
| **2. Event Service**        | Node.js/Express, PostgreSQL`events_db`, Blue/Green HPA 2-8 pods                                                  |
| **2. Program Service**      | Node.js/Express, PostgreSQL`programs_db`, Blue/Green HPA 2-6 pods                                                |
| **2. Registration Service** | Node.js/Express, PostgreSQL`registrations_db`, Blue/Green, duplicate-check                                       |
| **2. Seat Notifier**        | AWS Lambda triggered when`seats_available < 10`, writes JSON to S3                                               |
| **3. Transactional DB**     | PostgreSQL (AWS RDS compatible), separate DB per service                                                           |
| **4. Web Analytics**        | 10 event types tracked, streamed to ClickHouse via Analytics Collector                                             |
| **5. Analytics Dashboard**  | Metabase connected to ClickHouse                                                                                   |
| **6. Observability**        | Prometheus (auto-scrape) + Grafana dashboards + AlertManager rules                                                 |
| **7. CI/CD Blue-Green**     | GitHub Actions: test → scan → build → push → deploy green → health check → switch traffic → scale down blue |

---

## Web Analytics Tracked (10 types)

| #  | Event Type              | Description                                             | Business Value            |
| -- | ----------------------- | ------------------------------------------------------- | ------------------------- |
| 1  | `page_view`           | Every page load with referrer & user agent              | Traffic volume & sources  |
| 2  | `session_duration`    | Time on page + max scroll depth                         | Engagement quality        |
| 3  | `scroll_depth`        | 25/50/75/100% milestones                                | Content consumption depth |
| 4  | `button_click`        | All CTA buttons (register, nav, hero)                   | Conversion funnel         |
| 5  | `video_play`          | Which video was played                                  | Content popularity        |
| 6  | `section_view`        | Which sections user actually saw (IntersectionObserver) | Content visibility        |
| 7  | `form_start`          | User focused first form field                           | Registration intent       |
| 8  | `form_submit_attempt` | Registration form submitted                             | Conversion attempt        |
| 9  | `speaker_hover`       | Which speaker profiles were hovered                     | Speaker interest          |
| 10 | `program_tab_click`   | Which program day tab was clicked                       | Schedule interest         |

---

## Project Structure

```
jul-project-srihari/
├── .github/
│   └── workflows/
│       └── ci-cd.yml               ← GitHub Actions CI/CD pipeline
├── frontend/
│   ├── index.html                  ← New Event template (Cloud Summit)
│   ├── css/style.css               ← Custom styles
│   ├── js/
│   │   ├── analytics.js            ← 10-metric analytics tracker
│   │   └── app.js                  ← API integration & UI logic
│   ├── nginx.conf                  ← Nginx reverse proxy config
│   └── Dockerfile                  ← Nginx-based container
├── services/
│   ├── event-service/              ← Event CRUD + Lambda trigger
│   ├── program-service/            ← Schedule/agenda management
│   ├── registration-service/       ← Attendee registration
│   └── analytics-collector/        ← Receives events → ClickHouse
├── serverless/
│   └── seat-notifier/              ← AWS Lambda + SAM template
│       ├── index.js
│       ├── package.json
│       └── template.yaml
├── kubernetes/
│   ├── 00-namespace.yaml
│   ├── 01-secrets.yaml
│   ├── 02-postgres.yaml
│   ├── 03-event-service.yaml       ← Blue/Green + HPA
│   ├── 04-program-service.yaml     ← Blue/Green + HPA
│   ├── 05-registration-service.yaml← Blue/Green + HPA
│   ├── 06-analytics-collector.yaml ← Blue/Green
│   ├── 07-frontend.yaml            ← Blue/Green + HPA
│   ├── 08-ingress.yaml             ← AWS ALB Ingress
│   ├── 09-clickhouse-metabase.yaml ← Analytics stack
│   └── 10-observability.yaml       ← Prometheus + Grafana
└── docs/
    └── RUNBOOK.md                  ← Complete deployment guide
```

---

## Security Measures

- **Helm/Secrets**: K8s Secrets for DB passwords and AWS credentials (use AWS Secrets Manager in production)
- **Helmet.js**: HTTP security headers on all Node.js services
- **Rate limiting**: Per-endpoint limits (30 req/min on registration, 200 req/min on APIs)
- **Input validation**: Joi schema validation on all API inputs
- **XSS prevention**: `escapeHtml()` in frontend JS, Content-Security-Policy headers
- **Non-root containers**: All Dockerfiles run as non-root user
- **WAF**: AWS WAFv2 attached to ALB Ingress
- **HTTPS only**: SSL redirect enforced on Ingress
- **IP anonymisation**: Last octet zeroed in analytics (GDPR compliance)
- **CORS**: Restricted origins on all services

---

## Quick Start (Local Testing with Docker Compose)

```bash
# Start all services locally
docker compose up -d

# View logs
docker compose logs -f

# Stop
docker compose down
```

See [docs/RUNBOOK.md](docs/RUNBOOK.md) for full cloud deployment steps.

---

## CI/CD Blue-Green Process

```
Push to main
     │
     ▼
┌─── Tests ──── Security Scan ───┐
│                                │
▼                                ▼
Build & Push :green images     Lambda Deploy
     │
     ▼
Patch Green deployments (new image)
     │
     ▼
Scale Green to 2 replicas
     │
     ▼
Wait for Green ready (rollout status)
     │
     ▼
Smoke test Green
     │
     ├── FAIL ──▶ Scale Green to 0 (Blue still live) ──▶ ROLLBACK
     │
     ▼ PASS
Switch Service selectors to Green
     │
     ▼
Scale Blue to 0
     │
     ▼
Retag Green image as :blue (ready for next cycle)
     │
     ▼
Deployment complete ✓
```
