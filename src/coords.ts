export type Index2d = {
  x: number;
  y: number;
}

export type TopLeftRef = Index2d;
export type CenterRef = Index2d;


export function topLeftRefToFlatIndex({ x, y }: TopLeftRef, gridSize: number): number {
  return y * gridSize + x;
}

export function flatIndexToTopLeftRef(idx: number, gridSize: number): TopLeftRef {
  return {
    x: idx % gridSize,
    y: Math.floor(idx / gridSize),
  };
}

export function flatIndexToCenterRef(idx: number, gridSize: number): CenterRef {
  const topLeftRef = flatIndexToTopLeftRef(idx, gridSize);
  return topLeftRefToCenterRef(topLeftRef, gridSize);
}

export function centerRefToTopLeftRef({ x, y }: CenterRef, gridSize: number): TopLeftRef {
  const centerX = Math.floor(gridSize / 2);
  const centerY = Math.floor(gridSize / 2);
  return {
    x: x + centerX,
    y: y + centerY,
  };
}

export function centerRefToFlatIndex({ x, y }: CenterRef, gridSize: number): number {
  const topLeftRef = centerRefToTopLeftRef({ x, y }, gridSize);
  return topLeftRefToFlatIndex(topLeftRef, gridSize);
}

export function topLeftRefToCenterRef({ x, y }: TopLeftRef, gridSize: number): CenterRef {
  // The image / canvas and cells are indexed from (0, 0) being the top left, 
  // but we want to index from (0, 0) being the center.
  // the center is at (gridSize / 2, gridSize / 2)
  const centerX = Math.floor(gridSize / 2);
  const centerY = Math.floor(gridSize / 2);

  // convert the x and y to the center reference
  return {
    x: x - centerX,
    y: y - centerY,
  };
}

export function centerRefToSpiralRef({ x, y }: CenterRef): number {
  const n = Math.max(Math.abs(x), Math.abs(y));
  if (n === 0) return 0;
  const base = (2 * n - 1) ** 2;
  if (x === n && y >= 1 - n) {
    return base + (y - (1 - n));
  }
  if (y === n && x >= -n) {
    return base + 2 * n + (n - 1 - x);
  }
  if (x === -n && y >= -n) {
    return base + 4 * n + (n - 1 - y);
  }
  return base + 6 * n + (x - (-n + 1));
}

export function maxSpiralIndexForGrid(gridSize: number): number {
  // TODO it has to be one of the corners, so this could be simplified
  // is it always the same one?
  let max = 0;
  for (let idx = 0; idx < gridSize * gridSize; idx++) {
    max = Math.max(max, centerRefToSpiralRef(flatIndexToCenterRef(idx, gridSize)));
  }
  return max;
}

export function spiralRefToCenterRef(idx: number): CenterRef {
  if (idx === 0) return { x: 0, y: 0 };
  const n = Math.ceil((Math.sqrt(idx + 1) - 1) / 2);
  const base = (2 * n - 1) ** 2;
  const offset = idx - base;

  if (offset < 2 * n) return { x: n, y: 1 - n + offset };
  if (offset < 4 * n) return { x: n - 1 - (offset - 2 * n), y: n };
  if (offset < 6 * n) return { x: -n, y: n - 1 - (offset - 4 * n) };
  return { x: -n + 1 + (offset - 6 * n), y: -n };
}