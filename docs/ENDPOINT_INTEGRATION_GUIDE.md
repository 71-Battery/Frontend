# GSM VITA 현재 연동 계약

이 문서는 다음 구현이 함께 배포된다는 전제로 작성했습니다.

- 프런트: `HACKERTHON`
- NestJS API: `HACKERTHONSERVER/Backend/backend`
- Supabase 스키마: `HACKERTHONDATABASE/Server`

## 요청 흐름

```text
브라우저
  └─ same-origin /api 요청
      └─ 프런트 Cloudflare Worker
          └─ BACKEND_ORIGIN의 NestJS API
              ├─ Supabase Auth / PostgreSQL
              └─ Data-GSM (서버 전용)
```

로컬에서는 Worker가 `BACKEND_ORIGIN`이 없을 때
`http://localhost:3000`을 사용합니다. 운영에서는 반드시 HTTPS
백엔드 주소를 런타임 변수로 설정합니다.

Data-GSM 키는 백엔드의 `DATA_GSM_API_KEY`에만 저장합니다.
`VITE_DATA_GSM_API_KEY` 같은 프런트 변수, 브라우저 직접 호출,
응답·로그의 키 노출은 금지합니다.

```dotenv
DATA_GSM_BASE_URL=https://openapi.datagsm.kr
DATA_GSM_API_KEY=your-api-key-here
DATA_GSM_TIMEOUT_MS=5000
```

첫 연동에 필요한 Data-GSM 권한은 읽기 전용 `STUDENT_READ`,
`NEIS_READ`입니다. WRITE 권한은 사용하지 않습니다.

## 공통 응답과 오류

성공 응답은 `status: "OK"`와 `data`를 사용합니다.

```json
{
  "status": "OK",
  "data": {}
}
```

오류는 실제 `4xx/5xx` 상태 코드와 안전한 공통 형식으로 반환합니다.
Data-GSM 원문 오류는 전달하지 않습니다.

```json
{
  "status": "ERROR",
  "error": {
    "code": "DATA_PROVIDER_AUTH_ERROR",
    "message": "학사 정보 제공자 인증에 문제가 발생했습니다.",
    "requestId": "request-id"
  }
}
```

사용자 세션 401과 Data-GSM 인증 오류를 구분합니다.

- 사용자 토큰 문제: `401 AUTH_REQUIRED` 또는 `401 INVALID_TOKEN`
- Data-GSM 인증 문제: `502 DATA_PROVIDER_AUTH_ERROR`
- Data-GSM 형식 문제: `502 DATA_PROVIDER_INVALID_RESPONSE`
- Data-GSM timeout: `504 DATA_PROVIDER_TIMEOUT`

## 인증

### 회원가입

```http
POST /api/auth/signup
Content-Type: application/json

{
  "email": "student@gsm.hs.kr",
  "password": "password123",
  "name": "홍길동",
  "studentNumber": 2103,
  "agreements": {
    "terms": true,
    "privacy": true,
    "notifications": false
  }
}
```

Supabase 이메일 확인 설정이 켜져 있으면 access token 없이
`verificationRequired: true`가 반환됩니다. 프런트는 이메일 인증 후
로그인하도록 안내합니다.

### 로그인

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "student@gsm.hs.kr",
  "password": "password123"
}
```

```json
{
  "status": "OK",
  "data": {
    "user": {
      "id": "user-id",
      "email": "student@gsm.hs.kr",
      "name": "홍길동"
    },
    "session": {
      "accessToken": "<access-token>",
      "expiresAt": 1780000000,
      "tokenType": "bearer"
    },
    "token": "<access-token>"
  }
}
```

보호 API는 `Authorization: Bearer <access-token>`을 요구합니다.
프런트는 access token을 현재 실행 메모리에만 유지합니다.

## 학생 프로필

```http
GET /api/profile
Authorization: Bearer <access-token>
```

백엔드는 인증된 전체 학교 이메일로 Data-GSM
`GET /v1/students?email=...&onlyEnrolled=true&page=0&size=1`을 호출하고
이메일 정확 일치를 다시 확인합니다.

```json
{
  "status": "OK",
  "data": {
    "profile": {
      "id": "1",
      "name": "홍길동",
      "email": "student@gsm.hs.kr",
      "schoolEmail": "student@gsm.hs.kr",
      "grade": 2,
      "classNum": 1,
      "number": 3,
      "studentNumber": 2103,
      "major": "SW_DEVELOPMENT",
      "majorLabel": "소프트웨어개발과",
      "department": "소프트웨어개발과",
      "specialty": "백엔드",
      "role": "GENERAL_STUDENT",
      "interests": []
    },
    "permissions": {
      "canManageContent": false
    }
  },
  "meta": {
    "profileSource": "DATA_GSM",
    "fallback": false
  }
}
```

nullable Data-GSM 필드는 `null`을 유지합니다. Data-GSM 학생 `role`은
표시·참고 값일 뿐이며 관리자 권한은 Supabase
`profiles.app_role`에서만 결정합니다. 미가입·미동의·장애 시에는
`profile_fallbacks`의 최소 로컬 프로필을 사용하고
`meta.fallback: true`를 반환합니다.

## 학사일정

```http
GET /api/schedules?fromDate=2026-07-01&toDate=2026-08-31
Authorization: Bearer <access-token>
```

기간을 생략하면 서울 기준 이번 달 1일부터 다음 달 말일까지 조회합니다.

```json
{
  "status": "OK",
  "data": {
    "schedules": [
      {
        "id": "7430310_20260725",
        "scheduleDate": "2026-07-25",
        "title": "실무프로젝트 중간보고서 제출",
        "description": "중간보고서 제출 일정",
        "category": "학사일정",
        "targetGrades": [2],
        "academicYear": "2026",
        "school": {
          "code": "7430310",
          "name": "광주소프트웨어마이스터고등학교",
          "officeCode": "G10",
          "officeName": "광주광역시교육청"
        },
        "courseType": "고등학교",
        "dayNightType": "주간",
        "source": "DATA_GSM",
        "month": "7월",
        "date": "25일",
        "dday": "D-2",
        "target": "2학년",
        "tone": "urgent",
        "importance": "HIGH"
      }
    ]
  },
  "meta": {
    "fromDate": "2026-07-01",
    "toDate": "2026-08-31",
    "timezone": "Asia/Seoul",
    "profileFallback": false
  }
}
```

`month`, `date`, `dday`, `target`, `tone`, `importance`는 애플리케이션이
`Asia/Seoul` 기준으로 계산합니다. 학생 학년 대상, 전 학년 대상,
그 밖의 일정 순으로 표시합니다. Data-GSM 원본 응답은 브라우저에
그대로 노출하지 않습니다.

## 공지·규정과 저장

공지와 규정은 Data-GSM이 아니라 내부 Supabase 테이블에서 읽습니다.

```http
GET /api/notices
GET /api/regulations
Authorization: Bearer <access-token>
```

```json
{
  "status": "OK",
  "data": {
    "notices": [
      {
        "id": "notice-id",
        "type": "NOTICE",
        "title": "여름 인턴십 사전교육 안내",
        "summary": "인턴십 참가 학생 대상 사전교육 안내입니다.",
        "content": "공지 원문",
        "category": "인턴십",
        "department": "산학협력부",
        "publishedAt": "2026-07-21T09:00:00+09:00",
        "deadlineAt": null,
        "targetGrades": [2],
        "targetMajors": ["SW_DEVELOPMENT"],
        "sourceUrl": null,
        "version": 1,
        "updatedAt": "2026-07-21T09:00:00+09:00",
        "reason": "현재 2학년 학생에게 관련된 인턴십 정보예요."
      }
    ]
  }
}
```

저장은 사용자별 내부 데이터입니다.

```http
GET /api/saved-resources
PUT /api/saved-resources/SCHEDULE/7430310_20260725
DELETE /api/saved-resources/SCHEDULE/7430310_20260725
Authorization: Bearer <access-token>
```

`resourceType`은 `SCHEDULE`, `NOTICE`, `RULE`만 허용합니다.

## AI 질문과 가이드

새 학생 채팅은 Campus AI를 사용합니다. 클라이언트는 질문만 보내고,
`grade`, `department`, `top_k`, `score_threshold`는 보내지 않습니다.
백엔드가 Bearer token을 검증한 뒤 Data-GSM 프로필 또는 허용된 로컬
fallback에서 학년·학과를 결정합니다.

```http
POST /api/v1/chat
Authorization: Bearer <access-token>
Content-Type: application/json

{
  "query": "현장실습은 어떻게 신청해?"
}
```

```json
{
  "answer": "인증된 학생 프로필에 맞춘 답변",
  "profile": {
    "grade": "2학년",
    "department": "소프트웨어개발과"
  },
  "sources": [
    {
      "category": "교육과정",
      "document": "교육과정.md",
      "snippet": "답변 근거가 된 문서 일부",
      "score": 1.23
    }
  ],
  "has_context": true,
  "retrieval": {
    "top_k": 4,
    "score_threshold": 1.5,
    "matched": true
  },
  "request_id": "request-id"
}
```

질문은 공백 제거 후 1,000자 이하만 허용합니다. Campus AI는
`CAMPUS_AI_API_URL`의 `POST /v1/chat`으로 호출하며, 백엔드가 다음 값을
서버 설정에서 추가합니다.

```json
{
  "query": "현장실습은 어떻게 신청해?",
  "grade": "2학년",
  "department": "소프트웨어개발과",
  "top_k": 4,
  "score_threshold": 1.5
}
```

`has_context: false`와 빈 `sources`는 오류가 아닌 정상 `200`입니다.
프런트는 Campus 문서 출처를 비클릭 근거 카드로 표시하며 FAISS `score`
값은 사용자에게 직접 노출하지 않습니다. 응답 전체를 runtime validation
하고 지식베이스, AI 공급자, 연결, timeout, 형식 오류를 안전한
`502`~`504` 응답으로 변환합니다.

기존 클라이언트 호환을 위해 `POST /api/chat`의 `{ "message": "..." }`
계약도 유지하되 내부적으로 같은 Campus AI 클라이언트를 사용합니다.
브라우저가 내부 컨텍스트 전체를 조회하는 `/api/context`는 만들지 않습니다.

AI에는 학년·학과만 전달하고 이름, 이메일, 성별, 기숙사·GitHub 정보,
전체 학생 목록은 전달하지 않습니다. 운영 로그에도 질문 전문과 출처
snippet을 기록하지 않습니다.

## 운영 적용 순서

1. Supabase 프로젝트를 백업하고 staging에서 파괴적 migration을 검증합니다.
2. DB migration과 이 문서의 NestJS 변경을 같은 릴리스에 배포합니다.
3. 서버 Secret Manager에 Supabase와 Data-GSM 값을 주입합니다.
4. 기존에 공개된 키가 있다면 폐기하고 새 키를 발급합니다.
5. Render에는 Campus AI의 HTTPS base URL과 timeout을 서버 변수로
   설정하고, Vercel에는 공개 Render origin만 설정합니다.
6. Sites를 계속 사용할 때만 비밀값이 아닌 `BACKEND_ORIGIN`을 설정합니다.
7. `@gsm.hs.kr` 이메일 확인, 프로필 fallback, Data-GSM 401/timeout,
   일정 날짜 경계, 저장 격리, 관리자 guard를 staging에서 E2E 검증합니다.
