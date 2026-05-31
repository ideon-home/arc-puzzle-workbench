// Arc Puzzle engine — pure logic: subcell graph, region flood-fill, area,
// smooth-piece counting, score, and clue validation. No DOM dependencies, no
// puzzle-specific data. The puzzle definition lives in puzzle.js.

export const VERSION = '0.2.0';

// ---------- Subcell model ----------
// A cell with no arc → one 'full' subcell with all 4 sides open.
// A cell with an arc → two subcells:
//   'big'   = the quarter-disk piece (area π/4, ≈78.5%) hugging the arc's center corner.
//             It touches the two cell-edges incident to the center corner.
//   'small' = the sliver piece (area 1 − π/4, ≈21.5%) on the diagonal side.
//             It touches the two cell-edges adjacent to the opposite corner.

const SIDES = ['top', 'right', 'bottom', 'left'];
const OPPOSITE_SIDE = { top: 'bottom', bottom: 'top', left: 'right', right: 'left' };

const BIG_SIDES = {
  tl: { top: true, left: true, right: false, bottom: false },
  tr: { top: true, right: true, left: false, bottom: false },
  bl: { bottom: true, left: true, top: false, right: false },
  br: { bottom: true, right: true, top: false, left: false },
};
const flipSides = s => Object.fromEntries(SIDES.map(k => [k, !s[k]]));

export function buildSubcells({ size, arcs }) {
  const out = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const corner = arcs.get(`${r},${c}`);
      if (!corner) {
        out.push({
          r, c, kind: 'full',
          sides: { top: true, right: true, bottom: true, left: true },
        });
      } else {
        out.push({ r, c, kind: 'big', corner, sides: { ...BIG_SIDES[corner] } });
        out.push({ r, c, kind: 'small', corner, sides: flipSides(BIG_SIDES[corner]) });
      }
    }
  }
  return out;
}

export function neighborSubcells(a, b) {
  if (!a || !b) return false;
  if (a.r === b.r && a.c === b.c) return false; // same cell, separated by arc
  const dr = b.r - a.r, dc = b.c - a.c;
  let aSide;
  if (dr === -1 && dc === 0) aSide = 'top';
  else if (dr === 1 && dc === 0) aSide = 'bottom';
  else if (dr === 0 && dc === -1) aSide = 'left';
  else if (dr === 0 && dc === 1) aSide = 'right';
  else return false;
  return a.sides[aSide] && b.sides[OPPOSITE_SIDE[aSide]];
}

// ---------- Region flood-fill ----------

export function computeRegions({ size, arcs }) {
  const subs = buildSubcells({ size, arcs });
  const adj = subs.map(() => []);
  // Adjacency: only check 4-neighbor cell pairs (and within-cell, which is always blocked).
  // For each cell, look at the cell to its right and below; consider all subcell pairs.
  const subsByCell = new Map();
  for (const s of subs) {
    const k = `${s.r},${s.c}`;
    if (!subsByCell.has(k)) subsByCell.set(k, []);
    subsByCell.get(k).push(s);
  }
  const idxOf = new Map();
  subs.forEach((s, i) => idxOf.set(s, i));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const here = subsByCell.get(`${r},${c}`) || [];
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const nr = r + dr, nc = c + dc;
        if (nr >= size || nc >= size) continue;
        const there = subsByCell.get(`${nr},${nc}`) || [];
        for (const a of here) for (const b of there) {
          if (neighborSubcells(a, b)) {
            const i = idxOf.get(a), j = idxOf.get(b);
            adj[i].push(j); adj[j].push(i);
          }
        }
      }
    }
  }
  const regionOf = new Array(subs.length).fill(-1);
  const regions = [];
  for (let i = 0; i < subs.length; i++) {
    if (regionOf[i] !== -1) continue;
    const stack = [i], members = [];
    regionOf[i] = regions.length;
    while (stack.length) {
      const k = stack.pop();
      members.push(subs[k]);
      for (const j of adj[k]) {
        if (regionOf[j] === -1) { regionOf[j] = regions.length; stack.push(j); }
      }
    }
    regions.push({ subcells: members, index: regions.length });
  }
  return { regions, regionOf, subs, idxOf, subsByCell, size };
}

// ---------- Area ----------

const PI4 = Math.PI / 4;
const ONE_MINUS_PI4 = 1 - PI4;

export function regionArea(region) {
  let full = 0, big = 0, small = 0;
  for (const s of region.subcells) {
    if (s.kind === 'full') full++;
    else if (s.kind === 'big') big++;
    else small++;
  }
  return full + big * PI4 + small * ONE_MINUS_PI4;
}

export function isIntegerArea(region) {
  let big = 0, small = 0;
  for (const s of region.subcells) {
    if (s.kind === 'big') big++;
    else if (s.kind === 'small') small++;
  }
  return big === small;
}

export function regionIntegerArea(region) {
  // Only meaningful when isIntegerArea(region). Then area = full + big.
  let count = 0;
  for (const s of region.subcells) {
    if (s.kind === 'full' || s.kind === 'big') count++;
  }
  return count;
}

// ---------- Dangling arcs ----------

export function danglingArcs(data, arcs) {
  const out = [];
  for (const [key, corner] of arcs) {
    const [r, c] = key.split(',').map(Number);
    const here = data.subsByCell.get(`${r},${c}`) || [];
    const big = here.find(s => s.kind === 'big');
    const small = here.find(s => s.kind === 'small');
    if (!big || !small) continue;
    if (data.regionOf[data.idxOf.get(big)] === data.regionOf[data.idxOf.get(small)]) {
      out.push({ r, c, corner });
    }
  }
  return out;
}

// ---------- Boundary walk + smooth-piece counting ----------
// Each region's perimeter is a (possibly disconnected) collection of closed cycles
// composed of unit-length straight edges and quarter-arcs of radius 1.
//
// At each junction between two consecutive segments along the cycle, we compare
// outgoing tangent of the previous segment with incoming tangent of the next.
// A kink (mismatch) starts a new smooth piece.
//
// Tangents:
//   - Edge: unit vector along the edge in the direction of travel.
//   - Arc: at endpoint p with center O and travel from p toward q,
//          tangent = unit(rot90(p - O)) chosen so that it points toward q
//          along the chord (positive dot with (q - p)).

function unit(v) {
  const n = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / n, y: v.y / n };
}
function eqPt(a, b) { return Math.abs(a.x - b.x) < 1e-9 && Math.abs(a.y - b.y) < 1e-9; }
function ptKey(p) { return `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)}`; }
function dot(a, b) { return a.x * b.x + a.y * b.y; }

// Tangent vector at point `p` on `seg`, in the direction of traversal a→b (for
// dir=+1) or b→a (for dir=-1). For an edge the tangent is constant; for an
// arc it rotates with position. Crucially, this evaluates the tangent AT `p`
// — necessary for arcs, where the tangent at the start vs end of the segment
// differs by 90°.
function travelTangent(seg, p, dir) {
  if (seg.kind === 'edge') {
    const t = unit({ x: seg.b.x - seg.a.x, y: seg.b.y - seg.a.y });
    return dir > 0 ? t : { x: -t.x, y: -t.y };
  }
  // Arc: tangent at p is perpendicular to the radial (p - center). Choose
  // sign so the direction is consistent with a→b traversal.
  const ra = { x: seg.a.x - seg.center.x, y: seg.a.y - seg.center.y };
  const rb = { x: seg.b.x - seg.center.x, y: seg.b.y - seg.center.y };
  const ccwAB = (ra.x * rb.y - ra.y * rb.x) > 0;
  const r = { x: p.x - seg.center.x, y: p.y - seg.center.y };
  const tCCW = unit({ x: -r.y, y: r.x });
  const tAB = ccwAB ? tCCW : { x: -tCCW.x, y: -tCCW.y };
  return dir > 0 ? tAB : { x: -tAB.x, y: -tAB.y };
}

// Build all boundary segments for a region. Each segment is emitted with
// canonical direction a→b such that the region is on the *visual right* of
// travel (clockwise traversal in y-down screen coordinates). This lets the
// walker follow a directed graph instead of guessing at junctions.
function regionBoundarySegments(region, data) {
  const segs = [];
  const inRegion = new Set(region.subcells);
  const seenArcKeys = new Set();
  for (const s of region.subcells) {
    // For each cell-side that is open AND faces non-region, emit an edge.
    // The (a, b) ordering below matches CW perimeter traversal of the cell,
    // which puts the cell (in-region) on the visual right of travel.
    const edges = [
      { side: 'top',    a: { x: s.c,     y: s.r     }, b: { x: s.c + 1, y: s.r     } },
      { side: 'right',  a: { x: s.c + 1, y: s.r     }, b: { x: s.c + 1, y: s.r + 1 } },
      { side: 'bottom', a: { x: s.c + 1, y: s.r + 1 }, b: { x: s.c,     y: s.r + 1 } },
      { side: 'left',   a: { x: s.c,     y: s.r + 1 }, b: { x: s.c,     y: s.r     } },
    ];
    for (const e of edges) {
      if (!s.sides[e.side]) continue;
      const dr = e.side === 'top' ? -1 : e.side === 'bottom' ? 1 : 0;
      const dc = e.side === 'left' ? -1 : e.side === 'right' ? 1 : 0;
      const nr = s.r + dr, nc = s.c + dc;
      let acrossInRegion = false;
      if (nr >= 0 && nr < data.size && nc >= 0 && nc < data.size) {
        const there = data.subsByCell.get(`${nr},${nc}`) || [];
        for (const t of there) {
          if (t.sides[OPPOSITE_SIDE[e.side]] && inRegion.has(t)) { acrossInRegion = true; break; }
        }
      }
      if (!acrossInRegion) {
        segs.push({ kind: 'edge', a: e.a, b: e.b });
      }
    }
    // Arc: emit once per arc cell, only if the arc actually separates this
    // region from another (otherwise it's an interior dangling arc).
    if (s.kind === 'big' || s.kind === 'small') {
      const cellKey = `${s.r},${s.c}`;
      if (!seenArcKeys.has(cellKey)) {
        seenArcKeys.add(cellKey);
        const here = data.subsByCell.get(cellKey) || [];
        const big = here.find(t => t.kind === 'big');
        const small = here.find(t => t.kind === 'small');
        const arcSeparates = big && small && (inRegion.has(big) !== inRegion.has(small));
        if (arcSeparates) {
          const corner = s.corner;
          const cx = s.c + (corner.endsWith('r') ? 1 : 0);
          const cy = s.r + (corner.startsWith('b') ? 1 : 0);
          const horiz = { x: cx + (corner.endsWith('r') ? -1 : 1), y: cy };
          const vert  = { x: cx, y: cy + (corner.startsWith('b') ? -1 : 1) };
          // Canonical a→b: orient so center is on the visual right of
          // travel iff BIG is in the region (BIG hugs the center).
          // Visual CW around center = center on visual right.
          // (rH × rV) > 0 means horiz→vert is visual CW (in y-down screen).
          const rH = { x: horiz.x - cx, y: horiz.y - cy };
          const rV = { x: vert.x  - cx, y: vert.y  - cy };
          const horizToVertIsCW = (rH.x * rV.y - rH.y * rV.x) > 0;
          const wantCW = inRegion.has(big);
          if (horizToVertIsCW === wantCW) {
            segs.push({ kind: 'arc', a: horiz, b: vert, center: { x: cx, y: cy }, radius: 1 });
          } else {
            segs.push({ kind: 'arc', a: vert, b: horiz, center: { x: cx, y: cy }, radius: 1 });
          }
        }
      }
    }
  }
  return segs;
}

// Walk all boundary cycles of a region. Returns:
//   { cycles: [[junction, ...], ...], smoothPieces, kinks }
// Each junction = {
//   seg,           // the boundary segment whose END is this junction
//   fromEnd,       // 'a' or 'b' — which end of `seg` we entered from
//   point,         // the junction point (where seg ends and next begins)
//   tOut,          // outgoing tangent of `seg` at point
//   tIn,           // incoming tangent of nextSeg at point (i.e. its outgoing-from-point)
//   isKink,        // whether tOut differs from tIn → boundary is non-smooth here
//   nextSeg,       // the segment that continues the cycle
// }
// Smooth pieces per cycle = max(1, kinks-on-that-cycle).
export function regionBoundaryWalk(region, data) {
  const segs = regionBoundarySegments(region, data);
  if (segs.length === 0) return { cycles: [], smoothPieces: 0, kinks: 0 };

  // Each segment is canonically directed a→b with the region on the visual
  // right. Build a directed graph: at each point, list outgoing (a-end here)
  // and incoming (b-end here). At a simple junction (1 in, 1 out) the next
  // segment is determined. At an X-junction (>1 in/out — boundary touches
  // itself diagonally), pair each incoming with the outgoing that's the
  // smallest CW visual rotation away (= smallest math-CCW angle in y-down).
  const outgoingsAt = new Map();
  const incomingsAt = new Map();
  for (const seg of segs) {
    const ka = ptKey(seg.a), kb = ptKey(seg.b);
    if (!outgoingsAt.has(ka)) outgoingsAt.set(ka, []);
    outgoingsAt.get(ka).push(seg);
    if (!incomingsAt.has(kb)) incomingsAt.set(kb, []);
    incomingsAt.get(kb).push(seg);
  }

  const nextOf = new Map();
  for (const [key, ins] of incomingsAt) {
    const outs = (outgoingsAt.get(key) || []).slice();
    if (outs.length === 0) continue;
    if (ins.length === 1 && outs.length === 1) {
      nextOf.set(ins[0], outs[0]);
      continue;
    }
    // X-junction. Pair by angle.
    const point = ins[0].b;
    const inAngles = ins.map(seg => {
      const t = travelTangent(seg, point, 1);
      return { seg, angle: Math.atan2(t.y, t.x) };
    });
    const outAngles = outs.map(seg => {
      const t = travelTangent(seg, point, 1);
      return { seg, angle: Math.atan2(t.y, t.x), used: false };
    });
    for (const i of inAngles) {
      let best = null, bestDelta = Infinity;
      for (const o of outAngles) {
        if (o.used) continue;
        // Smallest non-negative CCW math rotation (= CW visual). delta=0
        // means smooth continuation (no turn); that's a valid pairing.
        let delta = o.angle - i.angle;
        delta = ((delta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        if (delta < bestDelta) { bestDelta = delta; best = o; }
      }
      if (best) { nextOf.set(i.seg, best.seg); best.used = true; }
    }
  }

  const used = new Set();
  const cycles = [];
  let totalKinks = 0;
  let totalSmooth = 0;
  for (const startSeg of segs) {
    if (used.has(startSeg)) continue;
    const junctions = [];
    let cur = startSeg;
    let kinks = 0;
    let safety = 0;
    while (safety++ < 100000) {
      used.add(cur);
      const next = nextOf.get(cur);
      if (!next) break;
      // Junction is cur.b (= next.a). Outgoing tangent of cur at cur.b in
      // a→b traversal; incoming tangent of next at next.a in a→b traversal.
      const tOut = travelTangent(cur, cur.b, 1);
      const tIn = travelTangent(next, cur.b, 1);
      // Pure C¹: tangents match → smooth, regardless of segment kinds.
      const isKink = !(Math.abs(tOut.x - tIn.x) < 1e-6 && Math.abs(tOut.y - tIn.y) < 1e-6);
      if (isKink) kinks++;
      junctions.push({
        seg: cur, fromEnd: 'a',
        point: cur.b,
        tOut, tIn, isKink,
        nextSeg: next,
      });
      if (used.has(next)) break;
      cur = next;
    }
    cycles.push(junctions);
    totalKinks += kinks;
    totalSmooth += Math.max(1, kinks);
  }
  return { cycles, smoothPieces: totalSmooth, kinks: totalKinks };
}

// Count smooth perimeter pieces for a region (thin wrapper over the walk).
export function smoothPieceCount(region, data) {
  return regionBoundaryWalk(region, data).smoothPieces;
}

// ---------- Score + clue validation ----------

export function regionScore(region, data) {
  if (!isIntegerArea(region)) return null;
  return smoothPieceCount(region, data) * regionIntegerArea(region);
}

// Region that contains ≥ ½ of cell (r, c): the 'full' subcell or, if arc, the 'big' subcell.
export function ownerCellRegion(r, c, data) {
  const here = data.subsByCell.get(`${r},${c}`) || [];
  const owner = here.find(s => s.kind === 'full' || s.kind === 'big');
  if (!owner) return null;
  return data.regions[data.regionOf[data.idxOf.get(owner)]];
}

export function validateClues(data, clues) {
  return clues.map(cl => {
    const region = ownerCellRegion(cl.r, cl.c, data);
    const score = region ? regionScore(region, data) : null;
    return {
      ...cl,
      score,
      status: score == null ? 'pending' : (score === cl.value ? 'match' : 'mismatch'),
    };
  });
}
