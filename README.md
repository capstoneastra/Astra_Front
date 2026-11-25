# ASTRA Frontend

우주항공 시험장비 공동활용 플랫폼의 React, TypeScript, Vite 프런트엔드입니다.

## 팀원용 코드 받기 및 서버 없는 시연

저장소 접근 권한이 있는 GitHub 계정으로 `feat/yeonji` 브랜치를 받습니다.

```sh
git clone --branch feat/yeonji https://github.com/capstoneastra/Astra_Front.git
cd Astra_Front
npm ci
npm run dev:demo
```

이미 저장소를 받은 경우, 자신의 변경사항을 먼저 보관한 뒤 `git fetch origin`, `git switch feat/yeonji`, `git pull --ff-only origin feat/yeonji`를 실행합니다.

로그인 화면의 기업·기관·대학·관리자 버튼으로 예시 데이터를 확인할 수 있습니다. 이 모드는 실제 인증·AI·시험 예약·금융 결제가 아닌 DEMO이며, 데이터는 방문자 브라우저별로 저장됩니다. 실행·계정·모드 전환은 [DEMO 안내](docs/demo-mode.md), 회원별 화면과 결제 범위는 [업무 공간 안내](docs/role-workspace-payment.md)를 참고하세요.

## 개발 서버 실행

Node.js 24를 사용합니다. 의존성을 설치한 뒤 개발 서버를 실행하고 콘솔에 표시된 주소를 엽니다.

```sh
npm i
npm run dev
```

개발 서버는 기본적으로 실제 API를 사용합니다. 기본 경로는 같은 출처의 `/api/v1`입니다. 백엔드를 별도 주소에서 실행하면 `.env.local`의 `VITE_API_BASE_URL`에 백엔드 주소와 `/api/v1` 경로를 설정하세요.

기존 기능용 Mock과 MSW 응답 생성은 제거했고, 시연은 별도의 명시적 DEMO 모드로 분리했습니다. `VITE_API_MODE=mock` 등 이전 설정은 Mock을 활성화하지 않습니다. 일반 API 모드는 백엔드 미배포 상태에서 연결 대기·오류 상태를 표시하며 DEMO 응답으로 대체하지 않습니다. 실제 JWT 인증·토큰 갱신·회원가입 서비스는 유지합니다.

업무 기능 및 후속 연동 사항은 [전체 기능 명세](docs/functional-spec.md), [Mock 정리 및 검증 기록](docs/mock-cleanup.md), [백엔드 인수인계](docs/backend-handoff.md)를 참고하세요.

`npm run build`는 타입 검사와 프로덕션 번들을 실행합니다. `npm run lint`는 소스와 설정을 검사합니다.
