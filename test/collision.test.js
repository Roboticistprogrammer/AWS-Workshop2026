// Feature: flappy-kiro, CollisionDetector property-based tests
// Properties 12, 13
// Validates: Requirements 5.1, 5.2, 5.3, 5.4

import * as fc from 'fast-check';
import { CollisionDetector, createGhost } from '../game.js';

// ---------------------------------------------------------------------------
// Property 12: Collision detection uses 4 px inward hitbox margin
// Feature: flappy-kiro, Property 12: Collision detection uses 4 px inward hitbox margin
// Validates: Requirements 5.4, 5.1
// ---------------------------------------------------------------------------
describe('Property 12: Collision detection uses 4 px inward hitbox margin', () => {
  test('getHitbox shrinks the ghost box by exactly 4 px on all sides', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: 1500, noNaN: true }), // ghost x
        fc.double({ min: -500, max: 1500, noNaN: true }), // ghost y
        (x, y) => {
          const ghost = { ...createGhost(), x, y };
          const hitbox = CollisionDetector.getHitbox(ghost);

          expect(hitbox.x).toBe(ghost.x + 4);
          expect(hitbox.y).toBe(ghost.y + 4);
          expect(hitbox.w).toBe(ghost.width - 8);
          expect(hitbox.h).toBe(ghost.height - 8);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('default 32x32 ghost yields a 24x24 hitbox inset by 4 px', () => {
    const ghost = createGhost(); // width 32, height 32
    const hitbox = CollisionDetector.getHitbox(ghost);

    expect(hitbox.w).toBe(24);
    expect(hitbox.h).toBe(24);
    expect(hitbox.x).toBe(ghost.x + 4);
    expect(hitbox.y).toBe(ghost.y + 4);
  });
});

// ---------------------------------------------------------------------------
// Property 13: Boundary collision detected at correct edges
// Feature: flappy-kiro, Property 13: Boundary collision detected at correct edges
// Validates: Requirements 5.2, 5.3
// ---------------------------------------------------------------------------
describe('Property 13: Boundary collision detected at correct edges', () => {
  const HUD_TOP = 360; // representative HUD top edge in logical px

  test('top boundary: any ghost with y < 0 collides', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -500, max: -0.0001, noNaN: true }), // y strictly < 0
        (y) => {
          const ghost = { ...createGhost(), y };
          expect(CollisionDetector.checkBoundary(ghost, HUD_TOP)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('bottom boundary: any ghost whose bottom edge reaches hudTop collides', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 300, max: 2000, noNaN: true }), // hudTop
        fc.double({ min: 0, max: 2000, noNaN: true }),    // slack >= 0 past the edge
        (hudTop, slack) => {
          const ghost = createGhost(); // height 32
          // Place the ghost so bottom edge is exactly hudTop + slack (>= hudTop)
          ghost.y = hudTop + slack - ghost.height;
          expect(ghost.y + ghost.height).toBeGreaterThanOrEqual(hudTop);
          expect(CollisionDetector.checkBoundary(ghost, hudTop)).toBe(true);
        }
      ),
      { numRuns: 200 }
    );
  });

  test('within bounds: ghost with y >= 0 and bottom edge < hudTop does not collide', () => {
    const ghost = createGhost(); // height 32
    fc.assert(
      fc.property(
        // Generate hudTop with enough room for the ghost, then a y strictly inside.
        fc
          .double({ min: ghost.height + 1, max: 2000, noNaN: true })
          .chain((hudTop) =>
            fc
              .double({ min: 0, max: hudTop - ghost.height - 0.0001, noNaN: true })
              .map((y) => [hudTop, y])
          ),
        ([hudTop, y]) => {
          ghost.y = y;
          expect(ghost.y).toBeGreaterThanOrEqual(0);
          expect(ghost.y + ghost.height).toBeLessThan(hudTop);
          expect(CollisionDetector.checkBoundary(ghost, hudTop)).toBe(false);
        }
      ),
      { numRuns: 200 }
    );
  });
});
