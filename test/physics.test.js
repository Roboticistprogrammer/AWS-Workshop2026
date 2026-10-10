// Feature: flappy-kiro, PhysicsEngine property-based tests
// Properties 2, 3, 4, 5, 6, 7
// Validates: Requirements 2.6, 2.7, 3.1, 3.2, 3.3, 3.5, 3.7

import * as fc from 'fast-check';
import { PhysicsEngine, createGhost } from '../game.js';

// ---------------------------------------------------------------------------
// Shared arbitrary: a ghost with any valid vy
// fc.double is used instead of fc.float to avoid the 32-bit rounding constraint
// ---------------------------------------------------------------------------
const anyGhost = () =>
  fc.record({
    x:        fc.constant(80),
    y:        fc.double({ min: -200, max: 500, noNaN: true }),
    vy:       fc.double({ min: -20, max: 20, noNaN: true }),
    rotation: fc.constant(0),
    width:    fc.constant(32),
    height:   fc.constant(32),
    sprite:   fc.constant(null),
  });

const DEG_TO_RAD = Math.PI / 180;

// ---------------------------------------------------------------------------
// Property 2: Ghost rotation after flap is within bounds [-30°, -20°]
// Feature: flappy-kiro, Property 2: Ghost rotation after flap is within bounds
// Validates: Requirements 2.6
// ---------------------------------------------------------------------------
describe('Property 2: Ghost rotation after flap is within bounds', () => {
  test('after applyFlap + computeRotation, angle is in [-30°, -20°] in radians', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        (ghost) => {
          const flappped = PhysicsEngine.applyFlap(ghost);
          const angle    = PhysicsEngine.computeRotation(flappped.vy);

          const minRad = -30 * DEG_TO_RAD;
          const maxRad = -20 * DEG_TO_RAD;

          expect(angle).toBeGreaterThanOrEqual(minRad);
          expect(angle).toBeLessThanOrEqual(maxRad);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('applyFlap sets vy to exactly -8 (precondition for rotation check)', () => {
    const ghost  = createGhost();
    const result = PhysicsEngine.applyFlap(ghost);
    expect(result.vy).toBe(-8);
  });
});

// ---------------------------------------------------------------------------
// Property 3: Ghost rotation while falling never exceeds +90°
// Feature: flappy-kiro, Property 3: Ghost rotation while falling never exceeds +90°
// Validates: Requirements 2.7
// ---------------------------------------------------------------------------
describe('Property 3: Ghost rotation while falling never exceeds +90°', () => {
  test('for any vy in [0, 12], computeRotation returns angle in [0°, 90°]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 12, noNaN: true }),
        (vy) => {
          const angle = PhysicsEngine.computeRotation(vy);

          expect(angle).toBeGreaterThanOrEqual(0);
          expect(angle).toBeLessThanOrEqual(90 * DEG_TO_RAD + 1e-9);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('computeRotation is non-decreasing as vy increases from 0 to 12', () => {
    fc.assert(
      fc.property(
        // Generate two velocities where vy1 <= vy2, both in [0, 12]
        fc.double({ min: 0, max: 12, noNaN: true }).chain((vy1) =>
          fc.double({ min: vy1, max: 12, noNaN: true }).map((vy2) => [vy1, vy2])
        ),
        ([vy1, vy2]) => {
          const angle1 = PhysicsEngine.computeRotation(vy1);
          const angle2 = PhysicsEngine.computeRotation(vy2);
          // Non-decreasing: angle for higher vy must be >= angle for lower vy
          expect(angle2).toBeGreaterThanOrEqual(angle1 - 1e-9);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 4: Gravity accumulates correctly with delta-time
// Feature: flappy-kiro, Property 4: Gravity accumulates correctly with delta-time
// Validates: Requirements 3.1, 3.3
// ---------------------------------------------------------------------------
describe('Property 4: Gravity accumulates correctly with delta-time', () => {
  test('after applyGravity then clampVelocity, result.vy = min(vy0 + 0.5 * dtFactor, 12)', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        fc.double({ min: 0.001, max: 10, noNaN: true }), // dtFactor > 0
        (ghost, dtFactor) => {
          const afterGravity = PhysicsEngine.applyGravity(ghost, dtFactor);
          const afterClamp   = PhysicsEngine.clampVelocity(afterGravity);

          const expected = Math.min(ghost.vy + 0.5 * dtFactor, 12);
          expect(afterClamp.vy).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('applyGravity does not mutate the original ghost object', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        fc.double({ min: 0.001, max: 10, noNaN: true }),
        (ghost, dtFactor) => {
          const originalVy = ghost.vy;
          PhysicsEngine.applyGravity(ghost, dtFactor);
          expect(ghost.vy).toBe(originalVy);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 5: Flap always sets vy to exactly −8
// Feature: flappy-kiro, Property 5: Flap always sets vy to exactly -8
// Validates: Requirements 3.2
// ---------------------------------------------------------------------------
describe('Property 5: Flap always sets vy to exactly -8', () => {
  test('applyFlap returns ghost with vy === -8 regardless of initial vy', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        (ghost) => {
          const result = PhysicsEngine.applyFlap(ghost);
          expect(result.vy).toBe(-8);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('applyFlap preserves all other ghost properties', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        (ghost) => {
          const result = PhysicsEngine.applyFlap(ghost);
          expect(result.x).toBe(ghost.x);
          expect(result.y).toBe(ghost.y);
          expect(result.width).toBe(ghost.width);
          expect(result.height).toBe(ghost.height);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('applyFlap does not mutate the original ghost object', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        (ghost) => {
          const originalVy = ghost.vy;
          PhysicsEngine.applyFlap(ghost);
          expect(ghost.vy).toBe(originalVy);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 6: Position update scales linearly with delta-time
// Feature: flappy-kiro, Property 6: Position update scales linearly with delta-time
// Validates: Requirements 3.5
// ---------------------------------------------------------------------------
describe('Property 6: Position update scales linearly with delta-time', () => {
  test('updatePosition returns ghost with y = oldY + vy * dtFactor', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        fc.double({ min: 0.001, max: 10, noNaN: true }), // dtFactor > 0
        (ghost, dtFactor) => {
          const result   = PhysicsEngine.updatePosition(ghost, dtFactor);
          const expected = ghost.y + ghost.vy * dtFactor;
          expect(result.y).toBeCloseTo(expected, 10);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('updatePosition does not alter vy', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        fc.double({ min: 0.001, max: 10, noNaN: true }),
        (ghost, dtFactor) => {
          const result = PhysicsEngine.updatePosition(ghost, dtFactor);
          expect(result.vy).toBe(ghost.vy);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('updatePosition does not mutate the original ghost object', () => {
    fc.assert(
      fc.property(
        anyGhost(),
        fc.double({ min: 0.001, max: 10, noNaN: true }),
        (ghost, dtFactor) => {
          const originalY = ghost.y;
          PhysicsEngine.updatePosition(ghost, dtFactor);
          expect(ghost.y).toBe(originalY);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ---------------------------------------------------------------------------
// Property 7: Ghost idle bob stays within amplitude bounds
// Feature: flappy-kiro, Property 7: Ghost idle bob stays within amplitude bounds
// Validates: Requirements 3.7
// ---------------------------------------------------------------------------
describe('Property 7: Ghost idle bob stays within amplitude bounds', () => {
  test('for any timeMs >= 0, bobOffset(timeMs) is in [-20, 20]', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true }), // timeMs >= 0
        (timeMs) => {
          const offset = PhysicsEngine.bobOffset(timeMs);
          expect(offset).toBeGreaterThanOrEqual(-20);
          expect(offset).toBeLessThanOrEqual(20);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('bobOffset amplitude is exactly 10 (bounded in [-10, 10])', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e9, noNaN: true }),
        (timeMs) => {
          const offset = PhysicsEngine.bobOffset(timeMs);
          // Design spec: amplitude = 10 px (10 * sin(...) gives range [-10, 10])
          expect(offset).toBeGreaterThanOrEqual(-10 - 1e-9);
          expect(offset).toBeLessThanOrEqual(10 + 1e-9);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('bobOffset(0) is 0 (sin(0) = 0)', () => {
    expect(PhysicsEngine.bobOffset(0)).toBe(0);
  });

  test('bobOffset completes a full period at 2000 ms', () => {
    // sin is periodic: bobOffset(t) === bobOffset(t + 2000)
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1e6, noNaN: true }),
        (timeMs) => {
          const offset1 = PhysicsEngine.bobOffset(timeMs);
          const offset2 = PhysicsEngine.bobOffset(timeMs + 2000);
          expect(offset1).toBeCloseTo(offset2, 8);
        }
      ),
      { numRuns: 100 }
    );
  });
});
