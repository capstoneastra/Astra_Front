# ASTRA Frontend

우주항공 시험장비 공동활용 플랫폼의 React, TypeScript, Vite 프런트엔드입니다.

## 개발 서버 실행

Node.js 24를 사용합니다. 의존성을 설치한 뒤 개발 서버를 실행하고 콘솔에 표시된 주소를 엽니다.

```sh
npm i
npm run dev
```

개발 서버는 기본적으로 실제 API를 사용합니다. 기본 경로는 같은 출처의 `/api/v1`입니다. 백엔드를 별도 주소에서 실행하면 `.env.local`의 `VITE_API_BASE_URL`에 백엔드 주소와 `/api/v1` 경로를 설정하세요.

개발 중 업무 화면을 시연할 때는 `VITE_API_MODE=mock`으로 MSW를 활성화할 수 있습니다. 이 모드에서도 로그인, 회원가입, 계정 관리는 설정한 백엔드에서 처리합니다.

`npm run build`는 타입 검사와 프로덕션 번들을 실행합니다. `npm run lint`는 소스와 설정을 검사합니다.
