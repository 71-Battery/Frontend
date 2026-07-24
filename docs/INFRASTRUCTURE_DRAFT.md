# GSM VITA AWS 인프라 초안

> 첨부 자료의 `AWS`, `서울(ap-northeast-2)`, `.env`, 제한된 관리자 접근, 월 `$30~40` 조건을 바탕으로 정리한 예시입니다.

## 권장 구조

```text
학생 브라우저
  ├─ CloudFront ─ private S3 (React 정적 파일)
  └─ HTTPS 443 ─ EC2 API 서버 (public app subnet)
                ├─ private RDS PostgreSQL
                ├─ private S3 (공지·규정 원문)
                ├─ Secrets Manager / Parameter Store
                └─ Claude API

관리자
  └─ IAM + MFA ─ SSM Session Manager ─ EC2
```

월 `$30~40` 수준에서는 Bastion EC2와 NAT Gateway를 상시 운영하면 예산을 넘기기 쉽습니다. 초기에는 SSH 22번 포트를 닫고 AWS SSM Session Manager로 관리 접속하는 방향을 우선합니다. 조직 정책상 Bastion이 필수라면 필요할 때만 생성하는 임시 인스턴스로 분리합니다.

## 데이터 저장 구분

### RDS PostgreSQL

- 학생 가명 식별자와 개인화 프로필
- 학년·학과·전공
- 공지 메타데이터와 대상 조건
- 학사 일정과 할 일 상태
- 규정 문서 버전과 관리자 승인 이력
- 저장·읽음 상태
- AI 대화 메타데이터와 출처 연결

### S3

- PDF·HWP·DOCX 공지 원문
- 교육과정과 학사 규정
- 첨부 이미지
- 텍스트 추출 결과
- 관리자 export와 백업

RDS에는 파일 자체가 아닌 `bucket`, `objectKey`, `versionId`, `contentType`, `size`, `sha256` 같은 메타데이터만 저장합니다.

## 환경변수와 비밀값

| 데이터 | 저장 위치 |
|---|---|
| Claude API Key | AWS Secrets Manager |
| DB 인증정보 | AWS Secrets Manager |
| 세션 서명 키 | AWS Secrets Manager |
| 리전·버킷명·로그 레벨 | SSM Parameter Store |
| 프런트 공개 API URL | `VITE_API_BASE_URL` |

`.env`는 개발자 로컬 환경에서만 사용합니다. `VITE_` 접두사가 붙은 변수는 브라우저 번들에 포함되므로 API Key나 DB 비밀번호를 절대 넣지 않습니다.

## 보안 기본값

- 리전: `ap-northeast-2`
- RDS: private subnet, `PubliclyAccessible=false`
- S3: Block Public Access, 버전 관리와 기본 암호화 활성화
- 프런트 S3: CloudFront OAC를 통해서만 접근
- EC2: 22번 포트 폐쇄, IAM instance role 사용
- Security Group: 인터넷에서는 API의 `443`만 허용, RDS `5432`는 API 서버 SG에서만 허용
- TLS·브라우저 정책: HSTS, CSP, `frame-ancestors`, `X-Content-Type-Options`, Referrer-Policy 적용
- CORS: 운영 프런트 도메인 allowlist와 credential 정책 고정
- 관리자: MFA 필수, SSM 접근 권한 최소화
- 로그: 비밀번호, API Key, 세션 쿠키, 민감한 AI 질문 원문 제외
- 감사·탐지: CloudTrail 활성화, 인증 실패·권한 오류·비정상 비용에 경보
- 복구: RDS 자동 백업·PITR, S3 versioning, 정기 복원 테스트
- 학생 목록 API: 관리자 권한 및 페이지 크기 제한
- 브라우저 인증: HttpOnly·Secure 쿠키
- API 호출: rate limit, request ID, 감사 로그 적용

## 비용 주의사항

RDS가 가장 큰 비용 항목이며, EC2·IPv4·스토리지·로그·Secrets Manager를 합하면 월 `$30~40`을 넘을 수 있습니다. 배포 전 AWS Pricing Calculator에서 서울 리전 가격을 다시 확인하고 Claude API 비용은 별도 일일 한도로 관리합니다.

더 저렴한 대안은 Lambda + DynamoDB지만, 일정·공지·학년·학과·대상 조건처럼 관계형 조회가 많다면 초기 개발은 PostgreSQL이 단순합니다.

## 구현 전 결정할 항목

- 실제 도메인과 HTTPS 인증서 발급 시점
- 외부 학교 정보 API 도입 여부와 계약
- 학교 계정 인증 방식
- 학생 정보 보존 기간과 삭제 정책
- AI 대화 저장 여부와 보존 기간
- 교사·관리자 역할 권한 범위
- 파일 업로드 최대 크기와 허용 형식
