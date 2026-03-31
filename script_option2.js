// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbymRy-M5v0fVLWUjw4IXYhd1oIR2ZvnP_Dzr_iGR-Th0cMIpmE2ntGeujWYH7-C6NHIzA/exec',
    SHEET_URL:  'https://docs.google.com/spreadsheets/d/1cXlYiTMzcRP1BCj9mt1JXoK_pjgWbRtDEEQUPMg2HPs/edit?gid=0#gid=0',
    CSV_FILE:   'cascading_data1.csv',
    ADMIN_USER: 'admin',
    ADMIN_PASS: 'admin123'
};

// ============================================
// STATE
// ============================================
const state = {
    currentSection: 1,
    totalSections:  5,
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

let ALL_LOCATION_DATA = {};
let USER_MAP          = {};
let LOCATION_DATA     = {};
let deferredPrompt    = null;

// ============================================
// CACHE IMAGES FOR OFFLINE USE
// ============================================
function cacheImagesForOffline() {
    const imagesToCache = [
        'ICF-SL.jpg',
        'logo_mohs.png',
        'logo_nmcp.png',
        'logo_pmi.png',
        'infographics.png',
        'favicon.svg',
        'icon-192.svg'
    ];
    
    if ('caches' in window) {
        caches.open('itn-images-v1').then(cache => {
            imagesToCache.forEach(imageUrl => {
                fetch(imageUrl, { mode: 'no-cors' })
                    .then(response => {
                        if (response.ok) cache.put(imageUrl, response);
                    })
                    .catch(() => {
                        const fallbackUrls = {
                            'ICF-SL.jpg': 'https://github.com/mohamedsillahkanu/gdp-dashboard-2/raw/6c7463b0d5c3be150aafae695a4bcbbd8aeb1499/ICF-SL.jpg',
                            'infographics.png': 'https://raw.githubusercontent.com/mohamedsillahkanu/gdp-dashboard-2/main/infographics.png'
                        };
                        if (fallbackUrls[imageUrl]) {
                            fetch(fallbackUrls[imageUrl], { mode: 'no-cors' })
                                .then(fbResponse => {
                                    if (fbResponse.ok) cache.put(imageUrl, fbResponse);
                                })
                                .catch(err => console.warn('Could not cache fallback for', imageUrl, err));
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
                            showNotification('New version available! Refresh to update.', 'info');
                    });
                });
                cacheImagesForOffline();
            })
            .catch(err => console.error('[PWA] SW registration failed:', err));
    });
}

// ============================================
// PWA INSTALL PROMPT
// ============================================
window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    const btn = document.getElementById('installBtn');
    if (btn) btn.style.opacity = '1';
});

window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    showNotification('App installed successfully!', 'success');
});

function setupInstallButton() {
    const btn = document.getElementById('installBtn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        if (!deferredPrompt) { 
            showNotification('App already installed or unavailable.', 'info'); 
            return; 
        }
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') showNotification('App installed successfully!', 'success');
        deferredPrompt = null;
    });
}

// ============================================
// APP UPDATE
// ============================================
window.updateApp = async function() {
    const btn = document.getElementById('updateAppBtn');
    if (!btn) return;
    
    btn.disabled = true;
    btn.innerHTML = '<svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="animation:spin 1s linear infinite"><path d="M21 2v6h-6M3 12a9 9 0 0115.36-6.36L21 8M3 22v-6h6M21 12a9 9 0 01-15.36 6.36L3 16"/></svg> UPDATING...';
    showNotification('Checking for updates...', 'info');
    
    try {
        if ('serviceWorker' in navigator) {
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const r of regs) await r.unregister();
        }
        if ('caches' in window) {
            const names = await caches.keys();
            for (const n of names) await caches.delete(n);
        }
        setTimeout(() => cacheImagesForOffline(), 500);
        showNotification('Update complete! Reloading...', 'success');
        setTimeout(() => window.location.reload(true), 1000);
    } catch (err) {
        showNotification('Update failed. Please try again.', 'error');
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
    try { 
        await loadLocationData(); 
    } catch (e) { 
        console.warn('Could not load location data:', e); 
    }
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
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    } catch (e) {
        return dateString;
    }
}

// ============================================
// INJECT SUMMARY MODAL
// ============================================
function injectSummaryModal() {
    if (document.getElementById('summaryModal')) return;
    
    const html = `
    <div class="modal-overlay" id="summaryModal">
      <div class="modal-content large" id="summaryModalContent">
        <div class="modal-header" style="background:#004080;">
          <span class="modal-title">
            <svg class="modal-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>
            </svg>
            SCHOOL COVERAGE SUMMARY
          </span>
          <button class="modal-close" onclick="closeSummaryModal()">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
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
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

// ============================================
// USER MANAGEMENT
// ============================================
function showLoginScreen() {
    document.getElementById('loginScreen').style.display = 'flex';
    document.getElementById('appMain').style.display = 'none';
    setTimeout(() => { 
        const u = document.getElementById('loginUsername'); 
        if (u) u.focus(); 
    }, 100);
}

function hideLoginScreen() {
    document.getElementById('loginScreen').style.display = 'none';
    document.getElementById('appMain').style.display = 'block';
    cacheImagesForOffline();
}

window.handleLogin = function() {
    const raw      = (document.getElementById('loginUsername').value || '').trim();
    const username = raw.toLowerCase();
    const password = document.getElementById('loginPassword').value;
    const errorEl  = document.getElementById('loginError');

    if (!errorEl) return;
    
    errorEl.style.display = 'none';
    errorEl.textContent   = '';

    if (!username) { 
        errorEl.textContent = 'Please enter your username.'; 
        errorEl.style.display = 'block'; 
        return; 
    }

    if (username === CONFIG.ADMIN_USER.toLowerCase()) {
        if (password !== CONFIG.ADMIN_PASS) {
            errorEl.textContent = 'Invalid password for admin account.';
            errorEl.style.display = 'block';
            return;
        }
        state.currentUser = CONFIG.ADMIN_USER;
        state.isAdmin     = true;
        LOCATION_DATA     = ALL_LOCATION_DATA;
        startApp('Administrator', true);
        return;
    }

    if (!USER_MAP[username] || USER_MAP[username].length === 0) {
        errorEl.textContent = 'Username not recognised. Contact your supervisor.';
        errorEl.style.display = 'block';
        return;
    }

    state.currentUser = username;
    state.isAdmin     = false;
    LOCATION_DATA     = buildFilteredLocationData(USER_MAP[username]);
    startApp(raw, false);
};

function startApp(displayName, isAdmin) {
    document.getElementById('currentUserDisplay').textContent = displayName;
    const badge = document.getElementById('adminBadge');
    if (badge) badge.style.display = isAdmin ? 'inline' : 'none';

    const sbField = document.getElementById('submitted_by');
    if (sbField) sbField.value = state.currentUser;

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
    initAllSignaturePads();
    captureGPS();
    setDefaultDate();
    updateProgress();
    updateSummaryBadge();

    showNotification(isAdmin ? 'Logged in as Administrator' : 'Welcome, ' + displayName + '!', 'success');
}

window.handleLogout = function() {
    if (!confirm('Sign out? Unsaved data will remain in drafts.')) return;
    state.currentUser = null;
    state.isAdmin     = false;
    LOCATION_DATA     = {};
    document.getElementById('loginUsername').value    = '';
    document.getElementById('loginPassword').value    = '';
    document.getElementById('loginError').style.display = 'none';
    try { resetForm(); } catch (e) {}
    showLoginScreen();
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

function buildFilteredLocationData(rows) {
    const f = {};
    rows.forEach(row => {
        const d   = (row.adm1 || '').trim(), c   = (row.adm2 || '').trim();
        const s   = (row.adm3 || '').trim(), fac = (row.hf   || '').trim();
        const com = (row.community   || '').trim();
        const sch = (row.school_name || '').trim();
        if (!d) return;
        if (!f[d]) f[d] = {};
        if (!f[d][c]) f[d][c] = {};
        if (!f[d][c][s]) f[d][c][s] = {};
        if (!f[d][c][s][fac]) f[d][c][s][fac] = {};
        if (com && !f[d][c][s][fac][com]) f[d][c][s][fac][com] = [];
        if (com && sch && !f[d][c][s][fac][com].includes(sch))
            f[d][c][s][fac][com].push(sch);
    });
    for (const d in f) for (const c in f[d]) for (const s in f[d][c])
        for (const fac in f[d][c][s]) for (const com in f[d][c][s][fac])
            f[d][c][s][fac][com].sort();
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
            complete(results) {
                ALL_LOCATION_DATA = {};
                buildUserMap(results.data);
                results.data.forEach(row => {
                    const d   = (row.adm1 || '').trim(), c   = (row.adm2 || '').trim();
                    const s   = (row.adm3 || '').trim(), fac = (row.hf   || '').trim();
                    const com = (row.community   || '').trim();
                    const sch = (row.school_name || '').trim();
                    if (!d) return;
                    if (!ALL_LOCATION_DATA[d]) ALL_LOCATION_DATA[d] = {};
                    if (!ALL_LOCATION_DATA[d][c]) ALL_LOCATION_DATA[d][c] = {};
                    if (!ALL_LOCATION_DATA[d][c][s]) ALL_LOCATION_DATA[d][c][s] = {};
                    if (!ALL_LOCATION_DATA[d][c][s][fac]) ALL_LOCATION_DATA[d][c][s][fac] = {};
                    if (com && !ALL_LOCATION_DATA[d][c][s][fac][com]) ALL_LOCATION_DATA[d][c][s][fac][com] = [];
                    if (com && sch && !ALL_LOCATION_DATA[d][c][s][fac][com].includes(sch))
                        ALL_LOCATION_DATA[d][c][s][fac][com].push(sch);
                });
                for (const d in ALL_LOCATION_DATA) for (const c in ALL_LOCATION_DATA[d])
                    for (const s in ALL_LOCATION_DATA[d][c]) for (const fac in ALL_LOCATION_DATA[d][c][s])
                        for (const com in ALL_LOCATION_DATA[d][c][s][fac])
                            ALL_LOCATION_DATA[d][c][s][fac][com].sort();
                resolve();
            },
            error: reject
        });
    });
}

function populateDistricts() {
    const sel = document.getElementById('district');
    if (!sel) return;
    sel.innerHTML = '<option value="">Select District...</option>';
    Object.keys(LOCATION_DATA).sort().forEach(d => {
        const o = document.createElement('option'); 
        o.value = d; 
        o.textContent = d;
        sel.appendChild(o);
    });
    updateCount('district', Object.keys(LOCATION_DATA).length);
}

function setupCascading() {
    const district  = document.getElementById('district');
    const chiefdom  = document.getElementById('chiefdom');
    const section   = document.getElementById('section_loc');
    const facility  = document.getElementById('facility');
    const community = document.getElementById('community');
    const school    = document.getElementById('school_name');
    
    if (!district) return;

    district.addEventListener('change', function() {
        resetSelect(chiefdom,  'Select Chiefdom...');
        resetSelect(section,   'Select Section...');
        resetSelect(facility,  'Select Health Facility...');
        resetSelect(community, 'Select Community...');
        resetSelect(school,    'Select School...');
        ['chiefdom','section_loc','facility','community','school_name'].forEach(clearCount);
        
        const d = this.value;
        if (d && LOCATION_DATA[d]) {
            chiefdom.disabled = false;
            Object.keys(LOCATION_DATA[d]).sort().forEach(c => appendOpt(chiefdom, c));
            updateCount('chiefdom', Object.keys(LOCATION_DATA[d]).length);
        }
    });

    chiefdom.addEventListener('change', function() {
        resetSelect(section,   'Select Section...');
        resetSelect(facility,  'Select Health Facility...');
        resetSelect(community, 'Select Community...');
        resetSelect(school,    'Select School...');
        ['section_loc','facility','community','school_name'].forEach(clearCount);
        
        const d = district.value, c = this.value;
        if (d && c && LOCATION_DATA[d]?.[c]) {
            section.disabled = false;
            Object.keys(LOCATION_DATA[d][c]).sort().forEach(s => appendOpt(section, s));
            updateCount('section_loc', Object.keys(LOCATION_DATA[d][c]).length);
        }
    });

    section.addEventListener('change', function() {
        resetSelect(facility,  'Select Health Facility...');
        resetSelect(community, 'Select Community...');
        resetSelect(school,    'Select School...');
        ['facility','community','school_name'].forEach(clearCount);
        
        const d = district.value, c = chiefdom.value, s = this.value;
        if (d && c && s && LOCATION_DATA[d]?.[c]?.[s]) {
            facility.disabled = false;
            Object.keys(LOCATION_DATA[d][c][s]).sort().forEach(f => appendOpt(facility, f));
            updateCount('facility', Object.keys(LOCATION_DATA[d][c][s]).length);
        }
    });

    facility.addEventListener('change', function() {
        resetSelect(community, 'Select Community...');
        resetSelect(school,    'Select School...');
        ['community','school_name'].forEach(clearCount);
        
        const d = district.value, c = chiefdom.value, s = section.value, f = this.value;
        if (d && c && s && f && LOCATION_DATA[d]?.[c]?.[s]?.[f]) {
            community.disabled = false;
            Object.keys(LOCATION_DATA[d][c][s][f]).sort().forEach(com => appendOpt(community, com));
            updateCount('community', Object.keys(LOCATION_DATA[d][c][s][f]).length);
        }
    });

    community.addEventListener('change', function() {
        resetSelect(school, 'Select School...');
        clearCount('school_name');
        
        const d = district.value, c = chiefdom.value, s = section.value,
              f = facility.value, com = this.value;
        if (d && c && s && f && com && LOCATION_DATA[d]?.[c]?.[s]?.[f]?.[com]) {
            school.disabled = false;
            LOCATION_DATA[d][c][s][f][com].forEach(sch => appendOpt(school, sch));
            updateCount('school_name', LOCATION_DATA[d][c][s][f][com].length);
        }
    });
}

function appendOpt(sel, val) {
    const o = document.createElement('option'); 
    o.value = val; 
    o.textContent = val; 
    sel.appendChild(o);
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
function setupSchoolSubmissionCheck() {
    const schoolSel = document.getElementById('school_name');
    if (!schoolSel) return;

    schoolSel.addEventListener('change', function() {
        const key = currentSchoolKey();
        if (!key) return;

        const banner = document.getElementById('schoolSubmittedBanner');
        if (isSchoolSubmitted(key)) {
            if (!banner) injectSubmittedBanner();
            const bannerEl = document.getElementById('schoolSubmittedBanner');
            if (bannerEl) bannerEl.style.display = 'flex';
            
            const nextBtn = document.querySelector('.form-section[data-section="2"] .btn-next');
            if (nextBtn) {
                nextBtn.disabled = true;
                nextBtn.title = 'This school has already been submitted';
            }
        } else {
            if (banner) banner.style.display = 'none';
            const nextBtn = document.querySelector('.form-section[data-section="2"] .btn-next');
            if (nextBtn) { 
                nextBtn.disabled = false; 
                nextBtn.title = ''; 
            }
        }
    });
}

function injectSubmittedBanner() {
    const section2 = document.querySelector('.form-section[data-section="2"]');
    if (!section2) return;
    
    const banner = document.createElement('div');
    banner.id = 'schoolSubmittedBanner';
    banner.style.cssText = 'display:none;background:#fff0f0;border:2px solid #dc3545;border-radius:8px;padding:14px 16px;margin-bottom:16px;align-items:center;gap:12px;';
    banner.innerHTML = `
      <svg style="width:22px;height:22px;stroke:#dc3545;flex-shrink:0" viewBox="0 0 24 24" fill="none" stroke-width="2">
        <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
      <div>
        <div style="font-size:13px;font-weight:700;color:#c0392b;text-transform:uppercase;letter-spacing:.5px;">ALREADY SUBMITTED</div>
        <div style="font-size:12px;color:#555;margin-top:2px;">
          This school has already been submitted. 
          <a href="#" onclick="viewSubmittedSchoolFromBanner(); return false;"
             style="color:#004080;font-weight:600;text-decoration:underline;">View submission details</a>
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
        const district = document.getElementById('district')?.value || '';
        const chiefdom = document.getElementById('chiefdom')?.value || '';
        const section = document.getElementById('section_loc')?.value || '';
        const facility = document.getElementById('facility')?.value || '';
        const community = document.getElementById('community')?.value || '';
        const school = document.getElementById('school_name')?.value || '';
        
        if (!district || !chiefdom || !section || !facility || !community || !school) {
            return null;
        }
        
        return [district, chiefdom, section, facility, community, school]
            .map(s => s.trim().toLowerCase())
            .join('|');
    } catch (error) {
        console.error('Error in currentSchoolKey:', error);
        return null;
    }
}

function makeSchoolKey(district, chiefdom, section, facility, community, school) {
    return [district, chiefdom, section, facility, community, school]
        .map(s => (s || '').toString().trim().toLowerCase())
        .join('|');
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
    const data = state.isAdmin ? ALL_LOCATION_DATA : LOCATION_DATA;
    
    try {
        for (const district in data) {
            for (const chiefdom in data[district]) {
                for (const section in data[district][chiefdom]) {
                    for (const facility in data[district][chiefdom][section]) {
                        for (const community in data[district][chiefdom][section][facility]) {
                            const schoolList = data[district][chiefdom][section][facility][community];
                            if (Array.isArray(schoolList)) {
                                schoolList.forEach(school => {
                                    schools.push({
                                        district: district,
                                        chiefdom: chiefdom,
                                        section: section,
                                        facility: facility,
                                        community: community,
                                        school_name: school,
                                        key: makeSchoolKey(district, chiefdom, section, facility, community, school)
                                    });
                                });
                            }
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error('Error in getAllAssignedSchools:', error);
    }
    
    return schools;
}

// ============================================
// SUMMARY MODAL
// ============================================
function updateSummaryBadge() {
    const btn = document.getElementById('viewSummaryBtn');
    if (!btn) return;
    
    const all       = getAllAssignedSchools();
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

window.openSummaryModal = function() {
    const modal = document.getElementById('summaryModal');
    const body  = document.getElementById('summaryModalBody');
    const all   = getAllAssignedSchools();

    const total     = all.length;
    const submitted = all.filter(s => isSchoolSubmitted(s.key));
    const pending   = all.filter(s => !isSchoolSubmitted(s.key));

    const pct = total > 0 ? Math.round((submitted.length / total) * 100) : 0;

    const byDistributor = {};
    all.forEach(s => {
        const rec = getSubmittedRecord(s.key);
        const distributor = rec?.data?.submitted_by || 'Pending';
        if (!byDistributor[distributor]) {
            byDistributor[distributor] = { total: 0, submitted: 0 };
        }
        byDistributor[distributor].total++;
        if (isSchoolSubmitted(s.key)) byDistributor[distributor].submitted++;
    });

    let distributorRows = '';
    Object.entries(byDistributor).sort().forEach(([d, v]) => {
        const dpct = Math.round((v.submitted / v.total) * 100);
        distributorRows += `
          <tr>
            <td style="font-weight:600; text-align:left;">${d}</td>
            <td style="text-align:center;">${v.total}</td>
            <td style="text-align:center; color:#28a745; font-weight:700;">${v.submitted}</td>
            <td style="text-align:center; color:#dc3545; font-weight:700;">${v.total - v.submitted}</td>
            <td style="text-align:center;">
              <div style="background:#e9ecef; border-radius:4px; height:10px; width:100px; overflow:hidden; margin:0 auto;">
                <div style="background:${dpct===100?'#28a745':'#004080'}; height:100%; width:${dpct}%; transition:width .3s;"></div>
              </div>
              <span style="font-size:10px; font-weight:700; color:${dpct===100?'#28a745':'#004080'};">${dpct}%</span>
            </td>
          </tr>`;
    });

    let schoolRows = '';
    all.sort((a, b) => a.district.localeCompare(b.district) || a.school_name.localeCompare(b.school_name))
       .forEach(s => {
           const done = isSchoolSubmitted(s.key);
           const rec  = getSubmittedRecord(s.key);
           const when = rec ? formatDate(rec.timestamp) : '—';
           const coverage = rec?.data?.coverage_total ? rec.data.coverage_total + '%' : '—';
           const distributor = rec?.data?.submitted_by || '—';
           
           schoolRows += `
             <tr style="cursor:pointer; ${done ? 'background:#f0fff0;' : ''}" onclick="openSchoolDetail('${s.key}')">
               <td style="padding:12px 8px; text-align:left;">
                 <span style="display:inline-block; width:10px; height:10px; border-radius:50%;
                   background:${done ? '#28a745' : '#ffc107'}; margin-right:10px;"></span>
                 <strong>${s.school_name}</strong>
               </td>
               <td style="padding:12px 8px; text-align:center;">${s.community}</td>
               <td style="padding:12px 8px; text-align:center;">${s.district}</td>
               <td style="padding:12px 8px; text-align:center;">
                 ${done
                   ? `<span style="background:#28a745; color:#fff; border-radius:4px; padding:4px 12px; font-size:11px; font-weight:600; letter-spacing:0.5px;">SUBMITTED</span>`
                   : `<span style="background:#ffc107; color:#000; border-radius:4px; padding:4px 12px; font-size:11px; font-weight:600; letter-spacing:0.5px;">PENDING</span>`}
               </td>
               <td style="padding:12px 8px; text-align:center; font-size:11px; color:#666;">${when}</td>
               <td style="padding:12px 8px; text-align:center; font-size:11px;">${distributor}</td>
               <td style="padding:12px 8px; text-align:center; font-weight:700; color:${done ? '#28a745' : '#aaa'}">${coverage}</td>
               <td style="padding:12px 8px; text-align:center;">
                 ${done
                   ? `<button onclick="event.stopPropagation(); openSchoolDetail('${s.key}')"
                        style="background:#004080; color:#fff; border:none; border-radius:4px; padding:6px 16px; font-size:11px; font-weight:600; cursor:pointer; font-family:'Oswald',sans-serif; letter-spacing:0.5px;">VIEW</button>`
                   : `<button onclick="event.stopPropagation(); loadSchoolIntoForm('${s.key}')"
                        style="background:#28a745; color:#fff; border:none; border-radius:4px; padding:6px 16px; font-size:11px; font-weight:600; cursor:pointer; font-family:'Oswald',sans-serif; letter-spacing:0.5px;">START</button>`}
               </td>
             </tr>`;
       });

    body.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:15px; margin-bottom:25px;">
        <div style="background:#e8f1fa; border:2px solid #004080; border-radius:10px; padding:20px 10px; text-align:center;">
          <div style="font-size:36px; font-weight:700; color:#004080; line-height:1.2;">${total}</div>
          <div style="font-size:12px; color:#555; text-transform:uppercase; letter-spacing:.5px; margin-top:5px;">Target Schools</div>
        </div>
        <div style="background:#e8f5e9; border:2px solid #28a745; border-radius:10px; padding:20px 10px; text-align:center;">
          <div style="font-size:36px; font-weight:700; color:#28a745; line-height:1.2;">${submitted.length}</div>
          <div style="font-size:12px; color:#555; text-transform:uppercase; letter-spacing:.5px; margin-top:5px;">Submitted</div>
        </div>
        <div style="background:#fff5f5; border:2px solid #dc3545; border-radius:10px; padding:20px 10px; text-align:center;">
          <div style="font-size:36px; font-weight:700; color:#dc3545; line-height:1.2;">${pending.length}</div>
          <div style="font-size:12px; color:#555; text-transform:uppercase; letter-spacing:.5px; margin-top:5px;">Remaining</div>
        </div>
        <div style="background:#fff8e1; border:2px solid #ffc107; border-radius:10px; padding:20px 10px; text-align:center;">
          <div style="font-size:36px; font-weight:700; color:#e6a800; line-height:1.2;">${pct}%</div>
          <div style="font-size:12px; color:#555; text-transform:uppercase; letter-spacing:.5px; margin-top:5px;">Completion</div>
        </div>
      </div>

      <div style="background:#e9ecef; border-radius:8px; height:20px; overflow:hidden; margin:0 0 25px 0;">
        <div style="background:${pct===100?'#28a745':'#004080'}; height:100%; width:${pct}%; transition:width .4s; border-radius:8px;"></div>
      </div>

      <div style="margin-bottom:25px;">
        <div style="background:#004080; color:#fff; padding:12px 20px; border-radius:8px 8px 0 0; font-size:14px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; text-align:center;">
          Progress by Distributor
        </div>
        <div style="overflow-x:auto; border:2px solid #dee2e6; border-top:none; border-radius:0 0 8px 8px;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#f8f9fa;">
                <th style="padding:12px 15px; text-align:left; border-bottom:1px solid #dee2e6;">Distributor</th>
                <th style="padding:12px; text-align:center; border-bottom:1px solid #dee2e6;">Target</th>
                <th style="padding:12px; text-align:center; border-bottom:1px solid #dee2e6;">Done</th>
                <th style="padding:12px; text-align:center; border-bottom:1px solid #dee2e6;">Left</th>
                <th style="padding:12px 15px; text-align:center; border-bottom:1px solid #dee2e6;">Progress</th>
              </tr>
            </thead>
            <tbody>${distributorRows}</tbody>
          </table>
        </div>
      </div>

      <div>
        <div style="background:#004080; color:#fff; padding:12px 20px; border-radius:8px 8px 0 0; font-size:14px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; display:flex; justify-content:space-between; align-items:center;">
          <span>All Assigned Schools</span>
          <span style="font-size:12px; font-weight:400; opacity:.8;">Click any row to view / start</span>
        </div>
        <div style="overflow-x:auto; border:2px solid #dee2e6; border-top:none; border-radius:0 0 8px 8px;">
          <table style="width:100%; border-collapse:collapse; font-size:13px;">
            <thead>
              <tr style="background:#f8f9fa;">
                <th style="padding:12px 15px; text-align:left; border-bottom:2px solid #dee2e6;">School</th>
                <th style="padding:12px; text-align:center; border-bottom:2px solid #dee2e6;">Community</th>
                <th style="padding:12px; text-align:center; border-bottom:2px solid #dee2e6;">District</th>
                <th style="padding:12px; text-align:center; border-bottom:2px solid #dee2e6;">Status</th>
                <th style="padding:12px; text-align:center; border-bottom:2px solid #dee2e6;">Submitted</th>
                <th style="padding:12px; text-align:center; border-bottom:2px solid #dee2e6;">By</th>
                <th style="padding:12px; text-align:center; border-bottom:2px solid #dee2e6;">Coverage</th>
                <th style="padding:12px; text-align:center; border-bottom:2px solid #dee2e6;">Action</th>
              </tr>
            </thead>
            <tbody>${schoolRows}</tbody>
          </table>
        </div>
      </div>`;

    if (modal) modal.classList.add('show');
};

window.closeSummaryModal = function() {
    const modal = document.getElementById('summaryModal');
    if (modal) modal.classList.remove('show');
};

window.viewSummary = function() {
    openSummaryModal();
};

// ============================================
// SCHOOL DETAIL MODAL
// ============================================
window.openSchoolDetail = function(key) {
    const rec = getSubmittedRecord(key);
    if (!rec) {
        const school = getAllAssignedSchools().find(s => s.key === key);
        if (school) {
            if (confirm('This school has not been submitted yet. Load it into the form now?'))
                loadSchoolIntoForm(key);
        }
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
        const boys     = parseInt(d['c' + c + '_boys'])     || 0;
        const girls    = parseInt(d['c' + c + '_girls'])    || 0;
        const boysITN  = parseInt(d['c' + c + '_boys_itn']) || 0;
        const girlsITN = parseInt(d['c' + c + '_girls_itn'])|| 0;
        const total    = boys + girls;
        const itn      = boysITN + girlsITN;
        const cov      = total > 0 ? Math.round((itn / total) * 100) : 0;
        classRows += `<tr>
          <td style="font-weight:600; text-align:left; padding:8px 12px;">Class ${c}</td>
          <td style="text-align:center; padding:8px;">${boys}</td><td style="text-align:center; padding:8px;">${boysITN}</td>
          <td style="text-align:center; padding:8px;">${girls}</td><td style="text-align:center; padding:8px;">${girlsITN}</td>
          <td style="text-align:center; padding:8px; font-weight:700;">${total}</td>
          <td style="text-align:center; padding:8px; font-weight:700;">${itn}</td>
          <td style="text-align:center; padding:8px; font-weight:700; color:${cov>=80?'#28a745':cov>=50?'#e6a800':'#dc3545'};">${cov}%</td>
        </tr>`;
    }

    const totBoys     = parseInt(d.total_boys)     || 0;
    const totGirls    = parseInt(d.total_girls)    || 0;
    const totPupils   = parseInt(d.total_pupils)   || 0;
    const totBoysITN  = parseInt(d.total_boys_itn) || 0;
    const totGirlsITN = parseInt(d.total_girls_itn)|| 0;
    const totITN      = parseInt(d.total_itn)      || 0;
    const coverage    = parseInt(d.coverage_total) || 0;
    const covBoys     = parseInt(d.coverage_boys)  || 0;
    const covGirls    = parseInt(d.coverage_girls) || 0;
    const remaining   = parseInt(d.itns_remaining) || 0;

    const itnTypes = [
        d.itn_type_pbo === 'Yes' ? 'PBO' : '',
        d.itn_type_ig2 === 'Yes' ? 'IG2' : ''
    ].filter(Boolean).join(', ') || '—';

    body.innerHTML = `
      <div style="display:grid; grid-template-columns:repeat(2,1fr); gap:12px; margin-bottom:25px;">
        ${infoCard('District',      d.district      || '—')}
        ${infoCard('Chiefdom',      d.chiefdom      || '—')}
        ${infoCard('Section',       d.section_loc   || '—')}
        ${infoCard('Health Facility', d.facility    || '—')}
        ${infoCard('Community',     d.community     || '—')}
        ${infoCard('School',        d.school_name   || '—')}
        ${infoCard('Head Teacher',  d.head_teacher  || '—')}
        ${infoCard('HT Phone',      d.head_teacher_phone || '—')}
        ${infoCard('Distribution Date', d.distribution_date || '—')}
        ${infoCard('Survey Date',   d.survey_date   || '—')}
        ${infoCard('Submitted At',  formatDate(rec.timestamp))}
        ${infoCard('Submitted By',  d.submitted_by  || '—')}
        ${infoCard('ITN Type(s)',   itnTypes)}
        ${infoCard('ITNs Received', d.itns_received || '—')}
      </div>

      <div style="display:grid; grid-template-columns:repeat(4,1fr); gap:12px; margin-bottom:25px;">
        ${statCard('Total Pupils',    totPupils,  '#004080')}
        ${statCard('ITNs Distributed', totITN,   '#28a745')}
        ${statCard('ITNs Remaining',  remaining, remaining < 0 ? '#dc3545' : '#fd7e14')}
        ${statCard('Coverage',        coverage + '%', coverage >= 80 ? '#28a745' : coverage >= 50 ? '#e6a800' : '#dc3545')}
      </div>

      <div style="display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin-bottom:25px;">
        ${statCard('Boys Enrolled',      totBoys,     '#004080')}
        ${statCard('Boys ITN Coverage',  covBoys+'%', '#004080')}
        ${statCard('Boys Received ITN',  totBoysITN,  '#004080')}
        ${statCard('Girls Enrolled',     totGirls,    '#e91e8c')}
        ${statCard('Girls ITN Coverage', covGirls+'%','#e91e8c')}
        ${statCard('Girls Received ITN', totGirlsITN, '#e91e8c')}
      </div>

      <div style="background:#004080; color:#fff; padding:12px 20px; border-radius:8px 8px 0 0; font-size:14px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; text-align:center;">
        Class-by-Class Breakdown
      </div>
      <div style="overflow-x:auto; border:2px solid #dee2e6; border-top:none; border-radius:0 0 8px 8px; margin-bottom:25px;">
        <table style="width:100%; border-collapse:collapse; font-size:13px;">
          <thead>
            <tr style="background:#f8f9fa;">
              <th style="padding:10px 12px; text-align:left; border-bottom:1px solid #dee2e6;">Class</th>
              <th style="padding:10px; text-align:center; border-bottom:1px solid #dee2e6;">Boys</th>
              <th style="padding:10px; text-align:center; border-bottom:1px solid #dee2e6;">Boys ITN</th>
              <th style="padding:10px; text-align:center; border-bottom:1px solid #dee2e6;">Girls</th>
              <th style="padding:10px; text-align:center; border-bottom:1px solid #dee2e6;">Girls ITN</th>
              <th style="padding:10px; text-align:center; border-bottom:1px solid #dee2e6;">Total</th>
              <th style="padding:10px; text-align:center; border-bottom:1px solid #dee2e6;">ITN</th>
              <th style="padding:10px; text-align:center; border-bottom:1px solid #dee2e6;">Coverage</th>
            </tr>
          </thead>
          <tbody>
            ${classRows}
            <tr style="background:#e8f1fa; font-weight:700;">
              <td style="padding:10px 12px;">TOTAL</td>
              <td style="text-align:center; padding:10px;">${totBoys}</td><td style="text-align:center; padding:10px;">${totBoysITN}</td>
              <td style="text-align:center; padding:10px;">${totGirls}</td><td style="text-align:center; padding:10px;">${totGirlsITN}</td>
              <td style="text-align:center; padding:10px;">${totPupils}</td><td style="text-align:center; padding:10px;">${totITN}</td>
              <td style="text-align:center; padding:10px; color:${coverage>=80?'#28a745':coverage>=50?'#e6a800':'#dc3545'}; font-size:15px;">${coverage}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${buildTeamSection(d)}

      ${d.gps_lat ? `
      <div style="background:#e8f1fa; border:2px solid #004080; border-radius:8px; padding:15px 20px; font-size:13px; text-align:center;">
        <strong style="color:#004080; display:block; margin-bottom:5px;">GPS COORDINATES</strong>
        <div style="font-family:monospace; font-size:14px;">${d.gps_lat}, ${d.gps_lng}</div>
        ${d.gps_acc ? '<div style="color:#666; margin-top:5px; font-size:11px;">Accuracy: ±' + d.gps_acc + 'm</div>' : ''}
      </div>` : ''}`;

    closeSummaryModal();
    if (modal) modal.classList.add('show');
};

function infoCard(label, value) {
    return `<div style="background:#f8f9fa; border:1px solid #dee2e6; border-radius:7px; padding:12px 15px; text-align:center;">
      <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.5px; margin-bottom:4px;">${label}</div>
      <div style="font-size:14px; font-weight:600; color:#333;">${value}</div>
    </div>`;
}

function statCard(label, value, color) {
    return `<div style="background:#fff; border:2px solid ${color}20; border-radius:10px; padding:15px 10px; text-align:center;">
      <div style="font-size:28px; font-weight:700; color:${color}; line-height:1.2;">${value}</div>
      <div style="font-size:11px; color:#666; text-transform:uppercase; letter-spacing:.5px; margin-top:5px;">${label}</div>
    </div>`;
}

function buildTeamSection(d) {
    let html = '<div style="margin-bottom:20px;"><div style="background:#004080; color:#fff; padding:12px 20px; border-radius:8px 8px 0 0; font-size:14px; font-weight:600; letter-spacing:.5px; text-transform:uppercase; text-align:center;">Team Members</div>';
    html += '<div style="border:2px solid #dee2e6; border-top:none; border-radius:0 0 8px 8px; padding:20px; display:grid; grid-template-columns:repeat(3,1fr); gap:15px;">';
    for (let i = 1; i <= 3; i++) {
        const name  = d['team' + i + '_name']  || '';
        const phone = d['team' + i + '_phone'] || '';
        if (name) {
            html += `<div style="background:#f8f9fa; border-radius:8px; padding:15px; text-align:center;">
              <div style="font-size:11px; color:#004080; font-weight:700; text-transform:uppercase; margin-bottom:6px;">Member ${i}</div>
              <div style="font-size:14px; font-weight:600;">${name}</div>
              ${phone ? `<div style="font-size:12px; color:#666; margin-top:4px;">${phone}</div>` : ''}
            </div>`;
        }
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

    const distEl = document.getElementById('district');
    if (distEl) { 
        distEl.value = school.district; 
        distEl.dispatchEvent(new Event('change')); 
    }
    
    setTimeout(() => {
        const cEl = document.getElementById('chiefdom');
        if (cEl) { 
            cEl.value = school.chiefdom; 
            cEl.dispatchEvent(new Event('change')); 
        }
        setTimeout(() => {
            const sEl = document.getElementById('section_loc');
            if (sEl) { 
                sEl.value = school.section; 
                sEl.dispatchEvent(new Event('change')); 
            }
            setTimeout(() => {
                const fEl = document.getElementById('facility');
                if (fEl) { 
                    fEl.value = school.facility; 
                    fEl.dispatchEvent(new Event('change')); 
                }
                setTimeout(() => {
                    const comEl = document.getElementById('community');
                    if (comEl) { 
                        comEl.value = school.community; 
                        comEl.dispatchEvent(new Event('change')); 
                    }
                    setTimeout(() => {
                        const schEl = document.getElementById('school_name');
                        if (schEl) { 
                            schEl.value = school.school_name; 
                            schEl.dispatchEvent(new Event('change')); 
                        }
                    }, 100);
                }, 100);
            }, 100);
        }, 100);
    }, 100);

    showNotification('Loaded: ' + school.school_name, 'info');
};

// ============================================
// NAVIGATION - FIXED
// ============================================
window.nextSection = function() {
    console.log('Next section clicked, current section:', state.currentSection);
    
    if (state.currentSection === 1) {
        moveToNextSection();
        return;
    }
    
    if (validateCurrentSection()) {
        moveToNextSection();
    } else {
        console.log('Validation failed');
    }
};

window.previousSection = function() {
    if (state.currentSection > 1) {
        const currentSectionEl = document.querySelector('.form-section[data-section="' + state.currentSection + '"]');
        if (currentSectionEl) currentSectionEl.classList.remove('active');
        
        state.currentSection--;
        
        const prevSectionEl = document.querySelector('.form-section[data-section="' + state.currentSection + '"]');
        if (prevSectionEl) prevSectionEl.classList.add('active');
        
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        console.log('Moved to section:', state.currentSection);
    }
};

function moveToNextSection() {
    if (state.currentSection < state.totalSections) {
        const currentSectionEl = document.querySelector('.form-section[data-section="' + state.currentSection + '"]');
        if (currentSectionEl) currentSectionEl.classList.remove('active');
        
        state.currentSection++;
        
        const nextSectionEl = document.querySelector('.form-section[data-section="' + state.currentSection + '"]');
        if (nextSectionEl) nextSectionEl.classList.add('active');
        
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
        if (state.currentSection === 4) {
            calculateAll();
        }
        
        console.log('Moved to section:', state.currentSection);
    }
}

function validateCurrentSection() {
    console.log('Validating section:', state.currentSection);
    
    const section = document.querySelector('.form-section[data-section="' + state.currentSection + '"]');
    if (!section) {
        console.log('Section not found');
        return true;
    }
    
    if (state.currentSection === 1) return true;

    if (state.currentSection === 2) {
        const key = currentSchoolKey();
        if (key && isSchoolSubmitted(key)) {
            showNotification('This school has already been submitted. Choose a different school.', 'error');
            return false;
        }
    }

    let isValid = true;
    let firstInvalidField = null;

    section.querySelectorAll('input[required], select[required]').forEach(field => {
        if (field.type === 'hidden') return;
        
        if (!field.value || field.value.trim() === '') {
            isValid = false;
            field.classList.add('error');
            
            const errorEl = document.getElementById('error_' + field.id);
            if (errorEl) errorEl.classList.add('show');
            
            if (!firstInvalidField) firstInvalidField = field;
        } else {
            field.classList.remove('error');
            const errorEl = document.getElementById('error_' + field.id);
            if (errorEl) errorEl.classList.remove('show');
        }
    });

    if (state.currentSection === 3) {
        const pboChecked = document.getElementById('itn_type_pbo')?.checked || false;
        const ig2Checked = document.getElementById('itn_type_ig2')?.checked || false;
        
        if (!pboChecked && !ig2Checked) {
            isValid = false;
            const errorEl = document.getElementById('error_itn_type');
            if (errorEl) errorEl.classList.add('show');
            showNotification('Please select at least one ITN type.', 'error');
        } else {
            const errorEl = document.getElementById('error_itn_type');
            if (errorEl) errorEl.classList.remove('show');
        }
        
        if (pboChecked || ig2Checked) {
            if (!validateITNQuantities()) {
                isValid = false;
            }
        }
        
        document.querySelectorAll('.itn-field').forEach(field => {
            const maxFieldId = field.getAttribute('data-max-field');
            if (maxFieldId) {
                const maxField = document.getElementById(maxFieldId);
                if (maxField) {
                    const maxVal = parseInt(maxField.value) || 0;
                    const fieldVal = parseInt(field.value) || 0;
                    
                    if (fieldVal > maxVal) {
                        isValid = false;
                        field.classList.add('error');
                        const errorEl = document.getElementById('error_' + field.id);
                        if (errorEl) errorEl.classList.add('show');
                    }
                }
            }
        });
    }

    if (!isValid) {
        showNotification('Please fill in all required fields correctly.', 'error');
        if (firstInvalidField) {
            firstInvalidField.focus();
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    return isValid;
}

function updateProgress() {
    const progressFill = document.getElementById('progressFill');
    const progressText = document.getElementById('progressText');
    
    if (progressFill) {
        const pct = (state.currentSection / state.totalSections) * 100;
        progressFill.style.width = pct + '%';
    }
    
    if (progressText) {
        progressText.textContent = 'SECTION ' + state.currentSection + ' OF ' + state.totalSections;
    }
}

// ============================================
// VALIDATION
// ============================================
function setupValidation() {
    document.querySelectorAll('.itn-field').forEach(input => {
        input.addEventListener('input', function() { 
            validateITNField(this); 
            calculateAll(); 
        });
    });
    
    document.querySelectorAll('.enrollment-field').forEach(input => {
        input.addEventListener('input', function() {
            const itnField = document.getElementById('c' + this.dataset.class + '_' + this.dataset.gender + '_itn');
            if (itnField) validateITNField(itnField);
            calculateAll();
        });
    });
}

function validateITNField(itnInput) {
    if (!itnInput) return true;
    
    const maxField = document.getElementById(itnInput.dataset.maxField);
    if (!maxField) return true;
    
    const maxVal = parseInt(maxField.value) || 0;
    const itnVal = parseInt(itnInput.value) || 0;
    const errorEl = document.getElementById('error_' + itnInput.id);
    
    if (itnVal > maxVal) {
        itnInput.classList.add('error');
        if (errorEl) errorEl.classList.add('show');
        return false;
    }
    
    itnInput.classList.remove('error');
    if (errorEl) errorEl.classList.remove('show');
    return true;
}

// ============================================
// ITN TYPE QUANTITY
// ============================================
window.toggleITNTypeQuantity = function() {
    const pbo = document.getElementById('itn_type_pbo')?.checked || false;
    const ig2 = document.getElementById('itn_type_ig2')?.checked || false;
    
    const qtyFields = document.getElementById('itn_quantity_fields');
    if (qtyFields) qtyFields.style.display = (pbo || ig2) ? 'block' : 'none';
    
    const pboGroup = document.getElementById('pbo_quantity_group');
    if (pboGroup) pboGroup.style.display = pbo ? 'block' : 'none';
    
    const ig2Group = document.getElementById('ig2_quantity_group');
    if (ig2Group) ig2Group.style.display = ig2 ? 'block' : 'none';
    
    if (!pbo) {
        const pboQty = document.getElementById('itn_qty_pbo');
        if (pboQty) pboQty.value = 0;
    }
    
    if (!ig2) {
        const ig2Qty = document.getElementById('itn_qty_ig2');
        if (ig2Qty) ig2Qty.value = 0;
    }
    
    validateITNQuantities();
};

function validateITNQuantities() {
    const receivedInput = document.getElementById('itns_received');
    const pboQtyInput = document.getElementById('itn_qty_pbo');
    const ig2QtyInput = document.getElementById('itn_qty_ig2');
    const pboChecked = document.getElementById('itn_type_pbo')?.checked || false;
    const ig2Checked = document.getElementById('itn_type_ig2')?.checked || false;
    
    if (!pboChecked && !ig2Checked) return true;
    
    const received = receivedInput ? (parseInt(receivedInput.value) || 0) : 0;
    const pboQty = pboQtyInput ? (parseInt(pboQtyInput.value) || 0) : 0;
    const ig2Qty = ig2QtyInput ? (parseInt(ig2QtyInput.value) || 0) : 0;
    
    const fromTypes = pboQty + ig2Qty;
    
    const totalEl = document.getElementById('itn_type_total');
    const statusEl = document.getElementById('itn_qty_status');
    const errEl = document.getElementById('error_itn_qty_mismatch');
    
    if (totalEl) totalEl.textContent = fromTypes;
    
    if (received > 0) {
        if (fromTypes === received) {
            if (statusEl) {
                statusEl.textContent = '✓ Matches total received';
                statusEl.className = 'qty-status match';
            }
            if (errEl) errEl.style.display = 'none';
            return true;
        } else {
            if (statusEl) {
                statusEl.textContent = '✗ Does not match (' + received + ' received)';
                statusEl.className = 'qty-status mismatch';
            }
            if (errEl) errEl.style.display = 'block';
            return false;
        }
    }
    
    if (statusEl) {
        statusEl.textContent = '';
        statusEl.className = 'qty-status';
    }
    if (errEl) errEl.style.display = 'none';
    return true;
}

// ============================================
// PHONE VALIDATION
// ============================================
function setupPhoneValidation() {
    document.querySelectorAll('.phone-field').forEach(input => {
        input.addEventListener('input', function() {
            this.value = this.value.replace(/\D/g, '').slice(0, 9);
            validatePhoneField(this);
        });
    });
}

function validatePhoneField(input) {
    if (!input) return true;
    
    const errorEl = document.getElementById('error_' + input.id);
    const isReq = input.hasAttribute('required');
    const val = input.value.trim();
    
    if (val === '' && !isReq) { 
        input.classList.remove('error'); 
        if (errorEl) errorEl.classList.remove('show'); 
        return true; 
    }
    
    if (val.length !== 9 || !/^\d{9}$/.test(val)) { 
        input.classList.add('error'); 
        if (errorEl) errorEl.classList.add('show'); 
        return false; 
    }
    
    input.classList.remove('error'); 
    if (errorEl) errorEl.classList.remove('show'); 
    return true;
}

// ============================================
// NAME VALIDATION
// ============================================
function setupNameValidation() {
    document.querySelectorAll('.name-field').forEach(input => {
        input.addEventListener('input',  function() { 
            this.value = this.value.replace(/[0-9]/g, ''); 
        });
        input.addEventListener('blur',   function() { 
            validateNameField(this); 
        });
    });
}

function validateNameField(input) {
    if (!input) return true;
    
    const errorEl = document.getElementById('error_' + input.id);
    const isReq = input.hasAttribute('required');
    const val = input.value.trim();
    
    if (val === '' && !isReq) { 
        input.classList.remove('error'); 
        if (errorEl) errorEl.classList.remove('show'); 
        return true; 
    }
    
    if (val === '' && isReq) { 
        input.classList.add('error'); 
        if (errorEl) errorEl.classList.add('show'); 
        return false; 
    }
    
    if (/[0-9]/.test(val)) { 
        input.classList.add('error'); 
        if (errorEl) { 
            errorEl.textContent = 'Name cannot contain numbers'; 
            errorEl.classList.add('show'); 
        } 
        return false; 
    }
    
    if (val.length < 2) { 
        input.classList.add('error'); 
        if (errorEl) { 
            errorEl.textContent = 'Name must be at least 2 characters'; 
            errorEl.classList.add('show'); 
        } 
        return false; 
    }
    
    input.classList.remove('error'); 
    if (errorEl) errorEl.classList.remove('show'); 
    return true;
}

// ============================================
// CALCULATIONS
// ============================================
function setupCalculations() {
    document.querySelectorAll('.enrollment-field, .itn-field').forEach(input => {
        input.addEventListener('input', calculateAll);
    });
    
    const rec = document.getElementById('itns_received');
    if (rec) rec.addEventListener('input', () => { 
        calculateAll(); 
        validateITNQuantities(); 
    });
}

function getNum(id) { 
    const element = document.getElementById(id); 
    return element ? (parseInt(element.value) || 0) : 0; 
}

function setText(id, v) { 
    const element = document.getElementById(id); 
    if (element) element.textContent = v; 
}

function setVal(id, v) { 
    const element = document.getElementById(id); 
    if (element) element.value = v; 
}

function calculateAll() {
    try {
        let tB = 0, tG = 0, tBI = 0, tGI = 0;
        
        for (let c = 1; c <= 5; c++) {
            const b = getNum('c' + c + '_boys');
            const bi = getNum('c' + c + '_boys_itn');
            const g = getNum('c' + c + '_girls');
            const gi = getNum('c' + c + '_girls_itn');
            
            tB += b;
            tG += g;
            tBI += bi;
            tGI += gi;
            
            setText('t' + c + '_b', b);
            setText('t' + c + '_bi', bi);
            setText('t' + c + '_g', g);
            setText('t' + c + '_gi', gi);
            setText('t' + c + '_t', b + g);
            setText('t' + c + '_ti', bi + gi);
            
            const classTotal = b + g;
            const classITN = bi + gi;
            setText('t' + c + '_c', classTotal > 0 ? Math.round((classITN / classTotal) * 100) + '%' : '0%');
        }
        
        const totalPupils = tB + tG;
        const totalITN = tBI + tGI;
        
        setText('sum_total_boys', tB);
        setText('sum_total_girls', tG);
        setText('sum_total_pupils', totalPupils);
        setText('sum_boys_itn', tBI);
        setText('sum_girls_itn', tGI);
        setText('sum_total_itn', totalITN);
        
        setVal('total_boys', tB);
        setVal('total_girls', tG);
        setVal('total_pupils', totalPupils);
        setVal('total_boys_itn', tBI);
        setVal('total_girls_itn', tGI);
        setVal('total_itn', totalITN);
        
        const received = getNum('itns_received');
        const remaining = received - totalITN;
        setText('itns_remaining', remaining);
        setVal('itns_remaining_val', remaining);
        
        const remainingStatus = document.getElementById('remaining_status');
        if (remainingStatus) {
            if (remaining < 0) {
                remainingStatus.textContent = 'Warning: More ITNs distributed than received!';
                remainingStatus.className = 'remaining-status warning';
            } else if (remaining === 0 && received > 0) {
                remainingStatus.textContent = 'All ITNs distributed';
                remainingStatus.className = 'remaining-status success';
            } else {
                remainingStatus.textContent = '';
                remainingStatus.className = 'remaining-status';
            }
        }
        
        const boysPct = totalPupils > 0 ? Math.round((tB / totalPupils) * 100) : 0;
        const girlsPct = totalPupils > 0 ? Math.round((tG / totalPupils) * 100) : 0;
        
        setText('prop_boys', boysPct + '%');
        setText('prop_girls', girlsPct + '%');
        setVal('prop_boys_val', boysPct);
        setVal('prop_girls_val', girlsPct);
        
        const boysBar = document.getElementById('bar_boys');
        if (boysBar) boysBar.style.width = boysPct + '%';
        
        const girlsBar = document.getElementById('bar_girls');
        if (girlsBar) girlsBar.style.width = girlsPct + '%';
        
        const boysCov = tB > 0 ? Math.round((tBI / tB) * 100) : 0;
        const girlsCov = tG > 0 ? Math.round((tGI / tG) * 100) : 0;
        const totalCov = totalPupils > 0 ? Math.round((totalITN / totalPupils) * 100) : 0;
        
        setText('cov_boys', boysCov + '%');
        setText('cov_girls', girlsCov + '%');
        setText('cov_total', totalCov + '%');
        
        setVal('coverage_boys', boysCov);
        setVal('coverage_girls', girlsCov);
        setVal('coverage_total', totalCov);
        
        setText('tt_b', tB);
        setText('tt_bi', tBI);
        setText('tt_g', tG);
        setText('tt_gi', tGI);
        setText('tt_t', totalPupils);
        setText('tt_ti', totalITN);
        setText('tt_c', totalPupils > 0 ? Math.round((totalITN / totalPupils) * 100) + '%' : '0%');
        
        updateCharts();
        
    } catch (error) {
        console.error('Error in calculateAll:', error);
    }
}

// ============================================
// CHARTS
// ============================================
function updateCharts() {
    try {
        const tB = getNum('total_boys');
        const tG = getNum('total_girls');
        const bi = getNum('total_boys_itn');
        const gi = getNum('total_girls_itn');
        
        const c1 = document.getElementById('chartEnrollment');
        if (c1) { 
            if (state.charts.enrollment) state.charts.enrollment.destroy();
            state.charts.enrollment = new Chart(c1, { 
                type:'doughnut', 
                data:{ 
                    labels:['Boys','Girls'], 
                    datasets:[{ 
                        data:[tB,tG], 
                        backgroundColor:['#004080','#e91e8c'], 
                        borderWidth:2, 
                        borderColor:'#fff' 
                    }]
                }, 
                options:{ 
                    responsive:true, 
                    maintainAspectRatio:true, 
                    plugins:{ 
                        legend:{ position:'bottom' }
                    }
                }
            }); 
        }
        
        const c2 = document.getElementById('chartITN');
        if (c2) { 
            if (state.charts.itn) state.charts.itn.destroy();
            state.charts.itn = new Chart(c2, { 
                type:'doughnut', 
                data:{ 
                    labels:['Boys','Girls'], 
                    datasets:[{ 
                        data:[bi,gi], 
                        backgroundColor:['#004080','#e91e8c'], 
                        borderWidth:2, 
                        borderColor:'#fff' 
                    }]
                }, 
                options:{ 
                    responsive:true, 
                    maintainAspectRatio:true, 
                    plugins:{ 
                        legend:{ position:'bottom' }
                    }
                }
            }); 
        }
        
        const c3 = document.getElementById('chartCoverage');
        if (c3) {
            const covs = [];
            for (let c = 1; c <= 5; c++) { 
                const t = getNum('c'+c+'_boys') + getNum('c'+c+'_girls'); 
                const i = getNum('c'+c+'_boys_itn') + getNum('c'+c+'_girls_itn'); 
                covs.push(t > 0 ? Math.round((i/t)*100) : 0); 
            }
            
            if (state.charts.coverage) state.charts.coverage.destroy();
            state.charts.coverage = new Chart(c3, { 
                type:'bar', 
                data:{ 
                    labels:['Class 1','Class 2','Class 3','Class 4','Class 5'], 
                    datasets:[{ 
                        label:'Coverage %', 
                        data:covs, 
                        backgroundColor:'#28a745', 
                        borderWidth:0 
                    }]
                }, 
                options:{ 
                    responsive:true, 
                    maintainAspectRatio:true, 
                    scales:{ 
                        y:{ 
                            beginAtZero:true, 
                            max:100 
                        }
                    }, 
                    plugins:{ 
                        legend:{ display:false } 
                    }
                }
            }); 
        }
    } catch (error) {
        console.error('Error in updateCharts:', error);
    }
}

// ============================================
// GPS
// ============================================
window.captureGPS = function() {
    const icon = document.getElementById('gps_icon');
    const status = document.getElementById('gps_status');
    const coords = document.getElementById('gps_coords');
    
    if (!navigator.geolocation) { 
        if (icon) icon.classList.add('error'); 
        if (status) status.textContent = 'GPS not supported'; 
        return; 
    }
    
    if (icon) icon.classList.add('loading');
    if (status) status.textContent = 'Capturing GPS...';
    
    navigator.geolocation.getCurrentPosition(
        pos => {
            const { latitude, longitude, accuracy } = pos.coords;
            setVal('gps_lat', latitude.toFixed(6)); 
            setVal('gps_lng', longitude.toFixed(6)); 
            setVal('gps_acc', Math.round(accuracy));
            
            if (icon) { 
                icon.classList.remove('loading'); 
                icon.classList.add('success'); 
            }
            if (status) status.textContent = 'GPS captured!';
            if (coords) coords.textContent = latitude.toFixed(5) + ', ' + longitude.toFixed(5) + ' (±' + Math.round(accuracy) + 'm)';
        },
        () => { 
            if (icon) { 
                icon.classList.remove('loading'); 
                icon.classList.add('error'); 
            } 
            if (status) status.textContent = 'GPS failed (optional)'; 
        },
        { enableHighAccuracy:true, timeout:30000, maximumAge:0 }
    );
};

// ============================================
// SIGNATURE PADS
// ============================================
function initAllSignaturePads() { 
    for (let i = 1; i <= 3; i++) initTeamSignaturePad(i); 
}

function initTeamSignaturePad(n) {
    const canvas = document.getElementById('sig' + n + 'Canvas');
    if (!canvas) return;
    
    canvas.width = canvas.parentElement.offsetWidth - 10;
    canvas.height = 100;
    
    state.signaturePads[n] = new SignaturePad(canvas, { backgroundColor:'#fff', penColor:'#000' });
    
    state.signaturePads[n].addEventListener('endStroke', () => {
        const h = document.getElementById('team' + n + '_signature');
        if (h) h.value = state.signaturePads[n].toDataURL();
    });
}

window.clearTeamSignature = function(n) {
    if (state.signaturePads[n]) { 
        state.signaturePads[n].clear(); 
        const h = document.getElementById('team' + n + '_signature'); 
        if (h) h.value = ''; 
    }
};

function clearSignature() { 
    for (let i = 1; i <= 3; i++) clearTeamSignature(i); 
}

// ============================================
// DRAFTS
// ============================================
window.showDraftNameModal = function() {
    const modal = document.getElementById('draftNameModal');
    const input = document.getElementById('draftNameInput');
    if (!modal || !input) return;
    
    input.value = generateDraftName();
    input.readOnly = true;
    modal.classList.add('show');
};

function generateDraftName() {
    const parts = [];
    ['district','chiefdom','section_loc','community','school_name'].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.value) parts.push(el.value.replace(' District','').trim());
    });
    const base = parts.length === 0 ? 'Draft - ' + new Date().toLocaleDateString() : parts.join('-');
    return state.currentUser ? state.currentUser + ' | ' + base : base;
}

window.cancelDraftName = function() { 
    const modal = document.getElementById('draftNameModal');
    if (modal) modal.classList.remove('show'); 
};

window.confirmSaveDraft = function() { 
    const input = document.getElementById('draftNameInput');
    const n = (input && input.value.trim()) || 'Unnamed Draft'; 
    cancelDraftName(); 
    saveDraft(n); 
};

function saveDraft(name) {
    const formData = new FormData(document.getElementById('dataForm'));
    const data = { 
        draftId: state.currentDraftId || 'draft_' + Date.now(), 
        draftName: name, 
        savedAt: new Date().toISOString(), 
        currentSection: state.currentSection, 
        saved_by: state.currentUser || '' 
    };
    
    for (const [k,v] of formData.entries()) data[k] = v;
    
    const pboCheck = document.getElementById('itn_type_pbo');
    const ig2Check = document.getElementById('itn_type_ig2');
    
    data.itn_type_pbo = pboCheck ? pboCheck.checked : false;
    data.itn_type_ig2 = ig2Check ? ig2Check.checked : false;
    
    const idx = state.drafts.findIndex(d => d.draftId === data.draftId);
    if (idx >= 0) state.drafts[idx] = data; 
    else state.drafts.push(data);
    
    state.currentDraftId = data.draftId;
    saveToStorage(); 
    updateCounts();
    showNotification('Draft "' + name + '" saved!', 'success');
}

window.openDraftsModal = function() {
    const modal = document.getElementById('draftsModal');
    const body = document.getElementById('draftsModalBody');
    if (!modal || !body) return;
    
    const visible = state.isAdmin ? state.drafts : state.drafts.filter(d => !d.saved_by || d.saved_by === state.currentUser);
    
    if (visible.length === 0) { 
        body.innerHTML = '<div class="no-drafts">No saved drafts</div>'; 
    } else { 
        body.innerHTML = visible.map(d =>
            '<div class="draft-item"><div class="draft-info"><div class="draft-name">' + d.draftName + '</div><div class="draft-date">' + formatDate(d.savedAt) + (d.saved_by ? ' &mdash; ' + d.saved_by : '') + '</div></div>' +
            '<div class="draft-actions"><button class="draft-btn load" onclick="loadDraft(\'' + d.draftId + '\')">Load</button>' +
            '<button class="draft-btn delete" onclick="deleteDraft(\'' + d.draftId + '\')">Delete</button></div></div>').join(''); 
    }
    
    modal.classList.add('show');
};

window.closeDraftsModal = function() { 
    const modal = document.getElementById('draftsModal');
    if (modal) modal.classList.remove('show'); 
};

window.loadDraft = function(id) {
    const draft = state.drafts.find(d => d.draftId === id);
    if (!draft) return;
    
    state.currentDraftId = id;
    
    if (draft.district) { 
        document.getElementById('district').value = draft.district; 
        document.getElementById('district').dispatchEvent(new Event('change')); 
    }
    
    setTimeout(() => {
        if (draft.chiefdom) { 
            document.getElementById('chiefdom').value = draft.chiefdom; 
            document.getElementById('chiefdom').dispatchEvent(new Event('change')); 
        }
        setTimeout(() => {
            if (draft.section_loc) { 
                document.getElementById('section_loc').value = draft.section_loc; 
                document.getElementById('section_loc').dispatchEvent(new Event('change')); 
            }
            setTimeout(() => {
                if (draft.facility) { 
                    document.getElementById('facility').value = draft.facility; 
                    document.getElementById('facility').dispatchEvent(new Event('change')); 
                }
                setTimeout(() => {
                    if (draft.community) { 
                        document.getElementById('community').value = draft.community; 
                        document.getElementById('community').dispatchEvent(new Event('change')); 
                    }
                    setTimeout(() => {
                        if (draft.school_name) {
                            const schoolEl = document.getElementById('school_name');
                            if (schoolEl) schoolEl.value = draft.school_name;
                        }
                        
                        Object.keys(draft).forEach(k => {
                            if (['draftId','draftName','savedAt','currentSection','saved_by','district','chiefdom','section_loc','facility','community','school_name','itn_type_pbo','itn_type_ig2'].includes(k)) return;
                            const el = document.getElementById(k); 
                            if (el) el.value = draft[k];
                        });
                        
                        const pboCheck = document.getElementById('itn_type_pbo');
                        const ig2Check = document.getElementById('itn_type_ig2');
                        
                        if (pboCheck && draft.itn_type_pbo !== undefined) pboCheck.checked = draft.itn_type_pbo;
                        if (ig2Check && draft.itn_type_ig2 !== undefined) ig2Check.checked = draft.itn_type_ig2;
                        
                        toggleITNTypeQuantity();
                        
                        if (draft.currentSection) {
                            document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
                            state.currentSection = draft.currentSection;
                            const sectionEl = document.querySelector('.form-section[data-section="' + draft.currentSection + '"]');
                            if (sectionEl) sectionEl.classList.add('active');
                        }
                        
                        updateProgress(); 
                        calculateAll();
                    }, 100);
                }, 100);
            }, 100);
        }, 100);
    }, 100);
    
    closeDraftsModal();
    showNotification('Draft "' + draft.draftName + '" loaded!', 'success');
};

window.deleteDraft = function(id) {
    if (!confirm('Delete this draft?')) return;
    state.drafts = state.drafts.filter(d => d.draftId !== id);
    saveToStorage(); 
    updateCounts(); 
    openDraftsModal();
};

// ============================================
// FINALIZE & SUBMIT
// ============================================
window.finalizeForm = function() {
    for (let s = 2; s <= state.totalSections; s++) {
        state.currentSection = s;
        if (!validateCurrentSection()) {
            document.querySelectorAll('.form-section').forEach(sec => sec.classList.remove('active'));
            const sectionEl = document.querySelector('.form-section[data-section="' + s + '"]');
            if (sectionEl) sectionEl.classList.add('active');
            updateProgress(); 
            return;
        }
    }
    
    const pbo = document.getElementById('itn_type_pbo')?.checked || false;
    const ig2 = document.getElementById('itn_type_ig2')?.checked || false;
    
    if (!pbo && !ig2) {
        showNotification('Please select at least one ITN type.', 'error');
        state.currentSection = 3;
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
        const section3 = document.querySelector('.form-section[data-section="3"]');
        if (section3) section3.classList.add('active');
        updateProgress(); 
        return;
    }
    
    if (!validateITNQuantities()) {
        showNotification('ITN type quantities must equal total ITNs received.', 'error');
        state.currentSection = 3;
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
        const section3 = document.querySelector('.form-section[data-section="3"]');
        if (section3) section3.classList.add('active');
        updateProgress(); 
        return;
    }
    
    const team1Sig = document.getElementById('team1_signature');
    if (!team1Sig || !team1Sig.value) { 
        showNotification('Please provide Team Member 1 signature.', 'error'); 
        return; 
    }
    
    state.formStatus = 'finalized';
    const formStatus = document.getElementById('form_status');
    if (formStatus) formStatus.value = 'finalized';
    
    const submittedBy = document.getElementById('submitted_by');
    if (submittedBy) submittedBy.value = state.currentUser || '';
    
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = false;
    
    const finalizeBtn = document.getElementById('finalizeBtn');
    if (finalizeBtn) finalizeBtn.disabled = true;
    
    showNotification('Form finalized! You can now submit.', 'success');
};

async function handleSubmit(e) {
    e.preventDefault();
    
    if (state.formStatus !== 'finalized') { 
        showNotification('Please finalize the form first.', 'error'); 
        return; 
    }

    const formData = new FormData(e.target);
    const data = { 
        timestamp: new Date().toISOString(), 
        submitted_by: state.currentUser || '' 
    };
    
    for (const [k,v] of formData.entries()) data[k] = v;
    
    const pboCheck = document.getElementById('itn_type_pbo');
    const ig2Check = document.getElementById('itn_type_ig2');
    
    data.itn_type_pbo = pboCheck && pboCheck.checked ? 'Yes' : 'No';
    data.itn_type_ig2 = ig2Check && ig2Check.checked ? 'Yes' : 'No';

    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<svg class="nav-icon spinning" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12a9 9 0 11-6.219-8.56"/></svg> SUBMITTING...';
    }

    if (state.isOnline) {
        try {
            await fetch(CONFIG.SCRIPT_URL, { 
                method:'POST', 
                mode:'no-cors', 
                headers:{ 'Content-Type':'application/json' }, 
                body: JSON.stringify(data) 
            });
            markSchoolSubmitted(data);
            if (state.currentDraftId) { 
                state.drafts = state.drafts.filter(d => d.draftId !== state.currentDraftId); 
            }
            saveToStorage(); 
            updateCounts(); 
            updateSummaryBadge();
            showNotification('Submitted successfully!', 'success');
            resetForm();
        } catch (err) { 
            saveOffline(data); 
        }
    } else { 
        saveOffline(data); 
    }

    if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> SUBMIT';
    }
}

function markSchoolSubmitted(data) {
    const key = makeSchoolKey(
        data.district, 
        data.chiefdom, 
        data.section_loc,
        data.facility, 
        data.community, 
        data.school_name
    );
    
    if (!isSchoolSubmitted(key)) {
        state.submittedSchools.push({ 
            key, 
            district: data.district, 
            chiefdom: data.chiefdom,
            section: data.section_loc, 
            facility: data.facility, 
            community: data.community,
            school_name: data.school_name, 
            timestamp: data.timestamp, 
            data 
        });
    }
}

function saveOffline(data) {
    state.pendingSubmissions.push(data);
    markSchoolSubmitted(data);
    saveToStorage(); 
    updateCounts(); 
    updateSummaryBadge();
    showNotification('Saved offline. Will sync when online.', 'info');
    resetForm();
}

function resetForm() {
    document.getElementById('dataForm').reset();
    clearSignature();
    
    state.currentSection = 1; 
    state.currentDraftId = null; 
    state.formStatus = 'draft';
    
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    const section1 = document.querySelector('.form-section[data-section="1"]');
    if (section1) section1.classList.add('active');
    
    const submitBtn = document.getElementById('submitBtn');
    if (submitBtn) submitBtn.disabled = true;
    
    const finalizeBtn = document.getElementById('finalizeBtn');
    if (finalizeBtn) finalizeBtn.disabled = false;
    
    const sbField = document.getElementById('submitted_by'); 
    if (sbField) sbField.value = state.currentUser || '';
    
    const banner = document.getElementById('schoolSubmittedBanner'); 
    if (banner) banner.style.display = 'none';
    
    const nextBtn = document.querySelector('.form-section[data-section="2"] .btn-next');
    if (nextBtn) { 
        nextBtn.disabled = false; 
        nextBtn.title = ''; 
    }
    
    ['chiefdom','section_loc','facility','community','school_name'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { 
            el.innerHTML = '<option value="">Select...</option>'; 
            el.disabled = true; 
        }
    });
    
    ['chiefdom','section_loc','facility','community','school_name'].forEach(clearCount);
    
    updateProgress(); 
    setDefaultDate(); 
    captureGPS(); 
    calculateAll();
    
    setTimeout(() => initAllSignaturePads(), 100);
}

// ============================================
// DOWNLOAD DATA
// ============================================
function downloadData() {
    if (!checkAdmin()) return;
    
    const allData = [...state.pendingSubmissions, ...state.drafts];
    if (allData.length === 0) { 
        showNotification('No data to download.', 'info'); 
        return; 
    }
    
    const keys = new Set();
    allData.forEach(item => Object.keys(item).forEach(k => keys.add(k)));
    const headers = Array.from(keys);
    
    let csv = headers.join(',') + '\n';
    allData.forEach(item => {
        csv += headers.map(h => {
            let v = item[h] || '';
            if (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n')))
                v = '"' + v.replace(/"/g,'""') + '"';
            return v;
        }).join(',') + '\n';
    });
    
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type:'text/csv' }));
    a.download = 'itn_data_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click(); 
    URL.revokeObjectURL(a.href);
    showNotification('Data downloaded!', 'success');
}

// ============================================
// ANALYSIS
// ============================================
window.openAnalysisModal = function() {
    if (!checkAdmin()) return;
    
    const modal = document.getElementById('analysisModal');
    const body = document.getElementById('analysisBody');
    const allData = [...state.pendingSubmissions, ...state.drafts.filter(d => d.total_pupils)];
    
    if (allData.length === 0) { 
        if (body) body.innerHTML = '<div class="no-data">No data available for analysis.</div>'; 
        if (modal) modal.classList.add('show'); 
        return; 
    }
    
    let tB=0, tG=0, tBI=0, tGI=0; 
    const dd = {};
    
    allData.forEach(d => {
        tB  += parseInt(d.total_boys) || 0; 
        tG  += parseInt(d.total_girls) || 0;
        tBI += parseInt(d.total_boys_itn) || 0; 
        tGI += parseInt(d.total_girls_itn) || 0;
        
        const dist = d.district || 'Unknown';
        if (!dd[dist]) dd[dist] = { schools:0, pupils:0, itn:0 };
        dd[dist].schools++; 
        dd[dist].pupils += parseInt(d.total_pupils) || 0; 
        dd[dist].itn += parseInt(d.total_itn) || 0;
    });
    
    const tp = tB + tG, 
          ti = tBI + tGI, 
          cov = tp > 0 ? Math.round((ti / tp) * 100) : 0;
    
    let dr = '';
    Object.entries(dd).forEach(([d,v]) => { 
        dr += '<tr><td>' + d + '</td><td>' + v.schools + '</td><td>' + v.pupils.toLocaleString() + '</td><td>' + v.itn.toLocaleString() + '</td><td>' + (v.pupils>0?Math.round((v.itn/v.pupils)*100):0) + '%</td></tr>'; 
    });
    
    if (body) {
        body.innerHTML = '<div class="analysis-stats"><div class="stat-card"><div class="stat-value">' + allData.length + '</div><div class="stat-label">Schools Surveyed</div></div><div class="stat-card"><div class="stat-value">' + tp.toLocaleString() + '</div><div class="stat-label">Total Pupils</div></div><div class="stat-card"><div class="stat-value">' + ti.toLocaleString() + '</div><div class="stat-label">ITNs Distributed</div></div><div class="stat-card green"><div class="stat-value">' + cov + '%</div><div class="stat-label">Overall Coverage</div></div></div><div class="analysis-section"><h3>Gender Breakdown</h3><div class="analysis-grid"><div class="analysis-item"><span class="item-label">Total Boys:</span><span class="item-value">' + tB.toLocaleString() + '</span></div><div class="analysis-item"><span class="item-label">Total Girls:</span><span class="item-value">' + tG.toLocaleString() + '</span></div><div class="analysis-item"><span class="item-label">Boys ITN:</span><span class="item-value">' + tBI.toLocaleString() + '</span></div><div class="analysis-item"><span class="item-label">Girls ITN:</span><span class="item-value">' + tGI.toLocaleString() + '</span></div><div class="analysis-item"><span class="item-label">Boys Coverage:</span><span class="item-value">' + (tB>0?Math.round((tBI/tB)*100):0) + '%</span></div><div class="analysis-item"><span class="item-label">Girls Coverage:</span><span class="item-value">' + (tG>0?Math.round((tGI/tG)*100):0) + '%</span></div></div></div><div class="analysis-section"><h3>By District</h3><table class="analysis-table"><thead><tr><th>District</th><th>Schools</th><th>Pupils</th><th>ITNs</th><th>Coverage</th></tr></thead><tbody>' + dr + '</tbody></table></div>';
    }
    
    if (modal) modal.classList.add('show');
};

window.closeAnalysisModal = function() { 
    const modal = document.getElementById('analysisModal');
    if (modal) modal.classList.remove('show'); 
};

// ============================================
// UTILITIES
// ============================================
function checkAdmin() {
    if (state.isAdmin) return true;
    
    const user = prompt('Admin Username:');
    const pass = prompt('Admin Password:');
    
    if (user === CONFIG.ADMIN_USER && pass === CONFIG.ADMIN_PASS) return true;
    
    showNotification('Invalid admin credentials.', 'error'); 
    return false;
}

function updateOnlineStatus() {
    const ind = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    
    if (!ind || !text) return;
    
    ind.className = 'status-indicator ' + (state.isOnline ? 'online' : 'offline');
    text.textContent = state.isOnline ? 'ONLINE' : 'OFFLINE';
}

function updateCounts() {
    const dc = document.getElementById('draftCount');
    const pc = document.getElementById('pendingCount');
    
    if (dc) dc.textContent = state.drafts.length;
    if (pc) pc.textContent = state.pendingSubmissions.length;
}

function showNotification(msg, type) {
    const n = document.getElementById('notification');
    const t = document.getElementById('notificationText');
    
    if (!n || !t) return;
    
    n.className = 'notification ' + type + ' show';
    t.textContent = msg;
    
    setTimeout(() => n.classList.remove('show'), 4000);
}

function setupEventListeners() {
    const vd = document.getElementById('viewDataBtn');
    if (vd) vd.addEventListener('click',  () => { 
        if (checkAdmin()) window.open(CONFIG.SHEET_URL,'_blank'); 
    });
    
    const dd = document.getElementById('downloadDataBtn');
    if (dd) dd.addEventListener('click',  downloadData);
    
    const va = document.getElementById('viewAnalysisBtn');
    if (va) va.addEventListener('click',  openAnalysisModal);
    
    const vdr = document.getElementById('viewDraftsBtn');
    if (vdr) vdr.addEventListener('click', openDraftsModal);
    
    const vs = document.getElementById('viewSummaryBtn');
    if (vs) vs.addEventListener('click', openSummaryModal);
    
    const df = document.getElementById('dataForm');
    if (df) df.addEventListener('submit', handleSubmit);

    window.addEventListener('online',  () => { 
        state.isOnline = true;  
        updateOnlineStatus(); 
        syncPending(); 
    });
    
    window.addEventListener('offline', () => { 
        state.isOnline = false; 
        updateOnlineStatus(); 
    });

    document.querySelectorAll('.modal-overlay').forEach(m => {
        m.addEventListener('click', e => { 
            if (e.target === m) m.classList.remove('show'); 
        });
    });

    const dni = document.getElementById('draftNameInput');
    if (dni) dni.addEventListener('keypress', e => { 
        if (e.key === 'Enter') confirmSaveDraft(); 
    });
    
    // Re-attach navigation buttons
    document.querySelectorAll('.btn-next').forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            window.nextSection();
        };
    });
    
    document.querySelectorAll('.btn-back').forEach(btn => {
        btn.onclick = function(e) {
            e.preventDefault();
            window.previousSection();
        };
    });
    
    console.log('Event listeners setup complete');
}

async function syncPending() {
    if (state.pendingSubmissions.length === 0) return;
    
    showNotification('Syncing pending data...', 'info');
    const synced = [];
    
    for (let i = 0; i < state.pendingSubmissions.length; i++) {
        try { 
            await fetch(CONFIG.SCRIPT_URL, { 
                method:'POST', 
                mode:'no-cors', 
                body: JSON.stringify(state.pendingSubmissions[i]) 
            }); 
            synced.push(i); 
        } catch (e) {}
    }
    
    if (synced.length > 0) {
        state.pendingSubmissions = state.pendingSubmissions.filter((_,i) => !synced.includes(i));
        saveToStorage(); 
        updateCounts();
        showNotification('Synced ' + synced.length + ' submission(s)!', 'success');
    }
}

// ============================================
// KICK OFF
// ============================================
init();

// Make sure all functions are globally available
window.captureGPS = captureGPS;
window.clearTeamSignature = clearTeamSignature;
window.toggleITNTypeQuantity = toggleITNTypeQuantity;
window.updateApp = updateApp;
window.handleLogin = handleLogin;
window.handleLogout = handleLogout;
window.nextSection = nextSection;
window.previousSection = previousSection;
window.showDraftNameModal = showDraftNameModal;
window.finalizeForm = finalizeForm;
window.viewSummary = viewSummary;
window.openSchoolDetail = openSchoolDetail;
window.closeSchoolDetailModal = closeSchoolDetailModal;
window.loadSchoolIntoForm = loadSchoolIntoForm;
window.viewSubmittedSchoolFromBanner = viewSubmittedSchoolFromBanner;
window.openSummaryModal = openSummaryModal;
window.closeSummaryModal = closeSummaryModal;
window.openAnalysisModal = openAnalysisModal;
window.closeAnalysisModal = closeAnalysisModal;
window.openDraftsModal = openDraftsModal;
window.closeDraftsModal = closeDraftsModal;
window.cancelDraftName = cancelDraftName;
window.confirmSaveDraft = confirmSaveDraft;
window.loadDraft = loadDraft;
window.deleteDraft = deleteDraft;

console.log('Script loaded successfully');
