import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs';

const PAGE_WIDTH = 420;
const PAGE_HEIGHT = 594;
const EXPORT_SCALE = 1.35;

const state = {
  coverDataUrl: '',
  styleDataUrl: '',
  parts: [],
  nextId: 1,
  renderedPages: [],
  isExporting: false,
  inferred: {
    bgColor: '#f6f1e8',
    accentColor: '#6a3b1f',
    font: 'Amiri',
    preset: 'classic'
  }
};

const els = {
  bookTitle: document.getElementById('bookTitle'),
  bookAuthor: document.getElementById('bookAuthor'),
  bookDescription: document.getElementById('bookDescription'),
  coverInput: document.getElementById('coverInput'),
  coverPreview: document.getElementById('coverPreview'),
  coverPlaceholder: document.getElementById('coverPlaceholder'),
  styleInput: document.getElementById('styleInput'),
  styleCanvas: document.getElementById('styleCanvas'),
  styleImagePreview: document.getElementById('styleImagePreview'),
  stylePlaceholder: document.getElementById('stylePlaceholder'),
  stylePreset: document.getElementById('stylePreset'),
  fontSelect: document.getElementById('fontSelect'),
  bgColor: document.getElementById('bgColor'),
  accentColor: document.getElementById('accentColor'),
  partsInput: document.getElementById('partsInput'),
  partsList: document.getElementById('partsList'),
  addManualPart: document.getElementById('addManualPart'),
  clearParts: document.getElementById('clearParts'),
  refreshPreview: document.getElementById('refreshPreview'),
  exportBtn: document.getElementById('exportBtn'),
  exportFormat: document.getElementById('exportFormat'),
  downloadZipBtn: document.getElementById('downloadZipBtn'),
  partsCount: document.getElementById('partsCount'),
  wordsCount: document.getElementById('wordsCount'),
  pagesCount: document.getElementById('pagesCount'),
  previewBook: document.getElementById('previewBook'),
  partTemplate: document.getElementById('partTemplate')
};

function uid() {
  return state.nextId++;
}

function escapeHtml(str = '') {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function downloadFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function dataUrlToBlob(dataUrl) {
  const [header, data] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] || 'image/png';
  const binary = atob(data);
  const array = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) array[i] = binary.charCodeAt(i);
  return new Blob([array], { type: mime });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsArrayBuffer(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

function countWords(text) {
  return (text || '').trim().split(/\s+/).filter(Boolean).length;
}

function classifyParagraph(text) {
  const trimmed = text.trim();
  if (!trimmed) return '';
  const quoteLike = /^(?:["“”'«»]|[-–—]|قال|قلت|سألت|أجاب|همس|صرخ|ردّ|رد|قالت|أجابت|همست)\b/.test(trimmed);
  const strongLike = (/[.!؟…]$/.test(trimmed) && trimmed.length <= 120) || trimmed.length <= 65;
  if (quoteLike) return 'dialogue';
  if (strongLike && trimmed.length < 130) return 'highlight';
  return '';
}

function styleFromPreset(preset) {
  switch (preset) {
    case 'luxury': return { bg: '#f7f1e4', accent: '#7a3f1e', font: 'Amiri' };
    case 'dark': return { bg: '#efe7da', accent: '#53311f', font: 'Tajawal' };
    case 'minimal': return { bg: '#f8f8f6', accent: '#2f3d4d', font: 'Cairo' };
    case 'classic': return { bg: '#f6f1e8', accent: '#6a3b1f', font: 'Amiri' };
    default:
      return {
        bg: state.inferred.bgColor,
        accent: state.inferred.accentColor,
        font: state.inferred.font
      };
  }
}

function applyBookTheme() {
  const presetVals = styleFromPreset(els.stylePreset.value);
  const bg = els.bgColor.value || presetVals.bg;
  const accent = els.accentColor.value || presetVals.accent;
  const chosenFont = els.fontSelect.value === 'auto' ? presetVals.font : els.fontSelect.value;

  document.documentElement.style.setProperty('--primary', bg);
  document.documentElement.style.setProperty('--accent', accent);
  document.documentElement.style.setProperty('--book-font', `'${chosenFont}', serif`);
}

function syncStats() {
  els.partsCount.textContent = state.parts.length;
  els.wordsCount.textContent = state.parts.reduce((sum, part) => sum + countWords(part.content), 0).toLocaleString('en-US');
  els.pagesCount.textContent = state.renderedPages.length;
}

function renderPartsEditor() {
  els.partsList.innerHTML = '';
  state.parts.forEach((part, index) => {
    const fragment = els.partTemplate.content.cloneNode(true);
    const card = fragment.querySelector('.part-card');
    card.dataset.id = part.id;

    const titleInput = fragment.querySelector('.part-title-input');
    const contentInput = fragment.querySelector('.part-content-input');
    titleInput.value = part.title;
    contentInput.value = part.content;

    titleInput.addEventListener('input', e => {
      part.title = e.target.value;
      renderPreview();
    });

    contentInput.addEventListener('input', e => {
      part.content = e.target.value;
      renderPreview();
    });

    fragment.querySelector('.move-up').addEventListener('click', () => {
      if (index === 0) return;
      [state.parts[index - 1], state.parts[index]] = [state.parts[index], state.parts[index - 1]];
      renderPartsEditor();
      renderPreview();
    });

    fragment.querySelector('.move-down').addEventListener('click', () => {
      if (index === state.parts.length - 1) return;
      [state.parts[index + 1], state.parts[index]] = [state.parts[index], state.parts[index + 1]];
      renderPartsEditor();
      renderPreview();
    });

    fragment.querySelector('.delete-part').addEventListener('click', () => {
      state.parts = state.parts.filter(p => p.id !== part.id);
      renderPartsEditor();
      renderPreview();
    });

    els.partsList.appendChild(fragment);
  });
  syncStats();
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}

function adjustColor(hex, amount = 0) {
  let usePound = false;
  if (hex[0] === '#') {
    hex = hex.slice(1);
    usePound = true;
  }
  const num = parseInt(hex, 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;
  r = Math.max(Math.min(255, r), 0);
  g = Math.max(Math.min(255, g), 0);
  b = Math.max(Math.min(255, b), 0);
  return (usePound ? '#' : '') + (b | (g << 8) | (r << 16)).toString(16).padStart(6, '0');
}

function extractPaletteFromCanvas(canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let r = 0, g = 0, b = 0, count = 0;

  for (let i = 0; i < data.length; i += 40) {
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count++;
  }

  const avgR = Math.round(r / count);
  const avgG = Math.round(g / count);
  const avgB = Math.round(b / count);
  const main = rgbToHex(avgR, avgG, avgB);
  const luminance = (0.299 * avgR + 0.587 * avgG + 0.114 * avgB) / 255;

  state.inferred.accentColor = luminance > 0.55 ? adjustColor(main, -70) : adjustColor(main, 40);
  state.inferred.bgColor = luminance > 0.55 ? '#f7f1e8' : '#efe7da';
  state.inferred.font = luminance > 0.45 ? 'Amiri' : 'Tajawal';
  state.inferred.preset = luminance > 0.45 ? 'classic' : 'dark';

  if (els.stylePreset.value === 'auto') {
    els.bgColor.value = state.inferred.bgColor;
    els.accentColor.value = state.inferred.accentColor;
  }

  renderPreview();
}

async function handleStyleUpload(file) {
  if (!file) return;
  const name = file.name.toLowerCase();

  if (name.endsWith('.pdf')) {
    const buffer = await readFileAsArrayBuffer(file);
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 1.3 });
    const canvas = els.styleCanvas;
    const context = canvas.getContext('2d');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    await page.render({ canvasContext: context, viewport }).promise;
    state.styleDataUrl = canvas.toDataURL('image/png');
    els.styleCanvas.classList.remove('hidden');
    els.styleImagePreview.classList.add('hidden');
    els.stylePlaceholder.classList.add('hidden');
    extractPaletteFromCanvas(canvas);
    return;
  }

  const dataUrl = await readFileAsDataURL(file);
  state.styleDataUrl = dataUrl;
  els.styleImagePreview.src = dataUrl;
  els.styleImagePreview.classList.remove('hidden');
  els.styleCanvas.classList.add('hidden');
  els.stylePlaceholder.classList.add('hidden');

  const img = new Image();
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const ratio = img.width / img.height;
    canvas.width = 250;
    canvas.height = Math.max(160, Math.round(250 / ratio));
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    extractPaletteFromCanvas(canvas);
  };
  img.src = dataUrl;
}

function addPart(title = '', content = '') {
  state.parts.push({ id: uid(), title, content });
  renderPartsEditor();
  renderPreview();
}

async function parseTextFile(file) {
  const baseTitle = file.name.replace(/\.[^.]+$/, '');
  if (file.name.toLowerCase().endsWith('.docx')) {
    const buffer = await readFileAsArrayBuffer(file);
    const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    return { title: baseTitle, content: result.value || '' };
  }
  const text = await readFileAsText(file);
  return { title: baseTitle, content: text || '' };
}

function getBookTitle() {
  return els.bookTitle.value.trim() || 'عنوان كتابك';
}

function getBookAuthor() {
  return els.bookAuthor.value.trim() || 'اسم المؤلف';
}

function getBookDescription() {
  return els.bookDescription.value.trim() || 'اكتب وصف الكتاب من الشريط الجانبي لتظهر المعاينة هنا بشكل أنيق.';
}

function createPageCard(pageNo, innerHtml, extraClass = '') {
  const card = document.createElement('article');
  card.className = 'preview-page-card';
  card.innerHTML = `
    <div class="preview-card-toolbar">
      <span>صفحة ${pageNo}</span>
      <button class="page-download-btn" type="button" data-page-no="${pageNo}">تنزيل الصفحة</button>
    </div>
    <div class="book-page ${extraClass}" data-page-no="${pageNo}">
      ${innerHtml}
    </div>
  `;
  return card;
}

function createChapterPageElement(title, pageNo, isContinuation = false) {
  const page = document.createElement('div');
  page.className = 'book-page chapter-page export-page';
  page.dataset.pageNo = pageNo;
  page.innerHTML = `
    <h2>${escapeHtml(title)}${isContinuation ? ' <span class="continued-mark">— متابعة</span>' : ''}</h2>
    <div class="chapter-body"></div>
    <div class="page-number">${pageNo}</div>
  `;
  return page;
}

function createMeasureRoot() {
  const root = document.createElement('div');
  root.className = 'export-root export-measure-root';
  root.setAttribute('aria-hidden', 'true');
  document.body.appendChild(root);
  return root;
}

function extractParagraphs(content) {
  const paragraphs = (content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map(p => p.trim())
    .filter(Boolean);

  return paragraphs.length ? paragraphs : ['لا يوجد نص في هذا البارت.'];
}

function splitLongText(text, maxChars = 220) {
  const clean = (text || '').trim();
  if (!clean) return [];

  if (clean.length <= maxChars) return [clean];

  const sentenceParts = clean
    .split(/(?<=[\.\!\؟\…\،\:])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  if (sentenceParts.length > 1) {
    const chunks = [];
    let current = '';

    for (const part of sentenceParts) {
      if ((current + ' ' + part).trim().length <= maxChars) {
        current = (current + ' ' + part).trim();
      } else {
        if (current) chunks.push(current);
        current = part;
      }
    }

    if (current) chunks.push(current);
    return chunks;
  }

  const words = clean.split(/\s+/).filter(Boolean);
  const chunks = [];
  let current = '';

  for (const word of words) {
    if ((current + ' ' + word).trim().length <= maxChars) {
      current = (current + ' ' + word).trim();
    } else {
      if (current) chunks.push(current);
      current = word;
    }
  }

  if (current) chunks.push(current);
  return chunks;
}

function expandParagraphsForPagination(content) {
  const paragraphs = extractParagraphs(content);
  const expanded = [];

  for (const paragraph of paragraphs) {
    const lines = paragraph
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);

    const sourceLines = lines.length ? lines : [paragraph];

    for (const line of sourceLines) {
      const chunks = splitLongText(line, 220);
      for (const chunk of chunks) {
        expanded.push({
          text: chunk,
          className: classifyParagraph(chunk)
        });
      }
    }

    expanded.push({ spacer: true });
  }

  while (expanded.length && expanded[expanded.length - 1].spacer) {
    expanded.pop();
  }

  return expanded.length ? expanded : [{ text: 'لا يوجد نص في هذا البارت.', className: '' }];
}

function appendSegment(body, segment) {
  if (segment.spacer) {
    const spacer = document.createElement('div');
    spacer.className = 'paragraph-spacer';
    body.appendChild(spacer);
    return spacer;
  }

  const p = document.createElement('p');
  p.className = segment.className || '';
  p.textContent = segment.text;
  body.appendChild(p);
  return p;
}

function paginatePart(title, content, startPageNo) {
  const pages = [];
  const measureRoot = createMeasureRoot();
  const segments = expandParagraphsForPagination(content);

  let pageNo = startPageNo;
  let currentPage = createChapterPageElement(title, pageNo, false);
  let body = currentPage.querySelector('.chapter-body');
  measureRoot.appendChild(currentPage);

  for (const segment of segments) {
    const node = appendSegment(body, segment);

    if (body.scrollHeight > body.clientHeight + 1) {
      node.remove();

      const isPageEmpty = !body.children.length;

      if (isPageEmpty && !segment.spacer && segment.text.length > 40) {
        const fallbackChunks = splitLongText(segment.text, 120);

        for (const smallChunk of fallbackChunks) {
          const retryNode = appendSegment(body, {
            text: smallChunk,
            className: classifyParagraph(smallChunk)
          });

          if (body.scrollHeight > body.clientHeight + 1) {
            retryNode.remove();

            pages.push({
              pageNo,
              element: currentPage.cloneNode(true),
              title,
              isContinuation: pageNo !== startPageNo
            });

            pageNo += 1;
            currentPage.remove();
            currentPage = createChapterPageElement(title, pageNo, true);
            body = currentPage.querySelector('.chapter-body');
            measureRoot.appendChild(currentPage);

            appendSegment(body, {
              text: smallChunk,
              className: classifyParagraph(smallChunk)
            });
          }
        }

        continue;
      }

      pages.push({
        pageNo,
        element: currentPage.cloneNode(true),
        title,
        isContinuation: pageNo !== startPageNo
      });

      pageNo += 1;
      currentPage.remove();
      currentPage = createChapterPageElement(title, pageNo, true);
      body = currentPage.querySelector('.chapter-body');
      measureRoot.appendChild(currentPage);

      appendSegment(body, segment);
    }
  }

  pages.push({
    pageNo,
    element: currentPage.cloneNode(true),
    title,
    isContinuation: pageNo !== startPageNo
  });

  measureRoot.remove();
  return pages;
}

function buildRenderedPages() {
  applyBookTheme();
  const pages = [];
  let pageNo = 1;

  pages.push({
    pageNo,
    type: 'cover',
    html: `
      <div class="cover-art-area" style="${state.coverDataUrl ? `background-image: linear-gradient(180deg, rgba(0,0,0,.08), rgba(0,0,0,.55)), url('${state.coverDataUrl}')` : ''}"></div>
      <div class="cover-overlay"></div>
      <div class="cover-content">
        <p class="book-tag">رواية / كتاب رقمي</p>
        <h1>${escapeHtml(getBookTitle())}</h1>
        <p>${escapeHtml(getBookAuthor())}</p>
      </div>
      <div class="page-number light">${pageNo}</div>
    `,
    className: 'cover-page'
  });
  pageNo += 1;

  pages.push({
    pageNo,
    type: 'intro',
    html: `
      <h2>عن الكتاب</h2>
      <p>${escapeHtml(getBookDescription())}</p>
      <div class="page-number">${pageNo}</div>
    `,
    className: 'intro-page'
  });
  pageNo += 1;

  const tocStartPage = pageNo + 1;
  const tocEntries = [];
  const chapterPages = [];

  state.parts.forEach((part, index) => {
    const title = part.title?.trim() || `البارت ${index + 1}`;
    const pagesForPart = paginatePart(title, part.content || '', pageNo);
    tocEntries.push({ index: index + 1, title, pageNo });
    pagesForPart.forEach(item => {
      chapterPages.push({
        pageNo: item.pageNo,
        type: 'chapter',
        node: item.element,
        title: item.title,
        className: 'chapter-page'
      });
    });
    pageNo += pagesForPart.length;
  });

  pages.push({
    pageNo: tocStartPage - 1,
    type: 'toc',
    html: `
      <h2>الفهرس</h2>
      <div class="toc-list">
        ${tocEntries.map(entry => `<div class="toc-item"><span class="chapter-num">${entry.index}</span><span>${escapeHtml(entry.title)}</span><span>${entry.pageNo}</span></div>`).join('') || '<p>لا توجد بارتات بعد.</p>'}
      </div>
      <div class="page-number">${tocStartPage - 1}</div>
    `,
    className: 'toc-page'
  });

  return [...pages, ...chapterPages];
}

function renderPreview() {
  state.renderedPages = buildRenderedPages();
  els.previewBook.innerHTML = '';

  state.renderedPages.forEach(page => {
    if (page.node) {
      const card = document.createElement('article');
      card.className = 'preview-page-card';
      card.innerHTML = `
        <div class="preview-card-toolbar">
          <span>صفحة ${page.pageNo}</span>
          <button class="page-download-btn" type="button" data-page-no="${page.pageNo}">تنزيل الصفحة</button>
        </div>
      `;
      const node = page.node.cloneNode(true);
      node.classList.remove('export-page');
      card.appendChild(node);
      els.previewBook.appendChild(card);
    } else {
      els.previewBook.appendChild(createPageCard(page.pageNo, page.html, page.className));
    }
  });

  syncStats();
}

function getStylesheetText() {
  return Array.from(document.styleSheets)
    .map(sheet => {
      try {
        return Array.from(sheet.cssRules || []).map(rule => rule.cssText).join('\n');
      } catch {
        return '';
      }
    })
    .join('\n');
}

function makeExportHtmlDocument() {
  renderPreview();
  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(getBookTitle())}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Cairo:wght@400;700&family=Marhey:wght@400;700&family=Tajawal:wght@400;700&display=swap" rel="stylesheet">
<style>${getStylesheetText()}</style>
</head>
<body class="export-mode">
<div class="export-wrap">${els.previewBook.innerHTML}</div>
</body>
</html>`;
}

function makePlainTextExport() {
  const lines = [getBookTitle(), getBookAuthor(), '', 'الوصف', '------', getBookDescription(), ''];
  state.parts.forEach((part, i) => {
    lines.push(`${i + 1}. ${part.title || `البارت ${i + 1}`}`);
    lines.push('');
    lines.push(part.content || '');
    lines.push('');
    lines.push('='.repeat(40));
    lines.push('');
  });
  return lines.join('\n');
}

function setBusyState(busy, label = 'إنشاء الكتاب وتنزيله') {
  state.isExporting = busy;
  els.exportBtn.disabled = busy;
  els.downloadZipBtn.disabled = busy;
  els.refreshPreview.disabled = busy;
  els.exportBtn.textContent = busy ? 'جارٍ التصدير...' : label;
}

async function waitForFontsAndImages(root) {
  if (document.fonts?.ready) {
    try { await document.fonts.ready; } catch {}
  }

  const images = Array.from(root.querySelectorAll('img'));
  await Promise.all(images.map(img => new Promise(resolve => {
    if (img.complete) return resolve();
    img.onload = resolve;
    img.onerror = resolve;
  })));

  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
}

async function createLockedExportRoot() {
  renderPreview();
  applyBookTheme();
  const root = document.createElement('div');
  root.className = 'export-root';
  root.setAttribute('aria-hidden', 'true');

  state.renderedPages.forEach(page => {
    let pageElement;
    if (page.node) {
      pageElement = page.node.cloneNode(true);
    } else {
      pageElement = document.createElement('div');
      pageElement.className = `book-page ${page.className || ''}`;
      pageElement.dataset.pageNo = page.pageNo;
      pageElement.innerHTML = page.html;
    }
    root.appendChild(pageElement);
  });

  document.body.appendChild(root);
  await waitForFontsAndImages(root);
  return root;
}

async function renderPageToDataUrl(pageElement) {
  const canvas = await window.html2canvas(pageElement, {
    scale: EXPORT_SCALE,
    useCORS: true,
    backgroundColor: '#ffffff',
    width: PAGE_WIDTH,
    height: PAGE_HEIGHT,
    windowWidth: PAGE_WIDTH,
    windowHeight: PAGE_HEIGHT,
    scrollX: 0,
    scrollY: 0,
    logging: false,
    removeContainer: true
  });

  return canvas.toDataURL('image/jpeg', 0.92);
}

async function renderAllPagesToDataUrls() {
  const root = await createLockedExportRoot();
  try {
    const pages = Array.from(root.querySelectorAll('.book-page'));
    const images = [];
    for (const pageElement of pages) {
      images.push(await renderPageToDataUrl(pageElement));
    }
    return images;
  } finally {
    root.remove();
  }
}

async function exportPdf(safeTitle) {
  const images = await renderAllPagesToDataUrls();
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a5' });
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  images.forEach((image, index) => {
    if (index > 0) pdf.addPage('a5', 'portrait');
    pdf.addImage(image, 'PNG', 0, 0, pageWidth, pageHeight, undefined, 'FAST');
  });

  pdf.save(`${safeTitle}.pdf`);
}

async function downloadPreviewPage(pageNo, safeTitle) {
  const root = await createLockedExportRoot();
  try {
    const pageElement = root.querySelector(`.book-page[data-page-no="${pageNo}"]`);
    if (!pageElement) throw new Error('page not found');
    const image = await renderPageToDataUrl(pageElement);
    downloadFile(dataUrlToBlob(image), `${safeTitle}-page-${String(pageNo).padStart(3, '0')}.jpg`);
  } finally {
    root.remove();
  }
}

async function downloadPagesZip(safeTitle) {
  const images = await renderAllPagesToDataUrls();
  const zip = new window.JSZip();
  images.forEach((image, index) => {
    zip.file(`${safeTitle}-page-${String(index + 1).padStart(3, '0')}.jpg`, dataUrlToBlob(image));
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  downloadFile(blob, `${safeTitle}-preview-pages.zip`);
}

async function exportBook() {
  if (!state.parts.length) {
    alert('أضف بارتًا واحدًا على الأقل قبل التصدير.');
    return;
  }

  const format = els.exportFormat.value;
  const safeTitle = (els.bookTitle.value.trim() || 'book').replace(/[\\/:*?"<>|]+/g, '-');

  if (format === 'txt') {
    downloadFile(new Blob([makePlainTextExport()], { type: 'text/plain;charset=utf-8' }), `${safeTitle}.txt`);
    return;
  }

  if (format === 'html') {
    downloadFile(new Blob([makeExportHtmlDocument()], { type: 'text/html;charset=utf-8' }), `${safeTitle}.html`);
    return;
  }

  setBusyState(true);
  try {
    await exportPdf(safeTitle);
  } finally {
    setBusyState(false);
  }
}

els.coverInput.addEventListener('change', async e => {
  const file = e.target.files?.[0];
  if (!file) return;
  const dataUrl = await readFileAsDataURL(file);
  state.coverDataUrl = dataUrl;
  els.coverPreview.src = dataUrl;
  els.coverPreview.classList.remove('hidden');
  els.coverPlaceholder.classList.add('hidden');
  renderPreview();
});

els.styleInput.addEventListener('change', e => handleStyleUpload(e.target.files?.[0]).catch(err => {
  console.error(err);
  alert('تعذر تحليل الملف المرجعي. جرب صورة أو PDF آخر.');
}));

els.partsInput.addEventListener('change', async e => {
  const files = Array.from(e.target.files || []);
  if (!files.length) return;
  files.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
  for (const file of files) {
    try {
      const part = await parseTextFile(file);
      addPart(part.title, part.content);
    } catch (err) {
      console.error(err);
      alert(`تعذر قراءة الملف: ${file.name}`);
    }
  }
  e.target.value = '';
});

els.addManualPart.addEventListener('click', () => addPart(`البارت ${state.parts.length + 1}`, ''));
els.clearParts.addEventListener('click', () => {
  if (!state.parts.length) return;
  if (!confirm('هل تريد حذف جميع البارتات؟')) return;
  state.parts = [];
  renderPartsEditor();
  renderPreview();
});

[els.bookTitle, els.bookAuthor, els.bookDescription, els.stylePreset, els.fontSelect, els.bgColor, els.accentColor]
  .forEach(el => el.addEventListener('input', renderPreview));

els.refreshPreview.addEventListener('click', renderPreview);
els.exportBtn.addEventListener('click', () => exportBook().catch(err => {
  console.error(err);
  setBusyState(false);
  alert('حدث خطأ أثناء إنشاء الكتاب. جرّب مرة أخرى.');
}));

els.downloadZipBtn.addEventListener('click', async () => {
  if (!state.parts.length) {
    alert('أضف بارتًا واحدًا على الأقل أولًا.');
    return;
  }
  const safeTitle = (els.bookTitle.value.trim() || 'book').replace(/[\\/:*?"<>|]+/g, '-');
  setBusyState(true, 'إنشاء الكتاب وتنزيله');
  try {
    await downloadPagesZip(safeTitle);
  } finally {
    setBusyState(false);
  }
});

els.previewBook.addEventListener('click', async e => {
  const button = e.target.closest('.page-download-btn');
  if (!button || state.isExporting) return;
  const pageNo = Number(button.dataset.pageNo);
  const safeTitle = (els.bookTitle.value.trim() || 'book').replace(/[\\/:*?"<>|]+/g, '-');
  try {
    button.disabled = true;
    button.textContent = 'جارٍ التنزيل...';
    await downloadPreviewPage(pageNo, safeTitle);
  } catch (err) {
    console.error(err);
    alert('تعذر تنزيل هذه الصفحة.');
  } finally {
    button.disabled = false;
    button.textContent = 'تنزيل الصفحة';
  }
});

addPart('البارت 1', 'ابدأ من هنا...\n\nيمكنك رفع 36 بارت أو أكثر، وترتيبها، وتعديلها، ثم تصدير الكتاب النهائي.');
renderPartsEditor();
renderPreview();
