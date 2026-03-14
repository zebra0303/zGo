# zGo 🎮

**zGo**에 오신 것을 환영합니다! zGo는 최신 **React** 기술과 세계 최고 수준의 바둑 AI인 **KataGo**를 결합하여 만든 아름답고 현대적인 웹 기반 바둑 클라이언트입니다.

입문자부터 전문가까지, zGo는 AI와 대국을 즐기고, 고급 AI 추천을 통해 승률을 분석하며 기력을 향상할 수 있는 우아한 인터페이스를 제공합니다.

---

## 🚀 주요 기능

- **아름다운 UI**: 부드럽고 세련된 디자인의 반응형 웹 바둑판 환경.
- **다국어 지원 (i18n)**: 한국어와 영어를 완벽하게 지원하며 실시간으로 UI 및 AI 해설 언어를 전환할 수 있습니다.
- **AI 대국 (PvAI)**: 브라우저에서 직접 난이도(1~30단계)를 조절하며 강력한 KataGo와 대국을 즐기세요.
- **선생님 (Teacher) 모드**: 실시간으로 AI가 최선의 수를 추천해주고, 만약 다른 곳에 두었다면 왜 실수였는지 코멘트와 함께 피드백을 제공합니다. (한국어/영어 해설 지원)
- **복기 모드**: 완료된 대국을 불러와 승률 그래프와 쌍방향 AI 시각화 도표를 통해 자유롭게 수순을 탐색하세요.
- **전체 분석**: SSE 스트리밍 기반의 수순별 승률 분석 기능 (배치 업데이트로 최적화).
- **다양한 바둑판**: 9×9, 13×13, 19×19 바둑판 및 치석(2~9) 설정 지원.
- **효과음**: 착수음, 승리/패배 사운드 (볼륨 조절 가능).
- **로컬 저장소**: 대국 기록은 내부 SQLite 데이터베이스에 안전하게 자동 저장됩니다.

---

## 📦 설치 및 실행 방법 (초보자용 가이드)

프로그래밍이나 코딩을 전혀 몰라도 괜찮습니다! 아래의 간단한 순서만 따라 하시면 내 컴퓨터에서 바로 게임을 실행할 수 있습니다.

### 준비물 (사전 설치)

먼저 웹 앱을 구동시켜 줄 **Node.js** 프로그램이 필요합니다.

1. [Node.js 공식 홈페이지](https://nodejs.org/)에 접속합니다.
2. 화면에 보이는 **LTS (안정적, 신뢰도 높음)** 버전을 다운로드하고 설치를 완료해 주세요.

### 단계 1: 게임 폴더 준비

이 게임의 폴더(zGo)를 다운로드 받으셨다면, 압축을 풀고 원하는 위치(예: 바탕화면)에 폴더를 놓아주세요.

### 단계 2: 터미널 (명령 프롬프트) 열기

- **Windows**: 키보드의 `윈도우 키`를 누르고 `cmd`라고 입력한 뒤 엔터를 칩니다.
- **Mac**: 키보드의 `Command + Space`를 동시에 누르고 `Terminal` (또는 터미널)이라고 입력한 뒤 엔터를 칩니다.

### 단계 3: 프로젝트 폴더로 이동하기

이제 터미널 창에 `cd ` (cd 뒤에 띄어쓰기 한 칸)를 입력합니다. 그리고 방금 압축을 푼 zGo 폴더를 마우스로 끌어서 터미널 창 빈 공간에 놓은 뒤 엔터를 칩니다.

_(예시 결과: `cd Desktop/zGo` 처럼 입력됩니다)_

### 단계 4: 필수 파일 설치

폴더 안으로 들어왔다면, 아래 명령어를 입력하고 엔터를 눌러 게임 구동에 필요한 부품들을 설치합니다.

```bash
npm install
```

_(글자들이 쭈르륵 올라가며 설치가 진행됩니다. 1~2분 정도 끝날 때까지 기다려주세요.)_

### 단계 5: KataGo AI 모델 파일 다운로드

AI 엔진이 바둑을 두기 위해서는 인공지능 뇌 역할을 하는 모델 파일(`katago-model.bin.gz`)이 필요합니다. 파일 용량이 매우 커서 GitHub 저장소에는 기본 포함되어 있지 않습니다.

1. [KataGo 공식 아카이브 페이지](https://katagoarchive.org/g170/neuralnets/index.html)에 접속합니다.
2. 목록에서 `g170e-b10c128-s1141046784-d204142634.bin.gz` 파일을 찾아 다운로드합니다.
3. 다운로드 받은 파일의 이름을 `katago-model.bin.gz`로 변경합니다.
4. 이 파일을 현재 프로젝트의 `server/katago/` 폴더 안으로 이동시켜 줍니다.

### 단계 6: 포트 및 네트워크 설정 (선택 사항)

서버 포트나 API 주소를 변경하고 싶다면, 최상위 폴더에 `.env` 파일을 만들어서 설정할 수 있습니다. 함께 제공된 `.env.example` 파일을 참고하세요.

1. `.env.example` 파일을 복사하여 준비합니다.
2. 복사된 파일의 이름을 `.env` 로 변경합니다.
3. 메모장으로 열어 포트 번호(`PORT`: 백엔드, `VITE_PORT`: 프론트엔드)를 자유롭게 수정할 수 있습니다.

### 단계 7: 게임 실행하기!

게임을 실행하는 방법은 크게 두 가지가 있습니다:

**방법 A: 개발자 모드 (가장 간편함)**
아래 명령어를 치고 엔터를 누르세요:

```bash
npm run dev
```

**방법 B: 프로덕션 모드 (최적화 및 빠른 속도 - 권장)**
게임을 가장 빠르고 최적화된 상태로 즐기시려면, 먼저 앱을 빌드(압축)한 뒤 프로덕션 서버를 실행하세요:

```bash
npm run build
npm start
```

실행하신 방법에 따라 인터넷 브라우저(크롬, 웨일 등)를 열고 다음 주소로 접속하세요:

- **개발자 모드**: 👉 **[http://localhost:5550](http://localhost:5550)** (또는 `VITE_PORT`에 지정한 포트)
- **프로덕션 모드**: 👉 **[http://localhost:3330](http://localhost:3330)** (또는 `PORT`에 지정한 포트)

즐거운 대국 되시길 바랍니다! 🎉

---

## 🛠 개발자를 위한 안내

이 프로젝트는 프론트엔드의 확장성과 유지보수성을 극대화하기 위해 **FSD (Feature-Sliced Design)** 아키텍처를 엄격하게 준수합니다.

### 기술 스택

| 계층             | 기술                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| **프론트엔드**   | React 18, TypeScript, Tailwind CSS, Zustand (+ Immer), TanStack Query, Vite |
| **백엔드**       | Node.js, Express 5, TypeScript                                              |
| **AI 엔진**      | KataGo (GTP 프로토콜, child_process 통신)                                   |
| **데이터베이스** | SQLite3                                                                     |
| **테스트**       | Vitest, Testing Library                                                     |
| **코드 품질**    | ESLint, Prettier, Husky, lint-staged                                        |

### 프로젝트 구조

```
zGo/
├── client/                     # React 프론트엔드 (FSD 아키텍처)
│   ├── src/
│   │   ├── app/                # 앱 설정 (프로바이더, i18n)
│   │   ├── pages/              # 페이지 컴포넌트 (MainPage)
│   │   ├── widgets/            # 복합 UI 블록
│   │   │   ├── sidebar/        # 사이드바 분해 패널
│   │   │   ├── BoardWidget.tsx
│   │   │   ├── SidebarWidget.tsx
│   │   │   ├── ReviewControlWidget.tsx
│   │   │   ├── WinRateGraphWidget.tsx
│   │   │   └── TeacherAdviceWidget.tsx
│   │   ├── features/           # 기능별 로직 (바둑판 인터랙션)
│   │   ├── entities/           # 도메인 모델 (매치 스토어, 게임 트리, 바둑 로직)
│   │   └── shared/             # 공유 유틸리티, 타입, API, UI 컴포넌트
│   └── vite.config.ts
├── server/                     # Express 백엔드 (TypeScript)
│   ├── src/
│   │   ├── index.ts            # 앱 진입점, 라우트 마운트
│   │   ├── db.ts               # SQLite 초기화
│   │   ├── katago/
│   │   │   ├── engine.ts       # KataGo 프로세스 관리 & GTP 큐
│   │   │   ├── coords.ts       # 보드 ↔ GTP 좌표 변환
│   │   │   └── tactics.ts      # 수순 분석 & 해설 (한/영)
│   │   └── routes/
│   │       ├── ai.ts           # /api/ai/* 엔드포인트
│   │       └── matches.ts      # /api/matches CRUD
│   ├── __tests__/
│   ├── katago/                 # KataGo 바이너리 설정 & 모델
│   └── tsconfig.json
├── .env                        # 환경 변수 (PORT, VITE_PORT 등)
└── package.json                # 루트 스크립트 (dev, build, test, start)
```

### 주요 실행 명령어

| 명령어          | 설명                                              |
| --------------- | ------------------------------------------------- |
| `npm run dev`   | 클라이언트(Vite)와 서버(tsx watch) 동시 실행      |
| `npm run build` | 클라이언트(Vite) + 서버(tsc) 프로덕션 빌드        |
| `npm start`     | 프로덕션 서버 실행 (`server/dist/index.js`)       |
| `npm test`      | 전체 테스트 실행 (클라이언트 + 서버, 47개 테스트) |
| `npm run lint`  | 클라이언트 코드 린트 검사                         |

### API 엔드포인트

| 메서드 | 경로                   | 설명                                       |
| ------ | ---------------------- | ------------------------------------------ |
| POST   | `/api/ai/move`         | AI 수 생성 또는 선생님 힌트 (추천 수 포함) |
| POST   | `/api/ai/analyze-game` | 전체 대국 승률 분석 (SSE 스트림)           |
| POST   | `/api/ai/score`        | 최종 점수 계산 및 사석 판별                |
| POST   | `/api/matches`         | 대국 기록 저장                             |
| GET    | `/api/matches`         | 전체 대국 기록 조회                        |
| GET    | `/api/matches/:id`     | 특정 대국 상세 조회                        |
| DELETE | `/api/matches/:id`     | 대국 기록 삭제                             |

### 성능 최적화

- **코드 분할**: `React.lazy` + Vite manual chunks (vendor-react, vendor-state, vendor-i18n, vendor-icons). 모든 청크 134kB 이하.
- **메모이제이션**: 모든 무거운 컴포넌트에 `React.memo`, `useMemo`, `useCallback` 적용.
- **Zustand 셀렉터**: BoardCore에 `useShallow` 적용하여 불필요한 리렌더링 방지.
- **스로틀링**: 대국 분석 시 100ms 배치 업데이트로 상태 갱신 최적화.
- **AbortController**: 모든 비동기 Effect에 정리 함수 적용하여 메모리 누수 방지.
- **캐시 관리**: 선생님 추천 수 캐시 최대 50개 제한.
- **개발 프로파일링**: `useRenderProfile` 훅으로 느린 렌더(>16ms)를 개발 환경에서 감지.

---

## 📝 라이선스

이 프로젝트는 오픈소스입니다. 지식 공유와 바둑 AI 생태계 발전을 위한 기여를 언제나 환영합니다!
