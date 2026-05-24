import {
  centerRefToSpiralRef,
  spiralRefToCenterRef,
  type CenterRef,
  centerRefToFlatIndex,
  maxSpiralIndexForGrid,
} from './coords.ts';

const PIXEL_SHADER_WGSL = /* wgsl */ `
struct VertexOut {
  @builtin(position) position: vec4f,
  @location(0) uv: vec2f,
}

@group(0) @binding(0) var pixels: texture_2d<f32>;
@group(0) @binding(1) var pixelSampler: sampler;

@vertex
fn vs(@builtin(vertex_index) vertexIndex: u32) -> VertexOut {
  let pos = array(
    vec2f(-1.0, -1.0),
    vec2f( 3.0, -1.0),
    vec2f(-1.0,  3.0),
  );

  var out: VertexOut;
  let vertexPos = pos[vertexIndex];
  out.position = vec4f(vertexPos, 0.0, 1.0);
  out.uv = vec2f(vertexPos.x * 0.5 + 0.5, 0.5 - vertexPos.y * 0.5);
  return out;
}

@fragment
fn fs(in: VertexOut) -> @location(0) vec4f {
  return textureSample(pixels, pixelSampler, in.uv);
}
`;

const BACKGROUND_COLOR = 0x1a1a1a;

function writeCellColor(cells: Uint8Array<ArrayBuffer>, flatIndex: number, color: number) {
  const offset = flatIndex * 4;
  cells[offset] = (color >> 16) & 0xff;
  cells[offset + 1] = (color >> 8) & 0xff;
  cells[offset + 2] = color & 0xff;
  cells[offset + 3] = 255;
}

function alignedRowBytes(width: number): number {
  return Math.ceil((width * 4) / 256) * 256;
}

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
  placementsPerFrame: number;
  pieces: Piece[];
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


/**
 * The Engine class is the main class for the engine.
 * Maintains the state of the sim and manages the loop - mostly to render a
 * number of updates per frame to make it look cool for any given settings.
 */
export class Engine {

  private device!: GPUDevice;
  private context!: GPUCanvasContext;
  private adapter!: GPUAdapter;
  private canvas: HTMLCanvasElement;
  private requestAnimationFrameId: number | null = null;
  private onResize = () => this.resizeCanvas();


  private canvasFormat!: GPUTextureFormat;
  private pixelTexture!: GPUTexture;
  private pixelSampler!: GPUSampler;
  private bindGroup!: GPUBindGroup;
  private pipeline!: GPURenderPipeline;
  private uploadBuffer!: Uint8Array<ArrayBuffer>;
  private rowBytes!: number;
  private maxSpiralIndex!: number;

  private state: EngineState;
  private config: EngineConfig;

  // RGBA pixel colors; dirty rows are uploaded to the GPU before drawing.
  private cells!: Uint8Array<ArrayBuffer>;
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
      ended: false,
    };

    this.config.pieces.forEach((piece) => {
      this.state.nextSpiralIndexPerPiece.set(piece.id, 0);
    });
  }

  async initialize() {
    /* try to get a webgpu adapter */
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      throw new Error('No WebGPU adapter found');
    }
    this.adapter = adapter;
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
    this.canvasFormat = navigator.gpu.getPreferredCanvasFormat();
    this.context.configure({
      device: this.device,
      format: this.canvasFormat,
    });

    const { gridSize } = this.config;
    const pixelCount = gridSize * gridSize;

    // cache this because naive implementation is slow (fix later)
    this.maxSpiralIndex = maxSpiralIndexForGrid(gridSize);

    this.cells = new Uint8Array(pixelCount * 4);
    this.dirtyRows = new Uint8Array(gridSize);
    this.occupied = new Uint8Array(pixelCount);
    for (let i = 0; i < pixelCount; i++) {
      writeCellColor(this.cells, i, BACKGROUND_COLOR);
    }
    this.dirtyRows.fill(1);

    this.rowBytes = alignedRowBytes(gridSize);
    this.uploadBuffer = new Uint8Array(this.rowBytes * gridSize);

    this.resizeCanvas();
    this.initRenderer();
    window.addEventListener('resize', this.onResize);
  }

  private initRenderer() {
    const { device, config } = this;
    const gridSize = config.gridSize;

    this.pixelTexture = device.createTexture({
      size: [gridSize, gridSize],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    this.pixelSampler = device.createSampler({
      magFilter: 'nearest',
      minFilter: 'nearest',
    });

    const shaderModule = device.createShaderModule({ code: PIXEL_SHADER_WGSL });
    const bindGroupLayout = device.createBindGroupLayout({
      entries: [
        {
          binding: 0,
          visibility: GPUShaderStage.FRAGMENT,
          texture: { sampleType: 'float' },
        },
        {
          binding: 1,
          visibility: GPUShaderStage.FRAGMENT,
          sampler: { type: 'filtering' },
        },
      ],
    });

    this.bindGroup = device.createBindGroup({
      layout: bindGroupLayout,
      entries: [
        { binding: 0, resource: this.pixelTexture.createView() },
        { binding: 1, resource: this.pixelSampler },
      ],
    });

    this.pipeline = device.createRenderPipeline({
      layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
      vertex: { module: shaderModule, entryPoint: 'vs' },
      fragment: {
        module: shaderModule,
        entryPoint: 'fs',
        targets: [{ format: this.canvasFormat }],
      },
      primitive: { topology: 'triangle-list' },
    });
  }

  private setCellColor(flatIndex: number, color: number) {
    writeCellColor(this.cells, flatIndex, color);
    this.dirtyRows[Math.floor(flatIndex / this.config.gridSize)] = 1;
  }

  private uploadRows(startRow: number, rowCount: number) {
    const { cells, rowBytes, uploadBuffer, config } = this;
    const gridSize = config.gridSize;
    const tightRowBytes = gridSize * 4;

    if (rowBytes === tightRowBytes) {
      this.device.queue.writeTexture(
        { texture: this.pixelTexture, origin: [0, startRow] },
        cells.subarray(startRow * tightRowBytes, (startRow + rowCount) * tightRowBytes),
        { bytesPerRow: rowBytes, rowsPerImage: rowCount },
        [gridSize, rowCount],
      );
      return;
    }

    for (let y = 0; y < rowCount; y++) {
      const sourceRow = startRow + y;
      uploadBuffer.set(
        cells.subarray(sourceRow * tightRowBytes, (sourceRow + 1) * tightRowBytes),
        y * rowBytes,
      );
    }
    this.device.queue.writeTexture(
      { texture: this.pixelTexture, origin: [0, startRow] },
      uploadBuffer.subarray(0, rowBytes * rowCount),
      { bytesPerRow: rowBytes, rowsPerImage: rowCount },
      [gridSize, rowCount],
    );
  }

  private uploadPixels() {
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
        this.uploadRows(startRow, row - startRow);
      }
    }

    dirtyRows.fill(0);
  }

  update() {
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

    // TODO ( factor into placeNextPiece())
    for (let i = 0; i < this.config.placementsPerFrame; i++) {
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
      const nextSpiralIndex = this.state.nextSpiralIndexPerPiece.get(pieceToPlaceNext.id)!;

      // place the piece on this index
      // center ref
      const centerRef = spiralRefToCenterRef(nextSpiralIndex);
      const nextFlatIndex = centerRefToFlatIndex(centerRef, this.config.gridSize);
      this.setCellColor(nextFlatIndex, pieceToPlaceNext.color);
      this.occupied[nextFlatIndex] = 1;


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
        this.occupied,
        this.config.gridSize,
        this.state.attackedByMap,
        this.maxSpiralIndex,
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

      // update the next piece to place
      this.state.pieceToPlaceNext = (this.state.pieceToPlaceNext + 1) % this.config.pieces.length;

      this.state.placementsCompleted++;
    }
  }

  render() {
    this.uploadPixels();

    const encoder = this.device.createCommandEncoder();
    const pass = encoder.beginRenderPass({
      colorAttachments: [{
        view: this.context.getCurrentTexture().createView(),
        clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1 },
        loadOp: 'clear',
        storeOp: 'store',
      }],
    });
    pass.setPipeline(this.pipeline);
    pass.setBindGroup(0, this.bindGroup);
    pass.draw(3);
    pass.end();
    this.device.queue.submit([encoder.finish()]);
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
    this.device.destroy();
  }

  private resizeCanvas() {
    const dpr = window.devicePixelRatio || 1;
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
  }
}