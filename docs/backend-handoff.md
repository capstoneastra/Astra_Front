# 업무 API 연동 인수인계 및 확인 요청

2026-11-21, `feat/yeonji`. [API 명세](api-spec.md)를 기준으로 한 정적 대조 결과다. 이번에는 실제 API 계약·권한·업무 기능을 새로 구현하거나 백엔드를 수정하지 않았다. 서버 URL과 배포 Swagger가 제공되지 않아 **백엔드 미배포로 테스트 불가**이다.

## 연결 환경

| 항목 | 현재 프론트 처리 | 팀 협의 사항 |
|---|---|---|
| API 기본 주소 | `VITE_API_BASE_URL`, 기본 `/api/v1`, 끝 슬래시 제거 | 실제 HTTPS 주소 + `/api/v1` 제공. Vite 환경변수는 빌드 시 반영 |
| 로컬 환경 예시 | `.env.local`에 `VITE_API_BASE_URL=https://<배포서버>/api/v1` | 이 문자열은 예시이며 유효한 배포 주소가 아님. 비밀값을 VITE_*에 넣지 않음 |
| 같은 출처 경로 | 프록시가 없으면 Vite HTML/404 등이 반환될 수 있음 | 현재 vite.config에 백엔드 프록시 없음. 프록시/리버스 프록시 또는 실제 API 주소 필요 |
| CORS | 기존 axios는 withCredentials=false | 프론트 개발·배포 origin을 서버 CORS_ALLOWED_ORIGINS에 등록, Authorization 허용, 오류 응답에도 CORS 적용 |
| 기능 Mock | 제거. VITE_API_MODE/VITE_DATA_SOURCE의 mock 값은 무시 | MSW나 프론트 응답 대체를 켜는 작업 불필요 |
| 서버 DEMO 데이터 | 장비 목록은 기본 `includeMock=false`. `VITE_INCLUDE_MOCK_DATA=true`를 명시하면 포함 | 서버 isMock/sourceType 등 출처는 유지·표시. 전체 기능의 모든 API에 적용되는 전역 필터가 아님 |
| 인증 | 기존 토큰·재발급·세션·로그인/가입 코드 유지 | 이 문서는 인증 API 변경 요청이 아님. 업무 API별 소유권 검사가 필요 |

실제 업무 화면은 일반 인증 흐름을 통해 접속한다. 로컬 개발 환경에서는 로그인 화면의 역할별 버튼으로 `/`의 레이아웃을 확인할 수 있으며, 이 모드에서는 업무 API 호출을 차단한다.

## 우선 확인 요청

| 우선순위 | 확인할 계약/정책 | 현재 프론트와 차이 및 후속 작업 |
|---|---|---|
| P0 | 의뢰자·장비 보유 조직 정책 | §0-4/§2-1 표는 기업도 자체 장비 관리 가능, §2-1 설명은 기업 403으로 충돌. 기업 장비 관리 정책 확인 필요. 의뢰 검토·예약 확정 버튼은 응답의 장비 보유 조직과 현재 사용자의 소속을 비교하며, 최종 권한은 서버가 확인한다 |
| P0 | 의뢰 상세·목록 전체 JSON | 현재 UI가 revision.content/applicant/test/sample/conditions, supplements, reservations 등을 직접 읽음. null/누락 가능성과 목록 revision 포함 여부 제공 필요. 예약 목록은 상세 포함 또는 GET /test-requests/{id}/reservations 사용을 확정해야 함 |
| P0 | 의뢰 생성 응답 | AI 초안은 명세상 requestId. 일반 생성은 현재 서비스가 requestId를 기대하므로 일반 생성의 실제 응답 및 id/requestId 명칭 확인. 임의 alias 응답을 추가하지 않음 |
| P0 | 제출 필수 content | 최신 actualUser/accounting 및 희망 시작·종료일 필수. 현재 폼/타입 일부 누락. `details.missingItems` 전체 예시와 필드 오류 구조 확인 후 폼 보완 필요 |
| P0 | 상태 변경 version | 의뢰/보완/예약 각각 요청할 version 대상·필수 여부, 변경 후 응답 DTO 제공. 현재 예약 타입도 version을 요구하므로 실제 예약 응답에 포함되는지 확인 |
| P0 | 예약 충돌·동일 의뢰 확정 | 409 RESERVATION_OVERLAP/RESERVATION_ALREADY_CONFIRMED의 실제 body와 확정 후 의뢰·예약 상태. 서버 트랜잭션/DB 제약으로 최종 차단. 프론트 검사는 보조 수단 |
| P1 | 대시보드 view | REQUESTER/PROVIDER 선택을 요청과 조회 캐시에 반영하고, 관리자 요청은 view를 생략한다. 구형 응답에 view가 없으면 계정의 기본 조회 범위로만 처리한다. 양쪽 업무를 하는 조직의 화면 전환은 실제 계정으로 검증해야 한다 |
| P1 | 보낸/받은 의뢰함 | 의뢰 관리와 캘린더에서 `box=SENT` 또는 `RECEIVED`를 명시하고 조회 캐시를 구분한다. 관리자는 전체를 조회한다. 기업의 받은 의뢰와 기관·대학의 보낸 의뢰를 실제 계정으로 확인해야 한다 |
| P1 | 자연어 검색 interpreted | 현재 타입은 testTypeCode/keywords이나 명세는 interpreter/testTypes/conditions/regions. 최신 응답 기준으로 타입·해석 표시 수정 필요. KEYWORD를 AI 분석으로 표시하면 안 됨 |
| P1 | 유사 장비 | 실제 명세는 [{equipment,reasons,nameSimilarity}], 현재 similar 타입은 Equipment[]라 불일치. 비교/상세 연결 시 wrapper 반영 필요 |
| P1 | 조건 생성/분석/확정 | POST /requirements의 필수 필드·생성 응답, 상태/조건/source enum, confirm·match 허용 상태와 version 규칙 확인. 현재 타입에서 분석의 key/reason/requirementId 일부 및 requirement 상태가 빠짐 |
| P1 | 장비 사양·가용성 확장 | spec-definitions, availability, 실제 기관 확인 정보/리드타임/운영방식·공인정보 DTO. 현재 EquipmentDto/상세/비교는 일부 필드만 표시. simulation.presetIds는 string[]인지 확인(number[]로 남은 현재 타입 교정 필요) |
| P1 | 기관 관리·추가정보·결과 | /institutions/me/equipment, test-types 갱신·downtimes·change-logs·security, ADDITIONAL_INFO의 기본 4개 필드, 예상료·결과·첨부 처리. 서버 API는 명세에 있지만 현재 UI/service가 일부 미연결 |
| P1 | 시험 완료 선행조건 | complete 전에 result 등록 필요. 현재 완료 버튼만 있으며 결과 등록 폼 미연결. 결과 등록 실패/미등록 시 완료를 성공으로 표시해서는 안 됨 |
| P1 | 시뮬레이션 전체 DTO | models/presets/POST run/GET run/이력의 실제 JSON. UI가 equipmentId/inputParameters/limitation/createdAt을 사용하나 명세 결과 예시에는 일부가 없음. 타입을 넓혀 추측하지 않고 확인 후 조정 |
| P2 | AI 자동 추진 | POST 시작 202의 전체 응답, run/step enum, chatSessionId 입력, currentStep/matchRunId 제공, resume 결과 확인. events API는 명세상 미구현이므로 요청하지 않음 |
| P2 | 목록·이력 페이지 구조 | 상담·메시지·의뢰 revision/history·알림·시뮬레이션 이력의 배열/Page 구분 및 정렬/최대 size 확인. 현재 최초 100개 조회 화면의 페이지 지원 후속 보완 |
| P2 | 알림 | 헤더 건수는 `GET /notifications?unreadOnly=true`의 `totalElements`를 사용한다. 최신 알림 유형, 관련 의뢰·예약으로 이동할 링크 필드, unread-count 전용 응답 형식은 서버 확인 필요 |
| P2 | 캘린더 조회 규모 | 전체 의뢰 페이지 → 상세 최대 4개 병렬 조회. 상세의 예약 포함 여부와 기간별 조회 지원을 협의. 기존 API 확장 여부부터 검토하고 전체 calendar 엔드포인트를 임의 생성하지 않음 |

## 백엔드 배포 후 검증 시나리오

각 항목의 현재 결과는 모두 **백엔드 미배포로 테스트 불가**다. 프론트 빌드와 상태 컴포넌트 검사로 이를 대체하지 않는다.

1. 실제 세션으로 비회원·다른 기업·다른 조직 ID 접근이 401/403인지 확인. 프론트 메뉴와 관계없이 서버가 검사해야 한다.
2. 장비 페이지/필터·영문/한글/약어·자연어 검색, 404 비활성 장비, null 비용/기간, REAL/MOCK 출처·기관 확인 상태 확인.
3. 상담 → 조건 생성/누락 분석 → 사용자 수정/확정 → DB 후보만 매칭. 기준 단위·불일치·미확인·자기 조직 제외를 확인.
4. AI DRAFT → actualUser/accounting/희망 기간 포함 저장 → 사용자 확인 후 제출. 누락은 400이고 자동 제출이 없어야 함.
5. 보유 조직 검토 → 보완/ADDITIONAL_INFO → 의뢰자 재제출 → 재검토/통과·반려. 제출본·상태 이력과 version 충돌 확인.
6. SCHEDULING 일정 제안/대안/확정, 동일 시각 경계([시작,끝)), 다른 확정 예약/정비 겹침 409, 동시 확정 409, 최신 점유 재조회 확인.
7. REQUESTER/PROVIDER/ADMIN 대시보드와 SENT/RECEIVED 범위, dataAvailable=false 준비 중과 실제 0건을 구분.
8. 자동 추진 WAITING_USER → 보완 → resume → DRAFT 종료, 취소/실패 시 중단, 최종 사용자 승인 유지 확인.
9. 서버 시뮬레이션의 capability·DEMO·한계·입력/결과/이력 및 CSV·XLSX·PDF의 같은 결과/출처 표시 확인.
10. 실제 400/401/403/404/409/429/500/502/타임아웃을 확인하고 오류가 가짜 성공이나 임의 데이터 생성으로 이어지지 않는지 검증.

## 담당자가 전달할 자료

- 배포 API 주소, Swagger/OpenAPI 주소, CORS 허용 origin과 API 버전/기준 커밋.
- 위 P0 계약의 실제 요청·응답 예시(토큰/비밀번호 등 비밀값 제외), 서버에서 구현되지 않은 엔드포인트 목록.
- 의뢰/보유 조직/관리자별 승인된 테스트 데이터 및 소유권·상태 전이 테스트 기준. 인증 계정 생성이나 비밀번호 변경은 이번 작업 범위 밖이다.
- 현재 저장소에 없는 `team-guide.md`, `demo-scenario.md` 및 API 명세 내부 충돌에 대한 최종 결정.

Spring Boot 코드, PostgreSQL 데이터, 백엔드 저장소 및 공개 배포는 이번 변경에서 수정하지 않는다.
