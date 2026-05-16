/*
  Reed field & a small boat.
  All visuals are generated with p5.js — no external images.
  The complexity comes from many simple curves drawn with low alpha.
*/

// ---------- Canvas ----------
const BASE_W = 390;
const BASE_H = 844;

// ---------- Palettes ----------
const SKY_TOP    = "#F4F7EE";
const SKY_MIST   = "#DDEBDD";
const SKY_TEAL   = "#B9DCC6";
const MID_GREEN  = "#78B88E";
const DEEP_GREEN = "#1F5F46";
const SHADE_GRN  = "#123B32";

const GRASS_DARK = ["#174633", "#1D5B42", "#246B4A", "#2F7A55"];
const GRASS_MID  = ["#4F9A68", "#68B17D", "#7FC493", "#91CFA3"];
const GRASS_LITE = ["#B9E0C4", "#D5EED8", "#E6F4E5", "#F2F7EC"];
const GRASS_COOL = ["#8ECDB2", "#A9DCC4", "#C8E8D8"];

const WATER_IN   = "#E8F3E6";
const WATER_OUT  = "#BFDCC7";
const RIPPLE_COL = "#315F50";

const BOAT_MAIN  = "#15362F";
const BOAT_DARK  = "#0E241F";
const BOAT_LITE  = "#496F5E";
const FIG_WARM   = "#7A4A32";
const FIG_DARK   = "#5C3326";

// ---------- State ----------
let grasses = [];          // all reeds
let bgLayer;               // cached gradient + noise
let fogLayer;              // soft top fog
let boat = { x: 0, y: 0, vx: 0 };
let t = 0;                 // global time
let scaleFactor = 1;       // for high-dpi feel
let seed;

// Layer depth: 0 = far, 1 = mid, 2 = near
const FAR_COUNT  = 1000;
const MID_COUNT  = 1600;
const NEAR_COUNT = 800;

function setup() {
  // Fit a phone-ratio canvas inside the window while keeping 390x844 logical units.
  const targetRatio = BASE_W / BASE_H;
  let w = windowWidth;
  let h = windowHeight;
  if (w / h > targetRatio) {
    w = h * targetRatio;
  } else {
    h = w / targetRatio;
  }
  const cnv = createCanvas(Math.floor(w), Math.floor(h));
  cnv.parent("sketch-holder");
  pixelDensity(Math.min(2, window.devicePixelRatio || 1));

  scaleFactor = width / BASE_W;
  seed = floor(random(99999));
  randomSeed(seed);
  noiseSeed(seed);

  buildBackground();
  buildFog();
  buildGrasses();

  boat.x = -60;
  boat.y = BASE_H * 0.56;
  boat.vx = BASE_W / (60 * 42); // ~42s left-to-right at 60fps

  frameRate(60);
}

function windowResized() {
  const targetRatio = BASE_W / BASE_H;
  let w = windowWidth;
  let h = windowHeight;
  if (w / h > targetRatio) w = h * targetRatio;
  else h = w / targetRatio;
  resizeCanvas(Math.floor(w), Math.floor(h));
  scaleFactor = width / BASE_W;
  buildBackground();
  buildFog();
}

// ---------- Background ----------
function buildBackground() {
  bgLayer = createGraphics(BASE_W, BASE_H);
  bgLayer.noStroke();

  // Vertical gradient through several stops.
  const stops = [
    { p: 0.00, c: color(SKY_TOP) },
    { p: 0.18, c: color(SKY_MIST) },
    { p: 0.36, c: color(SKY_TEAL) },
    { p: 0.58, c: color(MID_GREEN) },
    { p: 0.85, c: color(DEEP_GREEN) },
    { p: 1.00, c: color(SHADE_GRN) },
  ];
  for (let y = 0; y < BASE_H; y++) {
    const p = y / (BASE_H - 1);
    let c1 = stops[0].c, c2 = stops[1].c, p1 = 0, p2 = 1;
    for (let i = 0; i < stops.length - 1; i++) {
      if (p >= stops[i].p && p <= stops[i + 1].p) {
        c1 = stops[i].c; c2 = stops[i + 1].c;
        p1 = stops[i].p; p2 = stops[i + 1].p;
        break;
      }
    }
    const local = (p - p1) / max(0.0001, (p2 - p1));
    const c = lerpColor(c1, c2, local);
    bgLayer.stroke(c);
    bgLayer.line(0, y, BASE_W, y);
  }

  // Subtle paper noise — very low alpha specks.
  bgLayer.noStroke();
  for (let i = 0; i < 1800; i++) {
    const x = random(BASE_W);
    const y = random(BASE_H);
    const a = random(4, 14);
    const v = random() < 0.5 ? 255 : 0;
    bgLayer.fill(v, a);
    bgLayer.rect(x, y, 1, 1);
  }

  // Soft horizontal bands — water-color washes.
  for (let i = 0; i < 14; i++) {
    const y = random(BASE_H * 0.2, BASE_H);
    const h = random(40, 160);
    bgLayer.fill(255, 255, 255, random(4, 10));
    bgLayer.rect(0, y, BASE_W, h);
  }
}

function buildFog() {
  fogLayer = createGraphics(BASE_W, BASE_H);
  fogLayer.noStroke();
  // Top fog gradient — fades to transparent near the middle.
  for (let y = 0; y < BASE_H * 0.55; y++) {
    const a = map(y, 0, BASE_H * 0.55, 90, 0);
    fogLayer.stroke(255, 255, 255, a);
    fogLayer.line(0, y, BASE_W, y);
  }
  // Soft grain across the top.
  fogLayer.noStroke();
  for (let i = 0; i < 600; i++) {
    const x = random(BASE_W);
    const y = random(BASE_H * 0.6);
    fogLayer.fill(255, random(2, 8));
    fogLayer.ellipse(x, y, random(20, 80), random(20, 80));
  }
}

// ---------- Grass ----------
function buildGrasses() {
  grasses = [];

  // Far layer — high in frame, short, light, semi-transparent.
  for (let i = 0; i < FAR_COUNT; i++) {
    const yBand = random(BASE_H * 0.22, BASE_H * 0.62);
    grasses.push(makeGrass(random(-30, BASE_W + 30), yBand, 0));
  }

  // Mid layer — broad band, the densest swath.
  for (let i = 0; i < MID_COUNT; i++) {
    const yBand = random(BASE_H * 0.35, BASE_H * 0.92);
    grasses.push(makeGrass(random(-40, BASE_W + 40), yBand, 1));
  }

  // Near layer — bottom half, longer, darker, on top.
  for (let i = 0; i < NEAR_COUNT; i++) {
    const yBand = random(BASE_H * 0.55, BASE_H + 30);
    grasses.push(makeGrass(random(-50, BASE_W + 50), yBand, 2));
  }

  // Order by depth and y so closer grass paints last.
  grasses.sort((a, b) => (a.depth - b.depth) || (a.y - b.y));
}

function makeGrass(x, y, depth) {
  // Per-depth size profile.
  let lenMin, lenMax, wMin, wMax, alpha;
  if (depth === 0) {
    lenMin = 40;  lenMax = 95;
    wMin = 0.3;   wMax = 0.6;
    alpha = random(40, 95);
  } else if (depth === 1) {
    lenMin = 80;  lenMax = 180;
    wMin = 0.6;   wMax = 1.0;
    alpha = random(80, 150);
  } else {
    lenMin = 160; lenMax = 320;
    wMin = 1.0;   wMax = 1.8;
    alpha = random(140, 210);
  }

  // Length influenced by vertical position (lower = longer reeds).
  const yNorm = constrain(map(y, BASE_H * 0.2, BASE_H, 0, 1), 0, 1);
  const len = lerp(lenMin, lenMax, pow(yNorm, 0.6) * random(0.7, 1.1));

  // Colour selection — mostly mid greens with sprinkles of light + dark.
  const r = random();
  let palette;
  if (r < 0.55)      palette = GRASS_MID;
  else if (r < 0.78) palette = depth === 2 ? GRASS_DARK : GRASS_MID;
  else if (r < 0.90) palette = GRASS_DARK;
  else if (r < 0.97) palette = GRASS_LITE;
  else               palette = GRASS_COOL;
  if (depth === 0 && random() < 0.35) palette = GRASS_LITE;

  const col = color(palette[floor(random(palette.length))]);
  col.setAlpha(alpha);

  // Wind-side preference — most reeds lean toward the upper-right.
  const baseLean = random(-PI * 0.18, PI * 0.05);   // mostly tilted left of vertical-up (so tip goes right when flipped)
  // We'll draw reeds growing "up" from base, where positive angle = lean right.
  const lean = random(-0.25, 0.55);   // base lean angle (radians)
  const curl = random(0.6, 1.4);      // curvature multiplier
  const phase = random(TWO_PI);
  const stiffness = random(0.6, 1.1); // higher = stiffer base

  return {
    x, y,
    depth,
    len,
    width: random(wMin, wMax),
    color: col,
    lean,
    curl,
    phase,
    stiffness,
    flip: random() < 0.18 ? -1 : 1, // a few reeds curl to the other side
  };
}

// ---------- Draw ----------
function draw() {
  t = frameCount * 0.008;

  // Update boat — gentle left-to-right drift with tiny bob.
  boat.x += boat.vx;
  if (boat.x > BASE_W + 80) boat.x = -80;
  const bobY = sin(t * 0.6) * 2 + sin(t * 1.3 + 1.2) * 0.6;
  boat.y = BASE_H * 0.56 + bobY;

  // Render into BASE space, then scale to canvas.
  push();
  scale(scaleFactor);

  // 1. Gradient background.
  image(bgLayer, 0, 0);

  // 2. Far reeds (under fog).
  drawGrassLayer(0);

  // 3. Top fog wash.
  image(fogLayer, 0, 0);

  // 4. Mid reeds.
  drawGrassLayer(1);

  // 5. Water clearing around boat.
  drawClearing(boat.x, boat.y);

  // 6. Boat + reflection.
  drawBoat(boat.x, boat.y);

  // 7. Near reeds (partially overlap clearing edge).
  drawGrassLayer(2);

  // 8. Final atmospheric haze.
  drawHaze();

  pop();
}

// ---------- Grass rendering ----------
function drawGrassLayer(depth) {
  noFill();
  const boatCx = boat.x;
  const boatCy = boat.y;
  const ellW = 205;   // half-width of clearing
  const ellH = 82;    // half-height of clearing

  for (let g of grasses) {
    if (g.depth !== depth) continue;

    // Ellipse mask — distance in "ellipse units".
    const dx = (g.x - boatCx) / ellW;
    const dy = (g.y - boatCy) / ellH;
    const ed = sqrt(dx * dx + dy * dy);

    if (ed < 0.85) continue;             // fully inside clearing — skip
    let edgeFade = 1;
    if (ed < 1.25) {
      edgeFade = map(ed, 0.85, 1.25, 0, 1);
      edgeFade = constrain(edgeFade, 0, 1);
      edgeFade = pow(edgeFade, 1.6);
    }

    drawReed(g, boatCx, boatCy, edgeFade);
  }
}

function drawReed(g, bx, by, edgeFade) {
  // Wind field — large scale noise + travelling wave.
  const windNoise = noise(g.x * 0.003, g.y * 0.003, t * 0.6) - 0.5;
  const wave = sin(g.x * 0.015 + g.y * 0.008 + t * 1.8 + g.phase);

  // Per-layer sway magnitude (radians).
  let swayMax;
  if (g.depth === 0)      swayMax = 0.10;   // ~6°
  else if (g.depth === 1) swayMax = 0.17;   // ~10°
  else                    swayMax = 0.28;   // ~16°

  const sway = (windNoise * 1.4 + wave * 0.55) * swayMax;
  const tipAngle = g.lean + sway;

  // Length scaled by edge fade so reeds near clearing shrink.
  const len = g.len * (0.6 + 0.4 * edgeFade);
  const w   = g.width * (0.55 + 0.45 * edgeFade);

  // Base point — slightly buried so root isn't visible.
  const x0 = g.x;
  const y0 = g.y + 4;

  // Mid control — curl point biased away from base.
  const stiffness = g.stiffness;
  const tipDx = sin(tipAngle) * len;
  const tipDy = -cos(tipAngle) * len;

  // Curl: mid-control offset perpendicular to direction.
  const mx = x0 + tipDx * 0.45;
  const my = y0 + tipDy * 0.45;
  const perpX = -tipDy / max(0.001, len);
  const perpY =  tipDx / max(0.001, len);
  const curlAmt = g.curl * 8 * g.flip * (0.5 + 0.5 * (1 - stiffness));
  const cx = mx + perpX * curlAmt;
  const cy = my + perpY * curlAmt;

  const tx = x0 + tipDx;
  const ty = y0 + tipDy;

  // Alpha-faded copy of color for edge regions.
  const baseAlpha = alpha(g.color);
  const a = baseAlpha * edgeFade;
  if (a < 4) return;
  const c = color(red(g.color), green(g.color), blue(g.color), a);

  // Draw the reed as a tapered quadratic — two slightly offset strokes for thickness.
  stroke(c);
  strokeWeight(w);
  noFill();
  beginShape();
  vertex(x0, y0);
  quadraticVertex(cx, cy, tx, ty);
  endShape();

  // A faint highlight on a fraction of reeds — light tip.
  if (g.depth >= 1 && a > 70 && (g.phase * 1000) % 7 < 1.2) {
    const tipCol = color(red(g.color), green(g.color), blue(g.color), a * 0.45);
    stroke(tipCol);
    strokeWeight(max(0.3, w * 0.55));
    line((mx + cx) * 0.5, (my + cy) * 0.5, tx, ty);
  }
}

// ---------- Water clearing ----------
function drawClearing(bx, by) {
  push();
  noStroke();
  // Outer soft halo — many concentric translucent ellipses for a feathered edge.
  for (let i = 18; i >= 0; i--) {
    const k = i / 18;
    const w = lerp(230, 110, 1 - k);  // outer rings bigger
    const h = lerp(95, 42, 1 - k);
    const tcol = lerpColor(color(WATER_OUT), color(WATER_IN), 1 - k);
    tcol.setAlpha(lerp(2, 26, 1 - k));
    fill(tcol);
    ellipse(bx, by + 2, w * 2, h * 2);
  }

  // Inner pale water.
  const inner = color(WATER_IN);
  inner.setAlpha(85);
  fill(inner);
  ellipse(bx, by + 2, 200, 70);

  // Soft ripple lines on the water.
  noFill();
  for (let i = 0; i < 5; i++) {
    const rw = 60 + i * 22 + sin(t * 0.8 + i) * 4;
    const rh = 16 + i * 5;
    const rc = color(RIPPLE_COL);
    rc.setAlpha(map(i, 0, 4, 22, 6));
    stroke(rc);
    strokeWeight(0.6);
    ellipse(bx + sin(t * 0.4 + i) * 2, by + 6 + i * 1.2, rw, rh);
  }

  // Wake — soft trailing brightness behind the boat.
  const wake = color(WATER_IN);
  wake.setAlpha(40);
  fill(wake);
  noStroke();
  ellipse(bx - 70, by + 4, 180, 28);

  pop();
}

// ---------- Boat ----------
function drawBoat(bx, by) {
  push();
  translate(bx, by);

  // Tilt the boat very slightly with the bob.
  const tilt = sin(t * 0.6) * 0.025;
  rotate(tilt);

  const bw = 42;   // boat half-length
  const bh = 6;    // boat half-height

  // Reflection — drawn first, beneath the hull.
  noStroke();
  const refl = color(BOAT_DARK);
  refl.setAlpha(60);
  fill(refl);
  beginShape();
  vertex(-bw * 0.9, 2);
  quadraticVertex(0, bh * 3.2, bw * 0.9, 2);
  endShape(CLOSE);

  // Subtle water shimmer below.
  const shim = color(WATER_OUT);
  shim.setAlpha(70);
  fill(shim);
  ellipse(0, bh * 1.4, bw * 1.6, 4);

  // Hull main shape — long, narrow, slightly upturned at ends.
  fill(BOAT_MAIN);
  noStroke();
  beginShape();
  vertex(-bw, 0);
  quadraticVertex(-bw * 0.7, bh * 1.1, 0, bh * 1.15);
  quadraticVertex(bw * 0.7, bh * 1.1, bw, 0);
  quadraticVertex(bw * 0.6, -bh * 0.2, 0, -bh * 0.05);
  quadraticVertex(-bw * 0.6, -bh * 0.2, -bw, 0);
  endShape(CLOSE);

  // Inner shadow line — gives the hull depth.
  stroke(BOAT_DARK);
  strokeWeight(1.1);
  noFill();
  beginShape();
  vertex(-bw * 0.85, 0.2);
  quadraticVertex(0, bh * 0.95, bw * 0.85, 0.2);
  endShape();

  // Faint highlight along the gunwale.
  stroke(BOAT_LITE);
  strokeWeight(0.6);
  noFill();
  beginShape();
  vertex(-bw * 0.8, -bh * 0.1);
  quadraticVertex(0, -bh * 0.3, bw * 0.8, -bh * 0.1);
  endShape();

  // Tiny figure on board — just a small warm bump.
  noStroke();
  fill(FIG_DARK);
  ellipse(-2, -bh * 0.8, 3.4, 6);
  fill(FIG_WARM);
  ellipse(-2, -bh * 1.05, 2.6, 2.6);

  pop();
}

// ---------- Final haze ----------
function drawHaze() {
  // A faint warm overlay near the top, plus subtle vignette at corners.
  push();
  noStroke();
  for (let i = 0; i < 6; i++) {
    fill(255, 255, 245, 4);
    rect(0, 0, BASE_W, BASE_H * 0.25);
  }
  // Bottom darkening for depth.
  for (let y = 0; y < 60; y++) {
    const a = map(y, 0, 60, 0, 18);
    stroke(10, 30, 24, a);
    line(0, BASE_H - y, BASE_W, BASE_H - y);
  }
  pop();
}
