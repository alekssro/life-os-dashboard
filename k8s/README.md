# Kubernetes Deployment Guide for Life OS

This directory contains cloud-native Kubernetes manifests to deploy Life OS in a secure, production-grade configuration.

---

## Architecture in Kubernetes

- **Namespace**: `lifeos`
- **Database**: PostgreSQL 16 Alpine running as a `StatefulSet` with `PersistentVolumeClaim` (10Gi) and `pg_isready` probes.
- **Application**: Next.js Standalone container running as an unprivileged non-root user (`UID 1001`, `drop: [ALL]`).
- **Health Checks & Probes**:
  - **Liveness Probe**: `GET /api/health/live` (process availability).
  - **Readiness Probe**: `GET /api/health/ready` (validates active PostgreSQL connection before routing traffic).
  - **Startup Probe**: `GET /api/health/ready` (grants migration and startup leeway without killing the container).
- **Service & Ingress**: `ClusterIP` with standard NGINX Ingress & Cert-Manager Let's Encrypt TLS annotations.

---

## 1-Command Deployment

### 1. Create Secrets from Template
```bash
cp k8s/secret.yaml.example k8s/secret.yaml
# Edit k8s/secret.yaml with your passwords and API keys
kubectl apply -f k8s/secret.yaml
```

### 2. Apply All Resources via Kustomize
```bash
kubectl apply -k k8s/
```

### 3. Verify Deployment
```bash
kubectl get pods -n lifeos
kubectl logs -n lifeos -l app.kubernetes.io/name=lifeos-app -f
```
