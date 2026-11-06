import Phaser from 'phaser';
import { DEPTH, GAME_WIDTH, GAME_HEIGHT } from '../config';

export function showEndScreen(scene: Phaser.Scene, title: string, color: string, hint: string) {
  const overlay = scene.add.rectangle(0, 0, GAME_WIDTH, GAME_HEIGHT, 0x000000, 0.6)
    .setOrigin(0).setDepth(DEPTH.OVERLAY).setScrollFactor(0);

  const titleText = scene.add.text(GAME_WIDTH / 2, 260, title, {
    fontFamily: 'monospace',
    fontSize: '56px',
    fontStyle: 'bold',
    color: color,
    stroke: '#000000',
    strokeThickness: 8
  }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);

  const hintText = scene.add.text(GAME_WIDTH / 2, 330, hint, {
    fontFamily: '"Noto Sans Thai", sans-serif',
    fontSize: '24px',
    color: '#ffffff',
    stroke: '#000000',
    strokeThickness: 4
  }).setOrigin(0.5).setDepth(DEPTH.OVERLAY_TEXT).setScrollFactor(0);

  overlay.setAlpha(0);
  titleText.setAlpha(0);
  hintText.setAlpha(0);
  scene.tweens.add({ targets: overlay, alpha: 0.6, duration: 400 });
  scene.tweens.add({ targets: [titleText, hintText], alpha: 1, duration: 400, delay: 200 });
}