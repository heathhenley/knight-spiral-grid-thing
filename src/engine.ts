import { flatIndexToTopLeftRef, centerRefToSpiralRef, spiralRefToCenterRef, maxSpiralIndexForGrid, type CenterRef, centerRefToFlatIndex } from './coords.ts';

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
  // the next index that each piece can access (not occupied by opponent pieces)
  // and not attacked by opponent pieces
  nextSpiralIndexPerPiece: Map<number, number>;
  ended: boolean;

  // attacked by map
  // the key is the spiral index, the values is the set of pieces ids that
  // are attacking this spiral index
  attackedByMap: Map<number, Set<number>>;
}

export type EngineConfig = {
  gridSize: number;
  framesPerPlacement: number;
  pieces: Piece[];
}

function isSpiralValidForPiece(
  spiralIndex: number,
  piece: Piece,
  cells: Uint32Array,
  gridSize: number,
  attackedByMap: Map<number, Set<number>>,
): boolean {
  const centerRef = spiralRefToCenterRef(spiralIndex);
  const flatIndex = centerRefToFlatIndex(centerRef, gridSize);
  if (flatIndex < 0 || flatIndex >= cells.length) {
    return false;
  }
  if (cells[flatIndex] !== 0) {
    return false;
  }
  const attackedBy = attackedByMap.get(spiralIndex);
  if (!attackedBy || attackedBy.size === 0) {
    return true;
  }
  // blocked by opponent attacks; own attacks do not block
  for (const attackerId of attackedBy) {
    if (attackerId !== piece.id) {
      return false;
    }
  }
  return true;
}

function advanceSpiralIndexForPiece(
  piece: Piece,
  fromSpiralIndex: number,
  cells: Uint32Array,
  gridSize: number,
  attackedByMap: Map<number, Set<number>>,
): number | null {
  const maxSpiral = maxSpiralIndexForGrid(gridSize);
  let next = fromSpiralIndex;
  while (next++ <= maxSpiral) {
    if (isSpiralValidForPiece(next, piece, cells, gridSize, attackedByMap)) {
      return next;
    }
  }
  return null;
}

function expandDelta({ x, y }: CenterRef, [dx, dy]: [number, number]): CenterRef[] {
  return [
    { x: x + dx, y: y + dy },
    { x: x - dx, y: y + dy },
    { x: x + dx, y: y - dy },
    { x: x - dx, y: y - dy },
    { x: x + dy, y: y + dx },
    { x: x - dy, y: y + dx },
    { x: x + dy, y: y - dx },
    { x: x - dy, y: y - dx },
  ];
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
  ctx.font = `bold ${cellHeight * 0.15}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  cells.forEach((cell, idx) => {
    //const centerRef = flatIndexToCenterRef(idx, gridSize);
    //const text = `(${centerRef.x},${centerRef.y}) --> ${cell}`;
    const { x, y } = flatIndexToTopLeftRef(idx, gridSize);
    const [tl_x, tl_y] = [x * cellWidth, y * cellHeight];
    //const cx = tl_x + cellWidth / 2;
    //const cy = tl_y + cellHeight / 2;
    if (cell === 1) {
      ctx.fillStyle = 'red';
      ctx.fillRect(tl_x, tl_y, cellWidth, cellHeight);
    }
    if (cell === 2) {
      ctx.fillStyle = 'blue';
      ctx.fillRect(tl_x, tl_y, cellWidth, cellHeight);
    }
    ctx.fillStyle = 'black';
    //ctx.fillText(String(cell), cx, cy);
    //ctx.fillText(text, cx, cy);
    // add a border to the cell
    //ctx.strokeRect(tl_x, tl_y, cellWidth, cellHeight);
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
      nextSpiralIndexPerPiece: new Map(),
      attackedByMap: new Map(),
      ended: false,
    }

    // initialize the next spiral index for each piece
    this.config.pieces.forEach((piece) => {
      this.state.nextSpiralIndexPerPiece.set(piece.id, 0);
    });

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
    if (this.state.ended) {
      return;
    }
    this.state.frameCount++;

    if (this.state.frameCount % this.config.framesPerPlacement !== 0) {
      return;
    }

    this.state.placementsCompleted++;
    // zeroth thing to sort out: draw a grid of cells, and fill them with their
    // numbers so we can make sure sure that we're correctly indexing the cells
    // first thing to sort out:
    // loop over the cells and draw them
    /*this.cells.forEach((_, idx) => {
      const { x, y } = flatIndexToTopLeftRef(idx, this.config.gridSize);
      const centerRef = topLeftRefToCenterRef({ x, y }, this.config.gridSize);
      this.cells[idx] = centerRefToSpiralRef(centerRef);
    });*/

    // get the piece that is next to place
    const pieceToPlaceNext = this.config.pieces[this.state.pieceToPlaceNext];

    // get the next index that this piece can access)
    const nextSpiralIndex = this.state.nextSpiralIndexPerPiece.get(pieceToPlaceNext.id);

    console.log(`nextSpiralIndex: ${nextSpiralIndex}`);
    console.log(`pieceToPlaceNext: ${pieceToPlaceNext.id}`);
    console.log(`pieceToPlaceNext: ${pieceToPlaceNext.type}`);
    console.log(`pieceToPlaceNext delta: ${pieceToPlaceNext.delta}`);
    console.log(`pieceToPlaceNext color: ${pieceToPlaceNext.color}`);

    // place the piece on this index
    // center ref
    const centerRef = spiralRefToCenterRef(nextSpiralIndex);
    const nextFlatIndex = centerRefToFlatIndex(centerRef, this.config.gridSize);
    this.cells[nextFlatIndex] = pieceToPlaceNext.id;


    // update the attacked by map using the piece's deltas
    expandDelta(
      centerRef,
      pieceToPlaceNext.delta
    ).forEach(({ x, y }) => {
      const spiralIndex = centerRefToSpiralRef({ x, y });
      const attackedBy = this.state.attackedByMap.get(spiralIndex);
      if (attackedBy) {
        attackedBy.add(pieceToPlaceNext.id);
      } else {
        this.state.attackedByMap.set(spiralIndex, new Set([pieceToPlaceNext.id]));
      }
      // for debug - make all the attacked by cells the same color as the piece
      //const flatIndex = centerRefToFlatIndex({ x, y }, this.config.gridSize);
      //this.cells[flatIndex] = pieceToPlaceNext.id;
    })


    // Piece that just placed must always walk forward from where it landed.
    const nextForPlacedPiece = advanceSpiralIndexForPiece(
      pieceToPlaceNext,
      nextSpiralIndex,
      this.cells,
      this.config.gridSize,
      this.state.attackedByMap,
    );
    if (nextForPlacedPiece !== null) {
      this.state.nextSpiralIndexPerPiece.set(pieceToPlaceNext.id, nextForPlacedPiece);
    }

    // Other pieces keep their current target if it is still valid; only
    // advance when the new placement or attacks rule it out.
    this.config.pieces.forEach((piece) => {
      if (piece.id === pieceToPlaceNext.id) {
        return;
      }
      const currentSpiralIndex = this.state.nextSpiralIndexPerPiece.get(piece.id)!;
      if (isSpiralValidForPiece(
        currentSpiralIndex,
        piece,
        this.cells,
        this.config.gridSize,
        this.state.attackedByMap,
      )) {
        return;
      }
      const nextForPiece = advanceSpiralIndexForPiece(
        piece,
        currentSpiralIndex,
        this.cells,
        this.config.gridSize,
        this.state.attackedByMap,
      );
      if (nextForPiece !== null) {
        this.state.nextSpiralIndexPerPiece.set(piece.id, nextForPiece);
      }
    });

    // update the next piece to place
    this.state.pieceToPlaceNext = (this.state.pieceToPlaceNext + 1) % this.config.pieces.length;

  }

  async render() {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.state.lastFrameTime;
    this.state.lastFrameTime = currentTime;
    const fps = 1000 / deltaTime;
    //console.log(`FPS: ${fps} - Frame count: ${this.state.frameCount}`);

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