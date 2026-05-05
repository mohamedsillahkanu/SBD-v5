/**
 * ICF-SL Training & Module System
 * Each module has: VIDEO (YouTube), ASSESSMENT (10 questions), TOOL (HTML)
 * Training must be completed (100% on assessment) before tool access
 */

// ════════════════════════════════════════════════════
// MODULE & TRAINING CONFIG
// ════════════════════════════════════════════════════

const MODULE_CONFIG = {
    // Module ID: { label, toolFile, youtubeUrl, ... }
    monitoring: {
        label: 'Monitoring',
        toolFile: 'monitoring.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ', // Replace with actual URL
        color: '#af7aa1',
        darkColor: '#9a6291'
    },
    reconciliation: {
        label: 'ITN Reconciliation',
        toolFile: 'itn_reconciliation.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#9c755f',
        darkColor: '#7e5d4b'
    },
    schoolqr: {
        label: 'School QR Generator',
        toolFile: 'school_qr_generator.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#59a14f',
        darkColor: '#3d7a35'
    },
    idcards: {
        label: 'ID Cards',
        toolFile: 'id_cards.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#4e79a7',
        darkColor: '#3a5f8a'
    },
    devicetag: {
        label: 'Device Tag',
        toolFile: 'device_tag.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#76b7b2',
        darkColor: '#5a9a95'
    },
    device: {
        label: 'Device Tracking',
        toolFile: 'device_tracking.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#d4ae30',
        darkColor: '#b89520'
    },
    movement: {
        label: 'ITN Movement',
        toolFile: 'itn_movement.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#ff9da7',
        darkColor: '#e8818c'
    },
    itnreceived: {
        label: 'ITN Received',
        toolFile: 'itn_received.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#2196F3',
        darkColor: '#1565C0'
    },
    attendance: {
        label: 'Attendance & Payment',
        toolFile: 'attendance_payment.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#c8991a',
        darkColor: '#a07a10'
    },
    report: {
        label: 'Distribution Report',
        toolFile: 'distribution_report.html',
        youtubeUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
        color: '#17becf',
        darkColor: '#109aaa'
    }
};

const TRAINING_CONFIG = {
    passScore: 100,
    maxAttempts: 3,
    questionsPerQuiz: 10
};

// ════════════════════════════════════════════════════
// TRAINING STATE MANAGER
// ════════════════════════════════════════════════════

class TrainingStateManager {
    constructor() {
        this.loadState();
    }

    loadState() {
        try {
            const saved = localStorage.getItem('icf_training_state');
            if (saved) {
                const state = JSON.parse(saved);
                this.completed = new Set(state.completed || []);
                this.certificates = new Map(state.certificates || []);
                this.attempts = new Map(state.attempts || []);
            } else {
                this.completed = new Set();
                this.certificates = new Map();
                this.attempts = new Map();
            }
        } catch (e) {
            console.warn('Training state load failed:', e);
            this.completed = new Set();
            this.certificates = new Map();
            this.attempts = new Map();
        }
    }

    saveState() {
        try {
            localStorage.setItem('icf_training_state', JSON.stringify({
                completed: [...this.completed],
                certificates: [...this.certificates.entries()],
                attempts: [...this.attempts.entries()]
            }));
        } catch (e) {
            console.warn('Training state save failed:', e);
        }
    }

    isCompleted(moduleId) {
        return this.completed.has(moduleId);
    }

    markCompleted(moduleId, userName) {
        this.completed.add(moduleId);
        this.certificates.set(moduleId, {
            userName,
            timestamp: new Date().toISOString(),
            score: 100
        });
        this.saveState();
    }

    getAttempts(moduleId) {
        return this.attempts.get(moduleId) || 0;
    }

    getRemainingAttempts(moduleId) {
        const used = this.getAttempts(moduleId);
        return Math.max(0, TRAINING_CONFIG.maxAttempts - used);
    }

    recordAttempt(moduleId) {
        const current = this.getAttempts(moduleId);
        this.attempts.set(moduleId, current + 1);
        this.saveState();
    }

    getCertificate(moduleId) {
        return this.certificates.get(moduleId);
    }
}

const trainingState = new TrainingStateManager();

// ════════════════════════════════════════════════════
// QUESTION BANKS — 10+ questions per module
// ════════════════════════════════════════════════════

const QUESTION_BANKS = {
    monitoring: [
        { id: 1, question: 'What is the primary function of the Monitoring module?', options: ['Track ITN distribution progress and data quality', 'Manage school enrollment', 'Pay staff salaries', 'Track teacher attendance'], correct: 0 },
        { id: 2, question: 'Who uses the Monitoring module?', options: ['Only distributors', 'National monitors and supervisors', 'Only teachers', 'Community leaders'], correct: 1 },
        { id: 3, question: 'What data quality checks are important?', options: ['Only enrollment numbers', 'Data coherency, outlier detection, facility reporting rates', 'Only ITN quantities', 'Teacher names'], correct: 1 },
        { id: 4, question: 'How frequently should monitoring visits occur?', options: ['Once at end of campaign', 'Weekly or as needed based on risk indicators', 'Once per month fixed', 'Never'], correct: 1 },
        { id: 5, question: 'What is a key indicator of poor data quality?', options: ['High enrollment', 'Schools with zero ITN when target is high', 'Many teachers', 'Good weather'], correct: 1 },
        { id: 6, question: 'What action if school has missing data?', options: ['Ignore it', 'Follow up to complete submission', 'Delete the record', 'Report partial data'], correct: 1 },
        { id: 7, question: 'How are monitoring findings documented?', options: ['Verbally only', 'Monitoring report with observations and actions', 'Not documented', 'Phone calls only'], correct: 1 },
        { id: 8, question: 'What role does GPS location play?', options: ['No role', 'Verifies school location and helps targeting', 'Only for routing', 'For billing'], correct: 1 },
        { id: 9, question: 'How to handle discrepancies between expected and reported ITN?', options: ['Ignore', 'Investigate and request clarification', 'Delete data', 'Report without investigating'], correct: 1 },
        { id: 10, question: 'What is the goal of monitoring?', options: ['Punish underperformance', 'Ensure data accuracy and support improvement', 'Close schools', 'Reduce staff'], correct: 1 }
    ],

    movement: [
        { id: 1, question: 'What does ITN Movement module track?', options: ['Teacher movements', 'Physical movement of ITNs from dispatch to schools', 'Student attendance', 'Vehicle fuel'], correct: 1 },
        { id: 2, question: 'Who records ITN movement?', options: ['Only head teachers', 'Conveyors/logistics staff dispatching ITNs', 'Monitors only', 'Health workers'], correct: 1 },
        { id: 3, question: 'What key information is captured?', options: ['Only quantities', 'Dispatch date, quantity, destination, receiver, confirmation', 'Only school names', 'Only driver names'], correct: 1 },
        { id: 4, question: 'How does QR code help ITN movement?', options: ['Does not help', 'Enables quick scan-to-record dispatch and delivery', 'For teacher ID', 'For printing'], correct: 1 },
        { id: 5, question: 'If ITNs lost during movement?', options: ['No record needed', 'Report as undelivered and investigate', 'Assume arrived', 'Ignore'], correct: 1 },
        { id: 6, question: 'How many delivery attempts allowed?', options: ['1 only', 'Unlimited', 'Up to 3 before escalating', 'Per school'], correct: 2 },
        { id: 7, question: 'What triggers ITN movement record?', options: ['Teacher requests', 'Formal dispatch authorization', 'Random', 'Student votes'], correct: 1 },
        { id: 8, question: 'How is convoy accountability ensured?', options: ['Verbal promises', 'Digital signatures and GPS tracking', 'Paper forms', 'Not ensured'], correct: 1 },
        { id: 9, question: 'If school reports ITNs not received?', options: ['Assume lying', 'Cross-check movement records and investigate', 'Send replacement without verification', 'Close case'], correct: 1 },
        { id: 10, question: 'Benefit of real-time tracking?', options: ['No benefit', 'Visibility of stock, accountability, timely issue resolution', 'Slows operations', 'Increases cost'], correct: 1 }
    ],

    itnreceived: [
        { id: 1, question: 'Purpose of ITN Received module?', options: ['Track teacher payments', 'Record ITN receipt and confirm quantities', 'Count enrollment', 'Track attendance'], correct: 1 },
        { id: 2, question: 'Primary user of ITN Received?', options: ['Distributors', 'PHU staff receiving ITNs', 'Monitors', 'Teachers'], correct: 1 },
        { id: 3, question: 'What info recorded when receiving ITNs?', options: ['Only quantity', 'Quantity, date, receiver, voucher, condition check', 'Only school name', 'Teacher phone'], correct: 1 },
        { id: 4, question: 'If received quantity ≠ dispatch note?', options: ['Ignore', 'Note discrepancy, contact dispatcher, document', 'Assume dispatcher wrong', 'Accept without verification'], correct: 1 },
        { id: 5, question: 'How to assess ITN condition?', options: ['No assessment', 'Visual inspection for damage before acceptance', 'Only count', 'Trust sender'], correct: 1 },
        { id: 6, question: 'Role of digital signature in receipt?', options: ['No role', 'Confirms receiver identity and accountability', 'Only paperwork', 'Decoration'], correct: 1 },
        { id: 7, question: 'Handle excess/damaged ITNs?', options: ['Use anyway', 'Return with incident report', 'Dispose without record', 'Distribute randomly'], correct: 1 },
        { id: 8, question: 'What triggers ITN receipt record completion?', options: ['Teacher approval', 'PHU staff complete inspection and sign', 'Random timing', 'Optional'], correct: 1 },
        { id: 9, question: 'Minimize dispatch-receipt discrepancies?', options: ['Ignore differences', 'QR codes, real-time tracking, reconciliation', 'Manual counting', 'Accept without verification'], correct: 1 },
        { id: 10, question: 'Importance of timestamped receipt?', options: ['No importance', 'Establishes timeline and enables stock tracking', 'Decoration', 'For penalties'], correct: 1 }
    ],

    attendance: [
        { id: 1, question: 'What does Attendance & Payment track?', options: ['School fees', 'Field staff attendance, hours, payment', 'Student attendance', 'Teacher ratings'], correct: 1 },
        { id: 2, question: 'Who records daily attendance?', options: ['Supervisors', 'Field staff or team leaders daily', 'Monitors', 'Teachers'], correct: 1 },
        { id: 3, question: 'Key components of attendance records?', options: ['Name only', 'Name, date, time in/out, hours, location, confirmation', 'Only hours', 'Phone number'], correct: 1 },
        { id: 4, question: 'How is payment calculated?', options: ['Flat rate', 'Daily rate × verified hours - deductions', 'Random', 'Not calculated'], correct: 1 },
        { id: 5, question: 'If staff misses a day?', options: ['No action', 'Record absence with reason and adjust pay', 'Pay full', 'Terminate'], correct: 1 },
        { id: 6, question: 'Resolve hours disputes?', options: ['Staff wins', 'Supervisor review, discussion, photo evidence', 'Supervisor alone', 'Pay disputed'], correct: 1 },
        { id: 7, question: 'GPS location role in attendance?', options: ['No role', 'Confirms staff presence at work locations', 'Mapping only', 'Vehicle tracking'], correct: 1 },
        { id: 8, question: 'Payment reconciliation across staff?', options: ['None', 'Weekly/monthly summary of all hours, rates, net pay', 'Spot checks', 'Random'], correct: 1 },
        { id: 9, question: 'Before final payment?', options: ['Nothing', 'Verify, reconcile, authorize, process', 'Pay half', 'No verification'], correct: 1 },
        { id: 10, question: 'Benefits of digital attendance?', options: ['No benefits', 'Reduces fraud, ensures accuracy, real-time reporting, fair pay', 'Increases cost', 'Slows operations'], correct: 1 }
    ],

    reconciliation: [
        { id: 1, question: 'Purpose of ITN Reconciliation?', options: ['Resolve staff disagreements', 'Match dispatch, movement, receipt to ensure stock integrity', 'Assign blame', 'Reduce quantities'], correct: 1 },
        { id: 2, question: 'When reconcile?', options: ['Never', 'Weekly, milestones, campaign end', 'Yearly', 'If complaints'], correct: 1 },
        { id: 3, question: 'What records reconciled?', options: ['Names only', 'Stock, dispatch, movement, receipt, distribution', 'Quantities only', 'Teachers'], correct: 1 },
        { id: 4, question: 'Identify discrepancies?', options: ['Guessing', 'System compares Expected vs Actual at each checkpoint', 'Manual inspection', 'Not identified'], correct: 1 },
        { id: 5, question: 'Find discrepancy?', options: ['Ignore', 'Investigate, document, implement corrective action', 'Blame person', 'Resolve itself'], correct: 1 },
        { id: 6, question: 'Common discrepancy causes?', options: ['Only theft', 'Data entry errors, missing receipts, damaged nets, unofficial distributions', 'Weather', 'Schools lying'], correct: 1 },
        { id: 7, question: 'Report reconciliation?', options: ['Verbally', 'Formal report with findings, variance, action plan', 'Only matches', 'Not reported'], correct: 1 },
        { id: 8, question: 'Role of digital data?', options: ['No role', 'Automated checks, audit trails, rapid identification', 'Complicates', 'Backup only'], correct: 1 },
        { id: 9, question: 'Physical stock counts frequency?', options: ['Never', 'Start, milestones, end', 'Daily', 'Suspected theft'], correct: 1 },
        { id: 10, question: 'After reconciliation?', options: ['Nothing', 'Share with stakeholders, feedback for improvement', 'Hidden', 'Supervisors only'], correct: 1 }
    ],

    schoolqr: [
        { id: 1, question: 'Purpose of School QR Generator?', options: ['Print random codes', 'Generate unique QR codes for school identification', 'Track students', 'Manage fees'], correct: 1 },
        { id: 2, question: 'What info encoded in school QR?', options: ['Teacher names', 'School name, district, chiefdom, PHU, community', 'Student IDs', 'Fees only'], correct: 1 },
        { id: 3, question: 'How QR helps data entry?', options: ['No help', 'Scan instantly fills all school location fields', 'Manual entry faster', 'Not needed'], correct: 1 },
        { id: 4, question: 'QR code format?', options: ['Barcode', 'JSON data encoded as QR', 'Text only', 'Random'], correct: 1 },
        { id: 5, question: 'Generate QR for new schools?', options: ['Cannot', 'Yes, manually add to system', 'Automatically', 'Not possible'], correct: 1 },
        { id: 6, question: 'Prevent QR duplication?', options: ['Not needed', 'System checks uniqueness before generation', 'Manual review', 'Allow duplicates'], correct: 1 },
        { id: 7, question: 'Print QR codes?', options: ['Not supported', 'Yes, bulk print for all schools', 'Individual printing', 'Digital only'], correct: 1 },
        { id: 8, question: 'QR code lifespan?', options: ['1 day', 'Permanent, campaign across', '1 week', 'Reusable yearly'], correct: 1 },
        { id: 9, question: 'Damaged QR code?', options: ['Regenerate required', 'Scan alternative code from backup', 'Use manually', 'Discard'], correct: 1 },
        { id: 10, question: 'QR benefit to data quality?', options: ['No benefit', 'Reduces entry errors, ensures correct school ID', 'Slows entry', 'Complicates'], correct: 1 }
    ],

    idcards: [
        { id: 1, question: 'Purpose of ID Cards module?', options: ['Decoration', 'Generate identification cards for field staff', 'Track students', 'Print posters'], correct: 1 },
        { id: 2, question: 'What info on ID card?', options: ['Name only', 'Name, photo, role, module access, valid dates', 'School only', 'Random'], correct: 1 },
        { id: 3, question: 'Who gets ID cards?', options: ['All staff', 'Field staff, monitors, supervisors authorized for programme', 'Teachers', 'Students'], correct: 1 },
        { id: 4, question: 'ID card validity?', options: ['Permanent', 'Campaign duration, can be renewed', '1 week', 'No expiry'], correct: 1 },
        { id: 5, question: 'Lost ID card?', options: ['Use without', 'Request replacement from coordinator', 'Create new', 'No replacement'], correct: 1 },
        { id: 6, question: 'Print bulk IDs?', options: ['Manual one-by-one', 'Yes, batch print from spreadsheet', 'Individual only', 'Not supported'], correct: 1 },
        { id: 7, question: 'ID photo requirement?', options: ['Not needed', 'Recent passport/ID photo for identification', 'Any image', 'Optional'], correct: 1 },
        { id: 8, question: 'Module access tied to ID?', options: ['No', 'Yes, ID determines which modules staff can access', 'Manual', 'No control'], correct: 1 },
        { id: 9, question: 'Unauthorized use?', options: ['Allowed', 'Report to coordinator, deactivate card', 'Ignore', 'No control'], correct: 1 },
        { id: 10, question: 'Update staff role?', options: ['Not possible', 'Update in system, reissue ID card', 'Manual change', 'Create new'], correct: 1 }
    ],

    devicetag: [
        { id: 1, question: 'Purpose of Device Tag module?', options: ['Organize files', 'Tag tablets/devices with staff and module assignments', 'Track students', 'Manage passwords'], correct: 1 },
        { id: 2, question: 'What info on device tag?', options: ['Serial number', 'Device ID, assigned staff name, role, modules allowed', 'Owner only', 'Random'], correct: 1 },
        { id: 3, question: 'Assign device to staff?', options: ['Manual setup', 'Scan device QR, select staff, set permissions', 'Central IT', 'Not possible'], correct: 1 },
        { id: 4, question: 'Device access control?', options: ['No control', 'App checks device tag, allows only assigned modules', 'Manual check', 'Unrestricted'], correct: 1 },
        { id: 5, question: 'Transfer device?', options: ['Direct reassign', 'Deactivate old, create new tag with new staff', 'Keep same', 'Not allowed'], correct: 1 },
        { id: 6, question: 'Device offline tagging?', options: ['Not supported', 'Yes, tag stored locally, syncs when online', 'Manual only', 'Cloud required'], correct: 1 },
        { id: 7, question: 'Track device location?', options: ['No', 'Device tag can log GPS when active', 'Manual tracking', 'Not available'], correct: 1 },
        { id: 8, question: 'Lost device?', options: ['Create new account', 'Deactivate tag remotely, prevent data access', 'Ignore', 'No action'], correct: 1 },
        { id: 9, question: 'Device security?', options: ['Not important', 'Tag requires PIN or biometric to prevent sharing', 'Optional', 'Passwords only'], correct: 1 },
        { id: 10, question: 'Multiple modules same device?', options: ['Not possible', 'Yes, tag can allow multiple module access for one staff', 'One module', 'Restricted'], correct: 1 }
    ],

    report: [
        { id: 1, question: 'Purpose of Distribution Report?', options: ['Print documents', 'Generate comprehensive ITN distribution campaign reports', 'Manage files', 'Track budget'], correct: 1 },
        { id: 2, question: 'What metrics in report?', options: ['School names', 'Coverage %, distributions, enrollment, progress vs targets', 'Only quantities', 'Random'], correct: 1 },
        { id: 3, question: 'Report aggregation levels?', options: ['All at once', 'School, PHU, Chiefdom, District, National', 'District only', 'No aggregation'], correct: 1 },
        { id: 4, question: 'Real-time report?', options: ['Not possible', 'Yes, auto-updates from latest submissions', 'Manual refresh', 'Delayed'], correct: 1 },
        { id: 5, question: 'Export report format?', options: ['Excel only', 'Excel, PDF, print, email options', 'PDF only', 'No export'], correct: 1 },
        { id: 6, question: 'Report visualization?', options: ['Tables only', 'Charts, maps, graphs, tables, dashboards', 'No visuals', 'Static'], correct: 1 },
        { id: 7, question: 'Variance analysis?', options: ['No', 'Compares actual vs target, flags high variance', 'Manual', 'Not available'], correct: 1 },
        { id: 8, question: 'Historical reports?', options: ['Not saved', 'Archive reports daily, compare trends', 'One version', 'No history'], correct: 1 },
        { id: 9, question: 'Report scheduling?', options: ['Not available', 'Auto-generate daily/weekly/monthly email reports', 'Manual request', 'One-time'], correct: 1 },
        { id: 10, question: 'Data filtering in report?', options: ['No options', 'Filter by district, chiefdom, date, status, coverage', 'Limited', 'No filter'], correct: 1 }
    ]
};

// ════════════════════════════════════════════════════
// CERTIFICATE GENERATOR
// ════════════════════════════════════════════════════

function generateCertificateSVG(userName, moduleLabel) {
    const dateStr = new Date().toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });

    return `
    <svg viewBox="0 0 1000 700" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <linearGradient id="certBg" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" style="stop-color:#002d5a;stop-opacity:1" />
                <stop offset="100%" style="stop-color:#004080;stop-opacity:1" />
            </linearGradient>
        </defs>

        <rect x="40" y="40" width="920" height="620" fill="none" stroke="#ffc107" stroke-width="8" rx="10"/>
        <rect x="50" y="50" width="900" height="600" fill="url(#certBg)" rx="8"/>
        <rect x="70" y="70" width="860" height="560" fill="none" stroke="#ffc107" stroke-width="3" opacity="0.6" rx="6"/>

        <circle cx="500" cy="120" r="50" fill="#ffc107" opacity="0.15"/>
        <text x="500" y="130" font-family="Oswald, sans-serif" font-size="32" font-weight="700" fill="#ffc107" text-anchor="middle" letter-spacing="2">ICF-SL</text>

        <text x="500" y="200" font-family="Oswald, sans-serif" font-size="48" font-weight="700" fill="#fff" text-anchor="middle" letter-spacing="3">CERTIFICATE OF</text>
        <text x="500" y="250" font-family="Oswald, sans-serif" font-size="48" font-weight="700" fill="#ffc107" text-anchor="middle" letter-spacing="3">COMPLETION</text>

        <line x1="150" y1="280" x2="850" y2="280" stroke="#ffc107" stroke-width="2"/>

        <text x="500" y="330" font-family="Oswald, sans-serif" font-size="14" fill="#e0e0e0" text-anchor="middle" letter-spacing="1" text-transform="uppercase">THIS CERTIFIES THAT</text>

        <text x="500" y="390" font-family="Oswald, sans-serif" font-size="42" font-weight="700" fill="#ffc107" text-anchor="middle" letter-spacing="2">${userName.toUpperCase()}</text>

        <text x="500" y="440" font-family="Oswald, sans-serif" font-size="16" fill="#e0e0e0" text-anchor="middle" letter-spacing="1">HAS SUCCESSFULLY COMPLETED THE COMPETENCY ASSESSMENT FOR</text>
        <text x="500" y="465" font-family="Oswald, sans-serif" font-size="24" font-weight="700" fill="#ffc107" text-anchor="middle">${moduleLabel.toUpperCase()}</text>

        <text x="500" y="510" font-family="Oswald, sans-serif" font-size="14" fill="#e0e0e0" text-anchor="middle" letter-spacing="1">WITH A PERFECT SCORE OF 100%</text>

        <text x="500" y="560" font-family="Oswald, sans-serif" font-size="14" fill="#b0b0b0" text-anchor="middle">Date: ${dateStr}</text>

        <circle cx="500" cy="620" r="25" fill="none" stroke="#ffc107" stroke-width="2"/>
        <text x="500" y="625" font-family="Oswald, sans-serif" font-size="20" font-weight="700" fill="#ffc107" text-anchor="middle">✓</text>
    </svg>
    `;
}

function downloadCertificate(userName, moduleLabel, moduleId) {
    const svg = generateCertificateSVG(userName, moduleLabel);
    const svgData = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
    const link = document.createElement('a');
    link.href = svgData;
    link.download = `Certificate_${moduleId}_${userName.replace(/\s+/g, '_')}.svg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// ════════════════════════════════════════════════════
// MODULE OVERLAY WITH 3 SUB-TABS (VIDEO | ASSESSMENT | TOOL)
// ════════════════════════════════════════════════════

function buildModuleOverlay(moduleId) {
    const config = MODULE_CONFIG[moduleId];
    if (!config) return null;

    const isCompleted = trainingState.isCompleted(moduleId);
    const remaining = trainingState.getRemainingAttempts(moduleId);

    const overlay = document.createElement('div');
    overlay.id = `mod-overlay-${moduleId}`;
    overlay.style.cssText = `
        position: fixed;
        inset: 0;
        background: #fff;
        z-index: 8000;
        display: flex;
        flex-direction: column;
        overflow: hidden;
        font-family: Oswald, sans-serif;
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
        background: linear-gradient(135deg,${config.darkColor},${config.color});
        color: #fff;
        padding: 14px 18px;
        display: flex;
        align-items: center;
        gap: 12px;
        flex-shrink: 0;
        box-shadow: 0 2px 10px rgba(0,0,0,.2);
    `;
    header.innerHTML = `
        <svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" width="22" height="22">
            <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>
            <polyline points="9 22 9 12 15 12 15 22"/>
        </svg>
        <div style="flex: 1;">
            <div style="font-size: 14px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase;">${config.label}</div>
            <div style="font-size: 10px; opacity: .8; margin-top: 2px;">${isCompleted ? '✓ COMPLETED' : 'Training Required'}</div>
        </div>
        <button onclick="document.getElementById('mod-overlay-${moduleId}').remove()" style="background: rgba(255,255,255,.2); border: none; color: #fff; width: 32px; height: 32px; border-radius: 50%; font-size: 16px; cursor: pointer;">✕</button>
    `;
    overlay.appendChild(header);

    // Sub-tabs navigation
    const tabBar = document.createElement('div');
    tabBar.style.cssText = `
        background: #f4f7fa;
        border-bottom: 2px solid #dde3ee;
        display: flex;
        gap: 0;
        flex-shrink: 0;
        overflow-x: auto;
    `;

    const tabs = [
        { id: 'video', label: '🎬 VIDEO', icon: 'M23 7l-7 5 7 5V7z' },
        { id: 'assessment', label: '📝 ASSESSMENT', icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z' },
        { id: 'tool', label: '🔧 TOOL', icon: 'M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4' }
    ];

    tabs.forEach(tab => {
        const btn = document.createElement('button');
        btn.id = `tab-btn-${moduleId}-${tab.id}`;
        btn.style.cssText = `
            flex: 1;
            min-width: 110px;
            padding: 12px 16px;
            border: none;
            background: none;
            font-family: Oswald;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: .5px;
            text-transform: uppercase;
            color: #607080;
            cursor: pointer;
            border-bottom: 3px solid transparent;
            transition: all .2s;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
        `;
        btn.textContent = tab.label;
        btn.onclick = () => switchModuleTab(moduleId, tab.id, isCompleted);
        tabBar.appendChild(btn);
    });

    overlay.appendChild(tabBar);

    // Content area
    const content = document.createElement('div');
    content.id = `mod-content-${moduleId}`;
    content.style.cssText = `
        flex: 1;
        overflow-y: auto;
        background: #f0f4f8;
        display: flex;
        flex-direction: column;
    `;

    // Video panel
    const videoPanel = document.createElement('div');
    videoPanel.id = `panel-${moduleId}-video`;
    videoPanel.style.cssText = `
        display: none;
        flex: 1;
        padding: 20px;
        overflow-y: auto;
    `;
    videoPanel.innerHTML = `
        <div style="max-width: 900px; margin: 0 auto;">
            <div style="background: #fff; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,.08);">
                <div style="aspect-ratio: 16 / 9; background: #000;">
                    <iframe width="100%" height="100%" src="${config.youtubeUrl}" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen style="border: none;"></iframe>
                </div>
                <div style="padding: 20px;">
                    <div style="font-size: 14px; font-weight: 700; color: #004080; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .5px;">Training Video</div>
                    <div style="font-size: 12px; color: #607080; line-height: 1.6;">
                        Watch this training video to understand the key features and best practices for the ${config.label} module. After completing the video, proceed to the assessment to test your knowledge.
                    </div>
                </div>
            </div>
        </div>
    `;
    content.appendChild(videoPanel);

    // Assessment panel
    const assessmentPanel = document.createElement('div');
    assessmentPanel.id = `panel-${moduleId}-assessment`;
    assessmentPanel.style.cssText = `
        display: none;
        flex: 1;
        padding: 20px;
        overflow-y: auto;
    `;
    
    if (isCompleted) {
        const cert = trainingState.getCertificate(moduleId);
        assessmentPanel.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: #e8f5ee; border: 2px solid #28a745; border-radius: 12px; padding: 30px; text-align: center;">
                    <div style="font-size: 60px; margin-bottom: 16px;">✓</div>
                    <div style="font-size: 18px; font-weight: 700; color: #1a7a3c; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Module Completed</div>
                    <div style="font-size: 12px; color: #607080; margin-bottom: 24px; line-height: 1.6;">
                        You have successfully completed the competency assessment with a perfect score of 100%.
                    </div>
                    <button onclick="window.downloadCertificate('${cert.userName}', '${config.label}', '${moduleId}')" style="
                        background: #28a745;
                        color: #fff;
                        border: none;
                        padding: 12px 24px;
                        border-radius: 8px;
                        font-family: Oswald;
                        font-size: 12px;
                        font-weight: 700;
                        cursor: pointer;
                        letter-spacing: .5px;
                        width: 100%;
                        text-transform: uppercase;
                    ">📥 Download Certificate</button>
                </div>
            </div>
        `;
    } else {
        assessmentPanel.innerHTML = `
            <div style="max-width: 600px; margin: 0 auto;">
                <div style="background: #fff; border-radius: 12px; padding: 24px; box-shadow: 0 2px 8px rgba(0,0,0,.08); margin-bottom: 20px;">
                    <div style="font-size: 14px; font-weight: 700; color: #004080; margin-bottom: 12px; text-transform: uppercase; letter-spacing: .5px;">Competency Assessment</div>
                    <div style="font-size: 12px; color: #607080; line-height: 1.6; margin-bottom: 20px;">
                        Answer 10 random questions correctly to pass. <strong>You must score 100%</strong> to unlock this module and receive your certificate. You have <strong>${remaining}</strong> attempt${remaining === 1 ? '' : 's'} remaining.
                    </div>
                    ${remaining > 0 ? `
                        <button onclick="startAssessment('${moduleId}', '${config.label}')" style="
                            background: #004080;
                            color: #fff;
                            border: none;
                            padding: 12px;
                            border-radius: 8px;
                            font-family: Oswald;
                            font-size: 12px;
                            font-weight: 700;
                            cursor: pointer;
                            width: 100%;
                            text-transform: uppercase;
                            letter-spacing: .5px;
                        ">📝 Start Assessment</button>
                    ` : `
                        <div style="background: #fff0f0; border: 1px solid #ffb3b3; border-radius: 8px; padding: 12px; color: #c0392b; font-size: 12px;">
                            ⛔ Maximum attempts reached. Contact supervisor.
                        </div>
                    `}
                </div>
            </div>
        `;
    }
    content.appendChild(assessmentPanel);

    // Tool panel
    const toolPanel = document.createElement('div');
    toolPanel.id = `panel-${moduleId}-tool`;
    toolPanel.style.cssText = `
        display: none;
        flex: 1;
        overflow: hidden;
    `;
    
    if (isCompleted) {
        const iframe = document.createElement('iframe');
        iframe.src = config.toolFile;
        iframe.style.cssText = `
            width: 100%;
            height: 100%;
            border: none;
        `;
        toolPanel.appendChild(iframe);
    } else {
        toolPanel.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; padding: 40px 20px; text-align: center;">
                <div style="font-size: 60px; margin-bottom: 16px;">🔒</div>
                <div style="font-size: 16px; font-weight: 700; color: #004080; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">Access Locked</div>
                <div style="font-size: 12px; color: #607080; margin-bottom: 24px; max-width: 300px; line-height: 1.6;">
                    You must complete the video training and pass the competency assessment (100%) to unlock this module.
                </div>
                <button onclick="document.getElementById('tab-btn-${moduleId}-assessment').click()" style="
                    background: #004080;
                    color: #fff;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 8px;
                    font-family: Oswald;
                    font-size: 12px;
                    font-weight: 700;
                    cursor: pointer;
                    letter-spacing: .5px;
                    text-transform: uppercase;
                ">Take Assessment →</button>
            </div>
        `;
    }
    content.appendChild(toolPanel);

    overlay.appendChild(content);

    return overlay;
}

function switchModuleTab(moduleId, tabId, isCompleted) {
    // Hide all panels
    ['video', 'assessment', 'tool'].forEach(t => {
        const panel = document.getElementById(`panel-${moduleId}-${t}`);
        const btn = document.getElementById(`tab-btn-${moduleId}-${t}`);
        if (panel) panel.style.display = 'none';
        if (btn) {
            btn.style.color = '#607080';
            btn.style.borderBottomColor = 'transparent';
        }
    });

    // Show selected panel
    const panel = document.getElementById(`panel-${moduleId}-${tabId}`);
    const btn = document.getElementById(`tab-btn-${moduleId}-${tabId}`);
    if (panel) panel.style.display = 'block';
    if (btn) {
        btn.style.color = '#004080';
        btn.style.borderBottomColor = '#004080';
    }

    // If tool tab and not completed, show lock screen
    if (tabId === 'tool' && !isCompleted) {
        // Already handled in buildModuleOverlay
    }
}

// ════════════════════════════════════════════════════
// ASSESSMENT QUIZ SYSTEM
// ════════════════════════════════════════════════════

function startAssessment(moduleId, moduleLabel) {
    const remaining = trainingState.getRemainingAttempts(moduleId);
    if (remaining === 0) {
        alert('No attempts remaining');
        return;
    }

    const allQuestions = QUESTION_BANKS[moduleId] || [];
    if (allQuestions.length === 0) {
        alert('No questions available');
        return;
    }

    const shuffled = [...allQuestions].sort(() => Math.random() - 0.5);
    const questions = shuffled.slice(0, Math.min(10, shuffled.length));

    let current = 0;
    let answers = new Array(questions.length).fill(null);

    const quizModal = document.createElement('div');
    quizModal.id = `quiz-${moduleId}`;
    quizModal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-family: Oswald, sans-serif;
    `;

    function renderQuestion() {
        const q = questions[current];
        const progress = ((current + 1) / questions.length) * 100;

        let html = `
            <div style="background: #fff; border-radius: 14px; width: 100%; max-width: 700px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.3);">
                <!-- Header -->
                <div style="background: linear-gradient(135deg,#002d5a,#004080); color: #fff; padding: 20px; display: flex; align-items: center; justify-content: space-between;">
                    <div>
                        <div style="font-size: 14px; font-weight: 700; letter-spacing: .8px; text-transform: uppercase;">Assessment: ${moduleLabel}</div>
                        <div style="font-size: 11px; opacity: .8; margin-top: 3px;">Question ${current + 1} of ${questions.length}</div>
                    </div>
                    <button onclick="document.getElementById('quiz-${moduleId}').remove()" style="background: rgba(255,255,255,.2); border: none; color: #fff; width: 28px; height: 28px; border-radius: 50%; font-size: 14px; cursor: pointer;">✕</button>
                </div>

                <!-- Progress bar -->
                <div style="background: #e4eaf2; height: 4px; overflow: hidden;">
                    <div style="height: 100%; background: #004080; width: ${progress}%; transition: width 0.3s ease;"></div>
                </div>

                <!-- Question -->
                <div style="padding: 30px;">
                    <div style="font-size: 16px; font-weight: 600; color: #004080; margin-bottom: 24px; line-height: 1.6;">${q.question}</div>

                    <!-- Options -->
                    <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
        `;

        q.options.forEach((option, idx) => {
            const selected = answers[current] === idx;
            const bgColor = selected ? '#e8f5ee' : '#f8fafc';
            const borderColor = selected ? '#28a745' : '#dde3ee';

            html += `
                <label style="
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    padding: 14px;
                    background: ${bgColor};
                    border: 2px solid ${borderColor};
                    border-radius: 8px;
                    cursor: pointer;
                    transition: all .2s;
                ">
                    <div style="
                        width: 18px;
                        height: 18px;
                        border-radius: 50%;
                        border: 2px solid ${borderColor};
                        flex-shrink: 0;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        ${selected ? 'background: #28a745; border-color: #28a745;' : ''}
                    ">
                        ${selected ? '<span style="color: #fff; font-size: 10px; font-weight: 700;">✓</span>' : ''}
                    </div>
                    <span style="font-size: 12px; color: ${selected ? '#1a7a3c' : '#004080'}; flex: 1;">${option}</span>
                </label>
            `;
        });

        html += `
                    </div>

                    <!-- Navigation -->
                    <div style="display: flex; gap: 12px; justify-content: space-between;">
                        <button onclick="window.quizPrev('${moduleId}')" style="
                            padding: 11px 20px;
                            background: #f4f7fa;
                            border: 2px solid #dde3ee;
                            border-radius: 7px;
                            font-family: Oswald;
                            font-size: 11px;
                            font-weight: 700;
                            cursor: pointer;
                            color: #607080;
                            letter-spacing: .5px;
                            ${current === 0 ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                        " ${current === 0 ? 'disabled' : ''}>← BACK</button>

                        ${current < questions.length - 1 ? `
                            <button onclick="window.quizNext('${moduleId}')" style="
                                padding: 11px 20px;
                                background: #004080;
                                border: none;
                                border-radius: 7px;
                                font-family: Oswald;
                                font-size: 11px;
                                font-weight: 700;
                                cursor: pointer;
                                color: #fff;
                                letter-spacing: .5px;
                                ${answers[current] === null ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                            " ${answers[current] === null ? 'disabled' : ''}>NEXT →</button>
                        ` : `
                            <button onclick="window.submitAssessment('${moduleId}', '${moduleLabel}')" style="
                                padding: 11px 20px;
                                background: #28a745;
                                border: none;
                                border-radius: 7px;
                                font-family: Oswald;
                                font-size: 11px;
                                font-weight: 700;
                                cursor: pointer;
                                color: #fff;
                                letter-spacing: .5px;
                                ${answers[current] === null ? 'opacity: 0.5; cursor: not-allowed;' : ''}
                            " ${answers[current] === null ? 'disabled' : ''}>SUBMIT →</button>
                        `}
                    </div>
                </div>
            </div>
        `;

        quizModal.innerHTML = html;

        // Add click handlers for options
        setTimeout(() => {
            const labels = quizModal.querySelectorAll('label');
            labels.forEach((label, idx) => {
                label.onclick = () => {
                    answers[current] = idx;
                    renderQuestion();
                };
            });
        }, 0);
    }

    // Store quiz state globally
    window._quizState = {
        moduleId, moduleLabel, questions, current: 0, answers,
        next: () => {
            if (window._quizState.current < window._quizState.questions.length - 1) {
                window._quizState.current++;
                renderQuestion();
            }
        },
        prev: () => {
            if (window._quizState.current > 0) {
                window._quizState.current--;
                renderQuestion();
            }
        }
    };

    window.quizNext = (mid) => window._quizState.next();
    window.quizPrev = (mid) => window._quizState.prev();

    window.submitAssessment = (moduleId, moduleLabel) => {
        const state = window._quizState;
        let correct = 0;
        state.answers.forEach((ans, idx) => {
            if (ans === state.questions[idx].correct) correct++;
        });
        const pct = Math.round((correct / state.questions.length) * 100);

        trainingState.recordAttempt(moduleId);
        showAssessmentResults(moduleId, moduleLabel, pct, correct, state.questions.length);
        quizModal.remove();
    };

    document.body.appendChild(quizModal);
    renderQuestion();
}

function showAssessmentResults(moduleId, moduleLabel, percentage, correct, total) {
    const passed = percentage === 100;
    const remaining = trainingState.getRemainingAttempts(moduleId);

    const resultModal = document.createElement('div');
    resultModal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,.8);
        z-index: 9999;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 20px;
        font-family: Oswald, sans-serif;
    `;

    if (passed) {
        resultModal.innerHTML = `
            <div style="background: #fff; border-radius: 14px; width: 100%; max-width: 500px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.3);">
                <div style="background: linear-gradient(135deg,#1a7a3c,#28a745); color: #fff; padding: 40px 30px; text-align: center;">
                    <div style="font-size: 60px; margin-bottom: 16px;">🎉</div>
                    <div style="font-size: 24px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">Perfect Score!</div>
                    <div style="font-size: 12px; opacity: .9;">100% - ${correct}/${total} Correct</div>
                </div>

                <div style="padding: 28px;">
                    <div style="background: #e8f5ee; border: 2px solid #28a745; border-radius: 10px; padding: 16px; margin-bottom: 20px;">
                        <div style="font-size: 12px; font-weight: 700; color: #1a7a3c; margin-bottom: 8px; text-transform: uppercase; letter-spacing: .5px;">Enter Name for Certificate</div>
                        <input type="text" id="certName" placeholder="Full Name" style="width: 100%; padding: 10px; border: 2px solid #28a745; border-radius: 7px; font-family: Oswald; font-size: 12px; box-sizing: border-box; outline: none;">
                    </div>

                    <button onclick="issueCert('${moduleId}', '${moduleLabel}')" style="width: 100%; padding: 12px; background: #28a745; color: #fff; border: none; border-radius: 7px; font-family: Oswald; font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 8px;">✓ Issue Certificate</button>
                    <button onclick="this.parentElement.parentElement.remove()" style="width: 100%; padding: 12px; background: #f4f7fa; border: none; border-radius: 7px; font-family: Oswald; font-size: 12px; color: #607080; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
    } else {
        resultModal.innerHTML = `
            <div style="background: #fff; border-radius: 14px; width: 100%; max-width: 500px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,.3);">
                <div style="background: linear-gradient(135deg,#c0392b,#dc3545); color: #fff; padding: 40px 30px; text-align: center;">
                    <div style="font-size: 60px; margin-bottom: 16px;">❌</div>
                    <div style="font-size: 24px; font-weight: 700; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 8px;">Not Passing</div>
                    <div style="font-size: 12px; opacity: .9;">${percentage}% - ${correct}/${total} Correct</div>
                </div>

                <div style="padding: 28px;">
                    <div style="background: #fff8e1; border: 2px solid #ffc107; border-radius: 10px; padding: 12px; margin-bottom: 20px; font-size: 12px; color: #8a6500; line-height: 1.5;">
                        ${remaining > 0 ? `You must score 100%. You have <strong>${remaining}</strong> attempt${remaining === 1 ? '' : 's'} remaining.` : '<strong>No attempts remaining.</strong> Contact supervisor for re-qualification.'}
                    </div>

                    ${remaining > 0 ? `
                        <button onclick="startAssessment('${moduleId}', '${moduleLabel}'); this.parentElement.parentElement.remove()" style="width: 100%; padding: 12px; background: #ffc107; color: #004080; border: none; border-radius: 7px; font-family: Oswald; font-size: 12px; font-weight: 700; cursor: pointer; letter-spacing: .5px; text-transform: uppercase; margin-bottom: 8px;">↻ Try Again</button>
                    ` : ''}
                    <button onclick="this.parentElement.parentElement.remove()" style="width: 100%; padding: 12px; background: #f4f7fa; border: none; border-radius: 7px; font-family: Oswald; font-size: 12px; color: #607080; cursor: pointer;">Close</button>
                </div>
            </div>
        `;
    }

    document.body.appendChild(resultModal);

    window.issueCert = (moduleId, moduleLabel) => {
        const name = document.getElementById('certName')?.value.trim();
        if (!name) {
            alert('Enter your name');
            return;
        }
        trainingState.markCompleted(moduleId, name);
        downloadCertificate(name, moduleLabel, moduleId);
        
        // Close result and reload module
        resultModal.remove();
        const overlay = document.getElementById(`mod-overlay-${moduleId}`);
        if (overlay) overlay.remove();
        setTimeout(() => openModuleWithTraining(moduleId), 300);
    };
}

// ════════════════════════════════════════════════════
// OPEN MODULE WITH TRAINING SYSTEM
// ════════════════════════════════════════════════════

function openModuleWithTraining(moduleId) {
    const config = MODULE_CONFIG[moduleId];
    if (!config) {
        console.error(`Module config not found: ${moduleId}`);
        return;
    }

    const overlay = buildModuleOverlay(moduleId);
    if (overlay) {
        document.body.appendChild(overlay);
        document.body.style.overflow = 'hidden';

        // Show video tab by default
        switchModuleTab(moduleId, 'video', trainingState.isCompleted(moduleId));

        // Close on Escape
        const closeOnEscape = (e) => {
            if (e.key === 'Escape') {
                overlay.remove();
                document.body.style.overflow = '';
                document.removeEventListener('keydown', closeOnEscape);
            }
        };
        document.addEventListener('keydown', closeOnEscape);
    }
}

// ════════════════════════════════════════════════════
// EXPORTS
// ════════════════════════════════════════════════════

window.trainingState = trainingState;
window.openModuleWithTraining = openModuleWithTraining;
window.downloadCertificate = downloadCertificate;
