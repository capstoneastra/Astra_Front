# DEMO 실행 및 공개 시연

2026-11-25 · `feat/yeonji`

기능용 Mock 정리 이후 시연 엔진을 개발 DEMO로 분리 복원했다. 후속 ‘로그인·회원별 화면·상호 대여·DEMO 결제’ 요청에 따라 이제 **DEMO 로그인**을 거쳐 이용한다. [현재 회원별 업무 공간·결제 문서](role-workspace-payment.md)가 최신 실행 기준이다. 실제 백엔드 연동 또는 보안 검증 완료를 의미하지 않는다.

## 실행

```sh
npm run dev:demo -- --host 127.0.0.1 --port 5200 --strictPort
```

- 로그인: `http://127.0.0.1:5200/auth/login`
- 이메일: `company@astra.demo`, `company2@astra.demo`, `manager1@astra.demo`, `univ1@astra.demo`, `admin@astra.demo`
- 공통 시연 비밀번호: `12345678` (`docs/api-spec.md` §1, V9 seed 기준)
- 로그인 화면의 기업·기관·대학·관리자 버튼을 누르면 해당 이메일·비밀번호를 자동 입력한 뒤 기존 로그인 함수를 호출한다. 기업 B는 `company2@astra.demo`를 직접 입력한다. 버튼 선택으로 역할을 설정하지 않으며, 시연 계정의 역할·소속·활성 상태를 적용한다. 버튼은 명시적 개발 DEMO 또는 아래 공개 시연 빌드에서만 제공하고 일반 API 빌드에는 노출하지 않는다.
- 시뮬레이션: 로그인 후 장비 상세의 시뮬레이션 버튼 또는 `/#/simulation`. ‘진동시험기1’의 SDOF 프리셋 선택 → 실행. 관리자 기본 화면에는 노출하지 않는다.

위 주소는 이 PC의 개발 주소이며 공개 배포 주소가 아니다. 이전 `/preview/**` 주소도 DEMO에서는 로그인으로 이동한다. 실제 계정·JWT와 별도의 시연 세션을 사용한다.

## 실제 API와 분리

`npm run dev`는 기존 API 모드다. 개발 시에는 `.env.demo`의 `VITE_ENABLE_DEMO=true`와 Vite의 `import.meta.env.DEV`를 모두 만족해야 한다. 배포용 공개 시연은 `MODE=public-demo`와 `VITE_PUBLIC_DEMO=true`를 모두 만족하는 별도 빌드만 허용한다. 일반 `npm run build`는 기존 JWT 인증·API만 사용하며 `check-demo-boundary.mjs`로 DEMO 계정·저장소·데이터·결제 구현이 번들에서 제외되는지 확인한다. 실패한 실제 API를 DEMO 성공으로 대체하지 않는다. 새 MSW·라이브러리·미정 API를 추가하지 않았다.

axios 클라이언트·응답 규약·실제 인증 서비스·토큰 갱신·회원가입은 유지한다. 실제 서버 주소는 기존 `VITE_API_BASE_URL`을 설정한다. DEMO는 실제 계정·JWT를 발급하거나 검증하지 않는다.

## 공개 시연 빌드

```sh
npm run build:public-demo
npm run preview -- --outDir dist-public-demo.local --host 127.0.0.1 --port 5202
```

일반 API 산출물 `dist`와 공개 시연 산출물 `dist-public-demo.local`을 분리한다. 공개 빌드는 로그인 및 상단에 공개 DEMO임을 표시한다. 장비·AI·시뮬레이션·결제는 예시 응답이며 실제 서비스 보안이나 금융 결제가 아니다. 프로필·의뢰·예약 상태는 방문자 브라우저에 저장되고 다른 PC와 공유되지 않는다.

기존 공개 사이트는 `https://astra-team-preview-20261106.lustrouscaramel1.chatgpt.site`이다. 배포에는 해당 Site ID를 유지한 별도 `.deploy-public.local` 체크아웃을 사용한다. 팀 GitHub main은 변경하지 않는다. 현재 코드·폰트·공개 빌드 플래그만 허용 목록으로 복사하고 원본 Git 메타데이터, node_modules, .env.local, 개인 문서, API 설계 문서·PDF, 인증정보는 배포 파일에 포함하지 않는다. 일반 production 경계 검사와 공개 빌드의 브라우저 검증을 각각 수행한다. 사이트 반영 상태·저장 버전은 `.deploy-public.local/release-record.json`에 기록한다.

## 데이터와 한계

- `src/demo/data/catalog.json`: 기존 시연 커밋의 백엔드 seed 스냅샷 복원. 71개 장비와 20개 시뮬레이션 모델. 원본 출처·커밋은 JSON 메타데이터에 남긴다.
- 장비·사양은 DEMO 및 미검증으로 표시한다. 비용·기간·누락 사양을 확정 정보로 만들지 않는다.
- AI 응답·계산 결과·의뢰/예약 처리는 개발 시연이다. 실제 AI 분석, 기관 접수, 실제 시험 적합성이나 예약 확정이 아니다.
- 새 시연 의뢰·예약은 사용자가 생성한다. 시작 시 가짜 접수 건이나 달력 일정을 자동 생성하지 않는다.
- 브라우저 저장소 `astra.demo.workspace.v1`만 사용한다. 기존 인증 저장소 및 제거된 `astra.mock.database.v3`와 분리한다. 같은 출처에서 미리보기 계정을 바꾸면 시연 업무 상태를 공유할 수 있다.
- 복원 엔진은 기존 프로토타입 계약이다. 최신 `docs/api-spec.md`의 모든 소유권·조직 겸업·AI·첨부 계약과 동등하다고 주장하지 않는다. 실제 API 요청/응답·권한·동시성 검증은 **백엔드 미배포로 테스트 불가**다.

최근 UI 피드백과 로그인 제외 원칙은 [화면 명세](workspace-feedback-spec.md)를 따른다.
