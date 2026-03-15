# zGo

**zGo**에 오신 것을 환영합니다! zGo는 **React**와 세계 최고 수준의 바둑 AI **KataGo**를 결합한 현대적인 웹 기반 바둑 클라이언트입니다.

입문자부터 전문가까지, AI 대국, 온라인 대국, AI 분석 복기를 통해 기력을 향상할 수 있는 우아한 인터페이스를 제공합니다.

[English README](./README.md)

---

## 주요 기능

### 대국

- **AI 대국 (PvAI)**: 난이도(1~30)를 조절하며 KataGo와 대국. 9x9, 13x13, 19x19 바둑판 및 접바둑(2~9) 지원.
- **친선 대국 (PvP)**: 같은 기기에서 두 사람이 함께 두는 로컬 대국.
- **온라인 대국**: 고유 초대 링크로 방을 만들거나 참가. WebSocket 기반 실시간 대국, 캐릭터 아바타, 인게임 채팅, 이모지 반응, 무르기 요청(대국당 1회) 지원.

### 학습

- **선생님 모드**: AI가 실시간으로 최선의 수를 추천하고, 다른 곳에 두었을 때 왜 실수인지 한국어/영어로 해설 피드백 제공.
- **복기 모드**: 완료된 대국을 승률 그래프, AI 분석, 변화도 탐색, 사석 판별과 함께 자유롭게 탐색.
- **전체 분석**: SSE 스트리밍 기반 수순별 승률 분석 (배치 업데이트 최적화).
- **대화 기록**: 온라인 대국 중 나눈 채팅을 복기 모드에서 모달로 확인 (30개씩 레이지 로딩).

### 시스템

- **인증 시스템**: 비밀번호 기반 접근 제어 (JWT 토큰, 요청 제한, 잠금 보호).
- **관리자 패널**: 사이드바에서 언어, 테마(라이트/다크), 강조 색상, 폰트, 비밀번호를 관리.
- **PWA (Progressive Web App)**: 스마트폰 홈 화면에 앱으로 설치 가능. 서비스 워커 자동 업데이트 및 정적 자산 캐싱.
- **다국어 (i18n)**: 한국어/영어 완벽 지원. UI와 AI 해설 언어 즉시 전환.
- **효과음**: 착수음, 패스, 승리/패배 사운드 (볼륨 조절 가능).
- **다크 모드**: 모든 UI 컴포넌트에 다크 모드 지원.

---

## 설치 및 실행 (초보자 가이드)

### 준비물

[Node.js 공식 홈페이지](https://nodejs.org/)에서 **LTS 버전**을 설치하세요.

### 단계 1: 다운로드 및 폴더 이동

프로젝트를 다운로드하고 압축을 푼 뒤, 터미널에서 폴더로 이동합니다:

```bash
cd path/to/zGo
```

### 단계 2: 의존성 설치

```bash
npm install
```

### 단계 3: KataGo AI 모델 다운로드

1. [KataGo 아카이브](https://katagoarchive.org/g170/neuralnets/index.html) 접속.
2. `g170e-b10c128-s1141046784-d204142634.bin.gz` 다운로드.
3. 파일명을 `katago-model.bin.gz`로 변경.
4. `server/katago/` 폴더에 배치.

### 단계 4: 설정 (선택)

`.env.example`을 `.env`로 복사한 뒤 포트 번호를 수정할 수 있습니다 (`PORT`: 백엔드, `VITE_PORT`: 프론트엔드).

### 단계 5: 실행

**개발 모드:**

```bash
npm run dev
```

**프로덕션 모드:**

```bash
npm run build
npm start
```

- 개발 모드: [http://localhost:5550](http://localhost:5550) (또는 `VITE_PORT`)
- 프로덕션 모드: [http://localhost:3330](http://localhost:3330) (또는 `PORT`)

최초 접속 시 관리자 비밀번호 설정 화면이 표시됩니다.

---

## 개발자 안내

**FSD (Feature-Sliced Design)** 아키텍처를 준수합니다.

### 기술 스택

| 계층             | 기술                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| **프론트엔드**   | React 18, TypeScript, Tailwind CSS, Zustand (+ Immer), TanStack Query, Vite |
| **백엔드**       | Node.js, Express 5, TypeScript                                              |
| **AI 엔진**      | KataGo (GTP 프로토콜, child_process 통신)                                   |
| **데이터베이스** | better-sqlite3 (WAL 모드)                                                   |
| **실시간 통신**  | WebSocket (ws), JWT 기반 룸 토큰                                            |
| **인증**         | bcrypt + jsonwebtoken, express-rate-limit                                   |
| **PWA**          | vite-plugin-pwa (Workbox)                                                   |
| **테스트**       | Vitest (105개 테스트)                                                       |
| **코드 품질**    | ESLint, Prettier, Husky, lint-staged                                        |

### 프로젝트 구조

```
zGo/
├── client/                         # React 프론트엔드 (FSD 아키텍처)
│   ├── src/
│   │   ├── app/                    # 앱 설정 (프로바이더, i18n, 인증 게이트)
│   │   ├── pages/                  # MainPage, OnlinePage, AuthPage
│   │   ├── widgets/                # 복합 UI 블록
│   │   │   ├── sidebar/            # AdminPanel, SettingsPanel, GameStatusPanel,
│   │   │   │                       # MatchHistory, ChatHistoryModal
│   │   │   ├── BoardWidget.tsx
│   │   │   ├── SidebarWidget.tsx
│   │   │   ├── OnlineSidebarWidget.tsx
│   │   │   ├── ReviewControlWidget.tsx
│   │   │   ├── WinRateGraphWidget.tsx
│   │   │   └── TeacherAdviceWidget.tsx
│   │   ├── features/               # 바둑판 인터랙션, 온라인 UI (방, 채팅)
│   │   ├── entities/               # 게임 스토어, 온라인 스토어, 바둑 로직, 트리 유틸
│   │   └── shared/                 # API 클라이언트, 타입, i18n, 사운드, 라우터
│   └── vite.config.ts              # Vite + PWA 플러그인 설정
├── server/                         # Express 백엔드 (TypeScript)
│   ├── src/
│   │   ├── index.ts                # 진입점, 라우트 & WebSocket 마운트
│   │   ├── db.ts                   # SQLite (matches, system_settings,
│   │   │                           #   online_rooms, online_chat)
│   │   ├── middleware/auth.ts      # JWT requireAdmin 미들웨어
│   │   ├── lib/goLogic.ts          # 서버 측 착수 검증
│   │   ├── katago/                 # KataGo 프로세스 관리 & GTP
│   │   ├── routes/
│   │   │   ├── ai.ts              # /api/ai/* (착수, 분석, 계가)
│   │   │   ├── matches.ts         # /api/matches CRUD
│   │   │   ├── online.ts          # /api/online/* (방 생성, 참가, 매치)
│   │   │   └── settings.ts        # /api/settings/* (인증, 설정)
│   │   └── ws/
│   │       ├── onlineHandler.ts   # WebSocket 게임 로직
│   │       └── roomManager.ts     # 룸 상태 관리
│   └── katago/                     # KataGo 바이너리, 설정 & 모델
├── .env                            # 환경 변수
└── package.json                    # 루트 스크립트
```

### 실행 명령어

| 명령어          | 설명                                               |
| --------------- | -------------------------------------------------- |
| `npm run dev`   | 클라이언트(Vite)와 서버(tsx watch) 동시 실행       |
| `npm run build` | 클라이언트(Vite) + 서버(tsc) 프로덕션 빌드         |
| `npm start`     | 프로덕션 서버 실행                                 |
| `npm test`      | 전체 테스트 실행 (클라이언트 71 + 서버 34 = 105개) |
| `npm run lint`  | 클라이언트 코드 린트 검사                          |

### API 엔드포인트

#### AI

| 메서드 | 경로                   | 인증 | 설명                             |
| ------ | ---------------------- | ---- | -------------------------------- |
| POST   | `/api/ai/move`         | -    | AI 착수 또는 선생님 힌트 (해설)  |
| POST   | `/api/ai/analyze-game` | -    | 전체 대국 승률 분석 (SSE 스트림) |
| POST   | `/api/ai/score`        | -    | 최종 계가 및 사석 판별           |

#### 대국 기록

| 메서드 | 경로               | 인증 | 설명           |
| ------ | ------------------ | ---- | -------------- |
| POST   | `/api/matches`     | -    | 대국 기록 저장 |
| GET    | `/api/matches`     | -    | 전체 기록 조회 |
| GET    | `/api/matches/:id` | -    | 특정 기록 조회 |
| DELETE | `/api/matches/:id` | -    | 기록 삭제      |

#### 온라인 대국

| 메서드 | 경로                          | 인증 | 설명                    |
| ------ | ----------------------------- | ---- | ----------------------- |
| POST   | `/api/online/rooms`           | -    | 새 방 만들기            |
| GET    | `/api/online/rooms/:id`       | -    | 방 정보 조회            |
| POST   | `/api/online/rooms/:id/join`  | -    | 방 참가                 |
| GET    | `/api/online/rooms/:id/match` | JWT  | 매치 데이터 + 채팅 조회 |
| WS     | `/ws/online`                  | JWT  | 실시간 대국 통신        |

#### 인증 & 설정

| 메서드 | 경로                     | 인증 | 설명               |
| ------ | ------------------------ | ---- | ------------------ |
| GET    | `/api/settings/status`   | -    | 비밀번호 설정 여부 |
| POST   | `/api/settings/setup`    | -    | 최초 비밀번호 설정 |
| POST   | `/api/settings/login`    | -    | 로그인 (JWT 발급)  |
| POST   | `/api/settings/refresh`  | JWT  | 토큰 갱신          |
| PUT    | `/api/settings/password` | JWT  | 비밀번호 변경      |
| GET    | `/api/settings/config`   | -    | 공개 설정 조회     |
| PUT    | `/api/settings/config`   | JWT  | 설정 저장          |

### 성능 최적화

- **코드 분할**: `React.lazy` + Vite manual chunks (vendor-react, vendor-state, vendor-i18n, vendor-icons). 모든 청크 134kB 이하.
- **메모이제이션**: 모든 무거운 컴포넌트에 `React.memo`, `useMemo`, `useCallback` 적용.
- **Zustand 셀렉터**: BoardCore에 `useShallow` 적용하여 불필요한 리렌더링 방지.
- **스로틀링**: 대국 분석 시 100ms 배치 업데이트로 상태 갱신 최적화.
- **AbortController**: 모든 비동기 Effect에 정리 함수 적용하여 메모리 누수 방지.
- **캐시 관리**: 선생님 추천 수 캐시 최대 50개 제한.
- **PWA 캐싱**: 서비스 워커가 정적 자산(이미지, 폰트)을 캐싱하여 오프라인 지원.
- **개발 프로파일링**: `useRenderProfile` 훅으로 느린 렌더(>16ms)를 개발 환경에서 감지.

---

## 라이선스

이 프로젝트는 오픈소스입니다. 기여를 환영합니다!
