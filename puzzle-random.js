// Randomly-generated test puzzle — 7x7 grid. NOT guaranteed to be solvable;
// purpose is to smoke-test that the workbench renders correctly with different
// puzzle definitions (size, green cells, clues, scoreFn).
//
// To try it: in index.html change the import line
//   import { PUZZLE } from './puzzle.js';
// to
//   import { PUZZLE } from './puzzle-random.js';
// then reload http://localhost:8000/index.html.

const GREEN = [
  [1, 0], [1, 1], [1, 6],
  [2, 2], [2, 3],
  [3, 0], [3, 4],
  [5, 1],
  [6, 0], [6, 2],
];

const CLUES = [
  { r: 0, c: 0, value: 56 },
  { r: 0, c: 4, value: 28 },
  { r: 0, c: 6, value: 56 },
  { r: 1, c: 2, value: 56 },
  { r: 1, c: 3, value: 63 },
  { r: 2, c: 1, value: 42 },
  { r: 3, c: 5, value: 18 },
  { r: 5, c: 4, value: 48 },
  { r: 5, c: 5, value: 18 },
  { r: 5, c: 6, value: 36 },
];

function scoreFn(rowSums, colSums) {
  const sumSqRows = rowSums.reduce((s, x) => s + x * x, 0);
  const sumSqCols = colSums.reduce((s, x) => s + x * x, 0);
  return {
    display: `Answer: Σ row² + Σ col² = ${sumSqRows} + ${sumSqCols} = ${sumSqRows + sumSqCols}`,
  };
}

export const PUZZLE = {
  title: 'Random Test Puzzle (7×7)',
  size: 7,
  green: GREEN,
  clues: CLUES,
  scoreFn,
};
