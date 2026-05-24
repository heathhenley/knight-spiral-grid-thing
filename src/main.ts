import { Engine } from './engine.ts';

const engine = new Engine(document.getElementById('canvas') as HTMLCanvasElement, {
  gridSize: 2048,
  placementsPerFrame: 10_000,
  pieces: [
    { type: 'knight', delta: [2, 2], id: 1, color: 0xff3333 },
    { type: 'knight', delta: [3, 0], id: 2, color: 0x3366ff },
    //{ type: 'knight', delta: [3, 3], id: 3, color: 0x44aa00 },
    //{ type: 'knight', delta: [7, 3], id: 4, color: 0x66ff00 },
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
      <h1>Error initializing WebGPU engine</h1>
      <p>Please check your browser's WebGPU support and try again.</p>
      <p>${message}</p>
    </div>
  `;
}
