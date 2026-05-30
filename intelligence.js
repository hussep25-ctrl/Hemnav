// api/intelligence.js — JARVIS Intelligence Engine v3
// Kombinerar: Memory Extraction + RAG (Retrieval Augmented Generation)
// Endpoint: POST /api/intelligence
// Actions: extract | rag | both
// © 2025 Ctrl Labs (Hussein & Claude)

const OPENAI_KEY = process.env.OPENAI_KEY || process.env.OPENAI_API_KEY;
const GEMINI_KEYS = [
  process.env.GEMINI_KEY,
  process.env.GEMINI_KEY_1,
  process.env.GEMINI_KEY_2,
  process.env.GEMINI_KEY_3
].filter(Boolean);

// ══════════════════════════════════════════════════
// RAG KNOWLEDGE BASE — 25 ämnesblock
// ══════════════════════════════════════════════════
const KB = [
  { t:'javascript', c:'JavaScript: closure=funktion minns yttre scope. Prototype chain=arv via __proto__. Event loop: call stack + microtask queue (Promises) + callback queue. async/await=socker for Promises. ES2024: Array.groupBy, structuredClone, at(), Object.hasOwn.' },
  { t:'react', c:'React: useState (state), useEffect (sidoeffekter+cleanup), useCallback (memoize fn), useMemo (memoize varde), useRef (DOM utan re-render), useContext (konsumera ctx). React 18: concurrent, Suspense, automatic batching, useTransition, useDeferredValue.' },
  { t:'python', c:'Python: list comp [x for x in lst if x>0]. Generator: yield. Decorator: @functools.wraps. dataclass: @dataclass. Type hints: def f(x:int)->str. asyncio for async. Pandas groupby/agg. NumPy vectorized. walrus operator :=. match statement (3.10+).' },
  { t:'typescript', c:'TypeScript: interface (extensible) vs type (unions/intersections). Generics: fn<T>(x:T):T. Utility types: Partial/Required/Pick/Omit/Record/ReturnType. Strict mode. as const. satisfies. Template literal types. Conditional types. infer keyword.' },
  { t:'databas sql', c:'PostgreSQL: JSONB for semi-structured, tsvector for full-text, window functions (ROW_NUMBER,RANK,LAG,LEAD,SUM OVER). Indexes: B-tree (default), GIN (JSONB/arrays), partial. EXPLAIN ANALYZE for optimization. pgBouncer for connection pooling. UPSERT: ON CONFLICT.' },
  { t:'arkitektur system', c:'Microservices: API Gateway, Circuit Breaker, Saga pattern, CQRS, Event Sourcing. CAP theorem: CP eller AP. 12-Factor App. Strangler Fig for migration. Well-Architected: Operational Excellence, Security, Reliability, Performance, Cost, Sustainability.' },
  { t:'ai maskininlarning llm', c:'LLMs: Transformer (Vaswani 2017), attention mechanism, autoregressive generation. GPT=decoder-only. BERT=encoder bidirectional. Fine-tuning: anpassa fortranad modell. RLHF: reinforcement fran mansklig feedback. RAG: retrieval-augmented generation loser hallucination.' },
  { t:'fysik kvantfysik', c:'Kvantfysik: superposition, entanglement, uncertainty principle (delta_x*delta_p>=h/4pi). Schrodingers ekvation. Standardmodellen: quarks, leptons, gauge bosoner. Higgs 2012 CERN. Relativitetsteori: E=mc², tilatation, langdkontraktion. Gravitationsvågor LIGO 2016.' },
  { t:'biologi genetik', c:'CRISPR-Cas9: guide RNA leder Cas9 till DNA-sekvens for editering. Nobel 2020 Doudna&Charpentier. mRNA-vacciner: instruerar celler att producera spike-protein. Nobel 2023 Kariko&Weissman. AlphaFold loste proteinveckning 2021. CRISPR anvands nu mot cancer i kliniska tester.' },
  { t:'matematik kalkyl statistik', c:'Kalkyl: d/dx[xn]=nxn-1, sin(x)=cos(x), ex=ex, ln(x)=1/x. Kedjeregeln, produktregeln. Integral xn=xn+1/(n+1)+C. Fundamental theorem. Statistik: mean=sum/n, varians=sum(x-mu)2/n, z-score=(x-mu)/sigma. Normal: 68-95-99.7 regel. Bayesiansk inferens.' },
  { t:'historia varldshistoria', c:'WWI 1914-18: Franz Ferdinand, allianssystem, 20M doda. WWII 1939-45: Hitler, Holocaust 6M, D-day 1944, atombomb 1945, 70-85M doda totalt. Kalla kriget 1947-91: USA vs USSR, Kubakrisen 1962, Berlinmuren 1961-89. Kalla krigets slut: Sovjet kollapsade 1991.' },
  { t:'historia sverige', c:'Sverige: Vikingaiden 793-1066. Gustav Vasa 1523 (grundade Sverige). Stormaktstid 1611-1718. Neutralitet sedan 1814. Folkhemsbygget 1932-1970 (SAP). Bankkrisen 1990-93. EU 1995. Finanskris 2008. Corona 2020. NATO-medlen mars 2024. Riksbanken: reporantan styr inflation.' },
  { t:'halsa sovn', c:'Sovn (Matthew Walker): under 6h okar Alzheimers/cancer/hjarta risk dramatiskt. Stages: N1 insomnande, N2 50% med sovspindlar, N3 djupsovn (minne+immunforsvar), REM (emotioner+dromar). 4-6 cykler/natt a 90 min. Tips: 18C, morkt, konsistent tid, inget koffein efter 14, inget blaljus 1h fore.' },
  { t:'halsa traning', c:'Styrketraning: progressiv overlastning. Hypertrofi: 3-4 sets, 8-12 reps, 60-75% 1RM, 2x/vecka per muskelgrupp. Maxstyrka: 3-5 sets, 1-5 reps, 85%+. Aerob: 150 min/vecka moderat (3 MET). HIIT: 1-2x/vecka. Recovery: 48h mellan samma muskelgrupp. BDNF okar av traning.' },
  { t:'halsa kost nutrition', c:'Medelhavskost: starkast evidens. Protein 1.6g/kg for muskelbevar. Fiber 25-35g/dag for tarmmikrobiom. Omega-3 (fisk/lin/valnot). D-vitamin supplement okt-april (Sverige). Ultra-processed food: starkaste negativa kostprediktor. Intermittent fasting: insulinkanslighetsforbattring.' },
  { t:'psykologi kbt', c:'KBT: mest evidensbaserad terapi. Identifiera automatiska tankar, utmana kognitiva snedvridningar, beteendeexperiment. ACT: acceptera tankar, agera pa vardena. MBSR: mindfulness reducerar stress/angst. Motiverande samtal. Biaser: confirmation, anchoring, availability, sunk cost, dunning-kruger.' },
  { t:'business okr startup', c:'OKR: Objectives (inspirerande) + Key Results (matbara). Quarterly cadence. Stretch: 70% uppfyllelse=bra. Product-Market Fit: Sean Ellis >40% very disappointed. Unit economics: LTV:CAC>3:1, payback<12 man. North Star Metric. Lean: Build-Measure-Learn. Churn 5%/man=46%/ar.' },
  { t:'ekonomi finans aktier', c:'Aktier: P/E=pris/vinst, P/B=pris/eget kapital, ROE=vinst/eget kapital. DCF-vardering: diskonterade kassafloden. Indexfonder slar aktivt forvaltat >15 ar i 90%+ av fall. Diversifiering eliminerar osystematisk risk. Sharpe ratio=avkastning/volatilitet. Effektiva marknadshypotesen.' },
  { t:'filosofi stoicism', c:'Stoicism: fokusera pa det du kan kontrollera. Memento mori, amor fati. Marcus Aurelius, Epiktetos, Seneca. Paverkar modern KBT. Utilitarism: maximal lycka for flest (Bentham, Mill). Existentialism: Sartre "existensen forgaar essensen", radikal frihet, bad faith. Camus: absurdism.' },
  { t:'klimat miljo', c:'Klimat: CO2 nu 422ppm (hogst pa 3M ar). IPCC: nettonoll 2050 for 1.5C. Feedback-loopar: is-albedo, permafrost-metan. Fornybar: sol+vind nu billigaste elproduktionen. CCS: koldioxidinfangning. Biodiversitetskris: 1M arter hotade. Planetara granser: 6 av 9 overskridna.' },
  { t:'programmering git docker', c:'Git: branch, merge, rebase (linjar historik), cherry-pick, bisect, reflog. Conventional commits: feat/fix/docs/refactor/chore. Docker: Dockerfile->Image->Container. docker-compose for multi-container. Kubernetes for orkestrering. CI/CD: GitHub Actions, deployments pipeline.' },
  { t:'sakerhet cybersecurity', c:'OWASP Top 10 2023: Broken Access Control nr 1. Injection, Cryptographic Failures, XSS, Security Misconfiguration. JWT: aldrig i localStorage (XSS), anvand httpOnly cookies. HTTPS overallt. CSP headers. Rate limiting. Zero Trust: never trust always verify. SAST/DAST scanning.' },
  { t:'webb css design', c:'CSS: Flexbox (1D), Grid (2D). Custom properties (--var). Container queries. :has() pseudo-class. Specificity: id>class>element. BEM naming. Tailwind: utility-first. CSS-in-JS: styled-components. Animationer: transform/opacity (GPU-accelerated). Core Web Vitals: LCP, FID, CLS.' },
  { t:'api rest graphql', c:'REST: stateless, HTTP verbs (GET/POST/PUT/PATCH/DELETE), status codes (200/201/400/401/403/404/429/500). GraphQL: flexibel query, single endpoint, no over/under-fetching. gRPC: binart protokoll, snabbt for microservices. OpenAPI/Swagger for dokumentation. Versioning: /api/v1/.' },
  { t:'kreativitet skrivande', c:'Kreativt skrivande: show don\'t tell. Karaktarsutveckling via handlingar, inte beskrivningar. Three-act structure. Hero\'s journey. In medias res. Chekhov\'s gun. Aktiv vs passiv rost. Variera meningslangd for rytm. Metaforer: konkretisera abstrakta begrepp. Brainstorming: quantity over quality.' },
];

function similarity(text1, text2) {
  const w1 = new Set(text1.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const w2 = new Set(text2.toLowerCase().split(/\W+/).filter(w => w.length > 3));
  const intersection = [...w1].filter(w => w2.has(w)).length;
  const union = new Set([...w1, ...w2]).size;
  return union === 0 ? 0 : intersection / union;
}

function retrieve(query, k = 4, extraKB = []) {
  const q = (query || '').toLowerCase();
  const allKB = [...KB, ...extraKB];
  return allKB
    .map(chunk => ({ chunk, score: similarity(q, chunk.c + ' ' + chunk.t) }))
    .filter(x => x.score > 0.04)
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .map(x => x.chunk);
}

// ══════════════════════════════════════════════════
// MEMORY EXTRACTION
// ══════════════════════════════════════════════════
async function extractMemory(messages) {
  const conversation = messages
    .filter(m => m.role !== 'system')
    .slice(-12)
    .map(m => `${m.role === 'user' ? 'Anvandare' : 'JARVIS'}: ${(m.content || '').substring(0, 400)}`)
    .join('\n');

  const prompt = `Analysera konversationen. Returnera ENDAST JSON (inga kodblock):\n{"facts":["faktum om anvandaren"],"preferences":["vad anvandaren gillar"],"corrections":["fel JARVIS gjort"],"mood":"happy|neutral|frustrated|curious","topics":["amnen"]}\n\nKonversation:\n${conversation}\n\nTomma listor om inget hitttas.`;

  for (const key of GEMINI_KEYS) {
    try {
      const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${key}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { maxOutputTokens: 500, temperature: 0.1 }
        })
      });
      if (!r.ok) continue;
      const d = await r.json();
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return JSON.parse(text.replace(/```json|```/g, '').trim());
    } catch(e) {}
  }

  if (OPENAI_KEY) try {
    const r = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${OPENAI_KEY}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 500, temperature: 0.1,
        response_format: { type: 'json_object' }
      })
    });
    if (!r.ok) throw new Error('OpenAI memory extraction failed');
    const d = await r.json();
    return JSON.parse(d.choices?.[0]?.message?.content || '{}');
  } catch(e) {}

  return { facts: [], preferences: [], corrections: [], mood: 'neutral', topics: [] };
}

// ══════════════════════════════════════════════════
// HANDLER
// ══════════════════════════════════════════════════
export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const { action, messages, query, k = 4 } = req.body || {};

  try {
    // ── RAG: Hämta relevant kunskap ──
    if (action === 'rag') {
      const searchQuery = query || (messages || []).filter(m => m.role === 'user').slice(-2).map(m => m.content || '').join(' ');
      const extraKB = (req.body.userKB || []).map(k => ({ t: k.title || 'custom', c: k.content || '' }));
      const chunks = retrieve(searchQuery, k, extraKB);
      const context = chunks.length
        ? 'RELEVANT KUNSKAP:\n' + chunks.map(c => '[' + c.t.toUpperCase() + ']: ' + c.c).join('\n\n')
        : '';
      return res.status(200).json({ context, count: chunks.length, topics: chunks.map(c => c.t) });
    }

    // ── MEMORY: Extrahera fakta ──
    if (action === 'extract' && messages?.length) {
      const extracted = await extractMemory(messages);
      const facts = (extracted.facts || []).map(f => ({ content: f, type: 'fact', importance: 7 }));
      const prefs = (extracted.preferences || []).map(p => ({ content: p, type: 'preference', importance: 6 }));
      const corr = (extracted.corrections || []).map(c => ({ content: c, type: 'correction', importance: 9 }));
      return res.status(200).json({
        facts: [...facts, ...prefs, ...corr],
        mood: extracted.mood || 'neutral',
        topics: extracted.topics || []
      });
    }

    // ── BOTH: RAG + Memory i ett anrop ──
    if (action === 'both' && messages?.length) {
      const searchQuery = query || messages.filter(m => m.role === 'user').slice(-1)[0]?.content || '';
      const extraKB = (req.body.userKB || []).map(k => ({ t: k.title || 'custom', c: k.content || '' }));
      const [chunks, extracted] = await Promise.all([
        Promise.resolve(retrieve(searchQuery, k, extraKB)),
        extractMemory(messages)
      ]);
      const context = chunks.length
        ? 'RELEVANT KUNSKAP:\n' + chunks.map(c => '[' + c.t.toUpperCase() + ']: ' + c.c).join('\n\n')
        : '';
      const facts = [...
        (extracted.facts || []).map(f => ({ content: f, type: 'fact', importance: 7 })),
        ...(extracted.preferences || []).map(p => ({ content: p, type: 'preference', importance: 6 })),
        ...(extracted.corrections || []).map(c => ({ content: c, type: 'correction', importance: 9 }))
      ];
      return res.status(200).json({ context, facts, mood: extracted.mood || 'neutral', topics: extracted.topics || [] });
    }

    return res.status(400).json({ error: 'action required: rag | extract | both' });

  } catch(err) {
    console.error('Intelligence error:', err.message);
    return res.status(500).json({ error: 'Intelligence failed', details: err.message });
  }
}
