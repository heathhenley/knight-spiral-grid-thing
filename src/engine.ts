import { flatIndexToTopLeftRef } from './coords.ts';

export type Piece = {
  type: 'knight';
  // the delta is how to derive it's moves, so [2, 1] means it can go:
  // x +- 2, y +- 1 --> should be 8 moves possible for a knight
  delta: [number, number];
  id: number;
  color: number;
}

export type EngineState = {
  placementsCompleted: number;
  pieceToPlaceNext: number;
  frameCount: number;
  lastFrameTime: number;
}

export type EngineConfig = {
  gridSize: number;
  placementsPerFrame: number;
  pieces: Piece[];
}


function drawDebugGrid({
  canvas,
  ctx,
  cells,
  gridSize,
}: {
  canvas: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  cells: Uint32Array;
  gridSize: number;
}) {
  // get cell size from the canvas width and height
  const cellWidth = canvas.width / gridSize;
  const cellHeight = canvas.height / gridSize;
  //console.log(`cellWidth: ${cellWidth}, cellHeight: ${cellHeight}`);
  //console.log(`gridSize: ${gridSize}`);
  //console.log(`canvas.width: ${canvas.width}, canvas.height: ${canvas.height}`);
  // clear the canvas first
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  // fill with it's value (text)
  // clear the canvas first
  ctx.font = `bold ${cellHeight * 0.35}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  cells.forEach((cell, idx) => {
    const { x, y } = flatIndexToTopLeftRef(idx, gridSize);
    const [tl_x, tl_y] = [x * cellWidth, y * cellHeight];
    const cx = tl_x + cellWidth / 2;
    const cy = tl_y + cellHeight / 2;
    ctx.fillText(String(cell), cx, cy);
    // add a border to the cell
    ctx.strokeRect(tl_x, tl_y, cellWidth, cellHeight);
  });
}

/**
 * The Engine class is the main class for the engine.
 * Maintains the state of the sim and manages the loop - mostly to render a
 * number of updates per frame to make it look cool for any given settings.
 */
export class Engine {

  private device: GPUDevice;
  private context: GPUCanvasContext;
  private adapter: GPUAdapter;
  private canvas: HTMLCanvasElement;
  private requestAnimationFrameId: number | null = null;

  private debugCanvas: HTMLCanvasElement | null = null;
  private debugCanvasCtx: CanvasRenderingContext2D | null = null;

  private state: EngineState;
  private config: EngineConfig;


  // 2d array of cells, they will be the color of the piece on them, or
  // background color if no piece is on them.
  private cells: Uint32Array; 
  // the next index that each piece can access
  private nextIndexPerPiece: Uint32Array;

  constructor(htmlCanvas: HTMLCanvasElement, config: EngineConfig, debugCanvas: HTMLCanvasElement | null = null) {
    this.canvas = htmlCanvas;
    this.config = config;
    this.state = {
      placementsCompleted: 0,
      pieceToPlaceNext: 0,
      frameCount: 0,
      lastFrameTime: 0,
    };
    if (debugCanvas) {
      this.debugCanvas = debugCanvas;
      this.debugCanvasCtx = this.debugCanvas.getContext('2d') as CanvasRenderingContext2D;
    }
  }

  async initialize() {
    /* try to get a webgpu adapter */
    this.adapter = await navigator.gpu.requestAdapter();
    if (!this.adapter) {
      throw new Error('No WebGPU adapter found');
    }
    /* try to get a webgpu device */
    this.device = await this.adapter.requestDevice();
    if (!this.device) {
      throw new Error('No WebGPU device found');
    }
    /* try to get a webgpu canvas context */
    this.context = this.canvas.getContext('webgpu') as GPUCanvasContext;
    if (!this.context) {
      throw new Error('No WebGPU canvas context found');
    }
    /* configure the canvas context */
    await this.context.configure({
      device: this.device,
      format: navigator.gpu.getPreferredCanvasFormat(),
    });
    console.log(this.device);
    console.log(this.device.features);
    console.log(this.device.limits);
    console.log(this.device.label);
    console.log("GPU adapter found!");

    /* initialize the cells */
    this.cells = new Uint32Array(this.config.gridSize * this.config.gridSize);
    this.nextIndexPerPiece = new Uint32Array(this.config.pieces.length).fill(0);
  
    /* resize the canvas */
    this.resizeCanvas();
    /* add a resize listener */
    window.addEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  async update() {
    /* update the state */
    // each update will place one piece
    // 1. place it on the board at the next index for this piece
    // 2. update the next index for the other pieces, if we ruled out any of
    //    their next indices, we need to step them forward to the next valid
    //    index.
    // 3. update which piece is next to place, and increment the frame count
    this.state.frameCount++;
    // zeroth thing to sort out: draw a grid of cells, and fill them with their
    // numbers so we can make sure sure that we're correctly indexing the cells
    // first thing to sort out:
    // loop over the cells and draw them
    for (let x = 0; x < this.config.gridSize; x++) {
      for (let y = 0; y < this.config.gridSize; y++) {
        const idx = x * this.config.gridSize + y;
        this.cells[idx] = idx;
      }
    }
    // - how to walk the board in a spiral patten, starting at center
    // - we also need to go from normal indices (0, 0) is the top left, to
    //   the board indices with (0, 0) meaning the middle
  }

  async render() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.state.lastFrameTime;
    this.state.lastFrameTime = currentTime;
    const fps = 1000 / deltaTime;
    console.log(`FPS: ${fps} - Frame count: ${this.state.frameCount}`);

    if (this.debugCanvas) {
      drawDebugGrid({
        canvas: this.debugCanvas,
        ctx: this.debugCanvasCtx,
        cells: this.cells,
        gridSize: this.config.gridSize,
      });
    }

  }

  async start() {
    await this.initialize();
    const loop = async () => {
      await this.update(); // update the state (not implemented yet)
      await this.render(); // render the state (not implemented yet)
      this.requestAnimationFrameId = requestAnimationFrame(async () => await loop());
    }
    await loop();
  }

  async stop() {
    if (this.requestAnimationFrameId) {
      cancelAnimationFrame(this.requestAnimationFrameId);
      this.requestAnimationFrameId = null;
    }
  }

  async destroy() {
    this.stop();
    this.device.destroy();
    window.removeEventListener('resize', () => {
      this.resizeCanvas();
    });
  }

  private resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.floor(window.innerWidth * dpr);
    const height = Math.floor(window.innerHeight * dpr);
    // set the canvas width and height
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.debugCanvas) {
      this.debugCanvas.width = width;
      this.debugCanvas.height = height;
    }
  }
}