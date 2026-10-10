// Feature: flappy-kiro, Property 1: Canvas aspect ratio invariant
// Validates: Requirements 1.5, 1.6

import * as fc from 'fast-check';
import { CanvasScaler } from '../game.js';

describe('CanvasScaler', () => {
  // Property 1: Canvas aspect ratio invariant
  // For any containerWidth in [1, 5000], after CanvasScaler.resize:
  //   - canvas.width === min(containerWidth, 1280)
  //   - canvas.height === canvas.width * 0.75
  test('Property 1: canvas width = min(containerWidth, 1280) and height = width * 0.75', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5000 }),
        (containerWidth) => {
          const mockCanvas = { width: 0, height: 0 };
          const result = CanvasScaler.resize(mockCanvas, containerWidth);

          const expectedWidth = Math.min(containerWidth, 1280);
          const expectedHeight = expectedWidth * 0.75;

          // canvas object must be mutated with correct dimensions
          expect(mockCanvas.width).toBeCloseTo(expectedWidth, 3);
          expect(mockCanvas.height).toBeCloseTo(expectedHeight, 3);

          // returned { w, h } must also match
          expect(result.w).toBeCloseTo(expectedWidth, 3);
          expect(result.h).toBeCloseTo(expectedHeight, 3);

          // scale must be width / 480 (logical base width)
          expect(result.scale).toBeCloseTo(expectedWidth / 480, 6);

          // aspect ratio check: height / width === 0.75 (±0.001 tolerance)
          expect(Math.abs(mockCanvas.height / mockCanvas.width - 0.75)).toBeLessThanOrEqual(0.001);
        }
      ),
      { numRuns: 100 }
    );
  });

  // Edge case: containerWidth exactly at cap (1280)
  test('canvas width is capped at 1280 when containerWidth equals 1280', () => {
    const mockCanvas = { width: 0, height: 0 };
    CanvasScaler.resize(mockCanvas, 1280);
    expect(mockCanvas.width).toBe(1280);
    expect(mockCanvas.height).toBe(960);
  });

  // Edge case: containerWidth exceeds cap
  test('canvas width is capped at 1280 when containerWidth exceeds 1280', () => {
    const mockCanvas = { width: 0, height: 0 };
    CanvasScaler.resize(mockCanvas, 1440);
    expect(mockCanvas.width).toBe(1280);
    expect(mockCanvas.height).toBe(960);
  });

  // Edge case: small viewport (e.g. mobile 320px)
  test('canvas scales correctly for a 320 px viewport', () => {
    const mockCanvas = { width: 0, height: 0 };
    const result = CanvasScaler.resize(mockCanvas, 320);
    expect(mockCanvas.width).toBe(320);
    expect(mockCanvas.height).toBe(240);
    expect(result.scale).toBeCloseTo(320 / 480, 6);
  });
});
