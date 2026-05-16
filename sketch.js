/*
  Reed field & a small boat.
  All visuals are generated with p5.js — no external images.
  Reeds are short, fine, and very numerous; their direction follows a
  swirl around the boat so the field looks like a vortex of grass.
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
let grasses = [];
let bgLayer;
let fogLayer;
let boat = { x: 0, y: 0, vx: 0 };
let t = 0;
let scaleFactor = 1;
let seed;

// Reed counts per depth layer.
const FAR_COUNT  = 2800;
const MID_COUNT  = 3600;
const NEAR_COUNT = 1500;

// Clearing ellipse around the boat.
const ELL_W = 110;   // semi-axis x
const ELL_H = 42;    // semi-axis y

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
  boat.vx = BASE_W / (60 * 45);  // ~45s across

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
    bgLayer.stroke(lerpColor(c1, c2, local));
    bgLayer.line(0, y, BASE_W, y);
  }

  // Paper grain.
  bgLayer.noStroke();
  for (let i = 0; i < 2000; i++) {
    bgLayer.fill(random() < 0.5 ? 255 : 0, random(3, 12));
    bgLayer.rect(random(BASE_W), random(BASE_H), 1, 1);
  }
}

function buildFog() {
  fogLayer = createGraphics(BASE_W, BASE_H);
  fogLayer.noStroke();
  for (let y = 0; y < BASE_H * 0.55; y++) {
    const a = map(y, 0, BASE_H * 0.55, 110, 0);
    fogLayer.stroke(255, 255, 255, a);
    fogLayer.line(0, y, BASE_W, y);
  }
  for (let i = 0; i < 500; i++) {
    fogLayer.fill(255, random(2, 7));
    fogLayer.ellipse(random(BASE_W), random(BASE_H * 0.6),
                     random(20, 70), random(20, 70));
  }
}

// ---------- Reeds ----------
function buildGrasses() {
  grasses = [];

  // Approximate vortex center used at build time — reeds get pre-baked
  // swirl/radial preferences relative to this. At draw time, each reed
  // re-evaluates its direction against the moving boat anyway.
  const cx = BASE_W * 0.5;
  const cy = BASE_H * 0.56;

  // Far layer — short, fine, light, covering upper half.
  for (let i = 0; i < FAR_COUNT; i++) {
    const x = random(-20, BASE_W + 20);
    const y = random(BASE_H * 0.18, BASE_H * 0.62);
    grasses.push(makeGrass(x, y, 0, cx, cy));
  }
  // Mid layer — bulk of the field.
  for (let i = 0; i < MID_COUNT; i++) {
    const x = random(-30, BASE_W + 30);
    const y = random(BASE_H * 0.30, BASE_H * 0.95);
    grasses.push(makeGrass(x, y, 1, cx, cy));
  }
  // Near layer — bottom band.
  for (let i = 0; i < NEAR_COUNT; i++) {
    const x = random(-40, BASE_W + 40);
    const y = random(BASE_H * 0.62, BASE_H + 30);
    grasses.push(makeGrass(x, y, 2, cx, cy));
  }

  // Sort so far layer paints first, then mid, then near.
  grasses.sort((a, b) => (a.depth - b.depth) || (a.y - b.y));
}

function makeGrass(x, y, depth, cx, cy) {
  // Tight size profile — reeds are *fine* lines.
  let lenMin, lenMax, wMin, wMax, alpha;
  if (depth === 0) {
    lenMin = 14;  lenMax = 32;
    wMin = 0.25;  wMax = 0.45;
    alpha = random(55, 110);
  } else if (depth === 1) {
    lenMin = 28;  lenMax = 58;
    wMin = 0.35;  wMax = 0.65;
    alpha = random(95, 170);
  } else {
    lenMin = 50;  lenMax = 92;
    wMin = 0.5;   wMax = 0.85;
    alpha = random(150, 220);
  }

  // Lower reeds tend longer.
  const yNorm = constrain(map(y, BASE_H * 0.2, BASE_H, 0, 1), 0, 1);
  const len = lerp(lenMin, lenMax, pow(yNorm, 0.6) * random(0.75, 1.05));

  // Palette pick — mostly mid, some dark, sprinkle of light.
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

  // Swirl preference — how much the reed wraps around the boat vs. points
  // straight at it. ~PI/2 = tangent (full swirl); 0 = pointing at center.
  // We aim for a mostly tangential clockwise swirl, with variation.
  const swirl = random(-PI * 0.55, -PI * 0.20);   // negative = clockwise tangent

  // Per-reed style.
  return {
    x, y,
    depth,
    len,
    width: random(wMin, wMax),
    color: col,
    swirl,
    curl: random(0.7, 1.3),
    flip: random() < 0.5 ? -1 : 1,
    phase: random(TWO_PI),
    stiffness: random(0.6, 1.0),
  };
}

// ---------- Draw ----------
function draw() {
  t = frameCount * 0.008;

  // Boat motion.
  boat.x += boat.vx;
  if (boat.x > BASE_W + 80) boat.x = -80;
  boat.y = BASE_H * 0.56 + sin(t * 0.6) * 1.8 + sin(t * 1.3 + 1.2) * 0.5;

  push();
  scale(scaleFactor);

  image(bgLayer, 0, 0);
  drawGrassLayer(0);
  image(fogLayer, 0, 0);
  drawGrassLayer(1);
  drawClearing(boat.x, boat.y);
  drawBoat(boat.x, boat.y);
  drawGrassLayer(2);
  drawHaze();

  pop();
}

// ---------- Grass rendering ----------
function drawGrassLayer(depth) {
  noFill();
  const bx = boat.x;
  const by = boat.y;

  // Near layer keeps a wider exclusion so it can never overlap the boat.
  const inner = depth === 2 ? 1.10 : 0.92;
  const outer = depth === 2 ? 1.55 : 1.35;

  for (let g of grasses) {
    if (g.depth !== depth) continue;

    const dx = (g.x - bx) / ELL_W;
    const dy = (g.y - by) / ELL_H;
    const ed = sqrt(dx * dx + dy * dy);

    if (ed < inner) continue;
    let edgeFade = 1;
    if (ed < outer) {
      edgeFade = map(ed, inner, outer, 0, 1);
      edgeFade = pow(constrain(edgeFade, 0, 1), 1.5);
    }

    drawReed(g, bx, by, edgeFade);
  }
}

function drawReed(g, bx, by, edgeFade) {
  const x0 = g.x;
  const y0 = g.y;

  // Vector from reed to boat (the vortex center).
  const dx = bx - x0;
  const dy = by - y0;
  const dist = sqrt(dx * dx + dy * dy);
  if (dist < 0.001) return;
  const ux = dx / dist;
  const uy = dy / dist;

  // Apply the swirl: rotate the "toward-center" vector by g.swirl so the
  // reed runs along (or near) a tangent of the circle around the boat.
  const cs = cos(g.swirl);
  const sn = sin(g.swirl);
  let dirX = ux * cs - uy * sn;
  let dirY = ux * sn + uy * cs;

  // Wind perturbation — large noise field + travelling sine wave.
  const wind = noise(x0 * 0.0035, y0 * 0.0035, t * 0.55) - 0.5;
  const wave = sin(x0 * 0.012 + y0 * 0.009 + t * 1.7 + g.phase);

  let swayMax;
  if (g.depth === 0)      swayMax = 0.09;
  else if (g.depth === 1) swayMax = 0.15;
  else                    swayMax = 0.22;
  const sway = (wind * 1.4 + wave * 0.55) * swayMax;

  const cs2 = cos(sway), sn2 = sin(sway);
  const fx = dirX * cs2 - dirY * sn2;
  const fy = dirX * sn2 + dirY * cs2;

  // Length & width fade near the clearing edge.
  const len = g.len * (0.45 + 0.55 * edgeFade);
  const w   = g.width * (0.55 + 0.45 * edgeFade);

  // Tip & curl.
  const tipX = x0 + fx * len;
  const tipY = y0 + fy * len;
  const perpX = -fy;
  const perpY =  fx;
  const curlAmt = g.curl * len * 0.10 * g.flip;
  const midX = x0 + fx * len * 0.5 + perpX * curlAmt;
  const midY = y0 + fy * len * 0.5 + perpY * curlAmt;

  const a = alpha(g.color) * edgeFade;
  if (a < 3) return;
  const col = color(red(g.color), green(g.color), blue(g.color), a);

  stroke(col);
  strokeWeight(w);
  noFill();
  beginShape();
  vertex(x0, y0);
  quadraticVertex(midX, midY, tipX, tipY);
  endShape();
}

// ---------- Water clearing ----------
function drawClearing(bx, by) {
  push();
  noStroke();

  // Feathered halo — many concentric translucent ellipses.
  for (let i = 22; i >= 0; i--) {
    const k = i / 22;
    const w = lerp(ELL_W * 2.3, ELL_W * 1.0, 1 - k);
    const h = lerp(ELL_H * 2.3, ELL_H * 1.0, 1 - k);
    const c = lerpColor(color(WATER_OUT), color(WATER_IN), 1 - k);
    c.setAlpha(lerp(2, 24, 1 - k));
    fill(c);
    ellipse(bx, by + 2, w, h);
  }

  // Inner pale water disk.
  const inner = color(WATER_IN);
  inner.setAlpha(95);
  fill(inner);
  ellipse(bx, by + 2, ELL_W * 1.7, ELL_H * 1.6);

  // Soft ripples.
  noFill();
  for (let i = 0; i < 4; i++) {
    const rw = ELL_W * (0.5 + i * 0.18) + sin(t * 0.7 + i) * 3;
    const rh = ELL_H * (0.3 + i * 0.12);
    const rc = color(RIPPLE_COL);
    rc.setAlpha(map(i, 0, 3, 20, 5));
    stroke(rc);
    strokeWeight(0.5);
    ellipse(bx + sin(t * 0.4 + i) * 1.5, by + 5 + i, rw, rh);
  }

  // Wake.
  noStroke();
  const wake = color(WATER_IN);
  wake.setAlpha(35);
  fill(wake);
  ellipse(bx - ELL_W * 0.7, by + 4, ELL_W * 1.4, ELL_H * 0.5);

  pop();
}

// ---------- Boat ----------
function drawBoat(bx, by) {
  push();
  translate(bx, by);
  rotate(sin(t * 0.6) * 0.025);

  const bw = 22;
  const bh = 3.2;

  // Reflection under hull.
  noStroke();
  const refl = color(BOAT_DARK);
  refl.setAlpha(55);
  fill(refl);
  beginShape();
  vertex(-bw * 0.9, 1);
  quadraticVertex(0, bh * 2.6, bw * 0.9, 1);
  endShape(CLOSE);

  // Hull.
  fill(BOAT_MAIN);
  beginShape();
  vertex(-bw, 0);
  quadraticVertex(-bw * 0.7, bh * 1.1, 0, bh * 1.15);
  quadraticVertex(bw * 0.7, bh * 1.1, bw, 0);
  quadraticVertex(bw * 0.6, -bh * 0.25, 0, -bh * 0.1);
  quadraticVertex(-bw * 0.6, -bh * 0.25, -bw, 0);
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
  quadraticVertex(0, -bh * 0.35, bw * 0.78, -bh * 0.15);
  endShape();

  // Tiny figure.
  noStroke();
  fill(FIG_DARK);
  ellipse(-1.5, -bh * 0.85, 2.2, 3.6);
  fill(FIG_WARM);
  ellipse(-1.5, -bh * 1.15, 1.7, 1.7);

  pop();
}

// ---------- Final haze ----------
function drawHaze() {
  push();
  noStroke();
  for (let i = 0; i < 5; i++) {
    fill(255, 255, 245, 4);
    rect(0, 0, BASE_W, BASE_H * 0.22);
  }
  for (let y = 0; y < 50; y++) {
    const a = map(y, 0, 50, 0, 16);
    stroke(10, 30, 24, a);
    line(0, BASE_H - y, BASE_W, BASE_H - y);
  }
  pop();
}
