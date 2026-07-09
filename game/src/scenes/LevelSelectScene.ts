import Phaser from 'phaser';
import { LEVELS } from '../data/LevelData';
import { attachSkyMotion } from '../fx/skyMotion';
import { makeCrystalButton, drawSpeakerIcon } from '../fx/crystalFrame';
import { getLayout, type LayoutMode } from '../utils/responsive';
import { ensureBgMusic, armMusicWatchdog, toggleMute, isMuted } from '../utils/music';
import { isLowPowerDevice } from '../utils/perf';

interface GameProgress {
  unlocked: boolean[];
  stars: number[];
}

const COL = {
  navy:     0x002070,
  navyMid:  0x0030A0,
  cyan:     0x48D0F8,
  cyanSoft: 0xA8F8F8,
  pink:     0xFF8FA0,
  locked:   0x103050,
};

export class LevelSelectScene extends Phaser.Scene {
  private progress!: GameProgress;
  private resizeTimer: Phaser.Time.TimerEvent | null = null;

  constructor() {
    super('LevelSelectScene');
  }

  init() {
    this.loadProgress();
    this.resizeTimer = null;
  }

  create() {
    const width  = this.cameras.main.width;
    const height = this.cameras.main.height;

    // ── Background + vignette ──────────────────────────────────────────────
    const bg = this.add.image(width / 2, height / 2, 'bg_cover1');
    bg.setScale(Math.max(width / bg.width, height / bg.height));

    // ── Aurora drift + occasional lightning flash over the static sky art ──
    attachSkyMotion(this);

    const vignette = this.add.graphics();
    vignette.fillStyle(0x000018, 0.35);
    vignette.fillRect(0, 0, width, height);

    this.createAtmosphere(width, height);

    const layout = getLayout(width, height);
    // On mobile the usable band runs from just under the HUD-less safe top to
    // the bottom safe line; we lay title → node row → buttons out inside it so
    // nothing clusters at the top with dead space in the middle.
    const topY    = layout.mobile ? layout.safeTop : 0;
    const bottomY = layout.mobile ? layout.safeBottom : height;
    const availH  = bottomY - topY;

    // ── Title (no frame here — the map floats straight over the scenery) ──
    const titleFontSize = Math.round(Math.min(
      layout.mobile ? 32 : 44,
      width * (layout.mobile ? 0.042 : 0.05),
    ));
    const titleY = layout.mobile ? topY + availH * 0.10 : height * 0.13;
    this.add.text(width / 2, titleY, 'CHỌN CỬA ẢI', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   `${titleFontSize}px`,
      fontStyle:  'bold',
      color:      '#A8F8F8',
    }).setOrigin(0.5, 0.5).setShadow(0, 0, '#48D0F8', 16, true, true);

    // ── Bottom buttons ──────────────────────────────────────────────────
    const btnH   = layout.mobile ? Math.round(46 * layout.uiScale) : 46;
    const btnY   = layout.mobile ? bottomY - btnH / 2 - 4 : height * 0.9;
    // Desktop: hard offset ±115px. Mobile: scale with width so buttons stay
    // centred and don't collide on narrower screens.
    const btnOffset = layout.mobile ? width * 0.14 : 115;
    const btnW      = layout.mobile ? Math.min(180, width * 0.26) : 200;

    // ── Level nodes ──────────────────────────────────────────────────
    // Evenly-spaced single row. On mobile the row is centred in the gap
    // between the title and the button row (biased up a little to leave room
    // for the star + label that hang below each orb), and node x is mapped
    // into the notch-safe width. Desktop keeps its original coordinates.
    const usableW = width - layout.safeLeft - layout.safeRight;
    const nodeY = layout.mobile
      ? Phaser.Math.Linear(titleY, btnY - btnH / 2, 0.44)
      : height * 0.42;
    const nodes = LEVELS.map((lvl, i) => ({
      x: layout.mobile
        ? layout.safeLeft + usableW * (0.25 + 0.25 * i)
        : width * (0.25 + 0.25 * i),
      y: nodeY,
      level: lvl.id,
      name: lvl.name,
    }));

    this.drawPath(nodes);
    nodes.forEach((node, index) => this.createNode(node, index, layout));

    this.makeButton(width / 2 - btnOffset, btnY, btnW, 'QUAY LẠI', true, () => {
      this.scene.start('MainMenuScene');
    });
    this.makeButton(width / 2 + btnOffset, btnY, btnW, 'THIẾT LẬP LẠI', false, () => {
      this.resetProgress();
    });

    this.createSoundButton(width);

    this.setupResizeHandler();
    ensureBgMusic(this);
    armMusicWatchdog(this);
  }

  /** Corner sound button for quick toggling */
  private createSoundButton(width: number) {
    const layout = getLayout(width, this.cameras.main.height);
    const radius = layout.mobile ? Math.round(18 * layout.uiScale) : 20;
    const btnX = width - (radius + 20) - layout.safeRight;
    const btnY = (radius + 20 * layout.uiScale);

    const container = this.add.container(btnX, btnY).setDepth(100);

    const bg = this.add.graphics();

    const drawBg = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? 0x0040B0 : 0x002070, 0.85);
      bg.fillCircle(0, 0, radius);
      bg.lineStyle(2, 0x48D0F8, 1);
      bg.strokeCircle(0, 0, radius);
    };

    drawBg(false);

    let icon = drawSpeakerIcon(this, 0, 0, radius * 1.1, isMuted(this));
    container.add([bg, icon]);

    const zone = this.add.zone(0, 0, radius * 2, radius * 2)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    container.add(zone);

    zone.on('pointerover', () => {
      drawBg(true);
      this.tweens.add({ targets: container, scale: 1.1, duration: 100 });
    });

    zone.on('pointerout', () => {
      drawBg(false);
      this.tweens.add({ targets: container, scale: 1.0, duration: 100 });
    });

    zone.on('pointerdown', () => {
      const nowMuted = toggleMute(this);
      icon.destroy();
      icon = drawSpeakerIcon(this, 0, 0, radius * 1.1, nowMuted);
      container.addAt(icon, 1);
    });
  }


  /** Renders one level node straight from the MapLevel.png-sliced art: the
   *  crystal orb (glow + diamonds + icy number baked in), the gold/empty star
   *  glyphs filled to the earned count, and the two-line crystal-font label. */
  private createNode(
    node: { x: number; y: number; level: number; name: string },
    index: number,
    layout: LayoutMode,
  ) {
    const isMobile = layout.mobile;
    const isUnlocked  = !!this.progress.unlocked[index];
    const starsEarned = Phaser.Math.Clamp(this.progress.stars[index] ?? 0, 0, 3);
    const width = this.cameras.main.width;

    const container = this.add.container(node.x, node.y);

    // ── Crystal orb (the user's art — number + diamonds + glow are baked in) ─
    // Scale the orb continuously to the available vertical band so the whole
    // orb+star+label cluster always fits, from small phones up to tablets.
    const ORB_W = isMobile
      ? Math.min(120, Math.round((layout.safeBottom - layout.safeTop) * 0.30))
      : 138;
    const orb = this.add.image(0, 0, `map_orb${node.level}`);
    orb.setDisplaySize(ORB_W, ORB_W * orb.height / orb.width);
    const orbH = orb.displayHeight;
    if (!isUnlocked) orb.setTint(0x33465e).setAlpha(0.72);
    container.add(orb);

    const orbScale  = ORB_W / 138;            // 1.0 desktop, <1 mobile
    if (!isUnlocked) {
      container.add(this.add.text(0, 0, '🔒', { fontSize: `${Math.round(38 * orbScale)}px` })
        .setOrigin(0.5, 0.5).setAlpha(0.9));
    }

    // ── Star row — the user's gold/outline star glyphs ────────────────────────────
    const STAR_W    = Math.round(30 * orbScale);
    const starGap   = Math.round(34 * orbScale);
    const starRowY  = orbH / 2 + Math.round(18 * orbScale);
    for (let i = 0; i < 3; i++) {
      const key = (isUnlocked && i < starsEarned) ? 'map_star_full' : 'map_star_empty';
      const st = this.add.image((i - 1) * starGap, starRowY, key)
        .setDisplaySize(STAR_W, STAR_W);
      if (!isUnlocked) st.setAlpha(0.45);
      container.add(st);
    }

    // ── Label ("Cửa N:" + name) — crystal font baked in the reference ───────
    const label = this.add.image(0, 0, `map_label${node.level}`);
    const LABEL_W = Math.min(width * 0.3, Math.round(236 * orbScale));
    label.setDisplaySize(LABEL_W, LABEL_W * label.height / label.width);
    label.setY(starRowY + Math.round(18 * orbScale) + label.displayHeight / 2);
    if (!isUnlocked) label.setAlpha(0.5);
    container.add(label);

    if (isUnlocked) {
      this.tweens.add({
        targets: container, y: node.y - 8,
        duration: 1500 + index * 200,
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      });

      const zone = this.add.zone(node.x, node.y, ORB_W * 0.82, orbH * 0.82)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.tweens.add({ targets: container, scale: 1.08, duration: 120 }));
      zone.on('pointerout',  () => this.tweens.add({ targets: container, scale: 1.0, duration: 120 }));
      zone.on('pointerdown', () => this.scene.start('GameScene', { level: node.level }));
    }
  }

  /** Crystal button — shared Frame.png renderer (NÚT CHÍNH / NÚT PHỤ). */
  private makeButton(cx: number, cy: number, bw: number, label: string, primary: boolean, cb: () => void) {
    makeCrystalButton(this, cx, cy, bw, label, cb, { bh: 46, primary, fontSize: 16 });
  }

  private drawPath(nodes: { x: number; y: number }[]) {
    const pathGraphics = this.add.graphics();
    for (let i = 0; i < nodes.length - 1; i++) {
      const p1 = nodes[i];
      const p2 = nodes[i + 1];
      const distance  = Phaser.Math.Distance.Between(p1.x, p1.y, p2.x, p2.y);
      const pointsNum = Math.max(1, Math.floor(distance / 15));
      for (let j = 0; j <= pointsNum; j++) {
        if (j % 2 === 0) {
          const t = j / pointsNum;
          const x = Phaser.Math.Interpolation.Linear([p1.x, p2.x], t);
          const y = Phaser.Math.Interpolation.Linear([p1.y, p2.y], t);
          pathGraphics.fillStyle(COL.cyan, 0.5);
          pathGraphics.fillCircle(x, y, 3);
        }
      }
    }
  }

  private createAtmosphere(width: number, height: number) {
    // Purely decorative — skip on low-power devices where a continuous
    // ADD-blended full-screen emitter is real frame-time cost (see perf.ts).
    if (isLowPowerDevice) return;
    this.add.particles(0, 0, 'fx_crystal', {
      x: { min: 0, max: width },
      y: { min: 0, max: height },
      speed: { min: 3, max: 12 },
      scale: { start: 0.04, end: 0.12 },
      alpha: { start: 0.1, end: 0.5 },
      lifespan: 6000,
      frequency: 250,
      blendMode: 'ADD',
    }).setDepth(1);
  }

  private loadProgress() {
    const fallback: GameProgress = {
      unlocked: [true, false, false],
      stars: [0, 0, 0],
    };
    try {
      const raw = localStorage.getItem('angry_hac_progress');
      const parsed = raw ? JSON.parse(raw) : null;
      // Guard against old/corrupted saves — missing arrays crash the node UI
      this.progress = {
        unlocked: Array.isArray(parsed?.unlocked) ? parsed.unlocked : fallback.unlocked,
        stars:    Array.isArray(parsed?.stars)    ? parsed.stars    : fallback.stars,
      };
    } catch {
      this.progress = fallback;
    }
  }

  private resetProgress() {
    const fresh: GameProgress = {
      unlocked: [true, false, false],
      stars: [0, 0, 0],
    };
    localStorage.setItem('angry_hac_progress', JSON.stringify(fresh));
    this.scene.restart();
  }

  /** See MainMenuScene.setupResizeHandler — leaked handlers stack scenes. */
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
