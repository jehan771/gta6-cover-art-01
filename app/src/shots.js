// Fixed scenes for screenshots: ?shot=editor shows the editor with sample photos;
// ?shot=cover shows the cover alone. Params: photo, title, caption, subtitle,
// layout (heroPlusThree | ninePanelGrid | tiltedSnapshot | fullBleed),
// grade (one of the 8 Vice grades), size (square | portrait | wide).
// window.__shotReady is set once the cover has painted.
import { createDefaultCoverState } from './cover.js';

export async function runShot(shot, query, api) {
  const state = createDefaultCoverState();
  if (query.get('layout')) state.layout = query.get('layout');
  if (query.get('grade')) state.grade = query.get('grade');
  if (query.get('title')) state.title = query.get('title');
  if (query.get('subtitle')) state.subtitle = query.get('subtitle');
  if (query.get('caption')) state.caption = query.get('caption');
  const size = query.get('size') ?? 'square';
  const sizeSelect = document.getElementById('previewSizeSelect');
  if (sizeSelect) sizeSelect.value = size;
  if (shot === 'cover') document.body.classList.add('shot-cover');
  await api.loadSamples();
  api.applyState(state);
  // In cover mode the canvas must fill the shot viewport for a full-bleed capture.
  const canvas = document.getElementById('previewCanvas');
  if (shot === 'cover') {
    canvas.width = size === 'portrait' ? 1080 : size === 'wide' ? 1920 : 1080;
    canvas.height = size === 'portrait' ? 1350 : 1080;
  }
  api.redraw();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    setTimeout(() => { window.__shotReady = true; }, 120);
  }));
}
