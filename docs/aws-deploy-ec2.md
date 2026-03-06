# AWS 배포 가이드 (EC2 + RDS + ElastiCache)

이 프로젝트는 `worker`가 채점 시점에 Docker 컨테이너를 동적으로 실행합니다.  
그래서 기본 권장안은 `EC2 + Docker Compose`입니다.

- `server`: API 서버
- `worker`: 채점 워커
- `docker-proxy`: Docker socket 제한 프록시
- `RDS PostgreSQL`: 운영 DB
- `ElastiCache Redis`: 큐/이벤트 브로커

## 1) AWS 리소스 준비

1. `EC2 (Ubuntu 22.04+)` 1대 이상
2. `RDS PostgreSQL 15` (DB 이름: `oj`)
3. `ElastiCache Redis 7`
4. `EBS` 또는 `EFS` (문제/테스트케이스 파일 저장 경로)

권장 보안 설정:

- EC2 인바운드: `22`(관리 IP), `80/443`(서비스용)
- EC2 `3000` 포트는 외부 오픈 대신 리버스 프록시(ALB/Nginx)만 허용
- RDS/Redis는 EC2 보안그룹에서만 접근 허용

## 2) EC2 초기 설정

```bash
sudo apt-get update
sudo apt-get install -y docker.io docker-compose-plugin git
sudo usermod -aG docker $USER
newgrp docker
```

레포 클론 후 데이터 디렉터리 준비:

```bash
git clone <your-repo-url>
cd hssh_oj
sudo mkdir -p /srv/oj/data
sudo chown -R $USER:$USER /srv/oj
```

## 3) 환경변수 설정

```bash
cp .env.aws.example .env.aws
```

`.env.aws`에서 최소 아래 항목은 반드시 수정:

- `DATABASE_URL` (RDS 엔드포인트)
- `REDIS_URL` (ElastiCache 엔드포인트)
- `JWT_SECRET` (긴 랜덤 문자열)
- `ADMIN_PASSWORD`
- `CORS_ORIGIN` (프론트 도메인)
- `COOKIE_SAMESITE` (Vercel 프론트 별도 도메인이면 `none`)
- `COOKIE_SECURE` (`COOKIE_SAMESITE=none`이면 반드시 `true`)

HTTPS가 붙기 전 임시 테스트라면 `COOKIE_SECURE=false`로 두고,  
운영 전환 시 `COOKIE_SECURE=true`로 변경하세요.

Vercel 프론트를 같이 쓰는 경우 예시:

- 프론트: `https://oj.example.com` (Vercel)
- API: `https://api.example.com` (AWS)
- 서버 env: `CORS_ORIGIN=https://oj.example.com`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`

## 4) 이미지 빌드 및 서비스 실행

원클릭 스크립트:

```bash
chmod +x scripts/aws/deploy-ec2.sh
./scripts/aws/deploy-ec2.sh .env.aws docker-compose.aws.yml
```

수동 실행이 필요하면 아래 순서를 사용하세요.

채점 이미지(필수):

```bash
docker build -t oj-runner:latest ./judge
```

서버/워커 이미지 빌드:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml build server worker
```

서비스 기동:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml up -d
```

## 5) DB 마이그레이션 / 시드

마이그레이션:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml run --rm server npx prisma migrate deploy --schema=prisma/schema.prisma
```

초기 시드(관리자 계정/샘플 데이터):

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml run --rm server node prisma/seed.js
```

## 6) 확인

헬스체크:

```bash
curl http://127.0.0.1:3000/api/health
```

로그 확인:

```bash
docker compose --env-file .env.aws -f docker-compose.aws.yml logs -f server worker
```

## 7) 운영 팁

- `TRUST_PROXY=true` 유지 (ALB/Nginx 뒤 배포 시 필수)
- 데이터 경로(`/srv/oj/data`)는 백업 정책 포함
- 멀티 인스턴스 운영 시 `EFS`를 서버/워커 공용 마운트로 사용
- DB 백업은 RDS 자동 스냅샷 사용

## 참고

- AWS 전용 compose 파일: `docker-compose.aws.yml`
- AWS 전용 env 템플릿: `.env.aws.example`
- 배포 스크립트: `scripts/aws/deploy-ec2.sh`
