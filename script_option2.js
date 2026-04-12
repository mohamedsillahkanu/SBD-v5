const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbymRy-M5v0fVLWUjw4IXYhd1oIR2ZvnP_Dzr_iGR-Th0cMIpmE2ntGeujWYH7-C6NHIzA/exec',
    SHEET_URL:  'https://docs.google.com/spreadsheets/d/1cXlYiTMzcRP1BCj9mt1JXoK_pjgWbRtDEEQUPMg2HPs/edit?usp=sharing',
    CSV_FILE:   'cascading_data.csv',
    ADMIN_USER: 'admin',
    ADMIN_PASS: 'admin123'
};

// ============================================
// STATE
// ============================================
const state = {
    currentSection: 1,
    totalSections:  7,
    isOnline:       navigator.onLine,
    pendingSubmissions: [],
    drafts:         [],
    submittedSchools: [],
    signaturePads:  {},
    formStatus:     'draft',
    currentDraftId: null,
    charts:         {},
    currentUser:    null,
    isAdmin:        false
};
window.state = state;   // expose for ai_agent.js to read submittedSchools / pendingSubmissions

var ALL_LOCATION_DATA = {};
var USER_MAP      = {};
var LOCATION_DATA  = {};
let deferredPrompt    = null;

// ============================================
// CACHE IMAGES FOR OFFLINE USE
// ============================================
function cacheImagesForOffline() {
    const imagesToCache = [
        'ICF-SL.jpg','logo_mohs.png','logo_nmcp.png','logo_pmi.png',
        'infographics.png','favicon.svg','icon-192.svg'
    ];
    if ('caches' in window) {
        caches.open('itn-images-v1').then(cache => {
            imagesToCache.forEach(imageUrl => {
                fetch(imageUrl, { mode: 'no-cors' })
                    .then(response => { if (response.ok) cache.put(imageUrl, response); })
                    .catch(() => {
                        const fallback = {
                            'ICF-SL.jpg': 'https://github.com/mohamedsillahkanu/gdp-dashboard-2/raw/6c7463b0d5c3be150aafae695a4bcbbd8aeb1499/ICF-SL.jpg',
                            'infographics.png': 'https://raw.githubusercontent.com/mohamedsillahkanu/gdp-dashboard-2/main/infographics.png'
                        };
                        if (fallback[imageUrl]) {
                            fetch(fallback[imageUrl], { mode: 'no-cors' })
                                .then(r => { if (r.ok) cache.put(imageUrl, r); })
                                .catch(() => {});
                        }
                    });
            });
        });
    }
}

// ============================================
// PWA SERVICE WORKER
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => {
                console.log('[PWA] Service Worker registered');
                reg.addEventListener('updatefound', () => {
                    const nw = reg.installing;
                    nw.addEventListener('statechange', () => {
                        if (nw.state === 'installed' && navigator.serviceWorker.controller)
                            showNotification('App updated! Loading fresh version...', 'info');
                    });
                });
                cacheImagesForOffline();
            })
            .catch(err => console.error('[PWA] SW registration failed:', err));
    });

    // Listen for CLEAR_DRAFT from SW on update — wipe form state
    navigator.serviceWorker.addEventListener('message', function(event) {
        if (event.data && event.data.type === 'CLEAR_DRAFT') {
            try {
                localStorage.removeItem('itn_single_draft');
                localStorage.removeItem('itn_drafts');
                console.log('[PWA] Draft cleared on update');
            } catch(e) {}
        }
    });
}

// ============================================
// PWA INSTALL PROMPT
// ============================================
// ============================================
// PWA INSTALL BANNER
// ============================================

// Declare globals FIRST — before any HTML onclick="" could fire them
window.pwaDoInstall = async function() {
    if (!deferredPrompt) { console.warn('[PWA] No prompt'); return; }
    const btn = document.getElementById('pwaInstallBtn');
    if (btn) { btn.textContent = 'Installing…'; btn.disabled = true; }
    try {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        if (outcome === 'accepted') {
            _pwaSuccess();
        } else {
            _pwaBannerHide();
            if (btn) { btn.textContent = 'INSTALL'; btn.disabled = false; }
        }
    } catch(e) {
        console.error('[PWA]', e);
        if (btn) { btn.textContent = 'INSTALL'; btn.disabled = false; }
    }
};
window.pwaCloseBanner = function() { _pwaBannerHide(); };
function _pwaBannerShow() {
    const b = document.getElementById('pwaInstallBanner');
    if (b) setTimeout(() => { b.style.bottom = '16px'; }, 80);
}
function _pwaBannerHide() {
    const b = document.getElementById('pwaInstallBanner');
    if (b) b.style.bottom = '-120px';
}
function _pwaSuccess() {
    const c = document.getElementById('pwaInstallContent');
    if (c) c.innerHTML = `
      <div style="width:38px;height:38px;background:#28a745;border-radius:50%;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3" width="22" height="22"><polyline points="20 6 9 17 4 12"/></svg>
      </div>
      <div style="flex:1;">
        <div style="font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;color:#fff;">Installed! Open from your home screen.</div>
        <div style="font-size:11px;color:rgba(255,255,255,.75);margin-top:2px;">SBD 2026 works fully offline ✓</div>
      </div>`;
    const b = document.getElementById('pwaInstallBanner');
    if (b) b.style.border = '1.5px solid rgba(40,167,69,.7)';
    setTimeout(_pwaBannerHide, 3500);
}
function _pwaSyncNavBtn(show) {
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.display = show ? 'inline-flex' : 'none';
}
function _pwaInjectBanner() {
    if (document.getElementById('pwaInstallBanner')) return;
    const b = document.createElement('div');
    b.id = 'pwaInstallBanner';
    // Use setAttribute for inline style — immune to CSS overrides
    b.setAttribute('style',
        'position:fixed;bottom:-120px;left:50%;transform:translateX(-50%);' +
        'width:calc(100% - 24px);max-width:520px;' +
        'background:linear-gradient(135deg,#002952,#004080);' +
        'border-radius:14px;padding:13px 14px;' +
        'box-shadow:0 -2px 30px rgba(0,0,0,.4),0 8px 30px rgba(0,0,0,.3);' +
        'border:1.5px solid rgba(200,153,26,.45);' +
        'z-index:2147483647;' +
        'transition:bottom .4s cubic-bezier(.34,1.56,.64,1);' +
        'box-sizing:border-box;pointer-events:all;'
    );
    b.innerHTML =
        '<div id="pwaInstallContent" style="display:flex;align-items:center;gap:11px;pointer-events:all;">' +
          '<div style="width:42px;height:42px;background:#fff;border-radius:10px;flex-shrink:0;' +
               'overflow:hidden;display:flex;align-items:center;justify-content:center;' +
               'border:2px solid rgba(200,153,26,.4);">' +
            '<img src="./icons/icon-192.png" width="38" height="38" style="object-fit:contain;" ' +
            '>' +
          '</div>' +
          '<div style="flex:1;min-width:0;">' +
            '<div style="font-family:Oswald,sans-serif;font-size:13px;font-weight:700;color:#fff;' +
                 'letter-spacing:.4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' +
              'SBD 2026 — ITN Survey' +
            '</div>' +
            '<div style="font-size:11px;color:rgba(255,255,255,.72);margin-top:2px;">' +
              'Install for offline use &amp; quick access' +
            '</div>' +
          '</div>' +
          '<button id="pwaInstallBtn" ' +
            'onclick="window.pwaDoInstall()" ' +
            'style="background:#c8991a;color:#fff;border:none;border-radius:8px;' +
                   'padding:10px 20px;font-family:Oswald,sans-serif;font-size:13px;' +
                   'font-weight:700;letter-spacing:.6px;cursor:pointer;white-space:nowrap;' +
                   'flex-shrink:0;pointer-events:all;' +
                   '-webkit-tap-highlight-color:rgba(0,0,0,0);touch-action:manipulation;">' +
            'INSTALL' +
          '</button>' +
          '<button ' +
            'onclick="window.pwaCloseBanner()" ' +
            'style="background:rgba(255,255,255,.16);color:#fff;border:none;border-radius:6px;' +
                   'min-width:32px;height:32px;cursor:pointer;font-size:18px;flex-shrink:0;' +
                   'display:flex;align-items:center;justify-content:center;pointer-events:all;' +
                   '-webkit-tap-highlight-color:rgba(0,0,0,0);touch-action:manipulation;">' +
            '&#x2715;' +
          '</button>' +
        '</div>';
    document.body.appendChild(b);
}

window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    // Update the existing HTML install button to show it's ready
    const btn = document.getElementById('installBtn');
    if (btn) {
        btn.textContent = 'INSTALL';
        btn.disabled    = false;
        btn.style.background = '#28a745'; // green = ready to install
    }
    _pwaInjectBanner();
    _pwaBannerShow();
    console.log('[PWA] Install prompt ready — button active');
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    _pwaSuccess();
    const banner = document.getElementById('installBanner');
    if (banner) banner.style.display = 'none';
    console.log('[PWA] Installed');
});

// Global install handler — called directly by onclick
window.pwaInstallClick = async function() {
    console.log('[PWA] Install clicked, prompt available:', !!deferredPrompt);
    if (deferredPrompt) {
        const btn = document.getElementById('installBtn');
        if (btn) { btn.textContent = 'Installing…'; btn.disabled = true; }
        try {
            deferredPrompt.prompt();
            const { outcome } = await deferredPrompt.userChoice;
            deferredPrompt = null;
            if (outcome === 'accepted') {
                if (btn) { btn.textContent = '✓ Installed!'; btn.style.background = '#28a745'; }
                showNotification('Installed! Open from your home screen.', 'success');
                setTimeout(() => {
                    const b = document.getElementById('installBanner');
                    if (b) b.style.display = 'none';
                }, 3000);
            } else {
                if (btn) { btn.textContent = 'INSTALL'; btn.disabled = false; }
            }
        } catch(e) {
            console.error('[PWA]', e);
            const btn2 = document.getElementById('installBtn');
            if (btn2) { btn2.textContent = 'INSTALL'; btn2.disabled = false; }
        }
        return;
    }
    // No prompt — show instructions using app notification (not alert)
    const isIOS     = /iphone|ipad|ipod/i.test(navigator.userAgent);
    const isAndroid = /android/i.test(navigator.userAgent);
    if (isIOS)
        showNotification('Tap Share (↑) then "Add to Home Screen"', 'info');
    else if (isAndroid)
        showNotification('Tap browser menu (⋮) → "Add to Home Screen" or "Install App"', 'info');
    else
        showNotification('Click the install icon (⊕) in your browser address bar', 'info');
};

function setupInstallButton() {
    const btn = document.getElementById('installBtn');
    if (!btn) return;
    // Running as installed PWA — hide banner
    if (window.matchMedia('(display-mode: standalone)').matches ||
        window.navigator.standalone === true) {
        const b = document.getElementById('installBanner');
        if (b) b.style.display = 'none';
        return;
    }
    btn.style.display = 'inline-flex';
    btn.style.opacity = '1';
    btn.setAttribute('onclick', 'window.pwaInstallClick()');
}

function showBanner()        { _pwaBannerShow(); }
function hideBanner()        { _pwaBannerHide(); }
function showInstallSuccess(){ _pwaSuccess(); }
function syncNavInstallBtn(s){}
function injectInstallBanner(){ _pwaInjectBanner(); }

// ============================================
// APP UPDATE
// ============================================
window.updateApp = async function() {
    const btn = document.getElementById('updateAppBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg> UPDATING...';
    showNotification('Clearing cache and updating…', 'info');
    try {
        // Tell active SW to skip waiting
        if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
            navigator.serviceWorker.controller.postMessage({ type: 'SKIP_WAITING' });
            navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_CACHE' });
        }
        // Unregister all service workers
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) await r.unregister();
        }
        // Wipe all caches
        if ('caches' in window) {
            const names = await caches.keys();
            await Promise.all(names.map(n => caches.delete(n)));
        }
        showNotification('Update complete! Reloading…', 'success');
        setTimeout(() => window.location.reload(true), 800);
    } catch (err) {
        console.error('[Update] Failed:', err);
        showNotification('Update failed — try again.', 'error');
        btn.disabled = false;
        btn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg> UPDATE';
    }
};

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    loadFromStorage();
    injectSummaryModal();
    setupInstallButton();
    // Update status immediately on load
    state.isOnline = navigator.onLine;
    const _st = document.getElementById('statusText');
    if (_st) _st.textContent = state.isOnline ? 'ONLINE' : 'OFFLINE';
    try {
        await loadLocationData();
    } catch (e) {
        console.warn('Could not load location data:', e);
    }
    // showLoginScreen is overridden by ai_agent.js to auto-start without login
    showLoginScreen();
}

function loadFromStorage() {
    try {
        state.pendingSubmissions = JSON.parse(localStorage.getItem('itn_pending')   || '[]');
        state.drafts             = JSON.parse(localStorage.getItem('itn_drafts')    || '[]');
        state.submittedSchools   = JSON.parse(localStorage.getItem('itn_submitted') || '[]');
    } catch (e) {
        state.pendingSubmissions = [];
        state.drafts = [];
        state.submittedSchools = [];
    }
}

function saveToStorage() {
    localStorage.setItem('itn_pending',   JSON.stringify(state.pendingSubmissions));
    localStorage.setItem('itn_drafts',    JSON.stringify(state.drafts));
    localStorage.setItem('itn_submitted', JSON.stringify(state.submittedSchools));
}

function setDefaultDate() {
    const today = new Date().toISOString().split('T')[0];
    const s = document.getElementById('survey_date');
    const d = document.getElementById('distribution_date');
    if (s && !s.value) s.value = today;
    if (d && !d.value) d.value = today;
}

function formatDate(dateString) {
    if (!dateString) return '—';
    try {
        const date = new Date(dateString);
        if (isNaN(date.getTime())) return dateString;
        return date.toLocaleString('en-SL', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch (e) { return dateString; }
}

// ============================================
// INJECT SUMMARY MODAL
// ============================================
function injectSummaryModal() {
    if (document.getElementById('summaryModal')) return;
    document.body.insertAdjacentHTML('beforeend', `
    <div class="modal-overlay" id="summaryModal">
      <div class="modal-content large" id="summaryModalContent">
        <div class="modal-header" style="background:#004080;">
          <span class="modal-title">
            <svg class="modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>SCHOOL COVERAGE SUMMARY
          </span>
          <div style="display:flex;align-items:center;gap:8px;margin-left:auto;">
            <button id="summaryRefreshBtn" onclick="window.refreshSummaryFromServer()"
              style="background:rgba(255,255,255,.15);border:1px solid rgba(255,255,255,.4);color:#fff;border-radius:7px;padding:6px 13px;font-family:'Oswald',sans-serif;font-size:11px;font-weight:700;cursor:pointer;letter-spacing:.5px;display:flex;align-items:center;gap:6px;transition:all .2s;"
              onmouseover="this.style.background='rgba(255,255,255,.25)'" onmouseout="this.style.background='rgba(255,255,255,.15)'">
              <svg id="summaryRefreshIcon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="14" height="14">
                <polyline points="1 4 1 10 7 10"/>
                <path d="M3.51 15a9 9 0 1 0 .49-4.95"/>
              </svg>
              REFRESH
            </button>
            <button class="modal-close" onclick="closeSummaryModal()">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
        <div class="modal-body" id="summaryModalBody"></div>
      </div>
    </div>
    <div class="modal-overlay" id="schoolDetailModal">
      <div class="modal-content large" id="schoolDetailContent">
        <div class="modal-header" style="background:#004080;">
          <span class="modal-title" id="schoolDetailTitle">SCHOOL DETAIL</span>
          <button class="modal-close" onclick="closeSchoolDetailModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="modal-body" id="schoolDetailBody"></div>
      </div>
    </div>`);
}

// ============================================
// USER MANAGEMENT  (login removed — auto-start via ai_agent.js)
// ============================================
function showLoginScreen() {
    // This is overridden by ai_agent.js patchAutoStart() to skip login.
    // Fallback: show loginScreen if it somehow becomes visible
    const ls = document.getElementById('loginScreen');
    if (ls) ls.style.display = 'none';
    const am = document.getElementById('appMain');
    if (am) am.style.display = 'flex';
    // Trigger startApp directly
    state.currentUser = 'admin';
    state.isAdmin     = true;
    LOCATION_DATA     = ALL_LOCATION_DATA;
    startApp('ICF-SL', true);
}

function hideLoginScreen() {
    const ls = document.getElementById('loginScreen');
    if (ls) ls.style.display = 'none';
    const am = document.getElementById('appMain');
    if (am) { am.style.display = 'flex'; am.style.flexDirection = 'column'; }
    cacheImagesForOffline();
}

window.handleLogin = function() {
    // No-op: login not required. Auto-started by ai_agent.js / showLoginScreen override.
    state.currentUser = 'admin';
    state.isAdmin     = true;
    LOCATION_DATA     = ALL_LOCATION_DATA;
    startApp('ICF-SL', true);
};

function startApp(displayName, isAdmin) {
    // Null-safe: currentUserDisplay and adminBadge may not exist if login UI removed
    const displayEl = document.getElementById('currentUserDisplay');
    if (displayEl) displayEl.textContent = displayName;
    const badge = document.getElementById('adminBadge');
    if (badge) badge.style.display = isAdmin ? 'inline' : 'none';

    const sbField = document.getElementById('submitted_by');
    if (sbField) sbField.value = state.currentUser || '';

    hideLoginScreen();
    updateOnlineStatus();
    updateCounts();
    setupEventListeners();
    populateDistricts();
    setupCascading();
    setupSchoolSubmissionCheck();
    setupValidation();
    setupPhoneValidation();
    setupNameValidation();
    setupCalculations();
    setupAutoSave();
    initAllSignaturePads();
    captureGPS();
    setDefaultDate();
    updateProgress();
    updateSummaryBadge();
    restoreDraftIfExists();

    showNotification('Welcome to ICF Collect!', 'success');
}

window.handleLogout = function() {
    // Overridden by ai_agent.js to be a no-op. Kept as fallback.
};

// ============================================
// USER MAP
// ============================================
function buildUserMap(rows) {
    USER_MAP = {};
    rows.forEach(row => {
        const u = (row.username || '').trim().toLowerCase();
        if (!u) return;
        if (!USER_MAP[u]) USER_MAP[u] = [];
        USER_MAP[u].push(row);
    });
}

// ── CSV column reader — robust against BOM, extra spaces, case variations ──────
// Normalised key map built once from the first data row
let _csvKeyMap = null;   // { 'district': 'District', 'name of phu': 'Name of PHU', ... }

function buildCsvKeyMap(firstRow) {
    _csvKeyMap = {};
    Object.keys(firstRow).forEach(k => {
        const clean = k.replace(/^\uFEFF/, '').trim().toLowerCase();
        _csvKeyMap[clean] = k;
    });
    console.log('[CSV] Headers detected:', Object.values(_csvKeyMap));
}

function csvCol(row, ...names) {
    for (const n of names) {
        // 1. Exact key match
        const v = (row[n] || '').trim();
        if (v) return v;
        // 2. Normalised match (handles BOM / spaces / case)
        if (_csvKeyMap) {
            const orig = _csvKeyMap[n.toLowerCase()];
            if (orig) {
                const v2 = (row[orig] || '').trim();
                if (v2) return v2;
            }
        }
    }
    return '';
}

function buildFilteredLocationData(rows) {
    if (rows.length > 0) buildCsvKeyMap(rows[0]);
    const f = {};
    rows.forEach(row => {
        const d   = csvCol(row, 'District',    'adm1');
        const c   = csvCol(row, 'Chiefdom',    'adm2');
        const fac = csvCol(row, 'Name of PHU', 'hf',   'adm3');
        const com = csvCol(row, 'Community',   'community');
        const sch = csvCol(row, 'School Name', 'school_name');
        if (!d || !c || !fac || !com || !sch) return;
        if (!f[d]) f[d]={};
        if (!f[d][c]) f[d][c]={};
        if (!f[d][c][fac]) f[d][c][fac]={};
        if (!f[d][c][fac][com]) f[d][c][fac][com]=[];
        if (!f[d][c][fac][com].includes(sch)) f[d][c][fac][com].push(sch);
    });
    for (const d in f) for (const c in f[d]) for (const fac in f[d][c])
        for (const com in f[d][c][fac])
            f[d][c][fac][com].sort();
    return f;
}

// ============================================
// LOCATION DATA (CSV)
// ============================================
function loadLocationData() {
    return new Promise((resolve, reject) => {
        Papa.parse(CONFIG.CSV_FILE, {
            download: true,
            header: true,
            skipEmptyLines: true,
            transformHeader: h => h.replace(/^\uFEFF/, '').trim(), // strip BOM + spaces from headers
            complete(results) {
                ALL_LOCATION_DATA = {};
                if (!results.data || results.data.length === 0) {
                    console.warn('[CSV] No data rows in', CONFIG.CSV_FILE);
                    LOCATION_DATA = ALL_LOCATION_DATA;
                    resolve(); return;
                }

                buildCsvKeyMap(results.data[0]);
                buildUserMap(results.data);

                let loaded = 0, skipped = 0;
                const _seenKeys  = new Set();    // full 5-part keys seen so far
                const _dupRows   = [];           // duplicate rows found
                window.CSV_DUPLICATES = [];      // expose for ai_agent.js Targets tab
                window.CSV_SCHOOL_DATA = {};     // key → {enrollment, emis, status}

                results.data.forEach((row, rowIdx) => {
                    const d   = csvCol(row, 'District',    'adm1');
                    const c   = csvCol(row, 'Chiefdom',    'adm2');
                    const fac = csvCol(row, 'Name of PHU', 'hf', 'adm3');
                    const com = csvCol(row, 'Community',   'community');
                    const sch = csvCol(row, 'School Name', 'school_name');
                    if (!d || !c || !fac || !com || !sch) { skipped++; return; }

                    // Full 5-part uniqueness key
                    const fullKey = [d,c,fac,com,sch].map(v=>v.trim().toLowerCase()).join('|');

                    if (_seenKeys.has(fullKey)) {
                        _dupRows.push({ row: rowIdx + 2, district: d, chiefdom: c, phu: fac, community: com, school: sch, key: fullKey });
                        return;
                    }
                    _seenKeys.add(fullKey);

                    if (!ALL_LOCATION_DATA[d]) ALL_LOCATION_DATA[d]={};
                    if (!ALL_LOCATION_DATA[d][c]) ALL_LOCATION_DATA[d][c]={};
                    if (!ALL_LOCATION_DATA[d][c][fac]) ALL_LOCATION_DATA[d][c][fac]={};
                    if (!ALL_LOCATION_DATA[d][c][fac][com]) ALL_LOCATION_DATA[d][c][fac][com]=[];
                    ALL_LOCATION_DATA[d][c][fac][com].push(sch);

                    // Store school metadata for auto-fill
                    // Try all common spellings for each column
                    const _enr = csvCol(row,
                        'School enrollment', 'School Enrollment', 'school_enrollment',
                        'enrollment', 'Enrollment', 'ENROLLMENT') || '';
                    const _emis = csvCol(row,
                        'EMIS Number', 'EMIS number', 'emis_number',
                        'emis', 'EMIS', 'Emis Number') || '';
                    const _status = csvCol(row,
                        'School Status', 'school_status', 'status',
                        'Status', 'STATUS', 'School status') || '';
                    window.CSV_SCHOOL_DATA[fullKey] = {
                        enrollment: _enr,
                        emis:       _emis,
                        status:     _status
                    };
                    loaded++;
                });

                // Expose duplicates for the Targets tab warning
                window.CSV_DUPLICATES = _dupRows;
                if (_dupRows.length > 0) {
                    console.warn(`[CSV] ${_dupRows.length} duplicate row(s) found and skipped:`);
                    _dupRows.forEach(r => console.warn(`  Row ${r.row}: ${r.district} > ${r.chiefdom} > ${r.phu} > ${r.community} > ${r.school}`));
                }

                for (const d in ALL_LOCATION_DATA) for (const c in ALL_LOCATION_DATA[d])
                    for (const fac in ALL_LOCATION_DATA[d][c])
                        for (const com in ALL_LOCATION_DATA[d][c][fac])
                            ALL_LOCATION_DATA[d][c][fac][com].sort();

                // Expose for cascading dropdowns
                LOCATION_DATA = ALL_LOCATION_DATA;
                window.ALL_LOCATION_DATA = ALL_LOCATION_DATA;   // ai_agent.js reads window.ALL_LOCATION_DATA
                window.LOCATION_DATA     = ALL_LOCATION_DATA;

                // Debug — log first few CSV_SCHOOL_DATA entries
                const _sampleKeys = Object.keys(window.CSV_SCHOOL_DATA).slice(0,3);
                _sampleKeys.forEach(k => console.log('[CSV_SCHOOL_DATA]', k, '->', JSON.stringify(window.CSV_SCHOOL_DATA[k])));
                const dCount = Object.keys(ALL_LOCATION_DATA).length;
                console.log(`[CSV] ${loaded} rows loaded → ${dCount} district(s). Skipped: ${skipped}`);
                if (dCount === 0) {
                    console.error('[CSV] No districts loaded! Check CSV column names:', Object.values(_csvKeyMap || {}));
                }
                resolve();
            },
            error(err) {
                console.error('[CSV] Parse error:', err);
                reject(err);
            }
        });
    });
}

function populateDistricts() {
    const sel = document.getElementById('district');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select District...</option>';
    Object.keys(LOCATION_DATA).sort().forEach(d => {
        const o = document.createElement('option');
        o.value = d; o.textContent = d; sel.appendChild(o);
    });
    updateCount('district', Object.keys(LOCATION_DATA).length);
}

// Structure: LOCATION_DATA[district][chiefdom][phu][community] = [schools]
function setupCascading() {
    const district  = document.getElementById('district');
    const chiefdom  = document.getElementById('chiefdom');
    const facility  = document.getElementById('facility');   // PHU
    const community = document.getElementById('community');
    const school    = document.getElementById('school_name');
    if (!district) return;

    // Hide / disable the section field since new CSV has no Section level
    const sectionWrap = document.getElementById('section_loc')?.closest('.form-group, .fg, div[class]');
    const sectionEl   = document.getElementById('section_loc');
    if (sectionEl) {
        sectionEl.value = '';
        sectionEl.disabled = true;
        // Hide the parent wrapper if it exists
        if (sectionWrap && sectionWrap !== document.body) sectionWrap.style.display = 'none';
    }

    district.addEventListener('change', function() {
        resetSelect(chiefdom,  'Select Chiefdom...');
        resetSelect(facility,  'Select Health Facility...');
        resetSelect(community, 'Select Community...');
        resetSelect(school,    'Select School...');
        ['chiefdom','facility','community','school_name'].forEach(clearCount);
        const d = this.value;
        if (d && LOCATION_DATA[d]) {
            chiefdom.disabled = false;
            Object.keys(LOCATION_DATA[d]).sort().forEach(c => appendOpt(chiefdom, c));
            updateCount('chiefdom', Object.keys(LOCATION_DATA[d]).length);
        }
    });

    chiefdom.addEventListener('change', function() {
        resetSelect(facility,  'Select Health Facility...');
        resetSelect(community, 'Select Community...');
        resetSelect(school,    'Select School...');
        ['facility','community','school_name'].forEach(clearCount);
        const d=district.value, c=this.value;
        if (d && c && LOCATION_DATA[d]?.[c]) {
            facility.disabled = false;
            Object.keys(LOCATION_DATA[d][c]).sort().forEach(f => appendOpt(facility, f));
            updateCount('facility', Object.keys(LOCATION_DATA[d][c]).length);
        }
    });

    facility.addEventListener('change', function() {
        resetSelect(community, 'Select Community...');
        resetSelect(school,    'Select School...');
        ['community','school_name'].forEach(clearCount);
        const d=district.value, c=chiefdom.value, f=this.value;
        if (d && c && f && LOCATION_DATA[d]?.[c]?.[f]) {
            community.disabled = false;
            Object.keys(LOCATION_DATA[d][c][f]).sort().forEach(com => appendOpt(community, com));
            updateCount('community', Object.keys(LOCATION_DATA[d][c][f]).length);
        }
    });

    community.addEventListener('change', function() {
        resetSelect(school, 'Select School...');
        clearCount('school_name');
        const d=district.value, c=chiefdom.value, f=facility.value, com=this.value;
        if (d && c && f && com && LOCATION_DATA[d]?.[c]?.[f]?.[com]) {
            school.disabled = false;
            LOCATION_DATA[d][c][f][com].forEach(sch => appendOpt(school, sch));
            updateCount('school_name', LOCATION_DATA[d][c][f][com].length);
        }
    });
}

function appendOpt(sel, val) {
    const o = document.createElement('option');
    o.value = val; o.textContent = val; sel.appendChild(o);
}

function resetSelect(el, placeholder) {
    if (!el) return;
    el.innerHTML = '<option value="">' + placeholder + '</option>';
    el.disabled = true;
}

function updateCount(id, count) {
    const el = document.getElementById('count_' + id);
    if (el) el.textContent = count + ' options';
}

function clearCount(id) {
    const el = document.getElementById('count_' + id);
    if (el) el.textContent = '';
}

// ============================================
// SCHOOL SUBMISSION CHECK
// ============================================
// ── Duplicate check state ────────────────────────────────────
// Tracks the async online check result for the currently selected school
const _dupCheck = {
    key:       null,   // key being checked
    pending:   false,  // GAS request in flight
    duplicate: false,  // result: is it a duplicate?
    source:    null    // 'local' | 'online'
};

// ── Check GAS for duplicate (online) ────────────────────────
async function checkDuplicateOnline(key) {
    if (!key || !state.isOnline) return false;
    try {
        const parts = key.split('|'); // district|chiefdom|facility|community|school
        const params = new URLSearchParams({
            action:    'checkDuplicate',
            district:  parts[0] || '',
            chiefdom:  parts[1] || '',
            facility:  parts[2] || '',
            community: parts[3] || '',
            school:    parts[4] || ''
        });
        const res = await Promise.race([
            fetch(CONFIG.SCRIPT_URL + '?' + params.toString()),
            new Promise((_,rej) => setTimeout(() => rej(new Error('timeout')), 5000))
        ]);
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.exists;
    } catch(e) {
        console.warn('[DupCheck] Online check failed:', e.message);
        return false; // fail open — don't block if GAS unreachable
    }
}

// ── Central duplicate check (local first, then online) ───────
async function isDuplicateSubmission(key) {
    if (!key) return { duplicate: false, source: null };

    // 1. Check localStorage / session
    if (isSchoolSubmitted(key)) {
        return { duplicate: true, source: 'local' };
    }

    // 2. Check pending (offline queue)
    const inPending = state.pendingSubmissions.some(r => {
        return makeSchoolKey(r.district, r.chiefdom,
                             r.facility, r.community, r.school_name) === key;
    });
    if (inPending) return { duplicate: true, source: 'pending' };

    // 3. Check already-fetched sheet rows from analysis (if available)
    if (window._sheetRows && window._sheetRows.length > 0) {
        const inSheet = window._sheetRows.some(r =>
            makeSchoolKey(r.district, r.chiefdom,
                          r.facility, r.community, r.school_name) === key
        );
        if (inSheet) return { duplicate: true, source: 'online' };
    }

    // 4. Ask GAS directly
    const onlineDup = await checkDuplicateOnline(key);
    if (onlineDup) return { duplicate: true, source: 'online' };

    return { duplicate: false, source: null };
}

function setupSchoolSubmissionCheck() {
    const schoolSel = document.getElementById('school_name');
    if (!schoolSel) return;

    schoolSel.addEventListener('change', async function() {
        const key = currentSchoolKey();

        // ── Show cascading block + common fields + nav ──────────
        const mb  = document.getElementById('manualEntryBlock');
        const nav = document.getElementById('sectionBNav');
        if (mb)  mb.style.display  = 'block';
        if (key && nav) nav.style.display = 'flex';

        // ── Auto-populate from CSV when school selected ──────────
        const meta = window.CSV_SCHOOL_DATA && window.CSV_SCHOOL_DATA[key];
        const enrGrp  = document.getElementById('enrollment-group');
        const emisGrp = document.getElementById('emis-group');
        const stGrp   = document.getElementById('status-group');
        const enrEl   = document.getElementById('school_enrollment');
        const emisEl  = document.getElementById('emis_number');
        const stEl    = document.getElementById('school_status');

        if (meta) {
            // Enrollment
            if (meta.enrollment && enrEl && enrGrp) {
                enrEl.value = meta.enrollment;
                enrGrp.style.display = 'block';
            } else if (enrGrp) enrGrp.style.display = 'none';

            // EMIS — always show so user can fill if CSV has no value
            if (emisEl) emisEl.value = meta.emis || '';
            if (emisGrp) emisGrp.style.display = 'block';

            // Status — always show if available (Old or New from CSV)
            if (meta.status && stEl && stGrp) {
                stEl.value = meta.status;
                stGrp.style.display = 'block';
            } else if (stGrp) stGrp.style.display = 'none';
        } else {
            // School not in CSV — hide and clear all
            [enrEl, emisEl, stEl].forEach(function(el) { if(el) el.value = ''; });
            [enrGrp, emisGrp, stGrp].forEach(function(g) { if(g) g.style.display = 'none'; });
        }

        // Reset state when school changes
        _dupCheck.key       = key;
        _dupCheck.duplicate = false;
        _dupCheck.source    = null;
        _dupCheck.pending   = false;

        const banner  = document.getElementById('schoolSubmittedBanner');
        const nextBtn = document.querySelector('.form-section[data-section="2"] .btn-next');

        if (!key) {
            if (banner)  banner.style.display = 'none';
            if (nextBtn) { nextBtn.disabled = false; nextBtn.title = ''; }
            return;
        }

        // Show a subtle checking indicator on the Next button
        if (nextBtn) {
            nextBtn.disabled = true;
            nextBtn.title    = 'Checking for duplicate submission…';
        }
        _dupCheck.pending = true;

        const { duplicate, source } = await isDuplicateSubmission(key);

        // Only act if the user hasn't changed school while we were checking
        if (_dupCheck.key !== key) return;

        _dupCheck.pending   = false;
        _dupCheck.duplicate = duplicate;
        _dupCheck.source    = source;

        if (duplicate) {
            if (!document.getElementById('schoolSubmittedBanner')) injectSubmittedBanner();
            const b = document.getElementById('schoolSubmittedBanner');
            if (b) {
                // Update message based on source
                const srcLabel = source === 'online'  ? '(confirmed on ICF-SL Server)' :
                                 source === 'pending' ? '(in offline queue)'          :
                                                        '(submitted this session)';
                const msgEl = b.querySelector('.dup-source-msg');
                if (msgEl) msgEl.textContent = srcLabel;
                b.style.display = 'flex';
            }
            if (nextBtn) {
                nextBtn.disabled = true;
                nextBtn.title    = 'This school has already been submitted — duplicate entry not allowed.';
            }
        } else {
            if (banner)  banner.style.display = 'none';
            if (nextBtn) { nextBtn.disabled = false; nextBtn.title = ''; }
        }
    });
}

function injectSubmittedBanner() {
    const section2 = document.querySelector('.form-section[data-section="3"]');
    if (!section2) return;
    const banner = document.createElement('div');
    banner.id = 'schoolSubmittedBanner';
    banner.style.cssText = [
        'display:none',
        'background:#fff0f0',
        'border:2px solid #dc3545',
        'border-radius:10px',
        'padding:14px 16px',
        'margin-bottom:16px',
        'align-items:flex-start',
        'gap:12px'
    ].join(';');
    banner.innerHTML = `
      <svg style="width:28px;height:28px;stroke:#dc3545;flex-shrink:0;margin-top:2px" viewBox="0 0 24 24" fill="none" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
      </svg>
      <div style="flex:1;">
        <div style="font-size:13px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">
          ⛔ DUPLICATE — SUBMISSION NOT ALLOWED
        </div>
        <div style="font-size:12px;color:#555;line-height:1.6;">
          This school has <strong>already been submitted</strong> with the same District, Chiefdom, Section, PHU, Community and School Name.
          <span class="dup-source-msg" style="color:#004080;font-weight:600;"></span>
          <br>Please choose a <strong>different school</strong> or contact your supervisor.
          <br><a href="#" onclick="viewSubmittedSchoolFromBanner(); return false;"
             style="color:#004080;font-weight:600;text-decoration:underline;margin-top:4px;display:inline-block;">
             View existing submission details →
          </a>
        </div>
      </div>`;
    const nav = section2.querySelector('.navigation-buttons');
    if (nav) section2.insertBefore(banner, nav);
    else section2.appendChild(banner);
}

window.viewSubmittedSchoolFromBanner = function() {
    const key = currentSchoolKey();
    if (key) openSchoolDetail(key);
};

function currentSchoolKey() {
    try {
        const district  = document.getElementById('district')?.value    || '';
        const chiefdom  = document.getElementById('chiefdom')?.value    || '';
        const facility  = document.getElementById('facility')?.value    || '';
        const community = document.getElementById('community')?.value   || '';
        const school    = document.getElementById('school_name')?.value || '';
        if (!district||!chiefdom||!facility||!community||!school) return null;
        return [district,chiefdom,facility,community,school]
            .map(s=>s.trim().toLowerCase()).join('|');
    } catch (e) { return null; }
}

function isNewSchool(district, chiefdom, facility, community, school) {
    try {
        const key = [district,chiefdom,facility,community,school]
            .map(s=>(s||'').toString().trim().toLowerCase()).join('|');
        const d = window.ALL_LOCATION_DATA;
        if (!d) return false;
        // If key exists in CSV_SCHOOL_DATA it's an existing school
        if (window.CSV_SCHOOL_DATA && window.CSV_SCHOOL_DATA[key]) return false;
        // Also check ALL_LOCATION_DATA structure
        const dKey = Object.keys(d).find(k=>k.toLowerCase()===district.toLowerCase());
        if (!dKey) return true;
        const cKey = Object.keys(d[dKey]).find(k=>k.toLowerCase()===chiefdom.toLowerCase());
        if (!cKey) return true;
        const fKey = Object.keys(d[dKey][cKey]).find(k=>k.toLowerCase()===facility.toLowerCase());
        if (!fKey) return true;
        const comKey = Object.keys(d[dKey][cKey][fKey]).find(k=>k.toLowerCase()===community.toLowerCase());
        if (!comKey) return true;
        const schools = d[dKey][cKey][fKey][comKey];
        return !schools.some(s=>s.toLowerCase()===school.toLowerCase());
    } catch(e) { return false; }
}

function makeSchoolKey(district, chiefdom, facility, community, school) {
    return [district,chiefdom,facility,community,school]
        .map(s=>(s||'').toString().trim().toLowerCase()).join('|');
}

function isSchoolSubmitted(key) {
    if (!key) return false;
    return state.submittedSchools.some(s => s.key === key);
}

function getSubmittedRecord(key) {
    return state.submittedSchools.find(s => s.key === key) || null;
}

function getAllAssignedSchools() {
    const schools = [];
    const data = ALL_LOCATION_DATA;
    try {
        for (const district in data)
            for (const chiefdom in data[district])
                for (const facility in data[district][chiefdom])
                    for (const community in data[district][chiefdom][facility]) {
                        const schoolList = data[district][chiefdom][facility][community];
                        if (Array.isArray(schoolList))
                            schoolList.forEach(school => schools.push({
                                district, chiefdom, facility, community,
                                school_name: school,
                                key: makeSchoolKey(district,chiefdom,facility,community,school)
                            }));
                    }
    } catch (e) { console.error('getAllAssignedSchools:', e); }
    return schools;
}

// ============================================
// SUMMARY MODAL
// ============================================
function updateSummaryBadge() {
    const btn = document.getElementById('viewSummaryBtn');
    if (!btn) return;
    const all = getAllAssignedSchools();
    const submitted = all.filter(s => isSchoolSubmitted(s.key)).length;
    const remaining = all.length - submitted;
    let badge = btn.querySelector('.summary-badge');
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'summary-badge';
        badge.style.cssText = 'background:#dc3545;color:#fff;border-radius:10px;padding:1px 7px;font-size:10px;font-weight:700;margin-left:4px;';
        btn.appendChild(badge);
    }
    badge.textContent = remaining > 0 ? remaining + ' left' : '✓ Done';
    badge.style.background = remaining > 0 ? '#dc3545' : '#28a745';
}

// ── renderSummaryBody: renders the summary modal from server submissions ──
function renderSummaryBody(serverSubmissions) {
    const modal = document.getElementById('summaryModal');
    const body  = document.getElementById('summaryModalBody');

    // Merge server data into state for duplicate checking etc
    serverSubmissions.forEach(function(sub) {
        const key = makeSchoolKey(sub.district, sub.chiefdom, sub.facility, sub.community, sub.school_name);
        if (key && !isSchoolSubmitted(key)) {
            state.submittedSchools.push({ key, district:sub.district||'', chiefdom:sub.chiefdom||'',
                facility:sub.facility||'', community:sub.community||'', school_name:sub.school_name||'',
                timestamp:sub.timestamp||'', data:sub });
        }
    });
    saveState();

    const all       = getAllAssignedSchools();
    const total     = all.length;
    const submitted = all.filter(s => isSchoolSubmitted(s.key));
    const pending   = all.filter(s => !isSchoolSubmitted(s.key));
    const pct       = total > 0 ? Math.round((submitted.length / total) * 100) : 0;

    // Build district summary ONLY from actual submissions — no CSV data
    const byDist = {};
    submitted.forEach(s => {
        const dist = s.district || 'Unknown';
        if (!byDist[dist]) byDist[dist] = { submitted:0 };
        byDist[dist].submitted++;
    });

    let distRows = '';
    if (Object.keys(byDist).length === 0) {
        distRows = `<tr><td colspan="2" style="padding:20px;text-align:center;color:#aaa;font-style:italic;">No submissions yet</td></tr>`;
    } else {
        Object.entries(byDist).sort().forEach(([d, v]) => {
            distRows += `<tr>
              <td style="font-weight:600;text-align:left;padding:10px 15px;">${d}</td>
              <td style="text-align:center;padding:10px;color:#28a745;font-weight:700;font-size:15px;">${v.submitted}</td>
            </tr>`;
        });
    }

    // School list — submitted first (green), then pending at bottom (amber)
    const sortKey = (s) => s.district + '|' + (s.chiefdom||'') + '|' + s.school_name;
    const sortedSubmitted = submitted.slice().sort((a,b) => sortKey(a).localeCompare(sortKey(b)));
    const sortedPending   = pending.slice().sort((a,b)   => sortKey(a).localeCompare(sortKey(b)));

    let schoolRows = '';

    // ── Submitted rows ──
    sortedSubmitted.forEach(s => {
        const rec      = getSubmittedRecord(s.key);
        const when     = rec ? formatDate(rec.timestamp) : '—';
        const coverage = rec?.data?.coverage_total ? rec.data.coverage_total+'%' : '—';
        schoolRows += `
          <tr style="cursor:pointer;background:#f0fff0;" onclick="openSchoolDetail('${s.key}')">
            <td style="padding:10px 8px;">
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#28a745;margin-right:8px;flex-shrink:0;"></span>
              <strong>${s.school_name}</strong>
            </td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;">${s.district}</td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;">${s.chiefdom||'—'}</td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;">${s.facility||'—'}</td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;">${s.community||'—'}</td>
            <td style="padding:10px 8px;text-align:center;">
              <span style="background:#28a745;color:#fff;border-radius:4px;padding:3px 10px;font-size:11px;font-weight:600;letter-spacing:0.5px;">SUBMITTED</span>
            </td>
            <td style="padding:10px 8px;text-align:center;font-size:11px;color:#666;">${when}</td>
            <td style="padding:10px 8px;text-align:center;font-weight:700;color:#28a745;">${coverage}</td>
            <td style="padding:10px 8px;text-align:center;">
              <button onclick="event.stopPropagation();openSchoolDetail('${s.key}')" style="background:#004080;color:#fff;border:none;border-radius:4px;padding:5px 13px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Oswald',sans-serif;letter-spacing:0.5px;">VIEW</button>
            </td>
          </tr>`;
    });

    // ── Divider row between submitted and pending ──
    if (sortedSubmitted.length > 0 && sortedPending.length > 0) {
        schoolRows += `
          <tr>
            <td colspan="9" style="padding:0;">
              <div style="background:linear-gradient(135deg,#e67e22,#f0a500);color:#fff;padding:9px 16px;font-family:'Oswald',sans-serif;font-size:11px;font-weight:600;letter-spacing:.8px;text-transform:uppercase;display:flex;align-items:center;gap:8px;">
                <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                ${sortedPending.length} SCHOOL${sortedPending.length!==1?'S':''} NOT YET SUBMITTED
              </div>
            </td>
          </tr>`;
    }

    // ── Pending rows ──
    sortedPending.forEach(s => {
        schoolRows += `
          <tr style="cursor:pointer;background:#fffdf0;" onclick="loadSchoolIntoForm('${s.key}')">
            <td style="padding:10px 8px;">
              <span style="display:inline-block;width:9px;height:9px;border-radius:50%;background:#ffc107;margin-right:8px;flex-shrink:0;"></span>
              <strong style="color:#555;">${s.school_name}</strong>
            </td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#777;">${s.district}</td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#777;">${s.chiefdom||'—'}</td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#777;">${s.facility||'—'}</td>
            <td style="padding:10px 8px;text-align:center;font-size:12px;color:#777;">${s.community||'—'}</td>
            <td style="padding:10px 8px;text-align:center;">
              <span style="background:#fff3cd;color:#856404;border:1px solid #ffc107;border-radius:4px;padding:3px 10px;font-size:11px;font-weight:600;letter-spacing:0.5px;">PENDING</span>
            </td>
            <td style="padding:10px 8px;text-align:center;font-size:11px;color:#aaa;">—</td>
            <td style="padding:10px 8px;text-align:center;color:#aaa;">—</td>
            <td style="padding:10px 8px;text-align:center;">
              <button onclick="event.stopPropagation();loadSchoolIntoForm('${s.key}')" style="background:#e67e22;color:#fff;border:none;border-radius:4px;padding:5px 13px;font-size:11px;font-weight:600;cursor:pointer;font-family:'Oswald',sans-serif;letter-spacing:0.5px;">START</button>
            </td>
          </tr>`;
    });

    if (!schoolRows) {
        schoolRows = `<tr><td colspan="9" style="padding:32px;text-align:center;color:#aaa;font-style:italic;">No schools loaded — ensure cascading_data.csv is present.</td></tr>`;
    }

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:25px;">
        <div style="background:#e8f1fa;border:2px solid #004080;border-radius:10px;padding:16px 10px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#004080;">${total}</div>
          <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Target Schools</div>
        </div>
        <div style="background:#e8f5e9;border:2px solid #28a745;border-radius:10px;padding:16px 10px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#28a745;">${submitted.length}</div>
          <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Submitted</div>
        </div>
        <div style="background:#fff8e1;border:2px solid #ffc107;border-radius:10px;padding:16px 10px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#e67e22;">${pending.length}</div>
          <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Pending</div>
        </div>
        <div style="background:${pct>=80?'#e8f5e9':pct>=50?'#fff8e1':'#fdecea'};border:2px solid ${pct>=80?'#28a745':pct>=50?'#ffc107':'#dc3545'};border-radius:10px;padding:16px 10px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:${pct>=80?'#28a745':pct>=50?'#e67e22':'#dc3545'};">${pct}%</div>
          <div style="font-size:11px;color:#555;text-transform:uppercase;letter-spacing:.5px;margin-top:4px;">Progress</div>
        </div>
      </div>
      <div style="margin-bottom:25px;">
        <div style="background:#004080;color:#fff;padding:12px 20px;border-radius:8px 8px 0 0;font-size:14px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;text-align:center;">Submissions by District</div>
        <div style="overflow-x:auto;border:2px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:#f8f9fa;">
              <th style="padding:12px 15px;text-align:left;border-bottom:1px solid #dee2e6;">District</th>
              <th style="padding:12px;text-align:center;border-bottom:1px solid #dee2e6;">Submitted</th>
            </tr></thead>
            <tbody>${distRows}</tbody>
          </table>
        </div>
      </div>
      <div>
        <div style="background:#004080;color:#fff;padding:12px 20px;border-radius:8px 8px 0 0;font-size:14px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;display:flex;justify-content:space-between;align-items:center;">
          <span>All Schools — ${submitted.length} Submitted · ${pending.length} Pending</span>
          <span style="font-size:12px;font-weight:400;opacity:.8;">Click any row to view details</span>
        </div>
        <div style="overflow-x:auto;border:2px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;">
          <table style="width:100%;border-collapse:collapse;font-size:13px;">
            <thead><tr style="background:linear-gradient(135deg,#004080,#1a6abf);">
              <th style="padding:11px 12px;text-align:left;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">School</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">District</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">Chiefdom</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">PHU</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">Community</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">Status</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">Submitted</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">Coverage</th>
              <th style="padding:11px 10px;text-align:center;border-bottom:2px solid #dee2e6;color:#fff;font-family:'Oswald',sans-serif;font-size:11px;letter-spacing:.5px;text-transform:uppercase;">Action</th>
            </tr></thead>
            <tbody>${schoolRows}</tbody>
          </table>
        </div>
      </div>`;

    if (modal) modal.classList.add('show');
}

window.openSummaryModal = function() {
    const modal = document.getElementById('summaryModal');
    const body  = document.getElementById('summaryModalBody');
    if (modal) modal.classList.add('show');
    if (body) body.innerHTML = '<div style="text-align:center;padding:40px 20px;color:#607080;"><svg viewBox="0 0 24 24" fill="none" stroke="#004080" stroke-width="2" width="36" height="36" style="animation:spin .8s linear infinite;display:block;margin:0 auto 14px;"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.95"/></svg><div style="font-family:Oswald,sans-serif;font-size:13px;font-weight:700;color:#004080;letter-spacing:.5px;">FETCHING LATEST DATA FROM SERVER...</div></div>';
    window.refreshSummaryFromServer();
};

window.refreshSummaryFromServer = function() {
    if (!state.isOnline) {
        const body = document.getElementById('summaryModalBody');
        if (body) body.innerHTML = '<div style="text-align:center;padding:40px 20px;"><svg viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" width="40" height="40" style="display:block;margin:0 auto 14px;"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg><div style="font-family:Oswald,sans-serif;font-size:14px;font-weight:700;color:#dc3545;">YOU ARE OFFLINE</div><div style="font-size:12px;color:#607080;margin-top:8px;">Connect to the internet to view the latest summary.</div></div>';
        return;
    }

    // Spin the icon
    const icon = document.getElementById('summaryRefreshIcon');
    const btn  = document.getElementById('summaryRefreshBtn');
    if (icon) icon.style.animation = 'spin 0.8s linear infinite';
    if (btn)  btn.disabled = true;

    fetch(CONFIG.SCRIPT_URL + '?action=getAllSubmissions')
    .then(function(r) { return r.json(); })
    .then(function(res) {
        if (res.status === 'ok' && Array.isArray(res.submissions)) {
            // Merge server submissions into state.submittedSchools
            res.submissions.forEach(function(sub) {
                const key = makeSchoolKey(
                    sub.district, sub.chiefdom, sub.facility,
                    sub.community, sub.school_name
                );
                if (key && !isSchoolSubmitted(key)) {
                    state.submittedSchools.push({
                        key:         key,
                        district:    sub.district    || '',
                        chiefdom:    sub.chiefdom    || '',
                        facility:    sub.facility    || '',
                        community:   sub.community   || '',
                        school_name: sub.school_name || '',
                        timestamp:   sub.timestamp   || '',
                        data:        sub
                    });
                }
            });
            renderSummaryBody(res.submissions);
            showNotification('Summary updated — ' + res.submissions.length + ' records from server.', 'success');
        } else {
            showNotification('Could not fetch data from server.', 'error');
        }
    })
    .catch(function() {
        const body = document.getElementById('summaryModalBody');
        if (body) body.innerHTML = '<div style="text-align:center;padding:40px 20px;"><svg viewBox="0 0 24 24" fill="none" stroke="#dc3545" stroke-width="2" width="40" height="40" style="display:block;margin:0 auto 14px;"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg><div style="font-family:Oswald,sans-serif;font-size:14px;font-weight:700;color:#dc3545;">SERVER UNREACHABLE</div><div style="font-size:12px;color:#607080;margin-top:8px;">Could not connect to the ICF-SL server.<br>Check your internet connection and try again.</div><button onclick="window.refreshSummaryFromServer()" style="margin-top:16px;padding:10px 24px;background:#004080;color:#fff;border:none;border-radius:8px;font-family:Oswald,sans-serif;font-size:12px;font-weight:700;cursor:pointer;letter-spacing:.5px;">RETRY</button></div>';
        showNotification('Server unreachable. Check your connection.', 'error');
    })
    .finally(function() {
        if (icon) icon.style.animation = '';
        if (btn)  btn.disabled = false;
    });
};

window.closeSummaryModal = function() {
    const modal = document.getElementById('summaryModal');
    if (modal) modal.classList.remove('show');
};

window.viewSummary = function() { openSummaryModal(); };

// ============================================
// SCHOOL DETAIL MODAL
// ============================================
window.openSchoolDetail = function(key) {
    const rec = getSubmittedRecord(key);
    if (!rec) {
        const school = getAllAssignedSchools().find(s => s.key === key);
        if (school && confirm('This school has not been submitted yet. Load it into the form now?'))
            loadSchoolIntoForm(key);
        return;
    }
    const d = rec.data;
    const modal = document.getElementById('schoolDetailModal');
    const title = document.getElementById('schoolDetailTitle');
    const body  = document.getElementById('schoolDetailBody');
    if (!modal || !title || !body) return;

    title.textContent = (d.school_name || 'School') + ' — Submission Detail';

    let classRows = '';
    for (let c = 1; c <= 5; c++) {
        const boys=parseInt(d['c'+c+'_boys'])||0, girls=parseInt(d['c'+c+'_girls'])||0,
              boysITN=parseInt(d['c'+c+'_boys_itn'])||0, girlsITN=parseInt(d['c'+c+'_girls_itn'])||0;
        const total=boys+girls, itn=boysITN+girlsITN;
        const cov=total>0?Math.round((itn/total)*100):0;
        classRows += `<tr>
          <td style="font-weight:600;text-align:left;padding:8px 12px;">Class ${c}</td>
          <td style="text-align:center;padding:8px;">${boys}</td><td style="text-align:center;padding:8px;">${boysITN}</td>
          <td style="text-align:center;padding:8px;">${girls}</td><td style="text-align:center;padding:8px;">${girlsITN}</td>
          <td style="text-align:center;padding:8px;font-weight:700;">${total}</td>
          <td style="text-align:center;padding:8px;font-weight:700;">${itn}</td>
          <td style="text-align:center;padding:8px;font-weight:700;color:${cov>=80?'#28a745':cov>=50?'#e6a800':'#dc3545'};">${cov}%</td>
        </tr>`;
    }

    const totBoys=parseInt(d.total_boys)||0, totGirls=parseInt(d.total_girls)||0,
          totPupils=parseInt(d.total_pupils)||0, totBoysITN=parseInt(d.total_boys_itn)||0,
          totGirlsITN=parseInt(d.total_girls_itn)||0, totITN=parseInt(d.total_itn)||0,
          coverage=parseInt(d.coverage_total)||0, covBoys=parseInt(d.coverage_boys)||0,
          covGirls=parseInt(d.coverage_girls)||0, remaining=parseInt(d.itns_remaining)||0;

    const itnTypes = [d.itn_type_pbo==='Yes'?'PBO':'', d.itn_type_ig2==='Yes'?'IG2':'']
        .filter(Boolean).join(', ') || '—';

    body.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:25px;">
        ${infoCard('District',d.district||'—')}${infoCard('Chiefdom',d.chiefdom||'—')}
        ${infoCard('Health Facility (PHU)',d.facility||'—')}
        ${infoCard('Community',d.community||'—')}${infoCard('School',d.school_name||'—')}
        ${infoCard('Head Teacher',d.head_teacher||'—')}${infoCard('HT Phone',d.head_teacher_phone||'—')}
        ${infoCard('Distribution Date',d.distribution_date||'—')}${infoCard('Survey Date',d.survey_date||'—')}
        ${infoCard('Submitted At',formatDate(rec.timestamp))}${infoCard('Submitted By',d.submitted_by||'—')}
        ${infoCard('ITN Type(s)',itnTypes)}${infoCard('ITNs Received',d.itns_received||'—')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:25px;">
        ${statCard('Total Pupils',totPupils,'#004080')}
        ${statCard('ITNs Distributed',totITN,'#28a745')}
        ${statCard('ITNs Remaining',remaining,remaining<0?'#dc3545':'#fd7e14')}
        ${statCard('Coverage',coverage+'%',coverage>=80?'#28a745':coverage>=50?'#e6a800':'#dc3545')}
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:25px;">
        ${statCard('Boys Enrolled',totBoys,'#004080')}${statCard('Boys ITN Coverage',covBoys+'%','#004080')}${statCard('Boys Received ITN',totBoysITN,'#004080')}
        ${statCard('Girls Enrolled',totGirls,'#e91e8c')}${statCard('Girls ITN Coverage',covGirls+'%','#e91e8c')}${statCard('Girls Received ITN',totGirlsITN,'#e91e8c')}
      </div>
      <div style="background:#004080;color:#fff;padding:12px 20px;border-radius:8px 8px 0 0;font-size:14px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;text-align:center;">Class-by-Class Breakdown</div>
      <div style="overflow-x:auto;border:2px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;margin-bottom:25px;">
        <table style="width:100%;border-collapse:collapse;font-size:13px;">
          <thead><tr style="background:#f8f9fa;">
            <th style="padding:10px 12px;text-align:left;border-bottom:1px solid #dee2e6;">Class</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Boys</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Boys ITN</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Girls</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Girls ITN</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Total</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">ITN</th>
            <th style="padding:10px;text-align:center;border-bottom:1px solid #dee2e6;">Coverage</th>
          </tr></thead>
          <tbody>
            ${classRows}
            <tr style="background:#e8f1fa;font-weight:700;">
              <td style="padding:10px 12px;">TOTAL</td>
              <td style="text-align:center;padding:10px;">${totBoys}</td><td style="text-align:center;padding:10px;">${totBoysITN}</td>
              <td style="text-align:center;padding:10px;">${totGirls}</td><td style="text-align:center;padding:10px;">${totGirlsITN}</td>
              <td style="text-align:center;padding:10px;">${totPupils}</td><td style="text-align:center;padding:10px;">${totITN}</td>
              <td style="text-align:center;padding:10px;color:${coverage>=80?'#28a745':coverage>=50?'#e6a800':'#dc3545'};font-size:15px;">${coverage}%</td>
            </tr>
          </tbody>
        </table>
      </div>
      ${buildTeamSection(d)}
      ${d.gps_lat ? `
      <div style="background:#e8f1fa;border:2px solid #004080;border-radius:8px;padding:15px 20px;font-size:13px;text-align:center;">
        <strong style="color:#004080;display:block;margin-bottom:5px;">GPS COORDINATES</strong>
        <div style="font-family:monospace;font-size:14px;">${d.gps_lat}, ${d.gps_lng}</div>
        ${d.gps_acc?'<div style="color:#666;margin-top:5px;font-size:11px;">Accuracy: ±'+d.gps_acc+'m</div>':''}
      </div>` : ''}`;

    closeSummaryModal();
    if (modal) modal.classList.add('show');
};

function infoCard(label, value) {
    return `<div style="background:#f8f9fa;border:1px solid #dee2e6;border-radius:7px;padding:12px 15px;text-align:center;">
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-bottom:4px;">${label}</div>
      <div style="font-size:14px;font-weight:600;color:#333;">${value}</div>
    </div>`;
}

function statCard(label, value, color) {
    return `<div style="background:#fff;border:2px solid ${color}20;border-radius:10px;padding:15px 10px;text-align:center;">
      <div style="font-size:28px;font-weight:700;color:${color};line-height:1.2;">${value}</div>
      <div style="font-size:11px;color:#666;text-transform:uppercase;letter-spacing:.5px;margin-top:5px;">${label}</div>
    </div>`;
}

function buildTeamSection(d) {
    let html = '<div style="margin-bottom:20px;"><div style="background:#004080;color:#fff;padding:12px 20px;border-radius:8px 8px 0 0;font-size:14px;font-weight:600;letter-spacing:.5px;text-transform:uppercase;text-align:center;">Team Members</div>';
    html += '<div style="border:2px solid #dee2e6;border-top:none;border-radius:0 0 8px 8px;padding:20px;display:grid;grid-template-columns:repeat(3,1fr);gap:15px;">';
    for (let i = 1; i <= 2; i++) {
        const name = d['team'+i+'_name']||'', phone = d['team'+i+'_phone']||'';
        if (name) html += `<div style="background:#f8f9fa;border-radius:8px;padding:15px;text-align:center;">
          <div style="font-size:11px;color:#004080;font-weight:700;text-transform:uppercase;margin-bottom:6px;">${i===1?'HEALTH STAFF':'TEACHER'}</div>
          <div style="font-size:14px;font-weight:600;">${name}</div>
          ${phone?`<div style="font-size:12px;color:#666;margin-top:4px;">${phone}</div>`:''}
        </div>`;
    }
    html += '</div></div>';
    return html;
}

window.closeSchoolDetailModal = function() {
    const modal = document.getElementById('schoolDetailModal');
    if (modal) modal.classList.remove('show');
};

// ============================================
// LOAD SCHOOL INTO FORM
// ============================================
window.loadSchoolIntoForm = function(key) {
    const school = getAllAssignedSchools().find(s => s.key === key);
    if (!school) return;
    closeSummaryModal();
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    state.currentSection = 2;
    const section2 = document.querySelector('.form-section[data-section="2"]');
    if (section2) section2.classList.add('active');
    updateProgress();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    const chain = [
        ['district',    school.district],
        ['chiefdom',    school.chiefdom],
        ['facility',    school.facility],
        ['community',   school.community],
        ['school_name', school.school_name]
    ];
    let delay = 0;
    chain.forEach(([id, val]) => {
        setTimeout(() => {
            const el = document.getElementById(id);
            if (el) { el.value = val; el.dispatchEvent(new Event('change')); }
        }, delay);
        delay += 100;
    });
    showNotification('Loaded: ' + school.school_name, 'info');
};

// ============================================
// NAVIGATION
// ============================================
window.nextSection = function() {
    if (state.currentSection === 1) {
        moveToNextSection();
        // Show entry method modal when arriving at Section B
        setTimeout(() => { window.ensureSectionBVisible && window.ensureSectionBVisible(); }, 150);
        return;
    }
    if (validateCurrentSection()) moveToNextSection();
};

window.previousSection = function() {
    if (state.currentSection > 1) {
        document.querySelector('.form-section[data-section="'+state.currentSection+'"]')?.classList.remove('active');
        state.currentSection--;
        document.querySelector('.form-section[data-section="'+state.currentSection+'"]')?.classList.add('active');
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        // Restore Section B content when going back
        if (state.currentSection === 2 || state.currentSection === 3) {
            setTimeout(function() { window.ensureSectionBVisible && window.ensureSectionBVisible(); }, 150);
        }
    }
};

function moveToNextSection() {
    if (state.currentSection < state.totalSections) {
        document.querySelector('.form-section[data-section="'+state.currentSection+'"]')?.classList.remove('active');
        state.currentSection++;
        document.querySelector('.form-section[data-section="'+state.currentSection+'"]')?.classList.add('active');
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (state.currentSection === 3) {
            setTimeout(function() { window.ensureSectionBVisible && window.ensureSectionBVisible(); }, 100);
        }
        if (state.currentSection === 5) calculateAll();
    }
}

function validateCurrentSection() {
    // Extra validation for section 2 head teacher phone
    if (state.currentSection === 4) {
        const phoneEl = document.getElementById('head_teacher_phone');
        if (phoneEl) {
            const phone = phoneEl.value.trim();
            const errorEl = document.getElementById('error_head_teacher_phone');
            if (!phone || !/^[0-9]{9}$/.test(phone)) {
                if (errorEl) errorEl.textContent = phone ? 'Enter exactly 9 digits' : 'Head teacher phone is required';
                if (phoneEl) phoneEl.style.borderColor = '#dc3545';
                return false;
            }
            // Local uniqueness check
            const currentSchool = document.getElementById('school_name')?.value || '';
            const alreadyUsed = (state.submittedSchools || []).find(s => {
                const d = s.data || s;
                return d.head_teacher_phone === phone && (d.school_name || '') !== currentSchool;
            });
            if (alreadyUsed) {
                const usedIn = (alreadyUsed.data || alreadyUsed).school_name || 'another school';
                if (errorEl) errorEl.textContent = '⚠ Phone already used at: ' + usedIn;
                if (phoneEl) phoneEl.style.borderColor = '#dc3545';
                return false;
            }
            if (errorEl) errorEl.textContent = '';
            phoneEl.style.borderColor = '#28a745';
        }
    }
    const section = document.querySelector('.form-section[data-section="'+state.currentSection+'"]');
    if (!section) return true;
    if (state.currentSection === 1) return true;

    if (state.currentSection === 2) {
        // Method choice section — valid as long as a method is chosen
        if (!window._entryMethod) {
            showNotification('Please choose an identification method first.', 'error');
            return false;
        }
        return true;
    }

    if (state.currentSection === 3) {
        const key = currentSchoolKey();
        if (key && (_dupCheck.duplicate || isSchoolSubmitted(key))) {
            const src = _dupCheck.source === 'online' ? ' (confirmed on ICF-SL Server)' :
                        _dupCheck.source === 'pending' ? ' (in offline queue)' :
                        ' (submitted this session)';
            showNotification('⛔ Duplicate entry blocked — this school has already been submitted' + src + '.', 'error');
            return false;
        }
    }

    let isValid = true, firstInvalid = null;
    section.querySelectorAll('input[required], select[required]').forEach(field => {
        if (field.type === 'hidden') return;
        if (field.disabled) return;   // skip disabled fields (e.g. section_loc)
        // Skip fields inside hidden containers (display:none)
        let el = field;
        let parentHidden = false;
        while (el && el !== section) {
            if (el.style && el.style.display === 'none') { parentHidden = true; break; }
            el = el.parentElement;
        }
        if (parentHidden) return;
        if (!field.value || field.value.trim() === '') {
            isValid = false; field.classList.add('error');
            document.getElementById('error_'+field.id)?.classList.add('show');
            if (!firstInvalid) firstInvalid = field;
        } else {
            field.classList.remove('error');
            document.getElementById('error_'+field.id)?.classList.remove('show');
        }
    });

    if (state.currentSection === 3) {
        // ITN type is Dual-AI — no quantity split validation needed
        document.querySelectorAll('.itn-field').forEach(field => {
            const maxField = document.getElementById(field.getAttribute('data-max-field'));
            if (maxField && (parseInt(field.value)||0) > (parseInt(maxField.value)||0)) {
                isValid = false; field.classList.add('error');
                document.getElementById('error_'+field.id)?.classList.add('show');
            }
        });
    }

    if (!isValid) {
        showNotification('Please fill in all required fields correctly.', 'error');
        firstInvalid?.focus();
        firstInvalid?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return isValid;
}

function updateProgress() {
    const pf = document.getElementById('progressFill');
    const pt = document.getElementById('progressText');
    if (pf) pf.style.width = (state.currentSection / state.totalSections * 100) + '%';
    if (pt) pt.textContent = 'SECTION ' + state.currentSection + ' OF ' + state.totalSections;
}

// ============================================
// VALIDATION
// ============================================
function setupValidation() {
    document.querySelectorAll('.itn-field').forEach(input => {
        input.addEventListener('input', function() { validateITNField(this); calculateAll(); });
    });
    document.querySelectorAll('.enrollment-field').forEach(input => {
        input.addEventListener('input', function() {
            const itnField = document.getElementById('c'+this.dataset.class+'_'+this.dataset.gender+'_itn');
            if (itnField) validateITNField(itnField);
            calculateAll();
        });
    });
}

function validateITNField(itnInput) {
    if (!itnInput) return true;
    const maxField = document.getElementById(itnInput.dataset.maxField);
    if (!maxField) return true;
    const maxVal = parseInt(maxField.value)||0, itnVal = parseInt(itnInput.value)||0;
    const errorEl = document.getElementById('error_'+itnInput.id);
    if (itnVal > maxVal) { itnInput.classList.add('error'); errorEl?.classList.add('show'); return false; }
    itnInput.classList.remove('error'); errorEl?.classList.remove('show'); return true;
}

// ============================================
// ITN TYPE QUANTITY
// ============================================
window.toggleITNTypeQuantity = function() {
    const pbo = document.getElementById('itn_type_pbo')?.checked||false;
    const ig2 = document.getElementById('itn_type_ig2')?.checked||false;
    const qtyFields = document.getElementById('itn_quantity_fields');
    if (qtyFields) qtyFields.style.display = (pbo||ig2)?'block':'none';
    const pboGroup = document.getElementById('pbo_quantity_group');
    if (pboGroup) pboGroup.style.display = pbo?'block':'none';
    const ig2Group = document.getElementById('ig2_quantity_group');
    if (ig2Group) ig2Group.style.display = ig2?'block':'none';
    if (!pbo) { const el=document.getElementById('itn_qty_pbo'); if(el) el.value=0; }
    if (!ig2) { const el=document.getElementById('itn_qty_ig2'); if(el) el.value=0; }
    validateITNQuantities();
};

function validateITNQuantities() {
    const received = parseInt(document.getElementById('itns_received')?.value)||0;
    const pbo = document.getElementById('itn_type_pbo')?.checked||false;
    const ig2 = document.getElementById('itn_type_ig2')?.checked||false;
    if (!pbo && !ig2) return true;
    const pboQty = parseInt(document.getElementById('itn_qty_pbo')?.value)||0;
    const ig2Qty = parseInt(document.getElementById('itn_qty_ig2')?.value)||0;
    const fromTypes = pboQty + ig2Qty;
    const totalEl = document.getElementById('itn_type_total');
    const statusEl = document.getElementById('itn_qty_status');
    const errEl = document.getElementById('error_itn_qty_mismatch');
    if (totalEl) totalEl.textContent = fromTypes;
    if (received > 0) {
        if (fromTypes === received) {
            if (statusEl) { statusEl.textContent = '✓ Matches total received'; statusEl.className = 'qty-status match'; }
            if (errEl) errEl.style.display = 'none';
            return true;
        } else {
            if (statusEl) { statusEl.textContent = '✗ Does not match ('+received+' received)'; statusEl.className = 'qty-status mismatch'; }
            if (errEl) errEl.style.display = 'block';
            return false;
        }
    }
    if (statusEl) { statusEl.textContent = ''; statusEl.className = 'qty-status'; }
    if (errEl) errEl.style.display = 'none';
    return true;
}

// ============================================
// PHONE VALIDATION
// ============================================
function setupPhoneValidation() {
    document.querySelectorAll('.phone-field').forEach(input => {
        input.addEventListener('input', function() {
            // Strip non-digits and limit to 9
            this.value = this.value.replace(/\D/g,'').slice(0,9);
            // Clear error while typing — only show red after blur
            this.classList.remove('error');
            const errEl = document.getElementById('error_'+this.id);
            if (errEl) errEl.classList.remove('show');
        });
        input.addEventListener('blur', function() {
            validatePhoneField(this);
        });
    });
}

function validatePhoneField(input) {
    if (!input) return true;
    const errorEl = document.getElementById('error_'+input.id);
    const isReq = input.hasAttribute('required');
    const val = input.value.trim();
    if (val===''&&!isReq) { input.classList.remove('error'); errorEl?.classList.remove('show'); return true; }
    if (val.length!==9||!/^\d{9}$/.test(val)) { input.classList.add('error'); errorEl?.classList.add('show'); return false; }
    input.classList.remove('error'); errorEl?.classList.remove('show'); return true;
}

// ============================================
// NAME VALIDATION
// ============================================
function setupNameValidation() {
    document.querySelectorAll('.name-field').forEach(input => {
        input.addEventListener('input',  function() { this.value = this.value.replace(/[0-9]/g,''); });
        input.addEventListener('blur',   function() { validateNameField(this); });
    });
}

function validateNameField(input) {
    if (!input) return true;
    const errorEl = document.getElementById('error_'+input.id);
    const isReq = input.hasAttribute('required');
    const val = input.value.trim();
    if (val===''&&!isReq) { input.classList.remove('error'); errorEl?.classList.remove('show'); return true; }
    if (val===''&&isReq)  { input.classList.add('error'); errorEl?.classList.add('show'); return false; }
    if (/[0-9]/.test(val)) {
        input.classList.add('error');
        if (errorEl) { errorEl.textContent='Name cannot contain numbers'; errorEl.classList.add('show'); }
        return false;
    }
    if (val.length < 2) {
        input.classList.add('error');
        if (errorEl) { errorEl.textContent='Name must be at least 2 characters'; errorEl.classList.add('show'); }
        return false;
    }
    input.classList.remove('error'); errorEl?.classList.remove('show'); return true;
}

// ============================================
// CALCULATIONS
// ============================================
function setupCalculations() {
    document.querySelectorAll('.enrollment-field, .itn-field').forEach(input => {
        input.addEventListener('input', calculateAll);
    });
    const rec = document.getElementById('itns_received');
    if (rec) rec.addEventListener('input', () => { calculateAll(); validateITNQuantities(); });
}

function getNum(id) { const el=document.getElementById(id); return el?(parseInt(el.value)||0):0; }
function setText(id,v){ const el=document.getElementById(id); if(el) el.textContent=v; }
function setVal(id,v) { const el=document.getElementById(id); if(el) el.value=v; }

function calculateAll() {
    try {
        let tB=0,tG=0,tBI=0,tGI=0;
        for (let c=1;c<=5;c++) {
            const b=getNum('c'+c+'_boys'), bi=getNum('c'+c+'_boys_itn'),
                  g=getNum('c'+c+'_girls'), gi=getNum('c'+c+'_girls_itn');
            tB+=b; tG+=g; tBI+=bi; tGI+=gi;
            setText('t'+c+'_b',b); setText('t'+c+'_bi',bi);
            setText('t'+c+'_g',g); setText('t'+c+'_gi',gi);
            setText('t'+c+'_t',b+g); setText('t'+c+'_ti',bi+gi);
            setText('t'+c+'_c',(b+g)>0?Math.round(((bi+gi)/(b+g))*100)+'%':'0%');
        }
        const tp=tB+tG, ti=tBI+tGI;
        setText('sum_total_boys',tB); setText('sum_total_girls',tG); setText('sum_total_pupils',tp);
        setText('sum_boys_itn',tBI); setText('sum_girls_itn',tGI); setText('sum_total_itn',ti);
        setVal('total_boys',tB); setVal('total_girls',tG); setVal('total_pupils',tp);
        setVal('total_boys_itn',tBI); setVal('total_girls_itn',tGI); setVal('total_itn',ti);
        const received=getNum('itns_received'), remaining=received-ti;
        setText('itns_remaining',remaining); setVal('itns_remaining_val',remaining);
        const rs=document.getElementById('remaining_status');
        if (rs) {
            if (remaining<0) {
                rs.innerHTML='<strong>⛔ ERROR: ' + Math.abs(remaining) + ' more ITNs distributed than received (' + received + ' received, ' + (received-remaining) + ' distributed). Submission blocked until corrected.</strong>';
                rs.className='remaining-status warning';
            } else if (remaining===0&&received>0) {
                rs.textContent='✓ All ITNs distributed — none remaining.';
                rs.className='remaining-status success';
            } else if (received>0) {
                rs.textContent=remaining + ' ITNs remaining.';
                rs.className='remaining-status';
            } else { rs.textContent=''; rs.className='remaining-status'; }
        }
        const boysPct=tp>0?Math.round((tB/tp)*100):0, girlsPct=tp>0?Math.round((tG/tp)*100):0;
        setText('prop_boys',boysPct+'%'); setText('prop_girls',girlsPct+'%');
        setVal('prop_boys_val',boysPct); setVal('prop_girls_val',girlsPct);
        const bb=document.getElementById('bar_boys'); if(bb) bb.style.width=boysPct+'%';
        const gb=document.getElementById('bar_girls'); if(gb) gb.style.width=girlsPct+'%';
        const bc=tB>0?Math.round((tBI/tB)*100):0, gc=tG>0?Math.round((tGI/tG)*100):0,
              tc=tp>0?Math.round((ti/tp)*100):0;
        setText('cov_boys',bc+'%'); setText('cov_girls',gc+'%'); setText('cov_total',tc+'%');
        setVal('coverage_boys',bc); setVal('coverage_girls',gc); setVal('coverage_total',tc);
        setText('tt_b',tB); setText('tt_bi',tBI); setText('tt_g',tG); setText('tt_gi',tGI);
        setText('tt_t',tp); setText('tt_ti',ti);
        setText('tt_c',tp>0?Math.round((ti/tp)*100)+'%':'0%');
        updateCharts();
    } catch (e) { console.error('calculateAll:', e); }
}

// ============================================
// CHARTS (form section D)
// ============================================
function updateCharts() {
    try {
        const tB=getNum('total_boys'), tG=getNum('total_girls'),
              bi=getNum('total_boys_itn'), gi=getNum('total_girls_itn');
        const donutOpts = { responsive:true, maintainAspectRatio:true, plugins:{ legend:{ position:'bottom' } } };

        const c1=document.getElementById('chartEnrollment');
        if (c1) { if(state.charts.enrollment) state.charts.enrollment.destroy();
            state.charts.enrollment=new Chart(c1,{type:'doughnut',data:{labels:['Boys','Girls'],datasets:[{data:[tB,tG],backgroundColor:['#004080','#e91e8c'],borderWidth:2,borderColor:'#fff'}]},options:donutOpts}); }

        const c2=document.getElementById('chartITN');
        if (c2) { if(state.charts.itn) state.charts.itn.destroy();
            state.charts.itn=new Chart(c2,{type:'doughnut',data:{labels:['Boys','Girls'],datasets:[{data:[bi,gi],backgroundColor:['#004080','#e91e8c'],borderWidth:2,borderColor:'#fff'}]},options:donutOpts}); }

        const c3=document.getElementById('chartCoverage');
        if (c3) {
            const covs=[];
            for(let c=1;c<=5;c++){const t=getNum('c'+c+'_boys')+getNum('c'+c+'_girls'),i=getNum('c'+c+'_boys_itn')+getNum('c'+c+'_girls_itn');covs.push(t>0?Math.round((i/t)*100):0);}
            if(state.charts.coverage) state.charts.coverage.destroy();
            state.charts.coverage=new Chart(c3,{type:'bar',data:{labels:['Class 1','Class 2','Class 3','Class 4','Class 5'],datasets:[{label:'Coverage %',data:covs,backgroundColor:covs.map(v=>v>=80?'#28a745':v>=50?'#f0a500':'#dc3545'),borderWidth:0,borderRadius:5}]},options:{responsive:true,maintainAspectRatio:true,scales:{y:{beginAtZero:true,max:100}},plugins:{legend:{display:false}}}});
        }
    } catch (e) { console.error('updateCharts:', e); }
}

// ============================================
// GPS
// ============================================
window.captureGPS = function() {
    const icon=document.getElementById('gps_icon'), status=document.getElementById('gps_status'), coords=document.getElementById('gps_coords');
    if (!navigator.geolocation) { if(icon)icon.classList.add('error'); if(status)status.textContent='GPS not supported'; return; }
    if(icon)icon.classList.add('loading'); if(status)status.textContent='Capturing GPS...';
    navigator.geolocation.getCurrentPosition(
        pos => {
            const {latitude,longitude,accuracy}=pos.coords;
            setVal('gps_lat',latitude.toFixed(6)); setVal('gps_lng',longitude.toFixed(6)); setVal('gps_acc',Math.round(accuracy));
            if(icon){icon.classList.remove('loading');icon.classList.add('success');}
            if(status)status.textContent='GPS captured!';
            if(coords)coords.textContent=latitude.toFixed(5)+', '+longitude.toFixed(5)+' (±'+Math.round(accuracy)+'m)';
        },
        () => { if(icon){icon.classList.remove('loading');icon.classList.add('error');} if(status)status.textContent='GPS failed (optional)'; },
        {enableHighAccuracy:true,timeout:30000,maximumAge:0}
    );
};

// ============================================
// SIGNATURE PADS
// ============================================
function initAllSignaturePads() { initTeamSignaturePad(1); initTeamSignaturePad(2); }

function initTeamSignaturePad(n) {
    const canvas=document.getElementById('sig'+n+'Canvas'); if(!canvas) return;
    canvas.width=canvas.parentElement.offsetWidth-10; canvas.height=100;
    state.signaturePads[n]=new SignaturePad(canvas,{backgroundColor:'#fff',penColor:'#000'});
    state.signaturePads[n].addEventListener('endStroke',()=>{
        const h=document.getElementById('team'+n+'_signature'); if(h) h.value=state.signaturePads[n].toDataURL();
    });
}

window.clearTeamSignature = function(n) {
    if(state.signaturePads[n]){state.signaturePads[n].clear();const h=document.getElementById('team'+n+'_signature');if(h)h.value='';}
};

function clearSignature() { clearTeamSignature(1); clearTeamSignature(2); }

// ============================================
// ============================================
// SILENT AUTO-SAVE & AUTO-RESTORE
// Saves every field change to localStorage automatically.
// Restores silently on next load — no banners, no buttons.
// ============================================
const DRAFT_KEY = 'itn_single_draft';

function collectDraftData() {
    const formData = new FormData(document.getElementById('dataForm'));
    const data = {
        _savedAt:        new Date().toISOString(),
        _currentSection: state.currentSection,
        itn_type:        'Dual-AI',
        itn_type_pbo:    false,
        itn_type_ig2:    false,
    };
    for (const [k, v] of formData.entries()) data[k] = v;
    return data;
}

function autoSaveDraft() {
    try {
        localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraftData()));
    } catch(e) {}
}

function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY); } catch(e) {}
    state.currentDraftId = null;
    state.drafts = [];
    saveToStorage();
    updateCounts();
}

// Called from startApp — silently restores previous session if exists
function restoreDraftIfExists() {
    try {
        const raw = localStorage.getItem(DRAFT_KEY);
        if (!raw) return;
        const draft = JSON.parse(raw);
        if (!draft || !draft._savedAt) return;
        _applyDraft(draft);
    } catch(e) { console.warn('[AutoSave] Restore failed:', e.message); }
}

function _applyDraft(draft) {
    const geoChain = [
        ['district',    draft.district],
        ['chiefdom',    draft.chiefdom],
        ['facility',    draft.facility],
        ['community',   draft.community],
        ['school_name', draft.school_name]
    ];
    let delay = 0;
    geoChain.forEach(([elId, val]) => {
        if (!val) return;
        setTimeout(() => {
            const el = document.getElementById(elId);
            if (el) { el.value = val; el.dispatchEvent(new Event('change')); }
        }, delay);
        delay += 120;
    });

    const skip = new Set([
        '_savedAt','_currentSection','itn_type_pbo','itn_type_ig2',
        'district','chiefdom','facility','community','school_name'
    ]);
    setTimeout(() => {
        Object.entries(draft).forEach(([k, v]) => {
            if (skip.has(k)) return;
            const el = document.getElementById(k);
            if (el && el.type !== 'hidden') el.value = v;
        });
        // ITN type is Dual-AI — no checkbox restore needed

        const sec = parseInt(draft._currentSection) || 1;
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
        state.currentSection = sec;
        document.querySelector('.form-section[data-section="'+sec+'"]')?.classList.add('active');
        updateProgress();
        calculateAll();
    }, delay + 100);
}

function setupAutoSave() {
    const form = document.getElementById('dataForm');
    if (!form) return;
    let _t = null;
    const trigger = () => { clearTimeout(_t); _t = setTimeout(autoSaveDraft, 600); };
    form.addEventListener('input',  trigger);
    form.addEventListener('change', trigger);
}

// ── No-op stubs (keep compat with any old HTML references) ───
window.saveDraftNow       = function() {};
window.resumeDraft        = function() {};
window.discardDraft       = function() {};
window.showDraftNameModal = function() {};
window.cancelDraftName    = function() {};
window.confirmSaveDraft   = function() {};
window.openDraftsModal    = function() {};
window.closeDraftsModal   = function() {};
window.loadDraft          = function() {};
window.deleteDraft        = function() {};
function generateDraftName() { return 'Draft'; }
function updateDraftIndicator() {}

// ============================================
// FINALIZE & SUBMIT
// ============================================
window.finalizeForm = function() {
    // Validate all sections
    for(let s = 3; s <= state.totalSections; s++) {
        state.currentSection = s;
        if (!validateCurrentSection()) {
            document.querySelectorAll('.form-section').forEach(sec => sec.classList.remove('active'));
            document.querySelector('.form-section[data-section="'+s+'"]')?.classList.add('active');
            updateProgress();
            return;
        }
    }
    // ITN type is always Dual-AI — no check needed
    // ITN quantity split validation removed — Dual-AI only
    // ── Track new schools ─────────────────────────────────────
    const _district   = document.getElementById('district')?.value   || '';
    const _chiefdom   = document.getElementById('chiefdom')?.value   || '';
    const _facility   = document.getElementById('facility')?.value   || '';
    const _community  = document.getElementById('community')?.value  || '';
    const _schoolName = document.getElementById('school_name')?.value|| '';
    if (_schoolName && isNewSchool(_district, _chiefdom, _facility, _community, _schoolName)) {
        saveNewSchool(_district, _chiefdom, _facility, _community, _schoolName);
    }

    // Capture signatures from canvas if hidden inputs empty (mobile fix)
    for (const [n, label] of [[1,'Health Staff'],[2,'Teacher']]) {
        const hidden = document.getElementById('team'+n+'_signature');
        const canvas = document.getElementById('sig'+n+'Canvas');
        if (hidden && !hidden.value && canvas) {
            try {
                const blank = document.createElement('canvas');
                blank.width = canvas.width; blank.height = canvas.height;
                if (canvas.toDataURL() !== blank.toDataURL()) {
                    hidden.value = canvas.toDataURL();
                }
            } catch(e) {}
        }
        if (!hidden || !hidden.value) {
            showNotification('Please provide ' + label + ' signature (required).', 'error');
            state.currentSection = 5;
            document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
            document.querySelector('.form-section[data-section="5"]')?.classList.add('active');
            updateProgress(); return;
        }
    }

    state.formStatus = 'finalized';
    const formStatus = document.getElementById('form_status');
    if (formStatus) formStatus.value = 'finalized';
    const submittedBy = document.getElementById('submitted_by');
    if (submittedBy) submittedBy.value = state.currentUser || '';
    showNotification('Form ready! Tap SUBMIT to send.', 'success');
};

// Called by onclick on submit button (type="button") — more reliable than form submit event on mobile
window.doSubmit = async function() {
    const submitBtn = document.getElementById('submitBtn');

    // Run full validation before submitting
    for(let s = 3; s <= state.totalSections; s++) {
        const savedSection = state.currentSection;
        state.currentSection = s;
        const valid = validateCurrentSection();
        state.currentSection = savedSection; // always restore
        if (!valid) {
            document.querySelectorAll('.form-section').forEach(sec => sec.classList.remove('active'));
            document.querySelector('.form-section[data-section="'+s+'"]')?.classList.add('active');
            state.currentSection = s;
            updateProgress();
            if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT'; }
            return;
        }
    }
    // ITN type is always Dual-AI — no check needed
    // ITN quantity split validation removed — Dual-AI only
    // ── Head teacher phone unique check online ──────────────────
    const htPhone = document.getElementById('head_teacher_phone')?.value || '';
    if (htPhone && state.isOnline) {
        try {
            const dupRes = await Promise.race([
                fetch(CONFIG.SCRIPT_URL + '?action=checkDuplicate&field=head_teacher_phone&value=' + encodeURIComponent(htPhone) + '&school=' + encodeURIComponent(document.getElementById('school_name')?.value || '')),
                new Promise((_,r) => setTimeout(() => r(new Error('timeout')), 4000))
            ]);
            if (dupRes.ok) {
                const dupData = await dupRes.json();
                if (dupData.duplicate) {
                    showNotification('⛔ Duplicate phone number: ' + htPhone + ' already used at ' + (dupData.school || 'another school'), 'error');
                    if (submitBtn) { submitBtn.disabled = false; submitBtn.innerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT'; }
                    return;
                }
            }
        } catch(e) { /* fail open */ }
    }

    // ── Track new schools ─────────────────────────────────────
    const _district   = document.getElementById('district')?.value   || '';
    const _chiefdom   = document.getElementById('chiefdom')?.value   || '';
    const _facility   = document.getElementById('facility')?.value   || '';
    const _community  = document.getElementById('community')?.value  || '';
    const _schoolName = document.getElementById('school_name')?.value|| '';
    if (_schoolName && isNewSchool(_district, _chiefdom, _facility, _community, _schoolName)) {
        saveNewSchool(_district, _chiefdom, _facility, _community, _schoolName);
    }

    // Capture signatures from canvas if hidden inputs empty (mobile fix)
    for (const [n, label] of [[1,'Health Staff'],[2,'Teacher']]) {
        const hidden = document.getElementById('team'+n+'_signature');
        const canvas = document.getElementById('sig'+n+'Canvas');
        if (hidden && !hidden.value && canvas) {
            try {
                const blank = document.createElement('canvas');
                blank.width = canvas.width; blank.height = canvas.height;
                if (canvas.toDataURL() !== blank.toDataURL()) hidden.value = canvas.toDataURL();
            } catch(e) {}
        }
        if (!hidden || !hidden.value) {
            showNotification('Please provide ' + label + ' signature (required).', 'error');
            state.currentSection = 5;
            document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
            document.querySelector('.form-section[data-section="5"]')?.classList.add('active');
            updateProgress(); return;
        }
    }

    // Collect form data
    const form = document.getElementById('dataForm');
    if (!form) return;

    // ── Head teacher phone — 9 digit unique check ───────────
    if (window.validateHeadTeacherPhone && !window.validateHeadTeacherPhone()) {
        const inp = document.getElementById('head_teacher_phone');
        if (inp) { inp.scrollIntoView({ behavior:'smooth', block:'center' }); }
        if (submitBtn) { submitBtn.disabled=false; submitBtn.innerHTML='<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT'; }
        return;
    }

    // ── Handle new school name override ─────────────────────
    const newSchoolName = document.getElementById('newSchoolName')?.value?.trim();
    if (_isNewSchool && newSchoolName) {
        // override school_name for submission
    }

    const formData = new FormData(form);
    const data = { timestamp: new Date().toISOString(), submitted_by: state.currentUser || '' };
    for (const [k, v] of formData.entries()) data[k] = v;

    // If new school, mark it
    if (_isNewSchool && newSchoolName) {
        data.school_name = newSchoolName;
        data.is_new_school = 'yes';
    }
    const pboEl = document.getElementById('itn_type_pbo');
    const ig2El = document.getElementById('itn_type_ig2');
    data.itn_type_pbo = pboEl && pboEl.checked ? 'Yes' : 'No';
    data.itn_type_ig2 = ig2El && ig2El.checked ? 'Yes' : 'No';

    const submitKey = makeSchoolKey(data.district, data.chiefdom, data.facility, data.community, data.school_name);

    // Disable button and show checking
    if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'CHECKING...'; }

    // Duplicate check with short timeout — fail open so submission is never permanently blocked
    let isDup = false, dupSrc = null;
    try {
        const result = await Promise.race([
            isDuplicateSubmission(submitKey),
            new Promise(resolve => setTimeout(() => resolve({ duplicate: false, source: null }), 4000))
        ]);
        isDup = result.duplicate;
        dupSrc = result.source;
    } catch(e) {
        isDup = false; // fail open
    }

    if (isDup) {
        const srcLabel = dupSrc === 'online'  ? ' (confirmed on ICF-SL Server)' :
                         dupSrc === 'pending' ? ' (in offline queue)'          :
                                               ' (submitted this session)';
        showNotification('⛔ Duplicate: this school was already submitted' + srcLabel, 'error');
        state.formStatus = 'draft';
        const formStatus = document.getElementById('form_status');
        if (formStatus) formStatus.value = 'draft';
        
        if (submitBtn) { submitBtn.disabled = true; submitBtn.innerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT'; }
        return;
    }

    // ── ITN DISTRIBUTION VALIDATION ─────────────────────────
    const received  = parseInt(document.getElementById('itns_received')?.value) || 0;
    const totalDist = parseInt(document.getElementById('total_itn')?.value) || 0;
    const remaining = received - totalDist;

    if (received > 0 && totalDist > received) {
        const over = totalDist - received;
        showNotification(
            '⛔ Cannot submit: ' + totalDist + ' ITNs distributed exceeds ' +
            received + ' received by ' + over + ' ITN(s). Please correct before submitting.',
            'error'
        );
        // Show summary section
        state.currentSection = 4;
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
        document.querySelector('.form-section[data-section="4"]')?.classList.add('active');
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT';
        }
        return;
    }
    // ── END ITN VALIDATION ────────────────────────────────

    // Submit
    if (submitBtn) { submitBtn.textContent = 'SUBMITTING...'; }

    if (state.isOnline) {
        try {
            await fetch(CONFIG.SCRIPT_URL, {
                method: 'POST', mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            markSchoolSubmitted(data);
            // Lock form — one submission per session
            setTimeout(() => {
                const fw = document.getElementById('formCardWrap');
                if (fw) fw.style.display = 'none';
                const dataEntryBtn = document.querySelector('[onclick*="dataentry"]');
                if (dataEntryBtn) {
                    dataEntryBtn.disabled = true;
                    dataEntryBtn.style.opacity = '0.4';
                    dataEntryBtn.title = 'Already submitted';
                }
            }, 500);
            clearDraft();
            saveToStorage(); updateCounts(); updateSummaryBadge();
            showThankYouModal(data, false);
        } catch(err) {
            saveOffline(data);
        }
    } else {
        saveOffline(data);
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT';
    }
};

// Keep form submit event as fallback
async function handleSubmit(e) {
    e.preventDefault();
    window.doSubmit();
}


// ============================================
// THANK YOU MODAL
// ============================================
function showThankYouModal(data, offline) {
    // Inject modal if not exists
    if (!document.getElementById('thankYouModal')) {
        document.body.insertAdjacentHTML('beforeend', `
        <div class="modal-overlay" id="thankYouModal" style="z-index:3000;">
            <div class="modal-content small" id="thankYouContent"
                 style="border-radius:16px;overflow:hidden;border:3px solid #28a745;max-width:420px;">
                <div style="background:linear-gradient(135deg,#1a8a3a,#28a745);padding:28px 24px;text-align:center;">
                    <div style="width:64px;height:64px;background:rgba(255,255,255,.2);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 14px;">
                        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5" width="32" height="32"><polyline points="20 6 9 17 4 12"/></svg>
                    </div>
                    <div style="font-family:'Oswald',sans-serif;font-size:22px;font-weight:700;color:#fff;letter-spacing:.8px;text-transform:uppercase;">Thank You!</div>
                    <div style="font-size:13px;color:rgba(255,255,255,.85);margin-top:6px;" id="tySubtitle"></div>
                </div>
                <div style="padding:22px 24px;background:#fff;">
                    <div id="tySummary" style="background:#f0f9f3;border:2px solid #b2dfcc;border-radius:10px;padding:14px;margin-bottom:18px;font-size:13px;"></div>
                    <div style="text-align:center;padding:10px 0 4px;">
                        <div style="font-family:'Oswald',sans-serif;font-size:15px;font-weight:700;color:#28a745;letter-spacing:.4px;">✅ SUBMISSION COMPLETE</div>
                        <div style="font-size:12px;color:#607080;margin-top:6px;" id="tySubtitle2"></div>
                        <button onclick="window.startNewEntry()"
                            style="margin-top:16px;width:100%;padding:13px;background:#004080;color:#fff;border:none;border-radius:10px;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;letter-spacing:.6px;cursor:pointer;text-transform:uppercase;">
                            ➕ START NEW ENTRY
                        </button>
                    </div>
                </div>
            </div>
        </div>`);
    }

    // Populate summary
    const received  = parseInt(data.itns_received)  || 0;
    const distrib   = parseInt(data.total_itn)       || 0;
    const remaining = received - distrib;
    const coverage  = parseInt(data.coverage_total)  || 0;
    const school    = data.school_name || 'School';
    const district  = data.district    || '';

    document.getElementById('tySubtitle').textContent =
        offline ? 'Saved offline — will sync when back online.' : 'Data submitted to ICF-SL Server.';

    document.getElementById('tySummary').innerHTML = `
        <div style="font-family:'Oswald',sans-serif;font-size:13px;font-weight:700;color:#004080;text-transform:uppercase;letter-spacing:.4px;margin-bottom:10px;">
            ${school} · ${district}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:#fff;border-radius:7px;padding:10px;text-align:center;border:1px solid #d0e8d8;">
                <div style="font-size:22px;font-weight:700;color:#004080;">${received}</div>
                <div style="font-size:10px;color:#607080;text-transform:uppercase;letter-spacing:.4px;margin-top:2px;">ITNs Received</div>
            </div>
            <div style="background:#fff;border-radius:7px;padding:10px;text-align:center;border:1px solid #d0e8d8;">
                <div style="font-size:22px;font-weight:700;color:#28a745;">${distrib}</div>
                <div style="font-size:10px;color:#607080;text-transform:uppercase;letter-spacing:.4px;margin-top:2px;">ITNs Distributed</div>
            </div>
            <div style="background:#fff;border-radius:7px;padding:10px;text-align:center;border:1px solid #d0e8d8;">
                <div style="font-size:22px;font-weight:700;color:${remaining<0?'#dc3545':'#e67e22'};">${remaining}</div>
                <div style="font-size:10px;color:#607080;text-transform:uppercase;letter-spacing:.4px;margin-top:2px;">Remaining</div>
            </div>
            <div style="background:#fff;border-radius:7px;padding:10px;text-align:center;border:1px solid #d0e8d8;">
                <div style="font-size:22px;font-weight:700;color:${coverage>=80?'#28a745':coverage>=50?'#e67e22':'#dc3545'};">${coverage}%</div>
                <div style="font-size:10px;color:#607080;text-transform:uppercase;letter-spacing:.4px;margin-top:2px;">Coverage</div>
            </div>
        </div>`;

    document.getElementById('thankYouModal').classList.add('show');
}

window.startNewEntry = function() {
    document.getElementById('thankYouModal')?.classList.remove('show');
    resetForm();
    clearDraft(); // clear auto-saved draft so old phone doesn't restore
    window._entryMethod = null;
    // Scroll back to top of form
    const wrap = document.getElementById('formCardWrap');
    if (wrap) {
        wrap.style.display = 'block';
        setTimeout(() => wrap.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    }
    showNotification('Form cleared — ready for next school.', 'success');
};

function markSchoolSubmitted(data) {
    const key=makeSchoolKey(data.district,data.chiefdom,data.facility,data.community,data.school_name);
    if(!isSchoolSubmitted(key))
        state.submittedSchools.push({key,district:data.district,chiefdom:data.chiefdom,facility:data.facility,community:data.community,school_name:data.school_name,timestamp:data.timestamp,data});
}

function saveOffline(data) {
    state.pendingSubmissions.push(data);
    markSchoolSubmitted(data);
    clearDraft();
    saveToStorage(); updateCounts(); updateSummaryBadge();
    showThankYouModal(data, true);
}

function resetForm() {
    document.getElementById('dataForm').reset();
    clearSignature();
    state.currentSection=1; state.currentDraftId=null; state.formStatus='draft';
    document.querySelectorAll('.form-section').forEach(s=>s.classList.remove('active'));
    document.querySelector('.form-section[data-section="1"]')?.classList.add('active');
    // submitBtn always enabled
    
    const sbField=document.getElementById('submitted_by'); if(sbField) sbField.value=state.currentUser||'';
    const banner=document.getElementById('schoolSubmittedBanner'); if(banner) banner.style.display='none';
    const nextBtn=document.querySelector('.form-section[data-section="2"] .btn-next');
    if(nextBtn){ nextBtn.disabled=false; nextBtn.title=''; }
    ['chiefdom','facility','community','school_name'].forEach(id=>{
        const el=document.getElementById(id); if(el){el.innerHTML='<option value="">Select...</option>';el.disabled=true;}
    });
    ['chiefdom','facility','community','school_name'].forEach(clearCount);
    updateProgress(); setDefaultDate(); captureGPS(); calculateAll();
    setTimeout(()=>initAllSignaturePads(),100);
}


// ════════════════════════════════════════════════════
// NEW SCHOOL — Not in CSV target list
// ════════════════════════════════════════════════════
let _isNewSchool = false;

window.toggleNewSchoolInput = function() {
    const wrap = document.getElementById('newSchoolInputWrap');
    const schoolSel = document.getElementById('school_name');
    if (!wrap) return;
    _isNewSchool = !_isNewSchool;
    wrap.style.display = _isNewSchool ? 'block' : 'none';

    const btn = document.getElementById('addNewSchoolBtn');
    if (btn) btn.textContent = _isNewSchool ? '✕ CANCEL NEW SCHOOL' : '➕ ADD NEW SCHOOL (not in list)';

    if (_isNewSchool) {
        // Disable the select
        if (schoolSel) { schoolSel.disabled = true; schoolSel.value = ''; }
        setTimeout(() => document.getElementById('newSchoolName')?.focus(), 100);
    } else {
        if (schoolSel) schoolSel.disabled = false;
        document.getElementById('newSchoolName').value = '';
        // Remove new-school hidden field
        const hf = document.getElementById('is_new_school');
        if (hf) hf.value = '';
    }
};

window.updateNewSchoolName = function(val) {
    // Keep a hidden field for new school flag
    let hf = document.getElementById('is_new_school');
    if (!hf) {
        hf = document.createElement('input');
        hf.type = 'hidden'; hf.name = 'is_new_school'; hf.id = 'is_new_school';
        document.getElementById('dataForm')?.appendChild(hf);
    }
    hf.value = val ? 'yes' : '';
    // Also set school_name value in form via hidden field
    let snHf = document.getElementById('school_name_new');
    if (!snHf) {
        snHf = document.createElement('input');
        snHf.type='hidden'; snHf.name='school_name'; snHf.id='school_name_new';
        document.getElementById('dataForm')?.appendChild(snHf);
    }
    snHf.value = val;
};

// ============================================
// DOWNLOAD DATA
// ============================================

    // Show loading state on button
    const btn = document.getElementById('downloadDataBtn');
    const origHTML = btn ? btn.innerHTML : '';
    if (btn) btn.innerHTML = '<svg viewBox="0 0 24 24" style="width:20px;height:20px;animation:spin 1s linear infinite"><circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="30 60"/></svg><br>LOADING';

// ============================================
// ANALYSIS  (overridden by ai_agent.js)
// ============================================
window.openAnalysisModal = function() {
    // This is overridden by ai_agent.js with the full dashboard.
    // Fallback: open the analysis modal if it exists.
    const modal = document.getElementById('analysisModal');
    if (modal) modal.classList.add('show');
};

window.closeAnalysisModal = function() {
    document.getElementById('analysisModal')?.classList.remove('show');
};

// ============================================
// UTILITIES
// ============================================
function checkAdmin() {
    // No login required — always admin
    return true;
}

function updateOnlineStatus() {
    const ind=document.getElementById('statusIndicator'), text=document.getElementById('statusText');
    if(!ind||!text) return;
    ind.className='status-indicator '+(state.isOnline?'online':'offline');
    text.textContent=state.isOnline?'ONLINE':'OFFLINE';
}

function updateCounts() {
    const dc=document.getElementById('draftCount'), pc=document.getElementById('pendingCount');
    if(dc) dc.textContent=state.drafts.length;
    if(pc) pc.textContent=state.pendingSubmissions.length;
}

function showNotification(msg, type) {
    const n=document.getElementById('notification'), t=document.getElementById('notificationText');
    if(!n||!t) return;
    n.className='notification '+type+' show';
    t.textContent=msg;
    setTimeout(()=>n.classList.remove('show'),4000);
}

function setupEventListeners() {
    // viewDataBtn — handled by guardedAction in HTML
    // viewAnalysisBtn — handled by guardedAction in HTML
    // viewSummaryBtn — handled by guardedAction in HTML
    // aiAgentBtn — handled by guardedAction in HTML

    // Expose download so guardedAction can call it

    const df = document.getElementById('dataForm');
    if (df) df.addEventListener('submit', handleSubmit);

    window.addEventListener('online',  () => { state.isOnline = true;  updateOnlineStatus(); syncPending(); });
    window.addEventListener('offline', () => { state.isOnline = false; updateOnlineStatus(); });

    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) m.classList.remove('show'); });
    });

    const dni = document.getElementById('draftNameInput');
    if (dni) dni.addEventListener('keypress', e => { if (e.key === 'Enter') confirmSaveDraft(); });

    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.onclick = e => { e.preventDefault(); window.nextSection(); };
    });
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.onclick = e => { e.preventDefault(); window.previousSection(); };
    });
}

async function syncPending() {
    if(state.pendingSubmissions.length===0) return;
    showNotification('Syncing pending data...','info');
    const synced=[];
    for(let i=0;i<state.pendingSubmissions.length;i++){
        try{ await fetch(CONFIG.SCRIPT_URL,{method:'POST',mode:'no-cors',body:JSON.stringify(state.pendingSubmissions[i])}); synced.push(i); } catch(e){}
    }
    if(synced.length>0){
        state.pendingSubmissions=state.pendingSubmissions.filter((_,i)=>!synced.includes(i));
        saveToStorage(); updateCounts();
        showNotification('Synced '+synced.length+' submission(s)!','success');
    }
}

// ============================================
// KICK OFF
// ============================================
init();

// Expose globals
window.captureGPS=captureGPS; window.clearTeamSignature=clearTeamSignature;
window.toggleITNTypeQuantity=toggleITNTypeQuantity; window.updateApp=updateApp;
window.nextSection=nextSection; window.previousSection=previousSection;
window.showDraftNameModal=showDraftNameModal; window.finalizeForm=finalizeForm;
window.viewSummary=viewSummary; window.openSchoolDetail=openSchoolDetail;
window.closeSchoolDetailModal=closeSchoolDetailModal; window.loadSchoolIntoForm=loadSchoolIntoForm;
window.viewSubmittedSchoolFromBanner=viewSubmittedSchoolFromBanner;
window.openSummaryModal=openSummaryModal; window.closeSummaryModal=closeSummaryModal;
window.openAnalysisModal=openAnalysisModal; window.closeAnalysisModal=closeAnalysisModal;
window.openDraftsModal=openDraftsModal; window.closeDraftsModal=closeDraftsModal;
window.cancelDraftName=cancelDraftName; window.confirmSaveDraft=confirmSaveDraft;
window.loadDraft=loadDraft; window.deleteDraft=deleteDraft;
window.validateITNQuantities=validateITNQuantities;

console.log('[ICF Collect] script_option2.js loaded ✓');

// ============================================
// SCHOOL QR CODE GENERATOR
// ============================================
window.generateSchoolQRCodes = function() {
    // Generate printable QR codes for all schools in CSV
    const data = window.ALL_LOCATION_DATA;
    if (!data) { showNotification('Location data not loaded yet', 'error'); return; }

    const win = window.open('', '_blank');
    let schools = [];
    for (const district in data)
        for (const chiefdom in data[district])
            for (const phu in data[district][chiefdom])
                for (const community in data[district][chiefdom][phu])
                    (data[district][chiefdom][phu][community] || []).forEach(school => {
                        if (school) schools.push({ district, chiefdom, facility:phu, community, school_name:school });
                    });

    const qrScript = 'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js';

    win.document.write(`<!DOCTYPE html><html><head>
    <title>School QR Codes — ICF-SL SBD 2026</title>
    <link href="https://fonts.googleapis.com/css2?family=Oswald:wght@400;600&display=swap" rel="stylesheet">
    <script src="${qrScript}"><\/script>
    <style>
      body{font-family:'Oswald',sans-serif;background:#f4f6f9;padding:16px;}
      h1{color:#004080;text-align:center;margin-bottom:16px;font-size:18px;}
      .grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:12px;}
      .card{background:#fff;border-radius:10px;border:2px solid #004080;padding:12px;text-align:center;break-inside:avoid;}
      .card .district{font-size:9px;color:#888;text-transform:uppercase;letter-spacing:.5px;}
      .card .phu{font-size:10px;color:#004080;font-weight:600;margin:2px 0;}
      .card .school{font-size:11px;font-weight:700;color:#0d1b2a;margin:4px 0 8px;}
      .card .community{font-size:9px;color:#607080;}
      .qr-wrap{display:inline-block;padding:6px;background:#fff;border-radius:6px;}
      @media print{.no-print{display:none;}body{background:#fff;padding:0;}.card{border:1px solid #004080;}}
    </style></head><body>
    <h1>ICF-SL · School QR Codes · SBD 2026</h1>
    <div class="no-print" style="text-align:center;margin-bottom:16px;">
      <button onclick="window.print()" style="background:#004080;color:#fff;border:none;border-radius:8px;padding:10px 24px;font-family:'Oswald',sans-serif;font-size:14px;font-weight:700;cursor:pointer;">🖨 PRINT ALL (${schools.length} Schools)</button>
    </div>
    <div class="grid" id="qrGrid"></div>
    <script>
    const schools = ${JSON.stringify(schools)};
    const grid = document.getElementById('qrGrid');
    schools.forEach((s, i) => {
      const div = document.createElement('div');
      div.className = 'card';
      div.innerHTML = \`
        <div class="district">\${s.district} · \${s.chiefdom}</div>
        <div class="phu">\${s.facility}</div>
        <div class="school">\${s.school_name}</div>
        <div class="community">\${s.community}</div>
        <div class="qr-wrap" id="qr\${i}"></div>
      \`;
      grid.appendChild(div);
      new QRCode(document.getElementById('qr' + i), {
        text: JSON.stringify(s),
        width: 140, height: 140,
        colorDark: '#004080', colorLight: '#ffffff',
        correctLevel: QRCode.CorrectLevel.M
      });
    });
    <\/script>
    </body></html>`);
    win.document.close();
    showNotification('Generating QR codes for ' + schools.length + ' schools…', 'success');
};
