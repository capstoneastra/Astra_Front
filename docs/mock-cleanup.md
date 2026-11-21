# 기능용 Mock 데이터 정리 및 검증 기록

2026-11-21. 작업 브랜치 `feat/yeonji`, 기준 `83ac98f`.

이 문서는 당시 작업 기록이다. 이후 실사용 전환 과정에서 당시 보존했던 가상 계정과 개발용 진입 경로도 제거했다.

## 작업 위치와 보호 범위

처음 열린 프로젝트는 `feature/api-read-integration`의 이전 JavaScript 작업과 다수 미커밋 파일을 포함했다. 이 폴더를 덮어쓰거나 전환하지 않고 원격의 최신 TypeScript `feat/yeonji`를 별도 Git worktree(`.worktrees.local/feat-yeonji`)에 체크아웃했다. 원래 작업 파일과 로컬 main은 보존했다. 모든 업무 변경·커밋·푸시·PR은 feat/yeonji를 사용한다.

작업 전 `docs/api-spec.md`, `docs/tech-stack.md`, `docs/dev-status.md`와 실제 서비스·화면·Mock 참조를 대조했다. 현재 브랜치에는 별도 doc 폴더, team-guide/demo-scenario 원문 또는 배포 Swagger가 없다. 설계 예시에 적힌 숫자·조직명은 계약 설명일 뿐 운영 UI에 주입하지 않는다.

보호한 파일/구조:

- `src/auth/**`, `src/services/authService.ts`, `src/api/client.ts`, `src/api/errors.ts` 전체: 로그인/가입/이메일 인증/토큰/세션/인증 오류·갱신 동작을 변경하지 않음.
- `src/preview/user.ts`, `src/preview/paths.ts`, `src/preview/PreviewProvider.tsx`: 기존 로그인 화면의 개발 미리보기 계정·세션 관련 코드/데이터를 그대로 유지. 기능용 API adapter와 분리함.
- `src/api/bootstrap.ts`의 기존 `removeLegacyMockAccounts` 함수 본문은 원문 그대로 유지. 기존처럼 개발 미리보기에서는 호출하지 않음. 이번에 계정 정리 로직을 새로 작성하거나 변경하지 않음.
- `src/index.css`, `src/styles/**`, 로그인 스타일, `AppHeader`, 사이드바, 공통 카드/버튼/모달, 애니메이션, 라우팅 구조 유지.
- 서비스 계약/DTO·axios 요청·공통 캐시·기존 서버 오류 처리 및 실제 결과 파일 내보내기 유지. `AppContext`의 시뮬레이션 장비 선택 값만 고정 id를 없애 nullable로 명시.

## 삭제한 파일과 영향

| 파일 | 삭제한 기능용 데이터/응답 | 화면 영향 및 대체 상태 |
|---|---|---|
| `src/mocks/data/catalog.json` | 장비 71건, 사양 117건, 시험유형 15건, 조건 규칙 32건, 장비-시험 연결 48건, 모델 20건, 프리셋 71건, seed 조직 9건의 클라이언트 사본 | 장비/조건/시뮬레이션은 서버 조회만 사용. 서버가 없으면 로딩 후 오류·연결 대기 |
| `src/mocks/database.ts` | seed 적재, 추가 가상 기업 2건, sequence 및 의뢰/예약/상담/조건/추천/보완/시뮬레이션/자동추진/알림/이력 저장소 | 브라우저가 실제 업무 DB처럼 상태 변경을 성공시키지 않음 |
| `src/mocks/equipment.ts` | 별도 가짜 장비 3건·사양·고정 갱신일 | equipmentService의 개발 fallback 제거, 응답 검증 유지 |
| `src/mocks/calendarDemo.ts` | 월별 가짜 의뢰·예약 생성 | 캘린더의 시연 일정 불러오기 버튼만 제거. 달력/필터/상세 UI 유지 |
| `src/mocks/rules.ts` | 자연어 조건 추출·분석·판정용 클라이언트 규칙 엔진 | 실제 서버 분석 실패를 가짜 추천으로 대체하지 않음 |
| `src/mocks/routes/catalog.ts` | 장비 검색/상세/관리·시험정보·중복/비교 가짜 응답 | 기존 실제 API 서비스 유지 |
| `src/mocks/routes/ai.ts` | 가짜 상담/조건/추천·점수/자동추진 단계/초안 | 서버 응답 전 성공 단계/AI 답변 생성 안 함 |
| `src/mocks/routes/requests.ts` | 의뢰 생성/전이/보완/예약·확정 가짜 응답 | 기존 서비스 오류/빈 상태 사용, 서버 성공 후만 후속 처리 |
| `src/mocks/routes/simulation.ts` | 가짜 모델/프리셋 조회·시뮬레이션 수치 계산 결과/이력 | 결과 없으면 차트/보고서 생성 안 함. 3D 표현 코드는 유지 |
| `src/mocks/routes/dashboard.ts` | 가짜 집계/알림/대시보드 응답 | 정상 서버 응답의 dataAvailable/0건과 조회 실패 구분 |
| `src/mocks/engine.ts`, `http.ts` | 브라우저 가짜 라우터·성공/오류 envelope·페이지 응답 생성 | API 계약을 대신 구현하는 클라이언트 서버 제거 |
| `src/mocks/handlers.ts`, `browser.ts` | MSW 핸들러·worker 시작 모듈 | 어떤 환경변수로도 기능 Mock 응답 시작 안 함 |
| `src/preview/api.ts` | axios adapter로 모든 업무 응답 대체 | 개발 미리보기의 업무 데이터도 서버 필요 |
| `src/preview/adminRoutes.ts` | 개발 미리보기의 가짜 회원/조직 목록·승인/정지 응답 | 운영 화면 서비스는 보존. 계정 원본(user.ts)은 삭제/수정 안 함 |

위 16개 파일을 삭제했다. 장비 seed 사본에는 출처 기반 목록과 DEMO 사양이 섞여 있었으며, 이를 모두 허위 원본으로 단정하지 않는다. 제거 대상은 **프론트에서 서버 응답처럼 사용하던 사본과 생성 로직**이다. 서버가 추후 제공하는 REAL/MOCK 메타데이터의 의미는 API 계약대로 유지한다.

## 수정·추가 파일

| 파일 | 변경 |
|---|---|
| `src/api/config.ts` | 업무 isMock=false/mode=api 고정. baseURL/includeMock 및 기존 preview 식별 필드는 유지 |
| `src/api/bootstrap.ts` | 기능 preview adapter/MSW 시작 제거. 이전 ASTRA MSW만 비활성화·등록 해제하는 처리 유지. 기존 계정 helper 보존 |
| `src/api/legacyBusinessData.ts` (추가) | 이전 `astra.mock.database.v3`의 알려진 업무 필드만 제거. users/sessions/organizations/알 수 없는 필드 및 다른 localStorage 키는 그대로 유지. 손상/차단/다른 버전은 건드리지 않음 |
| `src/services/equipmentService.ts` | 로컬 Mock 장비 list/detail 분기만 삭제. 실제 엔드포인트·페이지/DTO 검증 보존 |
| `src/components/ReservationCalendar.tsx` | 시연 일정 생성 UI 삭제, 서버 응답 전 조회 성공으로 보이는 문구 수정. 정상 일정 컴포넌트/권한 동작 보존 |
| `src/components/Simulation.tsx` | 고정 장비 대신 미선택 placeholder 제공. 모델/결과는 기존 API 경로 유지 |
| `src/components/Automation.tsx` | 예시 시험조건이 실제 입력값으로 채워지지 않도록 빈 상태로 시작. 기존 입력·추진 UI 유지 |
| `src/App.tsx`, `src/context/AppContext.ts` | 시뮬레이션 초기 장비 48 → null, 미리보기 footer에 서버 연결 필요 안내 |
| `src/components/ui/ApiState.tsx` | NETWORK_ERROR/TIMEOUT은 서버 연결 대기. 로딩/HTTP 오류 기존 레이아웃 유지 |
| `vite.config.ts` | 개발용 mockServiceWorker 제공 플러그인만 제거. React/Tailwind 플러그인 유지 |
| `package.json`, `package-lock.json` | 사용하지 않는 MSW 의존성과 전용 전이 의존성 제거. 신규 라이브러리 없음 |
| `scripts/check-functional-cleanup.mjs` (추가) | 업무 저장소 정리의 계정 보존·멱등성, Mock 재활성화 차단, 보호 파일 동일성, 실제 상태 컴포넌트 렌더 검증 |
| `docs/functional-spec.md` (추가) | 로그인/가입을 제외한 15개 업무 기능의 목적·화면·API·요청/응답·권한·상태·이동·현재 구현·후속 작업 |
| `docs/backend-handoff.md` (추가) | 실제 연결 환경, 계약/권한 차이, 팀 확인 요청, 배포 후 검증 항목 |
| `docs/mock-cleanup.md` (추가), `docs/dev-status.md`, `README.md` | 정리 기록/검증/문서 연결과 폐기된 Mock 실행 안내 수정 |

정적인 메뉴·라벨·예시 placeholder·상담 시작 인사·시험유형 기본 선택은 업무 결과가 아닌 UI 입력/안내이므로 유지했다. 지구본 지도 좌표와 3D 장면 수치도 그래픽 표현이며 API 장비/시험 결과로 주입되지 않으므로 보존했다. 현재 기관 네트워크 UI는 서버 카탈로그로 계산하는 목록이다.

## 검증

환경: Windows, Node 22.19.0. 저장소 권장 환경은 Node 24이며 최종 CI는 권장 버전에서도 확인하는 것이 좋다. 신규 패키지는 설치하지 않았다. 기존 lockfile 의존성 설치 뒤 MSW만 제거했다.

| 검증 | 결과 |
|---|---|
| 타입 검사·프로덕션 빌드 `npm run build` | 통과(tsc -b + Vite). 3D 번들 500kB 초과 경고는 기존 3D 라이브러리 번들이며 빌드 오류 아님 |
| 정적 검사 `npm run lint` | 통과 |
| `node scripts/check-functional-cleanup.mjs` | 통과: 업무 데이터 제거 시 users/sessions/organizations/unknown/다른 키 보존, 멱등성/손상·차단 저장소, Mock imports/adapter/MSW 제거, VITE_API_MODE=mock 무효, 실제 ApiState 로딩/연결대기/403/404/409/500 렌더 |
| 로그인·회원가입·인증·미리보기 계정 소스 비교 | 위 보호 경로 전체가 기준 커밋과 동일. 기존 계정 정리 helper 본문 동일 |
| 스타일/공통 레이아웃 비교 | index.css/styles/Auth 스타일/AppHeader 변경 없음. 업무 화면 구조 유지, 시연 생성 버튼만 제거 |
| Chrome 실제 브라우저, 1440×1000 | 비회원 보호 URL → 로그인 이동. 기존 개발 미리보기의 기업 홈/검색/매칭/비교/시험정보/달력/의뢰/목록/중복/시뮬레이션/알림, AI 상담·자동추진 탭, 기관 장비 관리·검토, 관리자 운영, 대학 홈 렌더 확인. 가짜 장비 카드·일정 생성 버튼 없음, 런타임 예외 없음 |
| Chrome 모바일 390×844 | 홈·달력·검색 렌더, 가로 넘침 없음. 기존 반응형 UI 유지 |
| 실서버 15개 기능 종단 흐름 | **백엔드 미배포로 테스트 불가** |
| 실제 권한/소유권·JWT·동시 확정·DB 상태 반영·AI·파일 다운로드 내용 | **백엔드 미배포로 테스트 불가** |

브라우저 검증은 API 응답 가로채기나 가짜 업무 서버 없이 진행했다. 기존 DEV 미리보기 계정으로 오류/빈 상태의 렌더만 확인했으며 실제 로그인 성공이나 업무 데이터 변경을 테스트한 것은 아니다. UI 렌더·소스 동일성 검증은 실제 서버의 데이터 정확성/권한 검증을 증명하지 않는다.

## 이번 변경으로 하지 않은 작업

- Spring Boot/DB 수정, 백엔드 저장소 커밋·푸시, 없는 엔드포인트 추가, 새 Mock API 생성 없음.
- 명세와 다른 폼/DTO/권한을 새로 구현하거나 실제 연결 완료로 표시하지 않음. 차이는 후속 문서에 기록.
- 로그인/회원가입 기능·계정 데이터 변경 없음. 기존 개발 미리보기 인증 Provider는 제외 범위로 보존.
- main 직접 커밋·푸시, 원래 미커밋 로컬 작업 덮어쓰기, 공개 사이트 재배포 없음.
