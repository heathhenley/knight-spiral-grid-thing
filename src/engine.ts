import {
  centerRefToSpiralRef,
  spiralRefToCenterRef,
  centerRefToFlatIndex,
  maxSpiralIndexForGrid,
} from './coords.ts';

import type { Piece } from './pieces';

const BACKGROUND_COLOR = 0x1a1a1a;

export type EngineState = {
  placementsCompleted: number;
  pieceToPlaceNext: number;
  frameCount: number;
  // the next index that each piece can access (not occupied by opponent pieces)
  // and not attacked by opponent pieces
  nextSpiralIndexPerPiece: Map<number, number>;
  // attacked by map
  // the key is the spiral index, the values is the set of pieces ids that
  // are attacking this spiral index
  attackedByMap: Map<number, Set<number>>;
}

export type EngineConfig = {
  gridSize: number;
  placementsPerFrame: number;
  pieces: Piece[];
}

function writeCellColor(cells: Uint8ClampedArray<ArrayBuffer>, flatIndex: number, color: number) {
  const offset = flatIndex * 4;
  cells[offset] = (color >> 16) & 0xff;
  cells[offset + 1] = (color >> 8) & 0xff;
  cells[offset + 2] = color & 0xff;
  cells[offset + 3] = 255;
}


function isSpiralValidForPiece(
  spiralIndex: number,
  piece: Piece,
  occupied: Uint8Array,
  gridSize: number,
  attackedByMap: Map<number, Set<number>>,
): boolean {
  const centerRef = spiralRefToCenterRef(spiralIndex);
  const flatIndex = centerRefToFlatIndex(centerRef, gridSize);
  if (flatIndex < 0 || flatIndex >= occupied.length) {
    return false;
  }
  if (occupied[flatIndex] !== 0) {
    return false;
  }
  const attackedBy = attackedByMap.get(spiralIndex);
  if (!attackedBy || attackedBy.size === 0) {
    return true;
  }
  for (const attackerId of attackedBy) {
    if (piece.isAttackedBy(attackerId)) {
      return false;
    }
  }
  return true;
}

function advanceSpiralIndexForPiece(
  piece: Piece,
  fromSpiralIndex: number,
  occupied: Uint8Array,
  gridSize: number,
  attackedByMap: Map<number, Set<number>>,
  maxSpiralIndex: number,
): number | null {
  let next = fromSpiralIndex;
  while (next++ <= maxSpiralIndex) {
    if (isSpiralValidForPiece(next, piece, occupied, gridSize, attackedByMap)) {
      return next;
    }
  }
  return null;
}

/**
 * The Engine class is the main class for the engine.
 * Maintains the state of the sim and manages the loop - mostly to render a
 * number of updates per frame to make it look cool for any given settings.
 */
export class Engine {

  private context!: CanvasRenderingContext2D;
  private canvas: HTMLCanvasElement;
  private pixelCanvas!: HTMLCanvasElement;
  private pixelContext!: CanvasRenderingContext2D;
  private imageData!: ImageData;
  private requestAnimationFrameId: number | null = null;
  private onResize = () => this.resizeCanvas();

  private maxSpiralIndex!: number;

  private state: EngineState;
  private config: EngineConfig;

  // RGBA pixel colors; dirty rows are flushed to ImageData before drawing.
  private cells!: Uint8ClampedArray<ArrayBuffer>;
  private dirtyRows!: Uint8Array<ArrayBuffer>;
  // sim occupancy only — separate from color so background fills don't block placement
  private occupied!: Uint8Array<ArrayBuffer>;

  constructor(htmlCanvas: HTMLCanvasElement, config: EngineConfig) {
    this.canvas = htmlCanvas;
    this.config = config;
    this.state = {
      placementsCompleted: 0,
      pieceToPlaceNext: 0,
      frameCount: 0,
      nextSpiralIndexPerPiece: new Map(),
      attackedByMap: new Map(),
    };

    this.config.pieces.forEach((piece) => {
      this.state.nextSpiralIndexPerPiece.set(piece.id, 0);
    });
  }

  async initialize() {
    const context = this.canvas.getContext('2d');
    if (!context) {
      throw new Error('No Canvas 2D context found');
    }
    this.context = context;
    this.context.imageSmoothingEnabled = false;

    const { gridSize } = this.config;
    const pixelCount = gridSize * gridSize;

    // cache this because naive implementation is slow (fix later)
    this.maxSpiralIndex = maxSpiralIndexForGrid(gridSize);

    this.cells = new Uint8ClampedArray(pixelCount * 4);
    this.dirtyRows = new Uint8Array(gridSize);
    this.occupied = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      writeCellColor(this.cells, i, BACKGROUND_COLOR);
    }
    this.dirtyRows.fill(1);

    this.pixelCanvas = document.createElement('canvas');
    this.pixelCanvas.width = gridSize;
    this.pixelCanvas.height = gridSize;
    const pixelContext = this.pixelCanvas.getContext('2d');
    if (!pixelContext) {
      throw new Error('No pixel buffer Canvas 2D context found');
    }
    this.pixelContext = pixelContext;
    this.pixelContext.imageSmoothingEnabled = false;
    this.imageData = new ImageData(this.cells, gridSize, gridSize);

    this.resizeCanvas();
    window.addEventListener('resize', this.onResize);
  }

  private setCellColor(flatIndex: number, color: number) {
    writeCellColor(this.cells, flatIndex, color);
    this.dirtyRows[Math.floor(flatIndex / this.config.gridSize)] = 1;
  }

  private flushPixels() {
    const { dirtyRows } = this;
    let row = 0;

    while (row < dirtyRows.length) {
      while (row < dirtyRows.length && dirtyRows[row] === 0) {
        row++;
      }

      const startRow = row;
      while (row < dirtyRows.length && dirtyRows[row] !== 0) {
        row++;
      }

      if (row > startRow) {
        this.pixelContext.putImageData(
          this.imageData,
          0,
          0,
          0,
          startRow,
          this.config.gridSize,
          row - startRow,
        );
      }
    }

    dirtyRows.fill(0);
  }

  private placeNextPiece() {
    const pieceToPlaceNext = this.config.pieces[this.state.pieceToPlaceNext];
    const nextSpiralIndex = this.state.nextSpiralIndexPerPiece.get(pieceToPlaceNext.id)!;

    // place the piece on this index
    const centerRef = spiralRefToCenterRef(nextSpiralIndex);
    const nextFlatIndex = centerRefToFlatIndex(centerRef, this.config.gridSize);
    this.setCellColor(nextFlatIndex, pieceToPlaceNext.color);
    this.occupied[nextFlatIndex] = 1;


    // update the attacked by map using the piece's neighbors
    pieceToPlaceNext.getNeighbors(centerRef).forEach((neighbor) => {
      const spiralIndex = centerRefToSpiralRef(neighbor);
      const attackedBy = this.state.attackedByMap.get(spiralIndex);
      if (attackedBy) {
        attackedBy.add(pieceToPlaceNext.id);
      } else {
        this.state.attackedByMap.set(spiralIndex, new Set([pieceToPlaceNext.id]));
      }
    })

    // the piece that just placed must always walk forward from where it landed.
    const nextForPlacedPiece = advanceSpiralIndexForPiece(
      pieceToPlaceNext,
      nextSpiralIndex,
      this.occupied,
      this.config.gridSize,
      this.state.attackedByMap,
      this.maxSpiralIndex,
    );
    if (nextForPlacedPiece !== null) {
      this.state.nextSpiralIndexPerPiece.set(pieceToPlaceNext.id, nextForPlacedPiece);
    }

    // other pieces keep their current target if it is still valid; only
    // advance when the new placement or attacks rule it out.
    this.config.pieces.forEach((piece) => {
      if (piece.id === pieceToPlaceNext.id) {
        return;
      }
      const currentSpiralIndex = this.state.nextSpiralIndexPerPiece.get(piece.id)!;
      if (isSpiralValidForPiece(
        currentSpiralIndex,
        piece,
        this.occupied,
        this.config.gridSize,
        this.state.attackedByMap,
      )) {
        return;
      }
      const nextForPiece = advanceSpiralIndexForPiece(
        piece,
        currentSpiralIndex,
        this.occupied,
        this.config.gridSize,
        this.state.attackedByMap,
        this.maxSpiralIndex,
      );
      if (nextForPiece !== null) {
        this.state.nextSpiralIndexPerPiece.set(piece.id, nextForPiece);
      }
    });


  }

  update() {

    this.state.frameCount++;

    for (let i = 0; i < this.config.placementsPerFrame; i++) {
      this.placeNextPiece();
      this.state.pieceToPlaceNext = (this.state.pieceToPlaceNext + 1) % this.config.pieces.length;
      this.state.placementsCompleted++;
    }
  }

  render() {
    this.flushPixels();
    this.context.imageSmoothingEnabled = false;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(this.pixelCanvas, 0, 0, this.canvas.width, this.canvas.height);
  }

  async start() {
    await this.initialize();
    const loop = () => {
      this.update();
      this.render();
      this.requestAnimationFrameId = requestAnimationFrame(loop);
    }
    loop();
  }

  async stop() {
    if (this.requestAnimationFrameId) {
      cancelAnimationFrame(this.requestAnimationFrameId);
      this.requestAnimationFrameId = null;
    }
  }

  async destroy() {
    this.stop();
    window.removeEventListener('resize', this.onResize);
  }

  private resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
  }
}