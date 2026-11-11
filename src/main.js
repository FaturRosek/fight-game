import Phaser from 'phaser';
import { gameConfig } from './config/gameConfig.js';

window.addEventListener('load', () => {
  new Phaser.Game(gameConfig);
});

