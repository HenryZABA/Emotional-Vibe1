/*
  Reed field & a small boat.
  All visuals generated with p5.js. The field is a vortex of curved,
  hair-fine reeds; reeds in the centre band sweep around a soft elliptical
  patch of water, where a tiny boat drifts left to right.
*/

// ---------- Canvas ----------
const BASE_W = 390;
const BASE_H = 844;

// ---------- Palette ----------
const SKY_TOP    = "#F5F7EE";
const SKY_MIST   = "#DDEBDD";
const SKY_TEAL   = "#A9D6BA";
const MID_GREEN  = "#4F9A68";
const DEEP_GREEN = "#1F5F46";
const SHADE_GRN  = "#163F34";

const GRASS_DARK = ["#174633", "#1D5B42", "#246B4A", "#2F7A55"];
const GRASS_MID  = ["#4F9A68", "#68B17D", "#7FC493", "#91CFA3"];
const GRASS_LITE = ["#B9E0C4", "#D5EED8", "#E6F4E5", "#F2F7EC"];
const GRASS_COOL = ["#8ECDB2", "#A9DCC4", "#C8E8D8"];

const WATER_IN   = "#E8F3E6";
const WATER_OUT  = "#BFDCC7";
const RIPPLE_COL = "#315F50";

const BOAT_MAIN  = "#102B25";
const BOAT_DARK  = "#081915";
const BOAT_LITE  = "#3F6557";
const FIG_WARM   = "#6B3E2A";
const FIG_DARK   = "#4A2A1C";

// ---------- State ----------
let grasses = [];
let bgLayer;
let fogLayer;
let boat = { x: 0, y: 0, vx: 0 };
let t = 0;
let scaleFactor = 1;
let seed;

// Reed counts per depth.
const FAR_COUNT  = 2400;
const MID_COUNT  = 3200;
const NEAR_COUNT = 1100;

// Clearing ellipse semi-axes.
const ELL_W = 100;   // → 200px wide
const ELL_H = 40;    // → 80px tall

function setup() {
  const targetRatio = BASE_W / BASE_H;
  let w = windowWidth;
  let h = windowHeight;
  if (w / h > targetRatio) w = h * targetRatio;
  else h = w / targetRatio;

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
  boat.vx = BASE_W / (60 * 45);

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

  const stops = [
    { p: 0.00, c: color(SKY_TOP) },
    { p: 0.20, c: color(SKY_MIST) },
    { p: 0.40, c: color(SKY_TEAL) },
    { p: 0.65, c: color(MID_GREEN) },
    { p: 0.88, c: color(DEEP_GREEN) },
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
    bgLayer.stroke(lerpColor(c1, c2, local));
    bgLayer.line(0, y, BASE_W, y);
  }

  // Paper grain.
  bgLayer.noStroke();
  for (let i = 0; i < 2200; i++) {
    bgLayer.fill(random() < 0.5 ? 255 : 0, random(3, 10));
    bgLayer.rect(random(BASE_W), random(BASE_H), 1, 1);
  }
  // Soft horizontal washes.
  for (let i = 0; i < 10; i++) {
    bgLayer.fill(255, random(4, 9));
    bgLayer.rect(0, random(BASE_H * 0.25, BASE_H), BASE_W, random(50, 180));
  }
}

function buildFog() {
  fogLayer = createGraphics(BASE_W, BASE_H);
  fogLayer.noStroke();
  for (let y = 0; y < BASE_H * 0.55; y++) {
    const a = map(y, 0, BASE_H * 0.55, 120, 0);
    fogLayer.stroke(255, 255, 255, a);
    fogLayer.line(0, y, BASE_W, y);
  }
  for (let i = 0; i < 600; i++) {
    fogLayer.fill(255, random(2, 7));
    fogLayer.ellipse(random(BASE_W), random(BASE_H * 0.6),
                     random(20, 80), random(20, 80));
  }
}

// ---------- Reeds ----------
function buildGrasses() {
  grasses = [];

  // Far layer — short, fine, lighter, upper band.
  for (let i = 0; i < FAR_COUNT; i++) {
    const x = random(-20, BASE_W + 20);
    const y = random(BASE_H * 0.15, BASE_H * 0.60);
    grasses.push(makeGrass(x, y, 0));
  }
  // Mid layer — broad band, the densest.
  for (let i = 0; i < MID_COUNT; i++) {
    const x = random(-30, BASE_W + 30);
    const y = random(BASE_H * 0.30, BASE_H * 0.95);
    grasses.push(makeGrass(x, y, 1));
  }
  // Near layer — bottom band, longer and darker.
  for (let i = 0; i < NEAR_COUNT; i++) {
    const x = random(-40, BASE_W + 40);
    const y = random(BASE_H * 0.62, BASE_H + 40);
    grasses.push(makeGrass(x, y, 2));
  }

  grasses.sort((a, b) => (a.depth - b.depth) || (a.y - b.y));
}

function makeGrass(x, y, depth) {
  let lenMin, lenMax, wMin, wMax, alpha;
  if (depth === 0) {
    lenMin = 18;  lenMax = 42;
    wMin = 0.25;  wMax = 0.45;
    alpha = random(50, 110);
  } else if (depth === 1) {
    lenMin = 35;  lenMax = 78;
    wMin = 0.35;  wMax = 0.65;
    alpha = random(100, 180);
  } else {
    lenMin = 65;  lenMax = 130;
    wMin = 0.50;  wMax = 0.90;
    alpha = random(160, 225);
  }

  const yNorm = constrain(map(y, BASE_H * 0.2, BASE_H, 0, 1), 0, 1);
  const len = lerp(lenMin, lenMax, pow(yNorm, 0.55) * random(0.8, 1.05));

  // Palette: mostly mid; some dark on near; light sprinkle on far.
  const r = random();
  let palette;
  if (r < 0.55)      palette = GRASS_MID;
  else if (r < 0.78) palette = depth === 2 ? GRASS_DARK : GRASS_MID;
  else if (r < 0.90) palette = GRASS_DARK;
  else if (r < 0.97) palette = GRASS_LITE;
  else               palette = GRASS_COOL;
  if (depth === 0 && random() < 0.45) palette = GRASS_LITE;

  const col = color(palette[floor(random(palette.length))]);
  col.setAlpha(alpha);

  return {
    x, y,
    depth,
    len,
    width: random(wMin, wMax),
    color: col,
    // How much the tip drops toward the perpendicular (the "comma" curl).
    bend: random(0.18, 0.34),
    flip: random() < 0.5 ? -1 : 1,
    // Small per-reed swirl jitter so the field isn't perfectly tangent.
    swirlJitter: random(-0.14, 0.14),
    phase: random(TWO_PI),
    stiffness: random(0.6, 1.0),
  };
}

// ---------- Draw ----------
function draw() {
  t = frameCount * 0.008;

  boat.x += boat.vx;
  if (boat.x > BASE_W + 80) boat.x = -80;
  boat.y = BASE_H * 0.56 + sin(t * 0.6) * 1.8 + sin(t * 1.3 + 1.2) * 0.5;

  push();
  scale(scaleFactor);

  image(bgLayer, 0, 0);
  drawGrassLayer(0);     // far
  image(fogLayer, 0, 0); // top fog
  drawGrassLayer(1);     // mid
  drawClearing(boat.x, boat.y);
  drawBoat(boat.x, boat.y);
  drawGrassLayer(2);     // near, on top
  drawHaze();

  pop();
}

// ---------- Grass rendering ----------
function drawGrassLayer(depth) {
  noFill();
  const bx = boat.x;
  const by = boat.y;

  // Exclusion radii in ellipse-distance units.
  // Near layer keeps a wider exclusion so it cannot overlap the boat.
  const inner = depth === 2 ? 1.20 : 0.92;
  const outer = depth === 2 ? 1.75 : 1.45;

  for (let g of grasses) {
    if (g.depth !== depth) continue;

    const dx = (g.x - bx) / ELL_W;
    const dy = (g.y - by) / ELL_H;
    const ed = sqrt(dx * dx + dy * dy);

    if (ed < inner) continue;
    let edgeFade = 1;
    if (ed < outer) {
      edgeFade = map(ed, inner, outer, 0, 1);
      // smoothstep
      edgeFade = edgeFade * edgeFade * (3 - 2 * edgeFade);
    }

    drawReed(g, bx, by, ed, edgeFade);
  }
}

function drawReed(g, bx, by, ed, edgeFade) {
  const x0 = g.x;
  const y0 = g.y;

  // Vector from reed root to boat (vortex center).
  const rdx = bx - x0;
  const rdy = by - y0;
  const rd  = sqrt(rdx * rdx + rdy * rdy) || 0.001;
  const cux = rdx / rd;
  const cuy = rdy / rd;

  // Tangent to the circle around the boat (rotate "toward center" by -90°).
  // This makes the field run clockwise around the clearing.
  const tx = -cuy;
  const ty =  cux;

  // Apply a small per-reed jitter so the swirl isn't mechanically perfect.
  const sj = g.swirlJitter;
  const csj = cos(sj), snj = sin(sj);
  let dirX = tx * csj - ty * snj;
  let dirY = tx * snj + ty * csj;

  // Wind & wave perturbation. The wave travels diagonally so the gust
  // moves from lower-left to upper-right across the field.
  const wind = (noise(x0 * 0.0045, y0 * 0.0045, t * 0.55) - 0.5);
  const wave = sin(x0 * 0.015 - y0 * 0.010 + t * 1.7 + g.phase);

  let swayMax;
  if (g.depth === 0)      swayMax = 0.08;
  else if (g.depth === 1) swayMax = 0.15;
  else                    swayMax = 0.22;
  const sway = wind * 0.4 + wave * swayMax;

  const cs = cos(sway), sn = sin(sway);
  const fX = dirX * cs - dirY * sn;
  const fY = dirX * sn + dirY * cs;

  // Length & width respond to the clearing edge.
  const len = g.len * (0.45 + 0.55 * edgeFade);
  const w   = g.width * (0.55 + 0.45 * edgeFade);

  // Perpendicular for the bend offset.
  const pX = -fY;
  const pY =  fX;

  // Tip droops away from base direction. Wave modulates the bend so reeds
  // breathe rather than being statically curved.
  const bendStrength = g.bend * (0.85 + 0.30 * wave);
  const bendAmt = bendStrength * len * g.flip;

  // Control point sits ~55% along the direction, displaced perpendicular.
  const cX = x0 + fX * len * 0.55 + pX * bendAmt * 0.55;
  const cY = y0 + fY * len * 0.55 + pY * bendAmt * 0.55;
  // Tip drops a little farther toward the perpendicular for a comma shape.
  const tX = x0 + fX * len * 0.92 + pX * bendAmt * 1.10;
  const tY = y0 + fY * len * 0.92 + pY * bendAmt * 1.10;

  const baseA = alpha(g.color) * edgeFade;
  if (baseA < 3) return;
  const rC = red(g.color), gC = green(g.color), bC = blue(g.color);

  // Main body — root to tip, full thickness.
  noFill();
  stroke(color(rC, gC, bC, baseA));
  strokeWeight(w);
  beginShape();
  vertex(x0, y0);
  quadraticVertex(cX, cY, tX, tY);
  endShape();

  // Tip taper — finer stroke over the upper half, simulating the leaf
  // thinning toward its tip. Only worth it when the reed is thick enough.
  if (w > 0.42) {
    const sX = lerp(x0, cX, 0.55);
    const sY = lerp(y0, cY, 0.55);
    stroke(color(rC, gC, bC, baseA * 0.85));
    strokeWeight(w * 0.50);
    beginShape();
    vertex(sX, sY);
    quadraticVertex(
      lerp(cX, tX, 0.45),
      lerp(cY, tY, 0.45),
      tX, tY
    );
    endShape();
  }
}

// ---------- Water clearing ----------
function drawClearing(bx, by) {
  push();
  noStroke();

  // Feathered halo — many concentric translucent ellipses for a soft edge.
  for (let i = 26; i >= 0; i--) {
    const k = i / 26;
    const w = lerp(ELL_W * 2.4, ELL_W * 1.05, 1 - k);
    const h = lerp(ELL_H * 2.4, ELL_H * 1.05, 1 - k);
    const c = lerpColor(color(WATER_OUT), color(WATER_IN), 1 - k);
    c.setAlpha(lerp(2, 26, 1 - k));
    fill(c);
    ellipse(bx, by + 2, w, h);
  }

  // Inner pale water.
  const inner = color(WATER_IN);
  inner.setAlpha(110);
  fill(inner);
  ellipse(bx, by + 2, ELL_W * 1.75, ELL_H * 1.55);

  // Soft ripples sliding outward.
  noFill();
  for (let i = 0; i < 5; i++) {
    const phase = (t * 0.5 + i * 0.6) % 2;
    const rw = ELL_W * (0.5 + phase * 0.45);
    const rh = ELL_H * (0.35 + phase * 0.3);
    const rc = color(RIPPLE_COL);
    rc.setAlpha(map(phase, 0, 1.4, 18, 0));
    stroke(rc);
    strokeWeight(0.5);
    ellipse(bx + sin(t * 0.4 + i) * 1.5, by + 5, rw, rh);
  }

  // Wake.
  noStroke();
  const wake = color(WATER_IN);
  wake.setAlpha(45);
  fill(wake);
  ellipse(bx - ELL_W * 0.75, by + 4, ELL_W * 1.5, ELL_H * 0.55);

  pop();
}

// ---------- Boat ----------
function drawBoat(bx, by) {
  push();
  translate(bx, by);
  rotate(sin(t * 0.6) * 0.025);

  const bw = 20;   // half-length → 40px total
  const bh = 3;    // half-height → 6px total

  // Reflection.
  noStroke();
  const refl = color(BOAT_DARK);
  refl.setAlpha(55);
  fill(refl);
  beginShape();
  vertex(-bw * 0.9, 1);
  quadraticVertex(0, bh * 2.6, bw * 0.9, 1);
  endShape(CLOSE);

  // Horizontal water shimmer.
  const shim = color(WATER_OUT);
  shim.setAlpha(80);
  fill(shim);
  ellipse(0, bh * 1.5, bw * 1.8, 3);

  // Hull.
  fill(BOAT_MAIN);
  beginShape();
  vertex(-bw, 0);
  quadraticVertex(-bw * 0.7, bh * 1.15, 0, bh * 1.2);
  quadraticVertex(bw * 0.7, bh * 1.15, bw, 0);
  quadraticVertex(bw * 0.6, -bh * 0.3, 0, -bh * 0.1);
  quadraticVertex(-bw * 0.6, -bh * 0.3, -bw, 0);
  endShape(CLOSE);

  // Inner shadow.
  stroke(BOAT_DARK);
  strokeWeight(0.8);
  noFill();
  beginShape();
  vertex(-bw * 0.82, 0.2);
  quadraticVertex(0, bh * 0.95, bw * 0.82, 0.2);
  endShape();

  // Gunwale highlight.
  stroke(BOAT_LITE);
  strokeWeight(0.4);
  beginShape();
  vertex(-bw * 0.78, -bh * 0.15);
  quadraticVertex(0, -bh * 0.4, bw * 0.78, -bh * 0.15);
  endShape();

  // Tiny figure — torso + head.
  noStroke();
  fill(FIG_DARK);
  ellipse(-1.5, -bh * 0.9, 2.2, 4);
  fill(FIG_WARM);
  ellipse(-1.5, -bh * 1.25, 1.7, 1.7);

  pop();
}

// ---------- Final haze ----------
function drawHaze() {
  push();
  noStroke();
  // Top warm haze for atmosphere.
  for (let i = 0; i < 5; i++) {
    fill(255, 255, 245, 4);
    rect(0, 0, BASE_W, BASE_H * 0.22);
  }
  // Bottom darkening.
  for (let y = 0; y < 60; y++) {
    const a = map(y, 0, 60, 0, 18);
    stroke(10, 30, 24, a);
    line(0, BASE_H - y, BASE_W, BASE_H - y);
  }
  pop();
}
