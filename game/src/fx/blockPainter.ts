// Shared block-material renderer — the single source of truth for how
// wood / stone / ice / tnt blocks look. GameScene uses it for physics
// blocks; MainMenuScene uses it for the menu fortress vignette, so the
// menu structures are pixel-identical to their in-game counterparts.
import Phaser from 'phaser';

const WHITE      = 0xFFFFFF;
const GOLD       = 0xFFD87A;
const TNT_STRIPE = 0x1A1008;

/** Visual material table (mirrors GameScene's BLOCK_CONFIG fills/strokes). */
export const MATERIALS: Record<string, { fill: number; stroke: number }> = {
  wood:  { fill: 0xA0703A, stroke: 0x7A4E20 },
  stone: { fill: 0x5A6475, stroke: 0x3A4050 },
  ice:   { fill: 0x9BEAF8, stroke: 0x5AC8E8 },
  tnt:   { fill: 0xFF6A20, stroke: 0x1A1008 },
};

/** Deterministic PRNG (mulberry32) — block grain/facets must look the same
 *  every redraw (damage cracks redraw the whole block), not reroll randomly. */
export function seededRandom(seed: number): () => number {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shade(hex: number, amount: number): number {
  const c = Phaser.Display.Color.ValueToColor(hex);
  return (amount >= 0 ? c.lighten(amount) : c.darken(-amount)).color;
}

/**
 * Material-specific block rendering, drawn centred at (0,0). Wood gets grain
 * streaks, stone gets speckled granite + chisel cracks, ice gets faceted
 * crystal wedges, tnt gets its caution band + fuse. `seed` keeps the
 * procedural detail stable across redraws.
 */
export function paintBlock(
  gfx: Phaser.GameObjects.Graphics,
  w: number, h: number,
  type: string,
  hpRatio: number,
  seed: number,
) {
  const cfg   = MATERIALS[type];
  const rand  = seededRandom(seed);
  const alpha = 0.55 + 0.45 * hpRatio; // darken as damaged
  const x0 = -w / 2, y0 = -h / 2;

  gfx.clear();

  // Drop shadow
  gfx.fillStyle(0x000000, 0.25);
  gfx.fillRoundedRect(x0 + 3, y0 + 3, w, h, 4);

  // Base gradient fill (lighter top → darker bottom, per-material tint)
  const top = shade(cfg.fill, 18), bot = shade(cfg.fill, -14);
  gfx.fillGradientStyle(top, top, bot, bot, alpha);
  gfx.fillRoundedRect(x0, y0, w, h, 4);

  if (type === 'wood') {
    // Horizontal grain streaks, each a wobbly 3-segment line
    const lines = Math.max(2, Math.round(h / 22));
    for (let i = 0; i < lines; i++) {
      const gy = y0 + ((i + 0.5) / lines) * h + (rand() - 0.5) * 6;
      gfx.lineStyle(1.5, shade(cfg.fill, -30), 0.35 + rand() * 0.15);
      gfx.beginPath();
      gfx.moveTo(x0 + 2, gy);
      gfx.lineTo(x0 + w * 0.5, gy + (rand() - 0.5) * 5);
      gfx.lineTo(x0 + w - 2, gy);
      gfx.strokePath();
    }
    // Knots
    const knots = w > 40 ? 2 : 1;
    for (let i = 0; i < knots; i++) {
      const kx = x0 + w * (0.25 + rand() * 0.5);
      const ky = y0 + h * (0.25 + rand() * 0.5);
      const kr = Math.min(w, h) * 0.06;
      gfx.fillStyle(shade(cfg.fill, -35), 0.4);
      gfx.fillEllipse(kx, ky, kr * 2, kr * 1.3);
    }
  } else if (type === 'stone') {
    // Speckled granite grain
    const speckles = Math.round((w * h) / 120);
    for (let i = 0; i < speckles; i++) {
      const sx = x0 + 3 + rand() * (w - 6);
      const sy = y0 + 3 + rand() * (h - 6);
      const tone = rand() > 0.5 ? shade(cfg.fill, 22) : shade(cfg.fill, -25);
      gfx.fillStyle(tone, 0.35);
      gfx.fillCircle(sx, sy, 0.8 + rand() * 1.4);
    }
    // Chisel cracks
    gfx.lineStyle(1, shade(cfg.fill, -40), 0.4);
    for (let i = 0; i < 2; i++) {
      const sx = x0 + rand() * w, sy = y0 + rand() * h;
      gfx.lineBetween(sx, sy, sx + (rand() - 0.5) * w * 0.5, sy + (rand() - 0.5) * h * 0.5);
    }
  } else if (type === 'ice') {
    // Faceted crystal wedges: a fan of triangles from an off-centre core,
    // alternating light/dark like cut gem faces, plus one bright streak.
    const cx = x0 + w * (0.35 + rand() * 0.3);
    const cy = y0 + h * (0.35 + rand() * 0.3);
    const corners: [number, number][] = [
      [x0, y0], [x0 + w * 0.5, y0], [x0 + w, y0],
      [x0 + w, y0 + h * 0.5], [x0 + w, y0 + h],
      [x0 + w * 0.5, y0 + h], [x0, y0 + h], [x0, y0 + h * 0.5],
    ];
    corners.forEach(([px, py], i) => {
      const [nx, ny] = corners[(i + 1) % corners.length];
      const facetShade = i % 2 === 0 ? 14 : -10;
      gfx.fillStyle(shade(cfg.fill, facetShade), alpha * 0.9);
      gfx.fillTriangle(cx, cy, px, py, nx, ny);
    });
    gfx.lineStyle(1, WHITE, 0.5);
    corners.forEach(([px, py]) => gfx.lineBetween(cx, cy, px, py));
    // Specular streak
    gfx.lineStyle(2, WHITE, 0.6);
    gfx.lineBetween(x0 + w * 0.2, y0 + h * 0.2, x0 + w * 0.4, y0 + h * 0.35);
  } else if (type === 'tnt') {
    // Caution band + corner rivets read as an explosive crate at a
    // glance. (Diagonal hazard stripes were tried first but angled
    // lineBetween strokes overflow this block's own bounds and paint
    // across neighbouring blocks in a tightly packed stack — a flat band
    // stays exactly inside [x0,x0+w].)
    const bandH = Math.max(6, h * 0.26);
    gfx.fillStyle(TNT_STRIPE, 0.92);
    gfx.fillRect(x0, -bandH / 2, w, bandH);

    const rr = Math.max(2, Math.min(w, h) * 0.05);
    gfx.fillStyle(shade(cfg.fill, -30), 0.9);
    [[x0 + 5, y0 + 5], [x0 + w - 5, y0 + 5], [x0 + 5, y0 + h - 5], [x0 + w - 5, y0 + h - 5]]
      .forEach(([rx, ry]) => gfx.fillCircle(rx, ry, rr));

    // Fuse + spark poking out the top edge.
    gfx.lineStyle(3, 0x5A3018, 1);
    gfx.lineBetween(0, y0, 0, y0 - h * 0.22);
    gfx.fillStyle(GOLD, 1);
    gfx.fillCircle(0, y0 - h * 0.22, 3);
  }

  // Top-edge highlight
  gfx.lineStyle(2, WHITE, 0.15);
  gfx.lineBetween(x0 + 4, y0 + 2, x0 + w - 4, y0 + 2);

  // Stroke border
  gfx.lineStyle(2, cfg.stroke, 0.85);
  gfx.strokeRoundedRect(x0, y0, w, h, 4);

  // Crack overlay when badly damaged
  if (hpRatio < 0.5) {
    gfx.lineStyle(1, 0x000000, 0.55);
    gfx.lineBetween(x0 + w * 0.3, y0 + h * 0.2, x0 + w * 0.6, y0 + h * 0.8);
    gfx.lineBetween(x0 + w * 0.65, y0 + h * 0.15, x0 + w * 0.35, y0 + h * 0.7);
  }
}
