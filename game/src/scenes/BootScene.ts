import Phaser from 'phaser';
import { BOOT_IMAGES } from '../assetManifest';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload() {
    // UI frame art loads here so the PreloadScene loading dialog can use it.
    for (const [key, url] of Object.entries(BOOT_IMAGES)) {
      this.load.image(key, url);
    }
  }

  create() {
    this.scene.start('PreloadScene');
  }
}
