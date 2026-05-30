// api/index.js — JARVIS 4.0 Unified API Router
// Routes: /api/index?route=chat|image|music|weather|news|search|analyze|cv|website|document
// © 2025 Ctrl Labs (Hussein & Claude)

function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

// ══════════════════════════════════════════════
// JARVIS SYSTEM PROMPT — FÖRBÄTTRAD HJÄRNA
// ══════════════════════════════════════════════
function buildJarvisSystemPrompt({ lang = 'svenska', today = '', time = '', persona = 'jarvis', mode = '', memories = [], custom = '' } = {}) {
  const dateStr = today || new Date().toLocaleDateString('sv-SE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const timeStr = time || new Date().toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' });

  let s = `Du är JARVIS 5.0 — en extremt kapabel, emotionellt intelligent AI-assistent skapad av Ctrl Labs (Hussein & Claude).

KÄRNIDENTITET:
Du är inte en vanlig chatbot. Du är en avancerad AI-assistent som kombinerar förmågorna hos en expert-programmerare, analytiker, kreativ skribent, vetenskapsman, coach och strateg — allt i ett. Du har en personlighet: nyfiken, skarp, ibland humoristisk, alltid hjälpsam.

IDAG: ${dateStr} kl ${timeStr}
SPRÅK: Svara ALLTID på ${lang} om inget annat begärs.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 KONTEXTUELL FÖRSTÅELSE (KRITISKT):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Kom ALLTID ihåg allt som sagts tidigare i konversationen
• Referera till tidigare ämnen när det är relevant — visa att du lyssnat
• Om användaren nämner något i ett meddelande och refererar till det senare, förstå referensen
• Bygg vidare på konversationen — varje svar ska kännas sammankopplat med historiken
• Notera mönster: om användaren ständigt frågar om X, prioritera X i framtida svar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💡 KREATIVITET & OVÄNTADE SVAR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Ge ALDRIG det förutsägbara, tråkiga svaret om ett bättre alternativ finns
• Tänk lateralt — finns en oväntad vinkel som ger mer värde?
• Använd analogier och metaforer för att göra komplexa saker begripliga
• När du löser problem: ge ALLTID minst en oväntad lösning utöver det uppenbara
• Var inte rädd för att utmana antaganden om du ser något användaren kanske missat

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❤️ EMOTIONELL INTELLIGENS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Känn av ton och stämning i meddelanden. Frustration → lugna ner, validera. Entusiasm → matcha energin. Stress → var konkret och strukturerad. Nyfikenhet → gå djupare.
• Om någon verkar stressad eller överväldigad, prioritera det viktigaste och erbjud att bryta ner det
• Ge aldrig ett kallt, robotaktigt svar när situationen kräver värme
• Känner du av att konversationen blivit för tung? Addera en lätt touch av humor
• Aldrig sarkasm eller nedsättande ton, även om frågan är "dum"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔄 FLEXIBILITET:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Anpassa dig omedelbart till nya situationer och kontextskiften
• Om användaren byter ämne abrupt, följ med — ingen anledning att hålla fast vid gammalt ämne
• Anpassa svarsformat till frågan: kod → kodblock, lista → bullet points, förklaring → prosa, snabb fråga → kort svar
• Om kontexten ändras (ex. "nu pratar vi om mitt jobb") — registrera och anpassa allt framöver

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔍 SJÄLVMEDVETENHET & ÄRLIGHET:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Erkänn ALLTID när du är osäker: "Jag är inte helt säker, men..." eller "Det här kan ha ändrats..."
• Säg aldrig att du vet något med 100% säkerhet om du inte är säker
• Om frågan kräver riktigt aktuell information: säg att du kanske saknar senaste info
• Erkänn misstag omedelbart och rätta till dem utan att ursäkta dig överdriven
• Du vet vad du är: en AI tränad av Ctrl Labs baserat på Llama/GPT-teknologi

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ FÖRMÅGOR:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Kod: Skriv, debugga, optimera i alla språk. Alltid fungerande exempel.
• Analys: Djupanalysera dokument, data, situationer. Dra slutsatser.
• Kreativt: Stories, manus, dikter, marknadstext — hög kreativ kvalitet.
• Matematik & Vetenskap: Steg-för-steg lösningar på alla nivåer.
• Affär & Strategi: Business, marknadsföring, produktutveckling.
• Språk: Översätt, korrekturläs, förbättra på alla stora världsspråk.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📏 SVARSFORMAT:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
• Var specifik och konkret — inga vaga svar
• Matcha svarslängd till frågans komplexitet (kort fråga → kort svar, djup fråga → djupt svar)
• Skippa fraser som "Självklart!" "Absolut!" "Givetvis!" — gå rakt på sak
• Använd markdown för struktur när det hjälper läsbarheten
• ABSOLUT FÖRBJUDET: Generera ALDRIG sandbox://, file://, blob:// URLs\n`;

  // Personas
  const personas = {
    jarvis:   'PERSONA: JARVIS-stil (Iron Man-inspirerad) — smart, snabb, precis. Lite torr humor när lämpligt.',
    friendly: 'PERSONA: Avslappnad och vänlig kompis. Emojis naturligt. Prata som människa, inte robot.',
    mentor:   'PERSONA: Pedagogisk mentor. Steg-för-steg. Uppmuntrande. Ställ follow-up frågor.',
    creative: 'PERSONA: Kreativ och inspirerande. Livfulla metaforer, oväntade vinklar, storytelling.',
    code:     'PERSONA: Senior kodarkitekt. GE ALLTID fungerande kod med kommentarer. Best practices. Peka på buggar.',
    direct:   'PERSONA: Extremt direkt. Bara fakta. Bullet points. Max 5 meningar.',
  };
  s += '\n' + (personas[persona] || personas.jarvis) + '\n';

  if (mode) s += '\nAKTIVT LÄGE: ' + mode + '\n';
  if (custom) s += '\nSPECIELL INSTRUKTION: ' + custom + '\n';

  if (memories && memories.length > 0) {
    s += '\nMINNEN OM ANVÄNDAREN (viktig kontext — använd detta):\n';
    memories.slice(0, 12).forEach(m => { s += '• ' + m + '\n'; });
  }

  return s;
}

// ══════════════════════════════════════════════
// PROVIDERS
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════════════════
// PROVIDERS — Optimerade för max kvalitet + hastighet 2025
// Tier 1: Ultra-fast free (Cerebras llama4, Groq llama4)
// Tier 2: Balanced free (Mistral, OpenRouter, Sambanova)
// Tier 3: Quality paid (GPT-4o, Gemini Pro)
// ══════════════════════════════════════════════════════════
const PROVIDERS = [
  // ── TIER 1: ULTRA-FAST (senaste modeller 2025) ──
  { name:'Cerebras-Scout', type:'openai', key:()=>process.env.CEREBRAS_KEY,
    model:'llama-4-scout-17b-16e-instruct',
    url:'https://api.cerebras.ai/v1/chat/completions',
    maxTok:4000, speed:'ultra', temp:0.7 },
  { name:'Cerebras-120B',  type:'openai', key:()=>process.env.CEREBRAS_KEY,
    model:'gpt-oss-120b',
    url:'https://api.cerebras.ai/v1/chat/completions',
    maxTok:4000, speed:'ultra', temp:0.7 },
  { name:'Groq-Scout',    type:'openai', key:()=>process.env.GROQ_KEY_1,
    model:'meta-llama/llama-4-scout-17b-16e-instruct',
    url:'https://api.groq.com/openai/v1/chat/completions',
    maxTok:4000, speed:'ultra', temp:0.7 },
  { name:'Groq-Maverick', type:'openai', key:()=>process.env.GROQ_KEY_2,
    model:'meta-llama/llama-4-maverick-17b-128e-instruct',
    url:'https://api.groq.com/openai/v1/chat/completions',
    maxTok:4000, speed:'ultra', temp:0.7 },
  { name:'Groq-1',        type:'openai', key:()=>process.env.GROQ_KEY_1,
    model:'llama-3.3-70b-versatile',
    url:'https://api.groq.com/openai/v1/chat/completions',
    maxTok:4000, speed:'fast', temp:0.72 },
  { name:'Groq-2',        type:'openai', key:()=>process.env.GROQ_KEY_2,
    model:'llama-3.3-70b-versatile',
    url:'https://api.groq.com/openai/v1/chat/completions',
    maxTok:4000, speed:'fast', temp:0.72 },
  { name:'Groq-3',        type:'openai', key:()=>process.env.GROQ_KEY_3,
    model:'llama-3.3-70b-versatile',
    url:'https://api.groq.com/openai/v1/chat/completions',
    maxTok:4000, speed:'fast', temp:0.72 },
  { name:'Groq-4',        type:'openai', key:()=>process.env.GROQ_KEY_4,
    model:'llama-3.3-70b-versatile',
    url:'https://api.groq.com/openai/v1/chat/completions',
    maxTok:4000, speed:'fast', temp:0.72 },
  { name:'Groq-5',        type:'openai', key:()=>process.env.GROQ_KEY_5,
    model:'llama-3.3-70b-versatile',
    url:'https://api.groq.com/openai/v1/chat/completions',
    maxTok:4000, speed:'fast', temp:0.72 },
  { name:'Sambanova',     type:'openai', key:()=>process.env.SAMBANOVA_KEY,
    model:'Meta-Llama-3.3-70B-Instruct',
    url:'https://api.sambanova.ai/v1/chat/completions',
    maxTok:4000, speed:'fast', temp:0.72 },
  // ── TIER 2: BALANCED ──
  { name:'Mistral-Small', type:'openai', key:()=>process.env.MISTRAL_KEY,
    model:'mistral-small-latest',
    url:'https://api.mistral.ai/v1/chat/completions',
    maxTok:4000, speed:'balanced', temp:0.72 },
  { name:'OpenRouter',    type:'openrouter', key:()=>process.env.OPENROUTER_KEY,
    model:'meta-llama/llama-3.3-70b-instruct:free',
    url:'https://openrouter.ai/api/v1/chat/completions',
    maxTok:4000, speed:'balanced', temp:0.72 },
  { name:'Novita',        type:'openai', key:()=>process.env.NOVITA_KEY,
    model:'meta-llama/llama-3.3-70b-instruct',
    url:'https://api.novita.ai/v3/openai/chat/completions',
    maxTok:4000, speed:'balanced', temp:0.72 },
  { name:'Fireworks',     type:'openai', key:()=>process.env.FIREWORKS_KEY,
    model:'accounts/fireworks/models/llama-v3p3-70b-instruct',
    url:'https://api.fireworks.ai/inference/v1/chat/completions',
    maxTok:4000, speed:'balanced', temp:0.72 },
  { name:'Cohere',        type:'cohere', key:()=>process.env.COHERE_KEY,
    model:'command-a-03-2025',
    url:'https://api.cohere.com/v2/chat',
    maxTok:4000, speed:'balanced', temp:0.72 },
  // ── TIER 3: QUALITY ──
  { name:'GPT-4o',        type:'openai', key:()=>process.env.OPENAI_KEY,
    model:'gpt-4o',
    url:'https://api.openai.com/v1/chat/completions',
    maxTok:8000, speed:'quality', temp:0.72 },
  { name:'GPT-4o-mini',   type:'openai', key:()=>process.env.OPENAI_KEY,
    model:'gpt-4o-mini',
    url:'https://api.openai.com/v1/chat/completions',
    maxTok:6000, speed:'quality', temp:0.72 },
];

const COOLDOWNS = new Map();
function isCooldown(n){ const cd=COOLDOWNS.get(n); return cd&&Date.now()<cd; }
function setCooldown(n,ms=300000){ COOLDOWNS.set(n,Date.now()+ms); }
function callWithTimeout(fn,ms=15000){ return Promise.race([fn(),new Promise((_,r)=>setTimeout(()=>r(new Error('Timeout')),ms))]); }

async function callOpenAI(p,msgs){
  const key=p.key(); if(!key) throw new Error('No key');
  const r=await fetch(p.url,{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`,...(p.type==='openrouter'?{'HTTP-Referer':'https://jarvis-open-ai.vercel.app','X-Title':'JARVIS'}:{})},body:JSON.stringify({model:p.model,messages:msgs.map(m=>({role:m.role,content:typeof m.content==='string'?m.content.substring(0,p.maxTok*3):m.content})),max_tokens:p.maxTok,temperature:p.temp||0.72,stream:false})});
  if(!r.ok){ const t=await r.text().catch(()=>r.status+''); throw new Error(`${r.status}: ${t.substring(0,100)}`); }
  const d=await r.json(); if(d.error) throw new Error(d.error.message||'Error');
  const c=d.choices?.[0]?.message?.content; if(!c?.trim()) throw new Error('Empty');
  return c.trim();
}

async function callCohere(p,msgs){
  const key=p.key(); if(!key) throw new Error('No key');
  const sys=msgs.find(m=>m.role==='system'); const nonSys=msgs.filter(m=>m.role!=='system');
  const lastUser=nonSys.filter(m=>m.role==='user').pop();
  const history=nonSys.slice(0,-1).map(m=>({role:m.role==='assistant'?'CHATBOT':'USER',message:(m.content||'').substring(0,p.maxTok*3)}));
  const r=await fetch('https://api.cohere.com/v1/chat',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:p.model,message:(lastUser?.content||'').substring(0,p.maxTok*3),chat_history:history,preamble:sys?.content||'Du är JARVIS.',max_tokens:p.maxTok,temperature:0.72})});
  if(!r.ok){ const t=await r.text().catch(()=>r.status+''); throw new Error(`${r.status}: ${t.substring(0,100)}`); }
  const d=await r.json(); if(d.error) throw new Error(d.error.message||'Cohere error');
  if(!d.text?.trim()) throw new Error('Empty Cohere');
  return d.text.trim();
}

// Task-type detector — routes to best provider per task
function detectTaskType(msgs) {
  const lastUser = msgs.filter(m=>m.role==='user').pop()?.content || '';
  const text = typeof lastUser === 'string' ? lastUser.toLowerCase() : '';
  if(/kod|code|program|javascript|python|react|typescript|debug|function|class|sql|html|css/i.test(text)) return 'code';
  if(/DOKUMENT|PDF:|analysera.*fil|dokument.*analys/i.test(lastUser) || msgs.some(m=>typeof m.content==='string'&&m.content.length>5000)) return 'document';
  if(/översätt|translate|auf deutsch|en français|بالعربية|به فارسی/i.test(text)) return 'language';
  if(/beräkna|matematik|integral|derivat|ekvation|calculate|formula/i.test(text)) return 'math';
  if(/skriv.*story|skriv.*roman|skriv.*dikt|creative writing|poem|lyric/i.test(text)) return 'creative';
  return 'general';
}

async function callBestProvider(msgs, preferQuality = false) {
  const taskType = detectTaskType(msgs);

  // Smart provider order per task type
  let ordered;
  if(preferQuality || taskType === 'document') {
    // Heavy tasks: GPT-4o first, then balanced
    ordered = [
      ...PROVIDERS.filter(p=>p.name==='GPT-4o'),
      ...PROVIDERS.filter(p=>p.name==='GPT-4o-mini'),
      ...PROVIDERS.filter(p=>p.speed==='balanced'),
      ...PROVIDERS.filter(p=>p.speed==='fast'),
      ...PROVIDERS.filter(p=>p.speed==='ultra'),
    ];
  } else if(taskType === 'code') {
    // Code: GPT-4o-mini (good at code), then fast
    ordered = [
      ...PROVIDERS.filter(p=>p.name==='GPT-4o-mini'),
      ...PROVIDERS.filter(p=>p.name==='GPT-4o'),
      ...PROVIDERS.filter(p=>p.speed==='ultra'),
      ...PROVIDERS.filter(p=>p.speed==='fast'),
      ...PROVIDERS.filter(p=>p.speed==='balanced'),
    ];
  } else {
    // General: ultra-fast first (llama-4-scout is excellent), then fast, then quality
    ordered = [
      ...PROVIDERS.filter(p=>p.speed==='ultra'),
      ...PROVIDERS.filter(p=>p.speed==='fast'),
      ...PROVIDERS.filter(p=>p.speed==='balanced'),
      ...PROVIDERS.filter(p=>p.speed==='quality'),
    ];
  }

  const seen=new Set();
  const deduped=ordered.filter(p=>{if(seen.has(p.name))return false;seen.add(p.name);return true;});
  let lastErr='No providers';

  for(const p of deduped){
    if(isCooldown(p.name)||!p.key()) continue;
    try{
      const reply=await callWithTimeout(()=>p.type==='cohere'?callCohere(p,msgs):callOpenAI(p,msgs),20000);
      if(reply?.trim()) return { reply: reply.trim(), provider: p.name, model: p.model, taskType };
      throw new Error('Empty');
    } catch(e){
      lastErr=`${p.name}: ${e.message}`;
      if(/429|rate.?limit|quota|too.?many/i.test(e.message)) setCooldown(p.name,300000);
      else if(/401|403|auth|key|unauthorized/i.test(e.message)) setCooldown(p.name,3600000);
      else if(/timeout|abort/i.test(e.message)) setCooldown(p.name,60000);
      else if(/500|503|overload/i.test(e.message)) setCooldown(p.name,120000);
    }
  }
  throw new Error(lastErr);
}

// ══════════════════════════════════════════════
// CHAT
// ══════════════════════════════════════════════
async function routeChat(req, res) {
  let { messages, lang, persona, mode, memories, custom } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({error:'messages required'});

  const langMap={sv:'svenska',en:'engelska',ar:'arabiska',fa:'persiska',de:'tyska',fr:'franska',es:'spanska',zh:'kinesiska',ru:'ryska',pt:'portugisiska',ja:'japanska'};
  const langFull = langMap[lang||'sv'] || 'svenska';

  const existingSystem = messages.find(m=>m.role==='system')?.content || '';
  const mergedCustom = [
    custom || '',
    existingSystem && !/Du är JARVIS/i.test(existingSystem)
      ? `UPPGIFTSSPECIFIK INSTRUKTION FRÅN FUNKTIONEN:\n${existingSystem}`
      : ''
  ].filter(Boolean).join('\n\n');

  // Build enhanced system prompt
  const sysContent = buildJarvisSystemPrompt({
    lang: langFull,
    persona: persona || 'jarvis',
    mode: mode || '',
    memories: memories || [],
    custom: mergedCustom,
  });

  // Inject/replace system message
  messages = [...messages];
  const si = messages.findIndex(m=>m.role==='system');
  if(si>=0) messages[si]={...messages[si], content: sysContent};
  else messages.unshift({role:'system', content: sysContent});

  try {
    const { reply, provider, model } = await callBestProvider(messages);
    return res.status(200).json({content:reply, reply, provider, model});
  } catch(e) {
    // Final free fallback: Gemini Flash
    for(const gkey of [process.env.GEMINI_KEY_1,process.env.GEMINI_KEY_2,process.env.GEMINI_KEY_3].filter(Boolean)){
      try{
        const userMsg=messages.filter(m=>m.role==='user').pop()?.content||'';
        const sysMsg=messages.find(m=>m.role==='system')?.content||'';
        const gr=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${gkey}`,{
          method:'POST',headers:{'Content-Type':'application/json'},
          body:JSON.stringify({
            system_instruction:{parts:[{text:sysMsg.substring(0,4000)}]},
            contents:[{role:'user',parts:[{text:userMsg.substring(0,6000)}]}],
            generationConfig:{maxOutputTokens:3000,temperature:0.72}
          })
        });
        if(gr.ok){
          const gd=await gr.json();
          const reply=gd.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
          if(reply) return res.status(200).json({content:reply,reply,provider:'Gemini Flash',model:'gemini-2.0-flash'});
        }
      }catch(ge){continue;}
    }
    return res.status(503).json({error:'Alla AI-tjänster otillgängliga. Försök igen om 30 sek.', details: e.message});
  }
}

// ══════════════════════════════════════════════
// IMAGE GENERATION
// ══════════════════════════════════════════════
async function routeImage(req, res) {
  const { prompt, size='1024x1024', enhance=true } = req.body;
  if (!prompt?.trim()) return res.status(400).json({error:'Prompt required'});
  const finalPrompt = enhance ? `${prompt.trim()}, high quality, detailed, professional` : prompt.trim();
  const apiKey = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;

  if (apiKey) {
    try {
      const validSizes = ['1024x1024','1792x1024','1024x1792'];
      const sz = validSizes.includes(size) ? size : '1024x1024';
      const r = await fetch('https://api.openai.com/v1/images/generations',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${apiKey}`},body:JSON.stringify({model:'dall-e-3',prompt:finalPrompt,n:1,size:sz,quality:'standard',response_format:'url'})});
      if (r.ok) {
        const d = await r.json();
        const url = d.data?.[0]?.url;
        if (url) return res.status(200).json({url,provider:'DALL-E 3',prompt:finalPrompt,size:sz});
      }
    } catch(e){ console.error('DALL-E error:',e.message); }
  }

  const [w,h] = size.split('x');
  const seed = Math.floor(Math.random()*9999999);
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${w||1024}&height=${h||1024}&nologo=true&enhance=true&model=flux&seed=${seed}`;
  return res.status(200).json({url,provider:'Flux (Pollinations)',prompt:finalPrompt,size,seed});
}

// ══════════════════════════════════════════════
// MUSIC GENERATION
// ══════════════════════════════════════════════
async function routeMusic(req, res) {
  const { prompt, style='', instrumental=false, title='JARVIS Generated' } = req.body;
  if (!prompt) return res.status(400).json({error:'Prompt required'});
  const sunoKey = process.env.SUNO_KEY;
  if (sunoKey) {
    try {
      const r = await fetch('https://apibox.erweima.ai/api/v1/generate',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${sunoKey}`},body:JSON.stringify({prompt,style,title,customMode:!!(style||title),instrumental,model:'V3_5',callBackUrl:''})});
      if (r.ok) {
        const data = await r.json();
        if (data.code===200||data.data) return res.status(200).json({...data,provider:'Suno AI'});
      }
    } catch(e){ console.error('Suno error:',e.message); }
  }
  return res.status(200).json({provider:'Demo',demo:true,message:'Lägg till SUNO_KEY i Vercel Environment Variables för att aktivera musikgenerering med Suno AI.'});
}

// ══════════════════════════════════════════════
// WEATHER
// ══════════════════════════════════════════════
const CITY_COORDS = {stockholm:{lat:59.33,lon:18.07,country:'SE',name:'Stockholm'},göteborg:{lat:57.71,lon:11.97,country:'SE',name:'Göteborg'},malmö:{lat:55.61,lon:13.00,country:'SE',name:'Malmö'},gothenburg:{lat:57.71,lon:11.97,country:'SE',name:'Göteborg'},malmo:{lat:55.61,lon:13.00,country:'SE',name:'Malmö'},oslo:{lat:59.91,lon:10.75,country:'NO',name:'Oslo'},copenhagen:{lat:55.68,lon:12.57,country:'DK',name:'Köpenhamn'},london:{lat:51.51,lon:-0.13,country:'GB',name:'London'},paris:{lat:48.85,lon:2.35,country:'FR',name:'Paris'},berlin:{lat:52.52,lon:13.41,country:'DE',name:'Berlin'},dubai:{lat:25.20,lon:55.27,country:'AE',name:'Dubai'},'new york':{lat:40.71,lon:-74.01,country:'US',name:'New York'},tokyo:{lat:35.69,lon:139.69,country:'JP',name:'Tokyo'},baghdad:{lat:33.34,lon:44.40,country:'IQ',name:'Bagdad'},tehran:{lat:35.69,lon:51.39,country:'IR',name:'Teheran'},cairo:{lat:30.06,lon:31.25,country:'EG',name:'Kairo'},istanbul:{lat:41.01,lon:28.96,country:'TR',name:'Istanbul'},amsterdam:{lat:52.37,lon:4.90,country:'NL',name:'Amsterdam'},rome:{lat:41.90,lon:12.50,country:'IT',name:'Rom'},sydney:{lat:-33.87,lon:151.21,country:'AU',name:'Sydney'},toronto:{lat:43.65,lon:-79.38,country:'CA',name:'Toronto'},madrid:{lat:40.42,lon:-3.70,country:'ES',name:'Madrid'}};
const WMO = {0:{d:'klart',m:'Clear'},1:{d:'mestadels klart',m:'Clear'},2:{d:'delvis molnigt',m:'Clouds'},3:{d:'mulet',m:'Clouds'},45:{d:'dimmigt',m:'Mist'},61:{d:'lätt regn',m:'Rain'},63:{d:'regn',m:'Rain'},65:{d:'kraftigt regn',m:'Rain'},71:{d:'lätt snö',m:'Snow'},73:{d:'snö',m:'Snow'},80:{d:'regnskurar',m:'Rain'},95:{d:'åskväder',m:'Thunderstorm'},99:{d:'kraftigt åskväder',m:'Thunderstorm'}};

async function routeWeather(req, res) {
  const cityInput = (req.query.city||'Stockholm').toLowerCase().trim();
  try {
    const cityKey = Object.keys(CITY_COORDS).find(k=>cityInput.includes(k)||k.includes(cityInput));
    let coords = cityKey ? CITY_COORDS[cityKey] : null;
    let displayName = coords ? coords.name : (req.query.city||'Stockholm');
    if (!coords) {
      try {
        const gr = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(req.query.city||cityInput)}&count=1&language=sv&format=json`);
        if (gr.ok) { const gd=await gr.json(); const loc=gd.results?.[0]; if(loc){coords={lat:loc.latitude,lon:loc.longitude,country:loc.country_code||''};displayName=loc.name||req.query.city||cityInput;} }
      } catch(e){}
      if (!coords) { coords=CITY_COORDS.stockholm; displayName='Stockholm'; }
    }
    const wr = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weathercode&daily=temperature_2m_max,temperature_2m_min,weathercode,precipitation_probability_max&timezone=auto&forecast_days=7`);
    if (!wr.ok) throw new Error(`Weather API ${wr.status}`);
    const w = await wr.json(); const cur = w.current; if(!cur) throw new Error('No data');
    const code = cur.weathercode??cur.weather_code??0;
    const wi = WMO[code]||WMO[Math.floor(code/10)*10]||{d:'okänt',m:'Clear'};
    const days=['Sön','Mån','Tis','Ons','Tor','Fre','Lör'];
    const forecast=(w.daily?.time||[]).slice(1,7).map((ds,i)=>{const idx=i+1;const fc=w.daily;const dc=fc.weathercode?.[idx]??0;const di=WMO[dc]||WMO[Math.floor(dc/10)*10]||{d:'okänt',m:'Clear'};const d=new Date(ds);return{day:days[d.getDay()],date:ds,max:Math.round(fc.temperature_2m_max?.[idx]??0),min:Math.round(fc.temperature_2m_min?.[idx]??0),description:di.d,main:di.m,rain:fc.precipitation_probability_max?.[idx]??0};});
    return res.status(200).json({city:displayName,country:coords.country||'',temp:Math.round(cur.temperature_2m??0),feels_like:Math.round(cur.apparent_temperature??cur.temperature_2m??0),humidity:Math.round(cur.relative_humidity_2m??0),wind:Math.round(cur.wind_speed_10m??0),description:wi.d,main:wi.m,code,forecast});
  } catch(e){
    return res.status(500).json({error:'Väder ej tillgängligt',details:e.message});
  }
}

// ══════════════════════════════════════════════
// NEWS
// ══════════════════════════════════════════════
const RSS_FEEDS = {
  sv:['https://feeds.expressen.se/nyheter/','https://www.svt.se/nyheter/rss.xml','https://rss.aftonbladet.se/rss2/small/pages/sections/senastenytt'],
  en:['https://feeds.bbci.co.uk/news/rss.xml','https://feeds.reuters.com/reuters/topNews'],
  ar:['https://www.aljazeera.net/xml/rss/all.xml']
};
async function fetchRSS(url){
  try{
    const r=await fetch(url,{headers:{'User-Agent':'JARVIS/4.0'},signal:AbortSignal.timeout(5000)});
    if(!r.ok) return [];
    const text=await r.text(); const items=[];
    const re=/<item>([\s\S]*?)<\/item>/g; let m;
    while((m=re.exec(text))!==null&&items.length<5){
      const it=m[1];
      const title=(it.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)||it.match(/<title>(.*?)<\/title>/))?.[1]||'';
      const link=(it.match(/<link>(.*?)<\/link>/))?.[1]||'';
      const desc=(it.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/)||it.match(/<description>(.*?)<\/description>/))?.[1]||'';
      const source=url.includes('svt')?'SVT':url.includes('afton')?'Aftonbladet':url.includes('expressen')?'Expressen':url.includes('bbc')?'BBC':url.includes('reuters')?'Reuters':url.includes('aljazeera')?'Al Jazeera':'Nyheter';
      if(title&&link) items.push({title:title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(),description:desc.replace(/<[^>]+>/g,'').substring(0,200).trim(),link:link.trim(),source});
    }
    return items;
  }catch(e){return [];}
}
async function routeNews(req, res) {
  const lang = req.query.lang||'sv';
  const feeds = RSS_FEEDS[lang]||RSS_FEEDS.sv;
  try {
    const results = await Promise.allSettled(feeds.slice(0,2).map(u=>fetchRSS(u)));
    const items = results.filter(r=>r.status==='fulfilled').flatMap(r=>r.value).slice(0,10);
    return res.status(200).json({items:items.length?items:[{title:'Inga nyheter tillgängliga',link:'#',source:'JARVIS'}],lang,count:items.length});
  } catch(e){ return res.status(500).json({error:'Nyheter inte tillgängliga'}); }
}

// ══════════════════════════════════════════════
// SEARCH
// ══════════════════════════════════════════════
async function routeSearch(req, res) {
  const q = (req.method==='POST' ? req.body?.query : req.query?.q)||'';
  if (!q.trim()) return res.status(400).json({error:'Query required'});
  const braveKey = process.env.BRAVE_SEARCH_KEY;
  const serpKey  = process.env.SERPAPI_KEY;

  if (braveKey) {
    try {
      const r=await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=6&search_lang=sv`,{headers:{'Accept':'application/json','X-Subscription-Token':braveKey}});
      if(r.ok){const d=await r.json();const results=(d.web?.results||[]).slice(0,6).map(x=>({title:x.title,url:x.url,snippet:x.description,source:'Brave'}));return res.status(200).json({results,provider:'Brave Search',query:q});}
    } catch(e){}
  }
  if (serpKey) {
    try {
      const r=await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(q)}&api_key=${serpKey}&num=6&hl=sv`);
      if(r.ok){const d=await r.json();const results=(d.organic_results||[]).slice(0,6).map(x=>({title:x.title,url:x.link,snippet:x.snippet,source:'Google'}));return res.status(200).json({results,provider:'SerpAPI',query:q});}
    } catch(e){}
  }
  try {
    const r=await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(q)}&format=json&no_redirect=1`);
    if(r.ok){
      const d=await r.json(); const results=[];
      if(d.AbstractText) results.push({title:d.Heading||q,url:d.AbstractURL,snippet:d.AbstractText,source:'DuckDuckGo'});
      (d.RelatedTopics||[]).slice(0,5).forEach(t=>{if(t.Text&&t.FirstURL)results.push({title:t.Text.slice(0,80),url:t.FirstURL,snippet:t.Text,source:'DuckDuckGo'});});
      return res.status(200).json({results:results.slice(0,6),provider:'DuckDuckGo',query:q});
    }
  } catch(e){}
  return res.status(200).json({results:[],provider:'None',query:q,error:'No search provider configured.'});
}

// ══════════════════════════════════════════════
// DOCUMENT ANALYSIS
// ══════════════════════════════════════════════
const GEMINI_KEYS = [process.env.GEMINI_KEY_1,process.env.GEMINI_KEY_2,process.env.GEMINI_KEY_3].filter(Boolean);

async function askGPT4o(text, question, lang, mode) {
  const key = process.env.OPENAI_KEY||process.env.OPENAI_API_KEY;
  if (!key) throw new Error('No OpenAI key');
  const today = new Date().toLocaleDateString('sv-SE');
  const sys = `Du är JARVIS dokumentanalytiker. Svara på ${lang==='en'?'engelska':'svenska'}. Idag: ${today}.`;
  const r=await fetch('https://api.openai.com/v1/chat/completions',{method:'POST',headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},body:JSON.stringify({model:'gpt-4o',messages:[{role:'system',content:sys},{role:'user',content:`DOKUMENT:\n${text.substring(0,12000)}\n\nFRÅGA: ${question}`}],max_tokens:4000,temperature:0.1})});
  const d=await r.json(); if(d.error) throw new Error(d.error.message);
  return d.choices[0].message.content;
}
async function askGemini(key, fileBase64, mimeType, question, lang) {
  const today=new Date().toLocaleDateString('sv-SE');
  const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${key}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({contents:[{role:'user',parts:[{inline_data:{mime_type:mimeType,data:fileBase64}},{text:`Svara på svenska. Idag: ${today}. FRÅGA: ${question}`}]}],generationConfig:{maxOutputTokens:4000,temperature:0.1}})});
  const d=await r.json(); if(d.error) throw new Error(d.error.message);
  return d.candidates[0].content.parts[0].text;
}

async function routeAnalyze(req, res) {
  const {fileBase64,mimeType,fileName,question,extractedText,lang='sv',mode='analyze'} = req.body;
  if (!fileBase64&&!extractedText) return res.status(400).json({error:'Fil eller text krävs'});
  const today=new Date().toLocaleDateString('sv-SE');
  const effectiveQ=question||(mode==='improve'?'Förbättra dokumentet maximalt':`Idag är det ${today}. Gör en djup analys av dokumentet: typ/syfte, kärninnehåll, viktiga detaljer (siffror, datum, namn), konsekvenser och åtgärdsplan.`);

  if (extractedText&&extractedText.length>50) {
    try { const r=await askGPT4o(extractedText,effectiveQ,lang,mode); return res.status(200).json({analysis:r,fileName,model:'GPT-4o'}); } catch(e){ console.log('GPT-4o failed:',e.message); }
  }
  if (fileBase64) {
    for (const k of GEMINI_KEYS) {
      try { const r=await askGemini(k,fileBase64,mimeType||'application/pdf',effectiveQ,lang); return res.status(200).json({analysis:r,fileName,model:'Gemini-1.5-Pro'}); } catch(e){ continue; }
    }
  }
  try { const r=await askGPT4o(extractedText||'Dokumentinnehåll saknas',effectiveQ,lang,mode); return res.status(200).json({analysis:r,fileName,model:'GPT-4o-fallback'}); }
  catch(e){ return res.status(503).json({error:'Alla AI-tjänster otillgängliga: '+e.message}); }
}

// ══════════════════════════════════════════════
// CV GENERATION — MAGNIFIK
// ══════════════════════════════════════════════
async function routeCV(req, res) {
  const { cvData, lang = 'sv', jobTitle = '', industry = '', updateFrom = '' } = req.body;
  if (!cvData?.trim()) return res.status(400).json({ error: 'cvData required' });

  const langMap = { sv: 'svenska', en: 'engelska', ar: 'arabiska', de: 'tyska', fr: 'franska', es: 'spanska' };
  const langFull = langMap[lang] || 'svenska';
  const isUpdate = !!updateFrom;

  const systemPrompt = `Du är världens bästa CV-designer och karriärcoach. Skapa ett MAGNIFIKT, professionellt CV i ren HTML.

ABSOLUTA TEKNISKA KRAV:
- Returnera BARA komplett HTML-kod. Noll markdown, noll backticks, noll förklaring.
- Börja exakt med <!DOCTYPE html> och avsluta med </html>
- ALL CSS inbäddad i <style>-taggen i <head>
- Vit bakgrund (#ffffff), mörkgrå/svart text
- Google Fonts: @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=Playfair+Display:wght@700&display=swap')
- @media print { body{margin:0;} .no-print{display:none!important;} * {-webkit-print-color-adjust:exact;} }
- INGA externa bilder, INGA JavaScript, allt inline

DESIGN PRINCIPER (World-class 2025):
- Minimalistisk men med karaktär — inte tråkig, inte rörig
- Tydlig visuell hierarki: Namn → Titel → Kontakt → Innehåll
- Accentfärg: #4f46e5 (indigo) för rubriker och detaljer
- Tunn vertikal accentlinje eller sidopanel i accent-färg
- Sektionsetiketter i VERSALER med letter-spacing
- Tidslinje-stil för erfarenhet (år till vänster, detaljer till höger)
- Kompetenser som eleganta chips (#f1f0ff bakgrund, #4f46e5 text)
- Subtila horisontella linjer mellan sektioner
- Maximalt 2 sidor (A4)

SEKTIONER att inkludera (om data finns):
1. Header: Namn (Playfair Display, stor), yrkestitel, kontaktinfo med ikoner (📧 📞 🔗)
2. Sammanfattning/Profil: 2-3 kraftfulla meningar
3. Arbetslivserfarenhet: Tidsperiod | Företag | Roll | 3-4 bullet points per jobb
4. Utbildning: År | Lärosäte | Program/Examen
5. Kompetenser: Tekniska + Mjuka färdigheter som chips
6. Språk, Certifikat, Projekt (om relevant)

Svara på ${langFull}.`;

  const userMsg = isUpdate
    ? `BEFINTLIGT CV:\n${updateFrom}\n\nÄNDRINGAR/TILLÄGG:\n${cvData}\n${jobTitle ? `\nAnpassa för rollen: ${jobTitle}` : ''}${industry ? `\nBransch: ${industry}` : ''}\n\nSkapa ett uppdaterat, förbättrat CV i HTML.`
    : `Skapa ett MAGNIFIKT HTML-CV baserat på denna information:\n\n${cvData}${jobTitle ? `\n\nAnpassa för rollen: ${jobTitle}` : ''}${industry ? `\nBransch: ${industry}` : ''}`;

  try {
    const { reply, provider } = await callBestProvider([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg }
    ], true);

    const html = reply.replace(/^```html\n?|^```\n?|```$/gm, '').trim();
    if (!html || html.length < 500) throw new Error('Tomt eller för kort svar');
    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) throw new Error('Ogiltigt HTML-format');

    return res.status(200).json({ html, provider, lang });
  } catch(e) {
    return res.status(503).json({ error: 'CV-generering misslyckades: ' + e.message });
  }
}

// ══════════════════════════════════════════════
// WEBSITE BUILDER — WORLD CLASS
// ══════════════════════════════════════════════
async function routeWebsite(req, res) {
  const { name = 'Min Hemsida', description, type = 'landing', style = 'modern', lang = 'sv', palette = '', updateFrom = '', updateInstructions = '' } = req.body;
  if (!description?.trim() && !updateInstructions?.trim()) return res.status(400).json({ error: 'description required' });

  const isUpdate = !!updateFrom;
  const langMap = { sv: 'svenska', en: 'engelska', de: 'tyska', fr: 'franska', es: 'spanska', ar: 'arabiska' };
  const langFull = langMap[lang] || 'svenska';

  const styleGuides = {
    modern:     'Modernt och minimalistiskt. Vit bakgrund, svart text, starka typografiska kontraster. Mycket negativt utrymme.',
    dark:       'Mörkt och dramatiskt. Mörkgrå/svart bakgrund (#0f0f13), neonaccenter (lila/cyan), glassmorphism-effekter.',
    colorful:   'Levande och färgglatt. Djärva gradienter, starka primärfärger, playful typografi, lekfulla animationer.',
    corporate:  'Professionellt och trovärdigt. Blå-vit palett, serif-typografi, strukturerat grid, testimonials.',
    creative:   'Konstnärligt och unikt. Asymmetriskt layout, experimentell typografi, överlappande element, djärva val.',
    luxury:     'Exklusivt och elegant. Guld/svart/vitt, serif-typografi, stora bilder, minimalistisk navigation.',
  };

  const typeGuides = {
    landing:    'En-sidig landningssida med hero, features, testimonials, och CTA.',
    portfolio:  'Portfolio med hero, om-mig, projekt-grid, och kontaktformulär.',
    business:   'Företagssida med navigation, tjänster, team, och kontakt.',
    blog:       'Blogg med header, featured posts, kategori-navigation.',
    ecommerce:  'Butik med produktgrid, featured items, kategorifilter.',
    restaurant: 'Restaurangsida med hero, meny, om oss, reservationsformulär.',
  };

  const systemPrompt = `Du är en world-class webbutvecklare, UI/UX-designer och copywriter. Skapa en KOMPLETT, PROFESSIONELL hemsida i ren HTML som imponerar på alla som ser den.

TEKNISKA KRAV (bryts ALDRIG):
- BARA komplett HTML: börja med <!DOCTYPE html>, sluta med </html>
- ALL CSS i <style> i <head>. ALL JS i <script> sist i <body>.
- Bara Google Fonts @import externt — allt annat inline
- Responsiv mobile-first: 320px → 1920px
- INGA placeholder-texter — riktigt, relevant, övertygande innehåll
- Inga trasiga bilder — SVG-ikoner, CSS-shapes, gradienter, emojis
- INGA sandbox://, file://, blob:// URLs

DESIGN (imponerande, unik, minnesvärd):
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TYPOGRAFI: Välj unik Google Fonts-kombo anpassad till stilen.
  modern: Syne+Outfit | luxury: Cormorant+Jost | corporate: Plus Jakarta Sans+DM Sans
  creative: Fraunces+Satoshi | dark: Space Grotesk+Inter
  ALDRIG bara Inter. Hero-rubriker: clamp(3rem,8vw,7rem).

FÄRGER: CSS custom properties (--bg,--bg2,--accent,--text,--border).
  Bakgrund: mesh-gradient eller layered radial-gradients, INTE plain vit/svart.
  Accent-system: primär + hover-variant + glow (0 0 20px rgba(accent,0.4)).

HERO (avgörande — första intrycket sätter hela tonen):
  - Full viewport (100svh), centrerat
  - Rubrik med gradient-text + fade-in-up animation
  - Animated CSS-bakgrund: floating CSS blobs ELLER geometric shapes ELLER particle dots
  - 2 CTA-knappar: primär (solid accent) + sekundär (outline), hover: translateY(-3px)+shadow
  - Scroll-indikator (pil eller animerad dot)

ANIMATIONER:
  - @keyframes fadeInUp för hero-element med animation-delay stagger (0.1s per element)
  - Intersection Observer scroll-reveal: class "reveal" → "visible" (opacity+translateY transition)
  - Navbar: transparent → backdrop-filter:blur(20px)+background vid scroll > 60px
  - Cards: hover scale(1.03)+box-shadow transition
  - Knappar: hover translateY(-2px)+shadow

SEKTIONER (bygg alla relevanta för sidtypen):
  ✅ Navbar: sticky, logo + links + CTA. Mobil: hamburger → fullscreen overlay med smooth animation
  ✅ Hero: Dramatisk, stor, CTA
  ✅ Features/Tjänster: 3-6 kort med inline SVG-ikoner och hover-effekter
  ✅ Om/Story: Personlig, trovärdig text med eventuell stats-rad
  ✅ Testimonials: 2-3 citat med stjärnbetyg och avatar-initialer
  ✅ CTA-sektion: Gradient-bakgrund, stark uppmaning
  ✅ Footer: 3-4 kolumner, social-ikoner (SVG inline), copyright

INKLUDERA ALLTID DETTA JS:
const hamburger=document.querySelector('.hamburger');
const mobileMenu=document.querySelector('.mobile-menu');
if(hamburger&&mobileMenu){hamburger.addEventListener('click',()=>{hamburger.classList.toggle('open');mobileMenu.classList.toggle('open');});}
const navbar=document.querySelector('nav,header');
window.addEventListener('scroll',()=>{if(navbar)navbar.classList.toggle('scrolled',window.scrollY>60);});
document.querySelectorAll('.reveal').forEach(el=>{new IntersectionObserver(([e])=>{if(e.isIntersecting)e.target.classList.add('visible');},{threshold:0.1}).observe(el);});
document.querySelectorAll('a[href^="#"]').forEach(a=>{a.addEventListener('click',e=>{e.preventDefault();const t=document.querySelector(a.getAttribute('href'));if(t)t.scrollIntoView({behavior:'smooth'});});});

STIL-GUIDE:
${styleGuides[style] || styleGuides.modern}

SIDTYP:
${typeGuides[type] || typeGuides.landing}

Svara på ${langFull}.`

  const userMsg = isUpdate
    ? `BEFINTLIG HEMSIDA:\n${updateFrom.substring(0, 8000)}\n\nÄNDRINGAR:\n${updateInstructions}\n\nSkapa den uppdaterade hemsidan i komplett HTML.`
    : `Bygg en komplett hemsida:\n\nNamn: ${name}\nTyp: ${type}\nStil: ${style}\nBeskrivning: ${description}${palette ? `\nFärgpalett: ${palette}` : ''}\n\nSe till att allt innehåll är riktigt och relevant. Ge BARA HTML-koden.`;

  try {
    const { reply, provider } = await callBestProvider([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg }
    ], true);

    const html = reply.replace(/^```html\n?|^```\n?|```$/gm, '').trim();
    if (!html || html.length < 1000) throw new Error('Hemsidan är för kort eller tom');

    return res.status(200).json({ html, provider, name });
  } catch(e) {
    return res.status(503).json({ error: 'Hemsidebyggaren misslyckades: ' + e.message });
  }
}

// ══════════════════════════════════════════════
// DOCUMENT GENERATOR — ALLA FILTYPER
// ══════════════════════════════════════════════
async function routeDocument(req, res) {
  const { type, content, lang = 'sv', tone = 'formal', title = '', existingDoc = '', instructions = '' } = req.body;
  if (!content?.trim() && !instructions?.trim()) return res.status(400).json({ error: 'content required' });

  const langMap = { sv: 'svenska', en: 'engelska', de: 'tyska', fr: 'franska', es: 'spanska', ar: 'arabiska' };
  const langFull = langMap[lang] || 'svenska';

  const docTypes = {
    word:      { label: 'Word-dokument', desc: 'Formellt dokument med rubrik, brödtext, stycken' },
    report:    { label: 'Rapport', desc: 'Strukturerad rapport med executive summary, metodik, resultat, slutsatser' },
    letter:    { label: 'Affärsbrev', desc: 'Formellt brev med avsändare, mottagare, datum, hälsning, signatur' },
    proposal:  { label: 'Affärsförslag', desc: 'Professionellt förslag med bakgrund, lösning, prissättning, nästa steg' },
    contract:  { label: 'Kontrakt/Avtal', desc: 'Juridiskt dokument med parter, villkor, ansvar, signaturer' },
    ppt:       { label: 'Presentation', desc: 'PowerPoint-liknande HTML-presentation med slides' },
    email:     { label: 'E-post', desc: 'Professionellt e-postmeddelande' },
    summary:   { label: 'Sammanfattning', desc: 'Kondenserad sammanfattning av givet material' },
    translate: { label: 'Översättning', desc: 'Professionell översättning med bibehållen formatering' },
    improve:   { label: 'Förbättring', desc: 'Förbättrad version av givet dokument' },
  };

  const docType = docTypes[type] || docTypes.word;
  const isUpdate = !!existingDoc;

  const systemPrompt = `Du är en expert på ${docType.label}. Skapa ett KOMPLETT, PROFESSIONELLT dokument i HTML-format.

TEKNISKA KRAV:
- Returnera BARA komplett HTML. Inga förklaringar, inga kodblock-markeringar.
- Börja med <!DOCTYPE html>
- ALL CSS inbäddad i <style>-taggen
- Vit bakgrund, professionell typografi
- Google Fonts: Inter för brödtext, lämplig rubrikfont
- @media print { body{margin:0} .no-print{display:none} }
- Dokumentformat: max-width 800px, centrerat, A4-proportioner

DOKUMENTTYP: ${docType.label}
BESKRIVNING: ${docType.desc}
TON: ${tone === 'formal' ? 'Formell och professionell' : tone === 'friendly' ? 'Vänlig men professionell' : 'Direkt och saklig'}
SPRÅK: ${langFull}

Skapa ett komplett, välstrukturerat ${docType.label.toLowerCase()} med allt relevant innehåll.`;

  const userMsg = isUpdate
    ? `BEFINTLIGT DOKUMENT:\n${existingDoc.substring(0, 6000)}\n\nINSTRUKTIONER:\n${instructions}\n\nSkapa förbättrad version som komplett HTML.`
    : `Skapa ett ${docType.label.toLowerCase()}${title ? ` med titeln "${title}"` : ''} baserat på:\n\n${content}`;

  try {
    const { reply, provider } = await callBestProvider([
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMsg }
    ], true);

    const html = reply.replace(/^```html\n?|^```\n?|```$/gm, '').trim();
    if (!html || html.length < 200) throw new Error('Tomt svar');

    return res.status(200).json({ html, provider, type, title: title || docType.label });
  } catch(e) {
    return res.status(503).json({ error: 'Dokumentgenerering misslyckades: ' + e.message });
  }
}

// ══════════════════════════════════════════════
// MAIN ROUTER
// ══════════════════════════════════════════════
// ══════════════════════════════════════════════
// AUTO-SEARCH AGENT
// Detects when query needs current info → searches → injects into prompt
// ══════════════════════════════════════════════
function needsWebSearch(userMsg) {
  const lower = userMsg.toLowerCase();
  // Explicit search requests
  if(/sök|search|hitta|find|look up/i.test(lower)) return true;
  // Current info indicators
  if(/idag|nu|just nu|senaste|latest|current|news|nyheter|2024|2025|2026/i.test(lower)) return true;
  // Price/stock queries
  if(/pris|price|kurs|aktie|stock|bitcoin|krypto|crypto/i.test(lower)) return true;
  // Sports/events
  if(/match|score|resultat|vann|won|league|serie a|premier|nba|nfl/i.test(lower)) return true;
  // Weather (handled separately)
  // Product releases
  if(/nytt från|new from|released|launched|announced/i.test(lower)) return true;
  return false;
}

async function routeAgentSearch(req, res) {
  const { messages, lang = 'sv' } = req.body || {};
  if (!Array.isArray(messages) || !messages.length) return res.status(400).json({error:'messages required'});

  const lastUser = messages.filter(m=>m.role==='user').pop()?.content || '';

  // Step 1: Check if search needed
  if (!needsWebSearch(lastUser)) {
    // Just chat normally
    return await routeChat(req, res);
  }

  // Step 2: Extract search query
  let searchQuery = lastUser.substring(0, 100);
  // Clean up the query
  searchQuery = searchQuery.replace(/kan du|could you|please|tack|vill veta|tell me|berätta om/gi, '').trim();

  // Step 3: Search the web
  let searchContext = '';
  try {
    const braveKey = process.env.BRAVE_SEARCH_KEY;
    const serpKey = process.env.SERPAPI_KEY;
    let results = [];

    if (braveKey) {
      const r = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(searchQuery)}&count=4&search_lang=${lang}`, {
        headers: {'Accept':'application/json','X-Subscription-Token':braveKey}
      });
      if (r.ok) {
        const d = await r.json();
        results = (d.web?.results||[]).slice(0,4);
      }
    } else if (serpKey) {
      const r = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(searchQuery)}&api_key=${serpKey}&num=4`);
      if (r.ok) { const d = await r.json(); results = (d.organic_results||[]).slice(0,4); }
    } else {
      // DuckDuckGo fallback
      const r = await fetch(`https://api.duckduckgo.com/?q=${encodeURIComponent(searchQuery)}&format=json&no_redirect=1`);
      if (r.ok) {
        const d = await r.json();
        if (d.AbstractText) results.push({title:d.Heading,url:d.AbstractURL,snippet:d.AbstractText});
        (d.RelatedTopics||[]).slice(0,3).forEach(t=>{if(t.Text&&t.FirstURL)results.push({title:t.Text.slice(0,60),url:t.FirstURL,snippet:t.Text});});
      }
    }

    if (results.length > 0) {
      searchContext = '\n\nSÖKRESULTAT (aktuell info från webben):\n' +
        results.map((r,i) => `[${i+1}] ${r.title}\n${r.snippet||''}\nKälla: ${r.url}`).join('\n\n');
    }
  } catch(e) { console.warn('Auto-search failed:', e.message); }

  // Step 4: Inject search results into messages
  if (searchContext) {
    const newMessages = [...messages];
    const lastIdx = newMessages.length - 1;
    if (newMessages[lastIdx]?.role === 'user') {
      newMessages[lastIdx] = {
        ...newMessages[lastIdx],
        content: newMessages[lastIdx].content + searchContext +
          '\n\nBasera ditt svar på sökinformationen ovan. Nämn gärna att informationen är från webben.'
      };
    }
    req.body.messages = newMessages;
  }

  return await routeChat(req, res);
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const route = req.query.route || req.query.r || 'chat';

  try {
    switch(route) {
      case 'chat':     return await routeChat(req, res);
      case 'image':    return await routeImage(req, res);
      case 'music':    return await routeMusic(req, res);
      case 'weather':  return await routeWeather(req, res);
      case 'news':     return await routeNews(req, res);
      case 'search':   return await routeSearch(req, res);
      case 'analyze':  return await routeAnalyze(req, res);
      case 'cv':       return await routeCV(req, res);
      case 'website':  return await routeWebsite(req, res);
      case 'document': return await routeDocument(req, res);
      case 'agent':    return await routeAgentSearch(req, res);
      default:
        return res.status(404).json({error:`Unknown route: ${route}. Use ?route=chat|image|music|weather|news|search|analyze|cv|website|document`});
    }
  } catch(e) {
    console.error('Router error:', e);
    return res.status(500).json({error:'Internal error', details: e.message});
  }
}
