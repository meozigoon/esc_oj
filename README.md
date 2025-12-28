# ESC OJ

## 구성

-   `/server`: Express + Prisma API 서버
-   `/worker`: BullMQ 워커 (Docker 샌드박스 채점)
-   `/client`: React + MUI SPA
-   `/prisma`: 스키마 및 시드
-   `/judge`: 채점용 Docker 이미지
-   `/data`: 문제 MDX와 테스트케이스 파일 저장소

## 주요 파일/디렉터리 설명

<details>
<summary>설명 펼치기</summary>
<div markdown="1">

-   `docker-compose.yml`: Postgres/Redis/Server/Worker 구성을 정의합니다.
-   `judge/Dockerfile`: 채점 컨테이너 이미지 정의 (컴파일러/런타임 포함).
-   `server/Dockerfile`: 서버 빌드/실행 이미지 정의.
-   `server/src/index.ts`: 인증/대회/문제/제출/관리자 API 라우트.
-   `worker/Dockerfile`: 워커 빌드/실행 이미지 정의.
-   `worker/src/index.ts`: BullMQ 워커 진입점.
-   `worker/src/judge.ts`: Docker 샌드박스에서 컴파일/실행 및 채점 로직.
-   `prisma/schema.prisma`: DB 스키마 및 enum 정의.
-   `prisma/seed.js`: 관리자 계정 + 샘플 대회/문제/테스트케이스 시드.
-   `client/index.html`: SPA 엔트리와 사이트 타이틀.
-   `client/src/main.tsx`: React 엔트리, 테마/라우터 설정.
-   `client/src/theme.ts`: MUI 테마(색상/둥근 정도 등).
-   `client/src/api.ts`: API 클라이언트와 타입 정의.
-   `client/src/auth.tsx`: 로그인 상태 관리 컨텍스트.
-   `client/src/components/Layout.tsx`: 상단 네비게이션/레이아웃.
-   `client/src/components/RequireAuth.tsx`: 로그인/관리자 접근 제어.`r`n- `client/src/pages/HomePage.tsx`: 메인 화면.
-   `client/src/pages/ContestListPage.tsx`: 대회 목록 페이지.
-   `client/src/pages/ContestDetailPage.tsx`: 대회 상세 + 문제 목록.
-   `client/src/pages/ProblemDetailPage.tsx`: 문제 + 제출 에디터(동시 표시).
-   `client/src/pages/ProblemSubmissionsPage.tsx`: 문제별 제출 기록.
-   `client/src/pages/SubmissionListPage.tsx`: 내 제출 기록.
-   `client/src/pages/SubmissionDetailPage.tsx`: 채점 결과 상세.
-   `client/src/pages/LoginPage.tsx`: 로그인 페이지.
-   `client/src/pages/RegisterPage.tsx`: (미사용) 회원가입 페이지.
-   `client/src/pages/admin/AdminHomePage.tsx`: 관리자 홈.
-   `client/src/pages/admin/AdminContestsPage.tsx`: 대회 생성/삭제.
-   `client/src/pages/admin/AdminContestDetailPage.tsx`: 대회 수정 + 문제 목록.
-   `client/src/pages/admin/AdminProblemsPage.tsx`: 문제 생성/대회 연결.
-   `client/src/pages/admin/AdminProblemDetailPage.tsx`: 문제/테스트케이스/정답 수정.
-   `client/src/pages/admin/AdminSubmissionsPage.tsx`: 전체 제출 조회.
-   `client/src/pages/admin/AdminSummaryPage.tsx`: 통계 집계.
-   `client/src/pages/admin/AdminUsersPage.tsx`: 관리자 계정 생성.
-   `data/problems/{id}/statement.mdx`: 문제 본문.
-   `data/problems/{id}/tests/{ord}.in|.out`: 입력/정답 파일.

</div>
</details>

## 필수 사전 준비

-   Node.js 18+
-   Docker Desktop (WSL2 권장)
-   Docker Compose

## 빠른 시작

### 1) 채점 이미지 빌드

```bash
docker build -t oj-runner:latest ./judge
```

### 2) DB/Redis 먼저 실행

```bash
docker compose up -d postgres redis
```

### 3) 패키지 설치

```bash
npm install
```

### 4) Prisma 마이그레이션/시드

루트의 `.env.example`을 참고해 `.env`를 준비한 뒤 실행하세요.

```bash
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
```

### 5) 서버/워커 실행

```bash
docker compose up -d server worker
```

### 6) 클라이언트 개발 모드

```bash
npm run dev
```

-   클라이언트: http://localhost:5173
-   서버: http://localhost:3000

## 기본 관리자 계정

-   username: `admin`
-   password: `admin1234`

## 사이트 사용법

-   관리자 로그인: `/login` → 기본 계정 또는 관리자 생성 계정으로 로그인.\r\n- 관리자 페이지 접근: 로그인 후 상단 메뉴의 Admin 클릭 또는 `/admin` 접속.`r`n- GitHub 링크 설정: `client/.env`에 `VITE_GITHUB_URL`을 지정하면 하단 링크가 변경됩니다.
-   대회 관리: `/admin/contests`에서 대회 생성/수정/삭제.
-   문제 관리: `/admin/problems`에서 문제 생성 후 테스트케이스(정답) 추가/수정/삭제.
-   계정 관리: `/admin/users`에서 사용자/관리자 계정 생성.
-   참가자 흐름: `/contests` → 문제 선택 → 문제/제출 창을 동시에 보며 제출.
-   채점 결과: 제출 후 제출 기록 화면으로 이동하며, 결과 상세/제출 기록의 `수정`을 눌러 기존 코드를 불러와 재제출 가능.

## LAN 접속 (다른 기기에서 제출)

1. 호스트 PC에서 `npm run dev`로 클라이언트를 실행합니다. (Vite가 LAN 접속을 허용하도록 설정되어 있습니다.)
2. 다른 기기에서 `http://<호스트PC_LAN_IP>:5173`로 접속합니다.
3. Docker 사용 시 `.env`에 `CORS_ORIGIN=http://localhost:5173,http://<호스트PC_LAN_IP>:5173`를 추가하고 `docker compose up -d --build server`로 재시작합니다.
4. Windows 방화벽에서 5173(클라이언트), 3000(서버) 인바운드 허용이 필요할 수 있습니다.

## 제출 언어 지원

-   C99, C++17, Java 11, Python3, C#
-   Java는 `Main` 클래스, C#은 `MainClass` 클래스를 사용하세요.

## 채점 샌드박스 정책

-   Docker 컨테이너 실행
-   네트워크 차단: `--network none`
-   권한 최소화: `--cap-drop ALL`, `--security-opt no-new-privileges`, `--read-only`
-   자원 제한: `--memory`, `--cpus`, `--pids-limit`

## 문제/테스트케이스 파일 저장

-   문제 본문은 `statement.mdx`로 저장됩니다.
-   테스트케이스는 `tests/{ord}.in` / `tests/{ord}.out` 텍스트 파일로 저장됩니다.
-   기본 경로는 `./data/problems/{problemId}`이며, `DATA_DIR` 환경변수로 변경할 수 있습니다.

### DB 확인

```bash
npx prisma studio --schema=prisma/schema.prisma
```

## 실행 요약

```bash
docker build -t oj-runner:latest ./judge
docker compose up -d
npm install
npm run prisma:migrate
npm run prisma:seed
npm run dev
```

## 참고

-   워커 컨테이너는 Docker 소켓(`/var/run/docker.sock`)을 사용해 채점 컨테이너를 실행합니다.
-   Windows 환경에서는 Docker Desktop의 드라이브 공유 설정을 확인하세요.
