// Feature: flappy-kiro, Property 14: Score increments exactly once per pipe crossing
// Validates: Requirements 6.1

import * as fc from 'fast-check';
import { ScoreManager, createGhost, createPipe } from '../game.js';

// A minimal game-state stub carrying only what checkScoring reads/writes.
const makeState = (score = 0) => ({ score });

// ---------------------------------------------------------------------------
// Example-based coverage of the core contract
// ---------------------------------------------------------------------------
describe('Property 14: Score increments exactly once per pipe crossing', () => {
  test('increments score by 1 and sets scored=true when ghost centre crosses pipe centre', () => {
    const ghost = createGhost(); // x = 80, width = 32 -> cx = 96
    // Pipe centred to the left of the ghost: pipeCx <= ghostCx (96)
    const pipe = createPipe(40, 180, 360); // bodyWidth 52 -> cx = 66
    const state = makeState(0);

    expect(pipe.scored).toBe(false);
    ScoreManager.checkScoring(ghost, [pipe], state);

    expect(state.score).toBe(1);
    expect(pipe.scored).toBe(true);
  });

  test('does NOT increment again when called on an already-scored pipe', () => {
    const ghost = createGhost(); // cx = 96
    const pipe = createPipe(40, 180, 360); // cx = 66
    const state = makeState(0);

    ScoreManager.checkScoring(ghost, [pipe], state);
    expect(state.score).toBe(1);

    // Second call on the same (now scored) pipe must be a no-op for scoring.
    ScoreManager.checkScoring(ghost, [pipe], state);
    expect(state.score).toBe(1);
    expect(pipe.scored).toBe(true);
  });

  test('does NOT increment while ghost centre is still left of pipe centre', () => {
    const ghost = createGhost(); // cx = 96
    const pipe = createPipe(200, 180, 360); // cx = 226, well to the right
    const state = makeState(0);

    ScoreManager.checkScoring(ghost, [pipe], state);
    expect(state.score).toBe(0);
    expect(pipe.scored).toBe(false);
  });

  // -------------------------------------------------------------------------
  // Property: for any rightward sequence of ghost x positions moving past a
  // pipe, the total score increment is exactly 1 for that pipe.
  // -------------------------------------------------------------------------
  test('a rightward sweep past a single pipe scores exactly once in total', () => {
    fc.assert(
      fc.property(
        // Pipe left edge anywhere on screen.
        fc.double({ min: 0, max: 480, noNaN: true }),
        // Starting ghost x strictly left of the pipe centre, plus a monotonic
        // increasing sequence of positive step sizes to sweep rightward.
        fc.array(fc.double({ min: 0, max: 60, noNaN: true }), { minLength: 1, maxLength: 40 }),
        (pipeX, steps) => {
          const pipe = createPipe(pipeX, 180, 360);
          const pipeCx = pipe.x + pipe.bodyWidth / 2;
          const state = makeState(0);

          const ghost = createGhost();
          // Start the ghost's centre well to the left of the pipe centre so the
          // sweep genuinely begins before the crossing.
          ghost.x = pipeCx - ghost.width / 2 - 100;

          // Sweep rightward, calling checkScoring at every position. The ghost
          // crosses the pipe centre at some point and ends well past it.
          let x = ghost.x;
          for (const step of steps) {
            x += step;
            ghost.x = x;
            ScoreManager.checkScoring(ghost, [pipe], state);
          }
          // Guarantee the final position is past the centre so a crossing happened.
          ghost.x = pipeCx + 200;
          ScoreManager.checkScoring(ghost, [pipe], state);

          // Exactly one point in the sweep should have been scored.
          expect(state.score).toBe(1);
          expect(pipe.scored).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('each pipe in a field scores at most once over repeated checks', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0, max: 400, noNaN: true }), { minLength: 1, maxLength: 6 }),
        fc.integer({ min: 1, max: 10 }),
        (pipeXs, repeats) => {
          const pipes = pipeXs.map((px) => createPipe(px, 180, 360));
          const state = makeState(0);
          const ghost = createGhost();
          // Place the ghost far to the right so every pipe centre is crossed.
          ghost.x = 10000;

          for (let i = 0; i < repeats; i++) {
            ScoreManager.checkScoring(ghost, pipes, state);
          }

          // No matter how many times we check, each pipe contributes exactly 1.
          expect(state.score).toBe(pipes.length);
          expect(pipes.every((p) => p.scored === true)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });
});
