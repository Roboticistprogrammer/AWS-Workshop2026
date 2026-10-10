// Feature: flappy-kiro — Pipe property-based tests
// Properties 8, 9, 10
// Validates: Requirements 4.1, 4.4, 4.5, 4.8

import * as fc from 'fast-check';
import {
  createPipe,
  generatePipe,
  createGameState,
  GameStateManager,
  PhysicsEngine,
  PipeManager,
} from '../game.js';

// ---------------------------------------------------------------------------
// Minimal mock collaborators (no game logic in mocks)
// ---------------------------------------------------------------------------

/** Mock AudioManager — no-ops for all calls. */
const mockAudio = {
  resumeIfSuspended: () => {},
  playJump: () => {},
  playGameOver: () => {},
};

/** Mock ScoreManager — no-ops; does not alter state. */
const mockScore = {
  checkScoring: (ghost, pipes, _state) => pipes,
  onGameOver: (_state) => {},
  loadHighScore: () => 0,
  saveHighScore: (_value) => {},
};

// ---------------------------------------------------------------------------
// Property 8: Pipe dimensions are always exact
// Feature: flappy-kiro, Property 8: Pipe dimensions are always exact
// Validates: Requirements 4.1, 4.5
// ---------------------------------------------------------------------------
describe('Property 8: Pipe dimensions are always exact', () => {
  test('createPipe always returns bodyWidth=52, capWidth=64, capHeight=16, gapHeight=150', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000, max: 2000, noNaN: true }), // x
        fc.double({ min: 0, max: 1000, noNaN: true }),      // gapCentreY
        fc.double({ min: 200, max: 2000, noNaN: true }),    // canvasH
        (x, gapCentreY, canvasH) => {
          const pipe = createPipe(x, gapCentreY, canvasH);
          expect(pipe.bodyWidth).toBe(52);
          expect(pipe.capWidth).toBe(64);
          expect(pipe.capHeight).toBe(16);
          expect(pipe.gapHeight).toBe(150);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 9: Gap centre is always within safe bounds
// Feature: flappy-kiro, Property 9: Gap centre is always within safe bounds
// Validates: Requirements 4.4
// ---------------------------------------------------------------------------
describe('Property 9: Gap centre is always within safe bounds', () => {
  test('generatePipe places gapCentreY within [150, canvasLogicalH - 150]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 320, max: 960, noNaN: true }),       // canvasLogicalH
        fc.double({ min: 0, max: 1, maxExcluded: true, noNaN: true }), // random value r in [0, 1)
        (canvasLogicalH, r) => {
          const pipe = generatePipe(canvasLogicalH, () => r);
          expect(pipe.gapCentreY).toBeGreaterThanOrEqual(150);
          expect(pipe.gapCentreY).toBeLessThanOrEqual(canvasLogicalH - 150);
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 10: Active pipe count never exceeds 6
// Feature: flappy-kiro, Property 10: Active pipe count never exceeds 6
// Validates: Requirements 4.8
// ---------------------------------------------------------------------------
describe('Property 10: Active pipe count never exceeds 6', () => {
  test('running tick() many times in Playing_State keeps pipes.length <= 6', () => {
    const state = createGameState();
    state.current = 'Playing_State';
    const gsm = new GameStateManager(state, PhysicsEngine, mockScore, mockAudio);

    for (let i = 0; i < 1000; i++) {
      gsm.tick(16);
      expect(state.pipes.length).toBeLessThanOrEqual(6);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 11: Pipe scroll speed increases at multiples of 5 and is capped at 6
// Feature: flappy-kiro, Property 11: Pipe scroll speed increases at multiples of 5 and is capped at 6
// Validates: Requirements 4.6
// ---------------------------------------------------------------------------
describe('Property 11: Pipe scroll speed increases at multiples of 5 and is capped at 6', () => {
  test('computeSpeed(N) === min(3 + floor(N/5) * 0.3, 6) for N in [0, 100]', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        (pipesPassed) => {
          const expected = Math.min(3 + Math.floor(pipesPassed / 5) * 0.3, 6);
          expect(PipeManager.computeSpeed(pipesPassed)).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('specific reference cases', () => {
    expect(PipeManager.computeSpeed(0)).toBeCloseTo(3, 10);
    expect(PipeManager.computeSpeed(4)).toBeCloseTo(3, 10);
    expect(PipeManager.computeSpeed(5)).toBeCloseTo(3.3, 10);
    expect(PipeManager.computeSpeed(50)).toBeCloseTo(6, 10); // capped
    expect(PipeManager.computeSpeed(100)).toBeCloseTo(6, 10); // capped
  });

  test('speed is monotonic non-decreasing and never exceeds 6', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100 }),
        fc.integer({ min: 0, max: 100 }),
        (a, b) => {
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const speedLo = PipeManager.computeSpeed(lo);
          const speedHi = PipeManager.computeSpeed(hi);
          // Monotonic non-decreasing: more pipes passed => speed never drops
          expect(speedHi).toBeGreaterThanOrEqual(speedLo);
          // Cap: never exceeds 6
          expect(speedHi).toBeLessThanOrEqual(6);
          expect(speedLo).toBeLessThanOrEqual(6);
        }
      ),
      { numRuns: 200 }
    );
  });
});
