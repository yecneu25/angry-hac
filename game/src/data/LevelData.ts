// src/data/LevelData.ts
// Defines all level configurations: terrain blocks, enemies, birds available
//
// Coordinate system:
//   x   = world x (pixels from left edge)
//   y   = height of the BOTTOM EDGE of this block above the ground surface
//   w,h = width, height in pixels
//   angle = rotation in degrees (optional, default 0)
//
// Ground surface is at screenHeight - 60.
// So a block with y=0 sits right on the ground, y=40 floats 40px above ground.

export interface BlockDef {
  type: 'wood' | 'stone' | 'ice' | 'tnt';
  x: number;
  y: number;   // bottom edge height above ground (px)
  w: number;
  h: number;
  angle?: number;
}

export interface EnemyDef {
  x: number;
  y: number;   // bottom of enemy above ground (px). Enemy radius = 24px.
  type: 'normal' | 'armored';
  hp: number;
}

export interface BirdDef {
  type: 'hac';
}

export interface LevelDef {
  id: number;
  name: string;
  worldWidth: number;
  starScore: [number, number, number]; // 1★, 2★, 3★ thresholds
  birds: BirdDef[];
  blocks: BlockDef[];
  enemies: EnemyDef[];
}

// ─── Uniform element scaling ───────────────────────────────────────────────
/**
 * Returns a copy of `def` with every physical element enlarged by `s` while
 * keeping each structure where it stands on the map.
 *
 * Scaling naively (w/h/y only, x untouched) breaks the tuned spawn geometry:
 * widened blocks eat into the deliberate clearance gaps between neighbours
 * (e.g. level 3's approach TNT, 22px clear of the fortress floor, would
 * overlap it), and Matter shoves overlapping spawns apart, collapsing
 * structures at level start. Instead, blocks are grouped into clusters of
 * nearby footprints (gap ≤ 60px) and each cluster is scaled uniformly about
 * its own centre — every internal spacing, face overlap and clearance grows
 * by exactly `s`, so all the contact tuning documented below still holds,
 * while cluster centres (and therefore shot distances) stay put.
 */
export function scaleLevel(def: LevelDef, s: number): LevelDef {
  if (s === 1 || def.blocks.length === 0) return def;

  const spans = def.blocks
    .map(b => ({ l: b.x - b.w / 2, r: b.x + b.w / 2 }))
    .sort((a, b) => a.l - b.l);
  const clusters: { l: number; r: number }[] = [];
  for (const sp of spans) {
    const last = clusters[clusters.length - 1];
    if (last && sp.l <= last.r + 60) last.r = Math.max(last.r, sp.r);
    else clusters.push({ ...sp });
  }

  // Centre of the cluster containing x (or the nearest one).
  const centreFor = (x: number): number => {
    let best = clusters[0];
    let bestD = Infinity;
    for (const c of clusters) {
      const d = x < c.l ? c.l - x : x > c.r ? x - c.r : 0;
      if (d < bestD) { bestD = d; best = c; }
    }
    return (best.l + best.r) / 2;
  };

  return {
    ...def,
    blocks: def.blocks.map(b => {
      const cx = centreFor(b.x);
      return { ...b, x: cx + (b.x - cx) * s, y: b.y * s, w: b.w * s, h: b.h * s };
    }),
    enemies: def.enemies.map(e => {
      const cx = centreFor(e.x);
      return { ...e, x: cx + (e.x - cx) * s, y: e.y * s };
    }),
  };
}

// ─── Helper: build a simple tower at given x ──────────────────────────────
// Layers stacked bottom-to-top. Each layer provides y=0 baseline.

export const LEVELS: LevelDef[] = [
  // ══════════════════════════════════════════════════════════════
  // Level 1 — Bản Lĩnh Pha Lê
  // Simple two-tower layout. Tutorial difficulty.
  // ══════════════════════════════════════════════════════════════
  {
    id: 1,
    name: 'Bản Lĩnh Pha Lê',
    worldWidth: 2400,
    starScore: [1500, 3500, 5500],
    birds: [
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
    ],
    blocks: [
      // ── Tower A (x=900) ──
      // Floor platform (y=0..20)
      { type: 'wood',  x: 900, y: 0,  w: 100, h: 20 },
      // Left wall (y=20..100)
      { type: 'wood',  x: 860, y: 20, w: 20,  h: 80 },
      // Right wall
      { type: 'wood',  x: 940, y: 20, w: 20,  h: 80 },
      // Roof (y=100..120)
      { type: 'stone', x: 900, y: 100, w: 100, h: 20 },

      // ── Tower B (x=1650) — taller than Tower A (wall h=80→140, roof/enemy
      // shifted up by the same +60) so the level reads as a small→tall
      // progression like Angry Birds' staged skylines, instead of two
      // identical towers. Pushed far right of Tower A (was x=1100) so the
      // two targets spread across the world width instead of bunching
      // within the first third of it — only x translated, width and wall
      // spacing untouched, so the wall-floor/wall-roof contacts are still
      // the same full-face overlaps, not new corner touches. ──
      { type: 'wood',  x: 1650, y: 0,  w: 100, h: 20 },
      { type: 'wood',  x: 1610, y: 20, w: 20,  h: 140 },
      { type: 'wood',  x: 1690, y: 20, w: 20,  h: 140 },
      { type: 'stone', x: 1650, y: 160, w: 100, h: 20 },
    ],
    enemies: [
      // Sits on top of tower roof (roof top = y=120)
      { x: 900,  y: 120, type: 'normal', hp: 1 },
      // Tower B roof raised to y=180 (roof top = 160+20) to match its taller walls.
      { x: 1650, y: 180, type: 'normal', hp: 1 },
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // Level 2 — Thung Lũng Cực Quang
  // Wider layout, armored enemy, more blocks.
  // ══════════════════════════════════════════════════════════════
  {
    id: 2,
    name: 'Thung Lũng Cực Quang',
    worldWidth: 2800,
    starScore: [4000, 8000, 13000],
    birds: [
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
    ],
    blocks: [
      // ── Trigger crate — TNT sitting right in front of Tower A's base. Any
      // hit near it also catches the tower's left wall (TNT_RADIUS=150 in
      // GameScene), so a shot that's slightly short of clearing the wall
      // still pays off instead of just bouncing harmlessly off the ground. ──
      { type: 'tnt',   x: 770,  y: 0,   w: 44,  h: 44 },

      // ── Tower A (x=880) — now 2 tiers (was 1) so the level reads as more
      // built-up: the enemy moved from y=140 (on the original roof, which
      // is now a load-bearing mid-slab carrying tier-2's walls) up to the
      // new top roof at y=230. IMPORTANT: no enemy is ever placed on the
      // mid-slab at y=120/140 — see the level-2 sinking note preserved
      // below; that bug is about *total contact count* on one thin dynamic
      // slab (2 wall contacts + 1 enemy = 3), not exact overlap position,
      // so it would reproduce here too. Tier-2 reuses the exact wall
      // x-offsets (±55 from centre) and roof width (150) as tier-1, so
      // every new contact is the same full-face overlap pattern already
      // proven stable, just stacked one level higher.
      //
      // Material choice tapers heavy→light bottom→top on purpose, not just
      // for looks: an earlier version used stone (density 0.004) tier-2
      // walls over these same wood (0.001) tier-1 walls and the tower
      // collapsed under its own weight within a second of level start — the
      // ~17.6-mass load (mid-slab + stone walls + roof) on ~4-mass wood
      // supports buckled them, measured via rising block velocity in a
      // physics probe. Swapping tier-1 to stone (mass 8/wall) and keeping
      // tier-2 as wood (mass 1.4/wall, height trimmed 80→70) drops the
      // load-to-support ratio to ~0.5 — well inside the range the game's
      // other stone-roof-on-wood-wall towers already run at (~2.0, see
      // Level 1 Tower B) and it now sits still at level start. ──
      { type: 'stone', x: 880, y: 0,   w: 150, h: 20 },
      { type: 'stone', x: 825, y: 20,  w: 20,  h: 100 },
      { type: 'stone', x: 935, y: 20,  w: 20,  h: 100 },
      // Mid-slab: was the level's original roof. No battlements and no
      // enemy live here (see comment above) — three simultaneous contacts
      // (2 battlements + 1 enemy) on one thin dynamic slab was found to
      // break Matter's contact resolution for this engine version and sink
      // the enemy straight through over ~20 frames.
      { type: 'wood',  x: 880, y: 120, w: 150, h: 20 },
      { type: 'wood',  x: 825, y: 140, w: 20,  h: 70 },
      { type: 'wood',  x: 935, y: 140, w: 20,  h: 70 },
      { type: 'ice',   x: 880, y: 210, w: 150, h: 20 }, // top roof — enemy stands here only

      // ── Mid cluster 1 (x=1150) — a TNT crate and a guard sharing one
      // pedestal but NOT overlapping each other at spawn (11px clear gap),
      // so neither is displaced by the other on the first physics step.
      // Pedestal (120 wide) comfortably covers both the 46px crate and the
      // 52px-diameter enemy with margin on every edge. ──
      { type: 'wood',  x: 1150, y: 0,  w: 120, h: 20 },
      { type: 'tnt',   x: 1120, y: 20, w: 46,  h: 46 },

      // ── Midfield debris pile (x=1400) — unchanged, proven stable.
      // Pedestal must be at least as wide as the enemy resting on it (52px
      // diameter) — a 20px-wide pedestal is a knife-edge balance: the enemy
      // teeters and eventually rolls off/tips the pedestal on its own within
      // a couple of seconds, bleeding score with no shot fired.
      { type: 'wood',  x: 1400, y: 0,  w: 60, h: 20 },
      { type: 'wood',  x: 1400, y: 20, w: 56, h: 40 },

      // ── Mid cluster 2 (x=1700) — a short sentry pillar plus a standalone
      // TNT crate at its base (80px clear of the pedestal, within the
      // 150px blast radius so popping it can topple the pillar). ──
      { type: 'tnt',   x: 1620, y: 0,   w: 46, h: 46 },
      { type: 'stone', x: 1700, y: 0,   w: 70, h: 20 },
      { type: 'stone', x: 1700, y: 20,  w: 40, h: 90 },
      { type: 'ice',   x: 1700, y: 110, w: 70, h: 20 },

      // ── Tower B (x=2000) — unchanged tall tower (was the level's
      // finale); now flanked by a TNT crate on its left (130px from centre,
      // inside blast radius) and an extra armored guard on a separate
      // pedestal to its right, so it anchors a small 3-target finale
      // instead of standing alone. Only x/width/wall-spacing untouched on
      // the original tower, so the flat wall-floor and wall-roof contacts
      // are unaffected. ──
      { type: 'tnt',   x: 1870, y: 0,   w: 46,  h: 46 },
      { type: 'stone', x: 2000, y: 0,   w: 140, h: 20 },
      { type: 'stone', x: 1950, y: 20,  w: 20,  h: 170 },
      { type: 'stone', x: 2050, y: 20,  w: 20,  h: 170 },
      { type: 'ice',   x: 2000, y: 190, w: 140, h: 20 },
      { type: 'stone', x: 2130, y: 0,   w: 70,  h: 20 },
    ],
    enemies: [
      // IMPORTANT: enemy y must sit ON TOP of block surfaces, never inside a
      // block — overlapping spawns make Matter shove the structure apart and
      // the whole tower collapses by itself at level start.
      { x: 880,  y: 230, type: 'normal',  hp: 1 },  // Tower A top roof (top = 210+20)
      { x: 1180, y: 20,  type: 'normal',  hp: 1 },  // mid cluster 1 pedestal, clear of the TNT crate
      { x: 1400, y: 60,  type: 'normal',  hp: 1 },  // on debris column (top = 60)
      { x: 1700, y: 130, type: 'armored', hp: 2 },  // sentry pillar roof (top = 110+20)
      { x: 2000, y: 210, type: 'armored', hp: 2 },  // on tower B roof (top = 190+20)
      { x: 2130, y: 20,  type: 'armored', hp: 2 },  // extra pedestal beside tower B
    ],
  },

  // ══════════════════════════════════════════════════════════════
  // Level 3 — Đỉnh Núi Băng Giá
  // Ice fortress, all armored enemies, ramp deflector.
  // ══════════════════════════════════════════════════════════════
  {
    id: 3,
    name: 'Đỉnh Núi Băng Giá',
    worldWidth: 3400,
    starScore: [6000, 12000, 18000],
    birds: [
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
      { type: 'hac' },
    ],
    blocks: [
      // ── Approach TNT — standalone, well clear of the fortress floor
      // (22px gap to its left edge at x=1380) so it can't jostle the
      // fortress on the first physics step. Close enough (115px to the
      // fortress's left wall) to be inside the 150px blast radius. ──
      { type: 'tnt',   x: 1335, y: 0,   w: 46,  h: 46 },

      // ── Main fortress (x=1440..1640, was 840..1040) — whole complex below
      // (fortress + ramp + right cluster) shifted +600px right so it sits
      // further from the sling and uses more of the 3200-wide world instead
      // of bunching within the first third of it. This is a pure x
      // translation: every internal spacing/width/angle below is untouched,
      // so all the fragile contact tuning described in the comments still
      // holds exactly as before. ──
      // Outer walls
      // Floor widened to 270 (was 200/spanning 780-980) so it actually
      // reaches under the right wall AND the inner floor slab below — both
      // previously had no floor under part of their span and fell/tilted on
      // their own the instant physics started.
      { type: 'stone', x: 1515, y: 0,   w: 270, h: 20 },  // floor
      { type: 'stone', x: 1440, y: 20,  w: 20,  h: 140 }, // left wall
      { type: 'stone', x: 1640, y: 20,  w: 20,  h: 140 }, // right wall
      { type: 'ice',   x: 1540, y: 160, w: 200, h: 20 },  // roof
      // Inner dividing wall
      { type: 'wood',  x: 1540, y: 20,  w: 20,  h: 100 },
      // Floor slab inner
      { type: 'wood',  x: 1590, y: 20,  w: 80,  h: 15 },

      // ── Ramp deflector ──
      // Centred in the 90px gap between the fortress's right wall (edge at
      // x=1650) and the right cluster's left wall (edge at x=1740). At the
      // original w=80 the 28° tilt swings its rotated corners into
      // the fortress wall by ~10px — a real (if small) overlap that made
      // Matter's very first physics step shove the wall apart, collapsing
      // the whole fortress before the player could act. w=60 keeps
      // ~14px clearance on both sides.
      { type: 'wood',  x: 1695, y: 0,  w: 60, h: 20, angle: 28 },

      // ── Right cluster (x=1740..1940, was 1140..1340) ──
      // Floor must span both walls (1740 to 1940 = 200 wide, centred 1840) —
      // it was previously narrower, leaving the right wall with no floor
      // underneath it at all.
      { type: 'ice',   x: 1840, y: 0,   w: 200, h: 20 },
      { type: 'stone', x: 1750, y: 20,  w: 20,  h: 120 },
      { type: 'stone', x: 1930, y: 20,  w: 20,  h: 120 },
      // Roof width (was 160) must OVERLAP the walls' top faces, not just
      // meet their inner edges exactly. At w=160 the roof's edges land
      // exactly on the walls' own inner edges — so the "contact" is a
      // single corner-to-corner point with zero shared face area. Matter's
      // narrowphase can't resolve a stable resting contact from a
      // zero-area corner touch, so the roof (and everything on it) fell in
      // complete, unconstrained free fall from frame 1, crashing through
      // the inner block and then the floor below. w=180 gives a real 10px
      // overlap onto each wall's top face — the same margin the (stable)
      // main fortress roof uses on its own walls.
      { type: 'ice',   x: 1840, y: 140, w: 180, h: 20 },
      // Inner block
      { type: 'wood',  x: 1840, y: 20,  w: 60,  h: 60 },

      // ── Exit TNT — standalone past the right cluster's right wall (edge
      // at x=1940), 32px clear so it can't jostle the cluster at spawn but
      // still sits inside blast range of it. ──
      { type: 'tnt',   x: 1995, y: 0,   w: 46,  h: 46 },

      // ── Tower C (x=2300) — a third, fully independent structure further
      // out so the level doesn't end at the right cluster; same proven
      // single-tier floor/wall/wall/roof unit used throughout, entirely
      // separate from the fragile fortress+ramp+cluster combo above (no
      // shared contacts, so it carries zero risk to that tuning). A TNT
      // crate sits at its base (100px from centre, inside blast radius) and
      // a second guard stands on its own pedestal further out. ──
      { type: 'tnt',   x: 2200, y: 0,   w: 46,  h: 46 },
      { type: 'stone', x: 2300, y: 0,   w: 130, h: 20 },
      { type: 'ice',   x: 2255, y: 20,  w: 20,  h: 150 },
      { type: 'ice',   x: 2345, y: 20,  w: 20,  h: 150 },
      { type: 'stone', x: 2300, y: 170, w: 130, h: 20 },
      { type: 'stone', x: 2420, y: 0,   w: 70,  h: 20 },
    ],
    enemies: [
      // Enemies must never overlap blocks at spawn (see note in level 2).
      // Left chamber of fortress — standing on the floor slab (top = 20)
      { x: 1500, y: 20,  type: 'armored', hp: 2 },
      // Right chamber of fortress — standing on the inner slab (top = 35)
      { x: 1590, y: 35,  type: 'normal',  hp: 1 },
      // Right cluster — roof spans x:[1750,1930]. The old off-centre x pair
      // left the second enemy only 4px from the right wall; that off-centre
      // load tilted the roof enough to drop it onto the inner wood block
      // below with real velocity, which then destroyed the wood block and,
      // in the fall, both of the cluster's ice blocks too — a 100+80+80=260
      // point chain reaction with no shot fired. Centring both enemies
      // symmetrically (24px clearance each side) removes the tilt.
      { x: 1810, y: 160, type: 'armored', hp: 2 },
      { x: 1870, y: 160, type: 'armored', hp: 2 },
      // Tower C — on its own roof (top = 170+20) and a second guard on the
      // separate pedestal further out.
      { x: 2300, y: 190, type: 'armored', hp: 2 },
      { x: 2420, y: 20,  type: 'armored', hp: 2 },
    ],
  },
];
