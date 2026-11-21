# 주현욱 작업현황

- React·TypeScript·Vite 프로젝트 초기 설정 (`1c90ebe`)
- 프로젝트 전체 TypeScript 전환과 타입 정의 적용 (`89ee457`)
- 기술 스택에 맞춰 React 18로 버전을 조정하고 React Router, TanStack Query, Tailwind CSS 연결
- 백엔드 명세를 바탕으로 로그인 오류 처리와 토큰 재발급, 이메일 인증 및 회원가입 구현. 기존 인증용 목데이터 제거
- 로그인·회원가입 화면에 기업·기관·대학·관리자별 내부 화면 미리보기 추가

# 이연지 작업현황

- `feat/yeonji`에서 기능용 Mock 데이터·MSW·업무 미리보기 API adapter 정리. 로그인/회원가입·인증 파일 및 기존 UI 스타일 보존
- [15개 업무 기능 명세](functional-spec.md), [Mock 정리·검증 기록](mock-cleanup.md), [백엔드 연동 인수인계](backend-handoff.md) 작성
- 실제 서버의 권한·상태 전이·예약/AI 등 통합 검증은 **백엔드 미배포로 테스트 불가**. 미구현 기능이나 계약 차이는 문서에 기록하고 이번에는 신규 기능을 구현하지 않음
