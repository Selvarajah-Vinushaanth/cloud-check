# Cloud Summit 2026 — Deployment Runbook

> **Module:** CMM707 Cloud Computing | **Platform:** AWS EKS
> **Version:** 1.0 | **Last Updated:** July 2026

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Infrastructure Setup — AWS EKS Cluster](#2-infrastructure-setup--aws-eks-cluster)
3. [Container Registry Setup (ECR)](#3-container-registry-setup-ecr)
4. [Build &amp; Push Docker Images (Initial)](#4-build--push-docker-images-initial)
5. [Deploy Serverless Lambda (Seat Notifier)](#5-deploy-serverless-lambda-seat-notifier)
6. [Deploy Kubernetes Workloads](#6-deploy-kubernetes-workloads)
7. [Verify All Services Running](#7-verify-all-services-running)
8. [Test the Application](#8-test-the-application)
9. [Verify Analytics (ClickHouse)](#9-verify-analytics-clickhouse)
10. [Access Metabase Dashboard](#10-access-metabase-dashboard)
11. [Access Grafana Observability Dashboard](#11-access-grafana-observability-dashboard)
12. [CI/CD Pipeline Setup (GitHub Actions)](#12-cicd-pipeline-setup-github-actions)
13. [Rollback Procedure](#13-rollback-procedure)
14. [Troubleshooting](#14-troubleshooting)

---

## 1. Prerequisites

Install the following tools on your local machine:

```bash
# AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip && sudo ./aws/install
aws --version

# kubectl
curl -LO "https://dl.k8s.io/release/$(curl -Ls https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
chmod +x kubectl && sudo mv kubectl /usr/local/bin/
kubectl version --client

# eksctl
curl --silent --location "https://github.com/weaveworks/eksctl/releases/latest/download/eksctl_Linux_amd64.tar.gz" | tar xz -C /tmp
sudo mv /tmp/eksctl /usr/local/bin/
eksctl version

# Docker
sudo apt-get install docker.io -y
docker --version

# AWS SAM CLI (for Lambda)
pip install aws-sam-cli
sam --version
```

Configure AWS credentials:

```bash
aws configure
# Enter: AWS Access Key ID, Secret Access Key, Region (ap-south-1), output (json)
```

---

## 2. Infrastructure Setup — AWS EKS Cluster

Create the EKS cluster (takes ~15-20 minutes):

```bash
eksctl create cluster \
  --name cloud-summit-eks \
  --region ap-south-1 \
  --nodegroup-name standard-workers \
  --node-type t3.medium \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 6 \
  --managed
```

Update kubeconfig:

```bash
aws eks update-kubeconfig \
  --region ap-south-1 \
  --name cloud-summit-eks
```

Verify cluster access:

```bash
kubectl get nodes
# Expected: 3 nodes in Ready state
```

Install AWS Load Balancer Controller (for Ingress):

```bash
# Create IAM OIDC provider
eksctl utils associate-iam-oidc-provider \
  --cluster cloud-summit-eks \
  --approve

# Download and apply IAM policy
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.7.0/docs/install/iam_policy.json
aws iam create-policy \
  --policy-name AWSLoadBalancerControllerIAMPolicy \
  --policy-document file://iam_policy.json

# Create service account
eksctl create iamserviceaccount \
  --cluster=cloud-summit-eks \
  --namespace=kube-system \
  --name=aws-load-balancer-controller \
  --attach-policy-arn=arn:aws:iam::$(aws sts get-caller-identity --query Account --output text):policy/AWSLoadBalancerControllerIAMPolicy \
  --override-existing-serviceaccounts \
  --approve

# Install via Helm
helm repo add eks https://aws.github.io/eks-charts
helm repo update
helm install aws-load-balancer-controller eks/aws-load-balancer-controller \
  -n kube-system \
  --set clusterName=cloud-summit-eks \
  --set serviceAccount.create=false \
  --set serviceAccount.name=aws-load-balancer-controller
```

---

## 3. Container Registry Setup (ECR)

Create ECR repositories for each service:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGION=ap-south-1

for service in frontend event-service program-service registration-service analytics-collector; do
  aws ecr create-repository \
    --repository-name $service \
    --region $REGION \
    --image-scanning-configuration scanOnPush=true
  echo "Created: $ACCOUNT_ID.dkr.ecr.$REGION.amazonaws.com/$service"
done
```

Login to ECR:

```bash
aws ecr get-login-password --region ap-south-1 | \
  docker login --username AWS --password-stdin \
  $ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com
```

---

## 4. Build & Push Docker Images (Initial)

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com"

# Build and push frontend
cd frontend
docker build -t $REGISTRY/frontend:blue .
docker push $REGISTRY/frontend:blue
cd ..

# Build and push each service
for service in event-service program-service registration-service analytics-collector; do
  cd services/$service
  docker build -t $REGISTRY/$service:blue .
  docker push $REGISTRY/$service:blue
  cd ../..
done

echo "All images pushed successfully"
```

Update the Kubernetes YAML files to replace `YOUR_REGISTRY` with your actual ECR registry URL:

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
REGISTRY="$ACCOUNT_ID.dkr.ecr.ap-south-1.amazonaws.com"

# Replace placeholder in all K8s manifests
find kubernetes/ -name "*.yaml" -exec sed -i "s|YOUR_REGISTRY|$REGISTRY|g" {} \;
```

---

## 5. Deploy Serverless Lambda (Seat Notifier)

```bash
cd serverless/seat-notifier

# Install dependencies
npm install --omit=dev

# Build and deploy with SAM
sam build
sam deploy \
  --stack-name cloud-summit-serverless \
  --capabilities CAPABILITY_IAM \
  --region ap-south-1 \
  --guided   # First time only; follow the prompts

cd ../..
```

Note the Lambda ARN from outputs:

```bash
aws cloudformation describe-stacks \
  --stack-name cloud-summit-serverless \
  --query "Stacks[0].Outputs"
```

---

## 6. Deploy Kubernetes Workloads

Deploy all manifests in order:

```bash
# Update secrets FIRST (replace placeholder base64 values with real ones)
# Encode your actual DB password:
# echo -n "your_actual_db_password" | base64

# Apply manifests in order
kubectl apply -f kubernetes/00-namespace.yaml
kubectl apply -f kubernetes/01-secrets.yaml
kubectl apply -f kubernetes/02-postgres.yaml

# Wait for PostgreSQL to be ready
kubectl wait --for=condition=ready pod -l app=postgres -n cloud-summit --timeout=120s

# Deploy application services
kubectl apply -f kubernetes/03-event-service.yaml
kubectl apply -f kubernetes/04-program-service.yaml
kubectl apply -f kubernetes/05-registration-service.yaml
kubectl apply -f kubernetes/06-analytics-collector.yaml
kubectl apply -f kubernetes/07-frontend.yaml

# Deploy analytics stack (ClickHouse + Metabase)
kubectl apply -f kubernetes/09-clickhouse-metabase.yaml

# Deploy observability stack (Prometheus + Grafana)
kubectl apply -f kubernetes/10-observability.yaml

# Wait for all deployments
kubectl rollout status deployment --timeout=120s -n cloud-summit

# Apply Ingress LAST (update domain/cert ARN first in 08-ingress.yaml)
kubectl apply -f kubernetes/08-ingress.yaml
```

---

## 7. Verify All Services Running

```bash
# Check all pods
kubectl get pods -n cloud-summit

# Expected output: all pods in Running state
# NAME                                      READY   STATUS    RESTARTS
# analytics-collector-blue-xxx              1/1     Running   0
# clickhouse-0                              1/1     Running   0
# event-service-blue-xxx                    1/1     Running   0
# frontend-blue-xxx                         1/1     Running   0
# grafana-xxx                               1/1     Running   0
# metabase-xxx                              1/1     Running   0
# postgres-xxx                              1/1     Running   0
# program-service-blue-xxx                  1/1     Running   0
# prometheus-xxx                            1/1     Running   0
# registration-service-blue-xxx             1/1     Running   0

# Check services
kubectl get services -n cloud-summit

# Check Ingress and get the ALB DNS
kubectl get ingress -n cloud-summit
# Note the ADDRESS column — this is your application URL
```

---

## 8. Test the Application

### 8.1 Test individual service health endpoints

```bash
# Port-forward to test locally
kubectl port-forward -n cloud-summit deployment/event-service-blue 3001:3001 &
kubectl port-forward -n cloud-summit deployment/program-service-blue 3002:3002 &
kubectl port-forward -n cloud-summit deployment/registration-service-blue 3003:3003 &

# Test Event Service
curl http://localhost:3001/health
# Expected: {"status":"healthy","service":"event-service",...}

curl http://localhost:3001/api/events
# Expected: {"events":[...],"total":1}

# Test Program Service
curl http://localhost:3002/health
curl http://localhost:3002/api/programs

# Test Registration Service
curl http://localhost:3003/health

# Create a test registration
curl -X POST http://localhost:3003/api/registrations \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": 1,
    "name": "Test User",
    "email": "test@example.com",
    "ticket_count": 2
  }'
# Expected: {"registration_id":"...","status":"confirmed",...}

# Kill port-forwards when done
kill %1 %2 %3
```

### 8.2 Test Frontend via Ingress

```bash
# Get ALB DNS name
ALB_DNS=$(kubectl get ingress cloud-summit-ingress -n cloud-summit -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Application URL: http://$ALB_DNS"

# Test frontend
curl -I http://$ALB_DNS/
# Expected: HTTP/1.1 200 OK

# Test API proxy through frontend
curl http://$ALB_DNS/api/events
curl http://$ALB_DNS/api/programs
```

### 8.3 Test Analytics Collector

```bash
kubectl port-forward -n cloud-summit deployment/analytics-collector-blue 3004:3004 &

curl -X POST http://localhost:3004/api/analytics/event \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "test_session_001",
    "visitor_id": "visitor_001",
    "event_type": "page_view",
    "page_url": "/",
    "timestamp": "2026-07-20T10:00:00Z",
    "properties": {"title": "Cloud Summit 2026"}
  }'
# Expected: HTTP 204 No Content

# Check summary
curl http://localhost:3004/api/analytics/summary
kill %1
```

### 8.4 Verify Seat-Low Notification (Lambda trigger)

```bash
# Manually update event seats to below threshold to trigger Lambda
kubectl port-forward -n cloud-summit deployment/event-service-blue 3001:3001 &

curl -X PATCH http://localhost:3001/api/events/1 \
  -H "Content-Type: application/json" \
  -d '{"seats_available": 5}'

# Check S3 bucket for notification
aws s3 ls s3://cloudsummit-seat-notifications-$(aws sts get-caller-identity --query Account --output text)/notifications/1/

kill %1
```

---

## 9. Verify Analytics (ClickHouse)

```bash
kubectl port-forward -n cloud-summit statefulset/clickhouse 8123:8123 &

# Check ClickHouse is accessible
curl http://localhost:8123/ping
# Expected: Ok.

# Query analytics data
curl -s "http://localhost:8123/?query=SELECT+event_type,+count()+as+total+FROM+analytics.web_events+GROUP+BY+event_type+FORMAT+JSON"

# Full analytics summary query
curl -s "http://localhost:8123/" \
  --data "SELECT event_type, count() AS total, uniq(session_id) AS sessions, uniq(visitor_id) AS visitors FROM analytics.web_events GROUP BY event_type ORDER BY total DESC FORMAT JSON"

kill %1
```

---

## 10. Access Metabase Dashboard

```bash
# Get Metabase URL
METABASE_DNS=$(kubectl get ingress metabase-ingress -n cloud-summit -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')
echo "Metabase: https://analytics.cloudsummit2026.yourdomain.com"

# Or port-forward locally
kubectl port-forward -n cloud-summit deployment/metabase 3000:3000 &
echo "Open: http://localhost:3000"
```

**Metabase Setup (first time):**

1. Open the URL above in your browser
2. Click "Get started" and create an admin account
3. Add a new Database connection:
   - Type: **ClickHouse** (install the ClickHouse plugin from Admin → Databases)
   - Host: `clickhouse` (internal) or `localhost` if port-forwarding
   - Port: `8123`
   - Database: `analytics`
4. Create dashboards with queries like:
   - Page views over time: `SELECT toDate(timestamp) AS day, count() AS views FROM analytics.web_events WHERE event_type='page_view' GROUP BY day ORDER BY day`
   - Top sections viewed: `SELECT JSONExtractString(properties, 'section_id') AS section, count() FROM analytics.web_events WHERE event_type='section_view' GROUP BY section ORDER BY count() DESC`
   - Registration funnel: `SELECT event_type, count() FROM analytics.web_events WHERE event_type IN ('form_start','form_submit_attempt','registration_success','registration_error') GROUP BY event_type`

---

## 11. Access Grafana Observability Dashboard

```bash
kubectl port-forward -n cloud-summit deployment/grafana 3001:3000 &
echo "Open: http://localhost:3001"
# Login: admin / changeme123!
```

**Import pre-built dashboards:**

- Dashboard 1576 (Kubernetes Pod Metrics)
- Dashboard 6417 (Node.js Process Metrics)
- Dashboard 13645 (ClickHouse metrics)

---

## 12. CI/CD Pipeline Setup (GitHub Actions)

### Required GitHub Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions. Add:

| Secret Name               | Value                           |
| ------------------------- | ------------------------------- |
| `AWS_ACCESS_KEY_ID`     | Your AWS access key ID          |
| `AWS_SECRET_ACCESS_KEY` | Your AWS secret access key      |
| `AWS_ACCOUNT_ID`        | Your AWS account ID (12 digits) |

### Trigger the Pipeline

```bash
# The pipeline triggers automatically on push to main
git add .
git commit -m "feat: initial deployment"
git push origin main
```

Monitor at: `https://github.com/YOUR_USERNAME/YOUR_REPO/actions`

---

## 13. Rollback Procedure

### Automatic Rollback

The CI/CD pipeline automatically rolls back if the `deploy-blue-green` job fails.

### Manual Rollback

```bash
NS=cloud-summit

# Switch all services back to Blue
for svc in event-service program-service registration-service analytics-collector frontend; do
  kubectl patch service/$svc -n $NS \
    --type='json' \
    -p='[{"op":"replace","path":"/spec/selector/version","value":"blue"}]'
  kubectl scale deployment/${svc}-blue  --replicas=2 -n $NS
  kubectl scale deployment/${svc}-green --replicas=0 -n $NS
  echo "Rolled back: $svc"
done

echo "ROLLBACK COMPLETE"
kubectl get pods -n $NS
```

---

## 14. Troubleshooting

### Pod is in CrashLoopBackOff

```bash
kubectl logs <pod-name> -n cloud-summit
kubectl describe pod <pod-name> -n cloud-summit
```

### Database Connection Failed

```bash
# Verify postgres is running
kubectl get pod -l app=postgres -n cloud-summit
kubectl logs -l app=postgres -n cloud-summit

# Test connection from within a service pod
kubectl exec -it <event-service-pod> -n cloud-summit -- sh
# Inside pod: nc -zv postgres 5432
```

### Ingress not getting an address

```bash
kubectl get events -n kube-system | grep aws-load-balancer
kubectl logs -n kube-system -l app.kubernetes.io/name=aws-load-balancer-controller
```

### ClickHouse not accepting connections

```bash
kubectl logs statefulset/clickhouse -n cloud-summit
# Check the PVC is bound
kubectl get pvc -n cloud-summit
```

### Analytics not appearing in ClickHouse

```bash
# Check analytics-collector logs
kubectl logs -l app=analytics-collector -n cloud-summit

# Verify events table exists
kubectl port-forward statefulset/clickhouse 8123:8123 -n cloud-summit &
curl "http://localhost:8123/?query=SHOW+TABLES+FROM+analytics"
```

---

## Useful Commands Reference

```bash
# Get all resources in namespace
kubectl get all -n cloud-summit

# Watch pod status in real-time
kubectl get pods -n cloud-summit -w

# Tail logs from a service
kubectl logs -f -l app=event-service -n cloud-summit

# Exec into a pod
kubectl exec -it $(kubectl get pod -l app=event-service -n cloud-summit -o name | head -1) \
  -n cloud-summit -- sh

# Delete and re-create a stuck deployment
kubectl rollout restart deployment/event-service-blue -n cloud-summit

# Scale deployments manually
kubectl scale deployment/event-service-blue --replicas=3 -n cloud-summit

# Get resource usage
kubectl top pods -n cloud-summit
kubectl top nodes
```
