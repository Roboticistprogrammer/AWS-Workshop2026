// Feature: flappy-kiro, Property 22: Input debounce rejects rapid flap inputs
// Validates: Requirements 9.4

import * as fc from 'fast-check';
import { InputManager } from '../game.js';

// Minimal mock canvas — InputManager only calls addEventListener/removeEventListener
const mockCanvas = {
  addEventListener: () => {},
  removeEventListener: () => {},
};

// Helper: create a fresh InputManager with a no-op action callback
const makeIM = () => new InputManager(mockCanvas, () => {});

// ---------------------------------------------------------------------------
// Property 22: Input debounce rejects rapid flap inputs
// _shouldAllowFlap(now) returns now - _lastFlapTime >= 100
// _lastFlapTime starts at 0
// ---------------------------------------------------------------------------

describe('Property 22: Input debounce rejects rapid flap inputs', () => {
  // --- Core property: rapid second flap (t2 - t1 < 100) is rejected ----------
  test('second flap within < 100 ms window is rejected', () => {
    fc.assert(
      fc.property(
        // t1: first flap timestamp (integer so t1 + gap is exactly representable)
        fc.integer({ min: 0, max: 1000000000 }),
        // gap: strictly less than 100 ms
        fc.double({ min: 0, max: 99.999, noNaN: true }),
        (t1, gap) => {
          const im = makeIM();
          const t2 = t1 + gap;

          // Directly set _lastFlapTime to t1 to simulate a flap having occurred at t1
          im._lastFlapTime = t1;

          // Second flap arrives gap ms later — must be rejected because t2 - t1 < 100
          expect(im._shouldAllowFlap(t2)).toBe(false);
        }
      ),
      { numRuns: 500 }
    );
  });

  // --- Core property: flap after >= 100 ms gap is allowed -------------------
  test('flap after >= 100 ms gap is allowed', () => {
    fc.assert(
      fc.property(
        // lastFlapTime: integer base so lastFlapTime + gap is exactly representable
        fc.integer({ min: 0, max: 1000000000 }),
        // gap: >= 100 ms
        fc.double({ min: 100, max: 1e6, noNaN: true }),
        (lastFlapTime, gap) => {
          const im = makeIM();
          im._lastFlapTime = lastFlapTime;
          const now = lastFlapTime + gap;

          expect(im._shouldAllowFlap(now)).toBe(true);
        }
      ),
      { numRuns: 500 }
    );
  });

  // --- First flap is always allowed (lastFlapTime starts at 0) --------------
  test('first flap allowed for any t1 >= 100', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 100, max: 1e9, noNaN: true }),
        (t1) => {
          const im = makeIM();
          // _lastFlapTime is 0 at construction, so t1 - 0 >= 100
          expect(im._shouldAllowFlap(t1)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });

  // --- Boundary: exactly 100 ms is allowed ----------------------------------
  test('_shouldAllowFlap returns true when now - lastFlapTime === 100', () => {
    fc.assert(
      fc.property(
        // integer base so lastFlapTime + 100 is exactly representable
        fc.integer({ min: 0, max: 1000000000 }),
        (lastFlapTime) => {
          const im = makeIM();
          im._lastFlapTime = lastFlapTime;
          expect(im._shouldAllowFlap(lastFlapTime + 100)).toBe(true);
        }
      ),
      { numRuns: 300 }
    );
  });

  // --- Boundary: 99.999 ms is rejected (just under threshold) ---------------
  test('_shouldAllowFlap returns false when now - lastFlapTime is 99.999', () => {
    fc.assert(
      fc.property(
        // integer base so lastFlapTime + 99.999 stays correctly below the +100 threshold
        fc.integer({ min: 0, max: 1000000000 }),
        (lastFlapTime) => {
          const im = makeIM();
          im._lastFlapTime = lastFlapTime;
          expect(im._shouldAllowFlap(lastFlapTime + 99.999)).toBe(false);
        }
      ),
      { numRuns: 300 }
    );
  });

  // --- Concrete edge cases --------------------------------------------------
  test('_lastFlapTime starts at 0', () => {
    const im = makeIM();
    expect(im._lastFlapTime).toBe(0);
  });

  test('_shouldAllowFlap(0) returns true for a fresh InputManager (0 - 0 >= 100 is false)', () => {
    // Edge: t=0, lastFlapTime=0 → 0 - 0 = 0 < 100 → false
    const im = makeIM();
    expect(im._shouldAllowFlap(0)).toBe(false);
  });

  test('_shouldAllowFlap(99) returns false (99 - 0 < 100)', () => {
    const im = makeIM();
    expect(im._shouldAllowFlap(99)).toBe(false);
  });

  test('_shouldAllowFlap(100) returns true (100 - 0 >= 100)', () => {
    const im = makeIM();
    expect(im._shouldAllowFlap(100)).toBe(true);
  });

  test('_shouldAllowFlap(200) returns true (200 - 0 >= 100)', () => {
    const im = makeIM();
    expect(im._shouldAllowFlap(200)).toBe(true);
  });
});
