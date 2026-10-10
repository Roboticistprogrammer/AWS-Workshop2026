// Feature: flappy-kiro — end-to-end state-machine integration tests (task 15.2)
// Validates: Requirements 1.4, 3.6, 7.6, 11.1, 11.3
//
// These example-based tests drive a real GameStateManager through its full
// lifecycle using handleAction and tick. Audio is mocked with no-ops; the real
// ScoreManager is used against an in-memory localStorage mock so that
// onGameOver persistence does not throw in the Node test environment.

import {
  GameStateManager,
  createGameState,
  PhysicsEngine,
  ScoreManager,
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

// Mock AudioManager — no-ops for all calls.
const mockAudio = {
  resumeIfSuspended() {},
  playJump() {},
  playGameOver() {},
};

/** Helper: build a GameStateManager backed by a fresh GameState. */
const makeGSM = () => {
  const state = createGameState();
  const gsm = new GameStateManager(state, PhysicsEngine, ScoreManager, mockAudio);
  return { gsm, state };
};

describe('GameStateManager end-to-end integration', () => {
  beforeEach(() => {
    globalThis.localStorage = createMockLocalStorage();
    ScoreManager._inMemoryHighScore = 0;
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  // 1 ------------------------------------------------------------------------
  test('initial state is Menu_State', () => {
    const state = createGameState();
    expect(state.current).toBe('Menu_State');
  });

  // 2 ------------------------------------------------------------------------
  test('Menu_State transitions to Playing_State on first flap, applying impulse', () => {
    const { gsm, state } = makeGSM();

    gsm.handleAction('FLAP');

    expect(state.current).toBe('Playing_State');
    expect(state.ghost.vy).toBe(-8);
  });

  // 3 ------------------------------------------------------------------------
  test('Idle_State transitions to Playing_State on flap, applying impulse', () => {
    const { gsm, state } = makeGSM();
    state.current = 'Idle_State';

    gsm.handleAction('FLAP');

    expect(state.current).toBe('Playing_State');
    expect(state.ghost.vy).toBe(-8);
  });

  // 4 ------------------------------------------------------------------------
  test('Playing_State transitions to Game_Over_State on collision', () => {
    const { gsm, state } = makeGSM();
    state.current = 'Playing_State';
    // Force the ghost well below the floor so the boundary check trips.
    state.ghost.y = 10000;

    gsm.tick(16);

    expect(state.current).toBe('Game_Over_State');
  });

  // 5 ------------------------------------------------------------------------
  test('Game_Over_State transitions to a clean Idle_State on restart', () => {
    const { gsm, state } = makeGSM();
    state.current = 'Game_Over_State';
    state.score = 5;
    state.pipes = [
      { x: 200, gapCentreY: 180, scored: false },
      { x: 400, gapCentreY: 200, scored: true },
    ];
    state.pipeSpeed = 5.1;
    state.ghost.y = 999;
    state.ghost.vy = 7;

    gsm.handleAction('RESTART');

    expect(state.current).toBe('Idle_State');
    expect(state.score).toBe(0);
    expect(state.pipes.length).toBe(0);
    expect(state.ghost.y).toBe(180);
    expect(state.ghost.vy).toBe(0);
    expect(state.pipeSpeed).toBe(3);
  });

  // 6 ------------------------------------------------------------------------
  test('Playing → Paused → Playing round-trip preserves ghost and score', () => {
    const { gsm, state } = makeGSM();
    state.current = 'Playing_State';
    state.ghost.y = 100;
    state.ghost.vy = 3;
    state.score = 4;

    gsm.handleAction('PAUSE_TOGGLE');
    expect(state.current).toBe('Paused_State');

    gsm.handleAction('PAUSE_TOGGLE');
    expect(state.current).toBe('Playing_State');

    expect(state.ghost.y).toBe(100);
    expect(state.ghost.vy).toBe(3);
    expect(state.score).toBe(4);
  });

  // 7 ------------------------------------------------------------------------
  test('full lifecycle sweep passes through every state', () => {
    const { gsm, state } = makeGSM();

    // Menu
    expect(state.current).toBe('Menu_State');

    // Menu → Playing (first flap)
    gsm.handleAction('FLAP');
    expect(state.current).toBe('Playing_State');

    // Playing → Paused
    gsm.handleAction('PAUSE_TOGGLE');
    expect(state.current).toBe('Paused_State');

    // Paused → Playing (resume)
    gsm.handleAction('PAUSE_TOGGLE');
    expect(state.current).toBe('Playing_State');

    // Playing → Game_Over (force collision then tick)
    state.ghost.y = 10000;
    gsm.tick(16);
    expect(state.current).toBe('Game_Over_State');

    // Game_Over → Idle (restart)
    gsm.handleAction('RESTART');
    expect(state.current).toBe('Idle_State');

    // Idle → Playing (flap)
    gsm.handleAction('FLAP');
    expect(state.current).toBe('Playing_State');
  });

  // 8 ------------------------------------------------------------------------
  test('high score persists across game over', () => {
    const { gsm, state } = makeGSM();
    state.current = 'Playing_State';
    state.score = 7;
    state.highScore = 3;

    // Force collision and tick to trigger the Game_Over transition.
    state.ghost.y = 10000;
    gsm.tick(16);

    expect(state.current).toBe('Game_Over_State');
    expect(state.highScore).toBe(7);
  });
});
