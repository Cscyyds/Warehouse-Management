export function normalizeCropRotation(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

/** Rotate a normalized box clockwise within its image. */
export function rotateCropBox(box: number[], degrees: number): number[] {
  const [left, top, right, bottom] = box;
  switch (normalizeCropRotation(degrees)) {
    case 90: return [1 - bottom, left, 1 - top, right];
    case 180: return [1 - right, 1 - bottom, 1 - left, 1 - top];
    case 270: return [top, 1 - right, bottom, 1 - left];
    default: return [...box];
  }
}
