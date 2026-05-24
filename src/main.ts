import { createControls, PIECE_MOVES } from './controls.ts';
import { Engine } from './engine.ts';
import { makeNeighborsFunction, makeIsAttackedByFunction } from './pieces';

const canvas = document.getElementById('canvas');
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error('Canvas element not found');
}
const canvasElement = canvas;

const PLACEMENTS_PER_FRAME = 10_000;
const controls = createControls();
let engine: Engine | null = null;

function makeEngine() {
  const config = controls.readConfig();
  controls.writeConfigToUrl(config);
  return new Engine(canvasElement, {
    gridSize: config.gridSize,
    placementsPerFrame: PLACEMENTS_PER_FRAME,
    pieces: config.pieces.map((pieceConfig, index) => {
      const delta = PIECE_MOVES[pieceConfig.moveKey];
      return {
        id: index + 1,
        color: pieceConfig.color,
        getNeighbors: makeNeighborsFunction([delta[0], delta[1]]),
        isAttackedBy: makeIsAttackedByFunction(pieceConfig.attackedBy),
      };
    }),
  });
}

function showInitializationError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('Error initializing engine:', error);
  document.body.innerHTML = `
    <div style="">
      <h1>Error initializing engine</h1>
      <p>Please check your browser's Canvas 2D support and try again.</p>
      <p>${message}</p>
    </div>
  `;
}

async function resetSimulation() {
  controls.resetButton.disabled = true;
  try {
    if (engine) {
      await engine.destroy();
    }
    engine = makeEngine();
    await engine.start();
    console.log('Engine initialized');
  } catch (error) {
    showInitializationError(error);
  } finally {
    controls.resetButton.disabled = false;
  }
}

controls.form.addEventListener('submit', (event) => {
  event.preventDefault();
  void resetSimulation();
});

await resetSimulation();
