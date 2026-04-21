const state = {
  parts: [],
  coverDataUrl: '',
  previewMode: 'single',
  pages: []
};

const $ = (id) => document.getElementById(id);

const els = {
  bookTitle: $('bookTitle'),
  bookAuthor: $('bookAuthor'),
  bookDescription: $('bookDescription'),
  bookDedication: $('bookDedication'),
  bookRights: $('bookRights'),
  coverInput: $('coverInput'),
  partTitle: $('partTitle'),
  partContent: $('partContent'),
  addPartBtn: $('addPartBtn'),
  partsFiles: $('partsFiles'),
  importPartsBtn: $('importPartsBtn'),
  clearPartsBtn: $('clearPartsBtn'),
  partsList: $('partsList'),
  themeSelect: $('themeSelect'),
  pageSize: $('pageSize'),
  fontSelect: $('fontSelect'),
  fontSize: $('fontSize'),
  lineHeight: $('lineHeight'),
  pagePadding: $('pagePadding'),
  pageBg: $('pageBg'),
  textColor: $('textColor'),
  accentColor: $('accentColor'),
  appBg: $('appBg'),
  showFrontMatter: $('showFrontMatter'),
  showPageNumbers: $('showPageNumbers'),
  highlightDialogues: $('highlightDialogues'),
  highlightQuotes: $('highlightQuotes'),
  applyThemeBtn: $('applyThemeBtn'),
  generatePreviewBtn: $('generatePreviewBtn'),
  saveProjectBtn: $('saveProjectBtn'),
  loadProjectBtn: $('loadProjectBtn'),
  exportProjectBtn: $('exportProjectBtn'),
  projectFileInput: $('projectFileInput'),
  downloadPdfBtn: $('downloadPdfBtn'),
  downloadHtmlBtn: $('downloadHtmlBtn'),
  downloadTxtBtn: $('downloadTxtBtn'),
  downloadZipImagesBtn: $('downloadZipImagesBtn'),
  previewWrapper: $('previewWrapper'),
  statusText: $('statusText'),
  previewSpreadBtn: $('previewSpreadBtn'),
  previewSingleBtn: $('previewSingleBtn'),
  loadingOverlay: $('loadingOverlay'),
  loadingTitle: $('loadingTitle'),
  loadingDesc: $('loadingDesc'),
  measureRoot: $('measureRoot'),
  pageTemplate: $('pageTemplate')
};

function escapeHtml(str='') {
  return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
}

function slugify(s='book'){
  return s.toLowerCase().trim().replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-+|-+$/g,'') || 'book';
}

function showLoading(title, desc){
  els.loadingTitle.textContent = title;
  els.loadingDesc.textContent = desc || '';
  els.loadingOverlay.classList.remove('hidden');
}

function hideLoading(){
  els.loadingOverlay.classList.add('hidden');
}

function setStatus(text){
  els.statusText.textContent = text;
}

function readFileAsDataURL(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readFileAsText(file){
  return new Promise((resolve,reject)=>{
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result||''));
    reader.onerror = reject;
    reader.readAsText(file, 'utf-8');
  });
}

async function parseDocx(file){
  const buffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer: buffer });
  return result.value || '';
}

function applyThemePreset(){
  const theme = els.themeSelect.value;
  document.body.classList.remove('theme-luxury-dark','theme-classic-paper','theme-horror-ink','theme-minimal-light');
  document.body.classList.add(`theme-${theme}`);

  const presets = {
    'luxury-dark': { appBg:'#0e1118', pageBg:'#f7f1e3', textColor:'#1b1511', accent:'#b78b47' },
    'classic-paper': { appBg:'#2d241b', pageBg:'#f5ecd7', textColor:'#2b2015', accent:'#8a6a3f' },
    'horror-ink': { appBg:'#08090d', pageBg:'#efe6d5', textColor:'#221313', accent:'#8f2b2b' },
    'minimal-light': { appBg:'#eceff4', pageBg:'#ffffff', textColor:'#1a1f28', accent:'#5a6cff' }
  };
  const p = presets[theme];
  els.appBg.value = p.appBg;
  els.pageBg.value = p.pageBg;
  els.textColor.value = p.textColor;
  els.accentColor.value = p.accent;
  applyCustomVars();
}

function applyCustomVars(){
  const root = document.documentElement;
  root.style.setProperty('--app-bg', els.appBg.value);
  root.style.setProperty('--page-bg', els.pageBg.value);
  root.style.setProperty('--page-text', els.textColor.value);
  root.style.setProperty('--accent', els.accentColor.value);
  root.style.setProperty('--font-family', els.fontSelect.value);
  root.style.setProperty('--font-size', `${els.fontSize.value}px`);
  root.style.setProperty('--line-height', els.lineHeight.value);
  root.style.setProperty('--page-padding', `${els.pagePadding.value}px`);

  const sizes = {
    'a5': ['430px','610px'],
    'b5': ['470px','665px'],
    '6x9': ['450px','675px']
  };
  const [w,h] = sizes[els.pageSize.value];
  root.style.setProperty('--page-w', w);
  root.style.setProperty('--page-h', h);
}

function addPart(title, content){
  const cleanTitle = (title || `بارت ${state.parts.length + 1}`).trim();
  const cleanContent = (content || '').trim();
  if(!cleanContent) return;
  state.parts.push({ id: crypto.randomUUID(), title: cleanTitle, content: cleanContent });
  renderPartsList();
  els.partTitle.value = '';
  els.partContent.value = '';
  generatePreview();
}

function renderPartsList(){
  els.partsList.innerHTML = '';
  if(!state.parts.length){
    els.partsList.innerHTML = '<div class="part-item"><p>لا توجد أجزاء مضافة بعد.</p></div>';
    return;
  }

  state.parts.forEach((part, index) => {
    const item = document.createElement('div');
    item.className = 'part-item';
    item.innerHTML = `
      <h4>${escapeHtml(part.title)}</h4>
      <p>${escapeHtml(part.content.slice(0, 140))}${part.content.length > 140 ? '...' : ''}</p>
      <div class="part-actions">
        <button data-action="up">⬆️ أعلى</button>
        <button data-action="down">⬇️ أسفل</button>
        <button data-action="edit">✏️ تعديل</button>
        <button data-action="delete" class="danger">🗑️ حذف</button>
      </div>
    `;
    item.querySelectorAll('button').forEach(btn => {
      btn.addEventListener('click', () => {
        const action = btn.dataset.action;
        if(action === 'up' && index > 0){
          [state.parts[index-1], state.parts[index]] = [state.parts[index], state.parts[index-1]];
        }
        if(action === 'down' && index < state.parts.length - 1){
          [state.parts[index+1], state.parts[index]] = [state.parts[index], state.parts[index+1]];
        }
        if(action === 'edit'){
          const newTitle = prompt('عنوان البارت', part.title);
          if(newTitle === null) return;
          const newContent = prompt('نص البارت', part.content);
          if(newContent === null) return;
          part.title = newTitle.trim() || part.title;
          part.content = newContent.trim() || part.content;
        }
        if(action === 'delete'){
          state.parts = state.parts.filter(p => p.id !== part.id);
        }
        renderPartsList();
        generatePreview();
      });
    });
    els.partsList.appendChild(item);
  });
}

function buildContentBlocks(){
  const blocks = [];
  const settings = getSettings();
  const isDialogue = line => settings.highlightDialogues && /^[\-–—"«]/.test(line.trim());
  const isQuote = line => settings.highlightQuotes && line.trim().split(/\s+/).length <= 16 && line.trim().length > 0 && !/^#+/.test(line.trim());

  state.parts.forEach((part) => {
    blocks.push({ type:'chapter', html:`<div class="chapter-title">${escapeHtml(part.title)}</div>` });
    const paragraphs = part.content
      .replace(/\r/g,'')
      .split(/\n\s*\n+/)
      .map(t => t.trim())
      .filter(Boolean);

    paragraphs.forEach(p => {
      if(/^#{1,6}\s+/.test(p)){
        blocks.push({ type:'subheading', html:`<h3>${escapeHtml(p.replace(/^#{1,6}\s+/,''))}</h3>` });
        return;
      }
      if(isDialogue(p)){
        blocks.push({ type:'paragraph', html:`<p class="dialogue">${escapeHtml(p)}</p>` });
        return;
      }
      if(isQuote(p)){
        blocks.push({ type:'paragraph', html:`<p class="quote">${escapeHtml(p)}</p>` });
        return;
      }
      blocks.push({ type:'paragraph', html:`<p>${escapeHtml(p)}</p>` });
    });
  });
  return blocks;
}

function getSettings(){
  return {
    title: els.bookTitle.value.trim() || 'بدون عنوان',
    author: els.bookAuthor.value.trim() || 'بدون مؤلف',
    description: els.bookDescription.value.trim(),
    dedication: els.bookDedication.value.trim(),
    rights: els.bookRights.value.trim(),
    showFrontMatter: els.showFrontMatter.checked,
    showPageNumbers: els.showPageNumbers.checked,
    font: els.fontSelect.value
  };
}

function createPageCard(innerHTML, pageNum=null, extraClass=''){
  const frag = els.pageTemplate.content.cloneNode(true);
  const article = frag.querySelector('.page-card');
  const sheet = frag.querySelector('.page-sheet');
  const inner = frag.querySelector('.page-inner');
  const num = frag.querySelector('.page-number');
  if(extraClass) sheet.classList.add(extraClass);
  inner.innerHTML = innerHTML;
  if(pageNum && els.showPageNumbers.checked) num.textContent = pageNum;
  else num.textContent = '';
  const btn = frag.querySelector('.download-page-btn');
  btn.addEventListener('click', async () => {
    await downloadSinglePage(sheet, pageNum || 'cover');
  });
  return frag;
}

function createFrontMatterPages(){
  const pages = [];
  const s = getSettings();
  if(state.coverDataUrl){
    pages.push({
      html: `
        <div class="cover-page">
          <img src="${state.coverDataUrl}" alt="cover">
          <div class="cover-overlay">
            <h1>${escapeHtml(s.title)}</h1>
            <p>${escapeHtml(s.author)}</p>
          </div>
        </div>
      `,
      rawType:'cover'
    });
  }
  pages.push({
    html: `
      <div class="title-page">
        <div>
          <h1>${escapeHtml(s.title)}</h1>
          <p class="meta">${escapeHtml(s.author)}</p>
        </div>
      </div>
    `,
    rawType:'title'
  });
  if(s.description){
    pages.push({
      html:`<div class="section-page"><div><h2>عن الكتاب</h2><p>${escapeHtml(s.description)}</p></div></div>`,
      rawType:'about'
    });
  }
  if(s.dedication){
    pages.push({
      html:`<div class="section-page"><div><h2>إهداء</h2><p>${escapeHtml(s.dedication)}</p></div></div>`,
      rawType:'dedication'
    });
  }
  if(s.rights){
    pages.push({
      html:`<div class="section-page"><div><h2>الحقوق</h2><p>${escapeHtml(s.rights)}</p></div></div>`,
      rawType:'rights'
    });
  }
  if(state.parts.length){
    const toc = state.parts.map((p,i)=>`<p>${i+1}. ${escapeHtml(p.title)}</p>`).join('');
    pages.push({
      html:`<div><h2 style="text-align:center">الفهرس</h2>${toc}</div>`,
      rawType:'toc'
    });
  }
  return pages;
}

function createMeasurePage(){
  const sheet = document.createElement('div');
  sheet.className = 'page-sheet';
  sheet.style.position = 'absolute';
  sheet.style.left = '-99999px';
  sheet.style.top = '0';
  const inner = document.createElement('div');
  inner.className = 'page-inner';
  sheet.appendChild(inner);
  els.measureRoot.appendChild(sheet);
  return { sheet, inner };
}

function paginateBlocks(blocks){
  const { sheet, inner } = createMeasurePage();
  const pages = [];
  let current = '';

  const maxHeight = inner.clientHeight;

  function fits(html){
    inner.innerHTML = html;
    return inner.scrollHeight <= maxHeight;
  }

  function pushCurrent(){
    if(current.trim()){
      pages.push({ html: current, rawType:'content' });
      current = '';
    }
  }

  for(const block of blocks){
    const candidate = current + block.html;
    if(!current || fits(candidate)){
      current = candidate;
    } else {
      pushCurrent();
      if(fits(block.html)){
        current = block.html;
      } else {
        // Split huge paragraph by sentences
        const text = block.html
          .replace(/<\/?p[^>]*>/g,'')
          .replace(/<\/?div[^>]*>/g,'')
          .replace(/<\/?h3[^>]*>/g,'');
        const sentences = text.split(/(?<=[\.\!\؟\!])\s+|(?<=،)\s+/u).filter(Boolean);
        let temp = '';
        const cls = block.html.includes('class="dialogue"') ? 'dialogue' : block.html.includes('class="quote"') ? 'quote' : '';
        for(const sentence of sentences){
          const wrapped = `<p ${cls ? `class="${cls}"` : ''}>${escapeHtml(sentence)}</p>`;
          if(!temp || fits(temp + wrapped)){
            temp += wrapped;
          } else {
            pages.push({ html: temp, rawType:'content' });
            temp = wrapped;
          }
        }
        current = temp;
      }
    }
  }
  pushCurrent();
  sheet.remove();
  return pages;
}

async function ensureAssetsReady(){
  try{ if(document.fonts?.ready) await document.fonts.ready; } catch {}
  const imgs = Array.from(els.previewWrapper.querySelectorAll('img'));
  await Promise.all(imgs.map(img => img.complete ? Promise.resolve() : new Promise(res => {
    img.onload = img.onerror = () => res();
  })));
}

async function generatePreview(){
  applyCustomVars();
  els.previewWrapper.innerHTML = '';
  const settings = getSettings();
  const pages = [];
  if(settings.showFrontMatter) pages.push(...createFrontMatterPages());
  pages.push(...paginateBlocks(buildContentBlocks()));
  state.pages = pages;

  pages.forEach((page, idx) => {
    const node = createPageCard(page.html, idx + 1, page.rawType === 'cover' ? 'cover-host' : '');
    els.previewWrapper.appendChild(node);
  });

  if(!pages.length){
    els.previewWrapper.innerHTML = `
      <div class="glass" style="padding:28px;text-align:center;max-width:700px">
        <h3>لا توجد صفحات للمعاينة بعد</h3>
        <p style="color:var(--muted)">أضف عنوانًا أو أجزاءً ليبدأ تكوين الكتاب.</p>
      </div>
    `;
  }
  setStatus(`عدد الصفحات: ${pages.length}`);
  await ensureAssetsReady();
}

async function downloadSinglePage(sheet, pageLabel){
  showLoading('تجهيز الصفحة', `جارٍ تجهيز الصفحة ${pageLabel}`);
  await ensureAssetsReady();
  const canvas = await html2canvas(sheet, { scale: 2, backgroundColor: null, useCORS: true });
  canvas.toBlob(blob => {
    saveAs(blob, `${slugify(els.bookTitle.value || 'book')}-page-${pageLabel}.png`);
    hideLoading();
  }, 'image/png');
}

async function exportPdf(){
  const sheets = Array.from(els.previewWrapper.querySelectorAll('.page-sheet'));
  if(!sheets.length) return alert('لا توجد صفحات لتصديرها.');
  showLoading('تجهيز PDF', 'جارٍ تحويل صفحات المعاينة نفسها إلى PDF');
  await ensureAssetsReady();
  const { jsPDF } = window.jspdf;
  let pdf = null;

  for(let i=0; i<sheets.length; i++){
    els.loadingDesc.textContent = `الصفحة ${i+1} من ${sheets.length}`;
    const canvas = await html2canvas(sheets[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const imgData = canvas.toDataURL('image/jpeg', 0.98);
    const widthPx = canvas.width;
    const heightPx = canvas.height;
    const mmPerPx = 0.264583;
    const widthMm = widthPx * mmPerPx;
    const heightMm = heightPx * mmPerPx;

    if(!pdf){
      pdf = new jsPDF({
        orientation: heightMm >= widthMm ? 'portrait' : 'landscape',
        unit: 'mm',
        format: [widthMm, heightMm]
      });
    } else {
      pdf.addPage([widthMm, heightMm], heightMm >= widthMm ? 'portrait' : 'landscape');
    }
    pdf.addImage(imgData, 'JPEG', 0, 0, widthMm, heightMm);
  }
  pdf.save(`${slugify(els.bookTitle.value || 'book')}.pdf`);
  hideLoading();
}

async function exportZipImages(){
  const sheets = Array.from(els.previewWrapper.querySelectorAll('.page-sheet'));
  if(!sheets.length) return alert('لا توجد صفحات.');
  showLoading('تجهيز ZIP', 'جارٍ جمع صفحات الكتاب كصور');
  await ensureAssetsReady();
  const zip = new JSZip();
  for(let i=0;i<sheets.length;i++){
    els.loadingDesc.textContent = `الصفحة ${i+1} من ${sheets.length}`;
    const canvas = await html2canvas(sheets[i], { scale: 2, backgroundColor: '#ffffff', useCORS: true });
    const data = canvas.toDataURL('image/png').split(',')[1];
    zip.file(`page-${String(i+1).padStart(3,'0')}.png`, data, { base64: true });
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  saveAs(blob, `${slugify(els.bookTitle.value || 'book')}-pages.zip`);
  hideLoading();
}

function exportTxt(){
  const s = getSettings();
  let text = `${s.title}\n${s.author}\n\n`;
  if(s.description) text += `الوصف:\n${s.description}\n\n`;
  state.parts.forEach((p, i) => {
    text += `${i+1}. ${p.title}\n\n${p.content}\n\n------------------------\n\n`;
  });
  const blob = new Blob([text], { type:'text/plain;charset=utf-8' });
  saveAs(blob, `${slugify(s.title)}.txt`);
}

function exportHtml(){
  const s = getSettings();
  const pageSheets = Array.from(els.previewWrapper.querySelectorAll('.page-sheet')).map(sheet => sheet.outerHTML).join('\n');
  const html = `<!doctype html>
<html lang="ar" dir="rtl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(s.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800&family=El+Messiri:wght@400;600;700&family=Lateef:wght@400;500;700&family=Markazi+Text:wght@400;500;600;700&family=Noto+Naskh+Arabic:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>${document.querySelector('style')?.textContent || ''}</style>
<link rel="stylesheet" href="styles.css">
</head>
<body style="padding:20px;background:${els.appBg.value}">
<div class="preview-wrapper single">${pageSheets}</div>
</body></html>`;
  const blob = new Blob([html], { type:'text/html;charset=utf-8' });
  saveAs(blob, `${slugify(s.title)}.html`);
}

function serializeProject(){
  return {
    meta: {
      title: els.bookTitle.value,
      author: els.bookAuthor.value,
      description: els.bookDescription.value,
      dedication: els.bookDedication.value,
      rights: els.bookRights.value
    },
    style: {
      theme: els.themeSelect.value,
      pageSize: els.pageSize.value,
      font: els.fontSelect.value,
      fontSize: els.fontSize.value,
      lineHeight: els.lineHeight.value,
      pagePadding: els.pagePadding.value,
      pageBg: els.pageBg.value,
      textColor: els.textColor.value,
      accentColor: els.accentColor.value,
      appBg: els.appBg.value,
      showFrontMatter: els.showFrontMatter.checked,
      showPageNumbers: els.showPageNumbers.checked,
      highlightDialogues: els.highlightDialogues.checked,
      highlightQuotes: els.highlightQuotes.checked
    },
    coverDataUrl: state.coverDataUrl,
    parts: state.parts
  };
}

function applyProject(data){
  const m = data.meta || {};
  const s = data.style || {};
  els.bookTitle.value = m.title || '';
  els.bookAuthor.value = m.author || '';
  els.bookDescription.value = m.description || '';
  els.bookDedication.value = m.dedication || '';
  els.bookRights.value = m.rights || '';
  els.themeSelect.value = s.theme || 'luxury-dark';
  els.pageSize.value = s.pageSize || 'a5';
  els.fontSelect.value = s.font || "'Amiri', serif";
  els.fontSize.value = s.fontSize || 20;
  els.lineHeight.value = s.lineHeight || 1.95;
  els.pagePadding.value = s.pagePadding || 44;
  els.pageBg.value = s.pageBg || '#f7f1e3';
  els.textColor.value = s.textColor || '#1b1511';
  els.accentColor.value = s.accentColor || '#b78b47';
  els.appBg.value = s.appBg || '#0e1118';
  els.showFrontMatter.checked = s.showFrontMatter ?? true;
  els.showPageNumbers.checked = s.showPageNumbers ?? true;
  els.highlightDialogues.checked = s.highlightDialogues ?? true;
  els.highlightQuotes.checked = s.highlightQuotes ?? true;
  state.coverDataUrl = data.coverDataUrl || '';
  state.parts = Array.isArray(data.parts) ? data.parts : [];
  applyThemePreset();
  renderPartsList();
  generatePreview();
}

function saveProjectLocal(){
  localStorage.setItem('bookforge-project', JSON.stringify(serializeProject()));
  alert('تم حفظ المشروع محليًا.');
}

function loadProjectLocal(){
  const raw = localStorage.getItem('bookforge-project');
  if(!raw) return alert('لا يوجد مشروع محفوظ.');
  applyProject(JSON.parse(raw));
}

async function importPartsFromFiles(){
  const files = Array.from(els.partsFiles.files || []);
  if(!files.length) return alert('اختر ملفات أولًا.');
  showLoading('استيراد الملفات', 'جارٍ قراءة الملفات...');
  for(const file of files){
    let text = '';
    if(file.name.toLowerCase().endsWith('.docx')) text = await parseDocx(file);
    else text = await readFileAsText(file);
    addPart(file.name.replace(/\.[^.]+$/, ''), text);
  }
  hideLoading();
}

function bindEvents(){
  els.addPartBtn.addEventListener('click', () => addPart(els.partTitle.value, els.partContent.value));
  els.clearPartsBtn.addEventListener('click', () => {
    if(confirm('حذف كل الأجزاء؟')){
      state.parts = [];
      renderPartsList();
      generatePreview();
    }
  });

  els.coverInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    state.coverDataUrl = await readFileAsDataURL(file);
    generatePreview();
  });

  els.importPartsBtn.addEventListener('click', importPartsFromFiles);
  els.applyThemeBtn.addEventListener('click', () => { applyThemePreset(); generatePreview(); });
  els.generatePreviewBtn.addEventListener('click', generatePreview);

  [
    els.bookTitle, els.bookAuthor, els.bookDescription, els.bookDedication, els.bookRights,
    els.pageSize, els.fontSelect, els.fontSize, els.lineHeight, els.pagePadding,
    els.pageBg, els.textColor, els.accentColor, els.appBg,
    els.showFrontMatter, els.showPageNumbers, els.highlightDialogues, els.highlightQuotes
  ].forEach(el => el.addEventListener('input', () => {
    applyCustomVars();
  }));

  els.previewSingleBtn.addEventListener('click', () => {
    state.previewMode = 'single';
    els.previewWrapper.classList.add('single');
    els.previewWrapper.classList.remove('spread');
    els.previewSingleBtn.classList.add('active');
    els.previewSpreadBtn.classList.remove('active');
  });
  els.previewSpreadBtn.addEventListener('click', () => {
    state.previewMode = 'spread';
    els.previewWrapper.classList.add('spread');
    els.previewWrapper.classList.remove('single');
    els.previewSpreadBtn.classList.add('active');
    els.previewSingleBtn.classList.remove('active');
  });

  els.saveProjectBtn.addEventListener('click', saveProjectLocal);
  els.loadProjectBtn.addEventListener('click', loadProjectLocal);
  els.exportProjectBtn.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(serializeProject(), null, 2)], { type:'application/json' });
    saveAs(blob, `${slugify(els.bookTitle.value || 'book')}-project.json`);
  });
  els.loadProjectBtn.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    els.projectFileInput.click();
  });
  els.projectFileInput.addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    if(!file) return;
    const text = await readFileAsText(file);
    applyProject(JSON.parse(text));
  });
  els.loadProjectBtn.title = 'نقرة عادية: من التخزين المحلي | ضغطة مطولة/يمين: من ملف JSON';

  els.downloadPdfBtn.addEventListener('click', exportPdf);
  els.downloadZipImagesBtn.addEventListener('click', exportZipImages);
  els.downloadTxtBtn.addEventListener('click', exportTxt);
  els.downloadHtmlBtn.addEventListener('click', exportHtml);
}

function seedDemo(){
  els.bookTitle.value = 'عنوان كتابك';
  els.bookAuthor.value = 'اسم المؤلف';
  els.bookDescription.value = 'يمكنك هنا كتابة وصف جميل للكتاب قبل تنزيله بصيغة PDF أو HTML أو كصور.';
  els.bookDedication.value = 'إلى كل من يحب الكتب المصممة بعناية.';
  els.bookRights.value = 'جميع الحقوق محفوظة.';
  renderPartsList();
  applyThemePreset();
  applyCustomVars();
  generatePreview();
}

bindEvents();
seedDemo();
