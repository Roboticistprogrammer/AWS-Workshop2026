// Feature: flappy-kiro, Renderer game-over overlay property-based tests
// Properties 17, 18
// Validates: Requirements 7.3, 7.4

import * as fc from 'fast-check';
import { Renderer } from '../game.js';

// ---------------------------------------------------------------------------
// Property 17: Game over overlay always contains score and high score
// Feature: flappy-kiro, Property 17: Game over overlay always contains score and high score
// Validates: Requirements 7.3
//
// Renderer._drawGameOverOverlay returns the overlay text string when ctx is
// null (string-output mode). For any score S and high score H the returned
// string must contain both String(S) and String(H).
// ---------------------------------------------------------------------------
describe('Property 17: Game over overlay always contains score and high score', () => {
  test('returned overlay text contains both the score and high score for any S, H, isNewBest', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.boolean(),
        (score, highScore, isNewBest) => {
          const text = Renderer._drawGameOverOverlay(null, score, highScore, isNewBest, null);

          expect(typeof text).toBe('string');
          expect(text).toContain(String(score));
          expect(text).toContain(String(highScore));
        }
      ),
      { numRuns: 200 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 18: "New Best!" shown if and only if score exceeds previous high score
// Feature: flappy-kiro, Property 18: "New Best!" shown if and only if score exceeds previous high score
// Validates: Requirements 7.4
//
// The caller (Renderer.draw) decides whether the score is a new best and passes
// the result in via the isNewBest flag. The overlay text must contain
// "New Best!" if and only if isNewBest === true.
// ---------------------------------------------------------------------------
describe('Property 18: "New Best!" shown if and only if score exceeds previous high score', () => {
  test('overlay text contains "New Best!" iff isNewBest === true', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100000 }),
        fc.integer({ min: 0, max: 100000 }),
        fc.boolean(),
        (score, highScore, isNewBest) => {
          const text = Renderer._drawGameOverOverlay(null, score, highScore, isNewBest, null);

          expect(text.includes('New Best!')).toBe(isNewBest);
        }
      ),
      { numRuns: 200 }
    );
  });
});
