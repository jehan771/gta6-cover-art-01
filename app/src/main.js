// Neon Coast Cover Studio — editor wiring: state, undo/redo, uploads, per-panel
// crop (drag + zoom + sliders), Smart crop, layout/grade switching, 3-size export.
// A `?shot=` query sets up a fixed scene for a screenshot instead (./shots.js).
import { createDefaultCoverState, renderCoverArt, exportCoverPng, EXPORT_SIZES, COVER_LAYOUTS, VICE_GRADES, analyzeSmartCropFocus, layoutPanelRects } from './cover.js';
import { runShot } from './shots.js';

const previewCanvas = document.getElementById('previewCanvas');
const statusEl = document.getElementById('status');
const titleInput = document.getElementById('titleInput');
const subtitleInput = document.getElementById('subtitleInput');
const captionInput = document.getElementById('captionInput');
const panelSelect = document.getElementById('panelSelect');
const panelPhotoSelect = document.getElementById('panelPhotoSelect');
const roleTagInput = document.getElementById('roleTagInput');
const zoomSlider = document.getElementById('zoomSlider');
const zoomValue = document.getElementById('zoomValue');
const offsetXSlider = document.getElementById('offsetXSlider');
const offsetYSlider = document.getElementById('offsetYSlider');

let coverState = createDefaultCoverState();
let photos = []; // [{ image, name }]
let selectedPanel = 0;
let undoStack = [];
let redoStack = [];
let draggingPanel = null;

function snapshotCoverState() { return JSON.parse(JSON.stringify(coverState)); }
function pushUndo() { undoStack.push(snapshotCoverState()); if (undoStack.length > 60) undoStack.shift(); redoStack = []; updateHistoryButtons(); }
function applyState(next) { coverState = next; syncControlsFromState(); redrawCover(); }
function updateHistoryButtons() {
  document.getElementById('undoButton').disabled = undoStack.length === 0;
  document.getElementById('redoButton').disabled = redoStack.length === 0;
}

function panelCount() { return COVER_LAYOUTS[coverState.layout].panels; }
function currentPanel() { return coverState.panels[selectedPanel]; }

function redrawCover() {
  const size = document.getElementById('previewSizeSelect').value;
  const dims = size === 'portrait' ? [1080, 1350] : size === 'wide' ? [1920, 1080] : [1080, 1080];
  if (previewCanvas.width !== dims[0] || previewCanvas.height !== dims[1]) {
    previewCanvas.width = dims[0]; previewCanvas.height = dims[1];
  }
  renderCoverArt(previewCanvas, coverState, photos.map((p) => p.image));
}

function syncControlsFromState() {
  titleInput.value = coverState.title;
  subtitleInput.value = coverState.subtitle;
  captionInput.value = coverState.caption;
  document.getElementById('grainToggle').checked = coverState.grain;
  document.getElementById('vignetteToggle').checked = coverState.vignette;
  document.querySelectorAll('#layoutRow .chip').forEach((b) => b.classList.toggle('active', b.dataset.layout === coverState.layout));
  document.querySelectorAll('#gradeRow .chip').forEach((b) => b.classList.toggle('active', b.dataset.grade === coverState.grade));
  rebuildPanelSelect();
  rebuildPanelPhotoSelect();
  syncPanelControls();
}

function rebuildPanelSelect() {
  panelSelect.innerHTML = '';
  for (let i = 0; i < panelCount(); i++) {
    const opt = document.createElement('option');
    opt.value = String(i);
    opt.textContent = `Panel ${i + 1}${i === 0 ? ' (hero)' : ''} — ${coverState.panels[i].roleTag}`;
    panelSelect.appendChild(opt);
  }
  panelSelect.value = String(Math.min(selectedPanel, panelCount() - 1));
}

function rebuildPanelPhotoSelect() {
  panelPhotoSelect.innerHTML = '';
  photos.forEach((photo, i) => {
    const opt = document.createElement('option');
    opt.value = String(i); opt.textContent = `${i + 1}. ${photo.name}`;
    panelPhotoSelect.appendChild(opt);
  });
  if (photos.length) panelPhotoSelect.value = String(currentPanel().photoIndex % photos.length);
}

function syncPanelControls() {
  const panel = currentPanel();
  roleTagInput.value = panel.roleTag;
  zoomSlider.value = String(panel.zoom);
  zoomValue.textContent = `${panel.zoom.toFixed(2)}\u00d7`;
  offsetXSlider.value = String(panel.offsetX);
  offsetYSlider.value = String(panel.offsetY);
  if (photos.length) panelPhotoSelect.value = String(panel.photoIndex % photos.length);
  document.getElementById('photoCount').textContent = `${photos.length} photo${photos.length === 1 ? '' : 's'} loaded — click a panel, drag to move it, scroll to zoom.`;
}

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });
}

async function addSamplePhoto(name, file) {
  const image = await loadImage(`samples/${file}`);
  const focus = analyzeSmartCropFocus(image);
  photos.push({ image, name });
  const index = photos.length - 1;
  coverState.panels.forEach((panel, i) => {
    if (i % 2 === index % 2 || photos.length <= 2) { panel.photoIndex = panel.photoIndex; }
    if (panel.photoIndex === index) { panel.focusX = focus.x; panel.focusY = focus.y; }
  });
  // Alternate the two samples across panels, hero gets the boulevard portrait.
  coverState.panels.forEach((panel, i) => { panel.photoIndex = i % photos.length; });
  coverState.panels[0].photoIndex = 0;
  syncControlsFromState(); redrawCover();
}

async function loadBothSamples() {
  photos = [];
  await addSamplePhoto('Boulevard sunset', 'boulevard.jpg');
  await addSamplePhoto('Pier fishing', 'pier.jpg');
  statusEl.textContent = 'Both samples loaded — hero is Boulevard, panels alternate.';
}

function downloadBlob(blob, fileName) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
}

async function exportAllThreeSizes() {
  statusEl.textContent = 'Exporting 3 sizes…';
  for (const size of EXPORT_SIZES) {
    const blob = await exportCoverPng(coverState, photos.map((p) => p.image), size.width, size.height);
    downloadBlob(blob, size.file);
  }
  statusEl.textContent = 'Saved 3 PNGs: 1080\u00d71080, 1080\u00d71350, 1920\u00d71080.';
}

async function exportPreviewSizeOnly() {
  const size = document.getElementById('previewSizeSelect').value;
  const dims = size === 'portrait' ? EXPORT_SIZES[1] : size === 'wide' ? EXPORT_SIZES[2] : EXPORT_SIZES[0];
  const blob = await exportCoverPng(coverState, photos.map((p) => p.image), dims.width, dims.height);
  downloadBlob(blob, dims.file);
  statusEl.textContent = `Saved ${dims.file}.`;
}

function selectPanelAtPoint(clientX, clientY) {
  const rect = previewCanvas.getBoundingClientRect();
  const x = (clientX - rect.left) / rect.width * previewCanvas.width;
  const y = (clientY - rect.top) / rect.height * previewCanvas.height;
  const { rects } = layoutPanelRects(coverState.layout, previewCanvas.width, previewCanvas.height);
  // Hit-test topmost first (last panel drawn is on top).
  for (let i = rects.length - 1; i >= 0; i--) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      selectedPanel = i; syncControlsFromState(); redrawCover();
      statusEl.textContent = `Panel ${i + 1} selected — ${currentPanel().roleTag}.`;
      return i;
    }
  }
  return -1;
}

// --- Control wiring ---
document.getElementById('layoutRow').addEventListener('click', (e) => {
  const button = e.target.closest('[data-layout]');
  if (!button) return;
  pushUndo();
  coverState.layout = button.dataset.layout;
  selectedPanel = 0;
  syncControlsFromState(); redrawCover();
});
document.getElementById('gradeRow').addEventListener('click', (e) => {
  const button = e.target.closest('[data-grade]');
  if (!button) return;
  pushUndo();
  coverState.grade = button.dataset.grade;
  syncControlsFromState(); redrawCover();
});
titleInput.addEventListener('input', () => { coverState.title = titleInput.value; redrawCover(); });
subtitleInput.addEventListener('input', () => { coverState.subtitle = subtitleInput.value; redrawCover(); });
captionInput.addEventListener('input', () => { coverState.caption = captionInput.value; redrawCover(); });
titleInput.addEventListener('change', pushUndo);
subtitleInput.addEventListener('change', pushUndo);
captionInput.addEventListener('change', pushUndo);
document.getElementById('grainToggle').addEventListener('change', (e) => { pushUndo(); coverState.grain = e.target.checked; redrawCover(); });
document.getElementById('vignetteToggle').addEventListener('change', (e) => { pushUndo(); coverState.vignette = e.target.checked; redrawCover(); });
document.getElementById('previewSizeSelect').addEventListener('change', redrawCover);
panelSelect.addEventListener('change', () => { selectedPanel = Number(panelSelect.value); syncPanelControls(); redrawCover(); });
panelPhotoSelect.addEventListener('change', () => { pushUndo(); currentPanel().photoIndex = Number(panelPhotoSelect.value); redrawCover(); });
roleTagInput.addEventListener('input', () => { currentPanel().roleTag = roleTagInput.value.toUpperCase(); rebuildPanelSelect(); redrawCover(); });
roleTagInput.addEventListener('change', pushUndo);
zoomSlider.addEventListener('input', () => { currentPanel().zoom = Number(zoomSlider.value); syncPanelControls(); redrawCover(); });
zoomSlider.addEventListener('change', pushUndo);
offsetXSlider.addEventListener('input', () => { currentPanel().offsetX = Number(offsetXSlider.value); redrawCover(); });
offsetXSlider.addEventListener('change', pushUndo);
offsetYSlider.addEventListener('input', () => { currentPanel().offsetY = Number(offsetYSlider.value); redrawCover(); });
offsetYSlider.addEventListener('change', pushUndo);

document.getElementById('smartCropButton').addEventListener('click', () => {
  const photo = photos[currentPanel().photoIndex];
  if (!photo) return;
  pushUndo();
  const focus = analyzeSmartCropFocus(photo.image);
  currentPanel().focusX = focus.x; currentPanel().focusY = focus.y; currentPanel().smartCrop = true;
  redrawCover();
  statusEl.textContent = `Smart crop centred Panel ${selectedPanel + 1} on the face region.`;
});
document.getElementById('cyclePhotoButton').addEventListener('click', () => {
  if (!photos.length) return;
  pushUndo();
  currentPanel().photoIndex = (currentPanel().photoIndex + 1) % photos.length;
  syncControlsFromState(); redrawCover();
});
document.getElementById('undoButton').addEventListener('click', () => {
  if (!undoStack.length) return;
  redoStack.push(snapshotCoverState());
  applyState(undoStack.pop()); updateHistoryButtons();
});
document.getElementById('redoButton').addEventListener('click', () => {
  if (!redoStack.length) return;
  undoStack.push(snapshotCoverState());
  applyState(redoStack.pop()); updateHistoryButtons();
});
document.getElementById('resetButton').addEventListener('click', () => {
  pushUndo(); coverState = createDefaultCoverState(); selectedPanel = 0;
  syncControlsFromState(); redrawCover();
});
document.getElementById('exportAllButton').addEventListener('click', exportAllThreeSizes);
document.getElementById('exportOneButton').addEventListener('click', exportPreviewSizeOnly);

document.getElementById('photoUpload').addEventListener('change', async (e) => {
  for (const file of e.target.files) {
    const image = await loadImage(URL.createObjectURL(file));
    const focus = analyzeSmartCropFocus(image);
    photos.push({ image, name: file.name });
    coverState.panels.forEach((panel) => { panel.focusX = focus.x; panel.focusY = focus.y; });
  }
  syncControlsFromState(); redrawCover();
  statusEl.textContent = `${photos.length} photo(s) loaded.`;
});
document.getElementById('sampleBoulevard').addEventListener('click', async () => { photos = []; await addSamplePhoto('Boulevard sunset', 'boulevard.jpg'); });
document.getElementById('samplePier').addEventListener('click', async () => { photos = []; await addSamplePhoto('Pier fishing', 'pier.jpg'); });
document.getElementById('sampleBoth').addEventListener('click', loadBothSamples);

// Drag to pan the selected panel, wheel to zoom it.
previewCanvas.addEventListener('pointerdown', (e) => {
  const hit = selectPanelAtPoint(e.clientX, e.clientY);
  if (hit < 0) return;
  draggingPanel = { panel: hit, startX: e.clientX, startY: e.clientY, offsetX: currentPanel().offsetX, offsetY: currentPanel().offsetY };
  previewCanvas.setPointerCapture(e.pointerId);
});
previewCanvas.addEventListener('pointermove', (e) => {
  if (!draggingPanel) return;
  const rect = previewCanvas.getBoundingClientRect();
  const panel = coverState.panels[draggingPanel.panel];
  panel.offsetX = draggingPanel.offsetX + (e.clientX - draggingPanel.startX) / rect.width;
  panel.offsetY = draggingPanel.offsetY + (e.clientY - draggingPanel.startY) / rect.height;
  syncPanelControls(); redrawCover();
});
previewCanvas.addEventListener('pointerup', () => { if (draggingPanel) { pushUndo(); draggingPanel = null; } });
previewCanvas.addEventListener('wheel', (e) => {
  e.preventDefault();
  const hit = selectPanelAtPoint(e.clientX, e.clientY);
  if (hit < 0) return;
  const panel = currentPanel();
  panel.zoom = Math.min(2.5, Math.max(1, panel.zoom - Math.sign(e.deltaY) * 0.1));
  syncPanelControls(); redrawCover();
}, { passive: false });

// --- Boot ---
const shot = new URLSearchParams(location.search).get('shot');
if (shot) {
  runShot(shot, new URLSearchParams(location.search), {
    loadSamples: loadBothSamples,
    applyState: (next) => { coverState = next; selectedPanel = 0; syncControlsFromState(); redrawCover(); },
    setPhotos: (nextPhotos) => { photos = nextPhotos; },
    redraw: redrawCover,
    loadImage,
  });
} else {
  loadBothSamples().then(() => { syncControlsFromState(); updateHistoryButtons(); });
}
syncControlsFromState();
updateHistoryButtons();
redrawCover();
