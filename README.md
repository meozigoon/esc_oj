# ESC OJ

Online Judge System for ESC, Computer Science Club of Hansung Science High School, Entry Exam.

## 구성

-   `/server`: Express + Prisma API 서버
-   `/worker`: BullMQ 워커 (Docker 샌드박스 채점)
-   `/client`: React + MUI SPA
-   `/prisma`: 스키마/마이그레이션/시드
-   `/judge`: 채점용 Docker 이미지
-   `/data`: 문제 MDX/테스트케이스 파일 저장소

<details>
<summary>주요 파일/디렉터리 자세히</summary>
<div markdown="1">

-   `docker-compose.yml`: Postgres/Redis/Server/Worker 구성
-   `judge/Dockerfile`: 채점 컨테이너 이미지 정의 (컴파일러/런타임 포함)
-   `server/src/index.ts`: 인증/대회/문제/제출/관리자 API 라우트
-   `worker/src/index.ts`: BullMQ 워커 진입점
-   `worker/src/judge.ts`: Docker 샌드박스에서 컴파일/실행 및 채점 로직
-   `prisma/schema.prisma`: DB 스키마 및 enum 정의
-   `prisma/seed.js`: 기본 관리자 계정 + 샘플 대회/문제/테스트케이스 시드
-   `client/src/main.tsx`: React 엔트리, 테마/라우터 설정
-   `client/src/api.ts`: API 클라이언트와 타입 정의
-   `client/src/auth.tsx`: 로그인 상태 관리 컨텍스트
-   `client/src/components/Layout.tsx`: 상단 네비게이션/레이아웃
-   `client/src/pages/*`: 페이지 컴포넌트
-   `data/problems/{id}/statement.mdx`: 문제 본문
-   `data/problems/{id}/tests/{ord}.in|.out`: 입력/정답 파일

</div>
</details>

## 사전 준비

-   Node.js 18+
-   Docker Desktop (WSL2 권장)
-   Docker Compose

## 빠른 시작

### 1) 공통 준비 (한 번만)

1. `.env` 준비

    - `.env.example`을 복사해 `.env`를 만든 뒤 `CORS_ORIGIN`을 설정합니다.
    - 프로덕션에서는 `JWT_SECRET`, `ADMIN_PASSWORD`를 반드시 설정하세요.

2. 채점 이미지 빌드

```bash
docker build -t oj-runner:latest ./judge
```

3. 패키지 설치

```bash
npm install
```

4. Prisma 준비 (마이그레이션/시드)

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 2) 실행 방식 선택

<details>
<summary>Docker로 server/worker + 로컬 client 실행</summary>
<div markdown="1">

1. DB/Redis/Server/Worker 실행

```bash
docker compose up -d postgres redis server worker
```

2. 클라이언트 개발 모드

```bash
npm run dev -w client
```

-   클라이언트: http://localhost:5173
-   서버 API: http://localhost:3000

</div>
</details>

<details>
<summary>로컬에서 server/worker/client 모두 실행</summary>
<div markdown="1">

1. DB/Redis 실행

```bash
docker compose up -d postgres redis
```

2. 로컬 dev 서버 실행

```bash
npm run dev
```

-   클라이언트: http://localhost:5173
-   서버 API: http://localhost:3000 (PORT 환경변수로 변경 가능)

</div>
</details>

## 기본 계정 및 권한

-   username: `admin`
-   password: `admin1234`
-   프로덕션 환경에서는 `ADMIN_PASSWORD`로 시드 기본 비밀번호를 변경하세요.

권한:

-   `admin`: 관리자 페이지 읽기/쓰기
-   `viewer`: 관리자 페이지 읽기 전용
-   `user`: 일반 사용자

회원가입 기능은 없으며, 관리자 페이지에서 계정을 생성합니다.

## 사이트 사용법

-   로그인: `/login`
-   관리자 페이지: `/admin` (admin 또는 viewer만 접근 가능)
-   관리자 기능:
    -   대회 관리: `/admin/contests`
    -   문제 관리: `/admin/problems`
    -   계정 관리/비밀번호 변경: `/admin/users`
    -   접속 기록 조회: `/admin/access-logs`
-   문제 유형:
    -   코드 제출(CODE): 언어 선택 후 제출
    -   텍스트 제출(TEXT): 텍스트만 제출, 공백/개행 무시 비교
-   채점 방식(코드 제출): 테스트케이스 입력 또는 생성 코드(Generator) + 정답 코드(Solution)

## 제출 언어 지원

-   C99, C++17, Java 11, Python3, C#
-   Java는 `Main` 클래스, C#은 `MainClass` 클래스를 사용하세요.

## 채점 정책

-   코드 제출은 Docker 샌드박스에서 컴파일/실행합니다.
-   출력 비교는 마지막 개행/공백을 무시합니다.
-   전체 출력에서 공백/개행만 다른 경우 `출력 형식 오류(PRESENTATION_ERROR)`로 처리합니다.
-   텍스트 제출은 공백/개행을 모두 무시하고 정답과 비교합니다.
-   생성 코드 모드는 생성된 입력과 정답 코드 출력으로 채점합니다.

## 채점 샌드박스 정책

-   Docker 컨테이너 실행
-   네트워크 차단: `--network none`
-   권한 최소화: `--cap-drop ALL`, `--security-opt no-new-privileges`, `--read-only`
-   자원 제한: `--memory`, `--cpus`, `--pids-limit`

## 문제/테스트케이스 파일 저장

-   문제 본문: `./data/problems/{problemId}/statement.mdx`
-   테스트케이스: `./data/problems/{problemId}/tests/{ord}.in` / `.out`
-   기본 경로는 `./data/problems/{problemId}`이며, `DATA_DIR` 환경변수로 변경할 수 있습니다.

## LAN 접속 (다른 기기에서 제출)

1. 호스트 PC에서 클라이언트를 실행합니다.
2. 다른 기기에서 `http://<호스트PC_LAN_IP>:5173`로 접속합니다.
3. Docker 사용 시 `.env`에 `CORS_ORIGIN=http://localhost:5173,http://<호스트PC_LAN_IP>:5173`를 추가하고 `docker compose up -d --build server`로 재시작합니다.
4. Windows 방화벽에서 5173(클라이언트), 3000(서버) 인바운드 허용이 필요할 수 있습니다.

## DB 확인

```bash
npx prisma studio --schema=prisma/schema.prisma
```

## 참고

-   워커 컨테이너는 Docker 소켓(`/var/run/docker.sock`)을 사용해 채점 컨테이너를 실행합니다.
-   Windows 환경에서는 Docker Desktop의 드라이브 공유 설정을 확인하세요.
-   GitHub 링크는 `client/.env`의 `VITE_GITHUB_URL`로 변경할 수 있습니다.
