# Requirements Document

## Introduction

Flappy Kiro is a browser-based endless scroller game inspired by Flappy Bird. The player controls a small ghost character (Kiro) that must navigate through gaps between vertically-paired green pipes scrolling from right to left. The game runs entirely in the browser using HTML, CSS, and JavaScript with no backend required. It features a retro, hand-drawn/sketchy art style with a light blue background, floating cloud shapes, and a dark score bar at the bottom. On page load, the game opens with a main menu showing the title, current High_Score, and a start prompt. The player taps, clicks, or presses the spacebar to make the ghost flap upward while gravity continuously pulls it downward. At any point during play the player may press P or Escape to pause and resume the game without losing progress. The game ends when the ghost collides with a pipe or leaves the screen bounds.

---

## Glossary

- **Game**: The browser-based Flappy Kiro application rendered inside a single HTML canvas element.
- **Ghost**: The player-controlled character sprite (`ghosty.png`) that moves through the game world.
- **Pipe**: A vertically-paired obstacle composed of a top pipe extending downward from the top of the screen and a bottom pipe extending upward from the bottom of the screen, with a gap between them.
- **Pipe_Gap**: The vertical opening between the top and bottom sections of a Pipe through which the Ghost must pass.
- **Pipe_Cap**: The wider rectangular cap element placed at the mouth of each pipe section.
- **Score**: The integer count of Pipes the Ghost has successfully passed through in the current session.
- **High_Score**: The highest Score achieved across all sessions, persisted in the browser's localStorage.
- **HUD**: The heads-up display bar at the bottom of the Game canvas showing the current Score and High_Score.
- **Game_Loop**: The continuous animation cycle that updates physics, moves objects, checks collisions, and redraws the canvas.
- **Menu_State**: The main menu displayed on page load, showing the game title, the current High_Score, and a "Press Space / Tap to Start" prompt.
- **Idle_State**: The state before the player has started the game — the Ghost bobs gently and pipes are not yet scrolling.
- **Playing_State**: The active game state where the Ghost is subject to gravity, pipes scroll leftward, and Score is tracked.
- **Paused_State**: A suspended game state entered from Playing_State, freezing all movement and showing a "Paused — Press P to Resume" overlay.
- **Game_Over_State**: The state entered when a collision is detected, freezing the game and displaying a restart prompt.
- **Flap**: A single upward velocity impulse applied to the Ghost in response to a player input event.
- **Gravity**: A constant downward acceleration applied to the Ghost on every Game_Loop tick during Playing_State.
- **Cloud**: A decorative, non-interactive rounded rectangle drawn on the background to evoke the sketchy art style.
- **Sketch_Background**: The light-blue, hand-drawn-style background with visible pencil-stroke texture drawn on the canvas.

---

## Requirements

### Requirement 1: Game Initialisation and Canvas Setup

**User Story:** As a player, I want the game to load immediately in my browser without installation, so that I can start playing right away.

#### Acceptance Criteria

1. THE Game SHALL render entirely within a single HTML5 canvas element embedded in an HTML page, requiring no server, build tool, or plugin.
2. WHEN the page begins loading, THE Game SHALL start loading the Ghost sprite (`assets/ghosty.png`), the jump sound (`assets/jump.wav`), and the game-over sound (`assets/game_over.wav`) before the first frame is drawn.
3. IF any asset fails to load, THEN THE Game SHALL log an error to the browser console and continue running with a fallback placeholder (a white circle for the Ghost, and silent audio for sounds).
4. WHEN the page finishes loading, THE Game SHALL initialise in Menu_State, displaying the title "Flappy Kiro", the current High_Score, and a "Press Space / Tap to Start" prompt.
5. THE Game SHALL scale the canvas to fit the browser viewport width up to a maximum of 1280 pixels while maintaining a 4:3 aspect ratio.
6. WHEN the browser window is resized, THE Game SHALL recalculate the canvas dimensions and all game element positions and sizes to match the new viewport width.

---

### Requirement 2: Sketch-Style Visual Rendering

**User Story:** As a player, I want the game to have a retro, hand-drawn aesthetic, so that it feels charming and distinctive.

#### Acceptance Criteria

1. THE Game SHALL draw the Sketch_Background as a light-blue filled rectangle covering the full canvas, with overlaid dark pencil-stroke lines to create a hand-drawn texture.
2. THE Game SHALL draw at least three and no more than six Clouds per screen width as off-white, slightly rounded rectangles positioned at varying heights within the upper 60% of the canvas in the background layer.
3. THE Game SHALL draw each Pipe as a dark-green filled rectangle body with a Pipe_Cap that is between 10% and 20% wider than the body on each side and filled with a visibly lighter shade of green than the body.
4. THE Game SHALL draw the Ghost using the `ghosty.png` sprite, scaled to exactly 32×32 logical pixels with no more than ±2 pixels deviation on either dimension.
5. THE Game SHALL draw the HUD as a semi-transparent bar at the bottom of the canvas with an opacity between 40% and 70%, containing white horizontally-centred text reading `Score: {Score} | High: {High_Score}`.
6. WHEN the Ghost flaps, THE Game SHALL rotate the Ghost sprite to between −20° and −30° from horizontal within one animation frame.
7. WHILE the Ghost is falling under gravity without flapping, THE Game SHALL gradually rotate the Ghost sprite from its current angle toward +90° from horizontal at a rate proportional to the Ghost's downward velocity, not exceeding +90°.

---

### Requirement 3: Physics and Ghost Movement

**User Story:** As a player, I want the ghost to respond to my inputs with satisfying, predictable physics, so that the game feels fair and fun.

#### Acceptance Criteria

1. WHILE in Playing_State, THE Game SHALL apply a constant Gravity acceleration of exactly 0.5 pixels per tick squared (at a 60 fps baseline) to the Ghost's vertical velocity on every Game_Loop tick.
2. WHEN the player presses the spacebar, clicks the canvas, or taps the canvas (touch), WHILE in Playing_State, THE Game SHALL apply a single upward Flap impulse setting the Ghost's vertical velocity to exactly −8 pixels per tick, regardless of the Ghost's current velocity direction.
3. THE Game SHALL clamp the Ghost's maximum downward velocity to exactly 12 pixels per tick so the Ghost does not accelerate infinitely.
4. THE Game SHALL accumulate the Ghost's vertical velocity frame-to-frame across consecutive Game_Loop ticks and SHALL NOT reset vertical velocity between ticks except when a Flap impulse is applied.
5. THE Game SHALL update the Ghost's vertical position using delta-time scaling so that the Ghost's motion speed remains consistent regardless of the actual frame rate.
6. WHEN the first Flap input is received WHILE in Idle_State, THE Game SHALL transition to Playing_State and simultaneously apply the Flap impulse.
7. WHILE in Idle_State, THE Game SHALL animate the Ghost with a sinusoidal vertical bobbing motion with an amplitude between 5 and 20 pixels and a period between 1 and 3 seconds.

---

### Requirement 4: Pipe Generation and Scrolling

**User Story:** As a player, I want a continuous stream of pipe obstacles to navigate, so that the game provides a lasting challenge.

#### Acceptance Criteria

1. WHILE in Playing_State, THE Game SHALL render each Pipe body with a width of exactly 52 pixels and each Pipe_Cap with a width of exactly 64 pixels and a height of exactly 16 pixels.
2. WHILE in Playing_State, THE Game SHALL scroll all Pipes leftward at an initial speed of exactly 3 pixels per Game_Loop tick at a 60 fps baseline.
3. WHEN the horizontal distance between the leading edges of consecutive Pipe pairs reaches 220 pixels, THE Game SHALL generate a new Pipe pair at the right edge of the canvas.
4. WHEN a new Pipe pair is generated, THE Game SHALL randomise the vertical centre position of its Pipe_Gap to a value between 150 pixels and (canvas height − 150) pixels from the top of the canvas, ensuring both Pipe_Caps remain fully visible.
5. THE Game SHALL maintain a Pipe_Gap height of exactly 150 pixels, constant across all Pipe pairs throughout a session.
6. WHEN the player has passed a multiple of 5 Pipe pairs, THE Game SHALL increase the scroll speed by exactly 0.3 pixels per tick, up to a maximum of 6 pixels per tick.
7. WHEN a Pipe pair's right edge has scrolled to x = −64 pixels, THE Game SHALL remove that Pipe pair from the active object list to free memory.
8. THE Game SHALL keep at most 6 Pipe pairs in the active object list at any one time.

---

### Requirement 5: Collision Detection

**User Story:** As a player, I want the game to detect when I hit a pipe or the screen boundary fairly and immediately, so that the outcome always feels correct.

#### Acceptance Criteria

1. WHEN the Ghost's axis-aligned bounding box overlaps the axis-aligned bounding box of any Pipe body or Pipe_Cap, THE Game SHALL transition to Game_Over_State.
2. WHEN the Ghost's top edge position is less than 0 pixels from the top of the canvas, THE Game SHALL transition to Game_Over_State.
3. WHEN the Ghost's bottom edge position is greater than or equal to the top edge of the HUD bar, THE Game SHALL transition to Game_Over_State.
4. THE Game SHALL apply a uniform inward hitbox margin of 4 pixels on all sides of the Ghost's sprite bounding box when performing collision checks.

---

### Requirement 6: Scoring

**User Story:** As a player, I want my score to increase each time I pass through a pipe gap, so that I have a clear measure of my progress.

#### Acceptance Criteria

1. WHEN the Ghost's horizontal centre crosses the horizontal centre of a Pipe pair, WHILE in Playing_State, THE Game SHALL increment the Score by exactly 1.
2. WHILE in Playing_State, THE Game SHALL display the current Score value in the HUD on every rendered frame.
3. WHEN the Game transitions to Game_Over_State, IF the current Score exceeds the stored High_Score, THEN THE Game SHALL set the High_Score to the current Score value.
4. WHEN the High_Score is updated, THE Game SHALL write the new High_Score value to localStorage under the key `flappyKiroHighScore`.
5. WHEN the Game initialises, THE Game SHALL read the High_Score from localStorage under the key `flappyKiroHighScore`, and IF no value is found, THE Game SHALL set the High_Score to 0.

---

### Requirement 7: Game Over and Restart

**User Story:** As a player, I want a clear game-over screen and an easy way to restart, so that I can immediately try to beat my high score.

#### Acceptance Criteria

1. WHEN the Game transitions to Game_Over_State, THE Game SHALL stop all Pipe scrolling and Ghost physics updates, and SHALL overlay a visible "Game Over" heading on the canvas.
2. WHEN the Game transitions to Game_Over_State, THE Game SHALL play the `game_over.wav` sound effect exactly once.
3. WHILE in Game_Over_State, THE Game SHALL display the final Score and the current High_Score within the overlay.
4. WHEN the current Score equals the new High_Score, WHILE in Game_Over_State, THE Game SHALL display a "New Best!" indicator within the overlay.
5. WHILE in Game_Over_State, THE Game SHALL display a "Press Space / Tap to Restart" instruction within the overlay.
6. WHEN the player presses the spacebar, clicks the canvas, or taps the canvas, WHILE in Game_Over_State, THE Game SHALL reset the Score to 0, return the Ghost to its starting position, remove all active Pipe pairs, and transition to Idle_State.

---

### Requirement 8: Audio Feedback

**User Story:** As a player, I want audio cues for my actions and game events, so that the game feels responsive and immersive.

#### Acceptance Criteria

1. WHEN the Ghost performs a Flap, WHILE in Playing_State, THE Game SHALL play the `jump.wav` sound effect.
2. WHEN a Flap input is received and the Ghost's current vertical velocity is at or above the maximum upward Flap velocity (i.e., already at the flap ceiling), THE Game SHALL NOT play the `jump.wav` sound effect.
3. WHEN the first user interaction event is received and the browser's AudioContext is in a suspended state, THE Game SHALL call `AudioContext.resume()` before attempting to play any sound.

---

### Requirement 9: Responsive Input Handling

**User Story:** As a player, I want to control the ghost using keyboard, mouse, or touch, so that the game works on both desktop and mobile browsers.

#### Acceptance Criteria

1. THE Game SHALL listen for `keydown` events and SHALL trigger a Flap WHEN the Space key is detected.
2. THE Game SHALL listen for `click` events on the canvas and SHALL trigger a Flap on each click.
3. THE Game SHALL listen for `touchstart` events on the canvas and SHALL trigger a Flap on each touch, preventing the default scroll behaviour.
4. THE Game SHALL ignore duplicate rapid inputs (within 100 ms of the previous Flap) to prevent unintended multi-flap behaviour on touch devices.

---

### Requirement 10: Performance

**User Story:** As a player, I want the game to run smoothly without frame drops, so that the experience is enjoyable and fair.

#### Acceptance Criteria

1. THE Game SHALL target 60 frames per second by driving the Game_Loop with `requestAnimationFrame`.
2. THE Game SHALL use delta-time scaling for all physics calculations so that movement speed remains consistent regardless of actual frame rate.
3. THE Game SHALL complete all canvas draw operations for a single frame within 16 ms on a modern mid-range device.

---

### Requirement 11: Pause Functionality

**User Story:** As a player, I want to be able to pause and resume the game at any time, so that I can take a break without losing my progress.

#### Acceptance Criteria

1. WHEN the player presses the P key or Escape key WHILE in Playing_State, THE Game SHALL transition to Paused_State and SHALL freeze all physics updates and Pipe scrolling.
2. WHILE in Paused_State, THE Game SHALL display a semi-transparent overlay containing the text "Paused" and the instruction "Press P / Esc to Resume".
3. WHEN the player presses the P key or Escape key WHILE in Paused_State, THE Game SHALL transition back to Playing_State and SHALL resume all physics updates and Pipe scrolling from their frozen positions.
4. WHILE in Paused_State, THE Game SHALL NOT process Flap inputs.
5. WHEN the Game transitions to Paused_State, THE Game SHALL NOT reset or alter the Score or any Pipe positions.
