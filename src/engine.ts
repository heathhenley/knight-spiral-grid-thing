import {
  centerRefToTopLeftRef,
  spiralRefToCenterRef,
  maxSpiralIndexForGrid,
} from './coords.ts';

import type { Piece } from './pieces';
import type { CenterRef } from './coords';

const BACKGROUND_COLOR = 0x1a1a1a;

export type EngineState = {
  placementsCompleted: number;
  pieceToPlaceNext: number;
  frameCount: number;
  // the next index that each piece can access (not occupied by opponent pieces)
  // and not attacked by opponent pieces
  nextSpiralIndexPerPiece: Map<number, number>;
  exhaustedPieceIds: Set<number>;
  isComplete: boolean;
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

function centerRefToValidFlatIndex(centerRef: CenterRef, gridSize: number): number | null {
  const topLeftRef = centerRefToTopLeftRef(centerRef, gridSize);
  if (
    topLeftRef.x < 0 ||
    topLeftRef.x >= gridSize ||
    topLeftRef.y < 0 ||
    topLeftRef.y >= gridSize
  ) {
    return null;
  }

  return topLeftRef.y * gridSize + topLeftRef.x;
}

function pieceIdToAttackMask(pieceId: number) {
  if (pieceId < 1 || pieceId > 32) {
    throw new Error(`Piece id ${pieceId} cannot be stored in the attack mask`);
  }
  return 2 ** (pieceId - 1);
}

function isAttackedByMask(piece: Piece, attackedByMask: number) {
  if (attackedByMask === 0) {
    return false;
  }

  for (let attackerId = 1; attackerId <= 32; attackerId++) {
    if ((attackedByMask & pieceIdToAttackMask(attackerId)) !== 0 && piece.isAttackedBy(attackerId)) {
      return true;
    }
  }

  return false;
}

function isSpiralValidForPiece(
  spiralIndex: number,
  piece: Piece,
  occupied: Uint8Array,
  gridSize: number,
  attackedByMasks: Uint32Array,
): boolean {
  const centerRef = spiralRefToCenterRef(spiralIndex);
  const flatIndex = centerRefToValidFlatIndex(centerRef, gridSize);
  if (flatIndex === null) {
    return false;
  }
  if (occupied[flatIndex] !== 0) {
    return false;
  }
  return !isAttackedByMask(piece, attackedByMasks[flatIndex]);
}

function advanceSpiralIndexForPiece(
  piece: Piece,
  fromSpiralIndex: number,
  occupied: Uint8Array,
  gridSize: number,
  attackedByMasks: Uint32Array,
  maxSpiralIndex: number,
): number | null {
  let next = fromSpiralIndex;
  while (next++ <= maxSpiralIndex) {
    if (isSpiralValidForPiece(next, piece, occupied, gridSize, attackedByMasks)) {
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
  private onPointerDown = (event: PointerEvent) => this.startPan(event);
  private onPointerMove = (event: PointerEvent) => this.pan(event);
  private onPointerUp = (event: PointerEvent) => this.endPan(event);
  private onWheel = (event: WheelEvent) => this.zoom(event);

  private viewScale = 1;
  private viewOffsetX = 0;
  private viewOffsetY = 0;
  private isPanning = false;
  private lastPointerX = 0;
  private lastPointerY = 0;
  private hasCustomView = false;

  private maxSpiralIndex!: number;

  private state: EngineState;
  private config: EngineConfig;

  // RGBA pixel colors; dirty rows are flushed to ImageData before drawing.
  private cells!: Uint8ClampedArray<ArrayBuffer>;
  private dirtyRows!: Uint8Array<ArrayBuffer>;
  // sim occupancy only — separate from color so background fills don't block placement
  private occupied!: Uint8Array<ArrayBuffer>;
  // Per-board-cell bit mask of piece ids attacking that cell.
  private attackedByMasks!: Uint32Array<ArrayBuffer>;

  constructor(htmlCanvas: HTMLCanvasElement, config: EngineConfig) {
    this.canvas = htmlCanvas;
    this.config = config;
    this.state = {
      placementsCompleted: 0,
      pieceToPlaceNext: 0,
      frameCount: 0,
      nextSpiralIndexPerPiece: new Map(),
      exhaustedPieceIds: new Set(),
      isComplete: false,
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
    this.attackedByMasks = new Uint32Array(pixelCount);
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
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false });
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

  private markPieceExhausted(pieceId: number) {
    this.state.exhaustedPieceIds.add(pieceId);
    if (this.state.exhaustedPieceIds.size >= this.config.pieces.length) {
      this.state.isComplete = true;
    }
  }

  private advancePieceTurn() {
    if (this.state.isComplete) {
      return;
    }

    for (let offset = 1; offset <= this.config.pieces.length; offset++) {
      const nextIndex = (this.state.pieceToPlaceNext + offset) % this.config.pieces.length;
      const piece = this.config.pieces[nextIndex];
      if (!this.state.exhaustedPieceIds.has(piece.id)) {
        this.state.pieceToPlaceNext = nextIndex;
        return;
      }
    }

    this.state.isComplete = true;
  }

  private placeNextPiece(): boolean {
    const pieceToPlaceNext = this.config.pieces[this.state.pieceToPlaceNext];
    if (this.state.exhaustedPieceIds.has(pieceToPlaceNext.id)) {
      return false;
    }
    const nextSpiralIndex = this.state.nextSpiralIndexPerPiece.get(pieceToPlaceNext.id);
    if (nextSpiralIndex === undefined) {
      this.markPieceExhausted(pieceToPlaceNext.id);
      return false;
    }

    // place the piece on this index
    const centerRef = spiralRefToCenterRef(nextSpiralIndex);
    const nextFlatIndex = centerRefToValidFlatIndex(centerRef, this.config.gridSize);
    if (nextFlatIndex === null) {
      this.markPieceExhausted(pieceToPlaceNext.id);
      return false;
    }
    this.setCellColor(nextFlatIndex, pieceToPlaceNext.color);
    this.occupied[nextFlatIndex] = 1;


    // Update attack masks only for cells that are actually on the board.
    const attackMask = pieceIdToAttackMask(pieceToPlaceNext.id);
    pieceToPlaceNext.getNeighbors(centerRef).forEach((neighbor) => {
      const flatIndex = centerRefToValidFlatIndex(neighbor, this.config.gridSize);
      if (flatIndex !== null) {
        this.attackedByMasks[flatIndex] |= attackMask;
      }
    })

    // the piece that just placed must always walk forward from where it landed.
    const nextForPlacedPiece = advanceSpiralIndexForPiece(
      pieceToPlaceNext,
      nextSpiralIndex,
      this.occupied,
      this.config.gridSize,
      this.attackedByMasks,
      this.maxSpiralIndex,
    );
    if (nextForPlacedPiece !== null) {
      this.state.nextSpiralIndexPerPiece.set(pieceToPlaceNext.id, nextForPlacedPiece);
    } else {
      this.markPieceExhausted(pieceToPlaceNext.id);
    }

    // other pieces keep their current target if it is still valid; only
    // advance when the new placement or attacks rule it out.
    this.config.pieces.forEach((piece) => {
      if (piece.id === pieceToPlaceNext.id) {
        return;
      }
      if (this.state.exhaustedPieceIds.has(piece.id)) {
        return;
      }
      const currentSpiralIndex = this.state.nextSpiralIndexPerPiece.get(piece.id)!;
      if (isSpiralValidForPiece(
        currentSpiralIndex,
        piece,
        this.occupied,
        this.config.gridSize,
        this.attackedByMasks,
      )) {
        return;
      }
      const nextForPiece = advanceSpiralIndexForPiece(
        piece,
        currentSpiralIndex,
        this.occupied,
        this.config.gridSize,
        this.attackedByMasks,
        this.maxSpiralIndex,
      );
      if (nextForPiece !== null) {
        this.state.nextSpiralIndexPerPiece.set(piece.id, nextForPiece);
      } else {
        this.markPieceExhausted(piece.id);
      }
    });

    return true;
  }

  update() {
    if (this.state.isComplete) {
      return;
    }

    this.state.frameCount++;

    for (let i = 0; i < this.config.placementsPerFrame && !this.state.isComplete; i++) {
      if (this.placeNextPiece()) {
        this.state.placementsCompleted++;
      }
      this.advancePieceTurn();
    }
  }

  render() {
    this.flushPixels();
    this.context.imageSmoothingEnabled = false;
    this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.context.drawImage(
      this.pixelCanvas,
      this.viewOffsetX,
      this.viewOffsetY,
      this.config.gridSize * this.viewScale,
      this.config.gridSize * this.viewScale,
    );
  }

  async start() {
    await this.initialize();
    const loop = () => {
      if (!this.state.isComplete) {
        this.update();
      }
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
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    this.canvas.removeEventListener('wheel', this.onWheel);
  }

  private resizeCanvas() {
    const previousCenter = this.canvasToBoardPoint(this.canvas.width / 2, this.canvas.height / 2);
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.floor((rect.width || window.innerWidth) * dpr);
    this.canvas.height = Math.floor((rect.height || window.innerHeight) * dpr);
    this.context.imageSmoothingEnabled = false;

    if (!this.hasCustomView || !previousCenter) {
      this.resetViewToFillWidth();
      return;
    }

    this.viewOffsetX = (this.canvas.width / 2) - previousCenter.x * this.viewScale;
    this.viewOffsetY = (this.canvas.height / 2) - previousCenter.y * this.viewScale;
  }

  private resetViewToFillWidth() {
    this.viewScale = this.canvas.width / this.config.gridSize;
    this.viewOffsetX = (this.canvas.width - this.config.gridSize * this.viewScale) / 2;
    this.viewOffsetY = (this.canvas.height - this.config.gridSize * this.viewScale) / 2;
  }

  private getCanvasPoint(event: PointerEvent | WheelEvent) {
    const rect = this.canvas.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * this.canvas.width,
      y: ((event.clientY - rect.top) / rect.height) * this.canvas.height,
    };
  }

  private canvasToBoardPoint(x: number, y: number) {
    if (this.viewScale === 0) {
      return null;
    }
    return {
      x: (x - this.viewOffsetX) / this.viewScale,
      y: (y - this.viewOffsetY) / this.viewScale,
    };
  }

  private startPan(event: PointerEvent) {
    if (event.button !== 0) {
      return;
    }

    const point = this.getCanvasPoint(event);
    this.isPanning = true;
    this.hasCustomView = true;
    this.lastPointerX = point.x;
    this.lastPointerY = point.y;
    this.canvas.setPointerCapture(event.pointerId);
  }

  private pan(event: PointerEvent) {
    if (!this.isPanning) {
      return;
    }

    const point = this.getCanvasPoint(event);
    this.viewOffsetX += point.x - this.lastPointerX;
    this.viewOffsetY += point.y - this.lastPointerY;
    this.lastPointerX = point.x;
    this.lastPointerY = point.y;
  }

  private endPan(event: PointerEvent) {
    if (!this.isPanning) {
      return;
    }

    this.isPanning = false;
    this.canvas.releasePointerCapture(event.pointerId);
  }

  private zoom(event: WheelEvent) {
    event.preventDefault();

    const point = this.getCanvasPoint(event);
    const boardPoint = this.canvasToBoardPoint(point.x, point.y);
    if (!boardPoint) {
      return;
    }

    const zoomFactor = Math.exp(-event.deltaY * 0.001);
    const minScale = Math.min(this.canvas.width, this.canvas.height) / this.config.gridSize / 8;
    const maxScale = 128;
    this.viewScale = Math.min(maxScale, Math.max(minScale, this.viewScale * zoomFactor));
    this.viewOffsetX = point.x - boardPoint.x * this.viewScale;
    this.viewOffsetY = point.y - boardPoint.y * this.viewScale;
    this.hasCustomView = true;
  }
}