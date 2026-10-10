# Implementation Plan: Flappy Kiro

## Overview

Build a self-contained browser-based Flappy Bird clone delivered as three static files (`index.html`, `style.css`, `game.js`). The implementation follows the finite-state-machine architecture defined in the design document, building incrementally from project scaffolding through to a full integration and property-based test suite.

## Tasks

- [x] 1. Project scaffolding and asset loading
  - [x] 1.1 Create `index.html` with a single `<canvas id="gameCanvas">` element, a `<script type="module" src="game.js">` tag, and a `<link>` to `style.css`
    - The page must require no server, build tool, or plugin to run
    - _Requirements: 1.1_
  - [x] 1.2 Create `style.css` that centres the canvas on a full-viewport background and removes default body margin/padding
    - _Requirements: 1.1_
  - [x] 1.3 Create `game.js` skeleton with named exports for all pure functions (so tests can import them) and a `typeof window !== 'undefined'` guard around `GameLoop` startup
    - Define and export empty stubs for `PhysicsEngine`, `ScoreManager`, `CanvasScaler`, `CollisionDetector`, `createGhost`, `createPipe`, `createCloud`, `createGameState`
    - _Requirements: 1.1_
  - [x] 1.4 Implement asset loading: fetch `assets/ghosty.png`, `assets/jump.wav`, `assets/game_over.wav` before the first frame; attach `onerror` handlers that set fallbacks (`ghost.sprite = null`, `AudioBuffer = null`) and log to console; start the game loop regardless of load success
    - _Requirements: 1.2, 1.3_

- [x] 2. CanvasScaler
  - [x] 2.1 Implement and export `CanvasScaler.resize(canvas, containerWidth)` — sets `canvas.width = min(containerWidth, 1280)`, `canvas.height = canvas.width * 0.75`, returns `{ scale, w, h }`; implement `CanvasScaler.toLogical(canvasCoord, scale)`
    - _Requirements: 1.5, 1.6_
  - [x] 2.2 Wire a `window.resize` listener that calls `CanvasScaler.resize` and recalculates all element positions and sizes; call it once on page load
    - _Requirements: 1.6_
  - [x]* 2.3 Write property test for canvas aspect ratio invariant
    - **Property 1: Canvas aspect ratio invariant**
    - **Validates: Requirements 1.5, 1.6**

- [x] 3. GameLoop
  - [x] 3.1 Implement `GameLoop` class with `start()`, `stop()`, and `_tick(timestampMs)` methods; drive the loop with `requestAnimationFrame`; compute `dtFactor = deltaMs / 16.667`; clamp `deltaMs` to 50 ms if it exceeds 200 ms to prevent physics tunnelling
    - _Requirements: 10.1, 10.2_

- [x] 4. PhysicsEngine pure functions
  - [x] 4.1 Implement and export all `PhysicsEngine` pure functions:
    - `applyGravity(ghost, dtFactor)` — adds `0.5 * dtFactor` to `ghost.vy`
    - `applyFlap(ghost)` — sets `ghost.vy = -8`
    - `clampVelocity(ghost)` — clamps `ghost.vy` to `(-Infinity, 12]`
    - `updatePosition(ghost, dtFactor)` — sets `ghost.y += ghost.vy * dtFactor`
    - `computeRotation(vy)` — maps `vy ∈ [-8, 12]` → angle `∈ [-25°, 90°]` in radians
    - `bobOffset(timeMs)` — returns `10 * sin(2π * t / 2000)` (amplitude 10, period 2000 ms)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.7, 2.6, 2.7_
  - [x]* 4.2 Write property test for ghost rotation after flap
    - **Property 2: Ghost rotation after flap is within bounds**
    - **Validates: Requirements 2.6**
  - [x]* 4.3 Write property test for ghost rotation while falling
    - **Property 3: Ghost rotation while falling never exceeds +90°**
    - **Validates: Requirements 2.7**
  - [x]* 4.4 Write property test for gravity with delta-time
    - **Property 4: Gravity accumulates correctly with delta-time**
    - **Validates: Requirements 3.1, 3.3**
  - [x]* 4.5 Write property test for flap setting vy to exactly −8
    - **Property 5: Flap always sets vy to exactly −8**
    - **Validates: Requirements 3.2**
  - [x]* 4.6 Write property test for position update scaling with delta-time
    - **Property 6: Position update scales linearly with delta-time**
    - **Validates: Requirements 3.5**
  - [x]* 4.7 Write property test for idle bob amplitude bounds
    - **Property 7: Ghost idle bob stays within amplitude bounds**
    - **Validates: Requirements 3.7**

- [x] 5. Ghost entity and idle animation
  - [x] 5.1 Implement `createGhost()` factory returning the ghost data model (`x: 80, y: 180, vy: 0, rotation: 0, width: 32, height: 32, sprite: null`)
    - _Requirements: 2.4_
  - [x] 5.2 Implement idle sinusoidal bob in `GameStateManager` tick for `Idle_State` using `PhysicsEngine.bobOffset(idleTimeMs)` applied as a render-only vertical offset; accumulate `idleTimeMs` each tick
    - _Requirements: 3.7_

- [x] 6. Renderer — background, clouds, and ghost
  - [x] 6.1 Implement `Renderer._drawBackground(ctx, canvas)` — light-blue filled rectangle covering full canvas with overlaid dark pencil-stroke lines for hand-drawn texture
    - _Requirements: 2.1_
  - [x] 6.2 Implement `Renderer._drawClouds(ctx, clouds)` — draw each cloud as an off-white, slightly rounded rectangle; clouds scroll at `speed: 0.5` px/tick (parallax); generate 3–6 clouds in the upper 60% of the canvas on init
    - _Requirements: 2.2_
  - [x] 6.3 Implement `Renderer._drawGhost(ctx, ghost, sprite)` — draw `ghosty.png` scaled to 32×32 logical px using `ctx.save/translate/rotate/drawImage/restore`; if `sprite` is null, draw a white filled circle of radius 16 px as fallback
    - Apply `ghost.rotation` for flap tilt (`-20° to -30°` after flap, up to `+90°` while falling)
    - _Requirements: 2.4, 2.6, 2.7_
  - [x] 6.4 Implement `Renderer.draw(gameState, canvas, ctx)` wiring the draw order: Background → Clouds → Pipes (stub for now) → Ghost → HUD (stub) → Overlay (stub)
    - _Requirements: 2.1–2.5_

- [x] 7. InputManager
  - [x] 7.1 Implement `InputManager` class with `attach()` / `detach()` methods; register `keydown` (Space → FLAP; P/Esc → PAUSE_TOGGLE), `click` (→ FLAP), and `touchstart` (→ FLAP, `e.preventDefault()`) listeners on the canvas
    - Implement `_shouldAllowFlap()` debounce: track `lastFlapTime`; reject FLAP if `now - lastFlapTime < 100`
    - Export `_shouldAllowFlap` for testing
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 11.1_
  - [x]* 7.2 Write property test for input debounce rejecting rapid flap inputs
    - **Property 22: Input debounce rejects rapid flap inputs**
    - **Validates: Requirements 9.4**

- [x] 8. GameStateManager and state machine
  - [x] 8.1 Implement `GameStateManager` class with `handleAction(action)` and `tick(deltaMs)` methods; implement `_transitionTo(newState)` with all enter/exit side-effects:
    - → `Idle_State`: reset score to 0, ghost to starting position, pipes to `[]`, `pipeSpeed` to 3
    - → `Playing_State` (from Idle): apply first flap impulse via `PhysicsEngine.applyFlap`
    - → `Game_Over_State`: freeze updates, play `game_over.wav`, call `ScoreManager.onGameOver`
    - → `Paused_State`: freeze physics and pipe scrolling; do not alter score or positions
    - _Requirements: 3.6, 7.6, 11.1, 11.3, 11.5_
  - [x] 8.2 Implement `tick(deltaMs)` routing: in `Playing_State`, apply gravity, clamp velocity, update position, compute rotation via `PhysicsEngine`; in `Idle_State`, advance `idleTimeMs`; in `Paused_State`, skip all updates; ignore FLAP actions in `Paused_State`
    - _Requirements: 3.1–3.5, 11.4_
  - [x]* 8.3 Write property test for restart producing clean Idle_State
    - **Property 19: Restart produces a clean Idle_State regardless of prior game state**
    - **Validates: Requirements 7.6**
  - [x]* 8.4 Write property test for pause/resume state round-trip
    - **Property 20: Pause/resume is a state round-trip that preserves all positions**
    - **Validates: Requirements 11.3, 11.5**
  - [x]* 8.5 Write property test for flap ignored while paused
    - **Property 21: Flap inputs are ignored while paused**
    - **Validates: Requirements 11.4**

- [x] 9. Checkpoint — core game loop running
  - Ensure the game opens in Menu_State, the ghost renders on canvas with idle bobbing in Idle_State, and all state transitions (Menu → Idle → Playing → Paused → Playing) work via keyboard/click/touch. Ask the user if questions arise.

- [x] 10. Pipe entity and PipeManager
  - [x] 10.1 Implement `createPipe(x, gapCentreY, canvasH)` factory with `bodyWidth: 52`, `capWidth: 64`, `capHeight: 16`, `gapHeight: 150`, `scored: false`; implement `Renderer._drawPipes(ctx, pipes, canvas)` drawing dark-green body and lighter-green cap (cap 10–20% wider each side)
    - _Requirements: 2.3, 4.1_
  - [x]* 10.2 Write property test for pipe dimensions
    - **Property 8: Pipe dimensions are always exact**
    - **Validates: Requirements 4.1, 4.5**
  - [x] 10.3 Implement pipe generation in `GameStateManager` tick: spawn a new pipe pair when horizontal distance between leading edges of consecutive pipes reaches 220 px; randomise `gapCentreY ∈ [150, canvasH − 150]`; cap active pipe list at 6; remove pipes when right edge reaches x = −64
    - _Requirements: 4.3, 4.4, 4.7, 4.8_
  - [x]* 10.4 Write property test for gap centre within safe bounds
    - **Property 9: Gap centre is always within safe bounds**
    - **Validates: Requirements 4.4**
  - [x]* 10.5 Write property test for active pipe count never exceeding 6
    - **Property 10: Active pipe count never exceeds 6**
    - **Validates: Requirements 4.8**
  - [x] 10.6 Implement pipe scrolling at `pipeSpeed` px/tick (delta-time scaled); implement `PipeManager.computeSpeed(pipesPassed)` — returns `min(3 + floor(pipesPassed / 5) * 0.3, 6)`; trigger speed increase in `GameStateManager` when a multiple-of-5 pipe is passed
    - _Requirements: 4.2, 4.6_
  - [x]* 10.7 Write property test for pipe scroll speed increases
    - **Property 11: Pipe scroll speed increases at multiples of 5 and is capped at 6**
    - **Validates: Requirements 4.6**

- [x] 11. Collision detection
  - [x] 11.1 Implement and export `CollisionDetector.getHitbox(ghost)` — returns `{ x: ghost.x+4, y: ghost.y+4, w: ghost.width-8, h: ghost.height-8 }`; implement `CollisionDetector.checkPipes(ghost, pipes)` — AABB overlap between hitbox and each pipe body and cap; implement `CollisionDetector.checkBoundary(ghost, hudTop)` — returns true if `ghost.y < 0` or `ghost.y + ghost.height >= hudTop`
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 11.2 Wire collision checks into `GameStateManager.tick` during `Playing_State`; on positive result call `_transitionTo('Game_Over_State')`
    - _Requirements: 5.1, 5.2, 5.3_
  - [x]* 11.3 Write property test for 4 px inward hitbox margin
    - **Property 12: Collision detection uses 4 px inward hitbox margin**
    - **Validates: Requirements 5.4, 5.1**
  - [x]* 11.4 Write property test for boundary collision at correct edges
    - **Property 13: Boundary collision detected at correct edges**
    - **Validates: Requirements 5.2, 5.3**

- [x] 12. ScoreManager
  - [x] 12.1 Implement and export `ScoreManager.checkScoring(ghost, pipes, state)` — increments `state.score` by 1 when `ghost.cx >= pipe.cx` and `pipe.scored === false`; sets `pipe.scored = true` to prevent double-counting; call this in `GameStateManager.tick` during `Playing_State`
    - _Requirements: 6.1, 6.2_
  - [x]* 12.2 Write property test for score incrementing exactly once per pipe crossing
    - **Property 14: Score increments exactly once per pipe crossing**
    - **Validates: Requirements 6.1**
  - [x] 12.3 Implement `ScoreManager.onGameOver(state)` — sets `state.highScore = max(state.score, state.highScore)` and calls `saveHighScore`; implement `ScoreManager.saveHighScore(value)` and `ScoreManager.loadHighScore()` wrapping all `localStorage` calls in `try/catch` with in-memory fallback; use key `flappyKiroHighScore`; call `loadHighScore` at game init to seed `gameState.highScore`
    - _Requirements: 6.3, 6.4, 6.5_
  - [x]* 12.4 Write property test for high score always being max(S, H)
    - **Property 15: High score is always the maximum of all session scores**
    - **Validates: Requirements 6.3, 6.4**
  - [x]* 12.5 Write property test for high score localStorage round-trip
    - **Property 16: High score round-trip through localStorage**
    - **Validates: Requirements 6.5**

- [x] 13. AudioManager
  - [x] 13.1 Implement `AudioManager` class with `async init()` (creates `AudioContext`, decodes `jump.wav` and `game_over.wav` into `AudioBuffer`), `resumeIfSuspended()`, `playJump()`, and `playGameOver()`; replay sounds via `AudioBufferSourceNode`; no-op silently if buffer is null (asset load failure fallback)
    - _Requirements: 8.1, 8.3, 1.3_
  - [x] 13.2 Call `AudioManager.resumeIfSuspended()` on the first FLAP, PAUSE_TOGGLE, or RESTART action in `GameStateManager.handleAction`; pass a `shouldPlaySound` flag from `GameStateManager` to `playJump()` — skip playback if `ghost.vy === -8` before the flap is applied
    - _Requirements: 8.1, 8.2, 8.3_

- [x] 14. Renderer overlays and HUD
  - [x] 14.1 Implement `Renderer._drawHUD(ctx, score, highScore, canvas)` — semi-transparent bar (opacity 40–70%) at canvas bottom; white horizontally-centred text `Score: {Score} | High: {High_Score}`
    - _Requirements: 2.5_
  - [x] 14.2 Implement `Renderer._drawMenuOverlay(ctx, highScore, canvas)` — display title "Flappy Kiro", current High_Score, and "Press Space / Tap to Start" prompt; shown in `Menu_State`
    - _Requirements: 1.4_
  - [x] 14.3 Implement `Renderer._drawPausedOverlay(ctx, canvas)` — semi-transparent overlay with "Paused" heading and "Press P / Esc to Resume" instruction; shown in `Paused_State`
    - _Requirements: 11.2_
  - [x] 14.4 Implement `Renderer._drawGameOverOverlay(ctx, score, highScore, isNewBest, canvas)` — "Game Over" heading, final Score, current High_Score, "New Best!" indicator when `score > highScore` (determined before updating), and "Press Space / Tap to Restart" instruction; export a string-output mode for testing
    - _Requirements: 7.1, 7.3, 7.4, 7.5_
  - [x]* 14.5 Write property test for game-over overlay always containing both scores
    - **Property 17: Game over overlay always contains score and high score**
    - **Validates: Requirements 7.3**
  - [x]* 14.6 Write property test for "New Best!" shown if and only if score exceeds previous high score
    - **Property 18: "New Best!" shown if and only if score exceeds previous high score**
    - **Validates: Requirements 7.4**

- [x] 15. Full integration and wiring
  - [x] 15.1 Instantiate all managers (`InputManager`, `PhysicsEngine`, `ScoreManager`, `AudioManager`, `CanvasScaler`) and pass them into `GameStateManager`; wire `GameStateManager` and `Renderer` into `GameLoop._tick`; attach `InputManager` to canvas; call `ScoreManager.loadHighScore()` to seed initial state
    - _Requirements: 1.2, 6.5_
  - [x] 15.2 Verify the complete state machine end-to-end: Menu_State on load → Idle_State on first input → Playing_State on first flap → Game_Over_State on collision → Idle_State on restart → Paused_State on P/Esc → back to Playing_State
    - Write automated integration tests covering each transition using `GameStateManager.handleAction` and `tick`
    - _Requirements: 1.4, 3.6, 7.6, 11.1, 11.3_

- [x] 16. Checkpoint — full game playable
  - Confirm the complete game runs in the browser: Menu appears on load, gameplay works with keyboard/click/touch, scoring and high-score persistence work, pause/resume works, game-over screen shows correct scores. Ask the user if questions arise.

- [x] 17. Property-based test suite (fast-check)
  - [x] 17.1 Set up the test environment: create `test/` directory, install `fast-check` via npm for Node.js test running; create `test/game.test.js` importing named exports from `game.js`; each test file tags properties with `// Feature: flappy-kiro, Property N: <title>`; configure minimum 100 iterations per property
    - _Requirements: design Testing Strategy section_
  - [x]* 17.2 Verify all 22 property tests (Properties 1–22) pass with fast-check at 100+ iterations each — these are the optional sub-tasks already written in tasks 2.3, 4.2–4.7, 7.2, 8.3–8.5, 10.2, 10.4, 10.5, 10.7, 11.3, 11.4, 12.2, 12.4, 12.5, 14.5, 14.6
    - Run `node --experimental-vm-modules node_modules/.bin/jest test/` or equivalent
    - _Requirements: design Correctness Properties 1–22_

- [x] 18. Example-based unit tests
  - [x] 18.1 Write unit tests covering the remaining example-classified acceptance criteria:
    - Asset fallback sets `ghost.sprite = null` and continues game loop (Req 1.3)
    - Initial `gameState.current === 'Menu_State'` after init (Req 1.4)
    - First flap in `Idle_State` transitions to `Playing_State` with `ghost.vy === -8` (Req 3.6)
    - `game_over.wav` plays exactly once on transition to `Game_Over_State` (Req 7.2)
    - Restart instruction text visible in game-over overlay (Req 7.5)
    - Paused overlay contains "Paused" text (Req 11.2)
    - P key in `Playing_State` transitions to `Paused_State` (Req 11.1)
    - Space `keydown` triggers FLAP action (Req 9.1)
    - Canvas `click` triggers FLAP action (Req 9.2)
    - `touchstart` triggers FLAP and calls `e.preventDefault()` (Req 9.3)
    - `AudioContext.resume()` called when context is suspended on first interaction (Req 8.3)
    - Jump sound plays on flap while in `Playing_State` (Req 8.1)
    - Jump sound does NOT play when `vy` is already −8 before flap (Req 8.2)
    - _Requirements: 1.3, 1.4, 3.6, 7.2, 7.5, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 11.1, 11.2_

- [x] 19. Final checkpoint — all tests pass
  - Ensure all property-based and unit tests pass. Verify the game runs correctly in the browser at 320 px, 768 px, and 1280 px viewport widths. Ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP; they are property-based or unit tests
- Each task references specific requirements for full traceability
- Checkpoints (tasks 9, 16, 19) ensure incremental validation at meaningful milestones
- The 22 correctness properties in the design document each map to a dedicated property-based test sub-task
- Unit tests in task 18 cover the remaining acceptance criteria not covered by PBT
- Pure functions (`PhysicsEngine`, `ScoreManager`, `CanvasScaler`, `CollisionDetector`) are exported from `game.js` and imported directly by tests; `GameLoop` startup is guarded by `typeof window !== 'undefined'`
- All `localStorage` calls are wrapped in `try/catch` to handle private-mode or storage-full scenarios
- `AudioContext` suspension is handled by calling `resumeIfSuspended()` on the first user gesture

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3"] },
    { "id": 1, "tasks": ["1.4", "2.1"] },
    { "id": 2, "tasks": ["2.2", "2.3", "3.1"] },
    { "id": 3, "tasks": ["4.1", "5.1"] },
    { "id": 4, "tasks": ["4.2", "4.3", "4.4", "4.5", "4.6", "4.7", "5.2", "7.1"] },
    { "id": 5, "tasks": ["6.1", "6.2", "6.3", "7.2"] },
    { "id": 6, "tasks": ["6.4", "8.1"] },
    { "id": 7, "tasks": ["8.2"] },
    { "id": 8, "tasks": ["8.3", "8.4", "8.5", "10.1"] },
    { "id": 9, "tasks": ["10.2", "10.3"] },
    { "id": 10, "tasks": ["10.4", "10.5", "10.6"] },
    { "id": 11, "tasks": ["10.7", "11.1"] },
    { "id": 12, "tasks": ["11.2", "12.1"] },
    { "id": 13, "tasks": ["11.3", "11.4", "12.2", "12.3", "13.1"] },
    { "id": 14, "tasks": ["12.4", "12.5", "13.2", "14.1", "14.2", "14.3", "14.4"] },
    { "id": 15, "tasks": ["14.5", "14.6", "15.1"] },
    { "id": 16, "tasks": ["15.2"] },
    { "id": 17, "tasks": ["17.1"] },
    { "id": 18, "tasks": ["17.2", "18.1"] }
  ]
}
```
