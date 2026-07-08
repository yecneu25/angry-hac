// src/scenes/GameScene.ts
import Phaser from 'phaser';
import { LEVELS, scaleLevel } from '../data/LevelData';
import type { LevelDef, BlockDef, EnemyDef } from '../data/LevelData';
import { attachSkyMotion } from '../fx/skyMotion';
import { paintBlock, shade } from '../fx/blockPainter';

// ── Colour palette (from design-system.md) ─────────────────────────────────
const C = {
  bg:         0x000018,
  ground:     0x000010,
  groundLine: 0x103050,
  cyan:       0x48D0F8,
  cyanSoft:   0xA8F8F8,
  navy:       0x001050,
  navyMid:    0x0030A0,
  pink:       0xFF8FA0,
  gold:       0xFFD87A,
  wood:       0xA0703A,
  woodDark:   0x7A4E20,
  stone:      0x5A6475,
  stoneDark:  0x3A4050,
  ice:        0x9BEAF8,
  iceDark:    0x5AC8E8,
  enemy:      0x28D870,
  enemyArmor: 0xD8B020,
  white:      0xFFFFFF,
  tnt:        0xFF6A20,
  tntDark:    0x7A1A00,
  tntStripe:  0x1A1008,
};

// Per-block material properties
const BLOCK_CONFIG: Record<string, {
  fill: number; stroke: number; density: number; hp: number; scorePerDestroy: number;
}> = {
  wood:  { fill: C.wood,  stroke: C.woodDark,  density: 0.001,  hp: 3,  scorePerDestroy: 100 },
  stone: { fill: C.stone, stroke: C.stoneDark,  density: 0.004,  hp: 6,  scorePerDestroy: 150 },
  ice:   { fill: C.ice,   stroke: C.iceDark,    density: 0.0008, hp: 2,  scorePerDestroy: 80  },
  // hp:1 — any qualifying collision (resolveHit already gates on spd>1.5)
  // detonates it instantly, same as a real TNT crate. Density matches wood
  // so it stacks/rests against wood/stone walls without throwing off the
  // mass ratios those contacts were tuned around.
  tnt:   { fill: C.tnt,   stroke: C.tntStripe, density: 0.001,  hp: 1,  scorePerDestroy: 50  },
};

// ── Internal runtime types ──────────────────────────────────────────────────
interface BlockRuntime {
  matterBody: MatterJS.BodyType;
  gfx: Phaser.GameObjects.Graphics;
  hp: number;
  maxHp: number;
  type: string;
  dead: boolean;
  w: number;   // stored for redraw on damage
  h: number;
  seed: number; // stable grain/facet pattern across damage redraws
  /** TNT crates get a "TNT" label synced alongside gfx; other types leave this unset. */
  label?: Phaser.GameObjects.Text;
}

interface EnemyRuntime {
  sprite: Phaser.Physics.Matter.Sprite;
  hp: number;
  maxHp: number;
  type: string;
  dead: boolean;
  /** 1 → 0 decay after a non-lethal hit — punches the HP bar for visible feedback. */
  hpPunch: number;
}

/** Global element size multiplier — blocks, bird, enemies, slingshot and the
 *  TNT blast radius are all enlarged by this factor while the map width,
 *  launch physics and background stay untouched. Bigger structures against
 *  the same launch arc and screen headroom = harder shots. Level geometry is
 *  scaled per-cluster in scaleLevel() so spawn-contact tuning is preserved. */
const ELEMENT_SCALE = 1.25;

// ── Scene ───────────────────────────────────────────────────────────────────
export class GameScene extends Phaser.Scene {
  private levelId  = 1;
  private levelDef!: LevelDef;
  private worldWidth = 2400;
  /** Camera zoom — was 0.88 (zoomed out for a wide establishing shot), but
   *  that shrank birds/blocks too far relative to the painterly background
   *  art. 1.0 keeps content at native scale so it reads clearly. */
  private readonly CAMERA_ZOOM = 1.0;

  // ── Slingshot ──────────────────────────────────────────────────────────────
  private anchorX!: number;
  private anchorY!: number;
  /** Was 120 — too weak to reach targets after levels were spread wider
   *  across the map (e.g. level 1's Tower B at x=1650, ~90px shy of the
   *  frictionless range at the old value once a mid-flight clip off Tower A
   *  bled off speed). Raised so full-power reaches every level's farthest
   *  target with room to spare; VEL_SCALE is unchanged so near-target aiming
   *  sensitivity (px/frame of speed per px of drag) is unaffected. */
  private readonly MAX_DRAG  = 210;

  private bird!: Phaser.Physics.Matter.Sprite;
  private birdGlow!:   Phaser.GameObjects.Image;
  private birdTrail!:  Phaser.GameObjects.Particles.ParticleEmitter;
  /** Directional wind-streak image trailing the bird while airborne. */
  private birdStreak!: Phaser.GameObjects.Image;
  private isDragging = false;
  private isLaunched = false;
  /** Birds remaining to be shot (decrements on each launch). */
  private birdsLeft  = 0;
  /** Velocity applied on last launch — used to sync trajectory preview. */
  private launchVX   = 0;
  private launchVY   = 0;
  /** Scale factor: drag distance → launch px/frame. At full MAX_DRAG drag → MAX_DRAG * 0.22 px/frame */
  private readonly VEL_SCALE = 0.22;
  /** Physics radii — visuals are scaled to match these exactly. Base values
   *  (24/26) are what LevelData clearances were tuned around; multiplying by
   *  ELEMENT_SCALE keeps them proportional to the scaled block geometry. */
  private readonly BIRD_RADIUS  = 24 * ELEMENT_SCALE;
  private readonly ENEMY_RADIUS = 26 * ELEMENT_SCALE;
  /** Frames the launched bird has been near-stationary (for turn reset). */
  private slowFrames = 0;
  /** Cooldown so a collapse cascade doesn't stack a dozen shakes in one frame. */
  private lastShakeAt = 0;
  /** Elastic-band "twang" after release — 1 → 0 tweened, read by drawSlingshot. */
  private slingWobble = 0;
  /** World coords of the sling sprite's two crystal fork tips — the elastic
   *  bands anchor here. Computed in create() from the art's measured tip
   *  positions (fractions of the NỎ.png cutout). */
  private slingTipL = { x: 0, y: 0 };
  private slingTipR = { x: 0, y: 0 };

  // ── Graphics layers ────────────────────────────────────────────────────────
  private gfxSling!:  Phaser.GameObjects.Graphics;
  private gfxTraj!:   Phaser.GameObjects.Graphics;
  private gfxHpBars!: Phaser.GameObjects.Graphics;

  // ── Game objects ──────────────────────────────────────────────────────────
  private blocks:  BlockRuntime[]  = [];
  private enemies: EnemyRuntime[]  = [];

  // ── HUD ───────────────────────────────────────────────────────────────────
  private score    = 0;
  private txtScore!: Phaser.GameObjects.Text;
  private txtBirds!: Phaser.GameObjects.Text;

  // ── State ─────────────────────────────────────────────────────────────────
  private resetTimer: Phaser.Time.TimerEvent | null = null;
  private gameEnded = false;

  constructor() { super('GameScene'); }

  // ══════════════════════════════════════════════════════════════════════════
  init(data: { level?: number }) {
    this.levelId    = data.level ?? 1;
    this.isDragging = false;
    this.isLaunched = false;
    this.blocks     = [];
    this.enemies    = [];
    this.score      = 0;
    this.gameEnded  = false;
    this.resetTimer = null;
    this.slowFrames = 0;
    this.slingWobble = 0;
    this.birdQueueIcons = [];  // reset icon refs between restarts
  }

  // ══════════════════════════════════════════════════════════════════════════
  create() {
    this.levelDef   = scaleLevel(LEVELS.find(l => l.id === this.levelId) ?? LEVELS[0], ELEMENT_SCALE);
    this.worldWidth = this.levelDef.worldWidth;

    const { width, height } = this.cameras.main;

    // ── Gravity: set scale explicitly so trajectory formula can read it back ──
    this.matter.world.setGravity(0, 1, 0.002);  // acc ≈ 0.556 px/frame² @60fps

    // ── World bounds ──────────────────────────────────────────────────────
    this.cameras.main.setBounds(0, 0, this.worldWidth, height);
    // Extra bottom clearance so falling objects exit cleanly
    this.matter.world.setBounds(0, -500, this.worldWidth, height + 600);

    this.cameras.main.setZoom(this.CAMERA_ZOOM);

    // ── Slingshot position anchor coordinates ─────────────────────────────
    // Set here (before createTerrain) so the terrain's launch-pad plateau
    // can be centred on it. anchorY raised (was height-240) so the bird
    // rests clearly above the fork tips and the bright water-splash terrain
    // decoration behind it, instead of sitting right in the middle of both.
    this.anchorX = 280;
    this.anchorY = height - 280;

    // ── Background ────────────────────────────────────────────────────────
    const bgKeys = ['bg_cover3', 'bg_cover2', 'bg_cover1'];
    const bgKey  = bgKeys[(this.levelId - 1) % bgKeys.length];
    const bg = this.add.image(this.worldWidth / 2, height / 2, bgKey)
      .setScrollFactor(0.2)
      .setDepth(0);
    // Divided by zoom so the art still fully covers the viewport at any
    // camera zoom level.
    bg.setScale(Math.max(this.worldWidth / bg.width, height / bg.height) / this.CAMERA_ZOOM);

    // ── Aurora drift + occasional lightning flash over the static sky art ──
    attachSkyMotion(this);

    // ── Atmosphere sparkles ───────────────────────────────────────────────
    this.add.particles(0, 0, 'fx_crystal', {
      x:         { min: 0,    max: this.worldWidth },
      y:         { min: 0,    max: height * 0.75 },
      speed:     { min: 4,    max: 18 },
      scale:     { start: 0.02, end: 0.08 },
      alpha:     { start: 0.15, end: 0.7 },
      lifespan:  5000,
      frequency: 180,
      blendMode: 'ADD',
    }).setScrollFactor(0.25).setDepth(1);

    // ── Terrain (ground + decoration) ─────────────────────────────────────
    this.createTerrain(height);

    // ── Graphics layers ───────────────────────────────────────────────────
    // Depth ordering: bg(0) → terrain(5-7) → blocks(10) → enemies(15) →
    //   trajectory(24) → sling(25) → bird(26) → hp-bars(40) → HUD(100+)
    // Bird must render ABOVE the sling — the fork's glow dots sit right at
    // the bird's resting height, so with sling drawn on top (as it used to
    // be) they painted straight over the bird's silhouette.
    this.gfxSling  = this.add.graphics().setDepth(25);

    // ── Slingshot sprite (obsidian trunk + sapphire crystal fork art) ──
    // Replaces the old procedural pole/fork drawing. Sized so the crystal
    // tips flank the bird resting at the anchor and the trunk plants into
    // the launch island below. Tip positions are fixed fractions of the
    // cutout, measured pixel-wise from the source art.
    {
      const tex     = this.textures.get('struct_sling').getSourceImage() as HTMLImageElement;
      const tipFrac = { lx: 0.14, rx: 0.86, y: 0.09 };
      const tipY    = this.anchorY - 6;
      const slingH  = ((height - 52) - tipY) / (1 - tipFrac.y); // trunk base ≈ ground line
      const slingW  = slingH * (tex.width / tex.height);
      this.add.image(this.anchorX, tipY - tipFrac.y * slingH, 'struct_sling')
        .setOrigin(0.5, 0)
        .setDisplaySize(slingW, slingH)
        .setDepth(24.8); // just under the band graphics (25) and bird (26)
      this.slingTipL = { x: this.anchorX + (tipFrac.lx - 0.5) * slingW, y: tipY };
      this.slingTipR = { x: this.anchorX + (tipFrac.rx - 0.5) * slingW, y: tipY };
    }
    this.gfxTraj   = this.add.graphics().setDepth(24);
    this.gfxHpBars = this.add.graphics().setDepth(40);

    // ── Bird crystal aura + flight trail (created once, repositioned per-frame) ──
    this.birdGlow = this.add.image(0, 0, 'fx_crystal')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(C.cyan)
      .setScale(0.16 * ELEMENT_SCALE)
      .setAlpha(0.5)
      .setDepth(21)
      .setVisible(false);
    this.tweens.add({
      targets: this.birdGlow, scale: 0.19 * ELEMENT_SCALE, alpha: 0.3,
      duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
    this.birdTrail = this.add.particles(0, 0, 'fx_crystal', {
      speed:     { min: 5,  max: 25 },
      scale:     { start: 0.05, end: 0.005 },
      alpha:     { start: 0.7,  end: 0 },
      lifespan:  400,
      frequency: 30,
      blendMode: 'ADD',
      tint:      C.cyanSoft,
    }).setDepth(22);
    this.birdTrail.stop();

    // Directional wind-streak — oriented to velocity each frame in update(),
    // origin biased toward the tail so it trails behind rather than centering
    // on the bird.
    this.birdStreak = this.add.image(0, 0, 'fx_smoke')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(C.cyanSoft)
      .setOrigin(0.8, 0.5)
      .setScale(0.09 * ELEMENT_SCALE)
      .setAlpha(0.5)
      .setDepth(22.5)
      .setVisible(false);

    // ── Level structures & enemies ────────────────────────────────────────
    this.buildLevel(height);

    // ── Bird queue ────────────────────────────────────────────────────────
    this.birdsLeft = this.levelDef.birds.length;

    // ── HUD ───────────────────────────────────────────────────────────────
    this.createHUD(width, height);

    // ── Spawn first bird ─────────────────────────────────────────────────
    this.spawnBird();

    // ── Input ─────────────────────────────────────────────────────────────
    this.setupInput();

    // ── Collision ─────────────────────────────────────────────────────────
    this.matter.world.on('collisionstart', this.onCollision, this);

    // ── Initial camera position: centre on slingshot ─────────────────────
    this.cameras.main.centerOn(this.anchorX + 300, this.anchorY);
  }

  // ══════════════════════════════════════════════════════════════════════════
  update() {
    if (this.gameEnded) return;

    // 1. Always redraw slingshot frame
    this.drawSlingshot();

    // 2. Monitor flying bird: detect stop / fall-off, spin to face velocity
    if (this.isLaunched && this.bird?.active) {
      const body = this.bird.body as MatterJS.BodyType;
      const spd  = Math.hypot(body.velocity.x, body.velocity.y);
      const outBottom = body.position.y > this.cameras.main.height + 400;
      const outRight  = body.position.x > this.worldWidth + 300;
      const outLeft   = body.position.x < -300;
      // Stopped: near-stationary for ~0.75s — anywhere, including resting on
      // top of a structure (a ground-only check used to stall the turn forever).
      this.slowFrames = spd < 0.6 ? this.slowFrames + 1 : 0;
      const stopped   = this.slowFrames > 45 && !this.resetTimer;

      if (outBottom || outRight || outLeft || stopped) {
        this.scheduleReset();
      }

      // Face the direction of travel — skip the rotate at near-zero speed so
      // the bird doesn't spin erratically while settling to a stop.
      if (spd > 0.5) {
        this.bird.rotation = Math.atan2(body.velocity.y, body.velocity.x);
      }
    }

    // 3. Crystal aura follows the bird everywhere; the flight trail and wind
    //    streak only show while it's actually airborne (isLaunched).
    if (this.bird?.active) {
      this.birdGlow.setPosition(this.bird.x, this.bird.y).setVisible(true);
      this.birdTrail.setPosition(this.bird.x, this.bird.y);
      if (this.isLaunched && !this.isDragging) {
        this.birdTrail.start();
        const body = this.bird.body as MatterJS.BodyType;
        const spd  = Math.hypot(body.velocity.x, body.velocity.y);
        const streakScaleX = Phaser.Math.Clamp(spd / 20, 0.5, 1.6) * 0.09;
        this.birdStreak
          .setPosition(this.bird.x, this.bird.y)
          .setRotation(this.bird.rotation)
          .setScale(streakScaleX, 0.07)
          .setVisible(spd > 1);
      } else {
        this.birdTrail.stop();
        this.birdStreak.setVisible(false);
      }
    } else {
      this.birdGlow.setVisible(false);
      this.birdTrail.stop();
      this.birdStreak.setVisible(false);
    }

    // 4. Redraw HP bars in world space (they scroll with camera)
    this.drawHpBars();

    // 5. Win / lose check every frame (safe: guarded by gameEnded flag)
    this.checkEndCondition();
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LEVEL BUILDING
  // ══════════════════════════════════════════════════════════════════════════

  private buildLevel(screenHeight: number) {
    const groundTop = screenHeight - 60; // y of the ground surface

    this.levelDef.blocks.forEach(def  => this.spawnBlock(def,  groundTop));
    this.levelDef.enemies.forEach(def => this.spawnEnemy(def, groundTop));
  }

  private spawnBlock(def: BlockDef, groundTop: number) {
    const cfg    = BLOCK_CONFIG[def.type];
    // def.y is height above ground surface (bottom edge of block)
    const worldY = groundTop - def.y - def.h / 2;

    const matterBody = this.matter.add.rectangle(
      def.x, worldY, def.w, def.h,
      {
        isStatic:    false,
        density:     cfg.density,
        friction:    0.6,
        frictionStatic: 1.0,
        frictionAir: 0.008,
        // Blocks are stacked touching edge-to-edge with zero gap. Any
        // restitution here makes the tiny float-precision contact overlap
        // that Matter resolves on the very first physics step bounce the
        // (very low-mass) blocks apart instead of just settling — that's
        // what was causing towers to collapse on their own at level start.
        restitution: 0,
        angle:       def.angle ? Phaser.Math.DegToRad(def.angle) : 0,
        label:       `block_${def.type}`,
      }
    );

    // Graphics drawn centred at (0,0), then repositioned via syncGfx each frame
    const gfx  = this.add.graphics().setDepth(10);
    const seed = (def.x * 73856093) ^ (def.y * 19349663) ^ (def.w * 83492791);
    this.drawBlockGfx(gfx, def.w, def.h, def.type, 1.0, seed);

    // TNT crates get a bold "TNT" label riding along with the crate.
    const label = def.type === 'tnt'
      ? this.add.text(0, 0, 'TNT', {
          fontFamily: 'Outfit, sans-serif',
          fontSize:   `${Math.max(11, Math.round(def.w * 0.28))}px`,
          fontStyle:  'bold',
          color:      '#FFF4D8',
        }).setOrigin(0.5, 0.5).setDepth(11)
          .setShadow(0, 0, '#1A1008', 3, false, true)
      : undefined;

    const syncGfx = () => {
      if (!gfx.active) return;
      gfx.x        = matterBody.position.x;
      gfx.y        = matterBody.position.y;
      gfx.rotation = matterBody.angle;
      if (label) {
        label.x        = matterBody.position.x;
        label.y        = matterBody.position.y;
        label.rotation = matterBody.angle;
      }
    };
    this.events.on('update', syncGfx);
    gfx.on('destroy', () => {
      this.events.off('update', syncGfx);
      label?.destroy();
    });

    const rec: BlockRuntime = {
      matterBody, gfx,
      hp: cfg.hp, maxHp: cfg.hp,
      type: def.type,
      dead: false,
      w: def.w, h: def.h,   // stored for damage-redraw
      seed,
      label,
    };
    (matterBody as any).__blockRef = rec;
    this.blocks.push(rec);
  }

  /** Material-specific block rendering — delegated to the shared painter
   *  (src/fx/blockPainter.ts) so the menu fortress uses the exact same
   *  wood/stone/ice/tnt treatment as in-game blocks. */
  private drawBlockGfx(
    gfx: Phaser.GameObjects.Graphics,
    w: number, h: number,
    type: string,
    hpRatio: number,
    seed: number,
  ) {
    paintBlock(gfx, w, h, type, hpRatio, seed);
  }

  private spawnEnemy(def: EnemyDef, groundTop: number) {
    const radius  = this.ENEMY_RADIUS;
    // def.y = height of enemy bottom above ground → place centre above that.
    // +2 nudges the circle 2px into whatever it's resting on. A circle
    // spawned exactly tangent to a flat surface (zero gap, zero overlap)
    // is a degenerate single-point contact for Matter's narrowphase — it
    // intermittently fails to detect it at all, so the enemy free-falls
    // straight through solid, perfectly stationary blocks over a few
    // frames. A couple of pixels of genuine overlap gives the solver an
    // unambiguous contact to push back against.
    const worldY  = groundTop - def.y - radius + 2;
    const isArmored = def.type === 'armored';

    const sp = this.matter.add.sprite(def.x, worldY, 'logo');
    // Matter's setScale also scales the physics body, so the visual scale
    // MUST be set before setCircle — otherwise the body shrinks to ~3px and
    // shots pass straight through the enemy.
    sp.setScale((radius * 2) / sp.height); // logo is 1237×969 → ~52px tall
    sp.setCircle(radius, {
      label:       `enemy_${def.type}`,
      // Mass must stay in the same order of magnitude as the blocks it
      // stands on (wood ≈1.6-2, stone ≈8 at these dimensions). The old
      // 0.006 density gave a ~12.7-mass enemy sitting on ~1.6-mass wood
      // walls — several times heavier than its own support — which made
      // the walls buckle and the whole tower collapse within the first
      // physics step, before the player could do anything.
      density:     0.0015,
      friction:    0.5,
      frictionStatic: 1.0,
      frictionAir: 0.02,
      restitution: 0,
    });
    sp.setStatic(false);
    sp.setDepth(15);
    sp.setTint(isArmored ? C.enemyArmor : C.enemy);

    const rec: EnemyRuntime = {
      sprite: sp, hp: def.hp, maxHp: def.hp, type: def.type, dead: false, hpPunch: 0,
    };
    // Attach ref to body (not sprite), so collision lookup works
    (sp.body as any).__enemyRef = rec;
    this.enemies.push(rec);
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SLINGSHOT & BIRD
  // ══════════════════════════════════════════════════════════════════════════

  private spawnBird() {
    if (this.birdsLeft <= 0) {
      this.scheduleEndGame(false);
      return;
    }

    this.bird = this.matter.add.sprite(this.anchorX, this.anchorY, 'logo');
    // Scale BEFORE setCircle — Matter setScale also scales the body.
    this.bird.setScale((this.BIRD_RADIUS * 2) / this.bird.height); // logo 1237×969 → ~52px
    this.bird.setCircle(this.BIRD_RADIUS, { label: 'bird' });
    this.bird.setBounce(0.4);
    this.bird.setFriction(0.04);
    this.bird.setFrictionAir(0.01);  // slight air drag for realistic arc
    this.bird.setStatic(true);       // static until player releases
    this.bird.setDepth(26);          // above the sling (25) — see depth note in create()
    this.bird.setTint(C.cyanSoft);

    this.isLaunched = false;
    this.slowFrames = 0;

    this.isDragging = false;
    this.launchVX   = 0;
    this.launchVY   = 0;
    if (this.resetTimer) { this.resetTimer.destroy(); this.resetTimer = null; }

    this.cameras.main.startFollow(this.bird, true, 0.04, 0.04);
    this.refreshHUD();
  }

  private setupInput() {
    this.input.on('pointerdown', (ptr: Phaser.Input.Pointer) => {
      if (this.isLaunched || this.gameEnded || !this.bird?.active) return;
      const d = Phaser.Math.Distance.Between(ptr.worldX, ptr.worldY, this.bird.x, this.bird.y);
      if (d < 65 * ELEMENT_SCALE) {
        this.isDragging = true;
        this.bird.setStatic(true);
        this.cameras.main.stopFollow();
      }
    });

    this.input.on('pointermove', (ptr: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;

      let dx = ptr.worldX - this.anchorX;
      let dy = ptr.worldY - this.anchorY;
      const dist = Math.hypot(dx, dy);
      if (dist > this.MAX_DRAG) {
        const ratio = this.MAX_DRAG / dist;
        dx *= ratio;
        dy *= ratio;
      }

      this.bird.setPosition(this.anchorX + dx, this.anchorY + dy);
      this.drawTrajectory(dx, dy);
    });

    this.input.on('pointerup', () => {
      if (!this.isDragging) return;
      this.isDragging  = false;
      this.isLaunched  = true;
      this.gfxTraj.clear();

      // Compute impulse velocity: opposite direction to drag, proportional to drag distance
      const body = this.bird.body as MatterJS.BodyType;
      const dx   = body.position.x - this.anchorX;
      const dy   = body.position.y - this.anchorY;
      const dist = Math.hypot(dx, dy);

      if (dist > 1) {
        // VEL_SCALE: at MAX_DRAG distance → LAUNCH_VEL px/frame
        const speed = (dist / this.MAX_DRAG) * (this.MAX_DRAG * this.VEL_SCALE);
        this.launchVX = (-dx / dist) * speed;
        this.launchVY = (-dy / dist) * speed;
      } else {
        this.launchVX = 0;
        this.launchVY = 0;
      }

      // Decrement bird count
      this.birdsLeft--;
      this.refreshHUD();

      // Apply velocity directly — no spring constraint needed.
      // setAwake() is required: the bird sits motionless at the slingshot
      // for a while (waiting for the player, plus the whole drag), so
      // Matter's sleep system (enableSleeping:true, needed for stable
      // towers) puts it to sleep. Neither setStatic(false) nor
      // setVelocity() wake a sleeping body — without this, the bird stays
      // frozen at the release point forever despite having a velocity.
      this.bird.setStatic(false);
      this.bird.setAwake();
      this.bird.setVelocity(this.launchVX, this.launchVY);

      // Camera follows the bird in flight
      this.cameras.main.startFollow(this.bird, true, 0.1, 0.1);

      this.playLaunchFlourish(this.bird.x, this.bird.y);

      // Elastic band "twang" — decays back to rest over 300ms.
      this.slingWobble = 1;
      this.tweens.add({
        targets: this, slingWobble: 0, duration: 300, ease: 'Sine.easeOut',
      });
    });
  }

  /** One-shot pha lê burst at the moment of release — the "whoosh" of launch. */
  private playLaunchFlourish(x: number, y: number) {
    const burst = this.add.particles(x, y, 'fx_crystal', {
      speed:     { min: 60, max: 200 },
      angle:     { min: 0,  max: 360 },
      scale:     { start: 0.08, end: 0.01 },
      alpha:     { start: 0.9,  end: 0 },
      lifespan:  350,
      blendMode: 'ADD',
      tint:      C.cyanSoft,
      emitting:  false,
    }).setDepth(23);
    burst.explode(16, x, y);
    this.time.delayedCall(400, () => burst.destroy());
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  DRAWING
  // ══════════════════════════════════════════════════════════════════════════

  private drawSlingshot() {
    this.gfxSling.clear();

    // Pole and forks live in the struct_sling sprite (see create()); only the
    // dynamic parts — band-anchor glow and the elastic bands — are drawn here.
    const bx = this.anchorX;
    const by = this.anchorY;
    const S  = ELEMENT_SCALE;
    const { x: lx, y: ly } = this.slingTipL;
    const { x: rx, y: ry } = this.slingTipR;

    // Soft glow where the bands anchor on the crystal tips
    this.gfxSling.fillStyle(C.cyan, 0.3);
    this.gfxSling.fillCircle(lx, ly, 8 * S);
    this.gfxSling.fillCircle(rx, ry, 8 * S);
    this.gfxSling.fillStyle(C.white, 0.35);
    this.gfxSling.fillCircle(lx, ly, 3 * S);
    this.gfxSling.fillCircle(rx, ry, 3 * S);

    // Elastic bands — visible when dragging or while bird is at the slingshot
    const birdVisible = this.bird?.active;
    if (birdVisible && (this.isDragging || !this.isLaunched)) {
      const bx2 = this.bird.x, by2 = this.bird.y;

      // Back band (behind bird)
      this.gfxSling.lineStyle(4, C.cyan, 0.7);
      this.gfxSling.lineBetween(lx, ly, bx2, by2);
      this.gfxSling.lineBetween(rx, ry, bx2, by2);

      // Front band highlight
      this.gfxSling.lineStyle(2, C.cyanSoft, 0.5);
      this.gfxSling.lineBetween(lx, ly, bx2, by2);
      this.gfxSling.lineBetween(rx, ry, bx2, by2);
    } else if (this.slingWobble > 0.01) {
      // Bird has flown off — the empty bands snap back and twang before resting.
      const wobble = Math.sin(this.slingWobble * Math.PI * 3) * this.slingWobble * 14;
      const tx = bx + wobble, ty = by - 2;

      this.gfxSling.lineStyle(4, C.cyan, 0.7 * this.slingWobble);
      this.gfxSling.lineBetween(lx, ly, tx, ty);
      this.gfxSling.lineBetween(rx, ry, tx, ty);

      this.gfxSling.lineStyle(2, C.cyanSoft, 0.5 * this.slingWobble);
      this.gfxSling.lineBetween(lx, ly, tx, ty);
      this.gfxSling.lineBetween(rx, ry, tx, ty);
    }
  }

  private drawTrajectory(dx: number, dy: number) {
    this.gfxTraj.clear();
    if (!this.isDragging || (dx === 0 && dy === 0)) return;

    // Exact same velocity formula as the actual launch (pointerup handler)
    const dist  = Math.hypot(dx, dy);
    const speed = (dist / this.MAX_DRAG) * (this.MAX_DRAG * this.VEL_SCALE);
    const vx    = (-dx / dist) * speed;  // opposite direction of drag
    const vy    = (-dy / dist) * speed;

    // ─── Gravity per frame (px/frame²) ──────────────────────────────────────
    // Matter.js Verlet integration adds to velocity each step:
    //   deltaV = gravity.y * gravity.scale * (deltaTime_ms)²
    // At 60fps, deltaTime_ms ≈ 16.67ms → acc ≈ 0.2779 px/frame²
    const localWorld = (this.matter.world as any).localWorld;
    const gravY      = localWorld.gravity.y   as number;
    const gravScale  = localWorld.gravity.scale as number ?? 0.001;
    const DT_MS      = 1000 / 60;  // fixed-step assumption
    const acc        = gravY * gravScale * DT_MS * DT_MS;  // ~0.278

    const sx = this.bird.x;
    const sy = this.bird.y;

    // Preview only shows the first stretch of the arc — deliberately shorter
    // than the actual flight (was 60 dots) so long shots require judging the
    // back half of the trajectory blind, instead of reading the full path
    // straight off the dotted line. Raises the skill ceiling on aiming.
    const TRAJECTORY_DOTS = 22;
    for (let i = 1; i <= TRAJECTORY_DOTS; i++) {
      const t  = i * 0.8;            // finer time step for smoother arc
      const px = sx + vx * t;
      const py = sy + vy * t + 0.5 * acc * t * t;

      // Stop drawing if below ground or off right edge
      if (py > this.cameras.main.height || px > this.worldWidth) break;

      const r  = Math.max(1.5, 5 - i * 0.06);
      const a  = Math.max(0.05, 0.9 - i * 0.014);
      this.gfxTraj.fillStyle(C.cyanSoft, a);
      this.gfxTraj.fillCircle(px, py, r);
    }
  }

  private drawHpBars() {
    this.gfxHpBars.clear();
    this.enemies.forEach(e => {
      if (e.dead || !e.sprite.active) return;
      const punch = e.hpPunch;
      const bw = 44 + punch * 6;
      const bh = 6;
      const bx = e.sprite.x - bw / 2;
      // Sit the bar a fixed margin above the (scaled) enemy's head.
      const by = e.sprite.y - (this.ENEMY_RADIUS + 16) - punch * 2;

      // Background track
      this.gfxHpBars.fillStyle(0x110000, 0.9);
      this.gfxHpBars.fillRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 3);

      const ratio = Math.max(0, e.hp / e.maxHp);
      const col   = ratio > 0.6 ? C.enemy : ratio > 0.3 ? C.gold : C.pink;
      this.gfxHpBars.fillStyle(col, 1);
      this.gfxHpBars.fillRoundedRect(bx, by, bw * ratio, bh, 3);

      // Brief bright outline pop on a fresh hit.
      if (punch > 0.05) {
        this.gfxHpBars.lineStyle(2, C.white, punch * 0.9);
        this.gfxHpBars.strokeRoundedRect(bx - 1, by - 1, bw + 2, bh + 2, 3);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  COLLISION & DAMAGE
  // ══════════════════════════════════════════════════════════════════════════

  private onCollision(event: Phaser.Physics.Matter.Events.CollisionStartEvent) {
    event.pairs.forEach(pair => {
      // Process each body as both striker and target
      this.resolveHit(pair.bodyA, pair.bodyB);
      this.resolveHit(pair.bodyB, pair.bodyA);
    });
  }

  private resolveHit(striker: MatterJS.BodyType, target: MatterJS.BodyType) {
    // Damage is proportional to striker speed
    const spd = Math.hypot(striker.velocity?.x ?? 0, striker.velocity?.y ?? 0);
    if (spd < 1.5) return;

    this.maybeShake(spd);

    const label = (target as any).label as string ?? '';

    if (label.startsWith('enemy_')) {
      const rec = (target as any).__enemyRef as EnemyRuntime | undefined;
      if (rec && !rec.dead) {
        // Birds deal 2× damage vs blocks
        const strikerLabel = (striker as any).label as string ?? '';
        const multiplier   = strikerLabel === 'bird' ? 2.0 : 1.0;
        this.damageEnemy(rec, Math.max(1, Math.floor(spd * multiplier)));
      }
    }

    if (label.startsWith('block_')) {
      const rec = (target as any).__blockRef as BlockRuntime | undefined;
      if (rec && !rec.dead) {
        this.damageBlock(rec, Math.max(1, Math.floor(spd * 0.5)));
      }
    }
  }

  /** Small screen shake on hard impacts — cooldown keeps a collapse cascade from stacking shakes. */
  private maybeShake(spd: number) {
    if (spd < 8) return;
    const now = this.time.now;
    if (now - this.lastShakeAt < 200) return;
    this.lastShakeAt = now;
    const intensity = Phaser.Math.Clamp(spd / 500, 0.003, 0.012);
    this.cameras.main.shake(140, intensity);
  }

  private damageEnemy(rec: EnemyRuntime, dmg: number) {
    rec.hp -= dmg;
    if (rec.hp <= 0) {
      rec.dead = true;
      this.killEnemy(rec);
    } else {
      // Flash red, then restore tint
      rec.sprite.setTint(C.pink);
      this.time.delayedCall(150, () => {
        if (rec.dead || !rec.sprite.active) return;
        rec.sprite.setTint(rec.type === 'armored' ? C.enemyArmor : C.enemy);
      });

      // Punch the HP bar so a non-lethal hit still reads as clear feedback.
      rec.hpPunch = 1;
      this.tweens.add({ targets: rec, hpPunch: 0, duration: 200, ease: 'Sine.easeOut' });
    }
  }

  private damageBlock(rec: BlockRuntime, dmg: number) {
    rec.hp -= dmg;
    if (rec.hp <= 0) {
      rec.dead = true;
      const x = rec.matterBody.position.x;
      const y = rec.matterBody.position.y;
      const isTnt = rec.type === 'tnt';
      this.matter.world.remove(rec.matterBody as any);
      rec.gfx.destroy(); // also destroys rec.label, see its 'destroy' handler
      this.addScore(BLOCK_CONFIG[rec.type].scorePerDestroy);

      if (isTnt) {
        this.explodeTnt(x, y);
      } else {
        this.spawnDebris(x, y, BLOCK_CONFIG[rec.type].fill);
        this.spawnShockwave(x, y, BLOCK_CONFIG[rec.type].fill);
        this.spawnImpactSmoke(x, y);
      }
      // Removing a block is not a collision, so anything that was resting
      // on it and had gone to sleep (enableSleeping:true) never gets a
      // wake signal — it just hovers in its last position instead of
      // falling. Force everything back awake so the now-unsupported
      // structure actually collapses.
      this.wakeAllPhysicsObjects();
    } else {
      // Redraw with damage cracks
      this.drawBlockGfx(rec.gfx, rec.w, rec.h, rec.type, rec.hp / rec.maxHp, rec.seed);
    }
  }

  /**
   * TNT area blast: instantly kills enemies and blasts blocks within
   * TNT_RADIUS, plus an outward physics impulse so debris and survivors
   * scatter instead of just vanishing/cracking in place. Reuses
   * damageBlock/damageEnemy for the actual damage, so a second TNT crate
   * caught in the radius chains into its own explosion for free (guarded
   * by each record's own `dead` flag against double-processing).
   */
  private readonly TNT_RADIUS = 170 * ELEMENT_SCALE; // scaled with the crates so blast reach stays proportional

  private explodeTnt(x: number, y: number) {
    this.addScore(300);
    this.spawnTntBlast(x, y);

    const R = this.TNT_RADIUS;

    // Snapshot arrays before iterating — explodeTnt can recurse into itself
    // via a chained TNT block's own damageBlock call, so we must not let a
    // nested call re-enter the same forEach over a mutating array.
    [...this.enemies].forEach(e => {
      if (e.dead || !e.sprite.active) return;
      const d = Phaser.Math.Distance.Between(x, y, e.sprite.x, e.sprite.y);
      if (d >= R) return;
      const body = e.sprite.body as MatterJS.BodyType;
      const ang  = Math.atan2(e.sprite.y - y, e.sprite.x - x);
      const push = (1 - d / R) * 0.028;
      this.matter.body.applyForce(body, body.position, { x: Math.cos(ang) * push, y: Math.sin(ang) * push - push * 0.5 });
      this.damageEnemy(e, 999); // anything caught in the blast dies outright
    });

    [...this.blocks].forEach(b => {
      if (b.dead) return;
      const bx = b.matterBody.position.x, by = b.matterBody.position.y;
      const d  = Phaser.Math.Distance.Between(x, y, bx, by);
      if (d >= R) return;
      const ang  = Math.atan2(by - y, bx - x);
      const push = (1 - d / R) * 0.08 * b.matterBody.mass;
      this.matter.body.applyForce(b.matterBody, b.matterBody.position, { x: Math.cos(ang) * push, y: Math.sin(ang) * push - push * 0.4 });
      const dmg = Math.ceil((1 - d / R) * 26); // close blocks are destroyed outright, far ones just cracked
      this.damageBlock(b, dmg);
    });
  }

  /** TNT detonation FX — deliberately bigger and warmer-toned than a regular
   *  block/enemy kill burst so a blast reads as "an explosion happened
   *  here" at a glance: a fast white flash, three staggered rings growing
   *  well past the normal kill-shockwave size, a wide fireball particle
   *  burst, a cluster of orange smoke, and a harder camera shake. */
  private spawnTntBlast(x: number, y: number) {
    const flash = this.add.graphics().setDepth(63);
    const fstate = { r: 6, a: 1 };
    const drawFlash = () => {
      flash.clear();
      flash.fillStyle(0xFFF6D8, fstate.a);
      flash.fillCircle(x, y, fstate.r);
    };
    drawFlash();
    this.tweens.add({
      targets: fstate, r: 90 * ELEMENT_SCALE, a: 0,
      duration: 180, ease: 'Cubic.easeOut',
      onUpdate: drawFlash,
      onComplete: () => flash.destroy(),
    });

    this.spawnShockwave(x, y, C.white, 60 * ELEMENT_SCALE);
    this.time.delayedCall(70,  () => { if (!this.gameEnded) this.spawnShockwave(x, y, C.tnt,  95 * ELEMENT_SCALE); });
    this.time.delayedCall(150, () => { if (!this.gameEnded) this.spawnShockwave(x, y, C.gold, 125 * ELEMENT_SCALE); });

    const burst = this.add.particles(x, y, 'fx_crystal', {
      speed:     { min: 120, max: 380 },
      angle:     { min: 0,   max: 360 },
      scale:     { start: 0.14, end: 0.01 },
      alpha:     { start: 1,    end: 0 },
      lifespan:  650,
      blendMode: 'ADD',
      tint:      [C.tnt, C.gold, 0xFFF6D8],
      emitting:  false,
    }).setDepth(64);
    burst.explode(36, x, y);
    this.time.delayedCall(700, () => burst.destroy());

    this.spawnImpactSmoke(x, y, C.tnt, 5);
    this.cameras.main.shake(300, 0.024);
  }

  /** See damageBlock: wakes every live body so a newly-unsupported stack actually falls. */
  private wakeAllPhysicsObjects() {
    this.blocks.forEach(b => {
      if (b.dead) return;
      (b.matterBody as any).isSleeping = false;
      (b.matterBody as any).sleepCounter = 0;
    });
    this.enemies.forEach(e => { if (!e.dead && e.sprite.active) e.sprite.setAwake(); });
  }

  private killEnemy(rec: EnemyRuntime) {
    const ex = rec.sprite.x;
    const ey = rec.sprite.y;
    rec.sprite.destroy();

    const pts = rec.type === 'armored' ? 2000 : 1000;
    this.addScore(pts);

    // Crystal burst particle explosion
    const burst = this.add.particles(ex, ey, 'fx_crystal', {
      speed:    { min: 80, max: 280 },
      angle:    { min: 0,  max: 360 },
      scale:    { start: 0.1, end: 0.01 },
      alpha:    { start: 1,   end: 0 },
      lifespan: 900,
      blendMode: 'ADD',
      emitting: false,
    }).setDepth(60);
    burst.explode(25, ex, ey);
    this.time.delayedCall(1000, () => burst.destroy());

    const color = rec.type === 'armored' ? C.enemyArmor : C.enemy;
    this.spawnShockwave(ex, ey, color);
    this.spawnImpactSmoke(ex, ey);
  }

  /** Expanding ring at a kill/destroy point — redrawn each tween step so its
   *  stroke stays a crisp fixed width instead of thickening with GameObject scale. */
  private spawnShockwave(x: number, y: number, color: number, maxRadius = 48) {
    const ring = this.add.graphics().setDepth(61);
    const state = { r: 4, a: 0.9 };
    const draw = () => {
      ring.clear();
      ring.lineStyle(3, color, state.a);
      ring.strokeCircle(x, y, state.r);
    };
    draw();
    this.tweens.add({
      targets: state, r: maxRadius, a: 0,
      duration: 300, ease: 'Cubic.easeOut',
      onUpdate: draw,
      onComplete: () => ring.destroy(),
    });
  }

  /** A couple of wispy smoke puffs radiating from an impact point. */
  private spawnImpactSmoke(x: number, y: number, tint = C.cyanSoft, count = 2) {
    for (let i = 0; i < count; i++) {
      const puff = this.add.image(x, y, 'fx_smoke')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setRotation(Phaser.Math.FloatBetween(0, Math.PI * 2))
        .setScale(0.05)
        .setAlpha(0.5)
        .setDepth(59);
      this.tweens.add({
        targets:  puff,
        scale:    0.05 * Phaser.Math.FloatBetween(2.6, 3.4),
        alpha:    0,
        duration: 450,
        ease:     'Sine.easeOut',
        onComplete: () => puff.destroy(),
      });
    }
  }

  /** Angular crystal-shard debris (was plain rectangles) + a brief sparkle burst. */
  private spawnDebris(x: number, y: number, color: number) {
    const edgeColor = shade(color, 40);
    for (let i = 0; i < 8; i++) {
      const chip = this.add.graphics().setDepth(12);
      const r     = Phaser.Math.Between(5, 12);
      const sides = Phaser.Math.Between(3, 5);
      const poly: Phaser.Math.Vector2[] = [];
      for (let s = 0; s < sides; s++) {
        const a  = (s / sides) * Math.PI * 2 + Phaser.Math.FloatBetween(-0.35, 0.35);
        const rr = r * Phaser.Math.FloatBetween(0.6, 1.15);
        poly.push(new Phaser.Math.Vector2(Math.cos(a) * rr, Math.sin(a) * rr));
      }
      chip.fillStyle(color, 0.95);
      chip.fillPoints(poly, true);
      chip.lineStyle(1, edgeColor, 0.7);
      chip.strokePoints(poly, true);

      chip.x = x + Phaser.Math.Between(-25, 25);
      chip.y = y + Phaser.Math.Between(-15, 10);
      this.tweens.add({
        targets:  chip,
        y:        chip.y + Phaser.Math.Between(40, 100),
        x:        chip.x + Phaser.Math.Between(-30, 30),
        angle:    Phaser.Math.Between(-180, 180),
        alpha:    0,
        duration: Phaser.Math.Between(450, 900),
        ease:     'Cubic.easeIn',
        onComplete: () => chip.destroy(),
      });
    }

    // Brief additive sparkle at the shatter point
    const sparkle = this.add.particles(x, y, 'fx_crystal', {
      speed:     { min: 40, max: 140 },
      angle:     { min: 0,  max: 360 },
      scale:     { start: 0.06, end: 0.005 },
      alpha:     { start: 0.9,  end: 0 },
      lifespan:  500,
      blendMode: 'ADD',
      emitting:  false,
    }).setDepth(13);
    sparkle.explode(10, x, y);
    this.time.delayedCall(600, () => sparkle.destroy());
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  SCORE
  // ══════════════════════════════════════════════════════════════════════════

  private addScore(pts: number) {
    this.score += pts;
    if (this.txtScore) this.txtScore.setText(`${this.score}`);

    // Floating "+points" text near score impact
    const wx = this.bird?.active ? this.bird.x : this.cameras.main.scrollX + this.cameras.main.width / 2;
    const wy = this.bird?.active ? this.bird.y - 40 : this.cameras.main.scrollY + 80;
    const pop = this.add.text(wx, wy, `+${pts}`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '24px',
      fontStyle:  'bold',
      color:      '#FFD87A',
    }).setOrigin(0.5, 1).setDepth(110).setScrollFactor(1);
    this.tweens.add({
      targets:  pop,
      y:        wy - 70,
      alpha:    0,
      duration: 1300,
      ease:     'Cubic.easeOut',
      onComplete: () => pop.destroy(),
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  WIN / LOSE
  // ══════════════════════════════════════════════════════════════════════════

  private checkEndCondition() {
    if (this.gameEnded) return;
    const aliveCount = this.enemies.filter(e => !e.dead).length;
    if (this.enemies.length > 0 && aliveCount === 0) {
      // All enemies dead → WIN!
      // Add bonus for remaining birds (including the one currently in slingshot)
      const birdsBonus = (this.birdsLeft + (this.isLaunched ? 0 : 1)) * 500;
      this.score += birdsBonus;
      if (this.txtScore) this.txtScore.setText(`${this.score}`);
      this.scheduleEndGame(true);
    }
  }

  private scheduleEndGame(wonHint: boolean) {
    if (this.gameEnded) return;
    this.gameEnded = true;
    // Re-evaluate at fire time: the last shot may still be toppling blocks
    // onto the remaining enemies while the panel delay runs.
    this.time.delayedCall(wonHint ? 1600 : 1400, () => {
      const won = this.enemies.length > 0 && this.enemies.every(e => e.dead);
      this.showEndPanel(won);
    });
  }

  private showEndPanel(won: boolean) {
    const { width, height } = this.cameras.main;
    /** Everything created here fades in together. */
    const fadeIn: Phaser.GameObjects.GameObject[] = [];

    // All UI is in SCREEN-SPACE (setScrollFactor(0)) so it doesn't move with camera
    // Overlay
    const overlay = this.add.graphics().setDepth(200).setScrollFactor(0);
    overlay.fillStyle(0x000018, 0.78);
    overlay.fillRect(0, 0, width, height);
    fadeIn.push(overlay);

    // Panel — centred on screen
    const panelW = Math.min(420, width - 40);
    const panelH = 320;
    const px     = (width  - panelW) / 2;
    const py     = (height - panelH) / 2;

    const panel = this.add.graphics().setDepth(201).setScrollFactor(0);
    fadeIn.push(panel);
    panel.fillStyle(C.navy, 0.97);
    panel.lineStyle(3, won ? C.cyan : C.pink, 1);
    panel.fillRoundedRect(px, py, panelW, panelH, 18);
    panel.strokeRoundedRect(px, py, panelW, panelH, 18);

    // Glow border
    panel.lineStyle(6, won ? C.cyan : C.pink, 0.15);
    panel.strokeRoundedRect(px - 3, py - 3, panelW + 6, panelH + 6, 21);

    const midX = px + panelW / 2;

    // Title
    const titleStr = won ? '✨ THẮNG RỒI! ✨' : '💀 THẤT BẠI';
    fadeIn.push(this.add.text(midX, py + 52, titleStr, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   won ? '36px' : '32px',
      fontStyle:  'bold',
      color:      won ? '#A8F8F8' : '#FF8FA0',
    }).setOrigin(0.5, 0.5).setDepth(202).setScrollFactor(0)
      .setShadow(0, 0, won ? '#48D0F8' : '#FF8FA0', 18, true, true));

    // Stars — each pops in with a scale-bounce, staggered after the panel
    // fade so they read as a little celebratory sequence rather than a
    // static string appearing all at once.
    if (won) {
      const [t1, t2, t3] = this.levelDef.starScore;
      const stars  = this.score >= t3 ? 3 : this.score >= t2 ? 2 : this.score >= t1 ? 1 : 0;
      const starY  = py + 120;
      const spacing = 54;
      for (let i = 0; i < 3; i++) {
        const filled = i < stars;
        const sx = midX + (i - 1) * spacing;
        const starTxt = this.add.text(sx, starY, filled ? '★' : '☆', {
          fontFamily: 'Outfit, sans-serif',
          fontSize:   '44px',
          color:      filled ? '#FFD87A' : '#3A5A78',
        }).setOrigin(0.5, 0.5).setDepth(202).setScrollFactor(0).setScale(0);

        const delay = 300 + i * 180;
        this.tweens.add({
          targets: starTxt, scale: filled ? [0, 1.35, 1] : 1,
          duration: filled ? 420 : 200, delay, ease: 'Back.easeOut',
        });
        if (filled) {
          this.time.delayedCall(delay + 60, () => {
            const pop = this.add.particles(sx, starY, 'fx_crystal', {
              speed: { min: 30, max: 100 }, angle: { min: 0, max: 360 },
              scale: { start: 0.05, end: 0.005 }, alpha: { start: 1, end: 0 },
              lifespan: 500, blendMode: 'ADD', emitting: false,
            }).setDepth(203).setScrollFactor(0);
            pop.explode(14, sx, starY);
            this.time.delayedCall(600, () => pop.destroy());
          });
        }
      }
      this.saveProgress(stars);
    }

    // Score
    fadeIn.push(this.add.text(midX, py + 178, `Điểm: ${this.score}`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '22px',
      color:      '#A8F8F8',
    }).setOrigin(0.5, 0.5).setDepth(202).setScrollFactor(0));

    // Buttons (positions in screen-space)
    const btnY  = py + 258;
    const btnW  = 155;
    const gap   = 20;
    const totalW = btnW * 2 + gap;
    const startX = (width - totalW) / 2 + btnW / 2;

    this.makeScreenButton(startX,      btnY, 'CHƠI LẠI', btnW, () => this.scene.restart({ level: this.levelId }));
    this.makeScreenButton(startX + btnW + gap, btnY, 'BẢN ĐỒ',  btnW, () => this.scene.start('LevelSelectScene'));

    // Fade the panel in so it doesn't pop harshly over the action
    fadeIn.forEach(obj => (obj as unknown as { alpha: number }).alpha = 0);
    this.tweens.add({ targets: fadeIn, alpha: 1, duration: 280, ease: 'Sine.easeOut' });

    // Confetti
    if (won) this.spawnConfetti(width, height);
  }

  /** Creates a button entirely in screen-space (scrollFactor 0). */
  private makeScreenButton(cx: number, cy: number, label: string, bw: number, cb: () => void) {
    const bh = 46;
    const depthBase = 202;

    // Graphics for button background — in screen space
    const bg = this.add.graphics().setDepth(depthBase).setScrollFactor(0);
    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x0050C0 : C.navyMid, hover ? 1 : 0.88);
      bg.lineStyle(2, hover ? C.cyanSoft : C.cyan, 1);
      bg.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 10);
      bg.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 10);
    };
    drawBg(false);

    this.add.text(cx, cy, label, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '17px',
      fontStyle:  'bold',
      color:      '#A8F8F8',
    }).setOrigin(0.5, 0.5).setDepth(depthBase + 1).setScrollFactor(0);

    // Interactive zone — screen space, so world x/y = screen x/y when scrollFactor=0
    const zone = this.add.zone(cx, cy, bw, bh)
      .setOrigin(0.5, 0.5)
      .setScrollFactor(0)
      .setDepth(depthBase + 5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover',  () => drawBg(true));
    zone.on('pointerout',   () => drawBg(false));
    zone.on('pointerdown',  cb);
  }

  private spawnConfetti(screenW: number, screenH: number) {
    const colors = [C.cyan, C.gold, C.pink, C.cyanSoft, C.white, 0xC084FC];
    for (let i = 0; i < 70; i++) {
      const chip = this.add.graphics().setDepth(210).setScrollFactor(0);
      chip.fillStyle(colors[i % colors.length], 1);
      const cw = Phaser.Math.Between(5, 12);
      const ch = Phaser.Math.Between(4, 9);
      chip.fillRect(0, 0, cw, ch);
      chip.x = Phaser.Math.Between(0, screenW);
      chip.y = Phaser.Math.Between(-80, -5);
      this.tweens.add({
        targets:  chip,
        y:        screenH + 30,
        x:        chip.x + Phaser.Math.Between(-100, 100),
        angle:    Phaser.Math.Between(-720, 720),
        alpha:    { from: 1, to: 0 },
        duration: Phaser.Math.Between(1800, 3500),
        ease:     'Sine.easeIn',
        delay:    Phaser.Math.Between(0, 1000),
        onComplete: () => chip.destroy(),
      });
    }
  }

  private saveProgress(stars: number) {
    try {
      const raw  = localStorage.getItem('angry_hac_progress');
      const prog = raw ? JSON.parse(raw) : {};
      if (!Array.isArray(prog.unlocked)) prog.unlocked = [true, false, false];
      if (!Array.isArray(prog.stars))    prog.stars    = [0, 0, 0];
      const idx  = this.levelId - 1;
      prog.stars[idx] = Math.max(prog.stars[idx] ?? 0, stars);
      if (this.levelId < LEVELS.length) prog.unlocked[this.levelId] = true;
      localStorage.setItem('angry_hac_progress', JSON.stringify(prog));
    } catch (_) { /* ignore */ }
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TURN RESET (bird has landed / gone off-screen)
  // ══════════════════════════════════════════════════════════════════════════



  private scheduleReset() {
    if (this.resetTimer || this.gameEnded) return;
    this.resetTimer = this.time.delayedCall(1400, () => this.doReset());
  }

  private doReset() {
    this.resetTimer = null;
    if (this.bird?.active) this.bird.destroy();
    this.cameras.main.stopFollow();
    // Smoothly pan back to slingshot area
    this.cameras.main.pan(this.anchorX + 300, this.anchorY, 950, 'Sine.easeInOut');
    this.time.delayedCall(1000, () => {
      if (!this.gameEnded) this.spawnBird();
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  HUD
  // ══════════════════════════════════════════════════════════════════════════

  private createHUD(width: number, height: number) {
    // Top bar — screen space
    const hudBg = this.add.graphics().setDepth(100).setScrollFactor(0);
    hudBg.fillStyle(C.navy, 0.82);
    hudBg.fillRect(0, 0, width, 64);
    hudBg.lineStyle(1, C.cyan, 0.35);
    hudBg.lineBetween(0, 64, width, 64);

    // Level name — centre
    this.add.text(width / 2, 32, `ẢI ${this.levelId} – ${this.levelDef.name}`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '19px',
      fontStyle:  'bold',
      color:      '#A8F8F8',
    }).setOrigin(0.5, 0.5).setDepth(101).setScrollFactor(0)
      .setShadow(0, 0, '#48D0F8', 8, true, true);

    // Score label + value — right
    this.add.text(width - 18, 12, 'ĐIỂM', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '10px',
      color:      '#48D0F8',
    }).setOrigin(1, 0).setDepth(101).setScrollFactor(0);

    this.txtScore = this.add.text(width - 18, 32, '0', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '24px',
      fontStyle:  'bold',
      color:      '#FFD87A',
    }).setOrigin(1, 0.5).setDepth(101).setScrollFactor(0);

    // Exit button — far left, before the bird counter (keeps the right side
    // free for the score block so nothing collides at narrow widths)
    const exitBtn = this.add.text(18, 32, '✕', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#FF8FA0',
    }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0)
      .setPadding(6)
      .setInteractive({ useHandCursor: true });

    // Bird count — left, after the exit button
    this.add.text(64, 12, 'HẠC', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '10px',
      color:      '#48D0F8',
    }).setOrigin(0, 0).setDepth(101).setScrollFactor(0);

    this.txtBirds = this.add.text(64, 32, '', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '22px',
      fontStyle:  'bold',
      color:      '#A8F8F8',
    }).setOrigin(0, 0.5).setDepth(101).setScrollFactor(0);

    exitBtn.on('pointerover',  () => exitBtn.setColor('#FFFFFF'));
    exitBtn.on('pointerout',   () => exitBtn.setColor('#FF8FA0'));
    exitBtn.on('pointerdown',  () => this.scene.start('LevelSelectScene'));

    // Bottom: bird queue visual indicator
    this.createBirdQueueUI(width, height);
  }

  private birdQueueIcons: Phaser.GameObjects.Image[] = [];

  private createBirdQueueUI(width: number, height: number) {
    this.birdQueueIcons = [];
    const total   = this.levelDef.birds.length;
    const iconSize = 32;
    const gap      = 6;
    const totalW   = total * (iconSize + gap) - gap;
    const startX   = width / 2 - totalW / 2;
    const y        = height - 28;

    // Background pill
    const pillBg = this.add.graphics().setDepth(100).setScrollFactor(0);
    pillBg.fillStyle(C.navy, 0.7);
    pillBg.fillRoundedRect(startX - 10, y - 22, totalW + 20, 44, 22);
    pillBg.lineStyle(1, C.cyan, 0.3);
    pillBg.strokeRoundedRect(startX - 10, y - 22, totalW + 20, 44, 22);

    for (let i = 0; i < total; i++) {
      const icon = this.add.image(startX + i * (iconSize + gap) + iconSize / 2, y, 'logo')
        .setDepth(101).setScrollFactor(0).setTint(C.cyanSoft);
      icon.setScale(iconSize / icon.height); // fit icon into its slot (texture is 1237×969)
      this.birdQueueIcons.push(icon);
    }
  }

  private refreshHUD() {
    if (this.txtBirds) this.txtBirds.setText(`×${this.birdsLeft}`);

    // Update queue icons: used birds dim out
    const used = this.levelDef.birds.length - this.birdsLeft;
    this.birdQueueIcons.forEach((icon, i) => {
      if (i < used) {
        icon.setAlpha(0.2).setTint(0x444444);
      } else {
        icon.setAlpha(1).setTint(C.cyanSoft);
      }
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  TERRAIN
  // ══════════════════════════════════════════════════════════════════════════

  private createTerrain(screenHeight: number) {
    const groundY = screenHeight - 60; // top of the FLAT physics ground

    // ── Static physics ground — one flat invisible plane, unchanged.
    //    Every block/enemy footprint in LevelData still rests on exactly
    //    this surface; the rock pedestals below are pure decoration, so
    //    no contact geometry is affected. ──
    this.matter.add.rectangle(
      this.worldWidth / 2, groundY + 30,
      this.worldWidth, 62,
      { isStatic: true, label: 'ground', friction: 0.8, restitution: 0.05 }
    );

    // The background art itself shows below the ground line; only the
    // launch pad gets its own terrain art.
    this.drawLaunchIsland(this.anchorX - 190, this.anchorX + 170, groundY);
  }

  /** Launch-pad island: the grassy rocky slope asset at its native aspect
   *  ratio (scaled, never stretched) so its rock silhouette keeps its real
   *  proportions instead of being squashed into an arbitrary box. */
  private drawLaunchIsland(l: number, r: number, groundY: number) {
    const cx = (l + r) / 2;
    // Its walkable grass line sits ~58% down the image, so the top is
    // lifted above groundY by that fraction to align that surface with the
    // physics ground — the rocky crest left of the slingshot becomes a
    // backdrop hill.
    const dh    = 190;
    const tex   = this.textures.get('struct_dirt_l').getSourceImage() as HTMLImageElement;
    const scale = dh / tex.height;
    this.add.image(cx, groundY - dh * 0.55, 'struct_dirt_l')
      .setOrigin(0.5, 0)
      .setScale(scale)
      .setDepth(6);
  }

}
