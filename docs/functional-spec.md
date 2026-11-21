# ASTRA 업무 기능 명세 및 프론트엔드 구현 대조

작성일: 2026-11-21. 기준 브랜치: `feat/yeonji`, 조사 기준 커밋: `83ac98f`.

기준 문서는 이 브랜치의 [API 명세](api-spec.md), [기술 스택](tech-stack.md), [개발 현황](dev-status.md)이다. API 명세는 제목이 v0.1 초안이지만 V6~V12 변경 내용과 의뢰자/장비 보유 조직 정책을 포함한다. 과거 PDF나 로컬에 남은 이전 백엔드 사본보다 현재 저장소 문서를 기준으로 대조했다. `team-guide.md`, `demo-scenario.md` 및 실제 배포 Swagger는 이 작업 브랜치에 없으므로 확인하지 못했다.

**로그인·회원가입은 명세화·변경 대상에서 제외한다.** 아래의 접근 권한은 업무 API에 필요한 범위만 설명한다. 이번 변경은 기능용 Mock 정리와 명세 작성이며, 아래에 기록한 누락 기능이나 API 차이를 새로 구현하지 않는다. 화면과 서비스 함수가 있다는 사실은 실제 API 연동 완료를 의미하지 않는다. 모든 실제 서버 통합 검증은 **백엔드 미배포로 테스트 불가**이다.

## 공통 계약

### 응답과 입력

모든 URL 앞에 `/api/v1`을 붙인다. 요청은 JSON camelCase이고, 인증 헤더는 기존 공통 클라이언트가 처리한다. 성공·실패·페이지 구조를 변경하지 않는다.

```ts
type Success<T> = { success: true; data?: T }; // void 성공은 data 생략 가능
type Failure = { success: false; error: {
  code: string; message: string; details: unknown | null;
}};
type Page<T> = { content: T[]; page: number; size: number;
  totalElements: number; totalPages: number };
```

- 페이지는 0부터, size 최대 100. 실패를 성공한 빈 배열이나 0건으로 바꾸지 않는다.
- 날짜는 `YYYY-MM-DD`, 시각은 시간대 포함 ISO-8601, 화면 표시는 Asia/Seoul. 예약 구간은 시작 포함·끝 제외다.
- 상태 변경에는 명세에 따른 `version`을 전달한다. 성공 응답 뒤 관련 조회를 갱신하고, 409는 최신 상태를 다시 확인한다.
- null/누락 비용·기간·사양·가동률은 `확인 필요`/`정보 없음`이다. 숫자 0과 null을 구별한다.
- 서버가 `isMock`, `sourceType=MOCK`, `usedMockData`, `capability`를 반환하면 DEMO 표시를 유지한다. 이번에 삭제한 것은 프론트가 생성하던 데이터이며 서버의 출처 필드를 삭제하거나 실제 값으로 바꾸지 않는다.
- 조건 항목: `{key,label?,unit?,value?,min?,max?,valueText?,status?,source?,confidence?}`. 조건 키는 단위 없는 snake_case이며 선택 시험의 `conditionRules`에 있는 키만 사용한다.
- `NUMBER`는 value, `RANGE`는 min/max, `TEXT`는 valueText. `MISSING`, `UNCONFIRMED`, `CONFIRMED`를 임의로 같은 상태로 처리하지 않는다.

### 권한: 명세의 목표와 현재 UI 구분

| 대상 | 최신 명세의 접근 범위 | 현재 프론트 대조 |
|---|---|---|
| 비회원 | 인증 화면 외 업무 페이지·API 불가 | 기존 AuthGate/메뉴 보호 유지. 이번에 변경하지 않음 |
| COMPANY_USER | 조회 + 본인 의뢰자 기능 + 소속 조직 장비 보유자 기능 | AI/의뢰 메뉴는 허용, 장비 관리·기관 검토 메뉴는 현재 제한됨 |
| INSTITUTION_MANAGER(기관·대학) | 조회 + 본인 의뢰자 기능 + 소속 조직 장비 보유자 기능 | 기관 업무 메뉴는 허용, AI/의뢰 생성 메뉴는 현재 제한됨 |
| ADMIN | 전체 업무 및 운영 관리 | 기존 관리자 메뉴·보호 유지 |

의뢰자는 본인 상담·조건·의뢰·시뮬레이션만, 보유자는 `user.organization_id == equipment.institution_id` 또는 의뢰의 institution_id인 범위만 관리한다. 역할명만으로 소유권을 판정할 수 없으며 최종 검사는 서버 책임이다. 자기 조직 장비 의뢰는 400 VALIDATION_FAILED이고 매칭 후보에서도 제외한다.

**명세 내부 확인 필요:** API 명세 §0-4와 §2-1 표는 기업도 자기 조직 장비 관리 가능이라고 하지만 §2-1의 후속 설명에는 기업 403이라는 이전 문장이 남아 있다. 아래는 최신 공통 정책을 기준으로 작성했으며 최종 서버 정책은 [인수인계](backend-handoff.md)에서 확인 요청한다. 권한 파일은 이번에 수정하지 않았다.

### 공통 화면 상태

| 상황 | 표시·동작 | 현재 상태 |
|---|---|---|
| 최초 조회 | 기존 ApiState/로딩, 이전 데이터로 성공을 연출하지 않음 | 공통 useApiQuery 사용 |
| 정상 응답의 빈 목록 | 해당 화면의 데이터 없음 안내, 입력/탐색 UI 보존 | 화면별 EmptyState/안내문 존재. 일부 빈 폼 상태는 후속 개선 필요 |
| 네트워크 실패·타임아웃 | 서버 연결 대기 + 기존 오류 설명 + 사용자 재시도 | ApiState 보완. 자동 성공 fallback 없음 |
| 400 | 입력 오류, 미확인 필드 수정 유도 | 공통 오류는 있음. `missingItems` 등 세부 필드 매핑은 보완 필요 |
| 401/403 | 기존 세션 처리/접근 거부 유지, 비공개 데이터 노출 금지 | 기존 인증 구현 변경 없음; 실서버 검증 불가 |
| 404 | 없는/비활성 데이터 안내 | 기존 ApiState 유지 |
| 409 | 상태·버전·예약 충돌 안내 후 재조회 | 기존 예약 충돌 후 캐시 무효화 유지 |
| 429/500/502 | 재시도 안내, AI 실패를 결과로 저장하지 않음 | 공통 오류 처리. AI 개별 코드 표시 보완 필요 |

쿼리 자동 재시도·포커스/재연결 재조회는 기존 설정에서 꺼져 있다. AI 자동 추진만 성공적으로 조회한 RUNNING 상태에서 폴링한다. 백엔드 미배포를 이유로 호출 성공을 가장하지 않는다.

### 페이지 이동 구조

React Router와 기존 `useWorkspaceNavigation`을 유지한다. 업무 페이지는 `/#/search` 같은 기존 해시 경로이며 장비 상세·의뢰 상세는 별도 신규 URL이 아닌 다이얼로그다. AI 상담과 자동 추진은 기존 플로팅 AI 어시스턴트의 두 탭에서 실행한다. 뒤로가기와 검색 조건 복원은 기존 내비게이션을 사용한다.

## 1. 장비 통합 DB 검색

- **목적·흐름:** 로그인 → 검색 → 시험유형·기관·지역 등 조건 조합 → 페이지 이동 → 장비 상세/의뢰로 이동한다.
- **화면·컴포넌트:** `EquipmentSearch`, 장비 카드, 검색창, 필터 select, 페이지 이동, `EquipmentDetailDialog`, `ApiState`/`EmptyState`. 공통 카탈로그는 `App`에서 제공한다.
- **API·요청:** `GET /equipment?q=&region=&institutionId=&equipmentType=&testType=&availability=&externalOnly=&accreditedOnly=&includeMock=&page=&size=&sort=`. 복수 지역은 반복 파라미터다. sort는 externalId 또는 infoUpdatedAt만 허용한다.
- **응답:** `Page<EquipmentDto>`; id/externalId/name/model, institution{id,name}, region/equipmentType/testTypes, availability/availabilityNeedsConfirmation, utilizationRate/feeText, verificationStatus/isMock/infoUpdatedAt. 세부 예시는 API 명세 §2.
- **권한:** 로그인한 세 유형 모두 조회. 관리 액션은 별도 소유권 정책을 적용한다.
- **상태 처리:** 조회 중 카드 대신 로딩, 정상 0건은 검색 결과 없음, 서버 실패는 오류·재시도. 응답 검증에 실패하면 가짜 카탈로그로 대체하지 않는다.
- **버튼·이동:** 검색/필터 변경 및 페이지 이동 → 재조회, 카드 상세 → 다이얼로그, 의뢰 → `/#/reservation`.
- **현재 구현:** 검색·페이지·기관/지역/시험유형 필터와 API 서비스 존재. 이름·시험항목·기관 전용 탭은 실제 API에서 받은 카탈로그를 프론트에서 필터링한다. Mock 목록 fallback은 이번에 제거.
- **후속 연동:** accreditedOnly·복수 지역 등 최신 필터의 UI/서비스 지원, 전체 카탈로그를 순회하는 공통 조회의 규모 제한 검토, 서버 페이지·정렬·비활성 장비 제외 검증. **백엔드 미배포로 테스트 불가**.

## 2. 장비 상세 정보

- **목적·흐름:** 검색/대시보드 장비 선택 → 사양·이용조건·출처·갱신일 확인 → 시험 정보/가상 시뮬레이션/의뢰 선택.
- **화면·컴포넌트:** `EquipmentDetailDialog`, 사양 표, 이용조건 목록, 상태·DEMO 배지, 닫기/의뢰 버튼. 기존 모달 레이아웃 유지.
- **API·요청:** `GET /equipment/{id}`. 최신 확장 조회는 `GET /equipment/spec-definitions`, `GET /equipment/{id}/availability?from=&to=`이며 현재 상세 서비스에는 후자의 연결이 없다.
- **응답:** 목록 항목 + manufacturer/category/description, usage{accessScope,feeText,feeAmount,feeUnit,durationText,utilizationRate,availability,...}, specs[{key,label,value|min/max|valueText,unit,originalUnit,sourceType,verificationStatus,usageScope}], source, simulation{capability,presetIds}. 가용성은 equipmentId/from/to/availability/available/needsConfirmation/leadTimeDays/intervals다.
- **권한:** 모두 조회. 다른 조직의 예약자·의뢰 비공개 정보는 장비 가용성에 포함하지 않는다.
- **상태 처리:** 상세 로딩/404/오류·재시도, 미확인 사양·비용은 확인 필요, MOCK 사양에는 DEMO. 응답에 없는 사양을 만들지 않는다.
- **버튼·이동:** 닫기 → 기존 목록 유지, 의뢰 → 선택 장비를 workspace에 저장 후 의뢰 화면, 시험 정보·시뮬레이션 → 기존 해당 메뉴.
- **현재 구현:** 상세 조회·검증·모달·출처/사양 표시 존재. 로컬 가짜 장비 상세 반환은 제거. 최신 가용성·공인·운영방식 필드 일부는 미표시.
- **후속 연동:** DTO에 availabilityNeedsConfirmation/상태 근거/리드타임/운영방식 등 반영, `presetIds`는 명세상 문자열인데 현재 타입은 number[]인 차이 확인. **백엔드 미배포로 테스트 불가**.

## 3. 시험항목 및 자연어 검색

- **목적·흐름:** 한국어·영문·약어 또는 자연어 입력 → 검색 해석 → 실제 DB 후보 조회 → 필터/상세로 이어간다.
- **화면·컴포넌트:** `EquipmentSearch`의 자연어/시험항목 탭, 시험유형 select, 검색 카드. 입력 debounce 250ms 유지.
- **API·요청:** `GET /search?q=...`, `GET /test-types`; 일반 키워드 검색은 `GET /equipment?q=...`.
- **응답:** `/search`는 `{interpreted:{interpreter,testTypes,conditions,regions},testTypes:[{code,nameKo}],equipment:[목록 항목]}`. 장비 후보 최대 20개. `/test-types`는 [{code,nameKo,description,keywords,equipmentCount}] 배열이다.
- **권한:** 세 유형 로그인 사용자 모두 조회.
- **상태 처리:** 빈 자연어 입력은 초기 안내/빈 결과이며 서버 검색 성공으로 취급하지 않는다. q 공백은 서버 400. 실패는 오류·재시도, AI 또는 KEYWORD 해석을 구분해야 한다.
- **버튼·이동:** 검색 입력/탭/필터 변경 → 재조회·결과 필터, 카드 클릭 → 상세, 의뢰 → 의뢰 화면.
- **현재 구현:** 실제 서비스 경로·자연어 결과 카드·클라이언트 추가 필터 존재. service의 interpreted 타입은 아직 testTypeCode/keywords 중심으로 최신 응답과 다름. 클라이언트 규칙 기반 가짜 검색 엔진 제거.
- **후속 연동:** interpreted 타입·UI 대조, AI/KEYWORD 표시, 한글/영문/약어 동등 검색 사례와 20개 제한 검증. **백엔드 미배포로 테스트 불가**.

## 4. 시험 정보 안내

- **목적·흐름:** 시험유형 선택 → 필수 조건/비교 규칙/수행기관/예상 비용·기간 확인 → 조건 분석.
- **화면·컴포넌트:** `TestInformation`, 시험유형 select, 조건 규칙 표, 기관별 예상 정보 표, 조건 분석 이동 버튼.
- **API·요청:** `GET /test-types`, `GET /test-types/{code}`. 명세에 없는 별도 비용 산정 API를 추가하지 않는다.
- **응답:** `{code,nameKo,description,conditionRules:[{conditionKey,label,valueType,unit,isRequired,specKey,comparator}],institutions:[{id,name,region,equipmentCount,estCostMin,estCostMax,estDurationDays,accessScope}]}`.
- **권한:** 모두 조회. 조건 분석으로 이어지는 버튼은 최신 의뢰자 권한과 현재 메뉴 제한 차이 확인 필요.
- **상태 처리:** 로딩/404/서버 오류; null 비용·기간·외부 이용 여부는 미확인. 기관이 없거나 시험 목록이 비었을 때 별도 안내 강화는 후속 작업이다.
- **버튼·이동:** 유형 변경 → 상세 재조회, 조건 분석 → 기존 `/#/matching`.
- **현재 구현:** 조회 서비스·유형/조건/기관 표 존재. 정적 클라이언트 시험 규칙 및 비용 데이터 제거. 화면의 고정 시험유형 기본 선택은 입력 기본값이며 분석 결과가 아니다.
- **후속 연동:** estCostMax 등 DTO 누락 필드·정렬·미확인 상태 검증, 기관별 예상 정보와 확정 견적 구분. **백엔드 미배포로 테스트 불가**.

## 5. AI 챗봇 상담

- **목적·흐름:** AI 어시스턴트 상담 탭 → 사용자 메시지 → 서버 응답/추출 조건 확인 → 조건 생성 → 매칭 화면.
- **화면·컴포넌트:** `AiAssistant`, `Chatbot`, 메시지 목록, 입력창/전송, 추출 조건·누락 질문, 조건 정리 버튼, `Feedback`.
- **API·요청:** `POST /chat/sessions {title?}`, `GET /chat/sessions`, `GET /chat/sessions/{id}/messages`, `POST /chat/sessions/{id}/messages {content}`, `POST /chat/sessions/{id}/requirement {}`.
- **응답:** 세션 {id,title}; 현재 서비스는 목록을 Page로 사용한다. 메시지 전송은 `{userMessage:{id,role,content},assistantMessage:{id,role,content,metadata:{extractedConditions,suggestedTestType}}}`. 목록의 정확한 페이지 필드는 서버 확인 대상이다.
- **권한:** 최신 정책은 세 유형 중 본인 상담을 사용하는 의뢰자. 현재 UI는 기업/관리자만 상담 메뉴 노출.
- **상태 처리:** 전송 중 중복 요청 억제, 오류를 AI 답변처럼 추가하지 않음, 이력 없으면 고정 인사말만 표시. 인사말은 분석 결과가 아닌 UI 안내다. 429/502는 오류 안내.
- **버튼·이동:** 전송 → 세션 필요 시 생성 후 메시지 POST, 조건 정리 → requirement 생성/갱신 후 조건 분석. 어시스턴트 닫기는 기존 화면으로 복귀.
- **현재 구현:** 대화/이력/조건 생성 서비스와 UI 존재. 규칙 기반 가짜 답변 생성 제거. SSE는 미연결이며 기존 JSON 방식 유지.
- **후속 연동:** 세션별 소유권, 조건 metadata·이력 페이지, 스트리밍 지원 여부와 AI 실패 동작 확인. **백엔드 미배포로 테스트 불가**.

## 6. AI 시험조건 분석

- **목적·흐름:** 직접 입력 또는 상담 조건 불러오기 → 조건 저장 → 누락·불확실 항목 분석 → 사용자 수정·확정 → 매칭.
- **화면·컴포넌트:** `Matching`, `RequirementWorkbench`, `ConditionEditor`, 시험유형/목적/시료 폼, 조건 표, 분석·저장·확정 버튼.
- **API·요청:** `POST /requirements`(현재 폼: testTypeCode/title/purpose/sampleName/sampleQuantity), `GET/PATCH /requirements/{id}`, `PUT /requirements/{id}/conditions {conditions}`, `POST /requirements/{id}/analyze {}`, `POST /requirements/{id}/confirm {}`. 직접 생성 필드 필수 여부는 명세에 상세 예시가 없어 서버 협의 필요.
- **응답:** requirement{id,testTypeCode,title,purpose,sampleName,sampleQuantity,conditions,...}; analyze는 `{requirementId,testTypeCode,conditions,missing:[{key,label,question}],unconfirmed:[{key,label,reason}],readyForMatching}`.
- **권한:** 본인 조건만. 최신 정책상 기관·대학도 의뢰자로 사용 가능하나 현재 메뉴 제한 존재.
- **상태 처리:** 미입력=MISSING, 불확실=UNCONFIRMED, 사용자 확인=CONFIRMED. AI_EXTRACTED 출처 유지. 모르는 숫자·단위를 보충하지 않는다. 로딩/저장 실패·서버 오류와 조건 없음 안내.
- **버튼·이동:** 저장 → 조건 PUT, 분석 → analyze, 확인 → confirm, 매칭 → 같은 requirementId로 match 실행.
- **현재 구현:** 동적 conditionRules 입력·분석/저장/확정 UI 및 서비스 존재. 분석 응답 타입은 최신 전체 필드보다 좁고 requirement 상태 필드는 타입에 미정의. 클라이언트 AI 해석기 제거.
- **후속 연동:** 필수 조건 누락 시 확정/매칭 제한, 분석 응답 DTO, 기준 단위 환산·원문 근거 처리 및 version 적용 여부 확인. **백엔드 미배포로 테스트 불가**.

## 7. AI 장비 자동 매칭 및 비교

- **목적·흐름:** 조건 준비 → DB 후보 추천 → 조건별 판정·근거 확인 → 2~5대 비교 → 장비 선택·의뢰 초안.
- **화면·컴포넌트:** `Matching`, 추천 카드/조건별 표/판정 배지, `EquipmentCompare` 비교 표, 선택 장비 추가·제외 버튼.
- **API·요청:** `POST /requirements/{id}/match-runs {limit:5,region?}`, `GET /match-runs/{id}`, `GET /requirements/{id}/match-runs`(이력, 현재 미연결), `POST /equipment/compare {equipmentIds,testType?}`.
- **응답:** match는 `{id,requirementId,algorithmVersion,createdAt,results:[{id,rank,score,verdict,usedMockData,equipment,reason,checks}],disclaimer}`. compare는 `{equipment,rows:[{key,label,values}],usage,testType,usedMockData}`. 없는 사양 칸은 null.
- **권한:** 매칭은 본인 조건의 의뢰자, 단순 장비 비교는 로그인 전체. 자기 조직 장비는 추천 제외. DB에 없는 장비를 추천하지 않는다.
- **상태 처리:** 조건/후보 없음 안내, 조회·매칭 실패 표시, MET/NOT_MET/UNKNOWN 및 SUITABLE/PARTIAL/UNSUITABLE 구분. REAL 우선, MOCK 사용 시 DEMO. 사용 불가/정비 장비 제외와 미확인 가용성은 서버 판정.
- **버튼·이동:** 매칭 실행 → 서버 결과, 비교 선택 → `/#/compare`, AI 초안 → `/#/reservation`. 최종 가능 여부는 기관 검토다.
- **현재 구현:** 추천·비교 서비스/표/배지·최대 5대 제약 존재. fake 점수/판정/추천 이유 생성 제거. 최신 match 메타데이터 및 비교 usage 확장 타입 일부 미반영.
- **후속 연동:** comparator RANGE_WITHIN/MAX_LIMIT/MIN_LIMIT/NONE 및 공인 필요 특별 규칙 검증, 자기 조직 제외, 서버 판정/단위/출처 보존, 잘못된 1대·6대·중복 장비 요청 검증. **백엔드 미배포로 테스트 불가**.

## 8. AI 시험 의뢰서 자동 작성

- **목적·흐름:** 조건 + 장비/추천 선택 → AI 초안 요청 → DRAFT 확인 → 사용자 수정·검토 → 직접 제출.
- **화면·컴포넌트:** `Matching`의 초안 버튼, `Reservation` 폼, 조건 편집, 사용자 확인 체크, `Feedback`. 자동 제출은 없다.
- **API·요청:** `POST /test-requests/ai-draft {requirementId,equipmentId,matchResultId?}`, `GET /test-requests/{id}`, `PUT /test-requests/{id}/draft {version,content}`.
- **응답:** AI 초안 생성은 `{requestId,requestNo,status:"DRAFT",revision:{revisionNo,isAiGenerated,content},aiNotes}`. 현재 서비스 반환 타입은 requestId 중심으로 좁다.
- **권한:** 자신의 조건·의뢰자 범위. 자신의 조직 장비에는 의뢰 불가. 관리자 대리 처리는 서버 기록 기준.
- **상태 처리:** 조건·장비 미선택 시 실행 제한, 생성 중 로딩/중복 억제, 오류는 초안 생성 성공으로 표시하지 않음. aiNotes/미확인 항목은 사용자 확인 대상이다.
- **버튼·이동:** 초안 생성 → workspace draftRequestId 설정 → 의뢰 폼, 수정 저장 → 새 version 응답, 최종 확인·제출은 기능 9.
- **현재 구현:** 초안 API 서비스·수정 폼·명시적 제출 존재. 프론트가 만들던 AI 초안·가짜 revision 제거. 최신 본문 필수 필드는 일부 빠져 있음.
- **후속 연동:** aiNotes와 revision 메타데이터 표시, 전체 content 필드와 제출 유효성 검증. **백엔드 미배포로 테스트 불가**.

## 9. 온라인 시험 의뢰

- **목적·흐름:** 장비 선택 → DRAFT 생성 → 의뢰서 작성/저장 → 사용자 확인 → 제출 → 내 의뢰 목록/상세.
- **화면·컴포넌트:** `Reservation`, `ReservationCheck`, `RequestDetailDialog`, 신청자·시험·시료·일정·조건 폼, 상태 표/이력.
- **API·요청:** `POST /test-requests {equipmentId,requirementId?,matchResultId?}`, `GET /test-requests?box=SENT|RECEIVED&status=&page=&size=`, `GET /test-requests/{id}`, `PUT /test-requests/{id}/draft {version,content}`, `POST /test-requests/{id}/submit {version}`, `POST /test-requests/{id}/cancel {reason,version?}`, `GET /test-requests/{id}/history`.
- **본문·응답:** content는 applicant, actualUser, accounting, responsible, report, billing, test, sample, conditions, schedule, equipment, serviceRequirements, notes를 포함한다(API 명세 §5). 제출 필수: 희망 시작/종료일 + 실사용자 이름/연락처 + 회계 담당자 이름/연락처(전화 또는 이메일). 상세는 현재 revision·version·보완요청·예약과 estimatedFee/result를 포함한다. 목록은 Page이며 상세와 목록의 revision 포함 범위는 실서버 확인 필요.
- **권한:** 본인 보낸 의뢰(SENT), 소속 조직 장비로 받은 제출 의뢰(RECEIVED), 관리자 전체. 다른 기업 의뢰 ID 직접 조회는 서버 403. box 생략 시 기관 담당자는 RECEIVED, 다른 일반 회원은 SENT.
- **상태 처리:** 생성/저장/제출 중 상태, 400 missingItems, 자기 조직 장비 금지, 409 version 재조회, 정상 빈 의뢰 목록, 서버 오류를 별도로 다룬다.
- **버튼·이동:** 저장 후 사용자 확인 → submit → `/#/reservationCheck`, 행 클릭 → 의뢰 상세, 일정 보기 → `/#/calendar`, 작성 중 의뢰 → 기존 draft 편집.
- **현재 구현:** 작성·저장·직접 제출·목록·상세·상태 이력 서비스/UI 존재. 목록 UI는 box 선택 없이 역할 기본값 사용, 최초 100개 위주. actualUser/accounting 등 최신 필수 필드 폼·타입이 누락되어 실제 제출 완료를 보장할 수 없음. 가짜 의뢰 DB 제거.
- **후속 연동:** 위 필수 필드/오류 매핑, 보낸/받은 함 구분과 페이지, 결과/예상료/첨부 업로드·다운로드 API(§5) UI 연동. 이 작업에서 새로 구현하지 않음. **백엔드 미배포로 테스트 불가**.

## 10. 기관 검토 및 정보 보완

- **목적·흐름:** 받은 의뢰 → 검토 시작 → 보완/추가정보 요청 → 의뢰자 수정·재제출 → 재검토 → 통과 또는 반려.
- **화면·컴포넌트:** `ReservationCheck`의 기관 뷰, `RequestDetailDialog`, 보완 사유/기한/요청 필드 폼, `ConditionEditor`, 제출본·상태 이력.
- **API·요청:** `POST /test-requests/{id}/review/start {version}`, `POST /test-requests/{id}/supplements {version,kind?,message,items:[{fieldKey,label,required}],dueDate?}`, `GET /test-requests/{id}/supplements`, `POST /supplements/{id}/respond {version,message,content,changeSummary}`, `POST /test-requests/{id}/accept|reject|complete`(version, reject는 reason), `GET /test-requests/{id}/revisions`, `GET /test-requests/{id}/revisions/{no}?diffWith=...`, `GET /test-requests/{id}/history`.
- **응답:** 보완 목록/제출본/이력은 각각 서버 DTO, respond는 `{requestId,status:"RESUBMITTED",revisionNo}`. `kind=ADDITIONAL_INFO` 기본 요청 항목은 responsible.name/report.type/sample.disposal/billing.method. complete는 먼저 `PUT /test-requests/{id}/result {summary,reportNo?,reportUrl?}`로 결과가 등록되어야 한다.
- **권한:** 보유 조직/관리자는 검토·요청·통과·반려·완료, 의뢰자/관리자는 자기 의뢰 보완 응답. 역할명만의 버튼 판단은 현재 코드의 제한 사항이다.
- **상태 처리:** 아래 전이표 적용. 열린 요청 중복은 409 SUPPLEMENT_ALREADY_OPEN, 동시 수정·잘못된 단계도 409. 이력 없음/로딩/에러를 구분한다.
- **버튼·이동:** 검토 시작 → UNDER_REVIEW, 보완 요청 → SUPPLEMENT_REQUESTED, 보완 제출 → RESUBMITTED, 재검토 → UNDER_REVIEW, 통과 → 일정 협의. 최신 상태 재조회 후 버튼 갱신.
- **현재 구현:** 기본 보완/응답/검토/완료 버튼과 이력 존재. ADDITIONAL_INFO 종류 및 최신 필수 정보·결과 등록·특정 제출본 diff UI는 미연결. 기존 complete 버튼만으로 결과 등록을 대체할 수 없음. 가짜 보완/전이 생성 제거.
- **후속 연동:** 보유 조직 판단, 추가정보 폼, 결과 선등록 후 완료, 동시 보완/버전 충돌, 승인·반려 권한 검증. **백엔드 미배포로 테스트 불가**.

## 11. 시험 예약 검토 및 연계

- **목적·흐름:** 검토 통과(SCHEDULING) → 확정 점유 구간 조회 → 일정 제안/대안 → 보유 조직 확정 → 캘린더·상세 갱신.
- **화면·컴포넌트:** `ReservationCalendar`, `Calendar`, `ScheduleCard`, `ScheduleDetail`, `ReservationControls`, 의뢰 상세. 월 이동/오늘/필터/당일 상세/다가오는 일정 유지.
- **API·요청:** `GET /test-requests` → 허용된 id의 `GET /test-requests/{id}`로 캘린더 구성. `GET /test-requests/{id}/reservations`는 명세에 있으나 현재 서비스에서 별도 사용하지 않음. `GET /equipment/{id}/reservations?from=&to=`, `POST /test-requests/{id}/reservations {version?,startAt,endAt,note?}`, `POST /reservations/{id}/counter {version?,startAt,endAt,note?}`, `POST /reservations/{id}/confirm|cancel {version,...}`. version 필수 위치는 서버 확인 대상.
- **응답:** 의뢰 상세의 reservations[]를 기존 캘린더 모델로 투영한다. 현재 타입은 {id,status,version,startAt,endAt,note?,createdAt?}; 최신 명세의 proposedBySide/externalSystem/externalRef 등 전체 DTO는 서버 협의. 장비 점유 조회는 개인 정보 없는 [{startAt,endAt}]. 전체 캘린더 API를 새로 가정하지 않는다.
- **권한:** 본인 신청/소속 조직 접수/관리자 전체의 조회 범위. 확정은 장비 보유 조직/관리자. 기업·기관 유형과 proposedBySide의 COMPANY/INSTITUTION은 같은 뜻이 아니다.
- **상태 처리:** PROPOSED 노랑, CONFIRMED 시안, COUNTER_PROPOSED 보라, CANCELED 회색 + 텍스트. 미확정을 완료로 표시하지 않는다. 기간은 Asia/Seoul, [시작,끝). 확정·정비 겹침은 409 RESERVATION_OVERLAP, 동일 의뢰 이중 확정은 RESERVATION_ALREADY_CONFIRMED. 충돌 뒤 점유/상세 다시 조회.
- **버튼·이동:** 월 이동/오늘/필터 → 기존 캘린더 표시 변경, 일정 클릭 → 상세, 상세보기 → 기존 의뢰 다이얼로그, 일정 제안/확정 → 서버 요청 성공 뒤 갱신. 점유 조회 실패 시 일정 선택을 막는 기존 처리 유지.
- **현재 구현:** 월별 UI·다일 일정·최대 노출/더보기·필터·중복 검사·서버 액션 서비스 존재. 로컬 시연 일정 생성 버튼/seed 제거. 목록 전체 페이지 + 상세 병렬 최대 4개 조회 방식이며 실패한 상세를 몰래 건너뛰지 않음. 실서버 상세에 reservations가 없으면 명시적 계약 오류.
- **후속 연동:** 상세 예약 포함 보장/개별 예약 GET 선택, box 범위·기간 조회 성능·타임존·정비/운휴 가용성, DB 중복 확정 방지, 외부 예약시스템 연계 가용 여부 확인. **백엔드 미배포로 테스트 불가**.

## 12. 중복 장비 조회

- **목적·흐름:** 지역·시험유형 선택 → 동일/유사 장비 그룹 확인 → 조직·사양 비교 → 구축 전 검토 자료로 활용.
- **화면·컴포넌트:** `DuplicateEquipment`, 필터, 그룹별 장비 표/건수, 비교 버튼, `EquipmentCompare`.
- **API·요청:** `GET /equipment/duplicates?region=&testType=`, `GET /equipment/{id}/similar`, `POST /equipment/compare {equipmentIds,testType?}`.
- **응답:** duplicates는 [{region,testType:{code,nameKo},equipmentCount,institutionCount,equipment:[목록 항목]}]. similar는 [{equipment,reasons,nameSimilarity}]이며 평탄한 장비 배열이 아니다. compare는 기능 7 계약.
- **권한:** API 명세상 로그인 모두 조회 가능. 중복 그룹은 구축 필요성의 최종 판단이나 구매 승인 결과가 아니다.
- **상태 처리:** 지역/시험 그룹 없음, 로딩/조회 오류, 미확인 사양/DEMO 표시. 클라이언트에서 중복 건수/유사도를 조작하지 않는다.
- **버튼·이동:** 필터 → 그룹 재조회, 그룹 장비 비교 → 2~5대 선택 후 기존 compare 화면.
- **현재 구현:** 그룹·필터·비교 이동 UI/서비스 존재. similar 서비스 반환 타입은 현재 평탄 배열이라 명세와 불일치하며 UI에서 활용 여부 포함 후속 대조 필요. 가짜 그룹/유사도 생성 제거.
- **후속 연동:** 응답 wrapper 교정, 동일 지역·시험유형 2대 이상 그룹 정의/정렬, 사양 출처 우선순위 확인. **백엔드 미배포로 테스트 불가**.

## 13. AI 자동 추진

- **목적·흐름:** 실제 사용자 목적 입력 → ANALYZE → SEARCH → MATCH → DRAFT. 누락 시 사용자 보완 후 같은 실행 재개. 자동 제출·예약 확정 금지.
- **화면·컴포넌트:** `AiAssistant` 자동 추진 탭, `Automation`, 단계 목록, `RequirementWorkbench`, 시작/중단/재개/초안 확인.
- **API·요청:** `POST /ai/auto-runs {inputText}` 또는 `{chatSessionId}`, `GET /ai/auto-runs/{id}`, `POST /ai/auto-runs/{id}/resume {}`, `POST /ai/auto-runs/{id}/cancel {}`. events SSE는 명세에 미구현으로 표시되어 사용하지 않는다.
- **응답:** 시작 202; 조회 {id,status,currentStep,steps:[{step,status,message}],requirementId,matchRunId,draftRequestId}. 현재 UI 처리 실행 상태: PENDING/RUNNING/WAITING_USER/SUCCEEDED/FAILED/CANCELED. 최종 enum 전체는 서버 확정 필요.
- **권한:** 본인 실행을 사용하는 의뢰자/관리자. 현재 기관·대학 메뉴 접근은 제한되어 있음.
- **상태 처리:** 서버 RUNNING 성공 조회 때만 약 1.2초 폴링, 실패 시 오류를 보여주고 성공으로 진행하지 않음. WAITING_USER는 입력 보완 필요. 초기 예시 문장을 실제 입력값으로 채우던 코드는 제거하여 빈 입력으로 시작.
- **버튼·이동:** 시작 → run id 저장, 중단 → cancel, 보완 저장·재개 → resume, 초안 확인 → 기존 reservation 폼. 제출은 기능 9의 별도 사용자 확인.
- **현재 구현:** 시작/폴링/단계/대기 보완/재개/취소/초안 이동 존재. 현재 start 서비스는 inputText만 타입 지원. 브라우저가 단계를 성공으로 만들던 엔진 제거.
- **후속 연동:** chatSessionId 진입, currentStep/matchRunId DTO, 상태별 폴링 종료·실패 후 재조회, run 소유권 및 사용자 승인 유지 검증. **백엔드 미배포로 테스트 불가**.

## 14. 메인 대시보드

- **목적·흐름:** 로그인 후 자신의 업무 요약 → 장비 검색/보완·신규 의뢰/운영 관리로 이동.
- **화면·컴포넌트:** `Home`, `MetricCard`, 장비 분포·보유기관 패널(`InstitutionNetwork`), 요약 의뢰 표, 최신 장비, 역할별 바로가기, 업무 알림.
- **API·요청:** `GET /dashboard/summary?view=REQUESTER|PROVIDER`, 관리자 ADMIN 고정. `GET /dashboard/equipment-stats`, `GET /notifications`, `GET /notifications/unread-count`, `PATCH /notifications/{id}/read`, `POST /notifications/read-all`. 현재 장비 분포는 실제 catalog 조회 데이터로 계산하고 equipment-stats 전용 API는 미연결.
- **응답:** 공통 role/view, 10개 requestCounts, equipmentStats, dataAvailable. REQUESTER는 actionRequired/recentChats; PROVIDER는 institution/pendingReview/upcomingReservations/equipmentNeedsUpdate; ADMIN은 pendingUsers/pendingInstitutions/institutionVerification. 알림 DTO의 전체 필드는 UI 서비스와 서버 대조 필요.
- **권한:** 모두 로그인 필수. 최신 명세는 역할이 아닌 view로 의뢰자/보유자 화면 구분. 현재 프론트는 역할 기준 화면/검증이라 차이가 있음.
- **상태 처리:** dataAvailable.requests=false는 준비 중이며 확정 0건과 다름. 서버 오류 시 KPI를 가짜 숫자로 채우지 않음. 장비 목록 없음과 요약 조회 실패 분리. 서버가 미배포여도 API 모드라는 이유로 연동 완료를 주장하지 않는다.
- **버튼·이동:** 검색 → search, AI → 기존 어시스턴트, 신규/보완 의뢰 → 의뢰 관리/검토, 보유기관 → 기관 필터 검색, 장비 → 상세, 알림 → 기존 알림 화면.
- **현재 구현:** 역할별 요약/장비 분포/메뉴/알림 서비스 존재, 10개 상태 검증 및 dataAvailable 처리. view 파라미터·DTO와 최신 provider 장비 갱신 집계 미연결. 가짜 통계/알림 생성 제거.
- **후속 연동:** REQUESTER/PROVIDER 선택 및 조직 권한, 집계 DTO, 역할별 준비 중/미확인, 알림 타입·읽음·갱신 시점 검증. **백엔드 미배포로 테스트 불가**.

## 15. 가상 시뮬레이션

- **목적·흐름:** 장비 선택 → 서버 모델·프리셋/한계 확인 → 사용자 입력 → 실행 응답 → 가상 결과/차트/이력 → Excel·CSV·PDF 내보내기.
- **화면·컴포넌트:** `Simulation`, `SimulationStage`/3D 개념 시각화, 입력 폼, `SimulationChart`, `SimulationExports`, 이력 표. 기존 애니메이션·내보내기 유지.
- **API·요청:** `GET /simulation/models`, `GET /equipment/{id}/simulation-presets`, `POST /simulation/runs {presetId,inputParameters,requirementId?}`, `GET /simulation/runs/{id}`, `GET /simulation/runs?equipmentId=&page=&size=`.
- **응답:** 모델 {modelType,description,requiredInputFields,limitation,capability}, 프리셋 {presetId,modelType,inputParameters}; 실행 {id,presetId,status,modelType,modelVersion,capability,isMock,output:{chart:{xLabel,yLabel,series},summary,...},warning}. 현재 화면은 추가로 equipmentId/inputParameters/limitation/createdAt을 사용하므로 실제 응답 포함 여부 확인 필요. 이력은 현재 서비스에서 Page로 사용.
- **권한:** 로그인 전체 실행 가능하되 자신의 실행/조건만 접근. 관리자 범위는 서버 마스터 정책 기준.
- **상태 처리:** 장비 미선택은 선택 안내, 모델 조회 실패는 연결 대기/오류, 프리셋 없음은 실행 불가 안내, 결과 없음은 차트/보고서 생성하지 않음. 결과는 capability + DEMO + warning을 유지하며 실제 성적서로 표시하지 않는다.
- **버튼·이동:** 장비 변경 → 프리셋 조회/이전 결과 초기화, 실행 → 서버 결과만 저장, 이력 결과 → GET 응답 표시, 내보내기 → 현재 서버 결과를 브라우저 파일로 변환. 별도 다운로드 API를 만들지 않음.
- **현재 구현:** 폼·조회/실행 서비스·3D 개념 UI·이력·세 형식 내보내기 존재. 고정 장비 id=48 초기 선택과 가짜 모델/프리셋/수치 결과 계산 라우트 제거. 그래픽의 카메라·도형·움직임 계수는 UI 표현이므로 유지.
- **후속 연동:** 모델/프리셋/결과/이력 전체 DTO와 빈 모델 안내, 결과 이력의 장비 식별·입력 복원, 파일 내용·출처·한계 표시 검증. **백엔드 미배포로 테스트 불가**.

## 의뢰·예약 상태 전이 기준

| 현재 | 동작 | 다음 | 수행 주체 |
|---|---|---|---|
| DRAFT | submit | SUBMITTED | 본인 의뢰자 |
| SUBMITTED / RESUBMITTED | review/start | UNDER_REVIEW | 보유 조직 |
| UNDER_REVIEW | supplements | SUPPLEMENT_REQUESTED | 보유 조직 |
| SUPPLEMENT_REQUESTED | supplements/respond | RESUBMITTED | 본인 의뢰자 |
| UNDER_REVIEW | accept | SCHEDULING | 보유 조직 |
| UNDER_REVIEW | reject | REJECTED | 보유 조직 |
| SCHEDULING | reservation confirm | CONFIRMED | 보유 조직 |
| CONFIRMED | complete(결과 등록 필수) | COMPLETED | 보유 조직 |
| DRAFT~SCHEDULING | cancel | CANCELED | 본인 의뢰자 |

관리자는 서버 명세상 모든 동작 가능하되 변경 주체 이력이 남아야 한다. cancel 가능한 정확한 중간 상태는 API 명세 범위에 따라 서버 확인한다. 예약 자체의 PROPOSED/COUNTER_PROPOSED/CONFIRMED/CANCELED와 의뢰 상태를 섞지 않는다. 버튼 숨김은 서버 권한 검사를 대신하지 않는다.

## 15개 기능 외 기존 업무 화면 보존

장비 등록·편집·정보 확인·비활성화(`EquipmentManager`, `EquipmentEditDialog`), 업무 알림(`Notifications`), 기존 운영 화면(`AdminManagement`)을 삭제하지 않았다. 장비 관리의 `/institutions/me/equipment`, 사양 사전·시험유형 갱신·운휴·갱신 이력 등 최신 명세 확장은 현재 미연결 항목이 있다. 운영 화면의 가짜 조회·승인 응답만 삭제했으며 실제 관리자 서비스 인터페이스는 유지한다. **회원 계정·가입 정책의 구현 수정은 이번 범위에 포함하지 않는다.**

구체적인 연동 차이와 담당자 확인 목록은 [백엔드 인수인계](backend-handoff.md), 삭제 목록과 검증은 [Mock 정리 기록](mock-cleanup.md)을 따른다.
