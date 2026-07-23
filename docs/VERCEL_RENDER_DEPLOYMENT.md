# Vercel · Render 배포 가이드

이 문서는 다음 저장소 구성을 기준으로 합니다.

- 프런트엔드: `HACKERTHON`
- NestJS 백엔드: `HACKERTHONSERVER/Backend/backend`
- Render Blueprint: `HACKERTHONSERVER/Backend/render.yaml`
- Supabase SQL: `HACKERTHONDATABASE/Server/supabase/migrations/20260723_001_rebuild_app_schema.sql`

운영 요청 흐름은 다음과 같습니다.

```text
Vercel React
  └─ HTTPS + Bearer token
      └─ Render NestJS
          ├─ Supabase
          ├─ Data-GSM
          │   ├─ GET /v1/students
          │   └─ GET /v1/neis/schedules
          └─ Campus AI POST /v1/chat
```

브라우저는 Data-GSM, Supabase service-role, Campus AI 또는 AWS에 직접
접속하지 않습니다.

## 1. 배포 전 준비

1. 세 저장소의 변경을 각각 검토하고 원격 Git 저장소에 push합니다.
2. Supabase 프로젝트를 백업합니다.
3. staging 프로젝트에서 파괴적 SQL migration을 먼저 검증합니다.
4. 기존에 코드·문서·로그 등으로 공개된 Data-GSM 키가 있다면 폐기하고
   `STUDENT_READ`, `NEIS_READ`만 가진 새 읽기 전용 키를 발급합니다.
5. Campus AI 운영 주소와 `/health`, `/v1/chat` 상태를 서버 운영자에게
   확인합니다. 주소는 코드나 공개 문서에 고정하지 않습니다.
6. Supabase Auth의 **URL Configuration**에서 Site URL과 허용 Redirect
   URL을 Vercel Production 주소 및 사용할 custom domain으로 설정합니다.

## 2. Supabase 적용

Supabase Dashboard의 SQL Editor에서 다음 파일의 전체 SQL을 실행합니다.

```text
HACKERTHONDATABASE/Server/supabase/migrations/20260723_001_rebuild_app_schema.sql
```

이 SQL은 앱 테이블을 삭제하고 새 계약으로 다시 생성합니다. 반드시
백업과 staging 검증 후 실행하고, `auth.users`는 삭제하지 않습니다.
성공한 migration과 일치하는 백엔드를 같은 릴리스로 배포합니다.

### Session Pooler 연결

Supabase Dashboard에서 **Connect > Session pooler**를 선택하고 port
`5432` 연결 문자열을 복사합니다.

```dotenv
PG_CONNECTION_STRING=postgresql://postgres.your-project-ref:your-database-password@aws-your-region.pooler.supabase.com:5432/postgres?sslmode=require
```

완성된 연결 문자열에는 DB 비밀번호가 들어가므로 Vercel, Git 저장소,
문서 또는 로그에 넣지 않습니다. `HACKERTHONDATABASE/Server`의 선택적
readiness 서버를 실행할 때만 이 값을 서버 환경변수로 설정합니다.

현재 실제 NestJS API는 Supabase Auth와 PostgREST를 사용하므로
`PG_CONNECTION_STRING`을 읽지 않습니다. Render의 NestJS 서비스에는
아래 Supabase URL·키를 설정하고, 데이터베이스 readiness 서버는 별도로
배포하지 않아도 됩니다.

## 3. Render 백엔드 배포

### Blueprint 사용

1. Render Dashboard에서 **New > Blueprint**를 선택합니다.
2. `HACKERTHONSERVER/Backend` 저장소를 연결합니다.
3. 저장소 루트의 `render.yaml`을 인식시킵니다.
4. 아래 `sync: false` 변수의 실제 값을 Render Environment에 입력합니다.
5. Blueprint를 적용하고 배포가 끝나면
   `https://<render-service>.onrender.com/api/health`를 확인합니다.

Blueprint에는 다음 값이 이미 고정되어 있습니다.

- Root Directory: `backend`
- Build Command: `npm ci && npm run build`
- Start Command: `node dist/main.js`
- Health Check: `/api/health`
- Node: `22.14.0`

Render가 `PORT`를 자동으로 주입하므로 직접 만들 필요가 없습니다.
백엔드는 Render 요구에 맞게 `0.0.0.0`에서 수신합니다.

Blueprint는 사용자와 가까운 `Singapore` 리전과 `free` plan을
사용합니다. Render 서비스 리전은 생성 후 직접 변경할 수 없으므로 최초
생성 전에 확인합니다. 무료 Web Service는 유휴 상태에서 정지한 뒤 첫
요청 때 cold start가 발생할 수 있습니다. 이를 고려해 프런트의 일반 API
timeout은 75초, Campus AI 채팅은 90초로 설정했습니다. 첫 요청이
실패하면 Render의 `/api/health`가 `200`이 된 뒤 한 번 다시 시도합니다.

### Render 환경변수

```dotenv
NODE_ENV=production
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-api-key-here
SUPABASE_SERVICE_ROLE_KEY=your-api-key-here

DATA_GSM_BASE_URL=https://openapi.datagsm.kr
DATA_GSM_API_KEY=your-api-key-here
DATA_GSM_TIMEOUT_MS=5000
DATA_GSM_PROFILE_TTL_SECONDS=300
DATA_GSM_SCHEDULE_TTL_SECONDS=3600

CAMPUS_AI_API_URL=https://your-campus-ai-host.example.com
CAMPUS_AI_TOP_K=4
CAMPUS_AI_SCORE_THRESHOLD=1.5
CAMPUS_AI_CONNECT_TIMEOUT=5
CAMPUS_AI_READ_TIMEOUT=60
```

`CORS_ALLOWED_ORIGINS`는 쉼표로 구분한 정확한 출처 목록입니다.

```dotenv
CORS_ALLOWED_ORIGINS=https://your-project.vercel.app,https://app.example.com
```

임의의 `*`를 사용하지 않습니다. Vercel Preview URL을 시험하려면 해당
Preview 출처도 명시적으로 추가합니다.

`CACHE_KEY_SECRET`은 Blueprint가 안전한 난수로 생성합니다. 직접 만들
경우 충분히 긴 무작위 값을 사용하고 이메일이나 학번을 넣지 않습니다.

현재 전달받은 Campus AI 계약에는 별도 API 키 헤더가 없습니다.
따라서 임의의 `CAMPUS_AI_API_KEY`를 만들어 전송하지 않습니다. 추후
Campus AI 인증 계약이 추가되면 백엔드 전용 클라이언트와 Render Secret에
명시적으로 추가해야 합니다.

## 4. Vercel 프런트엔드 배포

1. Vercel에서 **Add New > Project**를 선택하고 `HACKERTHON` 저장소를
   연결합니다.
2. Framework Preset은 `Vite`를 선택합니다.
3. 저장소가 monorepo 안에 있다면 Root Directory를 `HACKERTHON`으로,
   이 폴더 자체가 저장소라면 기본값으로 둡니다.
4. `vercel.json`에 설정된 빌드 정보를 사용합니다.
   - Install Command: `npm ci`
   - Build Command: `npm run build`
   - Output Directory: `dist/client`
   - Node.js Version: `22.x`
5. Production 환경변수에 다음 공개 값 하나만 설정합니다.

```dotenv
VITE_API_BASE_URL=https://your-render-service.onrender.com
```

6. 배포 후 확정된 Vercel Production URL을 Render의
   `CORS_ALLOWED_ORIGINS`에 입력하고 Render를 다시 배포합니다.

`VITE_` 변수는 빌드된 브라우저 코드에 공개됩니다. 따라서 Vercel에는
Data-GSM 키, Supabase service-role 키, Campus AI 설정, AWS 키를 절대
입력하지 않습니다.

`VITE_API_BASE_URL`을 바꾸면 새 프런트 빌드가 필요합니다. 값은 HTTPS
origin만 사용하고 `/api` 경로는 붙이지 않습니다.

## 5. 키와 설정값의 정확한 위치

| 값 | 저장 위치 | 브라우저 공개 | 용도 |
| --- | --- | ---: | --- |
| `VITE_API_BASE_URL` | Vercel | 예 | Render 공개 origin |
| `SUPABASE_URL` | Render | 아니요 | Supabase 프로젝트 연결 |
| `SUPABASE_ANON_KEY` | Render | 아니요 | 백엔드의 사용자 인증 요청 |
| `SUPABASE_SERVICE_ROLE_KEY` | Render Secret | 절대 금지 | 백엔드 내부 DB 작업 |
| `DATA_GSM_API_KEY` | Render Secret | 절대 금지 | 학생·NEIS 읽기 |
| `DATA_GSM_BASE_URL` | Render | 아니요 | Data-GSM 서버 주소 |
| `CAMPUS_AI_API_URL` | Render | 아니요 | 백엔드 전용 AI 서버 주소 |
| `CACHE_KEY_SECRET` | Render Secret | 절대 금지 | 원문 없는 캐시 키 생성 |
| AWS access/secret key | Campus AI 서버 Secret | 절대 금지 | Bedrock/Titan/Claude 호출 |

Supabase의 공개 anon key라 해도 현재 구조는 브라우저가 Supabase에 직접
접속하지 않으므로 Vercel에 둘 필요가 없습니다. service-role 키는 어떤
경우에도 브라우저에 넣지 않습니다.

## 6. 배포 확인 순서

1. `GET https://<render-service>/api/health`가 `200`인지 확인합니다.
2. 프런트에서 회원가입 또는 로그인 후 `GET /api/profile`을 확인합니다.
3. 학생 프로필이 Data-GSM `GET /v1/students` 결과 또는 허용된 로컬
   fallback으로 표시되는지 확인합니다.
4. `GET /api/schedules?fromDate=2026-07-01&toDate=2026-08-31`로
   Data-GSM `GET /v1/neis/schedules` 변환 결과를 확인합니다.
5. `POST /api/v1/chat`에는 `{ "query": "..." }`만 전송되는지 확인합니다.
6. AI의 `has_context: false` 응답도 `200`으로 표시되는지 확인합니다.
7. 공지·규정·저장·가이드와 관리자 권한이 기존처럼 동작하는지
   별도로 회귀 확인합니다.

운영 로그에는 API 키, Bearer token, 전체 이메일, 질문 전문, 출처
snippet을 남기지 않습니다. Data-GSM 오류 원문도 브라우저 응답으로
전달하지 않습니다.
