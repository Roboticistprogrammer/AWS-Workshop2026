// Flappy Kiro — game.js
// ES module: pure functions are exported for testing.
// GameLoop startup is guarded behind typeof window !== 'undefined'
// so this module can be safely imported in Node.js test environments.

// ---------------------------------------------------------------------------
// Data model factories
// ---------------------------------------------------------------------------

/**
 * Creates the initial ghost data model.
 * @returns {object} Ghost state object
 */
export const createGhost = () => ({
  x: 80,           // logical px — fixed horizontal position
  y: 180,          // logical px — vertical position (top edge)
  vy: 0,           // vertical velocity, px/tick at 60 fps baseline
  rotation: 0,     // radians
  width: 32,       // logical px (sprite draw size)
  height: 32,
  sprite: null,    // HTMLImageElement loaded at init
  idleBobOffset: 0, // render-only vertical offset used during Idle_State bob animation
});

/**
 * Creates a pipe pair data model.
 * @param {number} x          - Left edge of pipe body (logical px)
 * @param {number} gapCentreY - Vertical centre of the gap (logical px)
 * @param {number} canvasH    - Canvas height in logical px (unused here but kept for callers)
 * @returns {object} Pipe state object
 */
export const createPipe = (x, gapCentreY, canvasH) => ({
  x,
  gapCentreY,
  gapHeight: 150,   // logical px — constant
  bodyWidth: 52,    // logical px
  capWidth: 64,     // logical px
  capHeight: 16,    // logical px
  scored: false,    // true once ghost has crossed this pipe's centre
});

/**
 * Creates a cloud data model.
 * @param {number} x      - Left edge (logical px)
 * @param {number} y      - Top edge (logical px)
 * @param {number} width  - Width (logical px)
 * @param {number} height - Height (logical px)
 * @returns {object} Cloud state object
 */
export const createCloud = (x, y, width, height) => ({
  x,
  y,
  width,
  height,
  speed: 0.5, // logical px/tick — parallax scroll speed
});

/**
 * Generates 3–6 cloud objects spread across the canvas width, positioned
 * in the upper 60% of the canvas height.
 * @param {number} canvasW - Canvas width in logical px (or actual px — used for spacing)
 * @param {number} canvasH - Canvas height in actual px (used for vertical bounds)
 * @returns {Array} Array of Cloud objects
 */
export const generateClouds = (canvasW, canvasH) => {
  // Use a simple deterministic-ish seeded sequence to avoid pure Math.random
  // drift on every call, while still producing varied layouts.
  // We seed by canvas dimensions so resizing regenerates a fresh but stable set.
  const seed = (canvasW * 7 + canvasH * 13) | 0;
  const rng = (() => {
    let s = seed;
    return () => {
      // xorshift32
      s ^= s << 13;
      s ^= s >> 17;
      s ^= s << 5;
      return (s >>> 0) / 0xffffffff;
    };
  })();

  const count = 3 + Math.floor(rng() * 4); // 3–6
  const scale = canvasW / 480; // logical base width 480 px
  const logicalW = 480;
  const logicalH = canvasH / scale;

  const clouds = [];
  for (let i = 0; i < count; i++) {
    const width  = 60 + Math.floor(rng() * 61);    // 60–120 logical px
    const height = 30 + Math.floor(rng() * 26);    // 30–55 logical px
    // Spread evenly across canvas width with random offset within each slot
    const slotW = logicalW / count;
    const x = i * slotW + rng() * (slotW - width);
    // Upper 60% of canvas height
    const y = rng() * (logicalH * 0.6 - height);
    clouds.push(createCloud(x, y, width, height));
  }
  return clouds;
};

/**
 * Creates the initial game state.
 * @returns {object} GameState object
 */
export const createGameState = () => ({
  current: 'Menu_State',   // one of the five named states
  score: 0,
  highScore: 0,            // loaded from localStorage at init
  ghost: createGhost(),
  pipes: [],               // array of Pipe objects, max 6
  clouds: [],              // array of Cloud objects, 3–6
  pipeSpeed: 3,            // px/tick at 60 fps baseline
  pipesSinceSpeedUp: 0,    // count of pipes passed since last speed increase
  idleTimeMs: 0,           // elapsed ms in Idle_State, for sinusoidal bob
  lastPipeX: null,         // x of last spawned pipe's leading edge, for spacing check
});

/**
 * Generates a new pipe at the right edge of the logical canvas (x = 480) with a
 * randomised gap centre constrained to the safe band [150, canvasLogicalH − 150].
 * Extracted as a pure, testable helper (Property 9).
 * @param {number} canvasLogicalH - Logical canvas height (e.g. 360)
 * @param {function(): number} [randomFn] - RNG returning a value in [0, 1); defaults to Math.random
 * @returns {object} Pipe object produced by createPipe
 */
export const generatePipe = (canvasLogicalH, randomFn = Math.random) => {
  const gapCentreY = 150 + randomFn() * (canvasLogicalH - 300);
  return createPipe(480, gapCentreY, canvasLogicalH);
};

// ---------------------------------------------------------------------------
// PhysicsEngine — pure functions, no side effects
// ---------------------------------------------------------------------------

export const PhysicsEngine = {
  /**
   * Applies gravity to the ghost for one tick.
   * @param {object} ghost
   * @param {number} dtFactor - deltaMs / 16.667
   * @returns {object} Updated ghost
   */
  applyGravity(ghost, dtFactor) {
    return { ...ghost, vy: ghost.vy + 0.5 * dtFactor };
  },

  /**
   * Applies a flap impulse — sets vy to exactly −8.
   * @param {object} ghost
   * @returns {object} Updated ghost
   */
  applyFlap(ghost) {
    return { ...ghost, vy: -8 };
  },

  /**
   * Clamps downward velocity to a maximum of 12 px/tick.
   * @param {object} ghost
   * @returns {object} Updated ghost
   */
  clampVelocity(ghost) {
    return { ...ghost, vy: Math.min(ghost.vy, 12) };
  },

  /**
   * Updates the ghost's vertical position using delta-time.
   * @param {object} ghost
   * @param {number} dtFactor
   * @returns {object} Updated ghost
   */
  updatePosition(ghost, dtFactor) {
    return { ...ghost, y: ghost.y + ghost.vy * dtFactor };
  },

  /**
   * Maps vertical velocity to a rotation angle.
   * vy = −8  →  ≈ −25° (upward tilt)
   * vy = 12  →  +90° (nose-down)
   * @param {number} vy
   * @returns {number} Angle in radians
   */
  computeRotation(vy) {
    // Linear interpolation: vy ∈ [-8, 12] → angle ∈ [-25°, 90°]
    const minVy = -8;
    const maxVy = 12;
    const minAngleDeg = -25;
    const maxAngleDeg = 90;
    const t = (vy - minVy) / (maxVy - minVy);
    const clampedT = Math.max(0, Math.min(1, t));
    const angleDeg = minAngleDeg + clampedT * (maxAngleDeg - minAngleDeg);
    return (angleDeg * Math.PI) / 180;
  },

  /**
   * Returns a sinusoidal bob offset for idle animation.
   * Amplitude: 10 px, period: 2000 ms.
   * @param {number} timeMs - Elapsed time in Idle_State
   * @returns {number} Vertical offset in logical px
   */
  bobOffset(timeMs) {
    return 10 * Math.sin((2 * Math.PI * timeMs) / 2000);
  },
};

// ---------------------------------------------------------------------------
// ScoreManager — manages scoring and high-score persistence
// ---------------------------------------------------------------------------

export const ScoreManager = {
  // In-memory fallback for the high score when localStorage is unavailable
  // (e.g. private browsing mode or Node.js test environments).
  _inMemoryHighScore: 0,

  /**
   * Checks whether the ghost has crossed any un-scored pipes and increments
   * the score. Sets pipe.scored = true to prevent double-counting.
   * @param {object} ghost
   * @param {Array}  pipes
   * @param {object} state - GameState (mutated: state.score)
   * @returns {Array} Updated pipes array with .scored flags
   */
  checkScoring(ghost, pipes, state) {
    const ghostCx = ghost.x + ghost.width / 2;
    for (const pipe of pipes) {
      const pipeCx = pipe.x + pipe.bodyWidth / 2;
      if (ghostCx >= pipeCx && pipe.scored === false) {
        state.score += 1;
        pipe.scored = true;
      }
    }
    return pipes;
  },

  /**
   * Called on transition to Game_Over_State. Updates highScore if current
   * score is greater, then persists to localStorage.
   * @param {object} state - GameState (mutated: state.highScore)
   */
  onGameOver(state) {
    if (state.score > state.highScore) {
      state.highScore = state.score;
      this.saveHighScore(state.highScore);
    }
  },

  /**
   * Loads the high score from localStorage.
   * @returns {number} Stored high score, or 0 if absent / unavailable.
   */
  loadHighScore() {
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('flappyKiroHighScore');
        if (stored !== null) {
          const n = parseInt(stored, 10);
          return Number.isNaN(n) ? 0 : n;
        }
      }
    } catch (err) {
      // fall through to in-memory
    }
    return ScoreManager._inMemoryHighScore || 0;
  },

  /**
   * Saves the high score to localStorage.
   * @param {number} value
   */
  saveHighScore(value) {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('flappyKiroHighScore', String(value));
      }
      ScoreManager._inMemoryHighScore = value;
    } catch (err) {
      ScoreManager._inMemoryHighScore = value;
    }
  },
};

// ---------------------------------------------------------------------------
// CanvasScaler — canvas sizing and coordinate utilities
// ---------------------------------------------------------------------------

export const CanvasScaler = {
  /**
   * Resizes the canvas to fit the container, maintaining a 4:3 aspect ratio.
   * Maximum width: 1280 px.
   * @param {HTMLCanvasElement} canvas
   * @param {number} containerWidth
   * @returns {{ scale: number, w: number, h: number }}
   */
  resize(canvas, containerWidth) {
    const w = Math.min(containerWidth, 1280);
    const h = w * 0.75;
    canvas.width = w;
    canvas.height = h;
    const scale = w / 480; // logical base width is 480 px
    return { scale, w, h };
  },

  /**
   * Converts canvas pixel coordinates to logical pixels.
   * @param {number} canvasCoord
   * @param {number} scale
   * @returns {number}
   */
  toLogical(canvasCoord, scale) {
    return canvasCoord / scale;
  },
};

// ---------------------------------------------------------------------------
// CollisionDetector — pure collision checks
// ---------------------------------------------------------------------------

export const CollisionDetector = {
  /**
   * Returns the ghost's hitbox, shrunk by 4 px on all sides.
   * @param {object} ghost
   * @returns {{ x: number, y: number, w: number, h: number }}
   */
  getHitbox(ghost) {
    return {
      x: ghost.x + 4,
      y: ghost.y + 4,
      w: ghost.width - 8,
      h: ghost.height - 8,
    };
  },

  /**
   * Axis-aligned bounding box overlap test. Two rects overlap when they
   * intersect on both axes. Edges that merely touch do not count as overlap.
   * Exported as a static helper for use by tests.
   * @param {{x:number,y:number,w:number,h:number}} a
   * @param {{x:number,y:number,w:number,h:number}} b
   * @returns {boolean}
   */
  _aabbOverlap(a, b) {
    return (
      a.x < b.x + b.w &&
      a.x + a.w > b.x &&
      a.y < b.y + b.h &&
      a.y + a.h > b.y
    );
  },

  /**
   * Checks whether the ghost's hitbox overlaps any pipe body or cap.
   * Each pipe contributes four collision rectangles: top body, top cap,
   * bottom cap, and bottom body (extending to the bottom of the screen).
   * @param {object} ghost
   * @param {Array}  pipes
   * @returns {boolean}
   */
  checkPipes(ghost, pipes) {
    if (!pipes || pipes.length === 0) return false;

    const hitbox = this.getHitbox(ghost);
    const BIG = 10000; // extends bottom body well past the bottom of the screen

    for (const pipe of pipes) {
      const gapTop    = pipe.gapCentreY - pipe.gapHeight / 2;
      const gapBottom = pipe.gapCentreY + pipe.gapHeight / 2;
      const capX      = pipe.x - (pipe.capWidth - pipe.bodyWidth) / 2;

      const rects = [
        // Top body — from the top of the canvas down to where the top cap begins.
        { x: pipe.x, y: 0, w: pipe.bodyWidth, h: gapTop - pipe.capHeight },
        // Top cap — at the gap mouth of the top section.
        { x: capX, y: gapTop - pipe.capHeight, w: pipe.capWidth, h: pipe.capHeight },
        // Bottom cap — at the gap mouth of the bottom section.
        { x: capX, y: gapBottom, w: pipe.capWidth, h: pipe.capHeight },
        // Bottom body — from below the bottom cap down to the bottom of the screen.
        { x: pipe.x, y: gapBottom + pipe.capHeight, w: pipe.bodyWidth, h: BIG },
      ];

      for (const rect of rects) {
        if (this._aabbOverlap(hitbox, rect)) return true;
      }
    }

    return false;
  },

  /**
   * Checks whether the ghost has hit the top or bottom boundary.
   * @param {object} ghost
   * @param {number} hudTop - Y coordinate of the top edge of the HUD bar
   * @returns {boolean}
   */
  checkBoundary(ghost, hudTop) {
    return ghost.y < 0 || ghost.y + ghost.height >= hudTop;
  },
};

// ---------------------------------------------------------------------------
// PipeManager — pipe-pool helpers
// ---------------------------------------------------------------------------

export const PipeManager = {
  /**
   * Returns the correct pipe scroll speed for the given number of pipes passed.
   * Speed increases by 0.3 for every 5 pipes, capped at 6.
   * @param {number} pipesPassed
   * @returns {number}
   */
  computeSpeed(pipesPassed) {
    return Math.min(3 + Math.floor(pipesPassed / 5) * 0.3, 6);
  },

  /**
   * Updates all pipe positions for one tick and handles recycling.
   * @param {Array}  pipes
   * @param {number} pipeSpeed
   * @param {number} dtFactor
   * @param {number} canvasH
   * @returns {Array} Updated pipes array
   */
  update(pipes, pipeSpeed, dtFactor, canvasH) {
    return pipes;
  },
};

// ---------------------------------------------------------------------------
// AudioManager — Web Audio API wrapper
// ---------------------------------------------------------------------------

export class AudioManager {
  constructor() {
    this._context = null;
    this._jumpBuffer = null;
    this._gameOverBuffer = null;
  }

  /**
   * Creates the AudioContext and decodes sound assets into AudioBuffers.
   * Errors during fetch or decode are caught, logged, and leave the buffer as null.
   * The game loop must start regardless of whether this resolves successfully.
   */
  async init() {
    try {
      this._context = new AudioContext();
    } catch (err) {
      console.error('AudioManager: failed to create AudioContext', err);
      return;
    }

    const loadBuffer = async (url) => {
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
        const arrayBuffer = await response.arrayBuffer();
        return await this._context.decodeAudioData(arrayBuffer);
      } catch (err) {
        console.error(`AudioManager: failed to load sound "${url}"`, err);
        return null;
      }
    };

    // Load both sounds concurrently; failures leave buffers as null (silent fallback)
    [this._jumpBuffer, this._gameOverBuffer] = await Promise.all([
      loadBuffer('assets/jump.wav'),
      loadBuffer('assets/game_over.wav'),
    ]);
  }

  /** Calls AudioContext.resume() if the context is suspended. */
  resumeIfSuspended() {
    if (this._context && this._context.state === 'suspended') {
      this._context.resume();
    }
  }

  /** Plays the jump sound effect. No-ops if buffer is null. */
  playJump() {
    if (!this._context || !this._jumpBuffer) return;
    const source = this._context.createBufferSource();
    source.buffer = this._jumpBuffer;
    source.connect(this._context.destination);
    source.start();
  }

  /** Plays the game-over sound effect. No-ops if buffer is null. */
  playGameOver() {
    if (!this._context || !this._gameOverBuffer) return;
    const source = this._context.createBufferSource();
    source.buffer = this._gameOverBuffer;
    source.connect(this._context.destination);
    source.start();
  }
}

// ---------------------------------------------------------------------------
// Renderer — canvas draw routines
// ---------------------------------------------------------------------------

export const Renderer = {
  /** Cache of background stroke descriptors; regenerated when canvas size changes. */
  _bgStrokes: null,
  _bgStrokesKey: null, // "width,height" string to detect canvas resize

  /** Draws the full frame in layer order. */
  draw(gameState, canvas, ctx) {
    const scale = canvas.width / 480;
    this._drawBackground(ctx, canvas);
    this._drawClouds(ctx, gameState.clouds, scale);
    this._drawPipes(ctx, gameState.pipes, canvas, scale);
    this._drawGhost(ctx, gameState.ghost, gameState.ghost.sprite, scale);
    this._drawHUD(ctx, gameState.score, gameState.highScore, canvas);

    const state = gameState.current;
    if (state === 'Menu_State') {
      this._drawMenuOverlay(ctx, gameState.highScore, canvas);
    } else if (state === 'Paused_State') {
      this._drawPausedOverlay(ctx, canvas);
    } else if (state === 'Game_Over_State') {
      // isNewBest is determined before highScore is updated, so compare score vs highScore
      const isNewBest = gameState.score > 0 && gameState.score >= gameState.highScore;
      this._drawGameOverOverlay(ctx, gameState.score, gameState.highScore, isNewBest, canvas);
    }
  },

  /**
   * Draws the sketch-style background.
   * Fills with light-blue then overlays ~40 deterministic pencil-stroke lines.
   * Stroke descriptors are computed once and cached in `_bgStrokes`; they are
   * regenerated only when the canvas dimensions change (prevents per-frame flicker).
   * @param {CanvasRenderingContext2D} ctx
   * @param {HTMLCanvasElement} canvas
   */
  _drawBackground(ctx, canvas) {
    const { width: w, height: h } = canvas;

    // Fill light-blue background
    ctx.fillStyle = '#a8d8ea';
    ctx.fillRect(0, 0, w, h);

    // Regenerate stroke descriptors if canvas was resized
    const key = `${w},${h}`;
    if (this._bgStrokesKey !== key) {
      this._bgStrokesKey = key;
      // Deterministic pseudo-random seeded by canvas dimensions
      let s = (w * 7919 + h * 6271) | 0;
      const rng = () => {
        s ^= s << 13;
        s ^= s >> 17;
        s ^= s << 5;
        return (s >>> 0) / 0xffffffff;
      };

      const COUNT = 40;
      const strokes = [];
      for (let i = 0; i < COUNT; i++) {
        const x1 = rng() * w;
        const y1 = rng() * h;
        // Short line: length 20–60 px, randomish angle
        const len   = 20 + rng() * 40;
        const angle = rng() * Math.PI * 2;
        strokes.push({
          x1,
          y1,
          x2: x1 + Math.cos(angle) * len,
          y2: y1 + Math.sin(angle) * len,
        });
      }
      this._bgStrokes = strokes;
    }

    // Draw the cached sketch strokes
    ctx.save();
    ctx.strokeStyle = 'rgba(0,80,100,0.08)';
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    for (const { x1, y1, x2, y2 } of this._bgStrokes) {
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.stroke();
    }
    ctx.restore();
  },

  /**
   * Draws each cloud as an off-white slightly-rounded rectangle.
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} clouds
   * @param {number} scale
   */
  _drawClouds(ctx, clouds, scale) {
    if (!clouds || clouds.length === 0) return;

    ctx.save();
    ctx.fillStyle = '#f0f4f8';

    for (const cloud of clouds) {
      const x  = cloud.x * scale;
      const y  = cloud.y * scale;
      const cw = cloud.width  * scale;
      const ch = cloud.height * scale;
      const r  = 8 * scale;

      ctx.beginPath();
      if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, cw, ch, r);
      } else {
        // Manual rounded-rect via arcs (fallback for older browsers)
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + cw - r, y);
        ctx.arcTo(x + cw, y,      x + cw, y + r,      r);
        ctx.lineTo(x + cw, y + ch - r);
        ctx.arcTo(x + cw, y + ch, x + cw - r, y + ch, r);
        ctx.lineTo(x + r, y + ch);
        ctx.arcTo(x,      y + ch, x, y + ch - r,      r);
        ctx.lineTo(x, y + r);
        ctx.arcTo(x, y,          x + r, y,             r);
        ctx.closePath();
      }
      ctx.fill();
    }
    ctx.restore();
  },

  /**
   * Draws each pipe pair: a top section and a bottom section, each composed of a
   * dark-green body and a lighter-green cap at the gap mouth. The cap is wider
   * than the body (64 vs 52 logical px → ~11.5% wider on each side).
   * @param {CanvasRenderingContext2D} ctx
   * @param {Array} pipes
   * @param {HTMLCanvasElement} canvas
   * @param {number} scale
   */
  _drawPipes(ctx, pipes, canvas, scale) {
    if (!pipes || pipes.length === 0) return;

    const BODY_COLOUR = '#2e8b2e'; // dark green
    const CAP_COLOUR  = '#3cb043'; // lighter green
    const logicalH = canvas.height / scale;

    for (const pipe of pipes) {
      const { bodyWidth, capWidth, capHeight, gapHeight } = pipe;
      const gapTop    = pipe.gapCentreY - gapHeight / 2;
      const gapBottom = pipe.gapCentreY + gapHeight / 2;
      // Cap is wider than the body and centred on it.
      const capX = pipe.x - (capWidth - bodyWidth) / 2;

      // --- Top pipe ---
      // Body from the top of the canvas down to where the cap begins.
      ctx.fillStyle = BODY_COLOUR;
      ctx.fillRect(pipe.x * scale, 0, bodyWidth * scale, (gapTop - capHeight) * scale);
      // Cap at the bottom of the top section (the gap mouth).
      ctx.fillStyle = CAP_COLOUR;
      ctx.fillRect(capX * scale, (gapTop - capHeight) * scale, capWidth * scale, capHeight * scale);

      // --- Bottom pipe ---
      // Body from below the bottom cap down to the bottom of the canvas.
      ctx.fillStyle = BODY_COLOUR;
      ctx.fillRect(pipe.x * scale, (gapBottom + capHeight) * scale, bodyWidth * scale, (logicalH - gapBottom - capHeight) * scale);
      // Cap at the top of the bottom section (the gap mouth).
      ctx.fillStyle = CAP_COLOUR;
      ctx.fillRect(capX * scale, gapBottom * scale, capWidth * scale, capHeight * scale);
    }
  },

  /**
   * Draws the ghost sprite (or fallback circle) at its current logical position,
   * applying the current rotation and idle-bob offset.
   * @param {CanvasRenderingContext2D} ctx
   * @param {object} ghost
   * @param {HTMLImageElement|null} sprite
   * @param {number} scale
   */
  _drawGhost(ctx, ghost, sprite, scale) {
    // Centre of the ghost in canvas pixels, incorporating idle bob
    const cx   = (ghost.x + ghost.width  / 2) * scale;
    const drawY = (ghost.y + (ghost.idleBobOffset || 0) + ghost.height / 2) * scale;

    ctx.save();
    ctx.translate(cx, drawY);
    ctx.rotate(ghost.rotation);

    if (sprite) {
      const hw = (ghost.width  / 2) * scale;
      const hh = (ghost.height / 2) * scale;
      ctx.drawImage(sprite, -hw, -hh, ghost.width * scale, ghost.height * scale);
    } else {
      // Fallback: white filled circle
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(0, 0, 16 * scale, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
  },

  _drawHUD(ctx, score, highScore, canvas) {
    const scale = canvas.width / 480;

    // Semi-transparent dark bar across the bottom 40 logical px.
    ctx.fillStyle = 'rgba(40, 44, 52, 0.55)';
    ctx.fillRect(0, canvas.height - 40 * scale, canvas.width, 40 * scale);

    // Centred white score text.
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${18 * scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(
      `Score: ${score} | High: ${highScore}`,
      canvas.width / 2,
      canvas.height - 20 * scale
    );
  },

  _drawMenuOverlay(ctx, highScore, canvas) {
    const scale = canvas.width / 480;

    // Full-canvas dim overlay.
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold ${42 * scale}px sans-serif`;
    ctx.fillText('Flappy Kiro', canvas.width / 2, canvas.height * 0.35);

    ctx.font = `${20 * scale}px sans-serif`;
    ctx.fillText(`High: ${highScore}`, canvas.width / 2, canvas.height * 0.52);

    ctx.font = `${18 * scale}px sans-serif`;
    ctx.fillText('Press Space / Tap to Start', canvas.width / 2, canvas.height * 0.65);
  },

  _drawPausedOverlay(ctx, canvas) {
    const scale = canvas.width / 480;

    // Full-canvas dim overlay.
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold ${36 * scale}px sans-serif`;
    ctx.fillText('Paused', canvas.width / 2, canvas.height * 0.45);

    ctx.font = `${18 * scale}px sans-serif`;
    ctx.fillText('Press P / Esc to Resume', canvas.width / 2, canvas.height * 0.58);
  },

  /**
   * Draws (or returns text for) the game-over overlay.
   * When called with ctx === null the method returns the overlay text as a
   * plain string — used by property-based tests (Properties 17, 18).
   * @param {CanvasRenderingContext2D|null} ctx
   * @param {number} score
   * @param {number} highScore
   * @param {boolean} isNewBest
   * @param {HTMLCanvasElement} canvas
   * @returns {string|undefined}
   */
  _drawGameOverOverlay(ctx, score, highScore, isNewBest, canvas) {
    const text = [
      'Game Over',
      `Score: ${score}`,
      `High: ${highScore}`,
      ...(isNewBest ? ['New Best!'] : []),
      'Press Space / Tap to Restart',
    ].join('\n');

    if (ctx === null) {
      return text;
    }

    const scale = canvas.width / 480;

    // Full-canvas dim overlay.
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    ctx.font = `bold ${40 * scale}px sans-serif`;
    ctx.fillText('Game Over', canvas.width / 2, canvas.height * 0.32);

    ctx.font = `${22 * scale}px sans-serif`;
    ctx.fillText(`Score: ${score}`, canvas.width / 2, canvas.height * 0.46);

    ctx.font = `${20 * scale}px sans-serif`;
    ctx.fillText(`High: ${highScore}`, canvas.width / 2, canvas.height * 0.55);

    if (isNewBest) {
      ctx.fillStyle = '#ffd700';
      ctx.font = `bold ${22 * scale}px sans-serif`;
      ctx.fillText('New Best!', canvas.width / 2, canvas.height * 0.64);
      ctx.fillStyle = '#ffffff';
    }

    ctx.font = `${18 * scale}px sans-serif`;
    ctx.fillText('Press Space / Tap to Restart', canvas.width / 2, canvas.height * 0.76);
  },
};

// ---------------------------------------------------------------------------
// InputManager — DOM event handling
// ---------------------------------------------------------------------------

export class InputManager {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {function(string): void} onAction - Callback receiving 'FLAP', 'PAUSE_TOGGLE', or 'RESTART'
   */
  constructor(canvas, onAction) {
    this._canvas = canvas;
    this._onAction = onAction;
    this._lastFlapTime = 0;
    this._boundOnKeyDown = this._onKeyDown.bind(this);
    this._boundOnClick = this._onClick.bind(this);
    this._boundOnTouchStart = this._onTouchStart.bind(this);
  }

  /** Registers DOM event listeners. */
  attach() {
    // keydown on window so keyboard works without requiring canvas focus first
    window.addEventListener('keydown', this._boundOnKeyDown);
    this._canvas.addEventListener('click', this._boundOnClick);
    this._canvas.addEventListener('touchstart', this._boundOnTouchStart, { passive: false });
  }

  /** Removes DOM event listeners. */
  detach() {
    window.removeEventListener('keydown', this._boundOnKeyDown);
    this._canvas.removeEventListener('click', this._boundOnClick);
    this._canvas.removeEventListener('touchstart', this._boundOnTouchStart);
  }

  /**
   * Returns true if enough time has elapsed since the last flap (≥ 100 ms).
   * Exported for testing (Property 22).
   * @param {number} now - Current timestamp in ms
   * @returns {boolean}
   */
  _shouldAllowFlap(now) {
    return now - this._lastFlapTime >= 100;
  }

  /**
   * Dispatches a FLAP action if the debounce window has elapsed.
   * Updates lastFlapTime on success.
   */
  _dispatchFlap() {
    const now = performance.now();
    if (this._shouldAllowFlap(now)) {
      this._lastFlapTime = now;
      this._onAction('FLAP');
    }
  }

  _onKeyDown(e) {
    if (e.code === 'Space') {
      e.preventDefault();
      this._dispatchFlap();
    } else if (e.code === 'KeyP' || e.code === 'Escape') {
      this._onAction('PAUSE_TOGGLE');
    }
  }

  _onClick() {
    this._dispatchFlap();
  }

  _onTouchStart(e) {
    e.preventDefault();
    this._dispatchFlap();
  }
}

// ---------------------------------------------------------------------------
// GameStateManager — finite state machine
// ---------------------------------------------------------------------------

export class GameStateManager {
  /**
   * @param {object}       gameState
   * @param {object}       physicsEngine
   * @param {object}       scoreManager
   * @param {AudioManager} audioManager
   */
  constructor(gameState, physicsEngine, scoreManager, audioManager) {
    this._state = gameState;
    this._physics = physicsEngine;
    this._score = scoreManager;
    this._audio = audioManager;
    this._previousState = null; // tracks origin for transition logic
    // Logical canvas dimensions used for pipe spawning/removal and gap bounds.
    // Default sensibly; the bootstrap may override after construction.
    this._canvasLogicalW = 480;
    this._canvasLogicalH = 360;
  }

  /**
   * Handles a semantic action from InputManager.
   * @param {'FLAP'|'PAUSE_TOGGLE'|'RESTART'} action
   */
  handleAction(action) {
    const current = this._state.current;

    if (action === 'FLAP') {
      // FLAP is ignored while paused.
      if (current === 'Paused_State') {
        return;
      }

      // On the game-over screen, a flap input restarts the game (Req 7.6).
      if (current === 'Game_Over_State') {
        this._audio.resumeIfSuspended();
        this._transitionTo('Idle_State');
        return;
      }

      // Resume AudioContext on first user interaction
      this._audio.resumeIfSuspended();

      if (current === 'Menu_State') {
        // Menu → Idle → Playing (flap applies as part of Playing transition)
        this._transitionTo('Idle_State');
        this._transitionTo('Playing_State');
      } else if (current === 'Idle_State') {
        // Idle → Playing (transition applies first flap impulse)
        this._transitionTo('Playing_State');
      } else if (current === 'Playing_State') {
        // Determine whether to play the jump sound before applying flap
        const shouldPlaySound = this._state.ghost.vy !== -8;
        // Apply flap impulse
        this._state.ghost = this._physics.applyFlap(this._state.ghost);
        // Update rotation to reflect new velocity
        this._state.ghost.rotation = this._physics.computeRotation(this._state.ghost.vy);
        // Play jump sound if not already at flap ceiling
        if (shouldPlaySound) {
          this._audio.playJump();
        }
      }

    } else if (action === 'PAUSE_TOGGLE') {
      this._audio.resumeIfSuspended();

      if (current === 'Playing_State') {
        this._transitionTo('Paused_State');
      } else if (current === 'Paused_State') {
        this._transitionTo('Playing_State');
      }
      // PAUSE_TOGGLE ignored in all other states

    } else if (action === 'RESTART') {
      if (current === 'Game_Over_State') {
        this._audio.resumeIfSuspended();
        this._transitionTo('Idle_State');
      }
      // RESTART ignored in all other states
    }
  }

  /**
   * Advances the simulation by one frame.
   * @param {number} deltaMs
   */
  tick(deltaMs) {
    const dtFactor = deltaMs / 16.667;
    const state = this._state.current;

    if (state === 'Playing_State') {
      // Apply gravity, clamp, update position, compute rotation
      let ghost = this._state.ghost;
      ghost = this._physics.applyGravity(ghost, dtFactor);
      ghost = this._physics.clampVelocity(ghost);
      ghost = this._physics.updatePosition(ghost, dtFactor);
      ghost.rotation = this._physics.computeRotation(ghost.vy);
      this._state.ghost = ghost;

      // --- Pipe generation and movement ---
      const spawnEdge = this._canvasLogicalW; // logical right edge (480 by default)

      // 1. Scroll existing pipes leftwards.
      for (const pipe of this._state.pipes) {
        pipe.x -= this._state.pipeSpeed * dtFactor;
      }

      // 2. Remove pipes that have fully scrolled off the left edge (x < -64).
      this._state.pipes = this._state.pipes.filter((p) => p.x > -64);

      // 3. Spawn a new pipe when spacing allows, capping the active list at 6.
      if (this._state.pipes.length === 0 && this._state.lastPipeX === null) {
        // First pipe of the run.
        this._state.pipes.push(generatePipe(this._canvasLogicalH));
        this._state.lastPipeX = spawnEdge;
      } else if (this._state.pipes.length > 0 && this._state.pipes.length < 6) {
        // Find the rightmost (most recently spawned) pipe.
        const rightmostX = Math.max(...this._state.pipes.map((p) => p.x));
        if (spawnEdge - rightmostX >= 220) {
          this._state.pipes.push(generatePipe(this._canvasLogicalH));
          this._state.lastPipeX = spawnEdge;
        }
      }

      // 4. Scoring — increment the score for any pipe whose centre the ghost
      //    has crossed. Runs before the speed update so computeSpeed reads the
      //    freshly updated score (speed rises every 5 pipes passed).
      this._score.checkScoring(this._state.ghost, this._state.pipes, this._state);

      // 5. Update pipe scroll speed based on pipes passed (score). Speed rises
      //    by 0.3 for every 5 pipes passed, capped at 6.
      this._state.pipeSpeed = PipeManager.computeSpeed(this._state.score);

      // 6. Collision detection — a hit against any pipe or the top/bottom
      //    boundary ends the run immediately. The HUD bar occupies the bottom
      //    40 logical px of the canvas, so the playfield floor is hudTop.
      const hudTop = this._canvasLogicalH - 40;
      if (
        CollisionDetector.checkPipes(this._state.ghost, this._state.pipes) ||
        CollisionDetector.checkBoundary(this._state.ghost, hudTop)
      ) {
        this._transitionTo('Game_Over_State');
        return;
      }

      // Scroll clouds at their speed (parallax)
      for (const cloud of this._state.clouds) {
        cloud.x -= cloud.speed * dtFactor;
        // Wrap cloud around when it scrolls off the left edge
        if (cloud.x + cloud.width < 0) {
          cloud.x = 480 + cloud.width; // wrap to right side (logical px)
        }
      }

    } else if (state === 'Idle_State') {
      // Accumulate idle time for sinusoidal bob animation
      this._state.idleTimeMs += deltaMs;
      // Compute render-only vertical offset — does NOT change ghost.y
      this._state.ghost.idleBobOffset = this._physics.bobOffset(this._state.idleTimeMs);

      // Also scroll clouds during Idle_State for visual interest
      for (const cloud of this._state.clouds) {
        cloud.x -= cloud.speed * dtFactor;
        if (cloud.x + cloud.width < 0) {
          cloud.x = 480 + cloud.width;
        }
      }

    } else if (state === 'Menu_State') {
      // Scroll clouds in menu too
      for (const cloud of this._state.clouds) {
        cloud.x -= cloud.speed * dtFactor;
        if (cloud.x + cloud.width < 0) {
          cloud.x = 480 + cloud.width;
        }
      }

    } else if (state === 'Paused_State' || state === 'Game_Over_State') {
      // Skip all physics/movement updates — frozen
    }
  }

  /**
   * Performs state-transition side-effects.
   * @param {string} newState
   */
  _transitionTo(newState) {
    const fromState = this._state.current;
    this._previousState = fromState;

    switch (newState) {
      case 'Menu_State':
        // Just update current state — no resets needed
        this._state.current = 'Menu_State';
        break;

      case 'Idle_State':
        // Full reset: score, ghost, pipes, pipe speed, timers
        this._state.score = 0;
        this._state.ghost = createGhost(); // includes idleBobOffset: 0
        this._state.pipes = [];
        this._state.pipeSpeed = 3;
        this._state.pipesSinceSpeedUp = 0;
        this._state.idleTimeMs = 0;
        this._state.lastPipeX = null;
        this._state.current = 'Idle_State';
        break;

      case 'Playing_State':
        this._state.current = 'Playing_State';
        if (fromState === 'Idle_State' || fromState === 'Menu_State') {
          // Fresh start: apply the first flap impulse
          this._state.ghost = this._physics.applyFlap(this._state.ghost);
          this._state.ghost.rotation = this._physics.computeRotation(this._state.ghost.vy);
        }
        // If coming from Paused_State: just resume — no reset, no flap
        break;

      case 'Game_Over_State':
        this._state.current = 'Game_Over_State';
        // Play game-over sound exactly once
        this._audio.playGameOver();
        // Update and persist high score
        this._score.onGameOver(this._state);
        break;

      case 'Paused_State':
        // Freeze; do not alter score, ghost, or pipe positions
        this._state.current = 'Paused_State';
        break;

      default:
        console.warn(`GameStateManager: unknown state "${newState}"`);
        break;
    }
  }
}

// ---------------------------------------------------------------------------
// GameLoop — requestAnimationFrame driver
// ---------------------------------------------------------------------------

export class GameLoop {
  /**
   * @param {GameStateManager} gameStateManager
   * @param {object}           renderer
   * @param {HTMLCanvasElement} canvas
   * @param {CanvasRenderingContext2D} ctx
   */
  constructor(gameStateManager, renderer, canvas, ctx) {
    this._gsm = gameStateManager;
    this._renderer = renderer;
    this._canvas = canvas;
    this._ctx = ctx;
    this._rafId = null;
    this._lastTimestamp = null;
    this._tick = this._tick.bind(this);
  }

  /** Starts the requestAnimationFrame loop. */
  start() {
    this._lastTimestamp = performance.now();
    this._rafId = requestAnimationFrame(this._tick);
  }

  /** Cancels the pending requestAnimationFrame. */
  stop() {
    cancelAnimationFrame(this._rafId);
    this._rafId = null;
  }

  /**
   * Internal tick — computes deltaMs (clamped to 50 ms), delegates to
   * GameStateManager and Renderer.
   * @param {number} timestampMs
   */
  _tick(timestampMs) {
    let deltaMs = timestampMs - this._lastTimestamp;

    // Clamp to 50 ms to prevent physics tunnelling after tab was backgrounded
    if (deltaMs > 200) deltaMs = 50;

    const dtFactor = deltaMs / 16.667;
    this._lastTimestamp = timestampMs;

    this._gsm.tick(deltaMs);
    this._renderer.draw(this._gsm._state, this._canvas, this._ctx);

    this._rafId = requestAnimationFrame(this._tick);
  }
}

// ---------------------------------------------------------------------------
// Bootstrap — only runs in a browser context
// ---------------------------------------------------------------------------

if (typeof window !== 'undefined') {
  // Bootstrap — runs only in a browser context (task 1.4)
  const gameState = createGameState();

  // Seed the initial high score from persistent storage (Requirement 6.5)
  gameState.highScore = ScoreManager.loadHighScore();

  // Module-level scale variable updated by the resize handler (task 2.2)
  let scale = 1;

  // Grab the canvas element for sizing and rendering
  const canvas = document.getElementById('gameCanvas');

  /**
   * Resize handler — keeps canvas dimensions in sync with the viewport.
   * Updates the module-level scale variable on every call and regenerates clouds
   * to fill the new canvas dimensions.
   * Requirement 1.6
   */
  const onResize = () => {
    const result = CanvasScaler.resize(canvas, window.innerWidth);
    scale = result.scale;
    // Regenerate clouds to fit the new canvas dimensions
    gameState.clouds = generateClouds(canvas.width, canvas.height);
  };

  // Set initial canvas size immediately on page load
  onResize();

  // Keep canvas size in sync as the viewport changes
  window.addEventListener('resize', onResize);

  // Load ghost sprite; onerror leaves ghost.sprite as null (silent fallback)
  const ghostSprite = new Image();
  ghostSprite.onerror = () => {
    console.error('Failed to load asset: assets/ghosty.png — using fallback circle');
    // ghost.sprite remains null; Renderer will draw fallback circle
  };
  ghostSprite.onload = () => {
    gameState.ghost.sprite = ghostSprite;
  };
  // Begin loading — game loop starts regardless of completion
  ghostSprite.src = 'assets/ghosty.png';

  // Initialise AudioManager; errors are caught internally and logged
  const audioManager = new AudioManager();
  audioManager.init(); // intentionally not awaited — game loop starts regardless

  // --- Full integration wiring (task 15.1) ---
  // (gameState.highScore was already seeded above via ScoreManager.loadHighScore.)

  const ctx = canvas.getContext('2d');

  // Instantiate the state machine, injecting the pure engines and managers.
  const gameStateManager = new GameStateManager(gameState, PhysicsEngine, ScoreManager, audioManager);

  // Keep GameStateManager's logical canvas dims in sync. The game works in a
  // 480-wide logical space; the renderer multiplies by scale = canvas.width/480,
  // so the logical height is always 360 (480 * 0.75) regardless of canvas size.
  gameStateManager._canvasLogicalW = 480;
  gameStateManager._canvasLogicalH = 360;

  // Route semantic input actions into the state machine.
  const inputManager = new InputManager(canvas, (action) => {
    gameStateManager.handleAction(action);
  });
  inputManager.attach();

  // Create and start the requestAnimationFrame game loop.
  const gameLoop = new GameLoop(gameStateManager, Renderer, canvas, ctx);
  gameLoop.start();
}
