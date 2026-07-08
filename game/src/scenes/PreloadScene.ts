import Phaser from 'phaser';
import { IMAGES } from '../assetManifest';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload() {
    const width = this.cameras.main.width;
    const height = this.cameras.main.height;

    // Create progress bar elements styled according to design tokens
    const progressBar = this.add.graphics();
    const progressBox = this.add.graphics();
    progressBox.fillStyle(0x002070, 0.8);
    progressBox.fillRoundedRect(width / 2 - 160, height / 2 - 25, 320, 50, 10);

    // Text indicators
    const loadingText = this.make.text({
      x: width / 2,
      y: height / 2 - 50,
      text: 'Đang kết tinh...',
      style: {
        font: '20px Outfit, sans-serif',
        color: '#48D0F8'
      }
    }).setOrigin(0.5, 0.5);

    const percentText = this.make.text({
      x: width / 2,
      y: height / 2,
      text: '0%',
      style: {
        font: '18px Outfit, sans-serif',
        color: '#A8F8F8'
      }
    }).setOrigin(0.5, 0.5);

    // Event listeners for loading progress
    this.load.on('progress', (value: number) => {
      percentText.setText(parseInt((value * 100).toString()) + '%');
      progressBar.clear();
      progressBar.fillStyle(0x48D0F8, 1);
      // Fill inside progressBox with small margin
      progressBar.fillRoundedRect(width / 2 - 150, height / 2 - 15, 300 * value, 30, 6);
    });

    this.load.on('complete', () => {
      progressBar.destroy();
      progressBox.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Load assets from the manifest (bundled URLs — works in dev AND production build)
    for (const [key, url] of Object.entries(IMAGES)) {
      this.load.image(key, url);
    }
  }

  create() {
    this.scene.start('MainMenuScene');
  }
}
