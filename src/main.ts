import { Engine } from './engine.ts';

const engine = new Engine(document.getElementById('canvas') as HTMLCanvasElement, {
  gridSize: 512,
  placementsPerFrame: 1000,
  pieces: [
    { type: 'knight', delta: [2, 1], id: 1, color: 0xff3333 },
    { type: 'knight', delta: [2, 1], id: 2, color: 0x3366ff },
  ],
});

try {
  await engine.start();
  console.log('Engine initialized');
} catch (error) {
  console.error('Error initializing engine:', error);
  document.body.innerHTML = `
    <div style="">
      <h1>Error initializing WebGPU engine</h1>
      <p>Please check your browser's WebGPU support and try again.</p>
      <p>${error.message}</p>
    </div>
  `;
}
