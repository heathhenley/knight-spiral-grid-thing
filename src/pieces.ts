import type { CenterRef } from "./coords";

export type Piece = {
  id: number;
  color: number;
  // how does this piece move?
  getNeighbors: (centerRef: CenterRef) => CenterRef[];
  // does this piece get attacked by piece with id? if
  // yes, then it won't be able to move to cells attacked
  // by pieces with that type
  isAttackedBy: (attackerId: number) => boolean;
}

export const makeNeighborsFunction = (delta: [number, number]) => {
  return (centerRef: CenterRef) => {
    // probably better way to cycle this...
    return [
      { x: centerRef.x + delta[0], y: centerRef.y + delta[1] },
      { x: centerRef.x - delta[0], y: centerRef.y + delta[1] },
      { x: centerRef.x + delta[0], y: centerRef.y - delta[1] },
      { x: centerRef.x - delta[0], y: centerRef.y - delta[1] },
      { x: centerRef.x + delta[1], y: centerRef.y + delta[0] },
      { x: centerRef.x - delta[1], y: centerRef.y + delta[0] },
      { x: centerRef.x + delta[1], y: centerRef.y - delta[0] },
      { x: centerRef.x - delta[1], y: centerRef.y - delta[0] },
    ];
  };
};

export const makeIsAttackedByFunction = (attackedBy: number[]) => {
  return (attackerId: number) => attackedBy.includes(attackerId);
};
