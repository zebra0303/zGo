# zGo

**zGo**에 오신 것을 환영합니다! zGo는 **React**와 세계 최고 수준의 바둑 AI **KataGo**를 결합한 현대적인 웹 기반 바둑 클라이언트입니다.

입문자부터 전문가까지, AI 대국, 온라인 대국, AI 분석 복기를 통해 기력을 향상할 수 있는 우아한 인터페이스를 제공합니다.

[English README](./README.md)

---

## 주요 기능

### 대국

- **AI 대국 (PvAI)**: 난이도(1~30)를 조절하며 KataGo와 대국. **Lv.1은 입문자를 위해 파라미터가 최적화**되어 의도적인 실수를 유도합니다. 9x9, 13x13, 19x19 바둑판 및 접바둑(2~9) 지원.
- **친선 대국 (PvP)**: 같은 기기에서 두 사람이 함께 두는 로컬 대국.
- **온라인 대국**: 고유 초대 링크로 방을 만들거나 참가. WebSocket 기반 실시간 대국, 캐릭터 아바타, 인게임 채팅, 이모지 반응, 무르기 요청 지원.

### 학습

- **선생님 모드**: AI가 실시간으로 최선의 수를 추천하고, 다른 곳에 두었을 때 왜 실수인지 한국어/영어로 해설 피드백 제공.
- **복기 모드**: 완료된 대국을 승률 그래프, AI 분석, 변화도 탐색, 사석 판별과 함께 자유롭게 탐색.
- **전체 분석**: SSE 스트리밍 기반 수순별 승률 분석. **rAF(requestAnimationFrame) 기반 프레임 동기화 업데이트**로 부드러운 UI 제공.
- **대화 기록**: 온라인 대국 중 나눈 채팅을 복기 모드에서 확인.

### 시스템

- **인증 시스템**: **보안이 강화된 HttpOnly 쿠키 기반** 관리자 인증. 요청 제한 및 잠금 보호 지원.
- **관리자 패널**: 사이드바에서 언어, 테마, 강조 색상, 폰트, 비밀번호를 관리.
- **엔진 관리**: AI 응답이 없을 경우 바둑판 아래 버튼으로 **KataGo 엔진 즉시 재시작** 가능.
- **PWA (Progressive Web App)**: 스마트폰 홈 화면에 앱으로 설치 가능. 서비스 워커 자동 업데이트 및 **지능형 HTTP 캐싱**으로 항상 최신 버전 유지.
- **다국어 (i18n)**: 한국어/영어 완벽 지원. UI와 AI 해설 언어 즉시 전환.
- **효과음**: 착수음, 패스, 승리/패배 사운드 제공.

---

## 설치 및 실행 (초보자 가이드)

프로그래밍을 모르셔도 아래 순서대로 따라 하시면 쉽게 내 컴퓨터에 zGo를 설치하고 실행할 수 있습니다.

### 준비물

1. **Node.js 설치**: [Node.js 공식 홈페이지](https://nodejs.org/)에 접속하여 **LTS 버전**(안정 버전)을 다운로드하고 설치합니다. (설치 시 기본 설정 그대로 '다음'을 눌러 완료하시면 됩니다.)

### 단계 1: zGo 다운로드 및 압축 풀기

1. 이 페이지의 우측 상단에 있는 초록색 **`<> Code`** 버튼을 누른 후, **`Download ZIP`**을 클릭합니다.
2. 다운로드 받은 `zGo-main.zip` 파일의 압축을 풀어줍니다. (예: 바탕화면이나 내 문서 폴더)

### 단계 2: 터미널 열고 폴더 이동하기

명령어를 입력할 수 있는 검은 창(터미널)을 엽니다.

- **Windows**: 시작 메뉴에서 `cmd` 또는 `명령 프롬프트`를 검색해서 엽니다.
- **Mac**: `cmd + space`를 누르고 `터미널` 또는 `Terminal`을 검색해서 엽니다.

터미널을 열었으면 압축을 푼 폴더로 이동합니다. (아래 명령어의 `경로` 부분을 실제 폴더 위치로 바꿔주세요.)

```bash
cd 바탕화면/zGo-main
# 예시 (Windows): cd Desktop\zGo-main
# 예시 (Mac): cd Desktop/zGo-main
```

### 단계 3: 필요 프로그램(의존성) 설치

아래 명령어를 복사해서 터미널에 붙여넣고 엔터를 누릅니다. (설치에 1~2분 정도 걸릴 수 있습니다.)

```bash
npm install
```

### 단계 4: 환경 변수 설정

1. zGo 폴더 안에서 **`.env.example`** 파일을 찾습니다.
2. 이 파일을 복사한 후, 복사본의 이름을 **`.env`** 로 변경합니다.
3. (선택 사항) 메모장 등으로 `.env` 파일을 열어 `JWT_SECRET` 부분에 나만의 복잡한 비밀 키를 입력하면 보안이 더 강화됩니다.

### 단계 5: KataGo AI 모델 다운로드

바둑 AI가 똑똑하게 두기 위해 필요한 뇌(모델 파일)를 다운로드해야 합니다.

1. [KataGo 아카이브](https://katagoarchive.org/g170/neuralnets/index.html) 링크를 클릭합니다.
2. 목록에서 `g170e-b10c128-s1141046784-d204142634.bin.gz` 파일을 찾아 클릭하여 다운로드합니다.
3. 다운로드한 파일의 이름을 **`katago-model.bin.gz`** 로 변경합니다.
4. 이 파일을 아까 압축을 푼 zGo 폴더 안의 `server` 폴더 안에 있는 `katago` 폴더로 이동시킵니다.
   - 최종 경로: `zGo-main/server/katago/katago-model.bin.gz`

### 단계 6: 실행하기

이제 모든 준비가 끝났습니다! 터미널에 아래 명령어를 차례대로 입력하세요.

```bash
# 먼저 빌드(실행 준비)를 합니다.
npm run build

# 빌드가 끝나면 프로그램을 시작합니다.
npm start
```

### 단계 7: 게임 접속하기

- 인터넷 브라우저(크롬, 엣지 등)를 열고 주소창에 **`http://localhost:3001`** 을 입력하고 접속합니다.
- 최초 접속 시 관리자 비밀번호를 설정하는 화면이 나옵니다. 원하시는 비밀번호를 설정한 후, 설정한 비밀번호로 로그인하여 바둑을 즐기시면 됩니다!

---

## 설치 및 실행 (Docker)

Docker가 설치되어 있다면, Node.js나 환경 설정을 수동으로 할 필요 없이 즉시 zGo를 실행할 수 있습니다. 가장 권장되는 실행 방법입니다.

### 준비물

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)이 설치되어 있고 실행 중이어야 합니다.

### 실행 순서

1. **터미널 열기**: 프로젝트 루트 폴더에서 터미널을 엽니다.
2. **환경 변수 설정**: `.env.example` 파일을 복사하여 `.env` 파일을 만듭니다.
3. **아래 명령어를 입력합니다**:

   ```bash
   docker-compose up -d --build
   ```

4. **게임 접속**: 브라우저에서 **`http://localhost:3001`** 에 접속합니다.

> **참고:** 로컬의 `server/katago/` 폴더에 모델 파일이 없는 경우, 첫 실행 시 컨테이너가 자동으로 모델 파일(~100MB)을 다운로드합니다. 모든 대국 기록과 설정은 로컬의 `server/database/` 폴더에 저장되어 컨테이너를 종료해도 안전하게 유지됩니다.

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
| **실시간 통신**  | WebSocket (ws)                                                              |
| **인증**         | bcrypt + jsonwebtoken (HttpOnly 쿠키), express-rate-limit                   |
| **PWA**          | vite-plugin-pwa (Workbox)                                                   |
| **테스트**       | Vitest (112개 테스트)                                                       |
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
│   │   │   ├── GameLayout.tsx      # 공통 게임 레이아웃 (공유 위젯)
│   │   │   ├── ReviewPanelWidget.tsx
│   │   │   └── TeacherAdviceWidget.tsx
│   │   ├── features/               # 바둑판 인터랙션, 온라인 UI (방, 채팅)
│   │   ├── entities/               # 매치 & 온라인 스토어, 바둑 로직, 트리 타입
│   │   └── shared/                 # API 클라이언트 (fetchWithAuth), 타입, i18n, 라우터
│   └── vite.config.ts              # Vite + PWA 플러그인 설정
├── server/                         # Express 백엔드 (TypeScript)
│   ├── src/
│   │   ├── index.ts                # 진입점, Cache-Control 헤더 설정
│   │   ├── db.ts                   # SQLite (대국, 설정, 룸, 채팅)
│   │   ├── middleware/auth.ts      # 쿠키 기반 requireAdmin 미들웨어
│   │   ├── lib/goLogic.ts          # 서버 측 착수 검증
│   │   ├── katago/                 # KataGo 프로세스 관리 & GTP
│   │   ├── routes/
│   │   │   ├── ai.ts              # /api/ai/* (착수, 분석, 계가, 재시작)
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

### 성능 최적화 요약

- **FSD 준수**: 계층 간 엄격한 분리로 순환 의존성을 방어하고 빌드 속도를 개선했습니다.
- **렌더링 최적화**: **개별 바둑돌 단위 메모이제이션**(`Stone` 컴포넌트)을 통해 착수 시 바둑판 전체가 아닌 변경된 지점만 리렌더링됩니다.
- **부드러운 UI**: `requestAnimationFrame`을 사용하여 승률 분석 업데이트를 브라우저 주사율과 동기화했습니다.
- **안정성 확보**: 모든 비동기 Effect에 **`AbortController`와 `isMounted` 체크**를 전수 적용하여 메모리 누수와 잘못된 상태 업데이트를 차단했습니다.
- **네트워크 효율**: **해시 기반 자산 캐싱**(1년)과 **HTML 캐시 방지**를 조합하여 로딩 속도 향상과 즉각적인 업데이트를 동시에 달성했습니다.

---

## 라이선스

이 프로젝트는 오픈소스입니다. 기여를 환영합니다!
