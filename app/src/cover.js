// Neon Coast Cover Studio — cover renderer: multi-panel layouts, chrome titles,
// 8 Vice grades, role tags, smart (face-aware) crop, grain and vignette.
// All drawing is canvas 2D, offline, no network. Photos are drawn from <img> elements
// the user loaded on their own machine.

export const VICE_GRADES = {
  viceSunset: { label: 'Vice Sunset', filter: 'saturate(1.35) contrast(1.08) brightness(1.02)', sky: ['#2b1055', '#ff5e8a', '#ffb347'], wash: 'rgba(255,94,138,0.16)' },
  neonPink: { label: 'Neon Pink', filter: 'saturate(1.6) contrast(1.1)', sky: ['#1a0533', '#ff2e88', '#ff7ad9'], wash: 'rgba(255,46,136,0.22)' },
  goldHour: { label: 'Gold Hour', filter: 'saturate(1.25) contrast(1.05) brightness(1.06)', sky: ['#3a1c00', '#ff8c1a', '#ffe08a'], wash: 'rgba(255,170,40,0.18)' },
  tealNight: { label: 'Teal Night', filter: 'saturate(1.2) contrast(1.12) brightness(0.94)', sky: ['#02141f', '#0e7490', '#22d3ee'], wash: 'rgba(34,211,238,0.14)' },
  palmDusk: { label: 'Palm Dusk', filter: 'saturate(1.3) contrast(1.08)', sky: ['#2d0a4e', '#c026d3', '#fb923c'], wash: 'rgba(192,38,211,0.16)' },
  heatwave: { label: 'Heatwave', filter: 'saturate(1.5) contrast(1.14) brightness(1.03)', sky: ['#450a0a', '#ef4444', '#fbbf24'], wash: 'rgba(239,68,68,0.16)' },
  coral: { label: 'Coral', filter: 'saturate(1.35) contrast(1.06)', sky: ['#3b0764', '#fb7185', '#fdba74'], wash: 'rgba(251,113,133,0.16)' },
  monoNoir: { label: 'Mono Noir', filter: 'grayscale(1) contrast(1.25) brightness(1.02)', sky: ['#000000', '#525252', '#e5e5e5'], wash: 'rgba(255,255,255,0.08)' },
};

export const COVER_LAYOUTS = {
  heroPlusThree: { label: 'Hero + 3', panels: 4 },
  ninePanelGrid: { label: '9-panel grid', panels: 9 },
  tiltedSnapshot: { label: 'Tilted snapshot', panels: 3 },
  fullBleed: { label: 'Full-bleed', panels: 1 },
};

export const DEFAULT_ROLE_TAGS = ['THE DRIVER', 'THE FIXER', 'THE LOOKOUT', 'THE GETAWAY', 'THE INSIDER', 'THE DEALER', 'THE HUSTLER', 'THE WHEELMAN', 'THE QUEEN'];

/** Builds the default cover state: hero layout, Vice Sunset grade, both samples. */
export function createDefaultCoverState() {
  return {
    layout: 'heroPlusThree', grade: 'viceSunset', title: 'NEON COAST',
    subtitle: 'Vice City \u2022 Sunset Heist', caption: 'One last job under the neon sun.',
    grain: true, vignette: true,
    panels: DEFAULT_ROLE_TAGS.slice(0, 9).map((tag, i) => ({
      photoIndex: i % 2, zoom: 1.05, offsetX: 0, offsetY: 0,
      roleTag: tag, focusX: 0.5, focusY: 0.38, smartCrop: true,
    })),
  };
}

/** Returns panel rectangles (fractions of W/H) for a layout, plus the title band. */
export function layoutPanelRects(layout, width, height) {
  const gap = Math.max(4, width * 0.006);
  const titleH = height * 0.2;
  const topH = height - titleH;
  if (layout === 'ninePanelGrid') {
    const rects = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
      rects.push({ x: gap + c * (width - gap * 2) / 3, y: gap + r * (topH - gap * 2) / 3, w: (width - gap * 4) / 3, h: (topH - gap * 4) / 3, tilt: 0 });
    }
    return { rects, titleY: topH, titleH };
  }
  if (layout === 'tiltedSnapshot') {
    return {
      rects: [
        { x: width * 0.16, y: height * 0.04, w: width * 0.68, h: topH * 0.78, tilt: -0.06, tagTop: true },
        { x: width * 0.03, y: topH * 0.58, w: width * 0.3, h: topH * 0.3, tilt: 0.08 },
        { x: width * 0.67, y: topH * 0.6, w: width * 0.3, h: topH * 0.3, tilt: -0.09 },
      ], titleY: topH, titleH,
    };
  }
  if (layout === 'fullBleed') {
    return { rects: [{ x: 0, y: 0, w: width, h: height * 0.82, tilt: 0 }], titleY: height * 0.78, titleH: height * 0.22 };
  }
  // heroPlusThree (default): big hero left, three stacked panels right.
  const heroW = width * 0.62;
  return {
    rects: [
      { x: gap, y: gap, w: heroW - gap * 1.5, h: topH - gap * 2, tilt: 0, hero: true },
      { x: heroW, y: gap, w: width - heroW - gap, h: (topH - gap * 4) / 3, tilt: 0 },
      { x: heroW, y: gap * 2 + (topH - gap * 4) / 3, w: width - heroW - gap, h: (topH - gap * 4) / 3, tilt: 0 },
      { x: heroW, y: gap * 3 + 2 * (topH - gap * 4) / 3, w: width - heroW - gap, h: (topH - gap * 4) / 3, tilt: 0 },
    ], titleY: topH, titleH,
  };
}

/** Heuristic face-aware focus: skin-tone + bright-region centroid on a 48px sample. */
export function analyzeSmartCropFocus(photo) {
  try {
    const sample = document.createElement('canvas');
    sample.width = 48; sample.height = 48;
    const sctx = sample.getContext('2d');
    sctx.drawImage(photo, 0, 0, 48, 48);
    const data = sctx.getImageData(0, 0, 48, 48).data;
    let sumX = 0, sumY = 0, sumW = 0;
    for (let y = 0; y < 48; y++) for (let x = 0; x < 48; x++) {
      const i = (y * 48 + x) * 4, r = data[i], g = data[i + 1], b = data[i + 2];
      const skin = r > 110 && r > g + 18 && g > b + 8 && r < 250 ? 1 : 0;
      const bright = (r + g + b) / 3 > 150 ? 0.4 : 0;
      const w = skin * 2 + bright;
      // Faces sit in the upper half: weight the top a little more.
      const weighted = w * (y < 26 ? 1.25 : 0.8);
      sumX += x * weighted; sumY += y * weighted; sumW += weighted;
    }
    if (sumW < 4) return { x: 0.5, y: 0.38 };
    return { x: Math.min(0.85, Math.max(0.15, sumX / sumW / 48)), y: Math.min(0.8, Math.max(0.15, sumY / sumW / 48)) };
  } catch {
    return { x: 0.5, y: 0.38 };
  }
}

function drawPanelPhoto(ctx, photo, rect, panel, grade) {
  if (!photo || !photo.naturalWidth) {
    ctx.fillStyle = '#3b2358'; ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
    ctx.fillStyle = '#ffd166'; ctx.font = `bold ${Math.max(14, rect.w * 0.05)}px sans-serif`;
    ctx.textAlign = 'center'; ctx.fillText('ADD A PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2);
    return;
  }
  const focusX = panel.smartCrop ? panel.focusX : 0.5;
  const focusY = panel.smartCrop ? panel.focusY : 0.5;
  const baseScale = Math.max(rect.w / photo.naturalWidth, rect.h / photo.naturalHeight);
  const scale = baseScale * panel.zoom;
  const drawnW = photo.naturalWidth * scale, drawnH = photo.naturalHeight * scale;
  const centreX = rect.x + rect.w * (1 - focusX) * 0 + rect.w / 2;
  const centreY = rect.y + rect.h / 2;
  // Focus point maps to the panel centre; offsets pan from there.
  let dx = centreX - drawnW * focusX + panel.offsetX * rect.w;
  let dy = centreY - drawnH * focusY + panel.offsetY * rect.h;
  // Clamp so the photo always covers the whole panel (no sky gaps at edges).
  dx = Math.min(rect.x, Math.max(rect.x + rect.w - drawnW, dx));
  dy = Math.min(rect.y, Math.max(rect.y + rect.h - drawnH, dy));
  ctx.save();
  ctx.beginPath();
  ctx.rect(rect.x, rect.y, rect.w, rect.h);
  ctx.clip();
  ctx.filter = grade.filter;
  ctx.drawImage(photo, dx, dy, drawnW, drawnH);
  ctx.filter = 'none';
  ctx.fillStyle = grade.wash;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.restore();
}

function drawRoleTag(ctx, rect, tag, isHero, tagTop) {
  if (!tag) return;
  const size = Math.max(13, rect.w * (isHero ? 0.045 : 0.075));
  ctx.font = `bold ${size}px sans-serif`;
  const padX = size * 0.7, padY = size * 0.45;
  const tw = ctx.measureText(tag).width + padX * 2;
  const th = size + padY * 2;
  const x = rect.x + Math.max(6, rect.w * 0.03);
  const y = tagTop ? rect.y + Math.max(6, rect.h * 0.04) : rect.y + rect.h - th - Math.max(6, rect.h * 0.04);
  ctx.fillStyle = 'rgba(10,4,20,0.88)';
  ctx.fillRect(x, y, tw, th);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = Math.max(1, size * 0.08);
  ctx.strokeRect(x, y, tw, th);
  ctx.fillStyle = '#ffd166'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(tag, x + padX, y + th / 2 + size * 0.05);
  ctx.textBaseline = 'alphabetic';
}

function drawPanelFrame(ctx, rect, isHero) {
  ctx.save();
  ctx.strokeStyle = isHero ? '#ffd166' : 'rgba(255,255,255,0.92)';
  ctx.lineWidth = isHero ? Math.max(3, rect.w * 0.008) : Math.max(2, rect.w * 0.005);
  ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  if (isHero) {
    ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 24; ctx.shadowOffsetY = 8;
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

/** Renders a striped retro-chrome title onto its own canvas, then stamps it. */
export function drawChromeTitle(ctx, text, cx, y, maxWidth, fontPx) {
  const off = document.createElement('canvas');
  const pad = fontPx * 0.3;
  off.width = Math.ceil(maxWidth + pad * 2);
  off.height = Math.ceil(fontPx * 1.3);
  const o = off.getContext('2d');
  const font = `900 ${fontPx}px system-ui, sans-serif`;
  o.font = font; o.textAlign = 'center'; o.textBaseline = 'middle';
  const tx = off.width / 2, ty = off.height * 0.42;
  // Extruded shadow: stacked dark copies below.
  o.fillStyle = '#3d0a4e';
  for (let d = 4; d >= 1; d--) o.fillText(text, tx, ty + d * fontPx * 0.045);
  // Chrome gradient fill.
  const grad = o.createLinearGradient(0, ty - fontPx * 0.55, 0, ty + fontPx * 0.55);
  grad.addColorStop(0, '#ffffff'); grad.addColorStop(0.32, '#ffe08a');
  grad.addColorStop(0.5, '#ff5e8a'); grad.addColorStop(0.68, '#7b5cff');
  grad.addColorStop(1, '#ffffff');
  o.fillStyle = grad;
  o.fillText(text, tx, ty);
  // Horizontal stripes clipped to the lettering.
  o.globalCompositeOperation = 'source-atop';
  o.fillStyle = 'rgba(255,255,255,0.85)';
  for (let sy = ty - fontPx * 0.5; sy < ty + fontPx * 0.55; sy += fontPx * 0.22) o.fillRect(0, sy, off.width, fontPx * 0.05);
  o.fillStyle = 'rgba(20,4,40,0.28)';
  for (let sy = ty - fontPx * 0.38; sy < ty + fontPx * 0.55; sy += fontPx * 0.22) o.fillRect(0, sy, off.width, fontPx * 0.05);
  o.globalCompositeOperation = 'source-over';
  // Thick outline.
  o.lineWidth = Math.max(2, fontPx * 0.07); o.strokeStyle = '#12081f';
  o.strokeText(text, tx, ty);
  o.lineWidth = Math.max(1, fontPx * 0.02); o.strokeStyle = 'rgba(255,255,255,0.75)';
  o.strokeText(text, tx, ty);
  const drawW = Math.min(maxWidth, off.width);
  ctx.drawImage(off, cx - drawW / 2, y, drawW, off.height * (drawW / off.width));
  return off.height * (drawW / off.width);
}

function drawSunsetSky(ctx, width, height, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, height);
  sky.addColorStop(0, grade.sky[0]); sky.addColorStop(0.55, grade.sky[1]); sky.addColorStop(1, grade.sky[2]);
  ctx.fillStyle = sky; ctx.fillRect(0, 0, width, height);
  // Sun disc + palm silhouettes (original vector shapes, no game art).
  const sunR = width * 0.09;
  ctx.fillStyle = 'rgba(255,240,180,0.95)';
  ctx.beginPath(); ctx.arc(width * 0.82, height * 0.16, sunR, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(18,8,31,0.55)';
  ctx.fillRect(0, height * 0.62, width, height * 0.04);
}

function drawGrainOverlay(ctx, width, height) {
  const noise = document.createElement('canvas');
  noise.width = 128; noise.height = 128;
  const nctx = noise.getContext('2d');
  const img = nctx.createImageData(128, 128);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 22;
  }
  nctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(noise, 'repeat');
  ctx.fillStyle = pattern; ctx.fillRect(0, 0, width, height);
}

function drawVignetteOverlay(ctx, width, height) {
  const v = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.42, width / 2, height / 2, Math.max(width, height) * 0.75);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(10,2,20,0.42)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, width, height);
}

function drawBillingBlock(ctx, width, titleY, titleH, caption) {
  // Caption sits below the subtitle, billing sits at the very foot — no overlap.
  if (caption) {
    ctx.fillStyle = '#ffe9f2';
    ctx.font = `italic ${Math.max(13, width * 0.016)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.fillText(caption, width / 2, titleY + titleH * 0.8);
  }
  const y = titleY + titleH * 0.94;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `${Math.max(11, width * 0.011)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText('NEON COAST  \u2022  A VICE CITY STORY  \u2022  STARRING YOU  \u2022  2026', width / 2, y);
  // Seal circle, bottom-right of the title band, on the subtitle row.
  const cx = width * 0.93, cy = titleY + titleH * 0.62, r = Math.max(18, width * 0.028);
  ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#ffd166'; ctx.font = `bold ${Math.max(11, r * 0.42)}px sans-serif`;
  ctx.fillText('NC', cx, cy + r * 0.15);
}

/** Draws the whole cover onto `canvas` at its own size. Photos may be null per panel. */
export function renderCoverArt(canvas, state, photos) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width, height = canvas.height;
  const grade = VICE_GRADES[state.grade] ?? VICE_GRADES.viceSunset;
  drawSunsetSky(ctx, width, height, grade);
  const { rects, titleY, titleH } = layoutPanelRects(state.layout, width, height);
  rects.forEach((rect, index) => {
    const panel = state.panels[index] ?? createDefaultCoverState().panels[index];
    const photo = photos[panel.photoIndex] ?? photos[0] ?? null;
    ctx.save();
    if (rect.tilt) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate(rect.tilt);
      ctx.translate(-(rect.x + rect.w / 2), -(rect.y + rect.h / 2));
      ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 18; ctx.shadowOffsetY = 6;
      ctx.fillStyle = '#fff'; ctx.fillRect(rect.x - 8, rect.y - 8, rect.w + 16, rect.h + 16);
      ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
    }
    drawPanelPhoto(ctx, photo, rect, panel, grade);
    drawPanelFrame(ctx, rect, Boolean(rect.hero));
    drawRoleTag(ctx, rect, panel.roleTag, Boolean(rect.hero), Boolean(rect.tagTop));
    ctx.restore();
  });
  // Title band: dark ink band so the chrome lettering always reads.
  ctx.fillStyle = 'rgba(14,4,26,0.92)';
  ctx.fillRect(0, titleY, width, titleH);
  ctx.fillStyle = grade.sky[1];
  ctx.fillRect(0, titleY, width, Math.max(3, height * 0.005));
  const title = (state.title || 'NEON COAST').toUpperCase();
  // Title glyphs must fit inside the top half of the title band, leaving the
  // subtitle, caption and billing rows clear below them.
  let fontPx = Math.min(height * 0.075, width * 0.09, titleH * 0.38);
  ctx.font = `900 ${fontPx}px system-ui, sans-serif`;
  while (ctx.measureText(title).width > width * 0.86 && fontPx > 20) {
    fontPx -= 4; ctx.font = `900 ${fontPx}px system-ui, sans-serif`;
  }
  drawChromeTitle(ctx, title, width / 2, titleY + titleH * 0.03, width * 0.88, fontPx);
  ctx.fillStyle = '#7ee7ff';
  ctx.font = `italic bold ${Math.max(15, width * 0.022)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(state.subtitle || '', width / 2, titleY + titleH * 0.66);
  drawBillingBlock(ctx, width, titleY, titleH, state.caption);
  if (state.grain) drawGrainOverlay(ctx, width, height);
  if (state.vignette) drawVignetteOverlay(ctx, width, height);
}

/** Renders the cover at an export size and returns a PNG blob. */
export function exportCoverPng(state, photos, exportWidth, exportHeight) {
  return new Promise((resolve, reject) => {
    const off = document.createElement('canvas');
    off.width = exportWidth; off.height = exportHeight;
    renderCoverArt(off, state, photos);
    off.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG export failed'))), 'image/png');
  });
}

export const EXPORT_SIZES = [
  { label: '1:1', width: 1080, height: 1080, file: 'neon-coast-cover-1080x1080.png' },
  { label: '4:5', width: 1080, height: 1350, file: 'neon-coast-cover-1080x1350.png' },
  { label: '16:9', width: 1920, height: 1080, file: 'neon-coast-cover-1920x1080.png' },
];
