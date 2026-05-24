import { makeNeighborsFunction, makeIsAttackedByFunction } from './pieces';
import { Engine } from './engine.ts';

const engine = new Engine(document.getElementById('canvas') as HTMLCanvasElement, {
  gridSize: 2048,
  placementsPerFrame: 10_000,
  pieces: [
    {
      id: 1,
      color: 0xff3333,
      getNeighbors: makeNeighborsFunction([2, 1]),
      isAttackedBy: makeIsAttackedByFunction([2]),
    },
    {
      id: 2,
      color: 0x3366ff,
      getNeighbors: makeNeighborsFunction([2, 1]),
      isAttackedBy: makeIsAttackedByFunction([1]),
    },
    /*{
      id: 3,
      color: 0x44aa00,
      getNeighbors: makeNeighborsFunction([2, 1]),
      isAttackedBy: makeIsAttackedByFunction([1, 2]),
    },*/
  ],
});

try {
  await engine.start();
  console.log('Engine initialized');
} catch (error) {
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
