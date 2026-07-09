// src/game.ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';

// Fixed design HEIGHT (900 — matches every desktop screenshot in this
// project). Used ONLY for touch devices (see isTouchDevice below). The
// WIDTH is deliberately NOT fixed: it's computed from the device's own
// aspect ratio (below) so the design rectangle's aspect always exactly
// matches the real screen's — Phaser's ScaleManager (mode: FIT) then scales
// that rectangle up/down as one uniform block with ZERO letterbox bars on
// either axis (a fixed 16:9 canvas let bars appear on landscape phones much
// wider than 16:9 — user: "khung xanh đỡ rộng" — since FIT always shows
// bars wherever the target rect's aspect doesn't match the viewport's).
// Bonus: a wider phone naturally gets a wider design width, i.e. more world
// visible horizontally — the exact thing the earlier camera intro-pan hack
// was working around, now solved structurally instead.
//
// Height stays fixed so every Y-axis calc across scenes (ground level, HUD
// bar height, anchorY, safe-area math) is completely unaffected — only the
// horizontal extent adapts.
//
// Desktop/mouse users are UNCHANGED: they keep the original RESIZE mode,
// which hands every scene the real (dynamic) window size and fills it edge
// to edge exactly as before this change — this is deliberately gated so
// nothing about the desktop experience moves.
const DESIGN_HEIGHT = 900;

// (pointer: coarse) is true for touch-primary devices (phone/tablet) and
// false for mouse/trackpad — unlike a width/height check, it can't be
// accidentally triggered by a desktop user just resizing their browser
// window down, so desktop always gets the RESIZE branch below.
//
// DEV-ONLY: ?touch=1 / ?touch=0 forces the branch — real touch emulation
// isn't reliable from plain headless CLI flags (no CDP session here), so
// this lets screenshot testing exercise the FIT branch deterministically.
// Stripped from the production build.
let isTouchDevice = window.matchMedia('(pointer: coarse)').matches;
if (import.meta.env.DEV) {
  const forced = new URLSearchParams(location.search).get('touch');
  if (forced === '1') isTouchDevice = true;
  if (forced === '0') isTouchDevice = false;
}

/** Current visible viewport, measured from the #app element's OWN rendered
 *  box rather than window.innerWidth/Height or visualViewport. Those two
 *  window-level APIs are reported by each BROWSER APP's own chrome-handling
 *  code — and on iOS, Safari (first-party, can collapse its address bar to
 *  near-nothing in landscape) vs third-party browsers like Chrome/Opera
 *  (always keep a top+bottom toolbar, no collapse) report meaningfully
 *  different numbers for the SAME physical screen (user: Safari renders
 *  full-screen, Chrome/Opera render a short/squat rectangle). #app's CSS
 *  size (100dvh via style.css, falling back to 100%) is computed by the
 *  SAME WebKit layout engine regardless of which app is hosting it, so
 *  measuring the DOM box directly is consistent across all of them. */
function getViewportSize(): { w: number; h: number } {
  const app = document.getElementById('app');
  if (app) {
    const r = app.getBoundingClientRect();
    if (r.width > 0 && r.height > 0) return { w: r.width, h: r.height };
  }
  const vv = window.visualViewport;
  return { w: vv?.width ?? window.innerWidth, h: vv?.height ?? window.innerHeight };
}

function buildConfig(touch: boolean): Phaser.Types.Core.GameConfig {
  const { w, h } = getViewportSize();
  // Clamped so a stray portrait boot (aspect < 1) or an absurdly ultra-wide
  // device can't produce a degenerate design width — the game's level/HUD
  // layout is tuned for landscape-ish aspects only.
  const deviceAspect = w / h;
  const DESIGN_WIDTH  = Math.round(DESIGN_HEIGHT * Phaser.Math.Clamp(deviceAspect, 1.3, 2.6));

  return {
    type: Phaser.AUTO,
    ...(touch
      ? {
          width:  DESIGN_WIDTH,
          height: DESIGN_HEIGHT,
          scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
        }
      : {
          width:  w,
          height: h,
          scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.CENTER_BOTH },
        }),
    parent: 'app',
    backgroundColor: '#000018',
    physics: {
      default: 'matter',
      matter: {
        debug: false,
        gravity: { x: 0, y: 1 },
        // Matter's default solver (positionIterations:6, velocityIterations:4,
        // constraintIterations:2) is tuned for simple scenes. Zero-gap stacked
        // towers need much stiffer contact resolution or they visibly sink/
        // separate on the very first physics step — this is Matter.js's
        // documented fix for "stacks collapsing on their own" (see
        // https://github.com/liabru/matter-js/wiki/Rendering, "Stability").
        positionIterations:   20,
        velocityIterations:   16,
        constraintIterations: 8,
        enableSleeping: true,
      }
    },
    scene: [BootScene, PreloadScene, MainMenuScene, LevelSelectScene, GameScene]
  };
}

/** Touch devices only: DESIGN_WIDTH is picked once at boot to match whatever
 *  orientation the phone was in at load. If the player then rotates
 *  mid-session (portrait boot → landscape play, or vice versa), that frozen
 *  aspect no longer matches the real viewport, so Scale.FIT starts padding
 *  letterbox bars on the new axis instead of the design rect actually
 *  matching the phone's new shape (user: rotating mid-game should make "khung
 *  dài ra theo" — the frame should lengthen right along with it).
 *
 *  Phaser's ScaleManager already listens to window resize itself and
 *  recalculates display scale on every rotation, but in FIT mode that never
 *  touches the underlying game/base size — only re-fits the same frozen
 *  rectangle into the new viewport. This listener recomputes DESIGN_WIDTH
 *  from the live aspect and pushes it in via scale.resize(), which also fires
 *  Phaser's own 'resize' event — the scenes' setupResizeHandler() (see
 *  GameScene/MainMenuScene/LevelSelectScene) picks that up and restarts
 *  themselves against the corrected width. */
function setupOrientationResize(game: Phaser.Game) {
  let settleTimer: number | undefined;
  const applyOrientation = () => {
    const { w, h } = getViewportSize();
    const deviceAspect = w / h;
    const newWidth = Math.round(DESIGN_HEIGHT * Phaser.Math.Clamp(deviceAspect, 1.3, 2.6));
    if (newWidth !== game.scale.width) {
      // setGameSize (not resize — that's for Scale.NONE only) also updates
      // displaySize's aspect ratio, which is what actually makes FIT re-fit
      // the new rectangle into the viewport with zero bars.
      game.scale.setGameSize(newWidth, DESIGN_HEIGHT);
    }
  };
  const onOrientationChange = () => {
    window.clearTimeout(settleTimer);
    // Mobile browser chrome (address bar collapse/expand on rotate) takes a
    // moment to settle — same race the boot-time double-rAF above guards
    // against — so wait it out before re-measuring.
    settleTimer = window.setTimeout(() => {
      requestAnimationFrame(() => requestAnimationFrame(applyOrientation));
    }, 120);
  };
  window.addEventListener('resize', onOrientationChange);
  window.addEventListener('orientationchange', onOrientationChange);
}

if (isTouchDevice) {
  // Wait a couple of animation frames before measuring the viewport and
  // booting. Reading window.innerWidth/Height synchronously at script-eval
  // time can catch mobile Safari mid-way through collapsing its address bar
  // on first paint, baking a wrong aspect ratio into the fixed design
  // resolution for the rest of the session (user report: two same-family
  // iPhones — XS Max vs 15 Pro Max — rendering differently, one overflowing
  // its frame and janky, the other correctly contained and smooth, from
  // this exact race). Two rAFs ≈ one settled layout/paint cycle; harmless
  // since BootScene's own loading screen already covers this brief gap.
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const game = new Phaser.Game(buildConfig(true));
    setupOrientationResize(game);
  }));
} else {
  new Phaser.Game(buildConfig(false));
}
