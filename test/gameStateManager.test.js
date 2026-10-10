// Feature: flappy-kiro — GameStateManager property-based tests
// Properties 19, 20, 21
// Validates: Requirements 7.6, 11.3, 11.4, 11.5

import * as fc from 'fast-check';
import {
  GameStateManager,
  createGameState,
  createGhost,
  PhysicsEngine,
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

/** Helper: create a fresh GameStateManager backed by a fresh GameState. */
const makeGSM = () => {
  const state = createGameState();
  const gsm = new GameStateManager(state, PhysicsEngine, mockScore, mockAudio);
  return { gsm, state };
};

// ---------------------------------------------------------------------------
// Arbitraries
// ---------------------------------------------------------------------------

/** Any ghost vertical position in a reasonable play-field range. */
const anyGhostY  = () => fc.double({ min: 0, max: 360, noNaN: true });

/** Any ghost vertical velocity in the clamped range [-8, 12]. */
const anyGhostVy = () => fc.double({ min: -8, max: 12, noNaN: true });

/** Any non-negative integer score. */
const anyScore = () => fc.integer({ min: 0, max: 9999 });

// ---------------------------------------------------------------------------
// Property 19: Restart produces a clean Idle_State regardless of prior game state
// Feature: flappy-kiro, Property 19: Restart produces a clean Idle_State regardless of prior game state
// Validates: Requirements 7.6
// ---------------------------------------------------------------------------
describe('Property 19: Restart produces a clean Idle_State regardless of prior game state', () => {
  test(
    'RESTART from Game_Over_State resets score=0, ghost to start, pipes=[], pipeSpeed=3, current=Idle_State',
    () => {
      fc.assert(
        fc.property(
          anyScore(),
          anyGhostY(),
          anyGhostVy(),
          (score, ghostY, ghostVy) => {
            const { gsm, state } = makeGSM();

            // Force the state into Game_Over_State with arbitrary data
            state.current = 'Game_Over_State';
            state.score = score;
            state.ghost.y = ghostY;
            state.ghost.vy = ghostVy;
            // Add some pipes to make sure they get cleared
            state.pipes = [
              { x: 200, gapCentreY: 180, scored: false },
              { x: 400, gapCentreY: 200, scored: true },
            ];
            state.pipeSpeed = 5.1; // simulate a speed that has increased

            // Apply RESTART
            gsm.handleAction('RESTART');

            // Assert clean Idle_State
            expect(state.current).toBe('Idle_State');
            expect(state.score).toBe(0);
            expect(state.ghost.y).toBe(180);          // starting position
            expect(state.ghost.vy).toBe(0);           // at rest
            expect(state.pipes).toEqual([]);
            expect(state.pipeSpeed).toBe(3);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test('RESTART is ignored in states other than Game_Over_State', () => {
    const nonGameOverStates = ['Menu_State', 'Idle_State', 'Playing_State', 'Paused_State'];
    for (const current of nonGameOverStates) {
      const { gsm, state } = makeGSM();
      state.current = current;
      state.score = 42;

      gsm.handleAction('RESTART');

      // State should not have changed to Idle_State
      expect(state.current).toBe(current);
      expect(state.score).toBe(42);
    }
  });
});

// ---------------------------------------------------------------------------
// Property 20: Pause/resume is a state round-trip that preserves all positions
// Feature: flappy-kiro, Property 20: Pause/resume is a state round-trip that preserves all positions
// Validates: Requirements 11.3, 11.5
// ---------------------------------------------------------------------------
describe('Property 20: Pause/resume is a state round-trip that preserves all positions', () => {
  test(
    'PAUSE_TOGGLE then PAUSE_TOGGLE from Playing_State preserves ghost.y, ghost.vy, score',
    () => {
      fc.assert(
        fc.property(
          anyGhostY(),
          anyGhostVy(),
          anyScore(),
          (ghostY, ghostVy, score) => {
            const { gsm, state } = makeGSM();

            // Set up Playing_State with arbitrary values
            state.current = 'Playing_State';
            state.ghost.y = ghostY;
            state.ghost.vy = ghostVy;
            state.score = score;

            // Capture values before pause
            const yBefore     = state.ghost.y;
            const vyBefore    = state.ghost.vy;
            const scoreBefore = state.score;

            // Pause → Resume
            gsm.handleAction('PAUSE_TOGGLE');
            expect(state.current).toBe('Paused_State');

            gsm.handleAction('PAUSE_TOGGLE');
            expect(state.current).toBe('Playing_State');

            // All values must be preserved
            expect(state.ghost.y).toBe(yBefore);
            expect(state.ghost.vy).toBe(vyBefore);
            expect(state.score).toBe(scoreBefore);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test('PAUSE_TOGGLE is ignored in Menu_State, Idle_State, and Game_Over_State', () => {
    const ignoredStates = ['Menu_State', 'Idle_State', 'Game_Over_State'];
    for (const current of ignoredStates) {
      const { gsm, state } = makeGSM();
      state.current = current;

      gsm.handleAction('PAUSE_TOGGLE');

      expect(state.current).toBe(current); // state unchanged
    }
  });

  test('tick is a no-op while Paused_State — ghost position does not change', () => {
    fc.assert(
      fc.property(
        anyGhostY(),
        anyGhostVy(),
        fc.double({ min: 1, max: 50, noNaN: true }), // deltaMs
        (ghostY, ghostVy, deltaMs) => {
          const { gsm, state } = makeGSM();

          state.current = 'Paused_State';
          state.ghost.y = ghostY;
          state.ghost.vy = ghostVy;

          gsm.tick(deltaMs);

          expect(state.ghost.y).toBe(ghostY);
          expect(state.ghost.vy).toBe(ghostVy);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 21: Flap inputs are ignored while paused
// Feature: flappy-kiro, Property 21: Flap inputs are ignored while paused
// Validates: Requirements 11.4
// ---------------------------------------------------------------------------
describe('Property 21: Flap inputs are ignored while paused', () => {
  test(
    'dispatching FLAP in Paused_State leaves ghost.vy and ghost.y unchanged',
    () => {
      fc.assert(
        fc.property(
          anyGhostY(),
          anyGhostVy(),
          (ghostY, ghostVy) => {
            const { gsm, state } = makeGSM();

            state.current = 'Paused_State';
            state.ghost.y = ghostY;
            state.ghost.vy = ghostVy;

            gsm.handleAction('FLAP');

            expect(state.ghost.vy).toBe(ghostVy);
            expect(state.ghost.y).toBe(ghostY);
          }
        ),
        { numRuns: 100 }
      );
    }
  );

  test('dispatching FLAP in Paused_State does not change state to Playing_State', () => {
    fc.assert(
      fc.property(
        anyGhostVy(),
        (ghostVy) => {
          const { gsm, state } = makeGSM();

          state.current = 'Paused_State';
          state.ghost.vy = ghostVy;

          gsm.handleAction('FLAP');

          expect(state.current).toBe('Paused_State');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('dispatching FLAP in Game_Over_State restarts the game (clean Idle_State)', () => {
    fc.assert(
      fc.property(
        anyGhostY(),
        anyGhostVy(),
        (ghostY, ghostVy) => {
          const { gsm, state } = makeGSM();

          state.current = 'Game_Over_State';
          state.score = 9;
          state.ghost.y = ghostY;
          state.ghost.vy = ghostVy;

          // A flap input on the game-over screen restarts the game (Req 7.6).
          gsm.handleAction('FLAP');

          expect(state.current).toBe('Idle_State');
          expect(state.score).toBe(0);
          expect(state.ghost.y).toBe(180);
          expect(state.ghost.vy).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
