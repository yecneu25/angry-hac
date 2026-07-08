import Phaser from 'phaser';
import { LEVELS } from '../data/LevelData';
import { attachSkyMotion } from '../fx/skyMotion';

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

    // ── Title ──────────────────────────────────────────────────────────────
    this.add.text(width / 2, height * 0.13, 'CHỌN CỬA ẢI', {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   `${Math.round(Math.min(44, width * 0.05))}px`,
      fontStyle:  'bold',
      color:      '#A8F8F8',
    }).setOrigin(0.5, 0.5).setShadow(0, 0, '#48D0F8', 16, true, true);

    // ── Level nodes ────────────────────────────────────────────────────────
    const nodes = LEVELS.map((lvl, i) => ({
      x: width * (0.25 + 0.25 * i),
      y: height * (i === 1 ? 0.42 : 0.47),
      level: lvl.id,
      name: lvl.name,
    }));

    this.drawPath(nodes);
    nodes.forEach((node, index) => this.createNode(node, index));

    // ── Bottom buttons ─────────────────────────────────────────────────────
    const btnY = height * 0.9;
    this.makeButton(width / 2 - 110, btnY, 190, 'QUAY LẠI', COL.cyan, '#A8F8F8', () => {
      this.scene.start('MainMenuScene');
    });
    this.makeButton(width / 2 + 110, btnY, 190, 'THIẾT LẬP LẠI', COL.pink, '#FF8FA0', () => {
      this.resetProgress();
    });

    this.setupResizeHandler();
  }

  private createNode(node: { x: number; y: number; level: number; name: string }, index: number) {
    const isUnlocked  = !!this.progress.unlocked[index];
    const starsEarned = Phaser.Math.Clamp(this.progress.stars[index] ?? 0, 0, 3);

    const container = this.add.container(node.x, node.y);

    // Halo behind unlocked nodes
    if (isUnlocked) {
      const halo = this.add.graphics();
      halo.fillStyle(COL.cyan, 0.14);
      halo.fillCircle(0, 0, 62);
      container.add(halo);
    }

    const nodeBg = this.add.graphics();
    if (isUnlocked) {
      nodeBg.fillStyle(0x0030D8, 0.75);
      nodeBg.lineStyle(3, COL.cyan, 1);
    } else {
      nodeBg.fillStyle(0x000020, 0.8);
      nodeBg.lineStyle(3, COL.locked, 0.8);
    }
    nodeBg.fillCircle(0, 0, 45);
    nodeBg.strokeCircle(0, 0, 45);
    container.add(nodeBg);

    if (isUnlocked) {
      container.add(this.add.text(0, 0, `${node.level}`, {
        fontFamily: 'Outfit, sans-serif',
        fontSize:   '32px',
        fontStyle:  'bold',
        color:      '#A8F8F8',
      }).setOrigin(0.5, 0.5));

      const starString = '★'.repeat(starsEarned) + '☆'.repeat(3 - starsEarned);
      container.add(this.add.text(0, 65, starString, {
        fontFamily: 'Outfit, sans-serif',
        fontSize:   '20px',
        color:      '#FFD87A',
      }).setOrigin(0.5, 0.5));

      this.tweens.add({
        targets: container, y: node.y - 8,
        duration: 1500 + index * 200,
        ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
      });
    } else {
      container.add(this.add.text(0, 0, '🔒', { fontSize: '24px' })
        .setOrigin(0.5, 0.5).setAlpha(0.6));
    }

    container.add(this.add.text(0, 98, `Cửa ${node.level}:\n${node.name}`, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '14px',
      color:      isUnlocked ? '#A8F8F8' : '#3A5A78',
      align:      'center',
      lineSpacing: 4,
    }).setOrigin(0.5, 0.5));

    if (isUnlocked) {
      const zone = this.add.zone(node.x, node.y, 110, 110)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true });
      zone.on('pointerover', () => this.tweens.add({ targets: container, scale: 1.1, duration: 100 }));
      zone.on('pointerout',  () => this.tweens.add({ targets: container, scale: 1.0, duration: 100 }));
      zone.on('pointerdown', () => this.scene.start('GameScene', { level: node.level }));
    }
  }

  private makeButton(cx: number, cy: number, bw: number, label: string, accent: number, textColor: string, cb: () => void) {
    const bh = 44;
    const bg = this.add.graphics();
    const draw = (hover: boolean) => {
      bg.clear();
      bg.fillStyle(hover ? COL.navyMid : COL.navy, hover ? 0.85 : 0.62);
      bg.lineStyle(hover ? 2 : 1.5, accent, hover ? 1 : 0.65);
      bg.fillRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
      bg.strokeRoundedRect(cx - bw / 2, cy - bh / 2, bw, bh, 8);
    };
    draw(false);

    this.add.text(cx, cy, label, {
      fontFamily: 'Outfit, sans-serif',
      fontSize:   '16px',
      fontStyle:  'bold',
      color:      textColor,
    }).setOrigin(0.5, 0.5);

    const zone = this.add.zone(cx, cy, bw, bh)
      .setOrigin(0.5, 0.5)
      .setInteractive({ useHandCursor: true });
    zone.on('pointerover', () => draw(true));
    zone.on('pointerout',  () => draw(false));
    zone.on('pointerdown', cb);
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
