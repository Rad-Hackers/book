const { jsPDF } = window.jspdf;
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.4.168/pdf.worker.min.js';

const THEMES = {
  'classic-novel': {
    name: 'Classic Arabic Novel', paper: '#f3eee3', text: '#2b2219', accent: '#c7a16a', bg: '#0b0911', font: 'Amiri', titleFont: 'Playfair Display'
  },
  'gothic-dark': {
    name: 'Gothic Dark', paper: '#e9e1d1', text: '#241c16', accent: '#9d7750', bg: '#09080d', font: 'Amiri', titleFont: 'Playfair Display'
  },
  'luxury-hardcover': {
    name: 'Luxury Hardcover', paper: '#f7f3ea', text: '#2a2218', accent: '#d7b26b', bg: '#111118', font: 'Noto Naskh Arabic', titleFont: 'Playfair Display'
  },
  'minimal-modern': {
    name: 'Minimal Modern', paper: '#faf8f2', text: '#1e1e22', accent: '#8c6df3', bg: '#0d0c16', font: 'Cairo', titleFont: 'Cairo'
  },
  'horror-manuscript': {
    name: 'Horror Manuscript', paper: '#ede2cf', text: '#281d17', accent: '#945c4a', bg: '#07070a', font: 'Amiri', titleFont: 'Playfair Display'
  },
  'old-library': {
    name: 'Old Library', paper: '#efe2c6', text: '#33261c', accent: '#82664e', bg: '#15110d', font: 'Noto Naskh Arabic', titleFont: 'Playfair Display'
  }
};

const state = {
  coverDataUrl: '',
  referenceDataUrl: '',
  referenceDNA: null,
  parts: [],
  pages: [],
  pageImages: [],
  genre: '',
  activePage: 0,
  exportLockedSnapshot: null,
  lastExportImages: []
};

const el = id => document.getElementById(id);
const qs = sel => document.querySelector(sel);
const qsa = sel => [...document.querySelectorAll(sel)];

const dom = {
  title: el('bookTitle'), subtitle: el('bookSubtitle'), author: el('bookAuthor'), description: el('bookDescription'),
  pageSize: el('pageSize'), direction: el('bookDirection'), kind: el('bookKind'), theme: el('themeSelect'), font: el('fontSelect'),
  paperColor: el('paperColor'), coverInput: el('coverInput'), referenceInput: el('referenceInput'), partsInput: el('partsInput'),
  partsList: el('partsList'), previewShelf: el('previewShelf'), exportStage: el('exportStage'), statusText: el('statusText'),
  queueFill: el('queueFill'), queuePercent: el('queuePercent'), queueSteps: el('queueSteps'), genreChip: el('genreChip'),
  pagesChip: el('pagesChip'), healthChip: el('healthChip'), coverPreview: el('coverPreview'), styleDNA: el('styleDNA'),
  comparePanel: el('comparePanel'), partSearch: el('partSearch')
};

function init() {
  fillThemes();
  bindEvents();
  applyThemeToUI('classic-novel');
  restoreDraftSilently();
  if (!state.parts.length) addManualPart();
  toast('تم تحميل BookForge Ultimate');
}

function fillThemes() {
  dom.theme.innerHTML = Object.entries(THEMES).map(([id, t]) => `<option value="${id}">${t.name}</option>`).join('');
  dom.theme.value = 'classic-novel';
}

function bindEvents() {
  el('addManualPartBtn').onclick = addManualPart;
  el('sortPartsBtn').onclick = sortPartsNaturally;
  el('smartFormatBtn').onclick = smartFormatParts;
  el('buildBookBtn').onclick = buildBook;
  el('renderPreviewImagesBtn').onclick = renderPreviewImages;
  el('downloadAllPreviewZipBtn').onclick = downloadAllPreviewZip;
  el('exportPdfBtn').onclick = exportPdfFromPreview;
  el('exportHtmlBtn').onclick = exportHTML;
  el('exportTxtBtn').onclick = exportTXT;
  el('saveProjectBtn').onclick = saveProject;
  el('loadProjectBtn').onclick = loadProject;
  el('clearProjectBtn').onclick = clearProject;
  el('validateBtn').onclick = validateBook;
  el('analyzeReferenceBtn').onclick = analyzeReference;
  el('generateAutoCoverBtn').onclick = generateAutoCover;
  el('prevPageBtn').onclick = () => focusPage(state.activePage - 1);
  el('nextPageBtn').onclick = () => focusPage(state.activePage + 1);
  el('openPrintModeBtn').onclick = () => document.body.classList.toggle('print-mode');
  el('toggleSpreadBtn').onclick = () => {
    el('spreadMode').checked = !el('spreadMode').checked;
    syncModes();
  };
  qsa('#dialoguesMode,#highlightQuotesMode,#dropcapMode,#ornamentsMode,#spreadMode,#flipMode,#lockedLayout,#compareMode').forEach(i => i.onchange = syncModes);
  dom.theme.onchange = () => applyThemeToUI(dom.theme.value);
  dom.font.onchange = () => document.documentElement.style.setProperty('--content-font', `'${dom.font.value}', serif`);
  dom.paperColor.oninput = () => document.documentElement.style.setProperty('--paper', dom.paperColor.value);
  dom.coverInput.onchange = handleCoverUpload;
  dom.referenceInput.onchange = handleReferenceUpload;
  dom.partsInput.onchange = handlePartsUpload;
  dom.partSearch.oninput = filterParts;
  [dom.title, dom.subtitle, dom.author, dom.description, dom.pageSize, dom.direction, dom.kind].forEach(i => i.addEventListener('input', autosaveProject));
}

function syncModes() {
  dom.previewShelf.classList.toggle('spread', el('spreadMode').checked);
  dom.previewShelf.classList.toggle('flip-mode', el('flipMode').checked);
  if (el('compareMode').checked) dom.comparePanel.classList.remove('hidden');
  else dom.comparePanel.classList.add('hidden');
  autosaveProject();
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 2800);
}

function setStatus(msg) { dom.statusText.textContent = msg; }
function setQueue(step, percent = 0) {
  dom.queueSteps.textContent = step;
  dom.queuePercent.textContent = `${Math.round(percent)}%`;
  dom.queueFill.style.width = `${percent}%`;
}

function applyThemeToUI(themeId) {
  const t = THEMES[themeId] || THEMES['classic-novel'];
  document.documentElement.style.setProperty('--paper', t.paper);
  document.documentElement.style.setProperty('--paper-text', t.text);
  document.documentElement.style.setProperty('--accent', t.accent);
  document.documentElement.style.setProperty('--bg', t.bg);
  document.documentElement.style.setProperty('--content-font', `'${t.font}', serif`);
  document.documentElement.style.setProperty('--title-font', `'${t.titleFont}', serif`);
  dom.font.value = t.font;
  dom.paperColor.value = rgbToHex(t.paper);
  autosaveProject();
}

function rgbToHex(color) { return color.startsWith('#') ? color : '#f3eee3'; }

function addManualPart(data = {}) {
  const template = el('partCardTemplate').content.firstElementChild.cloneNode(true);
  const titleInput = template.querySelector('.part-title-input');
  const contentInput = template.querySelector('.part-content-input');
  const stats = template.querySelector('.part-stats');
  titleInput.value = data.title || `بارت ${dom.partsList.children.length + 1}`;
  contentInput.value = data.content || '';

  const refreshStats = () => {
    const text = contentInput.value;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    stats.textContent = `${words} كلمة • ${chars} حرف`;
    autosaveParts();
  };

  titleInput.oninput = refreshStats;
  contentInput.oninput = refreshStats;
  template.querySelector('.delete-part').onclick = () => { template.remove(); autosaveParts(); };
  template.querySelector('.move-up').onclick = () => { const prev = template.previousElementSibling; if (prev) dom.partsList.insertBefore(template, prev); autosaveParts(); };
  template.querySelector('.move-down').onclick = () => { const next = template.nextElementSibling; if (next) dom.partsList.insertBefore(next, template); autosaveParts(); };
  template.querySelector('.mark-quote').onclick = () => extractQuotesFromPart(contentInput);
  dom.partsList.appendChild(template);
  refreshStats();
  autosaveParts();
}

function filterParts() {
  const q = dom.partSearch.value.trim().toLowerCase();
  qsa('.part-card').forEach(card => {
    const text = card.innerText.toLowerCase();
    card.style.display = !q || text.includes(q) ? '' : 'none';
  });
}

function sortPartsNaturally() {
  const cards = qsa('.part-card');
  cards.sort((a,b) => a.querySelector('.part-title-input').value.localeCompare(b.querySelector('.part-title-input').value, undefined, { numeric:true }));
  cards.forEach(c => dom.partsList.appendChild(c));
  autosaveParts();
  toast('تم ترتيب البارتات');
}

function autosaveParts() {
  state.parts = qsa('.part-card').map(card => ({
    title: card.querySelector('.part-title-input').value.trim(),
    content: card.querySelector('.part-content-input').value
  }));
  autosaveProject();
}

function autosaveProject() {
  const payload = collectProjectData();
  localStorage.setItem('bookforge-ultimate-autosave', JSON.stringify(payload));
}

function saveProject() {
  autosaveParts();
  const payload = collectProjectData();
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  downloadBlob(blob, safeName(payload.meta.title || 'bookforge-project') + '.json');
  localStorage.setItem('bookforge-ultimate-saved', JSON.stringify(payload));
  toast('تم حفظ المشروع');
}

function loadProject() {
  const raw = localStorage.getItem('bookforge-ultimate-saved') || localStorage.getItem('bookforge-ultimate-autosave');
  if (!raw) return toast('لا يوجد مشروع محفوظ');
  applyProjectData(JSON.parse(raw));
  toast('تم استرجاع المشروع');
}

function restoreDraftSilently() {
  const raw = localStorage.getItem('bookforge-ultimate-autosave');
  if (raw) applyProjectData(JSON.parse(raw), true);
}

function clearProject() {
  if (!confirm('هل تريد مسح المشروع الحالي؟')) return;
  localStorage.removeItem('bookforge-ultimate-autosave');
  localStorage.removeItem('bookforge-ultimate-saved');
  location.reload();
}

function collectProjectData() {
  autosaveParts();
  return {
    meta: {
      title: dom.title.value, subtitle: dom.subtitle.value, author: dom.author.value, description: dom.description.value,
      pageSize: dom.pageSize.value, direction: dom.direction.value, kind: dom.kind.value, theme: dom.theme.value,
      font: dom.font.value, paperColor: dom.paperColor.value
    },
    toggles: {
      includeDedication: el('includeDedication').checked, includeRights: el('includeRights').checked, includeAboutPage: el('includeAboutPage').checked,
      includeTOC: el('includeTOC').checked, dialoguesMode: el('dialoguesMode').checked, highlightQuotesMode: el('highlightQuotesMode').checked,
      dropcapMode: el('dropcapMode').checked, ornamentsMode: el('ornamentsMode').checked, spreadMode: el('spreadMode').checked,
      flipMode: el('flipMode').checked, lockedLayout: el('lockedLayout').checked, compareMode: el('compareMode').checked
    },
    parts: state.parts,
    coverDataUrl: state.coverDataUrl,
    referenceDataUrl: state.referenceDataUrl,
    referenceDNA: state.referenceDNA
  };
}

function applyProjectData(data, silent = false) {
  if (!data) return;
  const m = data.meta || {};
  dom.title.value = m.title || '';
  dom.subtitle.value = m.subtitle || '';
  dom.author.value = m.author || '';
  dom.description.value = m.description || '';
  dom.pageSize.value = m.pageSize || '6x9';
  dom.direction.value = m.direction || 'rtl';
  dom.kind.value = m.kind || 'auto';
  dom.theme.value = m.theme || 'classic-novel';
  dom.font.value = m.font || 'Amiri';
  dom.paperColor.value = m.paperColor || '#f3eee3';
  applyThemeToUI(dom.theme.value);
  state.coverDataUrl = data.coverDataUrl || '';
  state.referenceDataUrl = data.referenceDataUrl || '';
  state.referenceDNA = data.referenceDNA || null;
  renderCoverPreview();
  renderStyleDNA();
  const t = data.toggles || {};
  Object.keys(t).forEach(id => { if (el(id)) el(id).checked = !!t[id]; });
  syncModes();
  dom.partsList.innerHTML = '';
  (data.parts?.length ? data.parts : [{ title:'بارت 1', content:'' }]).forEach(addManualPart);
  if (!silent) buildBook();
}

async function handleCoverUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  state.coverDataUrl = await fileToDataUrl(file);
  renderCoverPreview();
  autosaveProject();
}

async function handleReferenceUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    state.referenceDataUrl = await renderPdfFirstPage(file);
  } else {
    state.referenceDataUrl = await fileToDataUrl(file);
  }
  renderStyleDNA();
  autosaveProject();
}

async function handlePartsUpload(e) {
  const files = [...e.target.files];
  if (!files.length) return;
  setStatus('جارٍ استيراد البارتات...');
  for (let i = 0; i < files.length; i++) {
    setQueue(`استيراد الملف ${i + 1} من ${files.length}`, ((i) / files.length) * 100);
    const file = files[i];
    const lower = file.name.toLowerCase();
    let content = '';
    if (lower.endsWith('.docx')) {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ arrayBuffer });
      content = result.value;
    } else {
      content = await file.text();
    }
    addManualPart({ title: file.name.replace(/\.[^.]+$/, ''), content });
  }
  setQueue('تم استيراد جميع الملفات', 100);
  setStatus('تم استيراد البارتات');
  toast('تم استيراد البارتات بنجاح');
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function renderPdfFirstPage(file) {
  const buf = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  const viewport = page.getViewport({ scale: 1.6 });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width; canvas.height = viewport.height;
  await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
  return canvas.toDataURL('image/png');
}

function renderCoverPreview() {
  dom.coverPreview.innerHTML = state.coverDataUrl ? `<img src="${state.coverDataUrl}" alt="cover" />` : '<span>لا يوجد غلاف</span>';
}

function renderStyleDNA() {
  if (!state.referenceDataUrl && !state.referenceDNA) {
    dom.styleDNA.innerHTML = '<span>ارفع مرجعًا ثم حلله</span>';
    return;
  }
  const dna = state.referenceDNA;
  dom.styleDNA.innerHTML = `
    ${state.referenceDataUrl ? `<img src="${state.referenceDataUrl}" alt="ref" style="width:100%;height:100%;object-fit:cover;border-radius:14px;opacity:.35;position:absolute;inset:0;">` : ''}
    <div style="position:relative;z-index:2;width:100%">
      <div>الثيم المقترح: <strong>${dna?.mood || 'غير محلل'}</strong></div>
      <div>الخط المقترح: <strong>${dna?.font || '—'}</strong></div>
      <div class="dna-swatch">${dna?.palette?.map(c => `<span style="background:${c}"></span>`).join('') || ''}</div>
    </div>`;
}

async function analyzeReference() {
  if (!state.referenceDataUrl) return toast('ارفع صورة أو PDF مرجعي أولاً');
  setStatus('جارٍ تحليل المرجع واستخراج Style DNA...');
  setQueue('تحليل الألوان والجو العام', 20);
  const palette = await extractPalette(state.referenceDataUrl);
  const brightness = palette.reduce((acc, hex) => acc + hexBrightness(hex), 0) / palette.length;
  const warm = palette.some(c => hexToRgb(c).r > hexToRgb(c).b + 15);
  const mood = brightness < 95 ? 'داكن / غامض' : warm ? 'دافئ / كلاسيكي' : 'هادئ / حديث';
  const genreGuess = brightness < 95 ? 'horror-manuscript' : warm ? 'old-library' : 'minimal-modern';
  state.referenceDNA = {
    palette,
    mood,
    font: brightness < 95 ? 'Amiri' : warm ? 'Noto Naskh Arabic' : 'Cairo',
    genreTheme: genreGuess
  };
  setQueue('تطبيق التوصيات', 85);
  dom.theme.value = genreGuess;
  applyThemeToUI(genreGuess);
  dom.font.value = state.referenceDNA.font;
  document.documentElement.style.setProperty('--content-font', `'${state.referenceDNA.font}', serif`);
  renderStyleDNA();
  setQueue('اكتمل تحليل المرجع', 100);
  setStatus('اكتمل تحليل المرجع');
  autosaveProject();
}

function extractPalette(dataUrl, count = 4) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      canvas.width = 60; canvas.height = 60;
      ctx.drawImage(img, 0, 0, 60, 60);
      const data = ctx.getImageData(0,0,60,60).data;
      const buckets = new Map();
      for (let i = 0; i < data.length; i += 16) {
        const r = Math.round(data[i] / 32) * 32;
        const g = Math.round(data[i+1] / 32) * 32;
        const b = Math.round(data[i+2] / 32) * 32;
        const key = `${r},${g},${b}`;
        buckets.set(key, (buckets.get(key) || 0) + 1);
      }
      const palette = [...buckets.entries()].sort((a,b)=>b[1]-a[1]).slice(0,count).map(([key]) => {
        const [r,g,b] = key.split(',').map(Number);
        return rgbToHex2(r,g,b);
      });
      resolve(palette);
    };
    img.src = dataUrl;
  });
}
function rgbToHex2(r,g,b){return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join('')}
function hexToRgb(hex){const n=hex.replace('#','');return {r:parseInt(n.slice(0,2),16),g:parseInt(n.slice(2,4),16),b:parseInt(n.slice(4,6),16)}}
function hexBrightness(hex){const {r,g,b}=hexToRgb(hex);return .299*r+.587*g+.114*b}

function generateAutoCover() {
  const title = dom.title.value || 'عنوان الكتاب';
  const subtitle = dom.subtitle.value || 'رواية / كتاب';
  const author = dom.author.value || 'اسم المؤلف';
  const t = THEMES[dom.theme.value];
  const canvas = document.createElement('canvas');
  canvas.width = 1200; canvas.height = 1800;
  const ctx = canvas.getContext('2d');
  const grad = ctx.createLinearGradient(0,0,0,1800);
  grad.addColorStop(0, t.accent); grad.addColorStop(0.35, '#131018'); grad.addColorStop(1, '#07070a');
  ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width,canvas.height);
  for (let i=0;i<18;i++) { ctx.strokeStyle = `rgba(255,255,255,${0.04 + i*0.003})`; ctx.strokeRect(30+i*12, 30+i*18, canvas.width-(60+i*24), canvas.height-(60+i*36)); }
  ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.beginPath(); ctx.arc(920, 360, 220, 0, Math.PI*2); ctx.fill();
  ctx.fillStyle = '#f4eadf'; ctx.textAlign = 'center';
  ctx.font = '800 88px serif'; wrapCanvasText(ctx, title, 600, 820, 860, 100);
  ctx.font = '600 42px sans-serif'; ctx.fillText(subtitle, 600, 1080);
  ctx.font = '700 52px sans-serif'; ctx.fillText(author, 600, 1550);
  state.coverDataUrl = canvas.toDataURL('image/jpeg', .96);
  renderCoverPreview();
  autosaveProject();
  toast('تم توليد غلاف تلقائي');
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' '); let line = ''; let yy = y;
  for (const word of words) {
    const test = line + word + ' ';
    if (ctx.measureText(test).width > maxWidth && line) { ctx.fillText(line.trim(), x, yy); line = word + ' '; yy += lineHeight; }
    else line = test;
  }
  if (line) ctx.fillText(line.trim(), x, yy);
}

function smartFormatParts() {
  qsa('.part-card').forEach(card => {
    const textarea = card.querySelector('.part-content-input');
    let text = textarea.value.replace(/\r/g, '');
    text = text.replace(/\n{3,}/g, '\n\n').replace(/[ \t]+\n/g, '\n').replace(/\n[ \t]+/g,'\n').trim();
    textarea.value = text;
    const titleInput = card.querySelector('.part-title-input');
    if (!titleInput.value.trim() && text.split('\n')[0]) titleInput.value = text.split('\n')[0].slice(0, 50);
  });
  autosaveParts();
  toast('تمت المعالجة الذكية للنصوص');
}

function extractQuotesFromPart(textarea) {
  const lines = textarea.value.split('\n').filter(Boolean);
  const quotes = lines.filter(l => l.length > 18 && l.length < 90);
  if (!quotes.length) return toast('لم أجد جمل مناسبة للاقتباس');
  textarea.value += '\n\n' + quotes.slice(0, 3).map(q => `❝ ${q.trim()} ❞`).join('\n\n');
  textarea.dispatchEvent(new Event('input'));
  toast('تم استخراج جمل مميزة وإلحاقها آخر البارت');
}

function detectGenre(fullText) {
  if (dom.kind.value !== 'auto') return dom.kind.value;
  const t = fullText.toLowerCase();
  if (/دم|ظل|موت|رعب|صمت|ليلة|مقبرة|ghost|dark/.test(t)) return 'horror';
  if (/مملكة|سحر|بوابة|عالم|تنين|fate|magic/.test(t)) return 'fantasy';
  if (/قصيدة|أحبك|روح|قلب|حنين|خاطرة/.test(t)) return 'poetry';
  if (/مقال|فكرة|تحليل|دراسة|استراتيجية/.test(t)) return 'essays';
  return 'novel';
}

function suggestThemeForGenre(genre) {
  return { horror: 'horror-manuscript', fantasy: 'luxury-hardcover', poetry: 'old-library', essays: 'minimal-modern', novel: 'classic-novel' }[genre] || 'classic-novel';
}

async function buildBook() {
  autosaveParts();
  if (!state.parts.some(p => p.content.trim())) return toast('أضف محتوى أولاً');
  setStatus('جارٍ بناء الكتاب وتقسيم الصفحات...');
  setQueue('قراءة البيانات', 5);
  await document.fonts.ready;
  const fullText = state.parts.map(p => p.content).join('\n');
  state.genre = detectGenre(fullText);
  dom.genreChip.textContent = `النوع: ${translateGenre(state.genre)}`;
  if (!state.referenceDNA && dom.kind.value === 'auto') {
    const suggestedTheme = suggestThemeForGenre(state.genre);
    dom.theme.value = suggestedTheme;
    applyThemeToUI(suggestedTheme);
  }
  const blueprint = generateBlueprint();
  setQueue('تكوين الصفحات التمهيدية', 20);
  const staticPages = generateFrontMatterPages(blueprint);
  setQueue('تقسيم الفصول إلى صفحات', 42);
  const chapterPages = paginateChapters(blueprint);
  const pages = [...staticPages, ...chapterPages];
  state.pages = pages;
  if (el('lockedLayout').checked) state.exportLockedSnapshot = structuredClone(pages);
  setQueue('رسم المعاينة', 75);
  renderPages(pages);
  setQueue('اكتمل بناء الكتاب', 100);
  setStatus('تم بناء الكتاب بنجاح');
  dom.pagesChip.textContent = `الصفحات: ${pages.length}`;
  validateBook(true);
}

function translateGenre(g){return {novel:'رواية', horror:'رعب', fantasy:'فانتازيا', poetry:'خواطر / أدب', essays:'مقالات'}[g] || 'رواية'}

function generateBlueprint() {
  return {
    title: dom.title.value || 'عنوان الكتاب',
    subtitle: dom.subtitle.value || 'رواية / كتاب',
    author: dom.author.value || 'اسم المؤلف',
    description: dom.description.value || 'لا يوجد وصف بعد.',
    cover: state.coverDataUrl,
    direction: dom.direction.value,
    pageSize: dom.pageSize.value,
    theme: THEMES[dom.theme.value],
    font: dom.font.value,
    paper: dom.paperColor.value,
    parts: state.parts.filter(p => p.content.trim())
  };
}

function generateFrontMatterPages(bp) {
  const pages = [];
  pages.push({ type: 'cover', pageNumber: 1, title: bp.title, subtitle: bp.subtitle, author: bp.author, cover: bp.cover });
  pages.push({ type: 'title', pageNumber: 2, content: `<h1>${escapeHtml(bp.title)}</h1><h3>${escapeHtml(bp.subtitle)}</h3><p class="quote">${escapeHtml(bp.author)}</p>` });
  let pageNo = 3;
  if (el('includeDedication').checked) pages.push({ type:'text', pageNumber: pageNo++, content:`<h2>إهداء</h2><p class="quote">إلى كل من آمن بالكلمات قبل أن تصبح كتابًا.</p>` });
  if (el('includeRights').checked) pages.push({ type:'text', pageNumber: pageNo++, content:`<h2>تنبيه حقوق</h2><div class="about-block"><p>هذا الكتاب مُنسّق داخل BookForge Studio Ultimate. يُمنع النسخ أو إعادة النشر أو التوزيع دون إذن صاحب العمل.</p></div>` });
  if (el('includeAboutPage').checked) pages.push({ type:'text', pageNumber: pageNo++, content:`<h2>عن الكتاب</h2><div class="about-block"><p>${escapeHtml(bp.description).replace(/\n/g,'</p><p>')}</p></div>` });
  if (el('includeTOC').checked) {
    const toc = bp.parts.map((p,i)=>`<div class="toc-item"><span>${escapeHtml(p.title || `الفصل ${i+1}`)}</span><span>${i+1}</span></div>`).join('');
    pages.push({ type:'text', pageNumber: pageNo++, content:`<h2>الفهرس</h2>${toc}` });
  }
  return pages;
}

function paginateChapters(bp) {
  const pages = [];
  let pageNo = generateFrontMatterPages(bp).length + 1;
  const sizeProfile = {
    '6x9': { chars: 1500 },
    'a5': { chars: 1300 },
    'b5': { chars: 1900 }
  }[bp.pageSize];

  bp.parts.forEach((part, idx) => {
    const chapterTitle = part.title || `الفصل ${idx + 1}`;
    pages.push({ type:'chapter-start', pageNumber: pageNo++, title: chapterTitle, chapter: idx + 1 });
    const paragraphs = part.content.split(/\n{2,}/).map(p=>p.trim()).filter(Boolean);
    let current = [];
    let currentCount = 0;
    paragraphs.forEach((paragraph, pIndex) => {
      const block = formatParagraph(paragraph, pIndex === 0);
      const estimated = paragraph.length + (block.includes('quote') ? 120 : 0) + (block.includes('dialogue') ? 80 : 0);
      if (currentCount + estimated > sizeProfile.chars && current.length) {
        pages.push({ type:'text', pageNumber: pageNo++, content: composeTextPage(current, chapterTitle, idx + 1) });
        current = []; currentCount = 0;
      }
      current.push(block);
      currentCount += estimated;
    });
    if (current.length) pages.push({ type:'text', pageNumber: pageNo++, content: composeTextPage(current, chapterTitle, idx + 1) });
    if (el('ornamentsMode').checked) pages.push({ type:'text', pageNumber: pageNo++, content:`<div class="ornament">✦ ✦ ✦</div><p class="quote">نهاية ${escapeHtml(chapterTitle)}</p>` });
  });
  return pages;
}

function formatParagraph(paragraph, isFirst) {
  const escaped = escapeHtml(paragraph).replace(/\n/g, '<br>');
  const isDialogue = el('dialoguesMode').checked && /^(?:[-—–]|"|«|\u201c|\u201d|قال|سألت|أجاب|رد)/.test(paragraph.trim());
  const isQuote = el('highlightQuotesMode').checked && ((paragraph.includes('❝') && paragraph.includes('❞')) || (paragraph.length > 20 && paragraph.length < 90));
  const dropcap = el('dropcapMode').checked && isFirst && !isDialogue && !isQuote ? ' dropcap' : '';
  if (isQuote) return `<p class="quote">${escaped.replace(/[❝❞]/g, '')}</p>`;
  if (isDialogue) return `<p class="dialogue">${escaped}</p>`;
  return `<p class="${dropcap.trim()}">${escaped}</p>`;
}

function composeTextPage(blocks, chapterTitle, chapterNo) {
  const head = `<div class="header-line"><span>${escapeHtml(chapterTitle)}</span><span>الفصل ${chapterNo}</span></div>`;
  return head + blocks.join('');
}

function renderPages(pages) {
  dom.previewShelf.innerHTML = '';
  dom.exportStage.innerHTML = '';
  const pageTpl = el('previewPageTemplate');
  pages.forEach((page, index) => {
    const wrap = pageTpl.content.firstElementChild.cloneNode(true);
    const target = wrap.querySelector('.book-page');
    target.dataset.index = index;
    target.classList.toggle('cover-page', page.type === 'cover');
    target.dir = dom.direction.value;
    target.style.background = page.type === 'cover' ? '#000' : dom.paperColor.value;
    target.style.fontFamily = `'${dom.font.value}', serif`;
    if (page.type === 'cover') target.innerHTML = renderCoverPage(page);
    else if (page.type === 'chapter-start') target.innerHTML = `<h1>الفصل ${page.chapter}</h1><h2>${escapeHtml(page.title)}</h2><div class="ornament">✦ ✦ ✦</div><div class="page-number">${page.pageNumber}</div>`;
    else target.innerHTML = `${page.content}<div class="page-number">${page.pageNumber}</div>`;

    wrap.querySelector('.page-download-btn').onclick = () => downloadSinglePage(target, index + 1);
    wrap.querySelector('.page-copy-btn').onclick = () => copyPageImage(target);
    wrap.onclick = () => focusPage(index);
    dom.previewShelf.appendChild(wrap);

    const cloneWrap = wrap.cloneNode(true);
    cloneWrap.querySelector('.page-controls').remove();
    dom.exportStage.appendChild(cloneWrap);
  });
  focusPage(0);
}

function renderCoverPage(page) {
  return `
    ${page.cover ? `<div class="cover-layer" style="background-image:url('${page.cover}')"></div>` : ''}
    <div class="cover-overlay"></div>
    <div class="cover-content">
      <div class="eyebrow">${escapeHtml(dom.subtitle.value || 'رواية / كتاب')}</div>
      <div class="book-main-title">${escapeHtml(page.title)}</div>
      <div class="book-subtitle">${escapeHtml(page.subtitle || '')}</div>
      <div class="author-name">${escapeHtml(page.author)}</div>
    </div>`;
}

function focusPage(index) {
  const wraps = qsa('.book-page-wrap');
  if (!wraps.length) return;
  state.activePage = Math.max(0, Math.min(index, wraps.length - 1));
  wraps.forEach((w,i) => w.classList.toggle('active', i === state.activePage));
  wraps[state.activePage].scrollIntoView({ behavior:'smooth', block:'nearest' });
}

async function waitForAssets(container = document) {
  await document.fonts.ready;
  const imgs = [...container.querySelectorAll('img')];
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => { img.onload = img.onerror = res; })));
}

async function renderPreviewImages() {
  if (!state.pages.length) await buildBook();
  setStatus('جارٍ توليد صور صفحات المعاينة...');
  setQueue('تهيئة صفحات التصدير', 10);
  await waitForAssets(dom.exportStage);
  const pages = [...dom.exportStage.querySelectorAll('.book-page')];
  const images = [];
  for (let i = 0; i < pages.length; i++) {
    setQueue(`تحويل الصفحة ${i + 1} من ${pages.length} إلى صورة`, ((i + 1) / pages.length) * 100);
    const canvas = await html2canvas(pages[i], { scale: 2, backgroundColor: null, useCORS: true, logging: false });
    images.push(canvas.toDataURL('image/jpeg', 0.96));
  }
  state.pageImages = images;
  setStatus('تم توليد صور المعاينة');
  toast('تم إنشاء صور جميع صفحات المعاينة');
  return images;
}

async function downloadSinglePage(pageElement, pageNo) {
  await waitForAssets(pageElement);
  const canvas = await html2canvas(pageElement, { scale: 2, backgroundColor: null, useCORS: true });
  canvas.toBlob(blob => downloadBlob(blob, `${safeName(dom.title.value || 'book')}-page-${pageNo}.jpg`), 'image/jpeg', 0.96);
}

async function copyPageImage(pageElement) {
  const canvas = await html2canvas(pageElement, { scale: 2, backgroundColor: null, useCORS: true });
  canvas.toBlob(async blob => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
      toast('تم نسخ الصفحة كصورة');
    } catch {
      toast('المتصفح لم يسمح بالنسخ، استخدم زر التنزيل');
    }
  });
}

async function downloadAllPreviewZip() {
  const images = state.pageImages.length ? state.pageImages : await renderPreviewImages();
  setStatus('جارٍ ضغط الصفحات داخل ZIP...');
  const zip = new JSZip();
  images.forEach((dataUrl, i) => zip.file(`page-${String(i + 1).padStart(3, '0')}.jpg`, dataUrl.split(',')[1], { base64: true }));
  const blob = await zip.generateAsync({ type: 'blob' }, meta => setQueue(`ضغط الصور داخل ZIP`, meta.percent));
  downloadBlob(blob, `${safeName(dom.title.value || 'book')}-pages.zip`);
  toast('تم تنزيل ZIP للصفحات');
}

async function exportPdfFromPreview() {
  try {
    const pagesData = el('lockedLayout').checked && state.exportLockedSnapshot ? state.exportLockedSnapshot : state.pages;
    if (!pagesData.length) await buildBook();
    setStatus('جارٍ إنشاء PDF مطابق للمعاينة...');
    const images = await renderPreviewImages();
    if (!images.length) return toast('فشل توليد صور الصفحات');
    const profile = getPdfProfile();
    const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: profile.format, compress: true });
    for (let i = 0; i < images.length; i++) {
      if (i > 0) pdf.addPage(profile.format, 'portrait');
      pdf.addImage(images[i], 'JPEG', 0, 0, profile.width, profile.height, undefined, 'FAST');
      setQueue(`إضافة الصفحة ${i + 1} إلى PDF`, ((i + 1) / images.length) * 100);
    }
    const blob = pdf.output('blob');
    state.lastExportImages = images;
    downloadBlob(blob, `${safeName(dom.title.value || 'book')}.pdf`);
    setStatus('تم إنشاء PDF مطابق للمعاينة');
    if (el('compareMode').checked) comparePreviewAndExport(images);
  } catch (err) {
    console.error(err);
    toast('حدث خطأ أثناء تصدير PDF');
  }
}

function getPdfProfile() {
  const map = {
    '6x9': { format: [432, 648], width: 432, height: 648 },
    'a5': { format: [420, 595], width: 420, height: 595 },
    'b5': { format: [516, 729], width: 516, height: 729 }
  };
  return map[dom.pageSize.value] || map['6x9'];
}

function comparePreviewAndExport(images) {
  dom.comparePanel.innerHTML = '<h3>مقارنة المعاينة والنسخة النهائية</h3>';
  dom.comparePanel.classList.remove('hidden');
  const previewPages = [...dom.previewShelf.querySelectorAll('.book-page')].slice(0, Math.min(4, images.length));
  previewPages.forEach((page, i) => {
    const card = document.createElement('div');
    card.className = 'compare-grid';
    const left = document.createElement('div'); left.className = 'compare-card';
    const right = document.createElement('div'); right.className = 'compare-card';
    left.innerHTML = `<h4>المعاينة — صفحة ${i + 1}</h4>`;
    right.innerHTML = `<h4>التصدير — صفحة ${i + 1}</h4><img src="${images[i]}" alt="export page ${i+1}">`;
    html2canvas(page, { scale: 1.2, backgroundColor: null, useCORS: true }).then(c => {
      const img = new Image(); img.src = c.toDataURL('image/jpeg', .9); left.appendChild(img);
    });
    card.appendChild(left); card.appendChild(right); dom.comparePanel.appendChild(card);
  });
}

function exportHTML() {
  const html = `<!doctype html><html lang="ar" dir="${dom.direction.value}"><head><meta charset="utf-8"><title>${escapeHtml(dom.title.value || 'Book')}</title><style>body{font-family:${dom.font.value};background:${dom.paperColor.value};color:#2b2219;max-width:860px;margin:40px auto;padding:20px;line-height:2}h1,h2{font-family:'${THEMES[dom.theme.value].titleFont}',serif}</style></head><body>${state.pages.map(p => `<section style="page-break-after:always;margin-bottom:60px">${p.type === 'cover' ? renderCoverPage(p) : p.content || ''}</section>`).join('')}</body></html>`;
  downloadBlob(new Blob([html], { type: 'text/html;charset=utf-8' }), `${safeName(dom.title.value || 'book')}.html`);
}

function exportTXT() {
  const text = [dom.title.value, dom.subtitle.value, dom.author.value, '', dom.description.value, '', ...state.parts.map(p => `${p.title}\n${p.content}\n`)].join('\n');
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `${safeName(dom.title.value || 'book')}.txt`);
}

function validateBook(silent = false) {
  const issues = [];
  if (!dom.title.value.trim()) issues.push('عنوان الكتاب مفقود');
  if (!state.parts.some(p => p.content.trim())) issues.push('لا توجد فصول حقيقية');
  if (!state.coverDataUrl) issues.push('الغلاف غير مرفوع');
  if (state.pages.some(p => !['cover','chapter-start'].includes(p.type) && !(p.content || '').trim())) issues.push('هناك صفحة محتوى فارغة');
  let className = 'health-good', label = 'الفحص: ممتاز';
  if (issues.length >= 3) { className = 'health-bad'; label = `الفحص: مشاكل ${issues.length}`; }
  else if (issues.length) { className = 'health-warn'; label = `الفحص: يحتاج مراجعة`; }
  dom.healthChip.className = `chip ${className}`;
  dom.healthChip.textContent = label;
  if (!silent) toast(issues.length ? issues.join(' — ') : 'الفحص ممتاز ولا توجد مشاكل مهمة');
  return issues;
}

function safeName(name) {
  return name.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 80) || 'bookforge';
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function escapeHtml(str = '') {
  return str.replace(/[&<>"']/g, s => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[s]));
}

init();
