import Phaser from 'phaser';
import { IMAGES } from '../assetManifest';
import { drawCrystalPanel } from '../fx/crystalFrame';
import { getLayout } from '../utils/responsive';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Loading dialog — the shared Frame.png crystal frame, with the
    // progress bar seated in its content area.
    // On mobile landscape, shrink the panel so it doesn't overflow the viewport.
    const { mobile } = getLayout(width, height);
    const pW = Math.min(440, width  - 40);
    const pH = Math.min(230, height - 40);
    const panel = drawCrystalPanel(this, width / 2, height / 2, pW, pH, {
      title:    'ANGRY HẠC',
      subtitle: 'Đang kết tinh...',
    });

    const barW = mobile ? Math.min(280, pW - 80) : 330, barH = 26;
    const barX = width / 2 - barW / 2;
    const barY = panel.contentTop + 28;

    // Bar/text sit ABOVE the panel fill+frame art (depth 200/201)
    const progressBox = this.add.graphics().setDepth(202);
    progressBox.fillStyle(0x001050, 0.8);
    progressBox.fillRoundedRect(barX - 5, barY - 5, barW + 10, barH + 10, 8);
    progressBox.lineStyle(1.5, 0x48D0F8, 0.7);
    progressBox.strokeRoundedRect(barX - 5, barY - 5, barW + 10, barH + 10, 8);

    const progressBar = this.add.graphics().setDepth(202);

    const percentText = this.make.text({
      x: width / 2,
      y: barY + barH + 26,
      text: '0%',
      style: {
        font: '18px Outfit, sans-serif',
        color: '#A8F8F8'
      }
    }).setOrigin(0.5, 0.5).setDepth(202);

    // Event listeners for loading progress
    this.load.on('progress', (value: number) => {
      percentText.setText(parseInt((value * 100).toString()) + '%');
      progressBar.clear();
      progressBar.fillStyle(0x48D0F8, 1);
      progressBar.fillRoundedRect(barX, barY, barW * value, barH, 6);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      percentText.destroy();
      panel.objects.forEach(obj => obj.destroy());
    });

    // Load assets from the manifest (bundled URLs — works in dev AND production build).
    // Audio is deliberately NOT loaded here — see MainMenuScene.startBgMusic:
    // decodeAudioData() can hang indefinitely in some browser environments,
    // and this queue blocks scene transition until every entry resolves, so
    // a stuck audio decode would freeze the game on this loading screen
    // forever. Images only here keeps that failure mode impossible.
    for (const [key, url] of Object.entries(IMAGES)) {
      this.load.image(key, url);
    }
  }

  create() {
    // DEV-ONLY: ?scene=level | ?scene=game&level=2 boots straight into a scene
    // so headless screenshots can inspect them. Ignored in production.
    if (import.meta.env.DEV) {
      const p = new URLSearchParams(location.search);
      const s = p.get('scene');
      if (s === 'level') { this.scene.start('LevelSelectScene'); return; }
      if (s === 'game')  { this.scene.start('GameScene', { level: Number(p.get('level')) || 1 }); return; }
    }
    this.scene.start('MainMenuScene');
  }
}
