// Feature: flappy-kiro, ScoreManager high-score property-based tests
// Properties 15, 16
// Validates: Requirements 6.3, 6.4, 6.5

import * as fc from 'fast-check';
import { ScoreManager } from '../game.js';

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
// Property 15: High score is always the maximum of all session scores
// Feature: flappy-kiro, Property 15: High score is always the maximum of all session scores
// Validates: Requirements 6.3, 6.4
// ---------------------------------------------------------------------------
describe('Property 15: High score is always the maximum of all session scores', () => {
  beforeEach(() => {
    globalThis.localStorage = createMockLocalStorage();
    ScoreManager._inMemoryHighScore = 0;
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  test('after onGameOver, state.highScore === max(score, highScore)', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        (score, highScore) => {
          const state = { score, highScore };
          ScoreManager.onGameOver(state);
          expect(state.highScore).toBe(Math.max(score, highScore));
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 16: High score round-trip through localStorage
// Feature: flappy-kiro, Property 16: High score round-trip through localStorage
// Validates: Requirements 6.5
// ---------------------------------------------------------------------------
describe('Property 16: High score round-trip through localStorage', () => {
  beforeEach(() => {
    globalThis.localStorage = createMockLocalStorage();
    ScoreManager._inMemoryHighScore = 0;
  });

  afterEach(() => {
    delete globalThis.localStorage;
  });

  test('saveHighScore(V) then loadHighScore() returns V', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        (value) => {
          ScoreManager.saveHighScore(value);
          expect(ScoreManager.loadHighScore()).toBe(value);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('loadHighScore returns 0 when nothing is stored', () => {
    globalThis.localStorage = createMockLocalStorage();
    ScoreManager._inMemoryHighScore = 0;
    expect(ScoreManager.loadHighScore()).toBe(0);
  });
});
