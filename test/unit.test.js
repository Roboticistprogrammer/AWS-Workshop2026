// Feature: flappy-kiro — example-based unit tests (task 18.1)
// Covers the remaining EXAMPLE-classified acceptance criteria that are not
// covered by the property-based test suite.
//
// Validates: Requirements 1.4, 3.6, 7.2, 7.5, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3,
//            11.1, 11.2

import {
  GameStateManager,
  createGameState,
  createGhost,
  PhysicsEngine,
  ScoreManager,
  InputManager,
  Renderer,
} from '../game.js';

// ---------------------------------------------------------------------------
// In-memory localStorage mock — Node.js has no localStorage, so we install a
// minimal getItem/setItem implementation on globalThis before each test.
// ---------------------------------------------------------------------------
function createMockLocalStorage() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

// ---------------------------------------------------------------------------
// Mock collaborators
// ---------------------------------------------------------------------------

/** No-op audio manager — used where sound side effects are irrelevant. */
const noopAudio = {
  resumeIfSuspended() {},
  playJump() {},
  playGameOver() {},
};

/** No-op score manager — used where scoring/persistence is irrelevant. */
const noopScore = {
  checkScoring: (_ghost, pipes, _state) => pipes,
  onGameOver: (_state) => {},
  loadHighScore: () => 0,
  saveHighScore: (_value) => {},
};

/**
 * Builds a counter-based mock audio manager so tests can assert how many times
 * each sound was requested, plus how many times the AudioContext resume was
 * attempted.
 */
function createCountingAudio() {
  return {
    jumpCalls: 0,
    gameOverCalls: 0,
    resumeCalls: 0,
    resumeIfSuspended() {
      this.resumeCalls++;
    },
    playJump() {
      this.jumpCalls++;
    },
    playGameOver() {
      this.gameOverCalls++;
    },
  };
}

/** Minimal mock canvas — InputManager only touches add/removeEventListener. */
const mockCanvas = {
  addEventListener() {},
  removeEventListener() {},
};

beforeEach(() => {
  globalThis.localStorage = createMockLocalStorage();
  ScoreManager._inMemoryHighScore = 0;
});

afterEach(() => {
  delete globalThis.localStorage;
});

// ---------------------------------------------------------------------------
// Req 1.4 — Game initialises in Menu_State
// ---------------------------------------------------------------------------
describe('Req 1.4 — initial state is Menu_State', () => {
  test('createGameState().current === "Menu_State"', () => {
    const state = createGameState();
    expect(state.current).toBe('Menu_State');
  });
});

// ---------------------------------------------------------------------------
// Req 3.6 — First flap in Idle_State transitions to Playing_State with vy = -8
// ---------------------------------------------------------------------------
describe('Req 3.6 — first flap in Idle_State starts play with vy = -8', () => {
  test('FLAP in Idle_State → Playing_State and ghost.vy === -8', () => {
    const state = createGameState();
    const gsm = new GameStateManager(state, PhysicsEngine, noopScore, noopAudio);

    state.current = 'Idle_State';
    gsm.handleAction('FLAP');

    expect(state.current).toBe('Playing_State');
    expect(state.ghost.vy).toBe(-8);
  });
});

// ---------------------------------------------------------------------------
// Req 7.2 — game_over.wav plays exactly once on transition to Game_Over_State
// ---------------------------------------------------------------------------
describe('Req 7.2 — game-over sound plays exactly once', () => {
  test('a collision while Playing_State plays playGameOver once', () => {
    const audio = createCountingAudio();
    const state = createGameState();
    const gsm = new GameStateManager(state, PhysicsEngine, noopScore, audio);

    // Enter Playing_State and force a collision by dropping the ghost far below
    // the floor so checkBoundary returns true on the next tick.
    state.current = 'Playing_State';
    state.ghost = createGhost();
    state.ghost.y = 10000;

    gsm.tick(16);

    expect(state.current).toBe('Game_Over_State');
    expect(audio.gameOverCalls).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// Req 7.5 — Restart instruction visible in the game-over overlay
// ---------------------------------------------------------------------------
describe('Req 7.5 — game-over overlay shows restart instruction', () => {
  test('_drawGameOverOverlay text contains "Press Space / Tap to Restart"', () => {
    const text = Renderer._drawGameOverOverlay(null, 5, 10, false, null);
    expect(text).toContain('Press Space / Tap to Restart');
  });
});

// ---------------------------------------------------------------------------
// Req 11.2 — Paused overlay / pause state
// The literal "Paused" text drawing is covered by the renderer; here we assert
// the Playing_State → Paused_State transition that drives that overlay.
// ---------------------------------------------------------------------------
describe('Req 11.2 — pause state (overlay driver)', () => {
  test('PAUSE_TOGGLE in Playing_State → Paused_State', () => {
    const state = createGameState();
    const gsm = new GameStateManager(state, PhysicsEngine, noopScore, noopAudio);

    state.current = 'Playing_State';
    gsm.handleAction('PAUSE_TOGGLE');

    expect(state.current).toBe('Paused_State');
  });
});

// ---------------------------------------------------------------------------
// Req 11.1 — P key in Playing_State transitions to Paused_State
// ---------------------------------------------------------------------------
describe('Req 11.1 — P key pauses an active game', () => {
  test('KeyP keydown produces a PAUSE_TOGGLE action', () => {
    let captured = null;
    const im = new InputManager(mockCanvas, (action) => {
      captured = action;
    });

    im._onKeyDown({ code: 'KeyP' });

    expect(captured).toBe('PAUSE_TOGGLE');
  });

  test('feeding PAUSE_TOGGLE to a Playing_State GSM yields Paused_State', () => {
    const state = createGameState();
    const gsm = new GameStateManager(state, PhysicsEngine, noopScore, noopAudio);
    state.current = 'Playing_State';

    gsm.handleAction('PAUSE_TOGGLE');

    expect(state.current).toBe('Paused_State');
  });
});

// ---------------------------------------------------------------------------
// Req 9.1 — Space keydown triggers FLAP
// ---------------------------------------------------------------------------
describe('Req 9.1 — Space keydown triggers FLAP', () => {
  test('Space keydown produces a FLAP action', () => {
    let captured = null;
    const im = new InputManager(mockCanvas, (action) => {
      captured = action;
    });
    // Guarantee the debounce window has elapsed.
    im._lastFlapTime = -100000;

    im._onKeyDown({ code: 'Space', preventDefault() {} });

    expect(captured).toBe('FLAP');
  });
});

// ---------------------------------------------------------------------------
// Req 9.2 — Canvas click triggers FLAP
// ---------------------------------------------------------------------------
describe('Req 9.2 — canvas click triggers FLAP', () => {
  test('click produces a FLAP action', () => {
    let captured = null;
    const im = new InputManager(mockCanvas, (action) => {
      captured = action;
    });
    // Guarantee the debounce window has elapsed.
    im._lastFlapTime = -100000;

    im._onClick();

    expect(captured).toBe('FLAP');
  });
});

// ---------------------------------------------------------------------------
// Req 9.3 — touchstart triggers FLAP and calls preventDefault
// ---------------------------------------------------------------------------
describe('Req 9.3 — touchstart triggers FLAP and prevents default', () => {
  test('touchstart produces FLAP and invokes preventDefault', () => {
    let captured = null;
    const im = new InputManager(mockCanvas, (action) => {
      captured = action;
    });
    im._lastFlapTime = -100000;

    let preventDefaultCalled = false;
    const evt = {
      preventDefault() {
        preventDefaultCalled = true;
      },
    };

    im._onTouchStart(evt);

    expect(preventDefaultCalled).toBe(true);
    expect(captured).toBe('FLAP');
  });
});

// ---------------------------------------------------------------------------
// Req 8.1 / 8.2 — Jump sound logic in Playing_State
// ---------------------------------------------------------------------------
describe('Req 8.1 / 8.2 — jump sound plays only when not already at the flap ceiling', () => {
  test('Req 8.1 — FLAP in Playing_State with vy !== -8 plays jump once', () => {
    const audio = createCountingAudio();
    const state = createGameState();
    const gsm = new GameStateManager(state, PhysicsEngine, noopScore, audio);

    state.current = 'Playing_State';
    state.ghost = createGhost(); // vy starts at 0
    state.ghost.vy = 0;

    gsm.handleAction('FLAP');

    expect(audio.jumpCalls).toBe(1);
    expect(state.ghost.vy).toBe(-8);
  });

  test('Req 8.2 — FLAP in Playing_State with vy already -8 does NOT play jump', () => {
    const audio = createCountingAudio();
    const state = createGameState();
    const gsm = new GameStateManager(state, PhysicsEngine, noopScore, audio);

    state.current = 'Playing_State';
    state.ghost = createGhost();
    state.ghost.vy = -8; // already at the flap ceiling

    const before = audio.jumpCalls;
    gsm.handleAction('FLAP');

    expect(audio.jumpCalls).toBe(before); // unchanged — no sound played
  });
});

// ---------------------------------------------------------------------------
// Req 8.3 — AudioContext resume on first interaction
// ---------------------------------------------------------------------------
describe('Req 8.3 — AudioContext resume requested on first interaction', () => {
  test('FLAP in Menu_State calls resumeIfSuspended', () => {
    const audio = createCountingAudio();
    const state = createGameState();
    const gsm = new GameStateManager(state, PhysicsEngine, noopScore, audio);

    // Menu_State is the initial state after createGameState().
    expect(state.current).toBe('Menu_State');

    gsm.handleAction('FLAP');

    expect(audio.resumeCalls).toBeGreaterThanOrEqual(1);
  });
});
