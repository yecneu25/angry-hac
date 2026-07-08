// src/game.ts
import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { PreloadScene } from './scenes/PreloadScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { LevelSelectScene } from './scenes/LevelSelectScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: window.innerWidth,
  height: window.innerHeight,
  parent: 'app',
  backgroundColor: '#000018',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'matter',
    matter: {
      debug: false,
      gravity: { x: 0, y: 1 },
      // Matter's default solver (positionIterations:6, velocityIterations:4,
      // constraintIterations:2) is tuned for simple scenes. Zero-gap stacked
      // towers need much stiffer contact resolution or they visibly sink/
      // separate on the very first physics step — this is Matter.js's
      // documented fix for "stacks collapsing on their own" (see
      // https://github.com/liabru/matter-js/wiki/Rendering, "Stability").
      positionIterations:   20,
      velocityIterations:   16,
      constraintIterations: 8,
      enableSleeping: true,
    }
  },
  scene: [BootScene, PreloadScene, MainMenuScene, LevelSelectScene, GameScene]
};

new Phaser.Game(config);
