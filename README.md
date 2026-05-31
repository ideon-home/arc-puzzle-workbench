# Arc Puzzle Workbench

A small, dependency-free browser tool for solving "quarter-arc" puzzles — the family where you place quarter-circle arcs inside grid cells to carve the board into regions whose area × number-of-smooth-boundary-pieces matches each clue.

It's a workbench, not a solver: you place the arcs, and the live engine tells you in real time which regions exist, what their area and score are, which clue cells match, and which arcs are still dangling. Originally built for Jane Street's _Arch Madness_ (May 2026), but the puzzle definition is data-driven, so any puzzle in this family fits in one file.

## Quick start

```bash
./serve.sh              # default port 8000
./serve.sh 8765         # custom port
```

Then open `http://localhost:8000/index.html`. Stop with Ctrl-C.

(Browsers block ESM imports over `file://`, so the page needs a local server. `serve.sh` just runs `python3 -m http.server`; any static server works.)

## Controls

- **Left-click a white cell** to cycle through arc orientations: `tl → tr → br → bl → none`.
- **Right-click** clears an arc immediately.
- **Green cells** are locked — clicks are ignored.
- **Clear all arcs**, **Save** (forces the localStorage snapshot), **Copy arcs** (JSON to clipboard).
- **Boundary debug** (checkbox): hover or click a cell to inspect its region's boundary cycle, with kink-vs-smooth junction markers.
- **Click a clue value's factorization** to highlight the BFS reachability envelope of cells from that clue, up to `area − 1` steps — useful for ruling out infeasible factorizations.

State persists across reloads via `localStorage`.

## Live feedback

Every arc change re-runs the engine and updates:

- **Region fills** — connected sub-cells coloured by region.
- **Clue cell borders** — green = score matches, red = mismatch, yellow-dashed = region area not yet integer.
- **Dangling arcs** — arcs that don't separate two regions pulse red.
- **Regions panel** — area, smooth-piece count, score.
- **Cell labels grid** — each cell shows its owning region's score, with row and column sums.
- **Answer box** — the final computed answer, only revealed when every region is integer-area, no arcs are dangling, and every clue matches.

## Plugging in your own puzzle

Edit [`puzzle.js`](puzzle.js). The file's top comment documents the contract; the shape is:

```js
export const PUZZLE = {
  title: 'My Puzzle',                       // shown in tab and heading
  size: 9,                                  // grid is size×size
  green: [[r, c], ...],                     // locked cells (no arcs)
  clues: [{ r, c, value }, ...],            // value = score of region owning the cell
  scoreFn: (rowSums, colSums) => ({ display: '...' }),
};
```

[`puzzle-random.js`](puzzle-random.js) is a worked example of a 7×7 random board — useful to confirm everything (grid sizing, label rows, factorization cap) is fully data-driven.

To switch puzzles, change the one import line at the top of the script block in [`index.html`](index.html):

```js
import { PUZZLE } from './puzzle.js';
// or
import { PUZZLE } from './puzzle-random.js';
```

## Engine

[`engine.js`](engine.js) is pure logic, DOM-free, ESM-exported, no dependencies. The sub-cell model splits each arc'd cell into a "big" quarter-disk (area π/4) and a "small" sliver (1 − π/4). `computeRegions` flood-fills across open sides; `regionArea` / `isIntegerArea` / `regionIntegerArea` handle the π-cancellation trick (regions only get an integer area when their big and small sub-cell counts match); `regionBoundaryWalk` traces cycles and counts smooth pieces by comparing C¹ tangents at every junction; `regionScore = area × smooth`; `validateClues` returns per-clue `match | mismatch | pending`.

Tests live in [`engine.test.js`](engine.test.js). Run them with:

```bash
node --test engine.test.js
```

## License

MIT — see [`LICENSE`](LICENSE).
