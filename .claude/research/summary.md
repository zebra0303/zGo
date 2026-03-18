# zGo Project Research Summary

> Last updated: 2026-03-18

## 1. 프로젝트 개요

zGo는 KataGo AI 엔진을 기반으로 한 웹 바둑 애플리케이션이다. 오프라인(PvP/PvAI)과 온라인 멀티플레이어를 지원하며, 선생님 모드(Teacher Mode)를 통한 실시간 코칭과 복기 모드(Review Mode)를 통한 사후 분석 기능을 제공한다. PWA로 모바일 설치 가능.

### 핵심 기능
- **오프라인 대국**: PvP / PvAI (난이도 1-30, visits 기반 + temperature/playout advantage)
- **온라인 멀티플레이어**: WebSocket 기반, 실시간 대국, 채팅, 이모지, 무르기(1회/인), 캐릭터 아바타
- **선생님 모드**: 실시간 AI 추천 수, 전술 해설, 비판(critique)
- **복기 모드**: 저장된 기보 탐색, 승률 그래프, 변화도(variation) 탐색, 사석 판별
- **SSE 기반 게임 분석**: 복기 시 KataGo를 통한 자동 승률 분석 (throttled batch 업데이트)
- **인증 시스템**: bcrypt + JWT (7일), 5회 실패 → 15분 잠금
- **관리자 패널**: 언어, 테마(라이트/다크), 강조 색상, 폰트, 비밀번호 관리
- **PWA**: vite-plugin-pwa, 서비스 워커, 홈 화면 설치
- **다국어**: 한국어/영어 i18n 지원 (AI 해설 포함)
- **다양한 바둑판**: 5x5 ~ 19x19, 접바둑(handicap) 0-9
- **효과음**: 착수, 패스, 승리/패배, 채팅 사운드 (볼륨 조절)

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| **Frontend** | React 18, TypeScript, Vite 5, Tailwind CSS 3.4 |
| **State** | Zustand 5 + Immer 11 (persist middleware, localStorage) |
| **Data Fetching** | TanStack React Query 5 |
| **i18n** | i18next + react-i18next |
| **Backend** | Node.js, Express 5.2, TypeScript, CommonJS |
| **Database** | better-sqlite3 (WAL mode), SQLite |
| **AI Engine** | KataGo (GTP protocol, child_process.spawn) |
| **Realtime** | WebSocket (ws 8.19) + JWT room tokens (24h) |
| **Auth** | bcrypt 6 + jsonwebtoken 9, express-rate-limit |
| **PWA** | vite-plugin-pwa (Workbox) |
| **Build** | Vite (client), tsc (server), Concurrently (dev) |
| **Testing** | Vitest (client 71 + server 34 = 105 tests) |
| **Code Quality** | ESLint, Prettier, Husky + lint-staged |

---

## 3. 디렉토리 구조

```
zGo/
├── .claude/                         # AI agent 설정
│   ├── commands/                    # 슬래시 명령 (research_summary, refactoring)
│   └── research/                    # 프로젝트 분석 결과 (이 파일)
├── client/                          # React 프론트엔드 (FSD 아키텍처)
│   ├── public/                      # 정적 자산
│   │   ├── zgo_logo.png             # 앱 로고 (512x512, PWA 아이콘)
│   │   ├── igo_logo.png             # 선생님 로고
│   │   └── assets/sounds/           # mp3 효과음 (put, pass, win, lose, chat 등)
│   ├── index.html                   # PWA 메타 태그, 웹폰트 로드
│   ├── vite.config.ts               # Vite + PWA + 코드 분할
│   ├── tailwind.config.js           # darkMode: "class", CSS 변수 테마
│   └── src/
│       ├── app/
│       │   ├── App.tsx              # 인증 게이트 + 테마/언어 동기화 + 라우팅
│       │   └── main.tsx             # 엔트리 (QueryClientProvider + StrictMode)
│       ├── pages/
│       │   ├── MainPage.tsx         # 2-column 레이아웃 (보드 + 사이드바)
│       │   ├── AuthPage.tsx         # 로그인/설정 페이지
│       │   └── OnlinePage.tsx       # 멀티뷰 온라인 (create/join/waiting/playing/farewell)
│       ├── widgets/
│       │   ├── BoardWidget.tsx      # 바둑판 컨테이너 + 온라인 오버레이 (AI 훅 포함)
│       │   ├── SidebarWidget.tsx    # 오프라인 사이드바 (탭: 대국/기록/관리)
│       │   ├── OnlineSidebarWidget.tsx  # 온라인 사이드바 (채팅, 플레이어 정보)
│       │   ├── TeacherAdviceWidget.tsx  # AI 추천 수 + 비판 표시
│       │   ├── ReviewPanelWidget.tsx    # 승률 그래프 + 복기 컨트롤 + 분기 칩
│       │   └── sidebar/
│       │       ├── GameStatusPanel.tsx    # 턴 표시 / 결과 / 복기 상태
│       │       ├── SettingsPanel.tsx      # 게임 설정 (모드, 크기, AI 등)
│       │       ├── MatchHistory.tsx       # 전적 리스트 + AI 통계
│       │       ├── AdminPanel.tsx         # 관리자 패널 (테마, 언어, 비번)
│       │       └── ChatHistoryModal.tsx   # 채팅 기록 모달 (30개 레이지 로딩)
│       ├── features/
│       │   ├── board/
│       │   │   ├── ui/BoardCore.tsx       # SVG 바둑판 렌더러
│       │   │   └── lib/
│       │   │       ├── useAITurn.ts       # AI 자동 착수 훅
│       │   │       └── useGameScoring.ts  # 계가/사운드 훅
│       │   └── online/
│       │       ├── ui/                    # CreateRoomForm, JoinRoomForm, WaitingRoom
│       │       └── lib/wsClient.ts        # WebSocket 클라이언트 (재연결 지원)
│       ├── entities/
│       │   ├── board/lib/goLogic.ts       # 바둑 룰 (착수, 따냄, 자충수, 패)
│       │   ├── match/
│       │   │   ├── model/store.ts         # Zustand 중앙 게임 스토어
│       │   │   └── lib/
│       │   │       ├── treeUtils.ts       # 트리 직렬화/역직렬화
│       │   │       ├── useGamePath.ts     # 메인 분기 경로 훅
│       │   │       └── useBranchPoints.ts # 변화도 분기점 훅
│       │   └── online/model/
│       │       ├── store.ts               # 온라인 게임 Zustand 스토어
│       │       └── types.ts               # CharacterType, RoomInfo 등
│       └── shared/
│           ├── api/
│           │   ├── gameApi.ts             # REST + SSE 클라이언트
│           │   └── queryClient.ts         # React Query 인스턴스
│           ├── config/
│           │   ├── i18n.ts                # i18next 설정 (ko 기본)
│           │   └── locales/               # ko/en translation.json
│           ├── lib/
│           │   ├── goUtils.ts             # getPlayerForMove, buildMoveHistory
│           │   ├── formatUtils.ts         # 게임 결과 텍스트 포맷
│           │   ├── sound.ts               # 효과음 재생 (오디오 풀)
│           │   ├── themeUtils.ts          # 테마/폰트/색상 CSS 변수 적용
│           │   ├── router.ts              # 해시 기반 라우팅
│           │   ├── useRenderProfile.ts    # 개발용 성능 프로파일링 (>16ms 감지)
│           │   └── errors/AppError.ts     # 커스텀 에러 클래스 (Error Masking)
│           ├── types/board.ts             # BoardState, PlayerColor 타입
│           └── ui/CustomDialog.tsx        # 알림/확인 다이얼로그
├── server/
│   ├── src/
│   │   ├── index.ts               # Express 서버 + WebSocket 업그레이드 + SPA 폴백 + Graceful Shutdown
│   │   ├── db.ts                  # better-sqlite3 (matches, system_settings, online_rooms, online_chat)
│   │   ├── middleware/auth.ts     # JWT requireAdmin 미들웨어
│   │   ├── routes/
│   │   │   ├── ai.ts             # AI 착수/분석/계가 (KataGo GTP)
│   │   │   ├── matches.ts        # 기보 CRUD
│   │   │   ├── online.ts         # 방 생성/참가/조회
│   │   │   └── settings.ts       # 인증 + 설정 API
│   │   ├── ws/
│   │   │   ├── onlineHandler.ts  # WebSocket 게임 로직 (메시지 기반 상태 머신)
│   │   │   └── roomManager.ts    # 인메모리 방 연결 관리 (Map<roomId, {host, guest}>)
│   │   ├── katago/
│   │   │   ├── engine.ts         # KataGo 프로세스 관리 + GTP 명령 큐 + Graceful Kill
│   │   │   ├── coords.ts         # 좌표 변환 (GTP ↔ xy)
│   │   │   └── tactics.ts        # 수 분류 (capture/saving/atari/cut 등) + 다국어 해설
│   │   └── lib/goLogic.ts        # 서버측 착수 검증 + 보드 재생
│   ├── katago/
│   │   ├── gtp_config.cfg        # KataGo 설정 (6스레드, 100 visits 기본)
│   │   └── katago-model.bin.gz   # AI 모델 (git 미포함)
│   └── __tests__/logic.test.ts   # 좌표 변환, 접바둑, 전술 테스트 (34개)
├── package.json                   # 루트 모노레포 (concurrently, husky, lint-staged)
└── .env                           # PORT=3330, VITE_PORT=5550, JWT_SECRET
```

---

## 4. 서버 아키텍처

### 4.1 KataGo 프로세스 관리 (engine.ts)

```
Node.js Server ←→ KataGo Process
  stdin:  GTP 명령 전송 (boardsize, play, genmove, undo, clear_board 등)
  stdout: GTP 응답 수신 (= <result>\n\n 또는 ? <error>\n\n)
  stderr: 검색 정보 (승률, 추천 수 visits 등)
```

- **명령 큐 시스템**: `commandQueue`에 명령을 넣고 순차 처리. 이중 줄바꿈(`\n\s*\n`)으로 응답 경계 감지.
- **API 요청 큐**: 상위 레벨 큐로 API 요청 직렬화 (KataGo 동시 접근 방지)
- **승률 파싱 (stderr)**: `W <utility>[c]` → `((utility + 1) / 2) * 100` (검색하는 쪽 관점)
- **추천 수 파싱**: `^([A-Z][0-9]{1,2})\s*:\s*T\s+.*?\s+W\s+([-+]?[0-9.]+)[c]?\s*.*?\sN\s+(\d+)` → move, utility, visits
- **자동 재시작**: 60초 타임아웃 시 재시작, 10,000 API 호출마다 메모리 관리 재시작
- **안전한 종료 (Graceful Shutdown)**: Node 서버 종료(SIGINT, SIGTERM) 시 자식 프로세스인 KataGo에 명시적 `SIGTERM`을 전송해 좀비 프로세스(고아 프로세스) 생성 완벽 방지.

### 4.2 API 엔드포인트

#### AI

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/ai/move` | AI 착수 또는 추천 수 (isHintRequest). 난이도 매핑: 1→1 visit, 10→600, 20→1500, 30→2500 |
| POST | `/api/ai/analyze-game` | SSE 스트리밍 게임 분석 (50 visits/수) |
| POST | `/api/ai/score` | 계가 (final_score + final_status_list → dead stones) |

#### 기보

| Method | Path | 설명 |
|--------|------|------|
| POST | `/api/matches` | 기보 저장 |
| GET | `/api/matches` | 기보 목록 (DESC) |
| GET | `/api/matches/:id` | 기보 상세 (sgfData 포함) |
| DELETE | `/api/matches/:id` | 기보 삭제 |

#### 온라인

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| POST | `/api/online/rooms` | - | 방 생성 → roomId + JWT(role:host, 24h) |
| GET | `/api/online/rooms/:id` | - | 방 정보 조회 |
| POST | `/api/online/rooms/:id/join` | - | 방 참가 → JWT(role:guest, 24h) |
| GET | `/api/online/rooms/:id/match` | JWT | 매치 데이터 + 채팅 기록 |
| WS | `/ws/online` | JWT | 실시간 대국 통신 |

#### 인증 & 설정

| Method | Path | 인증 | 설명 |
|--------|------|------|------|
| GET | `/api/settings/status` | - | 비밀번호 설정 여부 |
| POST | `/api/settings/setup` | - | 최초 비밀번호 설정 (rate limit: 10/15min) |
| POST | `/api/settings/login` | - | 로그인 → JWT (7일). 5회 실패 → 15분 잠금 |
| POST | `/api/settings/refresh` | JWT | 토큰 갱신 |
| PUT | `/api/settings/password` | JWT | 비밀번호 변경 |
| GET | `/api/settings/config` | - | 공개 설정 (admin_password, login_failure_state 제외) |
| PUT | `/api/settings/config` | JWT | 설정 저장 |

### 4.3 SSE 분석 엔드포인트 — 중요 패턴

Express 5에서 async handler + SSE 스트리밍 충돌 방지:

```typescript
// ✅ 올바른 패턴: non-async handler + 내부 IIFE
app.post("/api/ai/analyze-game", (req, res) => {  // non-async!
  res.writeHead(200, { "Content-Type": "text/event-stream", ... });
  let aborted = false;
  res.on("close", () => { aborted = true; });  // req.on("close") 아님!
  (async () => { /* ... */ })();
});
```

### 4.4 WebSocket 온라인 게임 (onlineHandler.ts)

**연결 흐름:**
1. 클라이언트 → `/ws/online` 업그레이드
2. 10초 이내 `auth` 메시지 (roomToken JWT) 전송 필수
3. JWT 검증 → roomId + role 추출
4. room_state 전송 (moves, currentPlayer, chat 등)

**메시지 타입 (client → server):**
- `move` {x, y} → 서버 goLogic 검증 후 브로드캐스트
- `pass`, `resign`, `leave`
- `chat` {message} (max 200자) → DB 저장 + 브로드캐스트
- `undo_request` → 상대에게 전달
- `undo_response` {accepted} → 수락 시 마지막 2수 제거, 현재 플레이어 재계산

**서버 → 클라이언트:** room_state, move, pass, game_over, chat, undo_request/accepted/rejected, opponent_disconnected/reconnected, room_closed

### 4.5 데이터베이스 스키마 (db.ts)

```sql
-- 오프라인 기보
CREATE TABLE matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mode TEXT, aiDifficulty INTEGER, humanColor TEXT,
  winner TEXT, date TEXT, sgfData TEXT
);

-- 시스템 설정 (인증 + 테마)
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY, value TEXT NOT NULL
);

-- 온라인 방
CREATE TABLE online_rooms (
  id TEXT PRIMARY KEY,  -- UUID
  status TEXT DEFAULT 'waiting',  -- waiting/playing/finished
  board_size INTEGER DEFAULT 19,
  handicap INTEGER DEFAULT 0,
  host_nickname TEXT, host_character TEXT, host_color TEXT,
  guest_nickname TEXT, guest_character TEXT,
  moves TEXT DEFAULT '[]',  -- JSON array
  current_player TEXT DEFAULT 'BLACK',
  host_undo_used INTEGER DEFAULT 0,
  guest_undo_used INTEGER DEFAULT 0,
  winner TEXT, result_text TEXT,
  created_at TEXT, updated_at TEXT
);

-- 채팅 기록
CREATE TABLE online_chat (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT REFERENCES online_rooms(id),
  sender TEXT, message TEXT, created_at TEXT
);
```

**sgfData JSON 구조:**
```json
{
  "moves": [null, {x, y}, null, ...],
  "winRates": [50, 55, 45, ...],
  "resultText": "백 기권패 (흑 승)",
  "resultWinner": "BLACK",
  "boardSize": 19,
  "handicap": 0,
  "chat": [{"sender": "host", "message": "hi", "createdAt": "..."}],
  "hostNickname": "Player1",
  "guestNickname": "Player2",
  "hostCharacter": "fox",
  "guestCharacter": "cat"
}
```

### 4.6 전술 분석 (tactics.ts)

우선순위: capture(1) → saving(2) → atari(3) → cut(4) → connection(5) → corner(6) → side(7) → center(8)

한국어/영어 해설 지원. BFS로 그룹 활로 계산.

### 4.7 AI 난이도 시스템 (ai.ts)

난이도 1-30 → maxVisits 매핑:
- 1-5: 1, 2, 5, 10, 20 visits (극초보)
- 6-10: 50, 100, 200, 400, 600
- 11-15: 800, 1000, 1200, 1500, 1500
- 16-20: 1500 (temperature + playout advantage로 약화)
- 21-30: 1500, 1800, 2000, 2200, 2500 (프로 수준)

아마추어 레벨(≤15): temperature, playoutDoublingAdvantage 파라미터로 AI 약화

---

## 5. 클라이언트 아키텍처 (FSD 준수)

프론트엔드는 완벽한 단방향 의존성 규칙을 지키는 **Feature-Sliced Design(FSD)** 아키텍처를 따른다.

### 5.1 App.tsx (인증 게이트 + 테마)

**인증 흐름:**
1. `GET /settings/status` → isSetup 확인
2. localStorage `admin_token` 존재 시 → refresh 시도
3. 상태 분기: loading → setup/login → authenticated
4. 온라인 페이지(`online-room`, `online-farewell`)는 인증 우회

**테마 적용:**
1. localStorage에서 빠른 초기 적용 (FOUC 방지)
2. `GET /settings/config` → 서버 설정 fetch → 덮어쓰기
3. themeUtils: applyPrimaryColor, applyFontFamily, applyThemeMode

### 5.2 Zustand 중앙 스토어 (store.ts)

**게임 트리 구조:**
```typescript
interface HistoryNode {
  id: string;           // "root" 또는 7자리 랜덤
  x: number | null;     // 착점 x (null = pass/root)
  y: number | null;
  color: PlayerColor | null;
  board: BoardState;    // 해당 수 직후의 바둑판 상태
  capturedByBlack: number;
  capturedByWhite: number;
  winRate: number;      // 흑 관점 승률 (0-100, 기본 50)
  children: HistoryNode[];
  parent: HistoryNode | null;
  moveIndex: number;
}
```

**주요 액션:**
- `placeStone(x, y)`: goLogic 검증 → 트리 노드 생성/탐색 → Immer produce
- `passTurn()`: 패스 노드 생성, 연속 2패스 시 게임 오버
- `resignGame()`: isGameOver + showDeadStones
- `undoMove()`: PvAI 전용, 2수 되돌리기, 대국당 1회
- `loadMatch(moves, winRates, ...)`: 저장된 기보 → 복기 모드 진입
- `updateWinRate(nodeId, winRate)` / `updateWinRates(batch)`: 분석 결과 반영
- `startReviewAnalysis()`: 모듈 레벨 함수, SSE 분석 시작 (abort 지원)

**Immer 통합 — 중요 패턴:**
```typescript
set(produce(draft => {
  const currentInTree = getNode(draft.gameTree, draft.currentNode.id)!;
  // ... 트리 수정 ...
  // ❗ 필수: produce 후 currentNode 재연결 (프록시 분리 방지)
  draft.currentNode = currentInTree.children[currentInTree.children.length - 1];
}));
```

**Persist 미들웨어:**
- 제외: gameTree, currentNode (순환참조), isAnalyzing, analysisProgress, reviewChat (임시)
- `flattenTree()` → board 제외한 FlatNode[] 직렬화 (~100x 크기 감소)
- `reconstructTree()` → 3단계 복원: 노드 생성 → 링크 연결 → 수 리플레이로 보드 재구축

### 5.3 온라인 스토어 (online/model/store.ts)

**상태:** roomId, roomToken, roomInfo, myRole, myNickname, myCharacter, connectionStatus, chatMessages, pendingUndoRequest, notification

**주요 액션:**
- `createRoom()` / `joinRoom()`: REST API → roomToken(JWT) 수신
- `connectWs()`: WebSocket 연결 + 메시지 핸들러 등록
- `sendMove()`, `sendPass()`, `sendResign()`, `sendChat()`, `requestUndo()`
- `handleWsMessage()`: 대형 switch문으로 메시지 처리 (room_state, move, game_over 등)
- `enterReviewMode()`: 온라인 대국 → 복기 모드 전환 (채팅 데이터 보존)
- `autoSaveAndReview()`: 게임 종료 시 자동 저장 + 복기 (sgfData에 채팅 포함)

**세션 복원:** sessionStorage에 온라인 상태 저장 → 페이지 새로고침 후 복원

### 5.4 바둑 로직 (goLogic.ts)

`applyMove(board, x, y, color, previousBoard?)` → `{newBoard, captured, isValid, reason?}`

1. 경계 검사 (x, y가 보드 범위 내)
2. 빈 자리 확인
3. 돌 놓기
4. BFS로 상대 그룹 활로 검사 → 활로 0이면 따냄 (captured 카운트)
5. 자충수 검사: 자기 그룹 활로 0이고 따낸 돌 0이면 무효 (reason: "Suicide")
6. 패 검사: `previousBoard`와 동일하면 무효 (reason: "Ko")

### 5.5 공유 유틸리티 (shared/lib/)

- **goUtils.ts**: `getPlayerForMove(moveIndex, handicap)` — 핸디캡 고려 턴 계산. `buildMoveHistory(path)` — 경로에서 수순 추출
- **formatUtils.ts**: 게임 결과 텍스트 로컬라이즈 ("Black +1.5" → 한국어)
- **sound.ts**: 오디오 풀 패턴으로 HTMLAudioElement 재사용. 7종 효과음
- **themeUtils.ts**: CSS 변수 설정 (--primary, --font-family, dark 클래스 토글)
- **router.ts**: 해시 기반 라우팅 (main, online-create, online-room/:id, online-farewell)
- **useRenderProfile.ts**: 개발용 성능 감시 (>16ms 렌더 경고). `import.meta.env.DEV`로 프로덕션 비활성화
- **errors/AppError.ts**: 커스텀 에러 클래스 (Error Masking). 5xx/알 수 없는 오류는 `createMaskedError`를 통해 마스킹 처리하여 UI에 직접 노출되는 것을 방지.

### 5.6 위젯 상세

**BoardWidget.tsx (features/board/ui 포함):**
- 모바일에서 사이드바가 접히더라도 AI가 정상 동작하도록 `useAITurn` 및 `useGameScoring` 훅을 Sidebar에서 분리하여 BoardWidget 레벨에 마운트함.

**BoardCore.tsx (features/board/ui):**
- SVG viewBox 기반 반응형. `useShallow`로 불필요한 리렌더 방지.
- useMemo: gridLines, starPoints, renderedStones.
- React Query: aiHint 패칭 (staleTime: Infinity).
- 인터랙션: 클릭 → CSS 스케일 보정 좌표 변환 → placeStone / sendMove(온라인).
- 표시 레이어: 격자 → 성점 → 변화도 마커(A,B,C) → AI 힌트(파란 펄스) → 무시된 추천(초록 점선) → 돌 → 사석 X 마크.

**SidebarWidget.tsx (widgets):**
- 탭: 대국 | 기록 | ⚙️ 관리.
- 기보 저장: useMutation → sgfData JSON.
- 승자 판별: winner 상태 → gameResultText 문자열 비교 → winRate 비교 (fallback).
- Lazy 로드: MatchHistory, AdminPanel.
- 성능 최적화: `useShallow`를 통해 관련 상태만 구독.

**OnlineSidebarWidget.tsx:**
- 플레이어 카드 (캐릭터 이모지 + 닉네임 + 색상 + 승패 뱃지).
- 채팅 섹션 (이모지 퀵 피커 18종 + 메시지 표시).
- 게임 컨트롤: 패스/기권/무르기 (사용 횟수 추적).
- 성능 최적화: `useShallow`를 통해 관련 상태만 구독.

**ReviewPanelWidget.tsx:**
- SVG 승률 그래프 (x: 수번호, y: 흑 승률 0-100%).
- 범위 슬라이더 + 이전/다음 버튼 + 키보드(←→).
- 분기점 칩: 수평 스크롤, 활성 칩 자동 스크롤.
- 사석 토글: 최종 수에서만 활성.

**TeacherAdviceWidget.tsx:**
- AI 추천 수 최대 3개 (GTP 표기 + 설명).
- 비판 흐름: 추천 수 캐시(ref, 50개 제한) → 사용자 이탈 감지 → critique 패칭.
- 성능 최적화: `useShallow`를 적용하여 불필요한 재렌더링 차단.

**MatchHistory.tsx:**
- 접근성(A11y): 시맨틱 마크업(`role="button"`, `tabIndex={0}`)과 키보드 네비게이션(`onKeyDown`) 완벽 지원.

---

## 6. 데이터 흐름

### 6.1 오프라인 PvAI 대국
```
User Click → BoardCore.handleBoardClick()
  → store.placeStone(x, y) [goLogic.applyMove 검증]
  → currentPlayer 전환
  → useAITurn hook 감지 (AI 턴)
    → setTimeout(1500ms) → fetchAIMove()
    → updateWinRate() → placeStone(aiX, aiY)
  → 연속 2패스 시 → useGameScoring → fetchAIScore
  → 승/패 사운드 재생
```

### 6.2 온라인 대국
```
Host: POST /online/rooms → roomId + JWT(host)
Guest: POST /online/rooms/:id/join → JWT(guest)
Both: WebSocket /ws/online → auth 메시지 → room_state 수신
  → 클릭 → sendMove(x,y) → 서버 검증 → 브로드캐스트
  → 양쪽 placeStone(x,y) 적용
  → 게임 종료 → autoSaveAndReview (sgfData에 채팅 포함)
```

### 6.3 선생님 모드
```
User Turn → React Query: fetchAIHint (isHintRequest: true)
  → BoardCore: 파란 펄스 원 (추천 수 3개)
  → TeacherAdviceWidget: 추천 수 캐시
  → User 착수 → 추천 수 비교
    → 이탈 시 → critique 패칭 + 무시된 추천 표시 (초록 점선)
```

### 6.4 복기 분석 (SSE)
```
기록 탭 → 기보 클릭 → loadMatch() → startReviewAnalysis()
  → analyzeGame() [POST /ai/analyze-game, SSE]
    → 서버: 수별 genmove → latestWinRate → SSE chunk 전송
    → 클라이언트: onProgress → store.updateWinRates() [100ms 스로틀]
  → ReviewPanelWidget 승률 그래프 실시간 갱신
```

---

## 7. 성능 및 보안 최적화 요약

- **성능 (Zustand Selectors)**: `useShallow`를 위젯(`BoardCore`, `TeacherAdviceWidget`, `SidebarWidget`, `OnlineSidebarWidget`)들에 널리 적용하여 AI 연산 및 트리 탐색 시 발생하는 무관한 UI 재렌더링을 원천 차단함.
- **보안 (Error Masking)**: API 호출 및 로그인 폼(`AuthPage`, `AdminPanel`, `CreateRoomForm`, `JoinRoomForm`) 등에서 발생하는 서버 에러와 스택 트레이스가 UI에 노출되지 않도록 `createMaskedError`를 통해 규격화된 메시지로 마스킹 처리함.
- **안정성 (Graceful Shutdown)**: Node.js 서버 재시작/종료 시 남겨진 `katago` 프로세스로 인한 자원 독점(Zombie 프로세스)을 막기 위해 시그널(`SIGINT`, `SIGTERM`) 리스너를 통한 안전 종료 로직 구현.
- **UI/UX 복원력**: 뷰포트 크기 변화로 사이드바가 숨겨지더라도 AI 로직이 중단되지 않도록 생명주기(Lifecycle) 훅을 `BoardWidget`으로 이관.
- **접근성(A11y)**: 마우스에 의존하던 목록 아이템들에 대한 키보드 네비게이션 및 ARIA 역할(`role="button"`) 추가.

---

## 8. 설정 파일

### .env
```
PORT=3330
VITE_PORT=5550
VITE_API_BASE_URL=http://localhost:3330/api
JWT_SECRET=change_me_in_production
```

### KataGo (gtp_config.cfg)
- `numSearchThreads = 6`
- `maxVisits = 100` (기본, API에서 동적 변경)
- `koRule = SIMPLE`, `scoringRule = TERRITORY`
- `resignThreshold = -0.90` (3턴 연속)
- `logToStderr = true` (승률 파싱 필수)
- `ponderingEnabled = true`

---

## 9. 테스트 현황

### Client (Vitest, 71 tests)
- 스토어 로직, 게임 트리 변환, 패 규칙/자충수, 무르기, 사운드 등 철저히 검증 완료.
### Server (Vitest, 34 tests)
- 좌표 변환 (GTP ↔ xy), 접바둑 룰, 전술 감지, 다국어 해설 매핑 테스트 완료.

---

## 10. 알려진 패턴 및 주의사항

1. **Express 5 SSE**: non-async handler + `res.on("close")` 필수 (req.on 아님)
2. **Immer + Zustand**: produce 후 currentNode 재연결 필수 (프록시 분리 방지)
3. **KataGo 승률 방향**: genmove 결과는 검색하는 쪽(SIDE TO MOVE) 관점. 흑 관점 변환 필요
4. **접바둑**: 첫 수가 WHITE (handicap > 0일 때). `getPlayerForMove(moveIndex, handicap)` 사용
5. **API 큐**: `apiRequestQueue`(API 레벨)와 `commandQueue`(GTP 레벨) 2단계 큐
6. **세션 복원**: 온라인 상태 → sessionStorage, 오프라인 게임 트리 → localStorage
7. **에러 핸들링**: 클라이언트 `catch` 블록에서는 `createMaskedError(e)`를 래핑하여 메시지 출력
8. **종료 훅**: 서버가 죽을 때 자식 `katago`도 명시적으로 kill하도록 처리.