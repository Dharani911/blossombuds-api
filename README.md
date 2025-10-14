# Blossom & Buds API

Spring Boot 3 + PostgreSQL + Liquibase. Local DB via Docker. Staging/Prod on Supabase (Session Pooler).

## Prerequisites
- **Java 17+** (Java 21 LTS recommended)
- **Docker Desktop**
- **Git** (optional)
- **Maven Wrapper** (repo includes `mvnw`)

## Environments
- **Local** (Docker Postgres on `127.0.0.1:5544`)
- **Staging** (Supabase Session Pooler, IPv4)
- **Prod** (Supabase Session Pooler, IPv4)

---

## 1) Local setup

### 1.1 Start Postgres (Docker)
From `infra/`:
```bash
docker compose up -d
docker logs bb-pg --tail=20
