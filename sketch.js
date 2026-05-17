/*
  Reed field & a small boat.
  Top-down grass ocean: thousands of short, curved strokes flow
  horizontally with a clockwise swirl around a soft eye-shaped pool of
  water, where a tiny boat drifts left to right.
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
const FAR_COUNT  = 2800;
const MID_COUNT  = 3600;
const NEAR_COUNT = 1100;

// Clearing semi-axes — narrower opening, just wider than the boat.
const ELL_W = 62;    // → 124 wide
const ELL_H = 21;    // → 42 tall

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
  boat.vx = BASE_W / (60 * 48);

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
    { p: 0.42, c: color(SKY_TEAL) },
    { p: 0.66, c: color(MID_GREEN) },
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
  for (let i = 0; i < 2400; i++) {
    bgLayer.fill(random() < 0.5 ? 255 : 0, random(3, 9));
    bgLayer.rect(random(BASE_W), random(BASE_H), 1, 1);
  }
  // Horizontal washes for atmosphere.
  for (let i = 0; i < 12; i++) {
    bgLayer.fill(255, random(3, 8));
    bgLayer.rect(0, random(BASE_H * 0.25, BASE_H), BASE_W, random(40, 160));
  }
}

function buildFog() {
  fogLayer = createGraphics(BASE_W, BASE_H);
  fogLayer.noStroke();
  for (let y = 0; y < BASE_H * 0.55; y++) {
    const a = map(y, 0, BASE_H * 0.55, 130, 0);
    fogLayer.stroke(255, 255, 255, a);
    fogLayer.line(0, y, BASE_W, y);
  }
  for (let i = 0; i < 700; i++) {
    fogLayer.fill(255, random(2, 6));
    fogLayer.ellipse(random(BASE_W), random(BASE_H * 0.6),
                     random(20, 80), random(20, 80));
  }
}

// ---------- Reeds ----------
function buildGrasses() {
  grasses = [];

  // Far — thin, fine, covering everything from upper fog band to mid.
  // Upper part of this band ends up extremely faint; lower part is more visible.
  for (let i = 0; i < FAR_COUNT; i++) {
    const x = random(-20, BASE_W + 20);
    const y = random(BASE_H * 0.20, BASE_H * 0.62);
    grasses.push(makeGrass(x, y, 0));
  }
  // Mid — densest mass, fills the body of the field.
  for (let i = 0; i < MID_COUNT; i++) {
    const x = random(-30, BASE_W + 30);
    const y = random(BASE_H * 0.32, BASE_H * 0.96);
    grasses.push(makeGrass(x, y, 1));
  }
  // Near — confined to the bottom band only.
  for (let i = 0; i < NEAR_COUNT; i++) {
    const x = random(-40, BASE_W + 40);
    const y = random(BASE_H * 0.78, BASE_H + 30);
    grasses.push(makeGrass(x, y, 2));
  }

  grasses.sort((a, b) => (a.depth - b.depth) || (a.y - b.y));
}

function makeGrass(x, y, depth) {
  let lenMin, lenMax, wMin, wMax, alphaVal;
  const yNorm = constrain(map(y, BASE_H * 0.2, BASE_H, 0, 1), 0, 1);

  if (depth === 0) {
    lenMin = 12;  lenMax = 32;
    wMin = 0.22;  wMax = 0.42;
    // Top of band is barely visible; lower edge of far layer is more apparent.
    const yFactor = constrain(
      map(y, BASE_H * 0.20, BASE_H * 0.60, 0, 1), 0, 1);
    alphaVal = lerp(random(8, 22), random(40, 90), yFactor);
  } else if (depth === 1) {
    lenMin = 25;  lenMax = 65;
    wMin = 0.32;  wMax = 0.62;
    alphaVal = random(55, 135);
  } else {
    lenMin = 55;  lenMax = 105;
    wMin = 0.45;  wMax = 0.85;
    alphaVal = random(130, 200);
  }

  const len = lerp(lenMin, lenMax, pow(yNorm, 0.55) * random(0.8, 1.05));

  // Palette: bottom half biased to dark/mid; upper biased to lighter/cool.
  let palette;
  const r = random();
  if (y > BASE_H * 0.70 || depth === 2) {
    if (r < 0.55)      palette = GRASS_DARK;
    else if (r < 0.90) palette = GRASS_MID;
    else if (r < 0.98) palette = GRASS_COOL;
    else               palette = GRASS_LITE;
  } else if (depth === 0) {
    if (r < 0.50)      palette = GRASS_LITE;
    else if (r < 0.80) palette = GRASS_COOL;
    else               palette = GRASS_MID;
  } else {
    if (r < 0.55)      palette = GRASS_MID;
    else if (r < 0.78) palette = GRASS_DARK;
    else if (r < 0.93) palette = GRASS_MID;
    else if (r < 0.99) palette = GRASS_COOL;
    else               palette = GRASS_LITE;
  }

  const col = color(palette[floor(random(palette.length))]);
  col.setAlpha(alphaVal);

  return {
    x, y,
    depth,
    len,
    width: random(wMin, wMax),
    color: col,
    phase: random(TWO_PI),
    // Per-reed fixed lean — tiny preference in resting bend direction so
    // the field isn't perfectly uniform when wind is calm.
    baseLean: random(-0.5, 0.5),
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
  drawGrassLayer(0);                  // far
  image(fogLayer, 0, 0);              // top fog
  drawGrassLayer(1);                  // mid
  drawBoat(boat.x, boat.y);           // boat in the grass-free opening
  drawGrassLayer(2);                  // near, on top
  drawHaze();

  pop();
}

// ---------- Grass rendering ----------
function drawGrassLayer(depth) {
  noFill();
  const bx = boat.x;
  const by = boat.y;

  for (let g of grasses) {
    if (g.depth !== depth) continue;

    const dx = (g.x - bx) / ELL_W;
    const dy = (g.y - by) / ELL_H;
    const ed = sqrt(dx * dx + dy * dy);

    // Per-reed angular noise on the boundary so the rim is irregular.
    const ang = atan2(dy, dx);
    const rimN = (noise(cos(ang) * 1.6 + 7.1,
                        sin(ang) * 1.6 + 13.4) - 0.5) * 0.20;

    // Near layer keeps a wider exclusion so foreground reeds can't smother
    // the boat or the pool.
    const inner = (depth === 2 ? 1.25 : 0.95) + rimN;
    const outer = inner + (depth === 2 ? 0.55 : 0.45);

    if (ed < inner) continue;
    let edgeFade = 1;
    if (ed < outer) {
      edgeFade = map(ed, inner, outer, 0, 1);
      edgeFade = edgeFade * edgeFade * (3 - 2 * edgeFade);  // smoothstep
    }

    // Vertical reeds grow straight up from (g.x, g.y). If the root sits
    // below the clearing and the tip would enter the ellipse from below,
    // clip the length so the tip stops at the rim.
    let effLen = g.len;
    const xFracN = (g.x - bx) / ELL_W;
    if (abs(xFracN) < 1) {
      const yOff = ELL_H * sqrt(1 - xFracN * xFracN);
      const yLowRim = by + yOff;
      if (g.y > yLowRim) {
        effLen = min(g.len, g.y - yLowRim - 1);
      }
    }
    if (effLen < 3) continue;

    drawReed(g, effLen, edgeFade);
  }
}

// A reed grows straight up from (g.x, g.y). Wind doesn't rotate the
// whole blade — it bends the upper half horizontally, so the curve goes
// from straight to comma-shaped while the root stays fixed.
function drawReed(g, effLen, edgeFade) {
  const x0 = g.x;
  const y0 = g.y;

  // Wind/wave field. Two travelling sine waves at different scales plus a
  // slow noise gust together give a more "physical" rhythm than a pure
  // sine — strong pushes, brief lulls, occasional cross-currents.
  const gust   = (noise(x0 * 0.0035, y0 * 0.0035, t * 0.40) - 0.5) * 2;
  const wave1  = sin(x0 * 0.013 - y0 * 0.009 + t * 1.8 + g.phase);
  const wave2  = sin(x0 * 0.026 - y0 * 0.018 + t * 2.7 + g.phase * 1.7) * 0.4;
  const breath = sin(t * 0.45) * 0.25;   // slow whole-field swell
  const bendSignal = constrain(gust * 0.55 + wave1 * 0.7 + wave2 + breath, -1.2, 1.2);

  // Tip can swing a long way — proportional to reed length so longer
  // (foreground) reeds whip further than short far reeds.
  let maxBend;
  if (g.depth === 0)      maxBend = 12;
  else if (g.depth === 1) maxBend = 30;
  else                    maxBend = 55;

  const len = effLen * (0.5 + 0.5 * edgeFade);
  const w   = g.width * (0.60 + 0.40 * edgeFade);

  // Near the clearing rim, dampen the bend so reeds don't whip across the
  // boat as the gust pushes hardest.
  const bendScale = 0.45 + 0.55 * edgeFade;
  const tipDx = bendSignal * maxBend * bendScale + g.baseLean * 4;
  // Foreshortening: when the blade lays over, the tip drops more
  // (squared on the signal so small motions stay nearly upright).
  const droopY = bendSignal * bendSignal * len * 0.12;

  const tipX = x0 + tipDx;
  const tipY = y0 - len + droopY;

  // Control point: middle-upper section. Lower half stays close to
  // vertical, upper half is where the bending shows. When the blade
  // lays over hard, drop the control with the tip so the whole arc
  // bends as one continuous curve.
  const ctrlX = x0 + tipDx * 0.35;
  const ctrlY = y0 - len * 0.55 + droopY * 0.45;

  const baseA = alpha(g.color) * edgeFade;
  if (baseA < 3) return;
  const rC = red(g.color), gC = green(g.color), bC = blue(g.color);

  noFill();
  stroke(color(rC, gC, bC, baseA));
  strokeWeight(w);
  beginShape();
  vertex(x0, y0);
  quadraticVertex(ctrlX, ctrlY, tipX, tipY);
  endShape();

  // Tip taper for the thicker reeds.
  if (w > 0.50) {
    const sX = lerp(x0, ctrlX, 0.55);
    const sY = lerp(y0, ctrlY, 0.55);
    stroke(color(rC, gC, bC, baseA * 0.80));
    strokeWeight(w * 0.45);
    beginShape();
    vertex(sX, sY);
    quadraticVertex(
      lerp(ctrlX, tipX, 0.45),
      lerp(ctrlY, tipY, 0.45),
      tipX, tipY
    );
    endShape();
  }
}

// ---------- Boat ----------
function drawBoat(bx, by) {
  push();
  translate(bx, by);
  rotate(sin(t * 0.6) * 0.02);

  const bw = 18;    // half-length → 36px total
  const bh = 2.6;   // half-height → ~5px total

  // Very faint reflection — no obvious ripple rings.
  noStroke();
  const refl = color(BOAT_DARK);
  refl.setAlpha(45);
  fill(refl);
  beginShape();
  vertex(-bw * 0.9, 0.8);
  quadraticVertex(0, bh * 2.4, bw * 0.9, 0.8);
  endShape(CLOSE);

  // A single faint shimmer line under the hull.
  stroke(255, 60);
  strokeWeight(0.4);
  line(-bw * 1.1, bh * 1.6, bw * 1.1, bh * 1.6);

  // Hull.
  noStroke();
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
  strokeWeight(0.7);
  noFill();
  beginShape();
  vertex(-bw * 0.82, 0.2);
  quadraticVertex(0, bh * 0.95, bw * 0.82, 0.2);
  endShape();

  // Gunwale highlight.
  stroke(BOAT_LITE);
  strokeWeight(0.35);
  beginShape();
  vertex(-bw * 0.78, -bh * 0.15);
  quadraticVertex(0, -bh * 0.4, bw * 0.78, -bh * 0.15);
  endShape();

  // Tiny figure.
  noStroke();
  fill(FIG_DARK);
  ellipse(-1.2, -bh * 0.9, 2.0, 3.6);
  fill(FIG_WARM);
  ellipse(-1.2, -bh * 1.25, 1.5, 1.5);

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
  for (let y = 0; y < 60; y++) {
    const a = map(y, 0, 60, 0, 18);
    stroke(10, 30, 24, a);
    line(0, BASE_H - y, BASE_W, BASE_H - y);
  }
  pop();
}
