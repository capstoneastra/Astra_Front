# ASTRA Frontend

우주항공 시험장비 공동활용 플랫폼의 React, TypeScript, Vite 프런트엔드입니다.

## 개발 서버 실행

Node.js 24를 사용합니다. 의존성을 설치한 뒤 개발 서버를 실행하고 콘솔에 표시된 주소를 엽니다.

```sh
npm i
npm run dev
```

개발 서버는 기본적으로 실제 API를 사용합니다. 기본 경로는 같은 출처의 `/api/v1`입니다. 백엔드를 별도 주소에서 실행하면 `.env.local`의 `VITE_API_BASE_URL`에 백엔드 주소와 `/api/v1` 경로를 설정하세요.

기능용 Mock 데이터와 MSW 응답 생성은 제거했습니다. `VITE_API_MODE=mock` 등 이전 설정은 Mock을 활성화하지 않습니다. 백엔드 미배포 상태에서는 연결 대기·오류 상태를 표시하며, 실제 업무 데이터는 생성하지 않습니다. 로그인·회원가입 코드는 이번 정리에서 변경하지 않았습니다.

업무 기능 및 후속 연동 사항은 [전체 기능 명세](docs/functional-spec.md), [Mock 정리 및 검증 기록](docs/mock-cleanup.md), [백엔드 인수인계](docs/backend-handoff.md)를 참고하세요.

`npm run build`는 타입 검사와 프로덕션 번들을 실행합니다. `npm run lint`는 소스와 설정을 검사합니다.
