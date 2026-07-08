// src/fx/skyMotion.ts
import Phaser from 'phaser';

const AURORA_CYAN = 0x48D0F8;
const FLASH_TINT  = 0xE8FBFF;
const GLOW_TEX     = 'sky_aurora_glow';
const GLOW_TEX_SIZE = 256;

/**
 * A soft white-to-transparent radial gradient, generated once and shared by
 * every scene. Used (tinted + stretched) as the aurora glow so it fades on
 * every edge — a plain Graphics rect only fades top-to-bottom, leaving hard
 * left/right cutoffs that read as visible seams against the busy sky art.
 */
function ensureGlowTexture(scene: Phaser.Scene): string {
  if (scene.textures.exists(GLOW_TEX)) return GLOW_TEX;

  const canvasTex = scene.textures.createCanvas(GLOW_TEX, GLOW_TEX_SIZE, GLOW_TEX_SIZE)!;
  const ctx = canvasTex.getContext();
  const r = GLOW_TEX_SIZE / 2;
  const grad = ctx.createRadialGradient(r, r, 0, r, r, r);
  grad.addColorStop(0,   'rgba(255,255,255,1)');
  grad.addColorStop(0.5, 'rgba(255,255,255,0.35)');
  grad.addColorStop(1,   'rgba(255,255,255,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, GLOW_TEX_SIZE, GLOW_TEX_SIZE);
  canvasTex.refresh();
  return GLOW_TEX;
}

/**
 * Slow-drifting aurora glow blobs + an occasional lightning flash, laid over
 * a scene's static painted sky. Screen-space (scrollFactor 0) so it always
 * covers the viewport regardless of camera pan — the exact same setup is
 * reused by GameScene, MainMenuScene and LevelSelectScene since none of them
 * animate their background art today (it's baked into the cover PNGs).
 */
export function attachSkyMotion(scene: Phaser.Scene, flashDepth = 90): void {
  const { width, height } = scene.cameras.main;
  const glowKey = ensureGlowTexture(scene);

  const blobs: { cx: number; cy: number; w: number; h: number; drift: number; period: number }[] = [
    { cx: width * 0.30, cy: height * 0.10, w: width * 0.85, h: height * 0.5, drift: width * 0.10, period: 8500 },
    { cx: width * 0.70, cy: height * 0.16, w: width * 0.70, h: height * 0.42, drift: width * 0.08, period: 11000 },
  ];

  blobs.forEach(({ cx, cy, w, h, drift, period }) => {
    const blob = scene.add.image(cx, cy, glowKey)
      .setDisplaySize(w, h)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(AURORA_CYAN)
      .setScrollFactor(0)
      .setDepth(0.4)
      .setAlpha(0.3);

    // Drift sideways = slow "wave" motion; edges stay soft at every position
    // since the source texture already fades to fully transparent.
    scene.tweens.add({
      targets: blob, x: cx + drift,
      duration: period, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
    scene.tweens.add({
      targets: blob, alpha: 0.14,
      duration: period * 0.6, ease: 'Sine.easeInOut', yoyo: true, repeat: -1,
    });
  });

  // ── Occasional lightning flash — sells the bolt already painted into the art ──
  const flash = scene.add.rectangle(width / 2, height / 2, width, height, FLASH_TINT)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setScrollFactor(0)
    .setDepth(flashDepth)
    .setAlpha(0);

  const scheduleFlash = () => {
    scene.time.delayedCall(Phaser.Math.Between(6000, 14000), () => {
      scene.tweens.add({
        targets: flash, alpha: { from: 0, to: 0.16 },
        duration: 90, yoyo: true, ease: 'Sine.easeOut',
        onComplete: scheduleFlash,
      });
    });
  };
  scheduleFlash();
}
