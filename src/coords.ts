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