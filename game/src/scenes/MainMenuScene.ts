import Phaser from 'phaser';
import { attachSkyMotion } from '../fx/skyMotion';
import { paintBlock } from '../fx/blockPainter';

// Palette — design-system.md "Cực Quang & Hạc Pha Lê". Block materials live
// in blockPainter.ts (shared with GameScene) so the menu fortress renders
// pixel-identical to in-game structures.
const COL = {
  navyMid:   0x0030A0,
  navyHi:    0x0040B0,
  cyan:      0x48D0F8,
  cyanSoft:  0xA8F8F8,
  enemy:     0x28D870,
  enemyArmor:0xD8B020,
  gold:      0xFFD87A,
};

export class MainMenuScene extends Phaser.Scene {
  private soundEnabled = true;
  private soundButtonText!: Phaser.GameObjects.Text;
  private resizeTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('MainMenuScene');
  }

  init() {
    this.soundEnabled = localStorage.getItem('sound_enabled') !== 'false';
    this.sound.mute = !this.soundEnabled;
    this.resizeTimer = null;
  }

  create() {
    const width  = this.cameras.main.width;
    const height = this.cameras.main.height;

    // ── Background (cover-fit) + vignette for text legibility ─────────────
    const bg = this.add.image(width / 2, height / 2, 'cover_main');
    bg.setScale(Math.max(width / bg.width, height / bg.height));

    // ── Aurora drift + occasional lightning flash over the static sky art ──
    attachSkyMotion(this);

    const vignette = this.add.graphics();
    vignette.fillGradientStyle(0x000018, 0x000018, 0x000018, 0x000018, 0, 0, 0.55, 0.55);
    vignette.fillRect(0, height * 0.62, width, height * 0.38);
    vignette.fillGradientStyle(0x000018, 0x000018, 0x000018, 0x000018, 0.45, 0.45, 0, 0);
    vignette.fillRect(0, 0, width, height * 0.3);

    this.createAtmosphere(width, height);

    // ── Banner composition (per the HÀNH TRÌNH KINH DOANH key visual):
    //    crystal title stack top-centre; LEFT = the loaded slingshot with the
    //    crystal crane aimed rightward; RIGHT corner = the enemy fortress on
    //    its rock outcrop; dotted trajectory arcs between them; the two
    //    action buttons sit flush along the bottom edge. On narrow windows
    //    the scenic vignettes are dropped and only title + buttons remain. ──
    const compact = width < 950;

    // ── Title stack (kicker → crystal lettering → light streak → tagline) ──
    const titleX = width / 2;

    const journey = this.add.image(titleX, 0, 'txt_journey');
    journey.setScale(Math.min(210, width * 0.17) / journey.width);
    journey.y = height * 0.10 + journey.displayHeight / 2;
    journey.setAlpha(0.95);

    // "ANGRY HẠC" — real crystal lettering cropped from TITLE ĐẦU GAME.png.
    // The crop keeps its opaque night-sky backing, so it renders in ADD
    // blend: the dark sky contributes nothing over our own night sky while
    // the letters glow exactly like the source art.
    const title  = this.add.image(titleX, 0, 'txt_title')
      .setBlendMode(Phaser.BlendModes.ADD);
    const titleW = Math.min(width * 0.44, 680);
    title.setScale(titleW / title.width);
    title.y = journey.y + journey.displayHeight / 2 + title.displayHeight / 2 + 14;
    this.tweens.add({
      targets: title, alpha: { from: 1, to: 0.86 },
      duration: 2200, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    const streak = this.add.image(titleX, title.y + title.displayHeight * 0.6 + 8, 'fx_light_h')
      .setBlendMode(Phaser.BlendModes.ADD);
    streak.setScale((titleW * 0.98) / streak.width);
    this.tweens.add({
      targets: streak, alpha: { from: 1, to: 0.55 },
      duration: 1600, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    const bar  = this.add.image(titleX, 0, 'txt_tag_frame');
    const barW = titleW * 0.8;
    bar.setScale(barW / bar.width);
    bar.y = streak.y + bar.displayHeight / 2 + 16;
    this.add.text(titleX, bar.y, 'CHUYỂN MÌNH KHAI PHÁ, VỮNG BƯỚC TIÊN PHONG', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   `${Math.max(11, Math.round(barW * 0.032))}px`,
      fontStyle:  'bold',
      color:      '#EAF8FF',
    }).setOrigin(0.5, 0.5).setShadow(0, 2, '#001040', 4, false, true);

    // ── Scenic vignettes (wide screens only) ──────────────────────────────
    if (!compact) {
      // Foreground terrain frames the scene (design-system §6): mossy dirt
      // rising on the left for the slingshot, rock outcrop on the right for
      // the fortress.
      const dirt = this.add.image(0, height, 'struct_dirt_l').setOrigin(0, 1);
      dirt.setScale((width * 0.62) / dirt.width);
      const leftGroundY = height - dirt.displayHeight * 0.40;

      // Mossy meadow bed under the fortress — keeps the keep grounded on the
      // valley floor instead of perched on the rock outcrop.
      const meadow = this.add.image(width * 0.84, height + 6, 'struct_grass').setOrigin(0.5, 1);
      meadow.setScale((width * 0.5) / meadow.width);
      const rightGroundY = height - meadow.displayHeight * 0.35;

      const slingX    = width * 0.19;
      const fortressX = width * 0.82;

      const pouch  = this.createSlingVignette(slingX, leftGroundY, height);
      const target = this.createFortressVignette(fortressX, rightGroundY, height);
      this.drawTrajectoryHint(pouch, target);
    }

    // ── Buttons — flush along the bottom edge of the screen ───────────────
    const buttonY = height - 44;
    const btnW    = Math.min(220, width * 0.4);

    this.makeButton(width / 2 - btnW / 2 - 14, buttonY, btnW, 'CHƠI NGAY', true, () => {
      this.scene.start('LevelSelectScene');
    });

    this.soundButtonText = this.makeButton(
      width / 2 + btnW / 2 + 14, buttonY, btnW,
      this.getSoundButtonLabel(), false,
      () => this.toggleSound(),
    );

    this.setupResizeHandler();
  }

  /** The loaded slingshot on the left, aiming at the fortress: the NỎ art
   *  standing on the dirt terrain, elastic bands drawn back-and-down to the
   *  glowing crystal crane, ready to fire toward the right. Band anchors
   *  reuse the crystal-tip fractions measured for GameScene.
   *  Returns the crane's world position (trajectory start). */
  private createSlingVignette(x: number, groundY: number, screenH: number) {
    const c   = this.add.container(x, groundY);
    const tex = this.textures.get('struct_sling').getSourceImage() as HTMLImageElement;
    const H   = screenH * 0.34;
    const W   = H * (tex.width / tex.height);
    const img = this.add.image(0, 0, 'struct_sling').setOrigin(0.5, 1).setDisplaySize(W, H);
    // Lean the whole rig toward the fortress — it visibly aims at its target
    const LEAN = 8;

    // Crystal fork tips (fractions of the art), measured from the base
    const tipL = { x: (0.14 - 0.5) * W, y: -H * 0.91 };
    const tipR = { x: (0.86 - 0.5) * W, y: -H * 0.91 };
    // Pouch pulled back-left-and-down — a drawn, loaded pose whose release
    // direction points up-right, straight at the fortress. Kept short enough
    // that the crane stays fully on-screen at the left edge.
    const pouch = { x: tipL.x - W * 0.55, y: tipL.y + H * 0.30 };

    // Bands: glowing cyan body + white-hot core
    const bands = this.add.graphics();
    bands.lineStyle(6, COL.cyan, 0.85);
    bands.lineBetween(tipL.x, tipL.y, pouch.x, pouch.y);
    bands.lineBetween(tipR.x, tipR.y, pouch.x, pouch.y);
    bands.lineStyle(2, 0xFFFFFF, 0.7);
    bands.lineBetween(tipL.x, tipL.y, pouch.x, pouch.y);
    bands.lineBetween(tipR.x, tipR.y, pouch.x, pouch.y);

    const birdGlow = this.add.image(pouch.x, pouch.y, 'fx_crystal')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(COL.cyan)
      .setAlpha(0.55);
    birdGlow.setScale((H * 0.38) / birdGlow.height);
    // Crane sized close to the fork width — the projectile should look like
    // it fills the pouch, not dangle under it.
    const bird = this.add.image(pouch.x, pouch.y, 'logo');
    bird.setScale((H * 0.28) / bird.height);

    c.add([bands, img, birdGlow, bird]);
    c.setAngle(LEAN);

    this.tweens.add({
      targets: birdGlow, alpha: { from: 0.55, to: 0.3 }, scale: birdGlow.scale * 1.12,
      duration: 1700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
    this.tweens.add({
      targets: bird, scale: bird.scale * 1.05,
      duration: 1700, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    // Pouch position in world space (container rotation applied) — the
    // trajectory hint must start exactly on the loaded crane.
    const a  = Phaser.Math.DegToRad(LEAN);
    const wx = x + pouch.x * Math.cos(a) - pouch.y * Math.sin(a);
    const wy = groundY + pouch.x * Math.sin(a) + pouch.y * Math.cos(a);
    return { x: wx, y: wy };
  }

  /** Enemy fortress on the right rock outcrop — a four-storey keep modelled
   *  on the key visual's pig castle, built from the exact in-game block
   *  renderer (blockPainter, shared with GameScene): stone footing and
   *  pillars, wood beams, ice roof, a TNT crate, rubble at the base and
   *  torches at the flanks. Garrisoned by green crystal enemies with the
   *  gold armored boss (crowned) on the roof.
   *  Returns the point the trajectory hint should arc toward. */
  private createFortressVignette(x: number, groundY: number, screenH: number) {
    const c = this.add.container(x, groundY);
    const u = screenH * 0.045; // block unit

    // Cold smoke drifting behind the ruin
    const smoke = this.add.image(0, -u * 5, 'fx_smoke')
      .setBlendMode(Phaser.BlendModes.ADD)
      .setAlpha(0.10);
    smoke.setScale((u * 14) / smoke.width);
    c.add(smoke);

    // Contact shadow — anchors the keep onto the meadow instead of letting
    // it float over the painterly ground.
    const shadow = this.add.graphics();
    shadow.fillStyle(0x000018, 0.45);
    shadow.fillEllipse(0, -0.1 * u, 8.6 * u, 1.3 * u);
    c.add(shadow);

    // One Graphics per block, painted by the shared in-game renderer, then
    // graded into the night scene (design-system: mọi yếu tố tự nhiên đều
    // nhuộm xanh đêm): a deep navy glaze — heavier on lower courses, cheap
    // ambient occlusion — plus a cyan top rim, the aurora's cold key light
    // that every surrounding rock and moss surface also carries.
    const block = (bx: number, by: number, w: number, h: number,
                   type: string, angleDeg = 0, glaze = 0.18) => {
      const g = this.add.graphics();
      g.x = bx * u;
      g.y = by * u;
      if (angleDeg) g.rotation = Phaser.Math.DegToRad(angleDeg);
      const seed = ((bx * 1000) | 0) * 73856093 ^ ((by * 1000) | 0) * 19349663 ^ ((w * 1000) | 0);
      paintBlock(g, w * u, h * u, type, 1.0, seed);
      const hw = w * u / 2, hh = h * u / 2;
      g.fillStyle(0x001858, glaze);
      g.fillRoundedRect(-hw, -hh, w * u, h * u, 4);
      g.lineStyle(1.5, COL.cyan, 0.22);
      g.lineBetween(-hw + 3, -hh + 1.5, hw - 3, -hh + 1.5);
      g.lineStyle(1, COL.cyan, 0.10);
      g.lineBetween(-hw + 1.5, -hh + 3, -hw + 1.5, hh - 3);
      c.add(g);
      return g;
    };

    // ── Foundation & rubble ────────────────────────────────────────────────
    block(0, -0.5, 7.4, 1.0, 'stone', 0, 0.30);
    block(-4.1, -0.35, 1.0, 0.7, 'stone', -6, 0.32);
    block( 4.15, -0.3, 0.9, 0.6, 'stone',  5, 0.32);
    block(-3.35, -1.3, 0.7, 0.55, 'ice', -8, 0.2); // stray ice shard on the plinth

    // Recessed interior walls — drawn behind the pillars with a heavy navy
    // glaze so each storey reads as a solid keep in shadow, not an open
    // skeleton (the key visual's castle is a massive enclosed block).
    block(0, -2.15, 3.9, 2.2, 'stone', 0, 0.55);
    block(0, -4.85, 3.4, 1.8, 'stone', 0, 0.55);
    block(0, -7.25, 2.2, 1.5, 'stone', 0, 0.55);

    // ── Ground floor: stone flanks, wood inner frame, TNT in the alcove ──
    block(-2.9, -2.15, 1.05, 2.3, 'stone', 0, 0.24);
    block( 2.9, -2.15, 1.05, 2.3, 'stone', 0, 0.24);
    block(-1.15, -2.1, 0.65, 2.2, 'wood', 0, 0.22);
    block( 1.15, -2.1, 0.65, 2.2, 'wood', 0, 0.22);
    const tnt = block(1.95, -1.43, 0.85, 0.85, 'tnt', 0, 0.2);
    const tntLabel = this.add.text(tnt.x, tnt.y, 'TNT', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   `${Math.max(8, Math.round(u * 0.24))}px`,
      fontStyle:  'bold',
      color:      '#FFF4D8',
    }).setOrigin(0.5, 0.5).setShadow(0, 0, '#1A1008', 2, false, true);
    c.add(tntLabel);
    block(0, -3.6, 6.8, 0.65, 'wood', 0, 0.2);

    // ── Second floor: stone pillars ───────────────────────────────────────
    block(-2.1, -4.85, 0.9, 1.85, 'stone', 0, 0.2);
    block( 2.1, -4.85, 0.9, 1.85, 'stone', 0, 0.2);
    block(0, -6.1, 5.0, 0.75, 'stone', 0, 0.18);

    // ── Third floor: wood frame ───────────────────────────────────────────
    block(-1.2, -7.25, 0.6, 1.55, 'wood', 0, 0.16);
    block( 1.2, -7.25, 0.6, 1.55, 'wood', 0, 0.16);
    block(0, -8.35, 3.4, 0.55, 'wood', 0, 0.16);

    // ── Roof: ice slab crowning the keep ──────────────────────────────────
    block(0, -8.95, 2.4, 0.6, 'ice', 0, 0.12);

    // Moss creeping over the plinth and pillar feet — night-moss tufts
    // (design-system §2.4) drawn on top of the masonry so the keep reads as
    // if it has stood on this meadow for years.
    const moss = this.add.graphics();
    for (let i = 0; i < 16; i++) {
      const mx  = (-3.5 + i * 0.45 + (i % 3) * 0.1) * u;
      const mh  = (0.14 + (i % 4) * 0.06) * u;
      const col = i % 2 === 0 ? 0x205060 : 0x103050;
      moss.fillStyle(col, 0.85);
      moss.fillEllipse(mx, -0.98 * u, 0.34 * u, mh);
    }
    // …and along the ground line at its feet
    for (let i = 0; i < 12; i++) {
      const mx = (-4.4 + i * 0.75) * u;
      moss.fillStyle(i % 2 === 0 ? 0x103050 : 0x205060, 0.9);
      moss.fillEllipse(mx, -0.06 * u, 0.55 * u, 0.22 * u);
    }
    c.add(moss);

    // ── Torches on the flanks — the rare warm accent (design-system §2.5) ──
    const torch = (tx: number) => {
      block(tx, -1.7, 0.16, 1.4, 'wood', 0, 0.22);
      const glow = this.add.image(tx * u, -2.55 * u, 'fx_crystal')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(COL.gold)
        .setAlpha(0.7);
      glow.setScale((u * 1.6) / glow.height);
      const flame = this.add.graphics();
      flame.fillStyle(COL.gold, 0.95);
      flame.fillEllipse(tx * u, -2.5 * u, u * 0.22, u * 0.38);
      flame.fillStyle(0xFFF4D8, 0.9);
      flame.fillEllipse(tx * u, -2.44 * u, u * 0.1, u * 0.18);
      c.add([glow, flame]);
      this.tweens.add({
        targets: [glow, flame], alpha: { from: 1, to: 0.55 },
        duration: 160 + Math.random() * 120, yoyo: true, repeat: -1,
      });
    };
    torch(-3.6);
    torch(3.6);

    // ── Garrison — enemies use the same tinted-crystal treatment as
    //    GameScene, plus a soft green glow so they read as "magic" objects
    //    against the natural rock (material contrast per design-system §3).
    const pig = (px: number, py: number, tint: number, size: number) => {
      const glow = this.add.image(px * u, py * u, 'fx_crystal')
        .setBlendMode(Phaser.BlendModes.ADD)
        .setTint(tint)
        .setAlpha(0.28);
      glow.setScale((size * 1.5 * u) / glow.height);
      const s = this.add.image(px * u, py * u, 'logo').setTint(tint);
      s.setScale((size * u) / s.height);
      c.add([glow, s]);
      this.tweens.add({
        targets: [s, glow], y: py * u - 4,
        duration: 1400 + Math.abs(px) * 180, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
        delay: Math.abs(px) * 120,
      });
      return s;
    };
    pig(0, -1.9, COL.enemy, 1.4);        // ground-floor lookout
    pig(0, -4.75, COL.enemy, 1.45);      // second-floor lookout
    pig(-3.9, -1.75, COL.enemy, 1.0);    // scout hiding by the left rubble
    pig(0, -7.2, COL.enemy, 1.35);       // third-floor lookout
    const boss = pig(0, -10.0, COL.enemyArmor, 1.8); // armored boss on the roof

    // Gold crown over the boss — the banner's crowned pig
    const crown = this.add.graphics();
    const cy = boss.y / u - 1.15;
    crown.fillStyle(COL.gold, 0.95);
    crown.fillTriangle(-0.42 * u, cy * u, -0.14 * u, cy * u, -0.28 * u, (cy - 0.36) * u);
    crown.fillTriangle(-0.14 * u, cy * u,  0.14 * u, cy * u,  0,        (cy - 0.48) * u);
    crown.fillTriangle( 0.14 * u, cy * u,  0.42 * u, cy * u,  0.28 * u, (cy - 0.36) * u);
    c.add(crown);
    this.tweens.add({
      targets: crown, y: -4,
      duration: 1400, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });

    return { x, y: groundY - 6 * u };
  }

  /** Dotted arc from the loaded crane to the fortress — the gameplay promise
   *  drawn straight onto the menu, tying the two vignettes together. */
  private drawTrajectoryHint(from: { x: number; y: number }, to: { x: number; y: number }) {
    const apex = {
      x: (from.x + to.x) / 2,
      y: Math.min(from.y, to.y) - this.cameras.main.height * 0.18,
    };
    const g = this.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
    const DOTS = 14;
    for (let i = 1; i < DOTS; i++) {
      const t  = i / DOTS;
      const it = 1 - t;
      // Quadratic bezier through the apex
      const px = it * it * from.x + 2 * it * t * apex.x + t * t * to.x;
      const py = it * it * from.y + 2 * it * t * apex.y + t * t * to.y;
      // Soft halo + bright core so the arc reads against the busy sky art
      g.fillStyle(COL.cyan, 0.32);
      g.fillCircle(px, py, 8 - t * 3);
      g.fillStyle(COL.cyanSoft, 0.95 - t * 0.2);
      g.fillCircle(px, py, 4.2 - t * 1.2);
    }
    this.tweens.add({
      targets: g, alpha: { from: 1, to: 0.45 },
      duration: 1800, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
  }

  /**
   * Glassmorphism button. Returns its label Text object (so the caller can
   * update it, e.g. the sound toggle).
   */
  private makeButton(cx: number, cy: number, bw: number, label: string, primary: boolean, cb: () => void) {
    const bh = 52;
    const container = this.add.container(cx, cy);

    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? COL.navyHi : COL.navyMid, hover ? 0.9 : 0.62);
      bg.lineStyle(2, hover ? COL.cyanSoft : COL.cyan, hover ? 1 : 0.8);
      bg.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
      bg.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 12);
      // top inner highlight — glass edge
      bg.lineStyle(1, 0xFFFFFF, hover ? 0.35 : 0.18);
      bg.lineBetween(-bw / 2 + 10, -bh / 2 + 3, bw / 2 - 10, -bh / 2 + 3);
    };
    draw(false);

    const text = this.add.text(0, 0, label, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   primary ? '20px' : '17px',
      fontStyle:  'bold',
      color:      '#A8F8F8',
    }).setOrigin(0.5, 0.5);

    container.add([bg, text]);

    const zone = this.add.zone(cx, cy, bw, bh)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });

    zone.on('pointerover', () => {
      draw(true);
      this.tweens.add({ targets: container, scale: 1.05, duration: 110, ease: 'Power1' });
    });
    zone.on('pointerout', () => {
      draw(false);
      this.tweens.add({ targets: container, scale: 1.0, duration: 110, ease: 'Power1' });
    });
    zone.on('pointerdown', cb);

    return text;
  }

  private createAtmosphere(width: number, height: number) {
    this.add.particles(0, 0, 'fx_crystal', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      speed: { min: 5, max: 20 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.05, end: 0.15 },
      alpha: { start: 0.2, end: 0.8 },
      lifespan: 4000,
      frequency: 200,
      blendMode: 'ADD',
    }).setDepth(1);
  }

  private toggleSound() {
    this.soundEnabled = !this.soundEnabled;
    localStorage.setItem('sound_enabled', this.soundEnabled ? 'true' : 'false');
    this.soundButtonText.setText(this.getSoundButtonLabel());
    this.sound.mute = !this.soundEnabled;
  }

  private getSoundButtonLabel(): string {
    return this.soundEnabled ? '🔊 ÂM THANH: BẬT' : '🔇 ÂM THANH: TẮT';
  }

  /**
   * Rebuild the layout when the window is resized. The listener MUST be
   * removed on shutdown: a leaked handler restarts this scene while another
   * one is running, stacking both UIs on top of each other.
   */
  private setupResizeHandler() {
    const onResize = () => {
      if (!this.scene.isActive()) return;
      this.resizeTimer?.remove();
      this.resizeTimer = this.time.delayedCall(150, () => this.scene.restart());
    };
    this.scale.on('resize', onResize);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', onResize);
    });
  }
}
