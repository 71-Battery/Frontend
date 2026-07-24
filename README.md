# GSM VITA

광주소프트웨어마이스터고등학교 학생을 위한 교내 공지·학사정보 AI 도우미입니다.

로그인 후 화면은 다음 핵심 메뉴로 구성됩니다.

- 홈
- 학교생활 질문을 보내는 AI 채팅
- 학사 일정
- 공지·규정 검색
- 즐겨찾기

로그인·회원가입 이메일 입력은 광주소프트웨어마이스터고등학교 도메인 `@gsm.hs.kr`를 화면에 고정하고, 사용자는 아이디 부분만 입력합니다. 로그인 API에는 완성된 이메일 주소를 전송합니다.

관리자 계정에만 규칙 조회·생성 영역이 표시됩니다. 데모 계정은 서버 통신 없이 브라우저 번들에 포함된 예시 데이터로만 동작합니다.

## 실행

```bash
npm install
npm run dev
```

기본 프런트 개발 주소는 Vite가 표시합니다. Cloudflare Worker 어댑터가
동일 출처의 `/api`, `/health`, `/supabase-health` 요청을 로컬
`http://localhost:3000` 백엔드로 전달합니다. 운영 환경에서는 Sites의
`BACKEND_ORIGIN` 런타임 변수에 HTTPS 백엔드 주소를 설정해야 합니다.

```bash
npm run lint
npm run build
```

## 백엔드 연동

- [현재 엔드포인트 연동 가이드](docs/ENDPOINT_INTEGRATION_GUIDE.md)
- [인프라 초안](docs/INFRASTRUCTURE_DRAFT.md)
- [Vercel · Render 배포 가이드](docs/VERCEL_RENDER_DEPLOYMENT.md)

Data-GSM 학생·NEIS 학사일정은 NestJS 백엔드 전용 클라이언트에서
조회합니다. 브라우저에는 Data-GSM, AI, Supabase service-role 등의
비밀값을 넣지 않으며, `VITE_` 환경변수는 빌드 결과에 공개되므로
비밀정보 저장에 사용하면 안 됩니다.

로그인으로 받은 Bearer 토큰은 현재 탭의 메모리에서만 유지합니다. 새로고침 후 세션 복구가 필요하면 백엔드가 짧은 수명의 access token과 `HttpOnly` refresh cookie 기반 재발급 endpoint를 제공하는 방식을 권장합니다.

Supabase 스키마는
`HACKERTHONDATABASE/Server/supabase/migrations/20260723_001_rebuild_app_schema.sql`
에 있습니다. 이 마이그레이션은 지정된 기존 앱 테이블을 재생성하므로
백업과 staging 검증 후 백엔드와 같은 릴리스에서 적용해야 합니다.
