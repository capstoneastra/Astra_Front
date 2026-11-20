# ASTRA Frontend

우주항공 시험장비 공동활용 플랫폼의 React, TypeScript, Vite 프런트엔드입니다.

## 개발 서버 실행

Node.js 24를 사용합니다. 의존성을 설치한 뒤 개발 서버를 실행하고 콘솔에 표시된 주소를 엽니다.

```sh
npm i
npm run dev
```

개발 서버는 기본적으로 저장소에 포함된 Mock API로 ASTRA 로그인 화면을 엽니다. Mock Service Worker 스크립트는 Vite에서 제공합니다.

실제 백엔드를 연결할 때는 `.env.local`에 `VITE_API_MODE=api`와 `VITE_API_BASE_URL`을 설정하세요.

`npm run build`는 타입 검사와 프로덕션 번들을 실행합니다. `npm run lint`는 소스와 설정을 검사합니다.
