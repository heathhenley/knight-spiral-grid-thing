import { describe, it, expect } from 'vitest';

import {
  topLeftRefToFlatIndex,
  flatIndexToTopLeftRef,
  flatIndexToCenterRef,
  topLeftRefToCenterRef,
  centerRefToSpiralRef,
  spiralRefToCenterRef,
} from './coords.ts';


describe('topLeftRefToFlatIndex', () => {
  it('top left in image 0,0 --> flat index 0', () => {
    const flatIndex = topLeftRefToFlatIndex({ x: 0, y: 0 }, 10);
    expect(flatIndex).toBe(0);
  });

  it('increments along x', () => {
    expect(topLeftRefToFlatIndex({ x: 7, y: 0 }, 8)).toBe(7);
  });
  it('moves to the next y', () => {
    expect(topLeftRefToFlatIndex({ x: 0, y: 1 }, 8)).toBe(8);
  });
  it('maps bottom-right on an 8x8 grid', () => {
    expect(topLeftRefToFlatIndex({ x: 7, y: 7 }, 8)).toBe(63);
  });

});

describe('topLeftRefToCenterRef', () => {
  it('maps center cell to (0, 0) on odd grid', () => {
    // gridSize 9 → center at floor(9/2) = 4
    expect(topLeftRefToCenterRef({ x: 4, y: 4 }, 9)).toEqual({ x: 0, y: 0 });
  });
  it('maps center anchor to (0, 0) on even grid', () => {
    // gridSize 10 → center at floor(10/2) = 5
    expect(topLeftRefToCenterRef({ x: 5, y: 5 }, 10)).toEqual({ x: 0, y: 0 });
  });
  it('maps top-left to negative coords', () => {
    expect(topLeftRefToCenterRef({ x: 0, y: 0 }, 8)).toEqual({ x: -4, y: -4 });
  });
  it('maps bottom-right on 8x8', () => {
    expect(topLeftRefToCenterRef({ x: 7, y: 7 }, 8)).toEqual({ x: 3, y: 3 });
  });
});


describe('flatIndexToTopLeftRef', () => {
  it('maps flat index 0 to (0, 0)', () => {
    expect(flatIndexToTopLeftRef(0, 10)).toEqual({ x: 0, y: 0 });
  });

  it('maps flat index 10 to (0, 1)', () => {
    expect(flatIndexToTopLeftRef(10, 10)).toEqual({ x: 0, y: 1 });
  });

  it('maps flat index 99 to (9, 9)', () => {
    expect(flatIndexToTopLeftRef(99, 10)).toEqual({ x: 9, y: 9 });
  });
});

describe('flatIndexToTopLeftRef and topLeftRefToFlatIndex', () => {

  it('check conversion back and forth for a 10x10 grid', () => {
    for (let i = 0; i < 100; i++) {
      const topLeftRef = flatIndexToTopLeftRef(i, 10);
      const flatIndex = topLeftRefToFlatIndex(topLeftRef, 10);
      expect(flatIndex).toBe(i);
    }
  });

});

describe('centerRefToSpiralRef', () => {
  it('maps (0, 0) to 0', () => {
    expect(centerRefToSpiralRef({ x: 0, y: 0 })).toBe(0);
  });

  it('maps (-2, 1) to 17', () => {
    expect(centerRefToSpiralRef({ x: -2, y: 1 })).toBe(17);
  });

  it('maps (-5, -5) to 110', () => {
    expect(centerRefToSpiralRef({ x: -5, y: -5 })).toBe(110);
  });

});

describe('spiralRefToCenterRef and centerRefToSpiralRef and flatIndexToCenterRef', () => {
  it('check conversion back and forth for a 10x10 grid', () => {
    for (let i = 0; i < 100; i++) {
      const centerRef = flatIndexToCenterRef(i, 10);
      const spiralIndex = centerRefToSpiralRef(centerRef);
      const centerRef2 = spiralRefToCenterRef(spiralIndex);
      expect(centerRef2).toEqual(centerRef);
    }
  });
});
