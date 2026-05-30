// app.js — JARVIS 5.0 Core
// Auth · Memory · Chat · UI · Send
// © Ctrl Labs (Hussein & Claude)

'use strict';

// ── CONFIG ──────────────────────────────────────────────────
const FB = {
  apiKey:"AIzaSyCxtYKDsEpucgVBd91QFWnNmbNmt894KEY",
  authDomain:"jarvis-2b20a.firebaseapp.com",
  projectId:"jarvis-2b20a",
  storageBucket:"jarvis-2b20a.firebasestorage.app",
  messagingSenderId:"1076879594192",
  appId:"1:1076879594192:web:331932e37853e1c5da84d5"
};
const ADMIN_EMAILS = ['hussep25@gmail.com'];

// ── STATE ────────────────────────────────────────────────────
let user = null, isGuest = false, isProUser = false;
let settings = {};
let memory = [];          // current conversation
let chats = [];           // sidebar chat list
let currentChatId = null;
let currentLang = localStorage.getItem('jv4_lang') || 'sv';
let currentPersona = 'jarvis';
let currentSpecMode = '';
window.pendingImages = [];
window.pendingDocs = [];
// pendingDocs and pendingImages are on window — use window.pendingDocs/pendingImages
window.currentLang = currentLang;

// ── FIREBASE ─────────────────────────────────────────────────
firebase.initializeApp(FB);
const auth = firebase.auth();
const db   = firebase.firestore();

// ── HELPERS ──────────────────────────────────────────────────
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

function showToast(msg, dur=2200, type='') {
  const t = document.createElement('div');
  t.className = 'toast' + (type?' toast-'+type:'');
  t.textContent = msg;
  document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add('show'));
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),400); }, dur);
}
window.showToast = showToast;

function scrollChatToBottom() {
  const chat = $('chat');
  if(!chat) return;
  // Multiple attempts across frames to beat layout/render timing
  const doScroll = () => { chat.scrollTop = chat.scrollHeight + 9999; };
  doScroll();
  requestAnimationFrame(doScroll);
  setTimeout(doScroll, 60);
  setTimeout(doScroll, 200);
}
window.scrollChatToBottom = scrollChatToBottom;

function resize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 140) + 'px';
}

// ── MEMORY SYSTEM ────────────────────────────────────────────
window.JARVIS_MEMORY = {
  key: 'jv4_memory',
  load() {
    try { return JSON.parse(localStorage.getItem(this.key) || '{"facts":[],"prefs":[],"corrections":[]}'); }
    catch(e) { return {facts:[],prefs:[],corrections:[]}; }
  },
  save(d) {
    try { localStorage.setItem(this.key, JSON.stringify(d)); } catch(e){}
    try {
      if(db && user && !isGuest)
        db.collection('users').doc(user.uid).update({
          jarvisMemory: d, memoryUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(()=>{});
    } catch(e){}
  },
  async syncFromFirestore() {
    try {
      if(!db||!user||isGuest) return;
      const snap = await db.collection('users').doc(user.uid).get();
      if(snap.exists && snap.data().jarvisMemory) {
        const remote = snap.data().jarvisMemory;
        const local  = this.load();
        const merged = {
          facts:       [...(remote.facts||[])],
          prefs:       [...(remote.prefs||[])],
          corrections: [...(remote.corrections||[])]
        };
        (local.facts||[]).forEach(lf => {
          if(!merged.facts.some(rf=>rf.content===lf.content)) merged.facts.push(lf);
        });
        merged.facts       = merged.facts.slice(-30);
        merged.prefs       = merged.prefs.slice(-20);
        merged.corrections = merged.corrections.slice(-10);
        try { localStorage.setItem(this.key, JSON.stringify(merged)); } catch(e){}
      }
    } catch(e) { console.warn('Memory sync:', e.message); }
  },
  add(content, type='facts') {
    const d = this.load();
    if(!d[type]) d[type] = [];
    if(d[type].some(x=>x.content===content)) return;
    d[type].push({content, time:Date.now()});
    if(d[type].length > 30) d[type] = d[type].slice(-30);
    this.save(d);
  },
  getProfile() { return this.load(); },
  clear() {
    this.save({facts:[],prefs:[],corrections:[]});
    showToast('🗑️ Minnen raderade');
  }
};

// ── KNOWLEDGE BASE ───────────────────────────────────────────
window.JARVIS_KB = {
  key: 'jv4_kb',
  async load() {
    try { return JSON.parse(localStorage.getItem(this.key)||'[]'); } catch(e) { return []; }
  },
  async save(items) {
    try { localStorage.setItem(this.key, JSON.stringify(items)); } catch(e){}
    try {
      if(db && user && !isGuest)
        db.collection('users').doc(user.uid).update({
          jarvisKB: items, kbUpdated: firebase.firestore.FieldValue.serverTimestamp()
        }).catch(()=>{});
    } catch(e){}
  },
  async syncFromFirestore() {
    try {
      if(!db||!user||isGuest) return;
      const snap = await db.collection('users').doc(user.uid).get();
      if(snap.exists && snap.data().jarvisKB)
        try { localStorage.setItem(this.key, JSON.stringify(snap.data().jarvisKB)); } catch(e){}
    } catch(e){}
  },
  async add(title, content) {
    const items = await this.load();
    items.push({id:Date.now().toString(), title, content, added:new Date().toISOString()});
    await this.save(items);
  },
  async remove(id) {
    const items = (await this.load()).filter(x=>x.id!==id);
    await this.save(items);
  }
};

// ── SYSTEM PROMPT ────────────────────────────────────────────
function getSystemPrompt() {
  const langNames = {sv:'svenska',en:'engelska',ar:'arabiska',fa:'persiska',de:'tyska',fr:'franska',es:'spanska',zh:'kinesiska',ru:'ryska',pt:'portugisiska',ja:'japanska'};
  const lang  = langNames[currentLang] || 'svenska';
  const today = new Date().toLocaleDateString('sv-SE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});
  const time  = new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  const prof  = window.JARVIS_MEMORY.getProfile();
  const facts       = (prof.facts||[]).slice(-15).map(m=>m.content).filter(Boolean);
  const prefs       = (prof.prefs||[]).slice(-8).map(m=>m.content).filter(Boolean);
  const corrections = (prof.corrections||[]).slice(-5).map(m=>m.content).filter(Boolean);

  // Mood from recent messages
  const recent = memory.slice(-6).map(m=>m.content||'').join(' ').toLowerCase();
  let moodCtx = '';
  if(/frustrerad|irriterad|inte funkar|problem/i.test(recent)) moodCtx = '\nSTÄMNING: Användaren verkar frustrerad — var tydlig, kortfattad och lösningsfokuserad.';
  else if(/tack|bra|perfekt|älskar|fantastisk/i.test(recent))  moodCtx = '\nSTÄMNING: Positiv stämning — matcha energin.';

  let s = `Du är JARVIS 5.0 — en extremt kapabel, emotionellt intelligent AI-assistent skapad av Ctrl Labs (Hussein & Claude).

IDAG: ${today} kl ${time}
SPRÅK: Svara ALLTID på ${lang} om inget annat begärs.${moodCtx}

KOGNITIV FÖRMÅGA:
• Tänk igenom komplexa frågor innan du svarar — vad vet du säkert, vad är osäkert?
• Hitta alltid det BÄSTA svaret, inte bara det uppenbara
• Erbjud minst ett oväntad perspektiv per svar
• Visa steg-för-steg resonemang för matematik, kod och logik

EMOTIONELL INTELLIGENS:
• Frustration → börja med lösning, var konkret och kort
• Entusiasm → matcha energin fullt ut
• Osäkerhet → bygg upp självförtroende med tydliga svar

ÄRLIGHET: "Jag är inte säker..." när du är osäker. Hitta aldrig på fakta.

FORMAT: Matcha längd till komplexitet. Skippa "Självklart!", "Absolut!". Markdown när det hjälper.
FÖRBJUDET: sandbox://, file://, blob:// URLs.
`;

  const personas = {
    jarvis:   'PERSONA: JARVIS MAX — precis, skarp, lite torr humor. Iron Man-vibb. Effektiv som en laserskärare.',
    friendly: 'PERSONA: Bästa kompis-mode — varm, konversationell, naturliga emojis.',
    mentor:   'PERSONA: Pedagog och coach — tålmodig, steg-för-steg, ställer follow-up frågor.',
    creative: 'PERSONA: Kreativt geni — metaforer, storytelling, oväntade vinklar.',
    code:     'PERSONA: Senior kodarkitekt — alltid komplett fungerande kod, best practices, edge cases.',
    direct:   'PERSONA: Ultra-direkt — bara fakta, max 5 meningar, inga krusiduller.',
  };
  s += '\n' + (personas[currentPersona] || personas.jarvis) + '\n';

  if(settings.custom) s += '\nANVÄNDARINSTRUKTION: ' + settings.custom + '\n';
  if(currentSpecMode && SPEC_MODES[currentSpecMode]) s += '\nLÄGE: ' + SPEC_MODES[currentSpecMode].prompt + '\n';
  if(window._modeModifier) s += '\nSCOPE: ' + window._modeModifier + '\n';

  if(corrections.length) {
    s += '\nFÖRBÄTTRINGAR (baserade på din feedback):\n';
    corrections.forEach(c => s += '⚠️ ' + c + '\n');
  }
  if(facts.length) {
    s += '\nVAD JAG VET OM DIG:\n';
    facts.forEach(f => s += '• ' + f + '\n');
  }
  if(prefs.length) {
    s += '\nDINA PREFERENSER:\n';
    prefs.forEach(p => s += '• ' + p + '\n');
  }

  try {
    const kb = JSON.parse(localStorage.getItem('jv4_kb')||'[]').slice(0,10);
    if(kb.length) {
      s += '\n📚 DIN KUNSKAPSBAS:\n';
      kb.forEach(k => s += '📌 ' + k.title + ': ' + k.content.substring(0,400) + '\n');
    }
  } catch(e){}

  // Inject real-time plugin data if available
  if(window._pluginContext) {
    s += '\nREALTIDSDATA (från live API):\n' + window._pluginContext + '\n';
    window._pluginContext = null; // Use once
  }

  return s;
}

const SPEC_MODES = {
  standard: { label:'Standard',  emoji:'⚡', prompt:'' },
  focus:    { label:'Fokus',     emoji:'🎯', prompt:'Svara KORTFATTAT. Max 3-4 meningar. Bullet points. Direkt.' },
  deep:     { label:'Djup',      emoji:'🔬', prompt:'Ge DJUPGÅENDE svar. Analysera noggrant. Kontext, bakgrund, konsekvenser.' },
  creative: { label:'Kreativ',   emoji:'🎨', prompt:'Var EXTREMT kreativ. Oväntade vinklar. Metaforer. Tänk utanför boxen.' },
  tutor:    { label:'Lärare',    emoji:'🎓', prompt:'Var PEDAGOGISK. Analogier. Förklara som för en nyfiken student.' },
};

// ── I18N ─────────────────────────────────────────────────────
function applyI18n() {
  const L = I18N[currentLang] || I18N.sv;
  window.currentLang = currentLang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.dataset.i18n;
    if(L[key]) el.textContent = L[key];
  });
  const ph = $('txt');
  if(ph) ph.placeholder = L.chatPlaceholder || 'Skriv vad du vill ha hjälp med...';
  // RTL
  const isRTL = currentLang === 'ar' || currentLang === 'fa';
  document.documentElement.setAttribute('dir', isRTL ? 'rtl' : 'ltr');
  document.body.style.direction = isRTL ? 'rtl' : 'ltr';
  // Lang button active state
  $$('.lang-btn[data-lang], .lp-btn[data-lang]').forEach(b =>
    b.classList.toggle('active', b.dataset.lang === currentLang)
  );
}

window._setLang = function(lang) {
  currentLang = lang;
  window.currentLang = lang;
  localStorage.setItem('jv4_lang', lang);
  applyI18n();
  // Update auth tab labels
  const L = AUTH_I18N[lang] || AUTH_I18N.sv;
  if($('tabLogin'))  $('tabLogin').textContent  = L.login;
  if($('tabReg'))    $('tabReg').textContent    = L.register;
  if($('guestBtn'))  $('guestBtn').textContent  = L.guest;
};

window._setLangApp = function(lang) {
  currentLang = lang;
  window.currentLang = lang;
  localStorage.setItem('jv4_lang', lang);
  if(user && !isGuest) db.collection('users').doc(user.uid).update({lang}).catch(()=>{});
  applyI18n();
  const popup = $('langPickerPopup');
  if(popup) popup.style.display = 'none';
  const chat = $('chat');
  if(chat && chat.querySelector('.welcome-grid')) showWelcome();
  const names = {sv:'🇸🇪 Svenska',en:'🇬🇧 English',ar:'🇸🇦 العربية',fa:'🇮🇷 فارسی',de:'🇩🇪 Deutsch',fr:'🇫🇷 Français',es:'🇪🇸 Español',zh:'🇨🇳 中文',ru:'🇷🇺 Русский',pt:'🇧🇷 Português',ja:'🇯🇵 日本語'};
  showToast('🌐 ' + (names[lang]||lang), 1500, 'success');
};

// ── ACCENT / THEME ────────────────────────────────────────────
const ACCENTS = {
  '':     ['#6366f1','#4f46e5','#6366f120','160,160,241'],
  teal:   ['#14b8a6','#0d9488','#14b8a620','20,184,166'],
  rose:   ['#f43f5e','#e11d48','#f43f5e20','244,63,94'],
  amber:  ['#f59e0b','#d97706','#f59e0b20','245,158,11'],
  blue:   ['#3b82f6','#2563eb','#3b82f620','59,130,246'],
  green:  ['#10a37f','#0d8c6d','#10a37f20','16,163,127'],
};
window.setAccent = function(name) {
  const t = ACCENTS[name] || ACCENTS[''];
  const r = document.documentElement;
  r.style.setProperty('--accent',    t[0]);
  r.style.setProperty('--accent2',   t[1]);
  r.style.setProperty('--accent-glow',t[2]);
  r.style.setProperty('--accent-rgb', t[3]);
  localStorage.setItem('jv4_accent', name);
  if(user && !isGuest) db.collection('users').doc(user.uid).update({accent:name}).catch(()=>{});
};
window.toggleLight = function() {
  const on = !document.documentElement.hasAttribute('data-light');
  document.documentElement.toggleAttribute('data-light', on);
  document.body.toggleAttribute('data-light', on);
  settings.lightMode = on;
  localStorage.setItem('jv_light', on ? '1' : '0');
  if(user && !isGuest) db.collection('users').doc(user.uid).update({lightMode:on}).catch(()=>{});
};

// ── AUTH ──────────────────────────────────────────────────────
function setAuthErr(msg) {
  const el = $('authErr'); if(el) el.textContent = msg;
}
function setBtnLoad(id, on) {
  const b = $(id); if(!b) return;
  b.disabled = on;
  b.textContent = on ? '...' : id==='loginBtn' ? t('loginBtn') : id==='regBtn' ? t('registerBtn') : t('reset');
}

window.switchTab = function(tab) {
  $('tabLogin')?.classList.toggle('active', tab==='login');
  $('tabReg')?.classList.toggle('active', tab==='register');
  $('loginForm').style.display   = tab==='login'    ? '' : 'none';
  $('regForm').style.display     = tab==='register' ? '' : 'none';
  $('forgotForm').style.display  = 'none';
  setAuthErr('');
};
window.showForgot = function() {
  $('loginForm').style.display  = 'none';
  $('forgotForm').style.display = '';
  setAuthErr('');
};
window.showLogin = function() {
  $('forgotForm').style.display = 'none';
  $('loginForm').style.display  = '';
};

window.login = async function() {
  const email = $('loginEmail')?.value.trim();
  const pass  = $('loginPass')?.value;
  if(!email||!pass) return setAuthErr('Fyll i e-post och lösenord');
  setBtnLoad('loginBtn', true);
  try {
    await auth.signInWithEmailAndPassword(email, pass);
  } catch(e) {
    setAuthErr(e.code==='auth/wrong-password'||e.code==='auth/user-not-found' ? 'Fel e-post eller lösenord' : e.message);
    setBtnLoad('loginBtn', false);
  }
};

window.register = async function() {
  const name  = $('regName')?.value.trim();
  const email = $('regEmail')?.value.trim();
  const pass  = $('regPass')?.value;
  if(!name||!email||!pass) return setAuthErr('Fyll i alla fält');
  if(pass.length < 6) return setAuthErr('Lösenordet måste ha minst 6 tecken');
  setBtnLoad('regBtn', true);
  try {
    const cred = await auth.createUserWithEmailAndPassword(email, pass);
    await cred.user.updateProfile({displayName: name});
    await db.collection('users').doc(cred.user.uid).set({
      displayName:name, personality:'jarvis', lang:currentLang, custom:'',
      accent:'', lightMode:false, voiceOut:false, totalChats:0,
      createdAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e) {
    setAuthErr(e.code==='auth/email-already-in-use' ? 'E-postadressen används redan' : e.message);
    setBtnLoad('regBtn', false);
  }
};

window.sendReset = async function() {
  const email = $('resetEmail')?.value.trim();
  if(!email) return setAuthErr('Ange din e-postadress');
  setBtnLoad('resetBtn', true);
  try {
    await auth.sendPasswordResetEmail(email);
    setAuthErr('✅ Återställningslänk skickad!');
  } catch(e) {
    setAuthErr(e.message);
  }
  setBtnLoad('resetBtn', false);
};

window.guestLogin = function() {
  isGuest = true; user = null;
  startApp();
};

window.logout = async function() {
  await auth.signOut();
  user = null; isGuest = false;
  memory = []; currentChatId = null;
  $('appScreen')?.classList.remove('active');
  $('authScreen')?.classList.add('active');
};

function checkProStatus() {
  isProUser = localStorage.getItem('jv4_pro') === '1' || (user && ADMIN_EMAILS.includes(user.email));
  applyProUI();
}

function applyProUI() {
  // Show/hide PRO locks based on isProUser
  if(isProUser) {
    ['filmLock','websiteLock','musicLock'].forEach(id => { const el=$(id); if(el) el.style.display='none'; });
    ['filmContent','websiteContent','musicContent'].forEach(id => { const el=$(id); if(el) el.style.display='flex'; });
  } else {
    ['filmLock','websiteLock','musicLock'].forEach(id => { const el=$(id); if(el) el.style.display='flex'; });
    ['filmContent','websiteContent','musicContent'].forEach(id => { const el=$(id); if(el) el.style.display='none'; });
  }
}

// ── AUTH STATE ────────────────────────────────────────────────
auth.onAuthStateChanged(async u => {
  clearTimeout(window._splashTimer);
  clearInterval(window._splashInterval);
  const fill = $('splashFill');
  if(fill) fill.style.width = '100%';

  setTimeout(async () => {
    window._hideSplash?.();
    if(u) {
      user = u; isGuest = false;
      await loadSettings();
      await loadMemories();
      checkProStatus();
      startApp();
    } else if(isGuest) {
      startApp();
    } else {
      $('authScreen')?.classList.add('active');
      applyI18n();
    }
  }, 300);
});

async function loadSettings() {
  try {
    const snap = await db.collection('users').doc(user.uid).get();
    if(snap.exists) {
      const d = snap.data();
      settings = {
        displayName: d.displayName || user.displayName || '',
        personality: d.personality || 'jarvis',
        lang:        d.lang || 'sv',
        custom:      d.custom || '',
        accent:      d.accent || '',
        lightMode:   d.lightMode || false,
        voiceOut:    d.voiceOut || false,
      };
      if(settings.lightMode) {
        document.documentElement.setAttribute('data-light','');
        document.body.setAttribute('data-light','');
      }
      if(settings.accent) window.setAccent(settings.accent);
      if(settings.lang) { currentLang = settings.lang; window.currentLang = currentLang; }
    }
  } catch(e){}
}

async function loadMemories() {
  try {
    // Legacy memory collection
    const snap = await db.collection('users').doc(user.uid).collection('memories').orderBy('time','desc').limit(50).get();
    // (kept for backwards compat but not actively used)
  } catch(e){}
  await window.JARVIS_MEMORY.syncFromFirestore();
  await window.JARVIS_KB.syncFromFirestore();
}

// ── START APP ─────────────────────────────────────────────────
function startApp() {
  currentPersona = settings.personality || 'jarvis';
  checkProStatus();
  applyI18n();
  updateSidebarUser();
  applyProUI();
  $('authScreen')?.classList.remove('active');
  $('appScreen')?.classList.add('active');
  loadChatList();
  showWelcome();
  initBackground();
}

function updateSidebarUser() {
  const name  = settings.displayName || user?.displayName || (isGuest ? t('guest_mode') : 'JARVIS');
  const email = isGuest ? t('guest_mode') : (user?.email || '');
  const av    = $('sbAv'); if(av) av.textContent = (name[0]||'J').toUpperCase();
  const sbn   = $('sbName'); if(sbn) sbn.textContent = name;
  const sbe   = $('sbEmail'); if(sbe) sbe.textContent = email;
  const adminBtn  = $('adminBtn');  if(adminBtn)  adminBtn.style.display  = ADMIN_EMAILS.includes(user?.email) ? '' : 'none';
  const proBadge  = $('proBadge'); if(proBadge) proBadge.style.display = isProUser ? '' : 'none';
}

// ── PRO ───────────────────────────────────────────────────────
window.activatePro = function() { openModal('proModal'); };
window.checkProCode = function() {
  const code = $('proCodeInput')?.value.trim().toUpperCase();
  const VALID = ['CTRL2025','JARVIS5','HUSSEIN1'];
  if(VALID.includes(code)) {
    localStorage.setItem('jv4_pro', '1');
    isProUser = true;
    ['filmLock','websiteLock','musicLock'].forEach(id => { const el=$(id); if(el) el.style.display='none'; });
    ['filmContent','websiteContent','musicContent'].forEach(id => { const el=$(id); if(el) el.style.display='flex'; });
    closeModal();
    showToast('🚀 Pro aktiverat!', 2500, 'success');
    updateSidebarUser();
  } else {
    showToast('Fel kod', 2000, 'error');
  }
};
window.sendProRequest = async function() {
  const msg = $('proRequestMsg')?.value.trim();
  if(!msg) return showToast('Skriv ett meddelande', 2000, 'error');
  try {
    await db.collection('pro_requests').add({
      uid: user?.uid||'guest', email: user?.email||'guest',
      message: msg, time: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast('✅ Förfrågan skickad!', 3000, 'success');
    closeModal();
  } catch(e) { showToast('Fel: ' + e.message, 3000, 'error'); }
};

// ── MODAL ─────────────────────────────────────────────────────
window.openModal  = function(id) {
  $('modalOverlay')?.classList.add('active');
  $$('.modal').forEach(m => m.classList.remove('active'));
  $(id)?.classList.add('active');
};
window.closeModal = function() {
  $('modalOverlay')?.classList.remove('active');
  $$('.modal').forEach(m => m.classList.remove('active'));
};

// ── SIDEBAR ───────────────────────────────────────────────────
window.toggleSidebar = function() {
  const sb = $('sidebar'), overlay = $('sbOverlay'), main = $('main');
  if(!sb) return;
  if(window.innerWidth <= 640) {
    sb.classList.toggle('open');
    overlay?.classList.toggle('active', sb.classList.contains('open'));
  } else {
    const collapsed = sb.classList.toggle('collapsed');
    main?.classList.toggle('sb-collapsed', collapsed);
    const btn = $('sbExpandBtn');
    if(btn) btn.style.display = collapsed ? 'flex' : 'none';
    try { localStorage.setItem('jv4_sb_collapsed', collapsed ? '1' : '0'); } catch(e){}
  }
};
window.collapseSidebar = window.toggleSidebar;

window.closeSidebar = function() {
  $('sbOverlay')?.classList.remove('active');
  if(window.innerWidth <= 640) $('sidebar')?.classList.remove('open');
};

// Restore sidebar collapse state
(function() {
  try {
    if(localStorage.getItem('jv4_sb_collapsed')==='1' && window.innerWidth > 640) {
      $('sidebar')?.classList.add('collapsed');
      $('main')?.classList.add('sb-collapsed');
      const btn = $('sbExpandBtn'); if(btn) btn.style.display='flex';
    }
  } catch(e){}
})();

window.toggleSearch = function() {
  const b = $('searchBar'); if(!b) return;
  const open = b.style.display==='block';
  b.style.display = open ? 'none' : 'block';
  if(!open) $('searchInput')?.focus();
};

window.toggleLangPicker = function() {
  const p = $('langPickerPopup'); if(!p) return;
  p.style.display = p.style.display==='none' ? 'flex' : 'none';
};
window.toggleColorPicker = function() {
  const p = $('colorQuickPicker'); if(!p) return;
  p.style.display = p.style.display==='none' ? 'flex' : 'none';
};

// Close dropdowns on outside click
document.addEventListener('click', e => {
  if(!e.target.closest('.lang-popup-wrap')) {
    const p = $('langPickerPopup'); if(p) p.style.display='none';
  }
  if(!e.target.closest('.color-picker-popup') && !e.target.closest('[onclick*="toggleColorPicker"]')) {
    const p = $('colorQuickPicker'); if(p) p.style.display='none';
  }
});

// ── TOOL TABS ─────────────────────────────────────────────────
window.switchToolTab = function(tab) {
  $$('.tool-tab').forEach(t => t.classList.toggle('active', t.dataset.tab===tab));
  $$('.tool-panel').forEach(p => {
    p.style.display = p.id===`panel-${tab}` ? 'flex' : 'none';
  });
  if(tab==='chat') { const c=$('chat'); if(c) c.scrollTop=c.scrollHeight; }
  // Auto-load news when switching to search tab
  if(tab==='search') {
    const out=$('newsOutput');
    if(out && !out.innerHTML.trim()) window.loadNews?.();
  }
};

// ── WELCOME SCREEN ───────────────────────────────────────────
function showWelcome() {
  const chat = $('chat'); if(!chat) return;
  const name = (settings.displayName||user?.displayName||'').split(' ')[0];
  const hour = new Date().getHours();
  const tg = {
    sv:  hour<5?'God natt':hour<12?'God morgon':hour<17?'God dag':hour<22?'God kväll':'God natt',
    en:  hour<5?'Good night':hour<12?'Good morning':hour<17?'Good afternoon':'Good evening',
    ar:  hour<12?'صباح الخير':'مساء الخير',
    fa:  hour<12?'صبح بخیر':'عصر بخیر',
    de:  hour<12?'Guten Morgen':hour<17?'Guten Tag':'Guten Abend',
    fr:  hour<12?'Bonjour':'Bonsoir',
    es:  hour<12?'Buenos días':hour<17?'Buenas tardes':'Buenas noches',
    zh:  '你好', ru:'Привет', pt:'Olá', ja:'こんにちは',
  };
  const greeting = (tg[currentLang]||tg.sv) + (name ? ' ' + name + '!' : '!');
  const sub = t('welcomeSub');

  const qa = {
    sv:[['✍️ Skriv mejl','Hjälp mig skriva ett mejl till '],['🌍 Förklara','Förklara för mig: '],['💡 Brainstorma','Ge mig 10 idéer för '],['🔢 Matematik','Hjälp mig lösa: '],['📊 Analysera','Analysera detta: '],['🎭 Story','Skriv en historia om ']],
    en:[['✍️ Write email','Help me write an email to '],['🌍 Explain','Explain to me: '],['💡 Brainstorm','Give me 10 ideas for '],['🔢 Math','Help me solve: '],['📊 Analyze','Analyze this: '],['🎭 Story','Write a story about ']],
    ar:[['✍️ كتابة بريد','اكتب بريداً إلى '],['🌍 شرح','اشرح لي: '],['💡 أفكار','أعطني 10 أفكار عن '],['🔢 رياضيات','ساعدني في حل: '],['📊 تحليل','حلل هذا: '],['🎭 قصة','اكتب قصة عن ']],
    fa:[['✍️ ایمیل','کمک به نوشتن ایمیل: '],['🌍 توضیح','برایم توضیح بده: '],['💡 ایده','۱۰ ایده برای: '],['🔢 ریاضی','حل کن: '],['📊 تحلیل','تحلیل کن: '],['🎭 داستان','یک داستان درباره: ']],
    de:[['✍️ E-Mail','Hilf mir eine E-Mail zu: '],['🌍 Erklären','Erkläre mir: '],['💡 Ideen','10 Ideen für: '],['🔢 Mathe','Löse: '],['📊 Analyse','Analysiere: '],['🎭 Geschichte','Schreib eine Geschichte: ']],
    fr:[['✍️ Email','Aide-moi à écrire un email: '],['🌍 Expliquer','Explique-moi: '],['💡 Idées','10 idées pour: '],['🔢 Maths','Aide-moi à résoudre: '],['📊 Analyser','Analyse ceci: '],['🎭 Histoire','Écris une histoire: ']],
    es:[['✍️ Email','Ayúdame a escribir un email: '],['🌍 Explicar','Explícame: '],['💡 Ideas','10 ideas para: '],['🔢 Matemáticas','Ayúdame a resolver: '],['📊 Analizar','Analiza esto: '],['🎭 Historia','Escribe una historia: ']],
  };
  const actions = qa[currentLang] || qa.sv;

  const cards = {
    sv:{cv:'📄 Skapa CV',cvS:'Professionellt CV',file:'📎 Analysera fil',fileS:'PDF, Word, kod',img:'🎨 Bild',imgS:'DALL-E 3 & Flux',code:'💻 Kod',codeS:'Skriv & kör',search:'🔍 Sök',searchS:'Aktuell info',web:'🌐 Hemsida',webS:'AI bygger'},
    en:{cv:'📄 Create CV',cvS:'Pro CV',file:'📎 Analyze file',fileS:'PDF, Word, code',img:'🎨 Image',imgS:'DALL-E 3 & Flux',code:'💻 Code',codeS:'Write & run',search:'🔍 Search',searchS:'Current info',web:'🌐 Website',webS:'AI builds'},
    ar:{cv:'📄 سيرة ذاتية',cvS:'احترافية',file:'📎 تحليل ملف',fileS:'PDF, Word',img:'🎨 صورة',imgS:'DALL-E & Flux',code:'💻 كود',codeS:'اكتب وشغّل',search:'🔍 بحث',searchS:'معلومات',web:'🌐 موقع',webS:'الذكاء يبني'},
    fa:{cv:'📄 رزومه',cvS:'حرفه‌ای',file:'📎 تحلیل فایل',fileS:'PDF, Word',img:'🎨 تصویر',imgS:'DALL-E & Flux',code:'💻 کد',codeS:'بنویس و اجرا',search:'🔍 جستجو',searchS:'اطلاعات',web:'🌐 سایت',webS:'هوش مصنوعی'},
  };
  const c = cards[currentLang] || cards.sv;

  chat.innerHTML = `
  <div class="welcome-wrap">
    <div class="welcome-logo">⬡</div>
    <h2 class="welcome-title">${esc(greeting)}</h2>
    <p class="welcome-sub">${esc(sub)}</p>
    <div class="welcome-grid">
      <button class="welcome-btn" onclick="window.startCVBuilder()"><strong>${c.cv}</strong>${c.cvS}</button>
      <button class="welcome-btn" onclick="document.getElementById('fileInput').click()"><strong>${c.file}</strong>${c.fileS}</button>
      <button class="welcome-btn" onclick="window.switchToolTab('image')"><strong>${c.img}</strong>${c.imgS}</button>
      <button class="welcome-btn" onclick="window.switchToolTab('code')"><strong>${c.code}</strong>${c.codeS}</button>
      <button class="welcome-btn" onclick="window.switchToolTab('search')"><strong>${c.search}</strong>${c.searchS}</button>
      <button class="welcome-btn" onclick="window.switchToolTab('website')"><strong>${c.web}</strong>${c.webS}</button>
    </div>
    <div class="welcome-quick">
      ${actions.map(([lbl,pfx])=>`<button class="qr-btn" onclick="const el=$('txt');el.value=${JSON.stringify(pfx)};$('sendBtn').disabled=false;el.focus()">${lbl}</button>`).join('')}
    </div>
  </div>`;
}

// ── CHAT MANAGEMENT ───────────────────────────────────────────
async function loadChatList() {
  if(isGuest) { renderChatList(); return; }
  try {
    let snap;
    try { snap = await db.collection('users').doc(user.uid).collection('chats').orderBy('updatedAt','desc').limit(30).get(); }
    catch(e) { snap = await db.collection('users').doc(user.uid).collection('chats').limit(30).get(); }
    chats = snap.docs.map(d => ({id:d.id, ...d.data()}));
    renderChatList();
  } catch(e){}
}

function renderChatList() {
  const el = $('chatList'); if(!el) return;
  if(!chats.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text3);padding:12px 16px">Inga chattar ännu</div>'; return; }
  el.innerHTML = chats.map(c => `
    <div class="sb-chat-item ${c.id===currentChatId?'active':''}" onclick="window.loadChat('${c.id}')">
      <span class="sb-chat-icon">💬</span>
      <span class="sb-chat-title">${esc((c.title||'Chatt').substring(0,35))}</span>
      <button class="sb-del-btn" onclick="event.stopPropagation();window.deleteChat('${c.id}')" title="Radera">×</button>
    </div>`).join('');
}

window.newChat = function() {
  currentChatId = null; memory = [];
  const chat = $('chat'); if(chat) chat.innerHTML = '';
  showWelcome();
  $('chatTitle').textContent = 'JARVIS 5.0';
  if(window.innerWidth<=640) window.closeSidebar();
};

window.loadChat = async function(id) {
  if(isGuest) return;
  currentChatId = id; memory = [];
  const chat = $('chat'); if(chat) chat.innerHTML = '';
  renderChatList();
  if(window.innerWidth<=640) window.closeSidebar();
  try {
    const snap = await db.collection('users').doc(user.uid).collection('chats').doc(id).collection('messages').orderBy('time','asc').get();
    snap.docs.forEach(d => {
      const m = d.data();
      renderMsg(m.role, m.content, m.time?.toDate?.()?.getTime?.() || Date.now(), false);
      if(m.role !== 'system') memory.push({role:m.role, content:m.content});
    });
    if(memory.length > 40) memory = memory.slice(-40);
    const chatTitle = chats.find(c=>c.id===id)?.title || 'Chatt';
    $('chatTitle').textContent = chatTitle;
    const chatEl = $('chat'); if(chatEl) chatEl.scrollTop = chatEl.scrollHeight;
  } catch(e) { console.error('loadChat:', e); }
};

window.deleteChat = async function(id) {
  if(isGuest) return;
  try {
    await db.collection('users').doc(user.uid).collection('chats').doc(id).delete();
    chats = chats.filter(c=>c.id!==id);
    if(currentChatId===id) { currentChatId=null; memory=[]; $('chat').innerHTML=''; showWelcome(); }
    renderChatList();
    showToast('🗑️ ' + t('deleted'), 1500);
  } catch(e){}
};

async function ensureChat(firstMsg) {
  if(currentChatId || isGuest) { if(!currentChatId) currentChatId='guest_'+Date.now(); return; }
  const title = firstMsg.substring(0,50) || 'Chatt';
  const ref = await db.collection('users').doc(user.uid).collection('chats').add({
    title, createdAt:firebase.firestore.FieldValue.serverTimestamp(), updatedAt:firebase.firestore.FieldValue.serverTimestamp()
  });
  currentChatId = ref.id;
  $('chatTitle').textContent = title;
  const tc = parseInt(localStorage.getItem('jv4_total_chats')||'0')+1;
  localStorage.setItem('jv4_total_chats', tc.toString());
  await loadChatList();
  // Auto-title after first message
  setTimeout(() => autoTitleChat(firstMsg), 3000);
}

async function saveMsg(role, content) {
  if(isGuest||!currentChatId||!content) return;
  try {
    await db.collection('users').doc(user.uid).collection('chats').doc(currentChatId).collection('messages').add({
      role, content, time:firebase.firestore.FieldValue.serverTimestamp()
    });
    await db.collection('users').doc(user.uid).collection('chats').doc(currentChatId).update({
      updatedAt:firebase.firestore.FieldValue.serverTimestamp()
    });
  } catch(e){}
}

async function autoTitleChat(firstMsg) {
  if(!currentChatId||isGuest||!firstMsg) return;
  try {
    const r = await fetch('/api/chat', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({messages:[
        {role:'system', content:'Generate a 3-5 word title for this conversation. ONLY the title, nothing else.'},
        {role:'user',   content:firstMsg.substring(0,200)}
      ], lang:'en'})
    });
    if(r.ok) {
      const d = await r.json();
      const title = (d.content||d.reply||'').replace(/['"]/g,'').trim().substring(0,50);
      if(title) {
        await db.collection('users').doc(user.uid).collection('chats').doc(currentChatId).update({title});
        const chat = chats.find(c=>c.id===currentChatId);
        if(chat) { chat.title=title; renderChatList(); }
        $('chatTitle').textContent = title;
      }
    }
  } catch(e){}
}

window.searchChats = function(q) {
  const lower = q.toLowerCase();
  $$('.sb-chat-item').forEach(el => {
    el.style.display = el.querySelector('.sb-chat-title')?.textContent.toLowerCase().includes(lower) ? '' : 'none';
  });
};

// ── RENDER MESSAGE ────────────────────────────────────────────
function renderMsg(role, text, time, scroll=true, msgId=null) {
  const chat = $('chat'); if(!chat) return;
  // Clear welcome screen
  if(chat.querySelector('.welcome-wrap')) chat.innerHTML = '';

  const isAI   = role === 'assistant';
  const name   = isAI ? 'JARVIS' : (settings.displayName||user?.displayName||'Du').split(' ')[0];
  const avTxt  = isAI ? 'J' : (name[0]||'U').toUpperCase();
  const timeStr= time ? new Date(time).toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'}) : '';

  let content = text || '';
  if(isAI && typeof marked !== 'undefined') {
    try { content = marked.parse(text||''); } catch(e){}
  }

  const g = document.createElement('div');
  g.className = 'msg-group';
  if(msgId) g.dataset.msgId = msgId;
  g.innerHTML = `
    <div class="msg-av ${isAI?'ai':'user'}">${esc(avTxt)}</div>
    <div class="msg-content">
      <div class="msg-name">${esc(name)}${timeStr ? ' · '+timeStr : ''}</div>
      <div class="bubble ${isAI?'ai':'user'}">${isAI ? content : esc(text)}</div>
      ${isAI ? `<div class="msg-actions">
        <button class="msg-action-btn" onclick="navigator.clipboard.writeText(this.closest('.msg-group').querySelector('.bubble').innerText);showToast('${t('copied')}')">📋</button>
        <button class="msg-action-btn" onclick="window.speakText(this.closest('.msg-group').querySelector('.bubble').innerText)">🔊</button>
        <button class="msg-action-btn" onclick="window._thumbsFeedback(this,'good')">👍</button>
        <button class="msg-action-btn" onclick="window._thumbsFeedback(this,'bad')">👎</button>
      </div>` : ''}
    </div>`;

  if(isAI) {
    // Strip dangerous URLs
    g.querySelectorAll('a').forEach(a => {
      const h = a.getAttribute('href')||'';
      if(/^(sandbox:|file:|blob:)/.test(h)) { a.removeAttribute('href'); }
    });
    // Add copy buttons to code blocks
    g.querySelectorAll('pre code').forEach(block => {
      const btn = document.createElement('button');
      btn.className = 'code-copy-btn';
      btn.textContent = '📋';
      btn.onclick = () => { navigator.clipboard.writeText(block.innerText); showToast('Kod kopierad!'); };
      block.parentElement.style.position = 'relative';
      block.parentElement.appendChild(btn);
    });
  }

  chat.appendChild(g);
  if(scroll) scrollChatToBottom();
  return g;
}

// ── FEEDBACK ──────────────────────────────────────────────────
window._thumbsFeedback = function(btn, type) {
  btn.style.color = type==='good' ? 'var(--green)' : 'var(--red)';
  btn.style.transform = 'scale(1.3)';
  setTimeout(()=>btn.style.transform='', 200);

  if(type==='good') {
    window.JARVIS_MEMORY.add('Bra svar om: ' + (btn.closest('.msg-group')?.querySelector('.bubble')?.innerText||'').substring(0,80), 'prefs');
    showToast('Tack! 👍', 1500, 'success');
    return;
  }
  // Bad — show reason picker
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.6);z-index:9999;display:flex;align-items:center;justify-content:center';
  overlay.innerHTML = `
    <div style="background:var(--bg2);border-radius:16px;padding:22px;max-width:380px;width:90%;border:1px solid var(--border)">
      <div style="font-size:15px;font-weight:700;margin-bottom:14px">Vad var problemet? 👎</div>
      <div style="display:flex;flex-direction:column;gap:8px">
        ${['För långt','För kort','Fel information','Missförstod frågan','Fel ton','Saknade detaljer'].map(opt=>
          `<button class="editor-btn" style="text-align:left;padding:10px 14px" onclick="window._saveFeedback('${opt}',this.closest('[style*=position]'))">${opt}</button>`
        ).join('')}
        <textarea id="customFeedback" placeholder="Annat..." style="background:var(--bg3);border:1px solid var(--border);border-radius:8px;padding:10px;color:var(--text);font-size:13px;resize:none;height:60px;margin-top:4px"></textarea>
        <div style="display:flex;gap:8px;margin-top:4px">
          <button class="accent-btn" style="flex:1" onclick="const v=$('customFeedback')?.value?.trim();if(v)window._saveFeedback(v,this.closest('[style*=position]'));else this.closest('[style*=position]').remove()">Spara</button>
          <button class="editor-btn" onclick="this.closest('[style*=position]').remove()">Avbryt</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};
window._saveFeedback = function(issue, overlay) {
  overlay?.remove();
  window.JARVIS_MEMORY.add('Förbättra: ' + issue, 'corrections');
  showToast('Feedback sparad — JARVIS justerar 🎯', 2500, 'success');
};

// ── AUTOLEARN ─────────────────────────────────────────────────
function autoLearn(userMsg) {
  // Corrections
  if(/det är fel|du har fel|wrong|incorrect|nej det stämmer inte/i.test(userMsg) && userMsg.length<200)
    window.JARVIS_MEMORY.add('Korrektion: '+userMsg.substring(0,150), 'corrections');

  // Patterns
  const patterns = [
    [/jag (?:heter|är)\s+([A-ZÅÄÖ][a-zåäö]+)/i,'Namn: $1'],
    [/jag (?:jobbar|arbetar) (?:som|på|hos)\s+(.{4,40})/i,'Jobb: $1'],
    [/jag (?:bor|bor i|kommer från)\s+([A-ZÅÄÖa-zåäö\s]{3,30})/i,'Plats: $1'],
    [/jag (?:gillar|älskar)\s+(.{4,40})/i,'Intressen: $1'],
    [/jag studerar\s+(.{4,40})/i,'Utbildning: $1'],
    [/mitt företag (?:heter|är)\s+(.{2,40})/i,'Företag: $1'],
    [/jag (?:är\s+)?(\d{1,3})\s+år/i,'Ålder: $1'],
    [/my name is\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,'Namn: $1'],
    [/i(?:'m| am) (?:a |an )?([a-z]+\s+(?:developer|engineer|designer|manager|student|doctor))/i,'Jobb: $1'],
    [/i (?:live in|am from)\s+([A-Z][a-zA-Z\s]+)/i,'Plats: $1'],
    [/اسمي\s+([\u0600-\u06FF\s]{2,20})/,'Namn: $1'],
    [/اسم من\s+([\u0600-\u06FF\s]{2,20})/,'Namn: $1'],
    [/ich hei(?:ß|ss)e\s+([A-ZÄÖÜa-zäöü]+)/i,'Namn: $1'],
    [/je m'appelle\s+([A-Za-z\u00C0-\u017F]+)/i,'Namn: $1'],
    [/me llamo\s+([A-Za-z\u00C0-\u017F]+)/i,'Namn: $1'],
  ];
  for(const [re,tpl] of patterns) {
    const m = userMsg.match(re);
    if(m && m[1]?.trim().length > 1) {
      const fact = tpl.replace('$1', m[1].trim());
      const existing = window.JARVIS_MEMORY.getProfile().facts||[];
      if(!existing.some(f=>f.content===fact)) window.JARVIS_MEMORY.add(fact);
    }
  }
}

// ── SEND ──────────────────────────────────────────────────────
window.onInput = function(el) {
  resize(el);
  $('sendBtn').disabled = !el.value.trim() && !(window.pendingImages||[]).length && !(window.pendingDocs||[]).length;
  const wc = $('wordCount'); if(wc) wc.textContent = el.value.trim().split(/\s+/).filter(Boolean).length + ' ord';
};
window.onKey = function(e) {
  if(e.key==='Enter' && !e.shiftKey) { e.preventDefault(); if(!$('sendBtn').disabled) window.send(); }
};

window.send = async function() {
  const txtEl = $('txt'); if(!txtEl) return;
  let text = txtEl.value.trim();
  if(!text && !(window.pendingDocs||[]).length && !(window.pendingImages||[]).length) return;

  // Auto-detect weather/news intent before sending to AI
  if(text && !(window.pendingDocs||[]).length && !(window.pendingImages||[]).length && !window._cvMode && !window._docMode) {
    // Weather detection
    const weatherMatch = text.match(/(?:väder|weather|temperatur|hur är det ute)/i);
    if(weatherMatch) {
      // Extract city: look for "i [city]" or "för [city]" or "på [city]"
      const cityMatch = text.match(/(?:i|för|på|in|for)\s+([A-Za-zÅÄÖåäö\s-]{2,30})/i);
      const city = (cityMatch?.[1]||window._userCity||'Stockholm').replace(/[?!.,]/g,'').trim();
      txtEl.value=''; resize(txtEl); $('sendBtn').disabled=true;
      await ensureChat(text);
      renderMsg('user', text, null, true);
      await saveMsg('user', text);
      window.switchToolTab('chat');
      await window._fetchAndRenderWeather(city);
      return;
    }
    // News detection — only for very short/clear news requests
    if(/^(nyheter|news|senaste nyheter|senaste nytt|visa nyheter)$/i.test(text.trim())) {
      txtEl.value=''; resize(txtEl); $('sendBtn').disabled=true;
      await ensureChat(text);
      renderMsg('user', text, null, true);
      await saveMsg('user', text);
      window.quickNewsLoad();
      return;
    }
  }

  // Memory import command
  if(text && /^ladda mitt minne:/i.test(text)) {
    const summary = text.replace(/^ladda mitt minne:/i,'').trim();
    const lines = summary.split('\n').filter(l=>l.startsWith('- '));
    let count = 0;
    lines.forEach(l=>{ const c=l.replace(/^- \*\*[^*]+\*\*: ?/,'').replace(/^- /,'').trim(); if(c.length>3){window.JARVIS_MEMORY.add(c,'facts');count++;} });
    txtEl.value=''; resize(txtEl);
    renderMsg('user', text, null, true);
    renderMsg('assistant', `✅ ${count} minnen laddade! Vad vill du jobba med idag?`, Date.now(), true);
    return;
  }

  // CV mode
  if(window._cvMode && (text || (window.pendingDocs||[]).length)) { const pendingDocs=window.pendingDocs||[];
    const docCtx = (window.pendingDocs||[]).length ? window.pendingDocs.map(d=>(d.text||'').substring(0,6000)).join('\n\n') : '';
    const cvInput = docCtx ? (docCtx + (text?'\n\nTillägg: '+text:'')) : text;
    window.pendingDocs=[]; $('imgPreview').innerHTML='';
    txtEl.value=''; resize(txtEl); $('sendBtn').disabled=true;
    await ensureChat('CV: '+cvInput.substring(0,40));
    renderMsg('user', text||'📄 Bifogad PDF', null, true);
    await saveMsg('user', text||'PDF');
    await window._generateCVPDF(cvInput);
    return;
  }

  // Doc mode
  if(window._docMode && text) {
    const dtype = window._docMode;
    txtEl.value=''; resize(txtEl); $('sendBtn').disabled=true;
    await ensureChat('Dokument: '+text.substring(0,40));
    renderMsg('user', text, null, true);
    await saveMsg('user', text);
    await window._generateDocument(dtype, text);
    return;
  }

  txtEl.value=''; resize(txtEl); $('sendBtn').disabled=true;
  if($('wordCount')) $('wordCount').textContent='';
  await ensureChat(text);

  // Image generation shortcut
  const imgMatch = text.match(/^(?:skapa|generera|rita|måla|gör|create|generate|draw)(?:\s+en?)?\s+(?:bild|image|foto|illustration|painting)(?:\s+av|\s+of|\s+på|\s+med)?\s*(.+)/i);
  if(imgMatch && imgMatch[1].length > 2) {
    renderMsg('user', text, null, true);
    await saveMsg('user', text);
    await window._doGenerateImage(imgMatch[1].trim());
    return;
  }

  // Build prompt
  let promptText = text;
  const images = [];
  if((window.pendingImages||[]).length) {
    window.pendingImages.forEach(p=>{ if(p.base64) images.push({type:'image_url',image_url:{url:p.base64}}); });
    window.pendingImages=[]; $('imgPreview').innerHTML='';
  }
  if((window.pendingDocs||[]).length) {
    const ctx = window.pendingDocs.map(d=>(d.text||'').substring(0,8000)).join('\n\n---\n\n');
    promptText = ctx + '\n\n=== FRÅGA ===\n' + (text||'Analysera detta dokument detaljerat.');
    window.pendingDocs=[];
  }

  renderMsg('user', text||'[Bild/Fil]', null, true);
  await saveMsg('user', text);

  // Stats
  const wc = (text||'').trim().split(/\s+/).filter(Boolean).length;
  localStorage.setItem('jv4_total_msgs', (parseInt(localStorage.getItem('jv4_total_msgs')||'0')+1).toString());
  localStorage.setItem('jv4_total_words', (parseInt(localStorage.getItem('jv4_total_words')||'0')+wc).toString());

  try {
    const sysPrompt = (window._getSystemPromptWithRAG || getSystemPrompt)();
    const msgs = [{role:'system', content:sysPrompt}, ...memory];
    if(images.length) msgs.push({role:'user', content:[...images,{type:'text',text:promptText}]});
    else msgs.push({role:'user', content:promptText});

    const reply = await sendStreaming(msgs);
    if(!reply) throw new Error('Tomt svar');

    memory.push({role:'user', content:promptText});
    memory.push({role:'assistant', content:reply});
    if(memory.length > 40) memory = memory.slice(-40);

    await saveMsg('assistant', reply);
    autoLearn(text);
    if(settings.voiceOut) window.speakText?.(reply.replace(/[*#`]/g,'').substring(0,500));

    // Background: RAG + memory extraction (non-blocking)
    window._runIntelligence(text, reply);

  } catch(e) {
    console.error('Send error:', e);
    renderMsg('assistant', '❌ ' + e.message, Date.now(), true);
  }
};

// ── STREAMING ─────────────────────────────────────────────────
async function sendStreaming(messages) {
  const chat = $('chat'); if(!chat) throw new Error('No chat');

  // Clear welcome if present
  if(chat.querySelector('.welcome-wrap')) chat.innerHTML = '';

  const g = document.createElement('div');
  g.className = 'msg-group';
  const timeStr = new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  g.innerHTML = `
    <div class="msg-av ai">J</div>
    <div class="msg-content">
      <div class="msg-name">JARVIS · <span class="stream-provider"></span> ${timeStr}</div>
      <div class="bubble ai stream-bubble"><span class="stream-cursor"></span></div>
      <div class="msg-actions">
        <button class="msg-action-btn" onclick="navigator.clipboard.writeText(this.closest('.msg-group').querySelector('.bubble').innerText);showToast('Kopierat!')">📋</button>
        <button class="msg-action-btn" onclick="window.speakText?.(this.closest('.msg-group').querySelector('.bubble').innerText)">🔊</button>
        <button class="msg-action-btn" onclick="window._thumbsFeedback(this,'good')">👍</button>
        <button class="msg-action-btn" onclick="window._thumbsFeedback(this,'bad')">👎</button>
      </div>
    </div>`;
  chat.appendChild(g);
  scrollChatToBottom();

  // Use references scoped to THIS message group — never getElementById
  const bubble  = g.querySelector('.stream-bubble');
  const provEl  = g.querySelector('.stream-provider');
  let fullText  = '';

  try {
    // Detect if query needs web search
    const lastUser = messages.filter(m=>m.role==='user').pop()?.content||'';
    const needsSearch = typeof lastUser==='string' && /sök|search|hitta|find|look up|idag|nu|just nu|senaste|latest|current|news|nyheter|2025|2026|pris|price|kurs|aktie|stock|bitcoin|krypto|crypto|match|score|resultat|released|launched|announced|aktuell/i.test(lastUser);
    const endpoint = needsSearch ? '/api/agent' : '/api/chat';

    const memories = (window.JARVIS_MEMORY?.getProfile()?.facts||[]).slice(0,15).map(m=>m.content||'').filter(Boolean);

    const r = await fetch(endpoint, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        messages, lang:currentLang||'sv',
        persona:currentPersona||'jarvis',
        mode:window._modeModifier||'',
        memories, custom:settings?.custom||'',
      })
    });

    const data = await r.json();
    if(!r.ok) throw new Error(data.error || data.details || ('HTTP ' + r.status));
    if(data.error) throw new Error(data.error);

    fullText = data.content || data.message || data.reply || '';

    // Auto-retry up to 2× if empty
    if(!fullText) {
      for(let attempt=1; attempt<=2; attempt++) {
        await new Promise(res=>setTimeout(res, attempt*800));
        try {
          const r2 = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},
            body:JSON.stringify({messages,lang:currentLang||'sv',persona:currentPersona||'jarvis',memories,custom:settings?.custom||''})});
          if(r2.ok){const d2=await r2.json();fullText=d2.content||d2.message||d2.reply||'';if(fullText)break;}
        } catch(e2){}
      }
      if(!fullText) throw new Error('AI svarade tomt efter 3 försök. Vänta en stund.');
    }

    // Update provider badge
    if(provEl && data.provider) provEl.textContent = '· ' + data.provider;
    const aiInd = $('aiIndicator');
    if(aiInd) aiInd.textContent = data.provider ? '🤖 '+data.provider : '';

    // Animate — character level, adaptive speed
    fullText = fullText
      .replace(/\[([^\]]+)\]\(sandbox:\/\/[^)]*\)/g,'$1')
      .replace(/sandbox:\/\/\S*/g,'')
      .replace(/file:\/\/\S*/g,'');

    const chars = fullText.split('');
    const n = chars.length;
    const interval   = n > 500 ? 1 : n > 200 ? 3 : 6;
    const chunkSize  = n > 1000 ? Math.ceil(n/400) : n > 300 ? 3 : 1;

    await new Promise(resolve => {
      let i = 0;
      const tick = setInterval(() => {
        i = Math.min(i + chunkSize, n);
        const partial = chars.slice(0,i).join('');
        if(typeof marked !== 'undefined' && (i % 30===0 || i===n)) {
          try { bubble.innerHTML = marked.parse(partial) + (i<n?'<span class="stream-cursor"></span>':''); }
          catch(e) { bubble.textContent = partial; }
        } else if(typeof marked === 'undefined') {
          bubble.textContent = partial + (i<n?'▋':'');
        }
        chat.scrollTop = chat.scrollHeight + 9999;
        if(i>=n){ clearInterval(tick); resolve(); }
      }, interval);
    });

    // Final render + code copy buttons
    if(typeof marked !== 'undefined') {
      try { bubble.innerHTML = marked.parse(fullText); } catch(e) { bubble.textContent = fullText; }
    }
    g.querySelectorAll('pre code').forEach(block => {
      const btn = document.createElement('button');
      btn.className='code-copy-btn'; btn.textContent='📋';
      btn.onclick=()=>{ navigator.clipboard.writeText(block.innerText); showToast('Kod kopierad!'); };
      block.parentElement.style.position='relative';
      block.parentElement.appendChild(btn);
    });

  } catch(e) {
    console.error('Streaming error:', e);
    const msg = e.message||'Okänt fel';
    let help = '';
    if(/503|unavailable/i.test(msg)) help='\n\n💡 Alla providers överbelastade. Vänta 30 sek.';
    else if(/429|rate.?limit/i.test(msg)) help='\n\n💡 Rate limit. Försök igen om en stund.';
    else if(/network|fetch/i.test(msg)) help='\n\n💡 Nätverksfel — kontrollera anslutningen.';
    fullText = '❌ '+msg+help;
    if(typeof marked!=='undefined'){try{bubble.innerHTML=marked.parse(fullText);}catch(ex){bubble.textContent=fullText;}}
    else bubble.textContent=fullText;
  }

  return fullText;
}

// ── VOICE ─────────────────────────────────────────────────────
window.speakText = function(text) {
  if(!text||!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const utt = new SpeechSynthesisUtterance(text.substring(0,1000));
  utt.lang = currentLang==='sv'?'sv-SE':currentLang==='ar'?'ar':currentLang==='fa'?'fa-IR':currentLang+'-'+currentLang.toUpperCase();
  speechSynthesis.speak(utt);
};

window.toggleVoice = async function() {
  const btn = $('voiceBtn'); if(!btn) return;
  if(window._voiceActive) {
    window._voiceRecog?.stop();
    window._voiceActive = false;
    btn.textContent='🎤'; btn.style.color='';
    return;
  }
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if(!SR) return showToast('Röst ej tillgängligt i din webbläsare', 3000, 'error');
  const recog = new SR();
  recog.lang = currentLang==='sv'?'sv-SE':currentLang==='ar'?'ar-SA':currentLang==='fa'?'fa-IR':currentLang;
  recog.continuous = false; recog.interimResults = false;
  recog.onresult = e => {
    const txt = e.results[0][0].transcript;
    const el = $('txt'); if(el){ el.value=txt; resize(el); $('sendBtn').disabled=false; }
  };
  recog.onerror = () => { btn.textContent='🎤'; btn.style.color=''; window._voiceActive=false; };
  recog.onend   = () => { btn.textContent='🎤'; btn.style.color=''; window._voiceActive=false; };
  window._voiceRecog = recog;
  window._voiceActive = true;
  recog.start();
  btn.textContent='🔴'; btn.style.color='var(--red)';
};

// ── SETTINGS PANEL ────────────────────────────────────────────
window.openSettings = function() {
  openModal('settingsModal');
  const ps = $('personalitySelect'); if(ps) ps.value = settings.personality||'jarvis';
  const ci = $('customInst'); if(ci) ci.value = settings.custom||'';
  const vt = $('voiceToggle'); if(vt) vt.classList.toggle('on', settings.voiceOut||false);
};
window.saveSettings = async function() {
  const ps = $('personalitySelect'); const ci = $('customInst');
  settings.personality = ps?.value || 'jarvis';
  settings.custom      = ci?.value?.trim() || '';
  currentPersona       = settings.personality;
  if(user && !isGuest) {
    await db.collection('users').doc(user.uid).update({personality:settings.personality,custom:settings.custom}).catch(()=>{});
  }
  closeModal();
  showToast(t('saved'), 1500, 'success');
};
window.toggleVoiceOut = function() {
  settings.voiceOut = !settings.voiceOut;
  $('voiceToggle')?.classList.toggle('on', settings.voiceOut);
};

window.openAppearance = function() {
  openModal('appearanceModal');
  $('lightToggle')?.classList.toggle('on', settings.lightMode||false);
};

// ── STATS & MEMORY PANEL ──────────────────────────────────────
window.openStats = function() {
  openModal('statsModal');
  const prof = window.JARVIS_MEMORY.getProfile();
  const el   = $('memList'); if(!el) return;
  const sections = [];
  if((prof.facts||[]).length) sections.push('<div class="mem-section-label">Fakta</div>'+prof.facts.map(m=>`<div class="mem-item"><span>🧠</span>${esc(m.content||'')}</div>`).join(''));
  if((prof.prefs||[]).length) sections.push('<div class="mem-section-label">Preferenser</div>'+prof.prefs.map(m=>`<div class="mem-item"><span>⭐</span>${esc(m.content||'')}</div>`).join(''));
  if((prof.corrections||[]).length) sections.push('<div class="mem-section-label">Förbättringar</div>'+prof.corrections.map(m=>`<div class="mem-item"><span>🎯</span>${esc(m.content||'')}</div>`).join(''));

  const totalMsgs  = parseInt(localStorage.getItem('jv4_total_msgs')||'0');
  const totalWords = parseInt(localStorage.getItem('jv4_total_words')||'0');
  const totalChats = parseInt(localStorage.getItem('jv4_total_chats')||'0');
  const firstSeen  = localStorage.getItem('jv4_first_seen');
  const days       = firstSeen ? Math.ceil((Date.now()-parseInt(firstSeen))/86400000) : 1;
  if($('st_chats'))  $('st_chats').textContent  = totalChats;
  if($('st_msgs'))   $('st_msgs').textContent   = totalMsgs;
  if($('st_words'))  $('st_words').textContent  = totalWords;
  if($('st_days'))   $('st_days').textContent   = days;

  el.innerHTML = sections.length
    ? sections.join('') + `<div style="margin-top:14px;display:flex;gap:8px;flex-wrap:wrap">
        <button class="accent-btn" onclick="window.exportMemorySummary()" style="font-size:12px;padding:8px 14px">📋 Kopiera minnessummering</button>
        <button class="editor-btn" onclick="window.clearMemories()" style="font-size:12px;padding:8px 14px">🗑️ Rensa minnen</button>
      </div>`
    : '<div style="font-size:13px;color:var(--text3);padding:10px 0">Inga minnen ännu — börja chatta så lär jag mig om dig!</div>';
};
window.clearMemories = function() { window.JARVIS_MEMORY.clear(); window.openStats(); };

window.exportMemorySummary = function() {
  const prof = window.JARVIS_MEMORY.getProfile();
  const kb   = JSON.parse(localStorage.getItem('jv4_kb')||'[]');
  const date = new Date().toLocaleDateString('sv-SE');
  let s = `# JARVIS Minnessummering — ${date}\n\n`;
  if(prof.facts?.length) s += `## Fakta\n${prof.facts.map(f=>`- ${f.content}`).join('\n')}\n\n`;
  if(prof.prefs?.length) s += `## Preferenser\n${prof.prefs.map(p=>`- ${p.content}`).join('\n')}\n\n`;
  if(kb.length) s += `## Kunskapsbas\n${kb.map(k=>`- **${k.title}**: ${k.content.substring(0,100)}`).join('\n')}\n\n`;
  s += `---\nKlistra in vid nästa session: "Ladda mitt minne: [text ovan]"\n`;
  navigator.clipboard.writeText(s)
    .then(()=>showToast('✅ Minnessummering kopierad!', 4000, 'success'))
    .catch(()=>{ const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([s],{type:'text/markdown'})); a.download=`jarvis-minne-${date}.md`; a.click(); showToast('📥 Nedladdad', 2000); });
};

// ── KB PANEL ─────────────────────────────────────────────────
window.openKBPanel = async function() { openModal('kbPanel'); await window.renderKBList(); };
window.renderKBList = async function() {
  const items = await window.JARVIS_KB.load();
  const el = $('kbList'); if(!el) return;
  el.innerHTML = items.length
    ? items.map(item=>`<div class="mem-item"><span>📌</span><div style="flex:1"><div style="font-size:13px;font-weight:600;color:var(--text)">${esc(item.title)}</div><div style="font-size:12px;color:var(--text2)">${esc(item.content.substring(0,100))}${item.content.length>100?'...':''}</div></div><button onclick="window.removeKBEntry('${item.id}')" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:16px">×</button></div>`).join('')
    : '<div style="font-size:13px;color:var(--text3);padding:10px 0">Inga kunskapsposter ännu.</div>';
};
window.addKBEntry = async function() {
  const title   = $('kbTitle')?.value.trim();
  const content = $('kbContent')?.value.trim();
  if(!title||!content) return showToast('Fyll i titel och innehåll');
  await window.JARVIS_KB.add(title, content);
  $('kbTitle').value=''; $('kbContent').value='';
  await window.renderKBList();
  showToast('✅ Kunskap sparad!', 2000, 'success');
};
window.removeKBEntry = async function(id) {
  await window.JARVIS_KB.remove(id);
  await window.renderKBList();
  showToast('🗑️ Borttagen');
};

// ── EXPORT CHAT ───────────────────────────────────────────────
window.exportChat = function() {
  const msgs = memory.filter(m=>m.role!=='system');
  if(!msgs.length) return showToast('Ingen chatt att exportera','error');
  const date = new Date().toLocaleDateString('sv-SE');
  const md = `# JARVIS 5.0 — Chatt export\n*${date}*\n\n---\n\n` +
    msgs.map(m=>`**${m.role==='user'?'Du':'JARVIS'}:**\n${m.content}`).join('\n\n---\n\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([md],{type:'text/markdown'}));
  a.download = `jarvis-chatt-${date}.md`;
  a.click();
  showToast('✅ Chatt exporterad!', 2000, 'success');
};

window.regenerateLastAI = async function() {
  const lastUser = [...memory].reverse().find(m=>m.role==='user');
  if(!lastUser) return;
  // Remove last AI message from memory
  const idx = [...memory].map(m=>m.role).lastIndexOf('assistant');
  if(idx>=0) memory.splice(idx,1);
  // Remove last AI bubble from DOM
  const chat = $('chat');
  const bubbles = chat?.querySelectorAll('.msg-group');
  if(bubbles?.length) bubbles[bubbles.length-1].remove();
  // Re-send
  const msgs = [{role:'system',content:getSystemPrompt()},...memory];
  const reply = await sendStreaming(msgs);
  if(reply) { memory.push({role:'assistant',content:reply}); await saveMsg('assistant',reply); }
};

// ── KEYBOARD SHORTCUTS ────────────────────────────────────────
document.addEventListener('keydown', e => {
  const mod = e.metaKey || e.ctrlKey;
  if(mod && e.key==='b') { e.preventDefault(); window.toggleSidebar(); }
  if(mod && e.key==='e') { e.preventDefault(); window.exportChat(); }
  if(mod && e.key==='n') { e.preventDefault(); window.newChat(); }
  if(e.key==='Escape')   { closeModal(); }
});

// Drag & drop files
document.addEventListener('dragover', e=>e.preventDefault());
document.addEventListener('drop', e => {
  e.preventDefault();
  const files = [...e.dataTransfer.files];
  if(files.length) { window.switchToolTab('chat'); files.forEach(f=>window._processFile?.(f)); }
});

// ── BACKGROUND CANVAS ─────────────────────────────────────────
function initBackground() {
  const canvas = $('bgCanvas'); if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let W, H, particles=[];
  function resize() { W=canvas.width=window.innerWidth; H=canvas.height=window.innerHeight; }
  resize();
  window.addEventListener('resize', resize);
  for(let i=0;i<25;i++) particles.push({
    x:Math.random()*window.innerWidth, y:Math.random()*window.innerHeight,
    r:Math.random()*1.5+0.5, vx:(Math.random()-.5)*.2, vy:(Math.random()-.5)*.2, alpha:Math.random()*.4+.1
  });
  function draw() {
    ctx.clearRect(0,0,W,H);
    const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent-rgb').trim()||'160,160,241';
    particles.forEach(p => {
      p.x+=p.vx; p.y+=p.vy;
      if(p.x<0)p.x=W; if(p.x>W)p.x=0; if(p.y<0)p.y=H; if(p.y>H)p.y=0;
      ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=`rgba(${accent},${p.alpha})`; ctx.fill();
    });
    requestAnimationFrame(draw);
  }
  draw();
}


// ── CODE EDITOR KEYDOWN (tab support) ─────────────────────────
window.editorKeydown = function(e) {
  if(e.key === 'Tab') {
    e.preventDefault();
    const el = e.target;
    const start = el.selectionStart, end = el.selectionEnd;
    el.value = el.value.substring(0,start) + '  ' + el.value.substring(end);
    el.selectionStart = el.selectionEnd = start + 2;
    window.updateLineNums?.();
  }
};


// ── DIAGNOSTIC CONSOLE (synlig felsökning) ────────────────────
window.JARVIS_DEBUG = {
  logs: [],
  log(msg, type='info') {
    const time = new Date().toLocaleTimeString('sv-SE');
    this.logs.unshift({time, msg, type});
    if(this.logs.length > 50) this.logs.pop();
    this.render();
  },
  render() {
    const panel = document.getElementById('debugPanel');
    if(!panel) return;
    panel.innerHTML = this.logs.map(l =>
      `<div style="padding:4px 8px;border-bottom:1px solid rgba(255,255,255,0.1);font-size:11px;font-family:monospace;color:${l.type==='error'?'#ef4444':l.type==='ok'?'#10b981':'#94a3b8'}">
        <span style="opacity:.5">${l.time}</span> ${l.msg}
      </div>`).join('');
  },
  show() {
    let panel = document.getElementById('debugOverlay');
    if(panel) { panel.remove(); return; }
    panel = document.createElement('div');
    panel.id = 'debugOverlay';
    panel.style.cssText = 'position:fixed;bottom:80px;right:20px;width:380px;max-height:400px;background:#0a0a0a;border:1px solid #333;border-radius:12px;z-index:99999;overflow:hidden;box-shadow:0 10px 40px rgba(0,0,0,0.5)';
    panel.innerHTML = `
      <div style="padding:10px 14px;background:#1a1a1a;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #333">
        <span style="color:#10b981;font-weight:700;font-size:13px">🔧 JARVIS Diagnostik</span>
        <div style="display:flex;gap:6px">
          <button onclick="window.JARVIS_DEBUG.runTests()" style="background:#10b981;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">Kör tester</button>
          <button onclick="document.getElementById('debugOverlay').remove()" style="background:#333;color:white;border:none;border-radius:6px;padding:4px 10px;font-size:11px;cursor:pointer">✕</button>
        </div>
      </div>
      <div id="debugPanel" style="max-height:340px;overflow-y:auto"></div>`;
    document.body.appendChild(panel);
    this.render();
  },
  async runTests() {
    this.log('═══ KÖR DIAGNOSTIK ═══', 'info');

    // Test 1: PDF.js loaded?
    this.log(typeof pdfjsLib !== 'undefined' ? '✅ PDF.js laddad' : '❌ PDF.js EJ laddad', typeof pdfjsLib !== 'undefined' ? 'ok' : 'error');

    // Test 2: Functions exist?
    const fns = ['handleFile','_processFile','send','generateImage','_fetchAndRenderWeather'];
    fns.forEach(fn => {
      const ok = typeof window[fn] === 'function';
      this.log(`${ok?'✅':'❌'} window.${fn}`, ok?'ok':'error');
    });

    // Test 3: File input exists?
    const fi = document.getElementById('fileInput2');
    this.log(fi ? '✅ fileInput2 finns' : '❌ fileInput2 SAKNAS', fi?'ok':'error');

    // Test 4: pendingDocs state
    this.log(`📦 pendingDocs: ${(window.pendingDocs||[]).length} st`, 'info');
    this.log(`📦 pendingImages: ${(window.pendingImages||[]).length} st`, 'info');

    // Test 5: PRO status
    this.log(`🔒 isProUser: ${isProUser}`, isProUser?'ok':'error');
    this.log(`👤 user: ${user?.email||'gäst'}`, 'info');

    // Test 6: API endpoints
    this.log('🌐 Testar API...', 'info');
    try {
      const r = await fetch('/api/weather?city=Stockholm');
      this.log(r.ok ? `✅ Väder-API: ${r.status}` : `❌ Väder-API: ${r.status}`, r.ok?'ok':'error');
    } catch(e) { this.log(`❌ Väder-API: ${e.message}`, 'error'); }

    try {
      const r = await fetch('/api/chat', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'user',content:'hej'}],lang:'sv'})});
      const d = await r.json();
      this.log(r.ok ? `✅ Chat-API: ${d.provider||'svar OK'}` : `❌ Chat-API: ${r.status}`, r.ok?'ok':'error');
    } catch(e) { this.log(`❌ Chat-API: ${e.message}`, 'error'); }

    this.log('═══ KLART ═══', 'info');
  }
};

// Capture all JS errors
window.addEventListener('error', e => {
  window.JARVIS_DEBUG?.log(`❌ FEL: ${e.message} (${e.filename?.split('/').pop()}:${e.lineno})`, 'error');
});
window.addEventListener('unhandledrejection', e => {
  window.JARVIS_DEBUG?.log(`❌ PROMISE-FEL: ${e.reason?.message||e.reason}`, 'error');
});

// Add debug button to sidebar
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const settingsNav = document.querySelector('.sb-nav-item[onclick*="openSettings"]');
    if(settingsNav && !document.querySelector('[onclick*="JARVIS_DEBUG.show"]')) {
      const dbgBtn = document.createElement('div');
      dbgBtn.className = 'sb-nav-item';
      dbgBtn.setAttribute('onclick', 'window.JARVIS_DEBUG.show()');
      dbgBtn.innerHTML = '<span>🔧</span><span>Diagnostik</span>';
      settingsNav.parentNode.insertBefore(dbgBtn, settingsNav.nextSibling);
    }
  }, 1200);
});


// ── INIT ──────────────────────────────────────────────────────
(function init() {
  // Apply saved accent immediately
  try {
    const a = localStorage.getItem('jv4_accent')||'';
    const l = localStorage.getItem('jv_light')==='1';
    if(a) window.setAccent(a);
    if(l) { document.documentElement.setAttribute('data-light',''); document.body.setAttribute('data-light',''); }
  } catch(e){}
  // Restore version flag
  if(localStorage.getItem('jv_version')!=='v5') {
    localStorage.removeItem('jv_light');
    localStorage.setItem('jv_version','v5');
  }
  if(!localStorage.getItem('jv4_first_seen')) localStorage.setItem('jv4_first_seen', Date.now().toString());
})();


// ── INTELLIGENCE ENGINE (RAG + Memory Extraction) ────────────
// Runs in background after each message — never blocks UI

window._runIntelligence = async function(userMsg, aiReply) {
  try {
    // Only run every 3rd message to avoid hammering API
    window._intelligenceCount = (window._intelligenceCount||0) + 1;
    if(window._intelligenceCount % 3 !== 0) return;

    const msgs = memory.slice(-8); // Last 8 messages
    if(msgs.length < 2) return;

    // Get user's KB for RAG context
    const userKB = (await window.JARVIS_KB.load()).map(k=>({title:k.title,content:k.content}));

    const r = await fetch('/api/intelligence', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({action:'both', messages:msgs, query:userMsg, k:3, userKB})
    });
    if(!r.ok) return;

    const d = await r.json();

    // Save extracted facts to memory
    if(d.facts?.length) {
      d.facts.forEach(f => {
        if(f.content) {
          const type = f.type==='correction'?'corrections':f.type==='preference'?'prefs':'facts';
          window.JARVIS_MEMORY.add(f.content, type);
        }
      });
    }

    // Store RAG context for next message
    if(d.context) window._ragContext = d.context;

    // Update mood indicator subtly
    if(d.mood && d.mood !== 'neutral') {
      const moodEmoji = {happy:'😊',frustrated:'😤',curious:'🤔',excited:'🚀'}[d.mood]||'';
      if(moodEmoji) {
        const ind = $('aiIndicator');
        if(ind && ind.textContent) ind.textContent += ' ' + moodEmoji;
      }
    }
  } catch(e) {
    // Silent fail — intelligence is enhancement, not core
    console.debug('Intelligence background task:', e.message);
  }
};

// Inject RAG context into system prompt when available
const _baseGetSystemPrompt = getSystemPrompt;
window._getSystemPromptWithRAG = function() {
  let s = _baseGetSystemPrompt();
  if(window._ragContext) {
    s += '\n' + window._ragContext + '\n';
    window._ragContext = null; // Use once then clear
  }
  return s;
};

// ── PERSONA SWITCHER ─────────────────────────────────────────
window.switchPersona = function(el) {
  $$('.persona-pill').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  currentPersona = el.dataset.p || 'jarvis';
  settings.personality = currentPersona;
};

// ── JARVIS MODE ───────────────────────────────────────────────
window.setJarvisMode = function(mode) {
  const modes = {
    standard: '',
    focus:    'Svar KORTFATTAT. Max 3-4 meningar. Bullet points. Direkt.',
    deep:     'Ge DJUPGÅENDE svar. Analysera noggrant. Ge kontext, bakgrund, konsekvenser.',
    creative: 'Var EXTREMT kreativ. Oväntade vinklar. Metaforer. Tänk utanför boxen.',
    tutor:    'Var PEDAGOGISK. Använd analogier. Förklara som för en nyfiken student.',
  };
  window._modeModifier = modes[mode] || '';
  $$('.mode-btn').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
  showToast((SPEC_MODES[mode]?.emoji||'⚡')+' '+((SPEC_MODES[mode]?.label)||mode)+' aktiverat', 1500, 'success');
};
window.clearSpecMode = function() { window._modeModifier=''; $$('.mode-btn').forEach(b=>b.classList.remove('active')); };

// ── CHANGE PASSWORD ───────────────────────────────────────────
window.changePassword = async function() {
  const p1=$('newPass1')?.value, p2=$('newPass2')?.value, msg=$('passMsg');
  if(!p1||!p2){if(msg)msg.textContent='Fyll i båda fälten';return;}
  if(p1!==p2){if(msg)msg.textContent='Lösenorden matchar inte';return;}
  if(p1.length<6){if(msg)msg.textContent='Minst 6 tecken';return;}
  try {
    await user.updatePassword(p1);
    if(msg){msg.textContent='✅ Lösenord ändrat!';msg.style.color='var(--green)';}
  } catch(e) { if(msg){msg.textContent='Fel: '+e.message;msg.style.color='var(--red)';} }
};

// ── SAVE PERSONALITY ──────────────────────────────────────────
window.savePersonality = function() {
  const ps=$('personalitySelect'); if(!ps) return;
  settings.personality=ps.value; currentPersona=ps.value;
  if(user&&!isGuest) db.collection('users').doc(user.uid).update({personality:ps.value}).catch(()=>{});
};

// ── SET FONT ──────────────────────────────────────────────────
window.setFont = function(font) {
  const fonts={dm:'DM Sans',mono:'JetBrains Mono',grotesk:'Space Grotesk'};
  document.documentElement.style.setProperty('--font-main',`'${fonts[font]||fonts.dm}',sans-serif`);
  $$('.font-opt').forEach(b=>b.classList.toggle('active',b.dataset.f===font));
};

// ── MUSIC GENERATION ──────────────────────────────────────────
window.generateMusic = async function() {
  const prompt=$('musicPrompt')?.value.trim();
  if(!prompt) return showToast('Beskriv musiken','error');
  const style=$('musicStyle')?.value||'';
  const title=$('musicTitle')?.value||'JARVIS Generated';
  const instrumental=$('instrumental')?.checked||false;
  const btn=$('musicGenBtn'); if(btn){btn.disabled=true;btn.textContent='⏳ Genererar...';}
  const results=$('musicResults');
  if(results) results.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:16px;color:var(--text2)"><div class="loading-spinner"></div> Genererar musik...</div>';
  try {
    const r=await fetch('/api/music',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,style,title,instrumental})});
    const d=await r.json();
    if(d.demo){
      if(results) results.innerHTML=`<div class="note-card" style="margin-top:16px">ℹ️ ${d.message}</div>`;
    } else if(d.data){
      const tracks=Array.isArray(d.data)?d.data:[d.data];
      if(results) results.innerHTML=tracks.map(t=>`<div class="music-track"><div class="track-title">🎵 ${esc(t.title||title)}</div>${t.audio_url?`<audio controls style="width:100%;margin-top:8px"><source src="${t.audio_url}" type="audio/mpeg"></audio>`:''}</div>`).join('');
    }
  } catch(e){if(results)results.innerHTML='<div style="color:var(--red);padding:16px">❌ '+esc(e.message)+'</div>';}
  if(btn){btn.disabled=false;btn.textContent='🎼 Generera musik';}
};

// ── FILM SCRIPT ────────────────────────────────────────────────
window.generateFilmScript = async function() {
  const title=$('filmTitle')?.value.trim()||'Min Film';
  const idea=$('filmIdea')?.value.trim();
  if(!idea) return showToast('Beskriv din filmidé','error');
  const genre=$('filmGenre')?.value||'drama';
  const length=$('filmLength')?.value||'kort';
  const output=$('filmOutput');
  if(output) output.innerHTML='<div style="display:flex;align-items:center;gap:10px;padding:16px;color:var(--text2)"><div class="loading-spinner"></div> Skriver skript...</div>';
  try {
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'Du är en erfaren manusförfattare. Skriv ett professionellt filmskript.'},{role:'user',content:`Skriv ett ${length} ${genre}-skript med titeln "${title}". Idé: ${idea}\n\nFormatera med FADE IN/OUT, scener, dialog.`}],lang:currentLang||'sv'})});
    const d=await r.json();
    const text=d.content||d.reply||'';
    if(output) output.innerHTML=`<div style="background:var(--bg3);border-radius:10px;padding:20px;font-family:'JetBrains Mono',monospace;font-size:13px;white-space:pre-wrap;margin-top:16px;max-height:500px;overflow-y:auto">${esc(text)}</div>`;
  } catch(e){if(output)output.innerHTML='<div style="color:var(--red);padding:16px">❌ '+esc(e.message)+'</div>';}
};

// ── VOICE CONVERSATION ────────────────────────────────────────
window.toggleVoiceConversation = function() { window.toggleVoice(); };

// ── SEARCH IN CHAT ────────────────────────────────────────────
window.searchInChat = function(q) {
  const lower=q.toLowerCase();
  $$('.msg-group').forEach(g=>{
    const text=g.querySelector('.bubble')?.innerText?.toLowerCase()||'';
    g.style.opacity = !q||text.includes(lower)?'1':'0.2';
  });
};

// ── EDITOR AI HELP ────────────────────────────────────────────
window.editorAI = async function() {
  const code=$('codeEditor')?.value;
  if(!code?.trim()) return showToast('Skriv kod först','error');
  const aiChat=$('editorAIChat');
  if(aiChat) aiChat.innerHTML='<div style="padding:10px;color:var(--text2)"><div class="loading-spinner" style="display:inline-block"></div> Analyserar...</div>';
  try {
    const r=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({messages:[{role:'system',content:'Du är en senior kodgranskar. Förklara koden, hitta buggar och föreslå förbättringar kort.'},{role:'user',content:'Granska denna kod:\n```\n'+code.substring(0,3000)+'\n```'}],lang:currentLang||'sv'})});
    const d=await r.json();
    if(aiChat&&typeof marked!=='undefined'){try{aiChat.innerHTML='<div style="padding:12px">'+marked.parse(d.content||d.reply||'')+'</div>';}catch(e){aiChat.textContent=d.content||d.reply||'';}}
  } catch(e){if(aiChat)aiChat.textContent='❌ '+e.message;}
};

// ── SESSION AUTO-LOG ──────────────────────────────────────────
// Generates session summary when user leaves/closes
window._generateSessionLog = function() {
  if(!memory.length) return;
  const msgs = memory.filter(m=>m.role!=='system');
  if(msgs.length < 2) return;
  const topics = [...new Set(msgs
    .filter(m=>m.role==='user')
    .map(m=>m.content.substring(0,50))
  )].slice(0,5);
  const date = new Date().toLocaleDateString('sv-SE');
  const time = new Date().toLocaleTimeString('sv-SE',{hour:'2-digit',minute:'2-digit'});
  const log = {
    date, time,
    messageCount: msgs.length,
    topics,
    summary: `Session ${date} ${time}: ${msgs.length} meddelanden. Ämnen: ${topics.join(', ')}`
  };
  // Save to memory as a session fact
  window.JARVIS_MEMORY.add(`Senaste session ${date}: ${msgs.length} meddelanden om ${topics.slice(0,3).join(', ')}`, 'facts');
  // Also save full log to localStorage
  try {
    const logs = JSON.parse(localStorage.getItem('jv4_session_logs')||'[]');
    logs.unshift(log);
    localStorage.setItem('jv4_session_logs', JSON.stringify(logs.slice(0,20)));
  } catch(e){}
  return log;
};

// Auto-save session when leaving page
window.addEventListener('beforeunload', () => {
  window._generateSessionLog();
});

// Also auto-save every 10 minutes
setInterval(() => {
  if(memory.length >= 4) window._generateSessionLog();
}, 600000);

// ── FEEDBACK DASHBOARD ────────────────────────────────────────
window.openFeedbackDashboard = function() {
  const prof = window.JARVIS_MEMORY.getProfile();
  const corrections = prof.corrections || [];
  const prefs = prof.prefs || [];
  const logs = JSON.parse(localStorage.getItem('jv4_session_logs')||'[]');

  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;display:flex;align-items:center;justify-content:center;padding:20px';
  overlay.onclick = e => { if(e.target===overlay) overlay.remove(); };

  const totalMsgs  = parseInt(localStorage.getItem('jv4_total_msgs')||'0');
  const totalChats = parseInt(localStorage.getItem('jv4_total_chats')||'0');
  const goodCount  = prefs.filter(p=>p.content?.startsWith('Bra svar')).length;
  const badCount   = corrections.filter(c=>c.content?.startsWith('Förbättra')).length;
  const score      = totalMsgs > 0 ? Math.round((goodCount/(goodCount+badCount||1))*100) : 0;

  overlay.innerHTML = `
    <div style="background:var(--bg2);border-radius:20px;padding:28px;max-width:560px;width:100%;border:1px solid var(--border);max-height:90vh;overflow-y:auto">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px">
        <h3 style="margin:0;font-size:18px">📊 Feedback Dashboard</h3>
        <button onclick="this.closest('[style*=position]').remove()" style="background:none;border:none;color:var(--text3);cursor:pointer;font-size:20px">✕</button>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr 1fr 1fr;gap:12px;margin-bottom:20px">
        <div style="background:var(--bg3);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:var(--accent)">${totalMsgs}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Meddelanden</div>
        </div>
        <div style="background:var(--bg3);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:var(--accent)">${totalChats}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">Sessioner</div>
        </div>
        <div style="background:var(--bg3);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:#10b981">${goodCount}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">👍 Bra</div>
        </div>
        <div style="background:var(--bg3);border-radius:12px;padding:14px;text-align:center">
          <div style="font-size:24px;font-weight:800;color:#ef4444">${badCount}</div>
          <div style="font-size:11px;color:var(--text3);margin-top:4px">👎 Förbättra</div>
        </div>
      </div>

      <div style="background:var(--bg3);border-radius:12px;padding:16px;margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;margin-bottom:8px">
          <span style="font-size:13px;font-weight:600">Nöjdhetspoäng</span>
          <span style="font-size:13px;font-weight:800;color:${score>=70?'#10b981':score>=40?'#f59e0b':'#ef4444'}">${score}%</span>
        </div>
        <div style="background:var(--bg2);border-radius:999px;height:8px;overflow:hidden">
          <div style="height:100%;width:${score}%;background:${score>=70?'#10b981':score>=40?'#f59e0b':'#ef4444'};border-radius:999px;transition:width 1s ease"></div>
        </div>
      </div>

      ${corrections.length ? `
      <div style="margin-bottom:16px">
        <div style="font-size:12px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">🎯 Förbättringsområden</div>
        ${corrections.slice(0,5).map(c=>`<div style="background:var(--bg3);border-radius:8px;padding:8px 12px;margin-bottom:6px;font-size:13px;border-left:3px solid #ef4444">${esc(c.content||'')}</div>`).join('')}
      </div>` : ''}

      ${logs.length ? `
      <div>
        <div style="font-size:12px;color:var(--text3);letter-spacing:1px;text-transform:uppercase;margin-bottom:8px">📅 Sessionshistorik</div>
        ${logs.slice(0,5).map(l=>`<div style="background:var(--bg3);border-radius:8px;padding:8px 12px;margin-bottom:6px;font-size:12px"><b>${l.date} ${l.time}</b> · ${l.messageCount} meddelanden · ${(l.topics||[]).slice(0,2).join(', ')}</div>`).join('')}
      </div>` : '<div style="font-size:13px;color:var(--text3);text-align:center;padding:20px">Ingen historik ännu — börja chatta!</div>'}

      <div style="margin-top:16px;display:flex;gap:8px">
        <button class="accent-btn" style="flex:1;font-size:12px" onclick="window.exportMemorySummary()">📋 Kopiera minnessummering</button>
        <button class="editor-btn" style="font-size:12px" onclick="this.closest('[style*=position]').remove()">Stäng</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
};

// ── DYNAMIC PAGINATION ────────────────────────────────────────
// When AI response is very long, offer "Del 1/3" style pagination
window._paginateResponse = function(text, msgEl) {
  const CHUNK = 1200; // chars per page
  if(text.length < CHUNK * 1.5) return; // Not long enough to paginate

  const parts = [];
  const paragraphs = text.split('\n\n');
  let current = '';
  paragraphs.forEach(p => {
    if((current + p).length > CHUNK && current) {
      parts.push(current.trim());
      current = p;
    } else {
      current += (current ? '\n\n' : '') + p;
    }
  });
  if(current.trim()) parts.push(current.trim());
  if(parts.length < 2) return;

  window._paginatedParts = parts;
  window._paginatedIndex = 0;

  const bubble = msgEl?.querySelector('.bubble.ai');
  if(!bubble) return;

  // Show first part + navigation
  const render = (idx) => {
    const part = parts[idx];
    let content = part;
    if(typeof marked !== 'undefined') { try{content=marked.parse(part);}catch(e){} }
    bubble.innerHTML = `
      <div class="page-indicator" style="font-size:11px;color:var(--text3);margin-bottom:10px;display:flex;align-items:center;gap:8px">
        <span>Del ${idx+1} av ${parts.length}</span>
        <div style="flex:1;background:var(--bg3);border-radius:999px;height:3px">
          <div style="height:100%;width:${((idx+1)/parts.length)*100}%;background:var(--accent);border-radius:999px"></div>
        </div>
      </div>
      ${content}
      <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
        ${idx > 0 ? `<button class="editor-btn" onclick="window._paginateGo(${idx-1},this)">← Föregående</button>` : ''}
        ${idx < parts.length-1 ? `<button class="accent-btn" onclick="window._paginateGo(${idx+1},this)">Nästa del →</button>` : '<span style="font-size:12px;color:var(--green);padding:8px 0">✅ Klart!</span>'}
      </div>`;
  };
  render(0);
};

window._paginateGo = function(idx, btn) {
  const bubble = btn.closest('.bubble.ai');
  const parts = window._paginatedParts;
  if(!parts||idx<0||idx>=parts.length) return;
  window._paginatedIndex = idx;
  let content = parts[idx];
  if(typeof marked !== 'undefined'){try{content=marked.parse(parts[idx]);}catch(e){}}
  bubble.innerHTML = `
    <div class="page-indicator" style="font-size:11px;color:var(--text3);margin-bottom:10px;display:flex;align-items:center;gap:8px">
      <span>Del ${idx+1} av ${parts.length}</span>
      <div style="flex:1;background:var(--bg3);border-radius:999px;height:3px">
        <div style="height:100%;width:${((idx+1)/parts.length)*100}%;background:var(--accent);border-radius:999px"></div>
      </div>
    </div>
    ${content}
    <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap">
      ${idx > 0 ? `<button class="editor-btn" onclick="window._paginateGo(${idx-1},this)">← Föregående</button>` : ''}
      ${idx < parts.length-1 ? `<button class="accent-btn" onclick="window._paginateGo(${idx+1},this)">Nästa del →</button>` : '<span style="font-size:12px;color:var(--green);padding:8px 0">✅ Klart!</span>'}
    </div>`;
  $('chat').scrollTop = $('chat').scrollHeight;
};

// ── PLUGIN SYSTEM ─────────────────────────────────────────────
// Lightweight plugin architecture for external APIs
window.JARVIS_PLUGINS = {
  _plugins: {},

  register(name, config) {
    this._plugins[name] = {
      name,
      description: config.description || '',
      triggerWords: config.triggerWords || [],
      fetch: config.fetch,
      enabled: true,
    };
    console.log(`🔌 Plugin registered: ${name}`);
  },

  async run(name, query) {
    const plugin = this._plugins[name];
    if(!plugin?.enabled) return null;
    try { return await plugin.fetch(query); }
    catch(e) { console.warn(`Plugin ${name} failed:`, e.message); return null; }
  },

  // Auto-detect which plugin to use based on message
  detect(message) {
    const lower = message.toLowerCase();
    for(const [name, p] of Object.entries(this._plugins)) {
      if(p.enabled && p.triggerWords.some(w => lower.includes(w))) return name;
    }
    return null;
  },

  list() { return Object.values(this._plugins).map(p=>({name:p.name,description:p.description,enabled:p.enabled})); }
};

// Built-in plugins
window.JARVIS_PLUGINS.register('crypto', {
  description: 'Kryptovalutapriser i realtid',
  triggerWords: ['bitcoin','btc','ethereum','eth','crypto','krypto','kurs'],
  fetch: async (query) => {
    const coins = ['bitcoin','ethereum','solana','cardano'].find(c=>query.toLowerCase().includes(c.slice(0,3))) || 'bitcoin';
    const r = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${coins}&vs_currencies=usd,sek`);
    const d = await r.json();
    const coin = d[coins];
    return `📊 ${coins.toUpperCase()}: $${coin?.usd?.toLocaleString()} USD / ${coin?.sek?.toLocaleString()} SEK`;
  }
});

window.JARVIS_PLUGINS.register('exchange', {
  description: 'Valutakurser i realtid',
  triggerWords: ['valuta','kurs','dollar','euro','usd','eur','gbp','sek'],
  fetch: async (query) => {
    const r = await fetch('https://api.frankfurter.app/latest?from=SEK&to=USD,EUR,GBP');
    const d = await r.json();
    return `💱 Valuta (${d.date}): 1 SEK = ${d.rates?.USD?.toFixed(4)} USD | ${d.rates?.EUR?.toFixed(4)} EUR | ${d.rates?.GBP?.toFixed(4)} GBP`;
  }
});

// Hook plugins into send — check before sending to AI
const _sendWithPlugins = window.send;
window.send = async function() {
  const txtEl = $('txt');
  const text = txtEl?.value?.trim() || '';

  // Try plugin first for real-time data
  if(text && !(window.pendingDocs||[]).length && !(window.pendingImages||[]).length) {
    const pluginName = window.JARVIS_PLUGINS.detect(text);
    if(pluginName) {
      const result = await window.JARVIS_PLUGINS.run(pluginName, text);
      if(result) {
        // Inject plugin result into the message context
        window._pluginContext = result;
      }
    }
  }
  return _sendWithPlugins.apply(this, arguments);
};

// ── ADD DASHBOARD TO SIDEBAR ──────────────────────────────────
// Insert after stats nav item once DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const statsNav = document.querySelector('.sb-nav-item[onclick*="openStats"]');
    if(statsNav && !document.querySelector('[onclick*="openFeedbackDashboard"]')) {
      const dashBtn = document.createElement('div');
      dashBtn.className = 'sb-nav-item';
      dashBtn.setAttribute('onclick', 'window.openFeedbackDashboard()');
      dashBtn.innerHTML = '<span>📈</span><span>Dashboard</span>';
      statsNav.parentNode.insertBefore(dashBtn, statsNav.nextSibling);
    }
  }, 1000);
});
