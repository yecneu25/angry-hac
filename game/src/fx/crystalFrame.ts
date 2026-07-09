// Shared crystal-frame UI renderer — the single source of truth for every
// content frame in the game (win/lose panel, loading box…).
//
// The frame border itself is the USER'S OWN ART, not procedural drawing:
//   • FRAME TỐI (ui_frame_dark) — the crisp crystal frame on near-black,
//     the DEFAULT everywhere: sits over a dimmed background so it pops;
//   • FRAME SÁNG (ui_frame_bright) — glow-heavy frame, kept for very
//     bright scenes.
// This module only adds a translucent night fill behind the art (text
// legibility), the header text, the ✕ close button and the crystal
// action buttons ("NÚT CHÍNH / NÚT PHỤ").
import Phaser from 'phaser';

const FR = {
  line:     0x8FE4FF,  // close-button stroke — bright ice
  lineSoft: 0x48D0F8,  // aurora cyan (glow passes)
  white:    0xFFFFFF,
  fill:     0x000C38,  // panel interior — deep night navy
  navyMid:  0x0030A0,  // button fill
  navyHi:   0x0040B0,  // button fill (hover)
};

/**
 * Draws a speaker/mute icon as vector shapes (never emoji). The 🔊/🔇 emoji
 * previously used for sound toggles rendered as a garbled "tofu" glyph on
 * real iOS Safari: our custom "Outfit" web font loads async (style.css
 * @import), and if a Text object is created before it finishes, canvas
 * fillText falls back to whatever font is available at that instant — which
 * can lack proper multi-codepoint emoji glyphs, baking in a broken shape
 * that never gets redrawn once the font arrives. A hand-drawn icon sidesteps
 * font-loading entirely and matches the crystal art style everywhere else.
 * Returns a Graphics object centred at (x, y); call again (or redraw) to
 * flip the muted state. */
export function drawSpeakerIcon(
  scene: Phaser.Scene, x: number, y: number, size: number,
  muted: boolean, color = 0xEAF8FF,
): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.setPosition(x, y);
  const s = size;
  // Speaker silhouette: rectangular body + trapezoid cone, one polygon.
  g.fillStyle(color, 1);
  g.fillPoints([
    new Phaser.Math.Vector2(-0.50 * s, -0.20 * s),
    new Phaser.Math.Vector2(-0.15 * s, -0.20 * s),
    new Phaser.Math.Vector2( 0.15 * s, -0.50 * s),
    new Phaser.Math.Vector2( 0.15 * s,  0.50 * s),
    new Phaser.Math.Vector2(-0.15 * s,  0.20 * s),
    new Phaser.Math.Vector2(-0.50 * s,  0.20 * s),
  ], true);

  if (muted) {
    g.lineStyle(Math.max(1.5, s * 0.11), color, 1);
    g.lineBetween(0.22 * s, -0.32 * s, 0.55 * s,  0.32 * s);
    g.lineBetween(0.22 * s,  0.32 * s, 0.55 * s, -0.32 * s);
  } else {
    g.lineStyle(Math.max(1.2, s * 0.08), color, 0.9);
    g.beginPath();
    g.arc(0.15 * s, 0, 0.24 * s, Phaser.Math.DegToRad(-42), Phaser.Math.DegToRad(42));
    g.strokePath();
    g.beginPath();
    g.arc(0.15 * s, 0, 0.40 * s, Phaser.Math.DegToRad(-35), Phaser.Math.DegToRad(35));
    g.strokePath();
  }
  return g;
}

export const FRAME_TEXT = {
  main: '#EAF8FF',
  soft: '#A8F8F8',
};

/** Where the crisp frame line sits inside each source image, measured
 *  pixel-wise (the art carries glow/black margins around the line, so the
 *  image must be drawn larger than the requested panel and offset so the
 *  LINE — not the bitmap — matches the panel rect). */
const FRAME_ART = {
  bright: { key: 'ui_frame_bright', lineW: 1064 / 1536, lineH: 610 / 1024, lineCY: 475 / 1024 },
  dark:   { key: 'ui_frame_dark',   lineW: 1365 / 1672, lineH: 740 / 941,  lineCY: 465 / 941  },
};

/** Cut-corner octagon path for a rect at (x,y,w,h) — used by the buttons. */
function octagon(x: number, y: number, w: number, h: number, cut: number) {
  return [
    new Phaser.Math.Vector2(x + cut,     y),
    new Phaser.Math.Vector2(x + w - cut, y),
    new Phaser.Math.Vector2(x + w,       y + cut),
    new Phaser.Math.Vector2(x + w,       y + h - cut),
    new Phaser.Math.Vector2(x + w - cut, y + h),
    new Phaser.Math.Vector2(x + cut,     y + h),
    new Phaser.Math.Vector2(x,           y + h - cut),
    new Phaser.Math.Vector2(x,           y + cut),
  ];
}

export interface CrystalPanelOpts {
  title?: string;
  subtitle?: string;
  /** CSS colour for the title text (defaults to ice white). */
  titleColor?: string;
  /** CSS colour of the title glow (defaults to aurora cyan). */
  titleGlow?: string;
  depth?: number;
  /** Pin to the camera (HUD/dialog layers in a scrolling scene). */
  screenSpace?: boolean;
  /** Interior opacity behind the frame art (raise over live gameplay). */
  fillAlpha?: number;
  /** 'dark' (FRAME TỐI, default) — the crisp crystal frame on near-black,
   *  meant to sit over a dimmed background so it reads as the focal point;
   *  'bright' (FRAME SÁNG) is the glow-heavy frame for very bright scenes. */
  variant?: 'bright' | 'dark';
  /** When set, renders the circled-✕ close button top-right. */
  onClose?: () => void;
  /** Title font size in px (default 34). Header offsets scale with it, so a
   *  smaller title also tucks the whole header up — used to fit the panel on
   *  short mobile-landscape viewports. */
  titleSize?: number;
}

export interface CrystalPanelHandle {
  /** Every visual created (safe tween targets — zones excluded). */
  objects: Phaser.GameObjects.GameObject[];
  /** y just below the header — lay content out from here. */
  contentTop: number;
  rect: { x: number; y: number; w: number; h: number };
}

/** Frames a panel with the frame art, its LINE rect centred at (cx, cy)
 *  spanning w×h. */
export function drawCrystalPanel(
  scene: Phaser.Scene,
  cx: number, cy: number, w: number, h: number,
  opts: CrystalPanelOpts = {},
): CrystalPanelHandle {
  const depth = opts.depth ?? 200;
  const x = cx - w / 2, y = cy - h / 2;
  const objects: Phaser.GameObjects.GameObject[] = [];

  // Translucent night fill behind the frame art, inset so it tucks under
  // the frame line instead of poking outside it.
  const g = scene.add.graphics().setDepth(depth);
  if (opts.screenSpace) g.setScrollFactor(0);
  g.fillStyle(FR.fill, opts.fillAlpha ?? 0.62);
  g.fillRoundedRect(x + 4, y + 4, w - 8, h - 8, 12);
  objects.push(g);

  // The frame art. Both variants now have a real alpha channel (transparent
  // bg), so only the glowing crystal line composites over the navy fill —
  // no black rectangle around the panel.
  const art = FRAME_ART[opts.variant ?? 'dark'];
  const displayW = w / art.lineW;
  const displayH = h / art.lineH;
  const img = scene.add.image(cx, cy + (0.5 - art.lineCY) * displayH, art.key)
    .setDisplaySize(displayW, displayH)
    .setDepth(depth);
  if (opts.screenSpace) img.setScrollFactor(0);
  objects.push(img);

  // ── Header ──────────────────────────────────────────────────────────────
  const tSize = opts.titleSize ?? 34;
  const hs    = tSize / 34; // header scale — shrinks the whole header together

  let contentTop = y + 24 * hs;
  if (opts.title) {
    const titleY = y + (opts.subtitle ? 46 : 42) * hs;
    const title = scene.add.text(cx, titleY, opts.title, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   `${tSize}px`,
      fontStyle:  'bold',
      color:      opts.titleColor ?? FRAME_TEXT.main,
    }).setOrigin(0.5, 0.5).setDepth(depth + 1)
      .setShadow(0, 0, opts.titleGlow ?? '#48D0F8', 16, true, true);
    if (opts.screenSpace) title.setScrollFactor(0);
    objects.push(title);

    contentTop = titleY + title.displayHeight / 2;
    if (opts.subtitle) {
      const sub = scene.add.text(cx, contentTop + 14 * hs, opts.subtitle.toUpperCase(), {
        fontFamily:    'Outfit, sans-serif',
        fontSize:      `${Math.round(14 * hs)}px`,
        fontStyle:     'bold',
        color:         FRAME_TEXT.soft,
        letterSpacing: 3,
      }).setOrigin(0.5, 0.5).setDepth(depth + 1).setAlpha(0.9);
      if (opts.screenSpace) sub.setScrollFactor(0);
      objects.push(sub);
      contentTop = sub.y + sub.displayHeight / 2;
    }
    contentTop += 16 * hs;
  }

  // ── Close button (circled ✕ in a rounded crystal square) ────────────────
  if (opts.onClose) {
    const bx = x + w - 36, by = y + 36, half = 21;
    const btn = scene.add.graphics().setDepth(depth + 2);
    if (opts.screenSpace) btn.setScrollFactor(0);
    objects.push(btn);
    const draw = (hover: boolean) => {
      const col = hover ? FR.white : FR.line;
      btn.clear();
      btn.fillStyle(FR.fill, hover ? 0.85 : 0.5);
      btn.fillRoundedRect(bx - half, by - half, half * 2, half * 2, 9);
      btn.lineStyle(5, FR.lineSoft, hover ? 0.4 : 0.22);
      btn.strokeRoundedRect(bx - half, by - half, half * 2, half * 2, 9);
      btn.lineStyle(2, col, 0.95);
      btn.strokeRoundedRect(bx - half, by - half, half * 2, half * 2, 9);
      btn.lineStyle(2, col, 0.95);
      btn.strokeCircle(bx, by, half * 0.62);
      const r = half * 0.28;
      btn.lineBetween(bx - r, by - r, bx + r, by + r);
      btn.lineBetween(bx - r, by + r, bx + r, by - r);
    };
    draw(false);

    const zone = scene.add.zone(bx, by, half * 2 + 8, half * 2 + 8)
      .setOrigin(0.5, 0.5)
      .setDepth(depth + 3)
      .setInteractive({ useHandCursor: true });
    if (opts.screenSpace) zone.setScrollFactor(0);
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout',  () => draw(false));
    zone.on('pointerdown', opts.onClose);
  }

  return { objects, contentTop, rect: { x, y, w, h } };
}

export interface CrystalButtonOpts {
  bh?: number;
  depth?: number;
  screenSpace?: boolean;
  /** Primary buttons ("NÚT CHÍNH") glow brighter than secondary ones. */
  primary?: boolean;
  fontSize?: number;
}

export interface CrystalButtonHandle {
  /** Visuals (bg + label). Alpha/scale tweens go here — never the zone. */
  container: Phaser.GameObjects.Container;
  zone: Phaser.GameObjects.Zone;
  text: Phaser.GameObjects.Text;
}

/** Elongated cut-corner crystal button, centred at (cx, cy). */
export function makeCrystalButton(
  scene: Phaser.Scene,
  cx: number, cy: number, bw: number,
  label: string,
  cb: () => void,
  opts: CrystalButtonOpts = {},
): CrystalButtonHandle {
  const bh      = opts.bh ?? 50;
  const depth   = opts.depth ?? 201;
  const primary = opts.primary ?? true;
  const cut     = bh * 0.40;
  const x0 = -bw / 2, y0 = -bh / 2;
  const pts = octagon(x0, y0, bw, bh, cut);

  const container = scene.add.container(cx, cy).setDepth(depth);
  if (opts.screenSpace) container.setScrollFactor(0);

  const bg = scene.add.graphics();
  const draw = (hover: boolean) => {
    bg.clear();
    bg.fillStyle(hover ? FR.navyHi : FR.navyMid, hover ? 0.92 : 0.60);
    bg.fillPoints(pts, true);
    // Glass sheen across the upper half
    bg.fillGradientStyle(FR.white, FR.white, FR.white, FR.white,
      hover ? 0.20 : 0.12, hover ? 0.20 : 0.12, 0, 0);
    bg.fillPoints(octagon(x0 + 3, y0 + 3, bw - 6, bh / 2, cut * 0.7), true);
    // Border: glow → core, brighter for primary/hover
    bg.lineStyle(7, FR.lineSoft, (primary ? 0.30 : 0.18) + (hover ? 0.14 : 0));
    bg.strokePoints(pts, true);
    bg.lineStyle(2, hover ? FR.white : FR.line, primary ? 0.95 : 0.8);
    bg.strokePoints(pts, true);
    // Facet ticks on the corner bevels — reads as cut crystal
    bg.lineStyle(1, FR.white, hover ? 0.6 : 0.4);
    bg.lineBetween(x0 + cut, y0, x0, y0 + cut);
    bg.lineBetween(x0 + bw - cut, y0, x0 + bw, y0 + cut);
  };
  draw(false);

  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Outfit, sans-serif',
    fontSize:   `${opts.fontSize ?? 18}px`,
    fontStyle:  'bold',
    color:      FRAME_TEXT.main,
  }).setOrigin(0.5, 0.5)
    .setShadow(0, 0, '#48D0F8', 10, true, true);

  container.add([bg, text]);

  const zone = scene.add.zone(cx, cy, bw, bh)
    .setOrigin(0.5, 0.5)
    .setDepth(depth + 4)
    .setInteractive({ useHandCursor: true });
  if (opts.screenSpace) zone.setScrollFactor(0);

  zone.on('pointerover', () => {
    draw(true);
    scene.tweens.add({ targets: container, scale: 1.05, duration: 110, ease: 'Power1' });
  });
  zone.on('pointerout', () => {
    draw(false);
    scene.tweens.add({ targets: container, scale: 1.0, duration: 110, ease: 'Power1' });
  });
  zone.on('pointerdown', cb);

  return { container, zone, text };
}
