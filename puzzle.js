// Puzzle definition — edit this file to plug in a different puzzle of the same ruleset.
// The engine (engine.js) and UI (index.html) are entirely data-driven from PUZZLE.

// `title`    — page title and on-page heading.
// `size`     — grid side length (NxN cells).
// `green`    — array of [r, c] cells locked as green (no arcs allowed). r=0 top, c=0 left.
// `clues`    — array of { r, c, value }. `value` is the score of the region that
//              owns >= 1/2 of cell (r, c). A clue cell may also be green.
// `scoreFn`  — function(rowSums, colSums) -> { display } that produces the final
//              answer string once every region has integer area, no arcs are
//              dangling, and every clue is satisfied. rowSums/colSums are arrays
//              of length `size` containing the row/column totals of cell labels.

const GREEN = [
  [0, 0], [0, 3], [0, 5], [0, 7],
  [1, 3], [1, 6], [1, 8],
  [2, 0], [2, 7],
  [3, 8],
  [4, 0], [4, 4],
  [5, 7], [5, 8],
  [7, 0],
  [8, 1], [8, 4], [8, 6], [8, 8],
];

const CLUES = [
  { r: 0, c: 2, value: 21 },
  { r: 1, c: 0, value: 21 },
  { r: 1, c: 4, value: 27 },
  { r: 1, c: 7, value: 25 },
  { r: 2, c: 1, value: 27 },
  { r: 2, c: 5, value: 15 },
  { r: 2, c: 8, value: 9 },
  { r: 4, c: 0, value: 25 },
  { r: 4, c: 3, value: 27 },
  { r: 4, c: 5, value: 45 },
  { r: 4, c: 8, value: 9 },
  { r: 6, c: 0, value: 9 },
  { r: 6, c: 3, value: 63 },
  { r: 6, c: 7, value: 45 },
  { r: 7, c: 1, value: 63 },
  { r: 7, c: 4, value: 9 },
  { r: 7, c: 8, value: 288 },
  { r: 8, c: 6, value: 35 },
];

function scoreFn(rowSums, colSums) {
  const sumSqRows = rowSums.reduce((s, x) => s + x * x, 0);
  const sumSqCols = colSums.reduce((s, x) => s + x * x, 0);
  return {
    display: `Answer: Σ row² + Σ col² = ${sumSqRows} + ${sumSqCols} = ${sumSqRows + sumSqCols}`,
  };
}

export const PUZZLE = {
  title: 'Arch Madness',
  size: 9,
  green: GREEN,
  clues: CLUES,
  scoreFn,
};
