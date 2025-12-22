import './style.css';
import { GameController } from './game';

const sceneRoot = document.getElementById('scene');
const uiRoot = document.getElementById('hud');

if (!sceneRoot || !uiRoot) {
  throw new Error('Missing scene or hud root elements.');
}

const game = new GameController(sceneRoot, uiRoot);

game.start();
