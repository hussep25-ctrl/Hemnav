// features.js — JARVIS 5.0 Features
// CV · Website · Documents · Image · Code · Files · Weather · News · Search
// © Ctrl Labs (Hussein & Claude)

'use strict';

// ── IMAGE GENERATION ─────────────────────────────────────────
const IMG_STYLE_ENHANCERS = {
  'realistic photo':  ', photorealistic, 8K, sharp focus, professional DSLR photography',
  'portrait photo':   ', professional portrait, studio lighting, shallow depth of field',
  'anime style':      ', anime art style, vibrant colors, Studio Ghibli quality',
  'oil painting':     ', oil on canvas, painterly brushstrokes, museum quality artwork',
  'watercolor':       ', watercolor painting, soft color washes, artistic',
  '3D render':        ', 3D render, octane render, cinematic lighting, ultra detailed',
  'pencil sketch':    ', detailed pencil sketch, graphite drawing, fine lines',
  'cyberpunk neon':   ', cyberpunk aesthetic, neon lights, rain reflections, futuristic',
  'minimalist flat':  ', minimalist flat design, clean vector art, simple shapes',
  'fantasy art':      ', epic fantasy art, dramatic lighting, highly detailed, magical',
};

window.generateImage = async function() {
  const prompt = $('imgPrompt')?.value.trim();
  if(!prompt) return showToast('Ange en beskrivning', 2000, 'error');
  const style   = $('imgStyle')?.value||'';
  const size    = $('imgSize')?.value||'1024x1024';
  const btn     = $('imgGenBtn');
  if(btn){ btn.disabled=true; btn.textContent='⏳ Genererar...'; }

  const enhancer   = IMG_STYLE_ENHANCERS[style] || (style ? `, ${style}` : '');
  const fullPrompt = prompt + enhancer + ', high quality, detailed';
  const [w,h]      = size.split('x');
  const seed       = Math.floor(Math.random()*9999999);

  try {
    const r = await fetch('/api/generate-image', {method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({prompt:fullPrompt,size,enhance:false})});
    if(r.ok) {
      const d = await r.json();
      if(d.url){ addToGallery(d.url, prompt, d.provider||'AI'); showToast('✅ Bild genererad!','success'); return; }
    }
  } catch(e){ console.warn('Image API fail:', e.message); }

  // Fallback: Pollinations
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${w||1024}&height=${h||1024}&nologo=true&enhance=true&model=flux&seed=${seed}`;
  addToGallery(url, prompt, 'Flux AI');
  showToast('✅ Bild genereras (laddar ~5 sek)', 3000, 'success');
  if(btn){ btn.disabled=false; btn.textContent='✨ Generera bild'; }
};

function addToGallery(url, prompt, provider) {
  const gallery = $('imgGallery'); if(!gallery) return;
  const card = document.createElement('div'); card.className='img-card';
  card.innerHTML=`
    <img src="${url}" alt="${esc(prompt)}" onclick="window.open(this.src,'_blank')" style="cursor:zoom-in" loading="lazy">
    <div class="img-card-footer">
      <div class="img-card-prompt">${esc(prompt)}</div>
      <a class="img-card-dl" href="${url}" download="jarvis-${Date.now()}.jpg" target="_blank">⬇</a>
    </div>`;
  gallery.insertBefore(card, gallery.firstChild);
}

window._doGenerateImage = async function(prompt) {
  const chat = $('chat'); if(!chat) return;
  const loadEl = document.createElement('div'); loadEl.className='msg-group';
  loadEl.innerHTML=`<div class="msg-av ai">J</div><div class="msg-content"><div class="msg-name">JARVIS</div><div class="bubble ai"><div class="loading-spinner"></div> Skapar bild: <em>${esc(prompt)}</em></div></div>`;
  chat.appendChild(loadEl); chat.scrollTop=chat.scrollHeight;

  const seed = Math.floor(Math.random()*9999999);
  const url  = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt+', high quality, detailed')}?width=1024&height=1024&nologo=true&model=flux&seed=${seed}`;

  try {
    const r = await fetch('/api/generate-image',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:prompt+', high quality',size:'1024x1024',enhance:true})});
    if(r.ok){ const d=await r.json(); if(d.url){ loadEl.remove(); renderImageInChat(d.url,prompt,d.provider||'AI'); return; } }
  } catch(e){}

  // Fallback
  loadEl.remove();
  renderImageInChat(url, prompt, 'Flux AI');
};

function renderImageInChat(url, prompt, provider) {
  const g = document.createElement('div'); g.className='msg-group';
  g.innerHTML=`
    <div class="msg-av ai">J</div>
    <div class="msg-content">
      <div class="msg-name">JARVIS · ${esc(provider)}</div>
      <div class="bubble ai" style="padding:10px">
        <img src="${url}" alt="${esc(prompt)}" style="max-width:100%;border-radius:10px;cursor:zoom-in;display:block" onclick="window.open(this.src,'_blank')" loading="lazy">
        <div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">
          <a href="${url}" download="jarvis-img.jpg" class="editor-btn" style="font-size:12px">⬇ Ladda ner</a>
          <button class="editor-btn" style="font-size:12px" onclick="window.open('${url}','_blank')">⤢ Öppna</button>
        </div>
      </div>
    </div>`;
  const chat=$('chat'); if(chat){chat.appendChild(g);chat.scrollTop=chat.scrollHeight;}
}

// ── CV BUILDER ────────────────────────────────────────────────
window.startCVBuilder = function() {
  window.switchToolTab('chat');
  const L = I18N[currentLang]||I18N.sv;
  const intros = {
    sv:`# 📄 CV-skapare\n\nBerätta om dig själv — namn, utbildning, erfarenhet, kompetenser.\n\n**Eller bifoga ett gammalt CV (📎)** så moderniserar jag det!`,
    en:`# 📄 CV Creator\n\nTell me about yourself — name, education, experience, skills.\n\n**Or attach an old CV (📎)** and I'll modernize it!`,
    ar:`# 📄 منشئ السيرة الذاتية\n\nأخبرني عن نفسك\n\n**أو أرفق سيرتك القديمة (📎)**`,
    fa:`# 📄 ساخت رزومه\n\nدرباره خودت بگو\n\n**یا رزومه قدیمی خود را پیوست کن (📎)**`,
  };
  renderMsg('assistant', intros[currentLang]||intros.sv, Date.now(), true);
  window._cvMode = true;
  const txt = $('txt');
  if(txt) txt.placeholder = 'نام، تحصیلات، تجربه... / Name, education, experience...';
  $('sendBtn').disabled = false;
};

window._generateCVPDF = async function(cvData, opts={}) {
  const chat = $('chat');
  const loadEl = document.createElement('div'); loadEl.className='msg-group';
  loadEl.innerHTML=`<div class="msg-av ai">J</div><div class="msg-content"><div class="msg-name">JARVIS · CV</div><div class="bubble ai"><div style="display:flex;align-items:center;gap:10px"><div class="loading-spinner"></div> Skapar professionellt CV... (15-30 sek)</div></div></div>`;
  chat.appendChild(loadEl); chat.scrollTop=chat.scrollHeight;

  try {
    const resp = await fetch('/api/cv', {method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({cvData, lang:currentLang||'sv', jobTitle:opts.jobTitle||'', updateFrom:opts.updateFrom||''})});
    if(!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error||'API error');
    const data = await resp.json();
    const html = data.html;
    if(!html||html.length<300) throw new Error('Tomt svar');

    loadEl.remove();
    window._lastCVHtml = html;
    window._cvMode = false;

    const g = document.createElement('div'); g.className='msg-group';
    g.innerHTML=`
      <div class="msg-av ai">J</div>
      <div class="msg-content">
        <div class="msg-name">JARVIS · CV ✨</div>
        <div class="bubble ai">
          <div style="font-size:17px;font-weight:700;margin-bottom:4px">✅ CV klart!</div>
          <div style="font-size:12px;color:var(--text3);margin-bottom:14px">${esc(data.provider||'')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            <button class="accent-btn" onclick="window._previewCV(this)">👁 Visa CV</button>
            <button class="accent-btn" style="background:#059669" onclick="window._printCV()">🖨️ Spara PDF</button>
            <button class="editor-btn" onclick="window._downloadCVHTML()">⬇️ HTML</button>
            <button class="editor-btn" onclick="window._openCVInEditor()">✏️ Redigera</button>
            <button class="editor-btn" onclick="window._improveCVDialog()">🔄 Förbättra</button>
          </div>
          <div style="font-size:12px;color:var(--text3);background:var(--bg3);padding:10px;border-radius:8px;line-height:1.7">
            <b>Spara som PDF:</b> Klicka 🖨️ → öppnas i nytt fönster → <b>Ctrl+P</b> → Spara som PDF
          </div>
          <div id="cvPreviewArea" style="margin-top:14px"></div>
        </div>
      </div>`;
    chat.appendChild(g); chat.scrollTop=chat.scrollHeight;
    setTimeout(()=>{ const btn=g.querySelector('[onclick*="_previewCV"]'); if(btn) window._previewCV(btn); }, 500);
    showToast('✅ CV genererat!', 2000, 'success');
  } catch(e) {
    loadEl.remove();
    renderMsg('assistant', '❌ CV misslyckades: '+e.message+'\n\nFörsök igen med mer info.', Date.now(), true);
  }
};

window._previewCV = function(btn) {
  const html = window._lastCVHtml; if(!html) return;
  const area = btn?.closest('.bubble')?.querySelector('#cvPreviewArea'); if(!area) return;
  if(area.innerHTML){ area.innerHTML=''; btn.textContent='👁 Visa CV'; return; }
  const blob = new Blob([html],{type:'text/html;charset=utf-8'});
  const url  = URL.createObjectURL(blob);
  area.innerHTML=`<div style="border:1px solid var(--border);border-radius:10px;overflow:hidden;margin-top:10px"><div style="background:var(--bg3);padding:8px 14px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border)"><span style="font-size:12px;color:var(--text2);font-weight:600">📄 CV Förhandsvisning</span><div style="display:flex;gap:6px"><button class="editor-btn small" onclick="window._printCV()">🖨️</button><button class="editor-btn small" onclick="window._downloadCVHTML()">⬇️</button></div></div><iframe src="${url}" style="width:100%;height:620px;border:none;background:white;display:block"></iframe></div>`;
  btn.textContent='✕ Stäng'; setTimeout(()=>URL.revokeObjectURL(url), 60000);
};
window._printCV = function() {
  const html=window._lastCVHtml; if(!html){showToast('Inget CV','error');return;}
  const w=window.open('','_blank','width=900,height=700');
  if(!w){showToast('⚠️ Tillåt popups','error');return;}
  w.document.open(); w.document.write(html); w.document.close();
  setTimeout(()=>{w.focus();w.print();},600);
};
window._downloadCVHTML = function() {
  const html=window._lastCVHtml; if(!html){showToast('Inget CV','error');return;}
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  a.download='mitt-cv-jarvis.html'; document.body.appendChild(a); a.click();
  setTimeout(()=>{document.body.removeChild(a);},1000);
  showToast('✅ CV nedladdat! Öppna i Chrome → Ctrl+P → PDF',5000,'success');
};
window._openCVInEditor = function() {
  const html=window._lastCVHtml; if(!html) return;
  window.editorContent={html,css:'',js:''};
  const ed=$('codeEditor'); if(ed){ed.value=html;window.updateLineNums?.();}
  window.switchToolTab('code');
  showToast('✏️ CV i kodredigeraren',1500,'success');
};
window._improveCVDialog = function() {
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML=`<div style="background:var(--bg2);border-radius:16px;padding:24px;max-width:480px;width:90%;border:1px solid var(--border)">
    <div style="font-size:17px;font-weight:700;margin-bottom:16px">🔄 Förbättra CV</div>
    <textarea id="cvUpdateInput" placeholder="Beskriv ändringen...\nEx: Lägg till ny tjänst som CTO\nEx: Anpassa för produktchef" style="width:100%;height:120px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;color:var(--text);font-size:13px;resize:vertical"></textarea>
    <input id="cvJobInput" placeholder="Jobbtitel att anpassa för (valfritt)" style="width:100%;margin-top:8px;padding:10px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;color:var(--text);font-size:13px">
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="accent-btn" style="flex:1" onclick="window._doImproveCV()">🚀 Uppdatera</button>
      <button class="editor-btn" onclick="this.closest('[style*=position]').remove()">Avbryt</button>
    </div></div>`;
  document.body.appendChild(ov); window._cvImproveOverlay=ov;
  ov.querySelector('#cvUpdateInput').focus();
};
window._doImproveCV = async function() {
  const input=$('cvUpdateInput')?.value?.trim();
  const jobTitle=$('cvJobInput')?.value?.trim();
  if(!input){showToast('Beskriv vad du vill ändra',2000,'error');return;}
  window._cvImproveOverlay?.remove();
  const chat=$('chat');
  renderMsg('user','🔄 Uppdaterar CV: '+input,null,true);
  await window._generateCVPDF(input,{jobTitle,updateFrom:window._lastCVHtml||''});
};

// ── DOCUMENT GENERATOR ────────────────────────────────────────
window.createDocument = function(type) {
  window.switchToolTab('chat');
  const labels={word:'📝 Word-dokument',ppt:'📊 Presentation',report:'📋 Rapport',letter:'✉️ Brev',proposal:'💼 Affärsförslag'};
  renderMsg('assistant',`# ${labels[type]||'📄 Dokument'}\n\nBeskriv vad du vill ha:\n- Ämne/titel\n- Innehåll\n- Ton (formell/informell)\n- Ungefärlig längd`, Date.now(), true);
  window._docMode=type;
  const txt=$('txt'); if(txt) txt.placeholder='Beskriv ditt dokument...';
  $('sendBtn').disabled=false;
};

window._generateDocument = async function(type, userInput, opts={}) {
  const chat=$('chat');
  const labels={word:'📝 Word',ppt:'📊 Presentation',report:'📋 Rapport',letter:'✉️ Brev',proposal:'💼 Affärsförslag',contract:'📜 Kontrakt',email:'📧 E-post',summary:'📄 Sammanfattning',translate:'🌐 Översättning',improve:'✨ Förbättring'};
  const label=labels[type]||'📄 Dokument';
  const load=document.createElement('div'); load.className='msg-group';
  load.innerHTML=`<div class="msg-av ai">J</div><div class="msg-content"><div class="msg-name">JARVIS</div><div class="bubble ai"><div style="display:flex;align-items:center;gap:10px"><div class="loading-spinner"></div> Skapar ${label}...</div></div></div>`;
  chat.appendChild(load); chat.scrollTop=chat.scrollHeight;

  try {
    const resp=await fetch('/api/document',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({type,content:userInput,lang:currentLang||'sv',tone:opts.tone||'formal',existingDoc:opts.existingDoc||'',instructions:opts.instructions||''})});
    if(!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error||'API error');
    const data=await resp.json();
    if(!data.html||data.html.length<200) throw new Error('Tomt svar');
    load.remove(); window._lastDocHtml=data.html; window._docMode=null;

    const g=document.createElement('div'); g.className='msg-group';
    g.innerHTML=`
      <div class="msg-av ai">J</div>
      <div class="msg-content">
        <div class="msg-name">JARVIS · ${label}</div>
        <div class="bubble ai">
          <div style="font-size:17px;font-weight:700;margin-bottom:14px">✅ ${label} klart!</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:14px">
            <button class="accent-btn" onclick="window._previewDoc(this)">👁 Visa</button>
            <button class="accent-btn" style="background:#059669" onclick="window._printDoc()">🖨️ PDF</button>
            <button class="editor-btn" onclick="window._downloadDoc()">⬇️ HTML</button>
          </div>
          <div id="docPreviewArea"></div>
        </div>
      </div>`;
    chat.appendChild(g); chat.scrollTop=chat.scrollHeight;
    setTimeout(()=>{ const b=g.querySelector('[onclick*="_previewDoc"]'); if(b) window._previewDoc(b); },500);
    showToast('✅ Dokument klart!',2000,'success');
  } catch(e) {
    load.remove();
    renderMsg('assistant','❌ '+e.message, Date.now(), true);
  }
};

window._previewDoc=function(btn){
  const html=window._lastDocHtml; if(!html) return;
  const area=btn?.closest('.bubble')?.querySelector('#docPreviewArea'); if(!area) return;
  if(area.innerHTML){area.innerHTML='';btn.textContent='👁 Visa';return;}
  const blob=new Blob([html],{type:'text/html;charset=utf-8'}),url=URL.createObjectURL(blob);
  area.innerHTML=`<iframe src="${url}" style="width:100%;height:580px;border:1px solid var(--border);border-radius:8px;background:white;margin-top:8px"></iframe>`;
  btn.textContent='✕ Stäng'; setTimeout(()=>URL.revokeObjectURL(url),60000);
};
window._printDoc=function(){
  const html=window._lastDocHtml; if(!html) return;
  const w=window.open('','_blank','width=900,height=700');
  if(!w){showToast('⚠️ Tillåt popups','error');return;}
  w.document.open();w.document.write(html);w.document.close();
  setTimeout(()=>{w.focus();w.print();},600);
};
window._downloadDoc=function(){
  const html=window._lastDocHtml; if(!html) return;
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html;charset=utf-8'}));
  a.download='jarvis-dokument.html'; a.click();
};

// ── WEBSITE BUILDER ───────────────────────────────────────────
window.buildWebsite = async function() {
  if(!isProUser){window.activatePro();return;}
  const name=($('websiteName')?.value||'Min Hemsida');
  const desc=$('websiteDesc')?.value.trim();
  if(!desc){showToast('Beskriv din hemsida','error');return;}
  const type=$('websiteType')?.value||'landing';
  const style=$('websiteStyle')?.value||'modern';
  const output=$('websiteOutput'),btn=$('websiteBuildBtn');
  if(output) output.innerHTML=`<div style="display:flex;align-items:center;gap:12px;padding:24px;color:var(--text2)"><div class="loading-spinner"></div><div><b>Bygger din hemsida...</b><div style="font-size:12px;margin-top:4px">JARVIS designar och kodar — 20-40 sekunder</div></div></div>`;
  if(btn){btn.disabled=true;btn.textContent='⏳ Bygger...';}

  try {
    const resp=await fetch('/api/website',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name,description:desc,type,style,lang:currentLang||'sv'})});
    if(!resp.ok) throw new Error((await resp.json().catch(()=>({}))).error||'API error');
    const data=await resp.json();
    if(!data.html||data.html.length<1000) throw new Error('Hemsida för kort');
    window._generatedWebsiteHtml=data.html;
    if(output){
      output.innerHTML=`
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 14px;background:var(--bg3);border-bottom:1px solid var(--border)">
          <span style="font-size:13px;color:var(--text2);font-weight:600">🌐 ${esc(name)} · ${esc(data.provider||'AI')}</span>
          <div style="display:flex;gap:8px">
            <button class="editor-btn small" onclick="window.open('','_blank').document.write(window._generatedWebsiteHtml)">⤢ Fullskärm</button>
            <button class="editor-btn small" onclick="window._editWebsiteDialog()">🔄 Uppdatera</button>
            <button class="editor-btn small accent" onclick="window.downloadWebsite()">⬇ Ladda ner</button>
            <button class="editor-btn small" onclick="window.editWebsiteInEditor()">✏️ Kod</button>
          </div>
        </div>
        <iframe id="websitePreview" style="width:100%;height:500px;border:none"></iframe>`;
      const fr=$('websitePreview'); if(fr) fr.srcdoc=data.html;
    }
    showToast('🌐 Hemsida byggd!','success');
  } catch(e) {
    if(output) output.innerHTML=`<div style="color:var(--red);padding:20px">❌ ${esc(e.message)}</div>`;
    showToast('Fel: '+e.message,3000,'error');
  } finally { if(btn){btn.disabled=false;btn.textContent='🌐 Bygg hemsida';} }
};

window.downloadWebsite=function(){
  const html=window._generatedWebsiteHtml||''; if(!html) return;
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([html],{type:'text/html'}));
  a.download='jarvis-website.html'; a.click();
  showToast('⬇ Hemsida nedladdad','success');
};
window.editWebsiteInEditor=function(){
  const html=window._generatedWebsiteHtml||''; if(!html) return;
  window.editorContent={html,css:'',js:''};
  const ed=$('codeEditor'); if(ed){ed.value=html;window.updateLineNums?.();}
  window.switchToolTab('code'); showToast('✏️ Öppnad i kodeditor');
};
window._editWebsiteDialog=function(){
  const ov=document.createElement('div');
  ov.style.cssText='position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:center;justify-content:center';
  ov.innerHTML=`<div style="background:var(--bg2);border-radius:16px;padding:24px;max-width:480px;width:90%;border:1px solid var(--border)">
    <div style="font-size:17px;font-weight:700;margin-bottom:16px">🔄 Uppdatera hemsida</div>
    <textarea id="websiteUpdateInput" placeholder="Beskriv vad du vill ändra..." style="width:100%;height:100px;background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:12px;color:var(--text);font-size:13px;resize:vertical"></textarea>
    <div style="display:flex;gap:8px;margin-top:14px">
      <button class="accent-btn" style="flex:1" onclick="window._doUpdateWebsite()">🚀 Uppdatera</button>
      <button class="editor-btn" onclick="this.closest('[style*=position]').remove()">Avbryt</button>
    </div></div>`;
  document.body.appendChild(ov); window._websiteUpdateOverlay=ov;
  ov.querySelector('#websiteUpdateInput').focus();
};
window._doUpdateWebsite=async function(){
  const instructions=$('websiteUpdateInput')?.value?.trim();
  if(!instructions){showToast('Beskriv vad du vill ändra',2000,'error');return;}
  window._websiteUpdateOverlay?.remove();
  const output=$('websiteOutput'),btn=$('websiteBuildBtn');
  if(output) output.innerHTML=`<div style="display:flex;align-items:center;gap:12px;padding:24px;color:var(--text2)"><div class="loading-spinner"></div> Uppdaterar...</div>`;
  try {
    const resp=await fetch('/api/website',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({name:$('websiteName')?.value||'Min Hemsida',description:instructions,lang:currentLang||'sv',updateFrom:window._generatedWebsiteHtml||'',updateInstructions:instructions})});
    const data=await resp.json();
    if(!data.html) throw new Error(data.error||'Tomt svar');
    window._generatedWebsiteHtml=data.html;
    if(output){
      output.innerHTML=`<div style="background:var(--bg3);padding:10px 14px;border-bottom:1px solid var(--border);font-size:13px;color:var(--text2)">🌐 Uppdaterad · <button class="editor-btn small" onclick="window.downloadWebsite()">⬇ Ladda ner</button></div><iframe id="websitePreview" style="width:100%;height:500px;border:none"></iframe>`;
      const fr=$('websitePreview'); if(fr) fr.srcdoc=data.html;
    }
    showToast('✅ Uppdaterad!',2000,'success');
  } catch(e){ if(output) output.innerHTML=`<div style="color:var(--red);padding:20px">❌ ${esc(e.message)}</div>`; }
};

// ── FILE HANDLING ─────────────────────────────────────────────
window.handleFile = async function(e) {
  const files=e.target.files; if(!files?.length) return; e.target.value='';
  for(const f of files) await window._processFile(f);
};

window._processFile = async function(file) {
  const name = file.name;
  const type = file.type;
  const preview = document.getElementById('imgPreview');

  // ── IMAGES ──
  if(type.startsWith('image/')) {
    const reader = new FileReader();
    reader.onload = e => {
      const b64 = e.target.result;
      window.pendingImages = window.pendingImages || [];
      window.pendingImages.push({name, base64: b64});
      if(preview) {
        const d = document.createElement('div');
        d.className = 'img-thumb';
        d.innerHTML = `<img src="${b64}" title="${name}" style="width:60px;height:60px;object-fit:cover;border-radius:8px"><button onclick="this.parentNode.remove();window.pendingImages=(window.pendingImages||[]).filter(p=>p.name!=='${name}')" style="position:absolute;top:-6px;right:-6px;background:#ef4444;color:white;border:none;border-radius:50%;width:18px;height:18px;cursor:pointer;font-size:11px;display:flex;align-items:center;justify-content:center">×</button>`;
        d.style.position = 'relative';
        preview.appendChild(d);
      }
      const sb = document.getElementById('sendBtn');
      if(sb) sb.disabled = false;
      window.showToast(`📸 ${name} klar`, 1500, 'success');
    };
    reader.readAsDataURL(file);
    return;
  }

  // ── PDFs ──
  if(type === 'application/pdf') {
    const loadDiv = document.createElement('div');
    loadDiv.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 12px;background:var(--bg3);border-radius:8px;font-size:12px;color:var(--text2);margin-bottom:4px';
    loadDiv.innerHTML = `<div class="loading-spinner" style="width:14px;height:14px;border-width:2px"></div> Läser ${name}...`;
    if(preview) preview.appendChild(loadDiv);

    try {
      const ab = await file.arrayBuffer();
      let text = '';
      let pages = 0;

      if(typeof pdfjsLib !== 'undefined') {
        try {
          const pdf = await pdfjsLib.getDocument({data: new Uint8Array(ab)}).promise;
          pages = pdf.numPages;
          text = `[PDF: ${name} — ${pages} sidor]\n\n`;
          for(let i = 1; i <= Math.min(pages, 50); i++) {
            const page = await pdf.getPage(i);
            const tc   = await page.getTextContent();
            const pt   = tc.items.map(s => s.str || '').join(' ').replace(/\s+/g,' ').trim();
            if(pt) text += `=== Sida ${i} ===\n${pt}\n\n`;
          }
        } catch(e) { console.warn('PDF.js error:', e); text = ''; }
      }

      loadDiv.remove();
      window.pendingDocs = window.pendingDocs || [];

      if(text.length > 100) {
        window.pendingDocs.push({name, text, type:'pdf', pages});
        addFileChip(name, '📄', pages + ' sidor', () => {
          window.pendingDocs = (window.pendingDocs||[]).filter(d=>d.name!==name);
        });
        const txt = document.getElementById('txt');
        if(txt) txt.placeholder = `Fråga om "${name}"...`;
      } else {
        // Base64 fallback
        const b64 = await fileToBase64(file);
        window.pendingDocs.push({name, base64:b64, mimeType:'application/pdf', type:'pdf-b64', text:`[PDF: ${name}]`});
        addFileChip(name, '📄', 'PDF', () => {
          window.pendingDocs = (window.pendingDocs||[]).filter(d=>d.name!==name);
        });
      }

      const sb = document.getElementById('sendBtn');
      if(sb) sb.disabled = false;
      window.showToast(`✅ ${name} inläst`, 2000, 'success');
    } catch(e) {
      loadDiv.remove();
      window.showToast(`❌ ${name}: ${e.message}`, 4000, 'error');
    }
    return;
  }

  // ── TEXT FILES (kod, markdown, json etc) ──
  const isText = type.startsWith('text/') || /\.(txt|md|json|xml|js|ts|jsx|tsx|py|html|css|sh|yaml|yml|sql|rb|go|rs|cpp|c|cs|php|swift)$/i.test(name);
  if(isText) {
    try {
      const text = await file.text();
      window.pendingDocs = window.pendingDocs || [];
      window.pendingDocs.push({name, text:`[FIL: ${name}]\n\n${text}`, type:'text'});
      addFileChip(name, getFileEmoji(name), name.split('.').pop().toUpperCase(), () => {
        window.pendingDocs = (window.pendingDocs||[]).filter(d=>d.name!==name);
      });
      const txt = document.getElementById('txt');
      if(txt) txt.placeholder = `Fråga om "${name}"...`;
      const sb = document.getElementById('sendBtn');
      if(sb) sb.disabled = false;
      window.showToast(`✅ ${name} klar`, 1500, 'success');
    } catch(e) { window.showToast('Kunde inte läsa: ' + name, 2000, 'error'); }
    return;
  }

  // ── WORD / EXCEL ──
  if(/\.(docx?|xlsx?|csv|ods|odt)$/i.test(name)) {
    try {
      const text = await file.text().catch(() => `[${name} bifogad]`);
      window.pendingDocs = window.pendingDocs || [];
      window.pendingDocs.push({name, text:`[DOKUMENT: ${name}]\n\n${text.substring(0,8000)}`, type:'doc'});
      addFileChip(name, getFileEmoji(name), name.split('.').pop().toUpperCase(), () => {
        window.pendingDocs = (window.pendingDocs||[]).filter(d=>d.name!==name);
      });
      const sb = document.getElementById('sendBtn');
      if(sb) sb.disabled = false;
      window.showToast(`✅ ${name} klar`, 1500, 'success');
    } catch(e) { window.showToast('Kunde inte läsa: ' + name, 2000, 'error'); }
    return;
  }

  window.showToast(`⚠️ Filtypen stöds inte: .${name.split('.').pop()}`, 3000, 'error');
};



// ── FILE HELPERS ──────────────────────────────────────────────
function addFileChip(name, emoji, label, onRemove) {
  const preview = document.getElementById('imgPreview');
  if(!preview) return;
  const chip = document.createElement('div');
  chip.className = 'file-chip';
  chip.style.cssText = 'display:inline-flex;align-items:center;gap:6px;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;font-size:13px;margin:2px';
  chip.innerHTML = `
    <span style="font-size:16px">${emoji}</span>
    <span style="max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text)">${esc(name)}</span>
    <span style="font-size:10px;color:var(--text3);background:var(--bg2);padding:2px 6px;border-radius:6px">${esc(label)}</span>
    <button style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px;padding:0 2px;line-height:1">×</button>`;
  chip.querySelector('button').onclick = () => { chip.remove(); if(onRemove) onRemove(); };
  preview.appendChild(chip);
}

function getFileEmoji(name) {
  const ext = (name.split('.').pop()||'').toLowerCase();
  const map = {pdf:'📄',doc:'📝',docx:'📝',txt:'📄',md:'📝',csv:'📊',xls:'📊',xlsx:'📊',
    js:'📜',ts:'📜',jsx:'📜',tsx:'📜',py:'🐍',html:'🌐',css:'🎨',json:'📋',xml:'📋',
    sql:'🗄️',sh:'⚙️',yaml:'📋',yml:'📋',go:'🐹',rs:'🦀',cpp:'⚙️',c:'⚙️',cs:'⚙️',php:'🐘',swift:'🦅',rb:'💎'};
  return map[ext] || '📎';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result.split(',')[1]);
    reader.onerror = () => reject(new Error('Kunde inte läsa filen'));
    reader.readAsDataURL(file);
  });
}

// ── WEATHER ───────────────────────────────────────────────────
window._fetchAndRenderWeather = async function(city='Stockholm') {
  const chat=$('chat'); if(!chat) return;
  const load=document.createElement('div'); load.className='msg-group';
  load.innerHTML=`<div class="msg-av ai">J</div><div class="msg-content"><div class="msg-name">JARVIS · Väder</div><div class="bubble ai" style="padding:16px"><div style="display:flex;align-items:center;gap:10px;color:var(--text2)"><div class="loading-spinner"></div> Hämtar väder för ${esc(city)}...</div></div></div>`;
  const chat2=$('chat');
  if(chat2&&!chat2.querySelector('.chat-spacer')){
    chat2.insertBefore(Object.assign(document.createElement('div'),{className:'chat-spacer'}),chat2.firstChild);
  }
  chat.appendChild(load); chat.scrollTop=chat.scrollHeight;
  try {
    const r=await fetch('/api/weather?city='+encodeURIComponent(city));
    if(!r.ok) throw new Error('Väder-API misslyckades');
    const w=await r.json(); if(w.error) throw new Error(w.error);
    load.remove();

    const WI={
      Clear:    {icon:'☀️', bg:'linear-gradient(135deg,#f59e0b,#ef4444)', label:'Klart'},
      Clouds:   {icon:'☁️', bg:'linear-gradient(135deg,#64748b,#475569)', label:'Molnigt'},
      Rain:     {icon:'🌧️', bg:'linear-gradient(135deg,#3b82f6,#1d4ed8)', label:'Regn'},
      Drizzle:  {icon:'🌦️', bg:'linear-gradient(135deg,#60a5fa,#3b82f6)', label:'Duggregn'},
      Snow:     {icon:'❄️', bg:'linear-gradient(135deg,#93c5fd,#bfdbfe)', label:'Snö'},
      Thunderstorm:{icon:'⛈️',bg:'linear-gradient(135deg,#374151,#111827)',label:'Åska'},
      Mist:     {icon:'🌫️', bg:'linear-gradient(135deg,#9ca3af,#6b7280)', label:'Dimma'},
      Fog:      {icon:'🌫️', bg:'linear-gradient(135deg,#9ca3af,#6b7280)', label:'Dimma'},
    };
    const wi = WI[w.main]||WI.Clear;

    const dayNames = ['Sön','Mån','Tis','Ons','Tor','Fre','Lör'];
    const forecastHTML = (w.forecast||[]).slice(0,6).map(f=>{
      const fwi = WI[f.main]||WI.Clear;
      return `<div style="display:flex;flex-direction:column;align-items:center;gap:4px;padding:10px 8px;background:rgba(255,255,255,0.1);border-radius:12px;min-width:52px">
        <div style="font-size:11px;font-weight:600;opacity:.8">${f.day}</div>
        <div style="font-size:22px">${fwi.icon}</div>
        <div style="font-size:13px;font-weight:700">${f.max}°</div>
        <div style="font-size:11px;opacity:.7">${f.min}°</div>
        <div style="font-size:10px;opacity:.6">💧${f.rain}%</div>
      </div>`;
    }).join('');

    const g=document.createElement('div'); g.className='msg-group';
    g.innerHTML=`
      <div class="msg-av ai">J</div>
      <div class="msg-content">
        <div class="msg-name">JARVIS · Väder</div>
        <div class="bubble ai" style="padding:0;overflow:hidden;background:none;border:none;box-shadow:none;max-width:420px">
          <div style="background:${wi.bg};border-radius:18px;overflow:hidden;color:white;box-shadow:0 8px 32px rgba(0,0,0,0.25)">

            <!-- Header -->
            <div style="padding:22px 22px 14px;position:relative">
              <div style="font-size:13px;opacity:.85;font-weight:500;margin-bottom:4px">📍 ${esc(w.city)}${w.country?', '+esc(w.country):''}</div>
              <div style="display:flex;align-items:flex-start;justify-content:space-between">
                <div>
                  <div style="font-size:64px;font-weight:800;line-height:1;margin:4px 0">${w.temp}°</div>
                  <div style="font-size:15px;opacity:.9;margin-top:4px">${esc(w.description||wi.label)}</div>
                  <div style="font-size:12px;opacity:.75;margin-top:3px">Känns som ${w.feels_like}°C</div>
                </div>
                <div style="font-size:72px;opacity:.9">${wi.icon}</div>
              </div>
            </div>

            <!-- Stats row -->
            <div style="display:flex;gap:0;border-top:1px solid rgba(255,255,255,0.2);border-bottom:1px solid rgba(255,255,255,0.2)">
              <div style="flex:1;padding:12px;text-align:center;border-right:1px solid rgba(255,255,255,0.15)">
                <div style="font-size:18px">💧</div>
                <div style="font-size:15px;font-weight:700;margin-top:2px">${w.humidity}%</div>
                <div style="font-size:10px;opacity:.7;margin-top:1px">Fuktighet</div>
              </div>
              <div style="flex:1;padding:12px;text-align:center;border-right:1px solid rgba(255,255,255,0.15)">
                <div style="font-size:18px">🌬️</div>
                <div style="font-size:15px;font-weight:700;margin-top:2px">${w.wind} km/h</div>
                <div style="font-size:10px;opacity:.7;margin-top:1px">Vind</div>
              </div>
              <div style="flex:1;padding:12px;text-align:center">
                <div style="font-size:18px">👁️</div>
                <div style="font-size:15px;font-weight:700;margin-top:2px">${wi.label}</div>
                <div style="font-size:10px;opacity:.7;margin-top:1px">Väder</div>
              </div>
            </div>

            <!-- Forecast -->
            ${forecastHTML ? `<div style="padding:14px 16px">
              <div style="font-size:11px;font-weight:600;opacity:.7;letter-spacing:1px;margin-bottom:10px;text-transform:uppercase">6-DAGARS PROGNOS</div>
              <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:4px">${forecastHTML}</div>
            </div>` : ''}

          </div>
          <!-- Search bar -->
          <div style="display:flex;gap:8px;margin-top:10px">
            <input id="weatherCityInput" placeholder="Sök annan stad..." value="${esc(w.city)}"
              style="flex:1;padding:8px 12px;background:var(--bg3);border:1px solid var(--border);border-radius:10px;color:var(--text);font-size:13px"
              onkeydown="if(event.key==='Enter')window._fetchAndRenderWeather(this.value)">
            <button class="accent-btn" style="padding:8px 14px;font-size:13px" onclick="window._fetchAndRenderWeather($('weatherCityInput').value||'Stockholm')">🔍</button>
          </div>
        </div>
      </div>`;
    chat.appendChild(g); chat.scrollTop=chat.scrollHeight;
  } catch(e) {
    load.remove();
    renderMsg('assistant','❌ Kunde inte hämta väder för "'+city+'". Försök med en annan stad.', Date.now(), true);
  }
};

// ── WEB SEARCH ────────────────────────────────────────────────
window.doWebSearch = async function() {
  const q=($('wsQuery')?.value||'').trim(); if(!q) return;
  const out=$('searchOutput'); if(out) out.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:20px;color:var(--text2)"><div class="loading-spinner"></div> Söker...</div>';
  try {
    const r=await fetch('/api/websearch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({query:q,lang:currentLang})});
    const d=await r.json();
    if(out){
      if(!d.results?.length){ out.innerHTML='<div style="color:var(--text3);padding:20px">Inga resultat</div>'; return; }
      out.innerHTML='<div class="search-results">'+d.results.map(r=>`<a href="${esc(r.url)}" target="_blank" class="sr-item"><div class="sr-title">${esc(r.title)}</div><div class="sr-url">${esc(r.url.substring(0,60))}</div><div class="sr-snippet">${esc(r.snippet||'')}</div></a>`).join('')+'</div>';
    }
  } catch(e){ if(out) out.innerHTML='<div style="color:var(--red);padding:20px">❌ '+esc(e.message)+'</div>'; }
};

window.quickWebSearch = async function(q) {
  window.switchToolTab('chat');
  renderMsg('user', q, null, true);
  const msgs=[{role:'system',content:getSystemPrompt()},{role:'user',content:q}];
  const reply=await sendStreaming(msgs);
  if(reply){memory.push({role:'user',content:q});memory.push({role:'assistant',content:reply});}
};

// ── NEWS ──────────────────────────────────────────────────────
window.loadNews = async function() {
  const out=$('newsOutput'); if(!out) return;
  out.innerHTML=`
    <div style="display:flex;align-items:center;gap:10px;padding:20px;color:var(--text2)">
      <div class="loading-spinner"></div>
      <span>Hämtar senaste nyheter...</span>
    </div>`;
  try {
    const r=await fetch('/api/news?lang='+currentLang);
    if(!r.ok) throw new Error('News API '+r.status);
    const d=await r.json();
    const items=d.items||[];
    if(!items.length){
      out.innerHTML='<div style="padding:20px;color:var(--text3);text-align:center">😕 Inga nyheter tillgängliga just nu</div>';
      return;
    }

    // Group by source
    const sources=[...new Set(items.map(i=>i.source))];
    const sourceColors={
      'SVT':'#1a56db','Aftonbladet':'#e11d48','Expressen':'#059669',
      'BBC':'#dc2626','Reuters':'#f59e0b','Al Jazeera':'#7c3aed',
    };

    out.innerHTML=`
      <div style="padding:14px 14px 6px;display:flex;align-items:center;justify-content:space-between">
        <div style="font-size:12px;color:var(--text3)">${items.length} nyheter · ${sources.join(', ')}</div>
        <button class="editor-btn" style="font-size:11px;padding:4px 10px" onclick="window.loadNews()">🔄 Uppdatera</button>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;padding:0 14px 14px">
        ${items.map((item,i)=>{
          const color=sourceColors[item.source]||'var(--accent)';
          const isFirst=i===0;
          return `<a href="${esc(item.link)}" target="_blank" rel="noopener"
            style="display:block;text-decoration:none;padding:${isFirst?'16px':'12px'};background:var(--bg3);border-radius:14px;border:1px solid var(--border);transition:all .2s;cursor:pointer"
            onmouseover="this.style.background='var(--bg4)';this.style.transform='translateY(-1px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,0.15)'"
            onmouseout="this.style.background='var(--bg3)';this.style.transform='';this.style.boxShadow=''">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
              <span style="font-size:10px;font-weight:700;letter-spacing:.5px;text-transform:uppercase;color:white;background:${color};padding:2px 8px;border-radius:999px">${esc(item.source)}</span>
              ${isFirst?'<span style="font-size:10px;background:#ef4444;color:white;padding:2px 8px;border-radius:999px;font-weight:700">🔴 LIVE</span>':''}
              <span style="font-size:10px;color:var(--text3);margin-left:auto">→</span>
            </div>
            <div style="font-size:${isFirst?'15':'13'}px;font-weight:${isFirst?'700':'600'};color:var(--text);line-height:1.4;margin-bottom:${item.description?'6px':'0'}">${esc(item.title)}</div>
            ${item.description?`<div style="font-size:12px;color:var(--text2);line-height:1.5">${esc(item.description.substring(0,150))}${item.description.length>150?'...':''}</div>`:''}
          </a>`;
        }).join('')}
      </div>`;
  } catch(e) {
    out.innerHTML=`<div style="padding:20px;color:var(--red);text-align:center">❌ Kunde inte hämta nyheter<br><span style="font-size:12px;color:var(--text3)">${esc(e.message)}</span></div>`;
  }
};

// ── CODE EDITOR ───────────────────────────────────────────────
window.editorContent={html:'',css:'',js:''};
window.editorLang='html';

window.updateLineNums = function() {
  const ed=$('codeEditor'),ln=$('lineNums'); if(!ed||!ln) return;
  const lines=ed.value.split('\n').length;
  ln.innerHTML=Array.from({length:lines},(_,i)=>i+1).join('\n');
};
window.switchEditorTab = function(lang) {
  window.editorContent[window.editorLang]=$('codeEditor')?.value||'';
  window.editorLang=lang;
  $$('.editor-tab').forEach(t=>t.classList.toggle('active',t.id==='ed'+lang.charAt(0).toUpperCase()+lang.slice(1)));
  const ed=$('codeEditor'); if(ed){ed.value=window.editorContent[lang]||'';window.updateLineNums();}
};
window.runCode = function() {
  const html=window.editorContent.html||$('codeEditor')?.value||'';
  const css=window.editorContent.css||'';
  const js=window.editorContent.js||'';
  const frame=$('codePreview'); if(!frame) return;
  const combined=html.includes('<html')?html:`<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>${js}<\/script></body></html>`;
  frame.srcdoc=combined;
};
window.downloadCode = function() {
  const lang=window.editorLang;
  const val=$('codeEditor')?.value||'';
  const ext={html:'html',css:'css',js:'js'}[lang]||'txt';
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([val],{type:'text/plain'}));
  a.download=`jarvis-code.${ext}`; a.click();
};

// ── ADMIN ────────────────────────────────────────────────────
window.openAdmin = function() {
  if(!ADMIN_EMAILS.includes(user?.email)) return;
  openModal('adminModal'); loadAdminData();
};
async function loadAdminData() {
  try {
    const usersSnap=await db.collection('users').limit(50).get();
    const users=usersSnap.docs.map(d=>({id:d.id,...d.data()}));
    const el=$('adminUserList');
    if(el) el.innerHTML=users.map(u=>`<div class="mem-item"><span>👤</span><div><div style="font-weight:600;font-size:13px">${esc(u.displayName||'?')}</div><div style="font-size:11px;color:var(--text3)">${esc(u.id)}</div></div></div>`).join('');
    const reqSnap=await db.collection('pro_requests').orderBy('time','desc').limit(20).get();
    const reqs=reqSnap.docs.map(d=>({id:d.id,...d.data()}));
    const rel=$('adminReqList');
    if(rel) rel.innerHTML=reqs.length?reqs.map(r=>`<div class="mem-item" style="flex-direction:column;align-items:flex-start;gap:4px"><div style="font-size:12px;font-weight:600">${esc(r.email||'?')}</div><div style="font-size:12px;color:var(--text2)">${esc(r.message||'')}</div><button class="editor-btn" style="font-size:11px;margin-top:4px" onclick="window.approveProRequest('${r.id}','${esc(r.email||'')}')">✅ Godkänn Pro</button></div>`).join(''):'<div style="font-size:13px;color:var(--text3)">Inga förfrågningar</div>';
  } catch(e) { console.error('Admin load:', e); }
}
window.approveProRequest = async function(id, email) {
  try {
    const snap=await db.collection('users').where('email','==',email).get();
    if(!snap.empty) {
      await db.collection('users').doc(snap.docs[0].id).update({isPro:true});
      showToast('✅ Pro aktiverat för '+email, 3000, 'success');
    }
  } catch(e) { showToast('Fel: '+e.message, 3000, 'error'); }
};

// ── INIT FEATURES ────────────────────────────────────────────
// Quick action buttons
window.quickNewsLoad = function() { window.switchToolTab('search'); window.loadNews?.(); };
window.quickWeather  = function() {
  window.switchToolTab('chat');
  window._fetchAndRenderWeather(window._userCity||'Stockholm');
};

// Auto-detect intent from message
window._autoDetectIntent = function(text) {
  const lower=text.toLowerCase();
  const intents=[
    {re:/\b(väder|weather|temperatur|regn|sol|prognos)\b/i, fn:()=>window._fetchAndRenderWeather(window._userCity||'Stockholm')},
    {re:/\b(nyheter|news|senaste nytt)\b/i,                  fn:()=>window.loadNews?.()},
    {re:/\b(cv|resumé|meritförteckning)\b/i,                 fn:()=>window.startCVBuilder()},
  ];
  // Only auto-trigger on very short messages (clear intent)
  if(text.split(' ').length <= 4) {
    for(const {re,fn} of intents) {
      if(re.test(lower)){ fn(); return true; }
    }
  }
  return false;
};
