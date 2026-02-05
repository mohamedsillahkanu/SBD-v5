// ============================================
// CONFIGURATION
// ============================================
const CONFIG = {
    SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbzs_hVlsEQAu_4qeOaZUTjS_cnH3NR22ecQ8QUu5Zw_z8WpOzjnoMLo8Tm-hgQnohQ_zw/exec',
    GOOGLE_SHEET_URL: 'https://docs.google.com/spreadsheets/d/1tumwvxOoToPYDPdpXLyGYaiT2kbfN6Vw_HBd-8t6IAA/edit?gid=353413478#gid=353413478',
    CSV_FILE: 'cascading_data.csv',
    LOGIN_USERNAME: 'bbc',
    LOGIN_PASSWORD: 'bbc',
    SHEETS: {
        SURVEY_DATA: 'SURVEY_DATA',
        SUMMARY: 'SUMMARY_REPORT'
    }
};

// ============================================
// LOCATION DATA (loaded from CSV)
// ============================================
let LOCATION_DATA = {};
// Structure: { district: { chiefdom: { section: [facility, ...] } } }

function loadLocationData() {
    return new Promise((resolve, reject) => {
        Papa.parse(CONFIG.CSV_FILE, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: function(results) {
                const data = results.data;
                LOCATION_DATA = {};

                data.forEach(row => {
                    const district = (row.adm1 || '').trim();
                    const chiefdom = (row.adm2 || '').trim();
                    const section = (row.adm3 || '').trim();
                    const facility = (row.hf || '').trim();

                    if (!district) return;

                    if (!LOCATION_DATA[district]) LOCATION_DATA[district] = {};
                    if (!LOCATION_DATA[district][chiefdom]) LOCATION_DATA[district][chiefdom] = {};
                    if (!LOCATION_DATA[district][chiefdom][section]) LOCATION_DATA[district][chiefdom][section] = [];
                    if (facility && !LOCATION_DATA[district][chiefdom][section].includes(facility)) {
                        LOCATION_DATA[district][chiefdom][section].push(facility);
                    }
                });

                // Sort all arrays
                for (const d in LOCATION_DATA) {
                    for (const c in LOCATION_DATA[d]) {
                        for (const s in LOCATION_DATA[d][c]) {
                            LOCATION_DATA[d][c][s].sort();
                        }
                    }
                }

                console.log(`Loaded ${Object.keys(LOCATION_DATA).length} districts from CSV`);
                resolve();
            },
            error: function(error) {
                console.error('CSV load error:', error);
                reject(error);
            }
        });
    });
}

// Helper: get sorted keys
function sortedKeys(obj) {
    return Object.keys(obj).sort();
}

// ============================================
// FORM SECTIONS DEFINITION
// ============================================
const FORM_SECTIONS = {
    'Section A: School & Location Profile': {
        description: 'School identification and geographic location',
        fields: {
            school_name: { label: 'Name of School', type: 'text' },
            school_type: {
                label: 'Type of School',
                type: 'radio',
                options: ['Primary', 'Junior Secondary School (JSS)', 'Senior Secondary School (SSS)', 'Combined (Primary + JSS)', 'Combined (Primary + JSS + SSS)']
            },
            school_ownership: {
                label: 'School Ownership',
                type: 'radio',
                options: ['Government', 'Mission/Faith-based', 'Private', 'Community']
            },
            district: {
                label: 'District',
                type: 'cascade_select',
                cascadeLevel: 'district'
            },
            chiefdom: {
                label: 'Chiefdom',
                type: 'cascade_select',
                cascadeLevel: 'chiefdom',
                cascadeFrom: 'district'
            },
            section: {
                label: 'Section',
                type: 'cascade_select',
                cascadeLevel: 'section',
                cascadeFrom: 'chiefdom'
            },
            facility: {
                label: 'Nearest Health Facility',
                type: 'cascade_select',
                cascadeLevel: 'facility',
                cascadeFrom: 'section'
            },
            community_name: { label: 'Community / Town / Village Name', type: 'text' },
            head_teacher_name: { label: 'Name of Head Teacher', type: 'text' },
            head_teacher_contact: { label: 'Head Teacher Contact Number', type: 'tel' }
        }
    },
    'Section B: Student Enrollment & Eligibility': {
        description: 'Student population and eligibility details for ITN distribution',
        fields: {
            total_enrollment: { label: 'Q1. Total number of students enrolled in the school', type: 'number' },
            total_male_students: { label: 'Q2. Total number of male students enrolled', type: 'number' },
            total_female_students: { label: 'Q3. Total number of female students enrolled', type: 'number' },
            total_eligible_students: { label: 'Q4. Total number of students eligible for ITN distribution', type: 'number' },
            eligible_male_students: { label: 'Q5. Number of eligible male students', type: 'number' },
            eligible_female_students: { label: 'Q6. Number of eligible female students', type: 'number' },
            students_present_distribution_day: { label: 'Q7. Number of students present on distribution day', type: 'number' },
            male_students_present: { label: 'Q8. Number of male students present on distribution day', type: 'number' },
            female_students_present: { label: 'Q9. Number of female students present on distribution day', type: 'number' },
            total_teachers: { label: 'Q10. Total number of teachers in the school', type: 'number' }
        }
    },
    'Section C: ITN Supply & Distribution': {
        description: 'Details of ITN stock received and distributed at the school',
        fields: {
            distribution_date: { label: 'Q11. Date of ITN Distribution', type: 'date' },
            itns_received: { label: 'Q12. Total number of ITNs received for this school', type: 'number' },
            source_of_itns: {
                label: 'Q13. Source of ITNs',
                type: 'radio',
                options: ['National Malaria Control Programme (NMCP)', 'District Health Management Team (DHMT)', 'WHO', 'Global Fund', 'UNICEF', 'NGO/Partner Organization', 'Other']
            },
            source_of_itns_other: { label: 'If Other, please specify', type: 'text', required: false },
            itns_distributed_total: { label: 'Q14. Total number of ITNs distributed to students', type: 'number' },
            itns_distributed_male: { label: 'Q15. Number of ITNs distributed to male students', type: 'number' },
            itns_distributed_female: { label: 'Q16. Number of ITNs distributed to female students', type: 'number' },
            itns_distributed_teachers: { label: 'Q17. Number of ITNs distributed to teachers (if applicable)', type: 'number', required: false },
            itns_remaining: { label: 'Q18. Number of ITNs remaining after distribution', type: 'number' },
            itns_damaged: { label: 'Q19. Number of damaged / unusable ITNs found', type: 'number' },
            itn_brand: {
                label: 'Q20. Brand / Type of ITN distributed',
                type: 'radio',
                options: ['PermaNet', 'Olyset', 'DawaPlus', 'Interceptor', 'Royal Sentry', 'Other', "Don't know"]
            },
            itn_brand_other: { label: 'If Other, please specify', type: 'text', required: false }
        }
    },
    'Section D: Distribution Process & Logistics': {
        description: 'How the distribution was organized and conducted at the school',
        fields: {
            distribution_method: {
                label: 'Q21. How were ITNs distributed to students?',
                type: 'radio',
                options: ['Classroom-by-classroom distribution', 'Central point (e.g., assembly hall)', 'Class teachers distributed to their students', 'Students lined up by grade', 'Other']
            },
            distribution_method_other: { label: 'If Other, please specify', type: 'text', required: false },
            distribution_supervised_by: {
                label: 'Q22. Who supervised the distribution? (Select all that apply)',
                type: 'checkbox',
                options: [
                    'Head Teacher',
                    'Class Teachers',
                    'District Health Management Team (DHMT) Staff',
                    'NMCP Staff',
                    'Community Health Workers (CHWs)',
                    'NGO / Partner Staff',
                    'School Management Committee (SMC)',
                    'Other'
                ]
            },
            distribution_supervised_other: { label: 'If Other, please specify', type: 'text', required: false },
            health_education_given: {
                label: 'Q23. Was health education on ITN use provided during distribution?',
                type: 'radio',
                options: ['Yes', 'No']
            },
            health_education_topics: {
                label: 'Q24. What topics were covered? (Select all that apply)',
                type: 'checkbox',
                options: [
                    'How to hang / install the ITN',
                    'Importance of sleeping under ITN every night',
                    'How to care for and wash the ITN',
                    'Malaria prevention and symptoms',
                    'When to seek medical treatment for malaria',
                    'Not to use ITNs for fishing or farming'
                ],
                required: false,
                conditional: 'health_education_given',
                conditionalValue: 'Yes'
            },
            who_delivered_health_education: {
                label: 'Q25. Who delivered the health education?',
                type: 'radio',
                options: ['Teacher', 'Health Worker', 'NMCP Staff', 'NGO / Partner Staff', 'Community Health Worker', 'Other'],
                required: false,
                conditional: 'health_education_given',
                conditionalValue: 'Yes'
            },
            register_used: {
                label: 'Q26. Was a distribution register / list used to track ITNs given?',
                type: 'radio',
                options: ['Yes', 'No']
            },
            student_signed_received: {
                label: 'Q27. Did students (or parents/guardians) sign or thumbprint to confirm receipt?',
                type: 'radio',
                options: ['Yes', 'No']
            }
        }
    },
    'Section E: Challenges & Observations': {
        description: 'Challenges encountered and additional observations during distribution',
        fields: {
            sufficient_itns: {
                label: 'Q28. Were there sufficient ITNs for all eligible students?',
                type: 'radio',
                options: ['Yes', 'No']
            },
            shortage_action: {
                label: 'Q29. If No, how was the shortage handled?',
                type: 'radio',
                options: [
                    'Prioritized younger students',
                    'Prioritized female students',
                    'First-come-first-served basis',
                    'Students without any nets at home prioritized',
                    'Requested additional ITNs from DHMT',
                    'Not yet resolved',
                    'Other'
                ],
                required: false,
                conditional: 'sufficient_itns',
                conditionalValue: 'No'
            },
            shortage_action_other: { label: 'If Other, please specify', type: 'text', required: false },
            challenges_encountered: {
                label: 'Q30. Were any challenges encountered during the distribution?',
                type: 'radio',
                options: ['Yes', 'No']
            },
            challenge_types: {
                label: 'Q31. What challenges were encountered? (Select all that apply)',
                type: 'checkbox',
                options: [
                    'Insufficient ITNs for all students',
                    'Late delivery of ITNs to the school',
                    'Low student attendance on distribution day',
                    'Damaged or torn ITNs in the supply',
                    'Lack of transportation for ITNs',
                    'No distribution register / forms available',
                    'Inadequate storage space at the school',
                    'Community members demanding ITNs meant for students',
                    'Lack of supervision from health authorities',
                    'Students losing ITNs on the way home',
                    'Other'
                ],
                required: false,
                conditional: 'challenges_encountered',
                conditionalValue: 'Yes'
            },
            challenge_types_other: { label: 'If Other, please specify', type: 'text', required: false },
            itn_storage_before_distribution: {
                label: 'Q32. Where were ITNs stored before distribution?',
                type: 'radio',
                options: ["Head Teacher's office", 'School store room', 'Classroom', 'Community health center', 'District warehouse', 'Other']
            },
            itn_storage_other: { label: 'If Other, please specify', type: 'text', required: false },
            condition_of_itns: {
                label: 'Q33. Overall condition of ITNs received',
                type: 'radio',
                options: ['All in good condition', 'Most in good condition (few damaged)', 'Many damaged / torn', 'Expired or discolored']
            },
            previous_school_itn_distribution: {
                label: 'Q34. Has this school received ITN distribution before?',
                type: 'radio',
                options: ['Yes', 'No', "Don't know"]
            },
            last_distribution_year: {
                label: 'Q35. If Yes, when was the last school-based ITN distribution?',
                type: 'radio',
                options: ['Within the last year', '1–2 years ago', '3–4 years ago', '5+ years ago', "Don't know"],
                required: false,
                conditional: 'previous_school_itn_distribution',
                conditionalValue: 'Yes'
            },
            overall_distribution_rating: {
                label: 'Q36. Overall rating of the distribution process',
                type: 'radio',
                options: ['Excellent', 'Good', 'Fair', 'Poor', 'Very Poor']
            },
            additional_comments: { label: 'Q37. Additional comments or observations', type: 'textarea', required: false }
        }
    },
    'Respondent Information & Signature': {
        description: 'Information about the person completing this survey',
        fields: {
            respondent_name: { label: 'Name of Respondent', type: 'text' },
            respondent_position: { label: 'Position / Title', type: 'text' },
            respondent_organization: {
                label: 'Organization',
                type: 'radio',
                options: ['NMCP', 'DHMT', 'WHO', 'NGO / Partner', 'School Staff', 'Other']
            },
            respondent_organization_other: { label: 'If Other, please specify', type: 'text', required: false },
            respondent_contact: { label: 'Contact Number', type: 'tel' },
            respondent_email: { label: 'Email Address', type: 'email', required: false },
            survey_date: { label: 'Date of Survey', type: 'date' },
            respondent_signature: { label: 'Signature', type: 'signature' },
            gps_location: { label: 'GPS Location (Auto-captured)', type: 'gps', required: false }
        }
    }
};

// ============================================
// STATE
// ============================================
const state = {
    pendingSubmissions: [],
    drafts: [],
    isOnline: navigator.onLine,
    currentSection: 1,
    totalSections: 0,
    signaturePads: {},
    gpsLocation: null,
    formStatus: 'draft',
    currentDraftId: null,
    currentDraftName: null,
    gpsAttempted: false,
    locationDataLoaded: false
};

// ============================================
// INITIALIZATION
// ============================================
async function init() {
    const savedPending = localStorage.getItem('pendingSubmissions_itn');
    if (savedPending) { try { state.pendingSubmissions = JSON.parse(savedPending); } catch (e) { state.pendingSubmissions = []; } }

    const savedDrafts = localStorage.getItem('formDrafts_itn');
    if (savedDrafts) { try { state.drafts = JSON.parse(savedDrafts); } catch (e) { state.drafts = []; } }

    updateOnlineStatus();
    updatePendingCount();
    updateDraftCount();
    setupEventListeners();

    // Load CSV data first, then generate form
    try {
        await loadLocationData();
        state.locationDataLoaded = true;
        console.log('Location data loaded successfully');
    } catch (e) {
        console.error('Failed to load location data:', e);
        showNotification('Warning: Location data could not be loaded. Cascading dropdowns may not work.', 'warning');
    }

    generateFormSections();

    setTimeout(() => { captureGPSAutomatically(); }, 1000);

    if (state.isOnline && state.pendingSubmissions.length > 0) {
        syncPendingSubmissions();
    }
}

function generateFormSections() {
    const container = document.getElementById('dynamicSections');
    let html = '';
    let sectionNum = 1;

    const sectionKeys = Object.keys(FORM_SECTIONS);
    state.totalSections = sectionKeys.length;

    sectionKeys.forEach((sectionTitle, index) => {
        const section = FORM_SECTIONS[sectionTitle];
        const isLastSection = index === sectionKeys.length - 1;

        html += `
            <div class="form-section ${sectionNum === 1 ? 'active' : ''}" data-section="${sectionNum}">
                <div class="section-header">
                    <h2 class="section-title">${sectionTitle.toUpperCase()}</h2>
                    <p class="section-description">${section.description}</p>
                </div>
        `;

        const fields = Object.entries(section.fields);
        fields.forEach(([fieldName, fieldConfig]) => {
            const label = fieldConfig.label;
            const type = fieldConfig.type || 'text';
            const required = fieldConfig.required !== false;
            const conditional = fieldConfig.conditional;
            const conditionalValue = fieldConfig.conditionalValue;
            const conditionalInverse = fieldConfig.conditionalInverse || false;

            const conditionalClass = conditional ? 'conditional-field' : '';
            const conditionalData = conditional ? `data-conditional="${conditional}" data-conditional-value="${conditionalValue}" data-conditional-inverse="${conditionalInverse}"` : '';

            html += `<div class="form-group ${conditionalClass}" ${conditionalData} id="group_${fieldName}">`;
            html += `<label class="form-label">${label.toUpperCase()} ${required ? '<span class="required">*</span>' : ''}</label>`;

            if (type === 'cascade_select') {
                // Cascading dropdown from CSV
                const level = fieldConfig.cascadeLevel;
                const cascadeFrom = fieldConfig.cascadeFrom || '';
                const isDisabled = cascadeFrom ? 'disabled' : '';
                const placeholder = level === 'district' ? 'Select District...' :
                                   level === 'chiefdom' ? 'Select Chiefdom...' :
                                   level === 'section' ? 'Select Section...' :
                                   'Select Health Facility...';

                html += `<div class="cascade-select-wrapper">`;
                html += `<select class="form-select" name="${fieldName}" id="${fieldName}" ${required ? 'required' : ''} ${isDisabled} data-cascade-level="${level}" data-cascade-from="${cascadeFrom}" data-field-name="${fieldName}">`;
                html += `<option value="">${placeholder}</option>`;

                // Pre-populate district level
                if (level === 'district' && state.locationDataLoaded) {
                    sortedKeys(LOCATION_DATA).forEach(d => {
                        html += `<option value="${d}">${d}</option>`;
                    });
                }

                html += `</select>`;
                html += `<div class="cascade-count" id="count_${fieldName}"></div>`;
                html += `</div>`;
                html += `<div class="field-error" id="error_${fieldName}">Please select an option</div>`;

            } else if (type === 'signature') {
                html += `
                    <div class="signature-container">
                        <canvas class="signature-canvas" id="${fieldName}_canvas" data-field="${fieldName}"></canvas>
                        <div class="signature-controls">
                            <button type="button" class="signature-btn" onclick="clearSignature('${fieldName}')">CLEAR</button>
                        </div>
                    </div>
                    <input type="hidden" name="${fieldName}" id="${fieldName}" ${required ? 'required' : ''}>
                `;
            } else if (type === 'gps') {
                html += `
                    <div class="gps-container">
                        <div class="gps-status">
                            <div class="gps-icon" id="gps_icon"></div>
                            <div>
                                <div class="gps-info" id="gps_status">Automatically capturing GPS location...</div>
                                <div class="gps-coords" id="gps_coords"></div>
                            </div>
                        </div>
                    </div>
                    <input type="hidden" name="gps_latitude" id="gps_latitude">
                    <input type="hidden" name="gps_longitude" id="gps_longitude">
                    <input type="hidden" name="gps_accuracy" id="gps_accuracy">
                    <input type="hidden" name="gps_timestamp" id="gps_timestamp">
                `;
            } else if (type === 'radio') {
                html += '<div class="radio-group">';
                fieldConfig.options.forEach((option, idx) => {
                    html += `
                        <div class="radio-item">
                            <input type="radio" name="${fieldName}" id="${fieldName}_${idx}" value="${option}" ${required ? 'required' : ''} data-field-name="${fieldName}">
                            <label for="${fieldName}_${idx}">${option}</label>
                        </div>
                    `;
                });
                html += '</div>';
                html += `<div class="field-error" id="error_${fieldName}">Please select an option</div>`;
            } else if (type === 'checkbox') {
                html += '<div class="checkbox-group">';
                fieldConfig.options.forEach((option, idx) => {
                    html += `
                        <div class="checkbox-item">
                            <input type="checkbox" name="${fieldName}" id="${fieldName}_${idx}" value="${option}">
                            <label for="${fieldName}_${idx}">${option}</label>
                        </div>
                    `;
                });
                html += '</div>';
            } else if (type === 'date') {
                html += `<input type="date" class="form-input" name="${fieldName}" id="${fieldName}" ${required ? 'required' : ''} data-field-name="${fieldName}">`;
                html += `<div class="field-error" id="error_${fieldName}">This field is required</div>`;
            } else if (type === 'number') {
                html += `<input type="number" class="form-input" name="${fieldName}" id="${fieldName}" min="0" step="1" ${required ? 'required' : ''} data-field-name="${fieldName}">`;
                html += `<div class="field-error" id="error_${fieldName}">This field is required</div>`;
            } else if (type === 'textarea') {
                html += `<textarea class="form-textarea" name="${fieldName}" id="${fieldName}" rows="4" ${required ? 'required' : ''} data-field-name="${fieldName}"></textarea>`;
                html += `<div class="field-error" id="error_${fieldName}">This field is required</div>`;
            } else if (type === 'tel') {
                html += `<input type="tel" class="form-input" name="${fieldName}" id="${fieldName}" ${required ? 'required' : ''} data-field-name="${fieldName}">`;
                html += `<div class="field-error" id="error_${fieldName}">This field is required</div>`;
            } else if (type === 'email') {
                html += `<input type="email" class="form-input" name="${fieldName}" id="${fieldName}" ${required ? 'required' : ''} data-field-name="${fieldName}">`;
                html += `<div class="field-error" id="error_${fieldName}">Please enter a valid email</div>`;
            } else {
                html += `<input type="text" class="form-input" name="${fieldName}" id="${fieldName}" ${required ? 'required' : ''} data-field-name="${fieldName}">`;
                html += `<div class="field-error" id="error_${fieldName}">This field is required</div>`;
            }

            html += '</div>';
        });

        // Navigation buttons
        html += '<div class="navigation-buttons">';
        if (sectionNum > 1) {
            html += '<button type="button" class="btn-nav btn-back" onclick="previousSection()">← BACK</button>';
        }
        html += '<button type="button" class="btn-nav btn-draft" onclick="showDraftNameModal()">💾 SAVE DRAFT</button>';
        if (isLastSection) {
            html += '<button type="button" class="btn-nav btn-finalize" id="finalizeBtn" onclick="finalizeForm()">✓ FINALIZE</button>';
            html += '<button type="submit" class="btn-nav btn-submit" id="submitBtn" disabled>📤 SUBMIT</button>';
        } else {
            html += '<button type="button" class="btn-nav btn-next" onclick="nextSection()">NEXT →</button>';
        }
        html += '</div></div>';
        sectionNum++;
    });

    container.innerHTML = html;
    updateProgress();

    setTimeout(() => {
        initializeSignaturePads();
        setupCascadingDropdowns();
        setupConditionalFields();
        setupRealTimeValidation();
    }, 100);
}

// ============================================
// 4-LEVEL CASCADING DROPDOWNS (from CSV)
// ============================================
function setupCascadingDropdowns() {
    const districtSelect = document.getElementById('district');
    const chiefdomSelect = document.getElementById('chiefdom');
    const sectionSelect = document.getElementById('section');
    const facilitySelect = document.getElementById('facility');

    if (!districtSelect || !chiefdomSelect || !sectionSelect || !facilitySelect) return;

    // Show count for district
    updateCascadeCount('district', Object.keys(LOCATION_DATA).length);

    // District → Chiefdom
    districtSelect.addEventListener('change', function() {
        const d = this.value;
        resetCascade(chiefdomSelect, 'Select Chiefdom...');
        resetCascade(sectionSelect, 'Select Section...');
        resetCascade(facilitySelect, 'Select Health Facility...');
        clearCascadeCount('chiefdom');
        clearCascadeCount('section');
        clearCascadeCount('facility');

        if (d && LOCATION_DATA[d]) {
            chiefdomSelect.disabled = false;
            const chiefdoms = sortedKeys(LOCATION_DATA[d]);
            chiefdoms.forEach(c => {
                const opt = document.createElement('option');
                opt.value = c;
                opt.textContent = c;
                chiefdomSelect.appendChild(opt);
            });
            updateCascadeCount('chiefdom', chiefdoms.length);
        } else {
            chiefdomSelect.disabled = true;
            sectionSelect.disabled = true;
            facilitySelect.disabled = true;
        }
        clearFieldError('district');
        clearFieldError('chiefdom');
        clearFieldError('section');
        clearFieldError('facility');
    });

    // Chiefdom → Section
    chiefdomSelect.addEventListener('change', function() {
        const d = districtSelect.value;
        const c = this.value;
        resetCascade(sectionSelect, 'Select Section...');
        resetCascade(facilitySelect, 'Select Health Facility...');
        clearCascadeCount('section');
        clearCascadeCount('facility');

        if (d && c && LOCATION_DATA[d] && LOCATION_DATA[d][c]) {
            sectionSelect.disabled = false;
            const sections = sortedKeys(LOCATION_DATA[d][c]);
            sections.forEach(s => {
                const opt = document.createElement('option');
                opt.value = s;
                opt.textContent = s;
                sectionSelect.appendChild(opt);
            });
            updateCascadeCount('section', sections.length);
        } else {
            sectionSelect.disabled = true;
            facilitySelect.disabled = true;
        }
        clearFieldError('chiefdom');
        clearFieldError('section');
        clearFieldError('facility');
    });

    // Section → Facility
    sectionSelect.addEventListener('change', function() {
        const d = districtSelect.value;
        const c = chiefdomSelect.value;
        const s = this.value;
        resetCascade(facilitySelect, 'Select Health Facility...');
        clearCascadeCount('facility');

        if (d && c && s && LOCATION_DATA[d] && LOCATION_DATA[d][c] && LOCATION_DATA[d][c][s]) {
            facilitySelect.disabled = false;
            const facilities = LOCATION_DATA[d][c][s]; // Already sorted
            facilities.forEach(f => {
                const opt = document.createElement('option');
                opt.value = f;
                opt.textContent = f;
                facilitySelect.appendChild(opt);
            });
            updateCascadeCount('facility', facilities.length);
        } else {
            facilitySelect.disabled = true;
        }
        clearFieldError('section');
        clearFieldError('facility');
    });

    facilitySelect.addEventListener('change', function() {
        clearFieldError('facility');
    });
}

function resetCascade(selectEl, placeholder) {
    selectEl.innerHTML = `<option value="">${placeholder}</option>`;
    selectEl.disabled = true;
    selectEl.classList.remove('error');
}

function updateCascadeCount(fieldName, count) {
    const el = document.getElementById(`count_${fieldName}`);
    if (el) el.textContent = `${count} option${count !== 1 ? 's' : ''} available`;
}

function clearCascadeCount(fieldName) {
    const el = document.getElementById(`count_${fieldName}`);
    if (el) el.textContent = '';
}

function clearFieldError(fieldName) {
    const errorDiv = document.getElementById(`error_${fieldName}`);
    if (errorDiv) errorDiv.classList.remove('show');
    const field = document.getElementById(fieldName);
    if (field) field.classList.remove('error');
}

// ============================================
// CONDITIONAL FIELDS
// ============================================
function setupConditionalFields() {
    const conditionalFields = document.querySelectorAll('.conditional-field');

    conditionalFields.forEach(field => {
        const parentFieldName = field.getAttribute('data-conditional');
        const expectedValue = field.getAttribute('data-conditional-value');
        const isInverse = field.getAttribute('data-conditional-inverse') === 'true';

        const parentRadios = document.querySelectorAll(`input[name="${parentFieldName}"]`);

        parentRadios.forEach(radio => {
            radio.addEventListener('change', function() {
                let shouldShow = isInverse ? this.value !== expectedValue : this.value === expectedValue;

                if (shouldShow) {
                    field.classList.add('show');
                } else {
                    field.classList.remove('show');
                    field.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
                    field.querySelectorAll('input[type="radio"]').forEach(r => r.checked = false);
                    field.querySelectorAll('input[type="text"], textarea').forEach(input => input.value = '');
                }
            });
        });

        const checkedRadio = document.querySelector(`input[name="${parentFieldName}"]:checked`);
        if (checkedRadio) {
            let shouldShow = isInverse ? checkedRadio.value !== expectedValue : checkedRadio.value === expectedValue;
            if (shouldShow) field.classList.add('show');
        }
    });
}

// ============================================
// REAL-TIME VALIDATION
// ============================================
function setupRealTimeValidation() {
    document.querySelectorAll('input[type="number"][required]').forEach(input => {
        input.addEventListener('input', function() {
            this.classList.remove('error');
            const errorDiv = document.getElementById(`error_${this.id}`);
            if (errorDiv) errorDiv.classList.remove('show');
        });
    });

    document.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
        input.addEventListener('blur', function() {
            if (this.type !== 'radio' && this.type !== 'number') validateField(this);
        });
        input.addEventListener('input', function() {
            if (this.type !== 'radio') {
                this.classList.remove('error');
                const fieldName = this.getAttribute('data-field-name') || this.id;
                const errorDiv = document.getElementById(`error_${fieldName}`);
                if (errorDiv) errorDiv.classList.remove('show');
            }
        });
    });
}

function validateField(field) {
    const fieldName = field.getAttribute('data-field-name') || field.id;
    const errorDiv = document.getElementById(`error_${fieldName}`);

    if (!field.value || field.value.trim() === '') {
        field.classList.add('error');
        if (errorDiv) errorDiv.classList.add('show');
        return false;
    } else {
        field.classList.remove('error');
        if (errorDiv) errorDiv.classList.remove('show');
        return true;
    }
}

// ============================================
// EVENT LISTENERS
// ============================================
function setupEventListeners() {
    document.getElementById('viewDataBtn').addEventListener('click', handleViewData);
    document.getElementById('viewAnalysisBtn').addEventListener('click', openAnalysisModal);
    document.getElementById('viewDraftsBtn').addEventListener('click', openDraftsModal);
    document.getElementById('dataForm').addEventListener('submit', handleFormSubmit);
    window.addEventListener('online', handleOnlineEvent);
    window.addEventListener('offline', handleOfflineEvent);
    document.getElementById('draftNameInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') confirmSaveDraft();
    });
}

// ============================================
// NAVIGATION
// ============================================
function nextSection() {
    const currentSectionEl = document.querySelector(`.form-section[data-section="${state.currentSection}"]`);
    let isValid = true;
    let firstInvalidField = null;

    const inputs = currentSectionEl.querySelectorAll('input[required], select[required], textarea[required]');

    inputs.forEach(input => {
        const parentGroup = input.closest('.conditional-field');
        if (parentGroup && !parentGroup.classList.contains('show')) return;

        if (input.type === 'radio') {
            const radioGroup = currentSectionEl.querySelectorAll(`input[name="${input.name}"]`);
            const isChecked = Array.from(radioGroup).some(radio => radio.checked);
            if (!isChecked) {
                isValid = false;
                const fieldName = input.getAttribute('data-field-name') || input.name;
                const errorDiv = document.getElementById(`error_${fieldName}`);
                if (errorDiv) errorDiv.classList.add('show');
                if (input.closest('.radio-group')) {
                    input.closest('.radio-group').style.borderLeft = '4px solid #dc3545';
                    setTimeout(() => { if (input.closest('.radio-group')) input.closest('.radio-group').style.borderLeft = ''; }, 3000);
                }
                if (!firstInvalidField) firstInvalidField = input;
            }
        } else if (!input.value || input.value.trim() === '') {
            isValid = false;
            input.classList.add('error');
            const fieldName = input.getAttribute('data-field-name') || input.id;
            const errorDiv = document.getElementById(`error_${fieldName}`);
            if (errorDiv) errorDiv.classList.add('show');
            if (!firstInvalidField) firstInvalidField = input;
            setTimeout(() => { input.classList.remove('error'); }, 3000);
        }
    });

    if (!isValid) {
        showNotification('Please fill in all required fields correctly', 'error');
        if (firstInvalidField) {
            firstInvalidField.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => { firstInvalidField.focus(); }, 500);
        }
        return;
    }

    if (state.currentSection < state.totalSections) {
        currentSectionEl.classList.remove('active');
        state.currentSection++;
        document.querySelector(`.form-section[data-section="${state.currentSection}"]`).classList.add('active');
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function previousSection() {
    if (state.currentSection > 1) {
        document.querySelector(`.form-section[data-section="${state.currentSection}"]`).classList.remove('active');
        state.currentSection--;
        document.querySelector(`.form-section[data-section="${state.currentSection}"]`).classList.add('active');
        updateProgress();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}

function updateProgress() {
    const progress = (state.currentSection / state.totalSections) * 100;
    document.getElementById('progressFill').style.width = progress + '%';

    let statusBadge = '';
    if (state.formStatus === 'draft') statusBadge = '<span class="form-status-badge draft">DRAFT</span>';
    else if (state.formStatus === 'finalized') statusBadge = '<span class="form-status-badge finalized">FINALIZED</span>';

    document.getElementById('progressText').innerHTML = `SECTION ${state.currentSection} OF ${state.totalSections} ${statusBadge}`;
}

// ============================================
// DATA / STATUS
// ============================================
function handleViewData() {
    if (!checkAdminLogin()) return;
    if (CONFIG.GOOGLE_SHEET_URL) window.open(CONFIG.GOOGLE_SHEET_URL, '_blank');
    else showNotification('Please configure Google Sheet URL', 'error');
}

function checkAdminLogin() {
    const username = prompt('Enter admin username:');
    const password = prompt('Enter admin password:');
    if (username === CONFIG.LOGIN_USERNAME && password === CONFIG.LOGIN_PASSWORD) return true;
    showNotification('Invalid credentials. Access denied.', 'error');
    return false;
}

function handleOnlineEvent() { state.isOnline = true; updateOnlineStatus(); showNotification('Back online - Syncing data...', 'info'); syncPendingSubmissions(); }
function handleOfflineEvent() { state.isOnline = false; updateOnlineStatus(); showNotification('You are offline - Data will be saved locally', 'info'); }

function updateOnlineStatus() {
    const indicator = document.getElementById('statusIndicator');
    const text = document.getElementById('statusText');
    if (state.isOnline) { indicator.className = 'status-indicator online'; text.textContent = 'ONLINE'; }
    else { indicator.className = 'status-indicator offline'; text.textContent = 'OFFLINE'; }
}

function updatePendingCount() { document.getElementById('pendingCount').textContent = state.pendingSubmissions.length; }
function updateDraftCount() { document.getElementById('draftCount').textContent = state.drafts.length; }

// ============================================
// GPS
// ============================================
function captureGPSAutomatically() {
    if (state.gpsAttempted) return;
    state.gpsAttempted = true;

    const statusIcon = document.getElementById('gps_icon');
    const statusText = document.getElementById('gps_status');
    const coordsText = document.getElementById('gps_coords');

    if (!navigator.geolocation) { if (statusIcon) statusIcon.classList.add('error'); if (statusText) statusText.textContent = 'GPS not supported'; return; }

    if (statusIcon) statusIcon.classList.add('loading');
    if (statusText) statusText.textContent = 'Capturing GPS location automatically...';

    navigator.geolocation.getCurrentPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const timestamp = new Date(position.timestamp).toISOString();
            state.gpsLocation = { latitude, longitude, accuracy, timestamp };

            if (document.getElementById('gps_latitude')) document.getElementById('gps_latitude').value = latitude;
            if (document.getElementById('gps_longitude')) document.getElementById('gps_longitude').value = longitude;
            if (document.getElementById('gps_accuracy')) document.getElementById('gps_accuracy').value = accuracy;
            if (document.getElementById('gps_timestamp')) document.getElementById('gps_timestamp').value = timestamp;

            if (statusIcon) { statusIcon.classList.remove('loading', 'error'); statusIcon.classList.add('success'); }
            if (statusText) statusText.textContent = 'GPS location captured successfully!';
            if (coordsText) coordsText.textContent = `Lat: ${latitude.toFixed(6)}, Lon: ${longitude.toFixed(6)} (±${Math.round(accuracy)}m)`;
        },
        (error) => {
            if (statusIcon) { statusIcon.classList.remove('loading', 'success'); statusIcon.classList.add('error'); }
            let msg = 'Failed to capture GPS (optional)';
            if (error.code === error.PERMISSION_DENIED) msg = 'GPS permission denied (optional)';
            else if (error.code === error.POSITION_UNAVAILABLE) msg = 'GPS unavailable (optional)';
            else if (error.code === error.TIMEOUT) msg = 'GPS timed out (optional)';
            if (statusText) statusText.textContent = msg;
        },
        { enableHighAccuracy: true, timeout: 120000, maximumAge: 0 }
    );
}

// ============================================
// DRAFT MANAGEMENT
// ============================================
function showDraftNameModal() {
    const modal = document.getElementById('draftNameModal');
    const input = document.getElementById('draftNameInput');
    if (state.currentDraftName) input.value = state.currentDraftName;
    else {
        const schoolName = document.querySelector('[name="school_name"]')?.value || '';
        input.value = schoolName || 'Unnamed Draft';
    }
    modal.classList.add('show');
    input.focus();
    input.select();
}

function cancelDraftName() { document.getElementById('draftNameModal').classList.remove('show'); }

function confirmSaveDraft() {
    const draftName = document.getElementById('draftNameInput').value.trim();
    if (!draftName) { showNotification('Please enter a name for the draft', 'warning'); return; }
    cancelDraftName();
    saveAsDraft(draftName);
}

function saveAsDraft(draftName) {
    const formData = new FormData(document.getElementById('dataForm'));
    const data = {
        draftId: state.currentDraftId || generateDraftId(),
        draftName, savedAt: new Date().toISOString(), savedBy: 'surveyor',
        formStatus: 'draft', currentSection: state.currentSection
    };

    for (const [key, value] of formData.entries()) data[key] = value;

    const checkboxGroups = {};
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (cb.checked) { if (!checkboxGroups[cb.name]) checkboxGroups[cb.name] = []; checkboxGroups[cb.name].push(cb.value); }
    });
    for (const [key, values] of Object.entries(checkboxGroups)) data[key] = values.join(', ');

    Object.keys(state.signaturePads).forEach(fn => {
        const pad = state.signaturePads[fn];
        if (pad && !pad.isEmpty()) data[fn] = pad.toDataURL();
    });

    const existingIndex = state.drafts.findIndex(d => d.draftId === data.draftId);
    if (existingIndex !== -1) state.drafts[existingIndex] = data;
    else state.drafts.push(data);

    localStorage.setItem('formDrafts_itn', JSON.stringify(state.drafts));
    state.currentDraftId = data.draftId;
    state.currentDraftName = draftName;
    document.getElementById('draft_id').value = data.draftId;
    updateDraftCount();
    showNotification(`Draft "${draftName}" saved successfully!`, 'success');
}

function generateDraftId() { return 'draft_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9); }

function openDraftsModal() {
    const modal = document.getElementById('draftsModal');
    const modalBody = document.getElementById('draftsModalBody');

    if (state.drafts.length === 0) {
        modalBody.innerHTML = '<div class="no-drafts">No saved drafts</div>';
    } else {
        const sorted = [...state.drafts].sort((a, b) => new Date(b.savedAt) - new Date(a.savedAt));
        modalBody.innerHTML = sorted.map(draft => `
            <div class="draft-item">
                <div class="draft-item-header">
                    <div>
                        <div class="draft-item-title">${draft.draftName || 'Unnamed Draft'}</div>
                        ${draft.school_name ? `<div class="draft-item-subtitle">School: ${draft.school_name}</div>` : ''}
                        ${draft.district ? `<div class="draft-item-subtitle">District: ${draft.district}</div>` : ''}
                    </div>
                    <div class="draft-item-date">Saved: ${new Date(draft.savedAt).toLocaleString()}</div>
                </div>
                <div class="draft-item-actions">
                    <button class="draft-action-btn load" onclick="loadDraft('${draft.draftId}')">📂 LOAD</button>
                    <button class="draft-action-btn delete" onclick="deleteDraft('${draft.draftId}')">🗑️ DELETE</button>
                </div>
            </div>
        `).join('');
    }
    modal.classList.add('show');
}

function closeDraftsModal() { document.getElementById('draftsModal').classList.remove('show'); }

function loadDraft(draftId) {
    const draft = state.drafts.find(d => d.draftId === draftId);
    if (!draft) { showNotification('Draft not found', 'error'); return; }

    clearForm(false);
    state.currentDraftId = draftId;
    state.currentDraftName = draft.draftName;
    state.formStatus = draft.formStatus || 'draft';
    document.getElementById('draft_id').value = draftId;
    document.getElementById('form_status').value = state.formStatus;

    // Load cascading fields in correct order
    const cascadeOrder = ['district', 'chiefdom', 'section', 'facility'];
    cascadeOrder.forEach(fieldName => {
        if (draft[fieldName]) {
            const select = document.getElementById(fieldName);
            if (select) {
                // Trigger change on parent to populate options
                if (fieldName !== 'district') {
                    const parentMap = { chiefdom: 'district', section: 'chiefdom', facility: 'section' };
                    const parent = document.getElementById(parentMap[fieldName]);
                    if (parent) parent.dispatchEvent(new Event('change'));
                }
                // Small delay to let options populate
                setTimeout(() => {
                    select.value = draft[fieldName];
                    select.dispatchEvent(new Event('change'));
                }, 50 * cascadeOrder.indexOf(fieldName));
            }
        }
    });

    // Load other fields
    setTimeout(() => {
        Object.keys(draft).forEach(key => {
            if (['draftId', 'draftName', 'savedAt', 'savedBy', 'formStatus', 'currentSection', ...cascadeOrder].includes(key)) return;

            const field = document.querySelector(`[name="${key}"]`);
            if (field) {
                if (field.type === 'hidden' && key.includes('signature')) {
                    const canvas = document.getElementById(`${key}_canvas`);
                    if (canvas && draft[key]) {
                        const pad = state.signaturePads[key];
                        if (pad) {
                            const img = new Image();
                            img.onload = () => { canvas.getContext('2d').drawImage(img, 0, 0); };
                            img.src = draft[key];
                            field.value = draft[key];
                        }
                    }
                } else if (field.type === 'radio') {
                    const radio = document.querySelector(`input[name="${key}"][value="${draft[key]}"]`);
                    if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change')); }
                } else if (field.type === 'checkbox') {
                    if (draft[key]) {
                        draft[key].split(', ').forEach(val => {
                            const cb = document.querySelector(`input[name="${key}"][value="${val}"]`);
                            if (cb) cb.checked = true;
                        });
                    }
                } else {
                    field.value = draft[key];
                }
            }
        });

        if (draft.currentSection) {
            document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
            state.currentSection = draft.currentSection;
            const target = document.querySelector(`.form-section[data-section="${draft.currentSection}"]`);
            if (target) target.classList.add('active');
        }

        updateProgress();
        updateSubmitButton();
    }, 300);

    closeDraftsModal();
    showNotification(`Draft "${draft.draftName}" loaded successfully!`, 'success');
}

function deleteDraft(draftId) {
    const draft = state.drafts.find(d => d.draftId === draftId);
    if (!confirm(`Delete "${draft ? draft.draftName : 'this draft'}"?`)) return;
    state.drafts = state.drafts.filter(d => d.draftId !== draftId);
    localStorage.setItem('formDrafts_itn', JSON.stringify(state.drafts));
    if (state.currentDraftId === draftId) { state.currentDraftId = null; state.currentDraftName = null; document.getElementById('draft_id').value = ''; }
    updateDraftCount();
    openDraftsModal();
    showNotification('Draft deleted', 'info');
}

// ============================================
// FINALIZE & SUBMIT
// ============================================
function finalizeForm() {
    let isValid = true;
    let firstInvalidSection = null;

    document.querySelectorAll('.form-section').forEach((section, index) => {
        section.querySelectorAll('input[required], select[required], textarea[required]').forEach(input => {
            const parentGroup = input.closest('.conditional-field');
            if (parentGroup && !parentGroup.classList.contains('show')) return;

            if (input.type === 'radio') {
                const isChecked = Array.from(section.querySelectorAll(`input[name="${input.name}"]`)).some(r => r.checked);
                if (!isChecked && firstInvalidSection === null) { isValid = false; firstInvalidSection = index + 1; }
            } else if (!input.value) {
                isValid = false;
                input.classList.add('error');
                if (firstInvalidSection === null) firstInvalidSection = index + 1;
            }
        });
    });

    if (!isValid) {
        showNotification(`Please complete all required fields. Check Section ${firstInvalidSection}`, 'error');
        document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
        state.currentSection = firstInvalidSection;
        document.querySelector(`.form-section[data-section="${firstInvalidSection}"]`).classList.add('active');
        updateProgress();
        return;
    }

    state.formStatus = 'finalized';
    document.getElementById('form_status').value = 'finalized';
    updateProgress();
    updateSubmitButton();
    if (state.currentDraftName) saveAsDraft(state.currentDraftName);
    else showDraftNameModal();
    showNotification('Form finalized! You can now submit.', 'success');
}

function updateSubmitButton() {
    const submitBtn = document.getElementById('submitBtn');
    const finalizeBtn = document.getElementById('finalizeBtn');
    if (state.formStatus === 'finalized') {
        submitBtn.disabled = false;
        finalizeBtn.disabled = true;
        finalizeBtn.textContent = '✓ FINALIZED';
    } else {
        submitBtn.disabled = true;
        finalizeBtn.disabled = false;
        finalizeBtn.textContent = '✓ FINALIZE';
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    if (state.formStatus !== 'finalized') { showNotification('Please finalize the form before submitting', 'warning'); return; }

    const formData = new FormData(e.target);
    const data = { timestamp: new Date().toISOString(), submittedBy: 'surveyor', form_status: 'submitted' };
    for (const [key, value] of formData.entries()) data[key] = value;

    const checkboxGroups = {};
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (cb.checked) { if (!checkboxGroups[cb.name]) checkboxGroups[cb.name] = []; checkboxGroups[cb.name].push(cb.value); }
    });
    for (const [key, values] of Object.entries(checkboxGroups)) data[key] = values.join(', ');

    if (state.isOnline) await submitToServer(data);
    else saveOffline(data);
}

async function submitToServer(data) {
    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'SUBMITTING...';
    try {
        await fetch(CONFIG.SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
        if (state.currentDraftId) {
            state.drafts = state.drafts.filter(d => d.draftId !== state.currentDraftId);
            localStorage.setItem('formDrafts_itn', JSON.stringify(state.drafts));
            updateDraftCount();
        }
        showNotification('Data submitted successfully!', 'success');
        clearForm(true);
    } catch (error) {
        console.error('Submit error:', error);
        showNotification('Failed to submit - Saved offline', 'error');
        saveOffline(data);
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = '📤 SUBMIT';
    }
}

function saveOffline(data) {
    state.pendingSubmissions.push(data);
    localStorage.setItem('pendingSubmissions_itn', JSON.stringify(state.pendingSubmissions));
    if (state.currentDraftId) {
        state.drafts = state.drafts.filter(d => d.draftId !== state.currentDraftId);
        localStorage.setItem('formDrafts_itn', JSON.stringify(state.drafts));
        updateDraftCount();
    }
    updatePendingCount();
    showNotification('Data saved offline - Will sync when online', 'info');
    clearForm(true);
}

async function syncPendingSubmissions() {
    if (state.pendingSubmissions.length === 0) return;
    showNotification('Syncing pending submissions...', 'info');
    const synced = [];
    for (let i = 0; i < state.pendingSubmissions.length; i++) {
        try {
            await fetch(CONFIG.SCRIPT_URL, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state.pendingSubmissions[i]) });
            synced.push(i);
        } catch (e) { console.error('Sync error:', e); }
    }
    if (synced.length > 0) {
        state.pendingSubmissions = state.pendingSubmissions.filter((_, i) => !synced.includes(i));
        localStorage.setItem('pendingSubmissions_itn', JSON.stringify(state.pendingSubmissions));
        updatePendingCount();
        showNotification(`Synced ${synced.length} submission(s)`, 'success');
    }
}

function clearForm(resetStatus = true) {
    document.getElementById('dataForm').reset();
    Object.keys(state.signaturePads).forEach(fn => clearSignature(fn));
    document.querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);

    // Reset cascading dropdowns
    ['chiefdom', 'section', 'facility'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.innerHTML = `<option value="">Select...</option>`; el.disabled = true; }
    });
    clearCascadeCount('chiefdom');
    clearCascadeCount('section');
    clearCascadeCount('facility');

    document.querySelectorAll('.conditional-field').forEach(f => f.classList.remove('show'));

    state.gpsLocation = null;
    state.gpsAttempted = false;
    const gpsIcon = document.getElementById('gps_icon');
    const gpsStatus = document.getElementById('gps_status');
    const gpsCoords = document.getElementById('gps_coords');
    if (gpsIcon) gpsIcon.className = 'gps-icon';
    if (gpsStatus) gpsStatus.textContent = 'Automatically capturing GPS location...';
    if (gpsCoords) gpsCoords.textContent = '';
    ['gps_latitude', 'gps_longitude', 'gps_accuracy', 'gps_timestamp'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    if (resetStatus) {
        state.formStatus = 'draft';
        state.currentDraftId = null;
        state.currentDraftName = null;
        document.getElementById('form_status').value = 'draft';
        document.getElementById('draft_id').value = '';
    }

    state.currentSection = 1;
    document.querySelectorAll('.form-section').forEach(s => s.classList.remove('active'));
    const s1 = document.querySelector('.form-section[data-section="1"]');
    if (s1) s1.classList.add('active');
    updateProgress();
    updateSubmitButton();
    window.scrollTo({ top: 0, behavior: 'smooth' });
    setTimeout(() => { initializeSignaturePads(); captureGPSAutomatically(); }, 100);
}

function showNotification(message, type) {
    const notification = document.getElementById('notification');
    const text = document.getElementById('notificationText');
    notification.className = `notification ${type} show`;
    text.textContent = message;
    setTimeout(() => { notification.classList.remove('show'); }, type === 'error' && message.length > 100 ? 8000 : 4000);
}

// ============================================
// SIGNATURE PAD
// ============================================
function initializeSignaturePads() {
    document.querySelectorAll('.signature-canvas').forEach(canvas => {
        const fieldName = canvas.getAttribute('data-field');
        const container = canvas.parentElement;
        canvas.width = container.offsetWidth - 20;
        canvas.height = 150;
        const pad = new SignaturePad(canvas, { backgroundColor: 'rgb(255, 255, 255)', penColor: 'rgb(0, 0, 0)', minWidth: 1, maxWidth: 3 });
        state.signaturePads[fieldName] = pad;
        pad.addEventListener('endStroke', () => { const hi = document.getElementById(fieldName); if (hi) hi.value = pad.toDataURL(); });
    });
}

function clearSignature(fieldName) {
    const pad = state.signaturePads[fieldName];
    if (pad) { pad.clear(); const hi = document.getElementById(fieldName); if (hi) hi.value = ''; }
}

window.addEventListener('resize', () => {
    Object.keys(state.signaturePads).forEach(fn => {
        const canvas = document.getElementById(`${fn}_canvas`);
        if (canvas && canvas.parentElement) {
            const pad = state.signaturePads[fn];
            const data = pad.toData();
            canvas.width = canvas.parentElement.offsetWidth - 20;
            canvas.height = 150;
            pad.fromData(data);
        }
    });
});

// ============================================
// ANALYSIS DASHBOARD
// ============================================
async function openAnalysisModal() {
    if (!checkAdminLogin()) return;
    const modal = document.getElementById('analysisModal');
    const body = document.getElementById('analysisBody');
    modal.classList.add('show');
    body.innerHTML = '<div class="analysis-loading"><p>Loading analysis data...</p></div>';

    try {
        const response = await fetch(CONFIG.SCRIPT_URL + '?action=getAnalysis', { method: 'GET' });
        const data = await response.json();
        if (data.status === 'success') renderAnalysisDashboard(data.data);
        else throw new Error(data.message || 'Failed to load data');
    } catch (error) {
        body.innerHTML = `<div class="analysis-error"><p>⚠️ Unable to load analysis data</p><p style="font-size:12px;margin-top:10px;">${error.message}</p></div>`;
    }
}

function closeAnalysisModal() { document.getElementById('analysisModal').classList.remove('show'); }

function renderAnalysisDashboard(data) {
    const body = document.getElementById('analysisBody');
    body.innerHTML = `
        <div class="dashboard-grid">
            <div class="stat-card"><div class="stat-label">TOTAL SCHOOLS</div><div class="stat-value">${data.totalSubmissions || 0}</div><div class="stat-sublabel">Schools surveyed</div></div>
            <div class="stat-card"><div class="stat-label">TOTAL STUDENTS</div><div class="stat-value">${(data.totalEnrollment || 0).toLocaleString()}</div><div class="stat-sublabel">Across all schools</div></div>
            <div class="stat-card"><div class="stat-label">ITNs DISTRIBUTED</div><div class="stat-value">${(data.totalITNsDistributed || 0).toLocaleString()}</div><div class="stat-sublabel">Nets given out</div></div>
            <div class="stat-card"><div class="stat-label">COVERAGE RATE</div><div class="stat-value">${data.coverageRate || 0}%</div><div class="stat-sublabel">ITNs / eligible students</div></div>
        </div>
        <div class="chart-container"><div class="chart-title">🏫 SCHOOL TYPE DISTRIBUTION</div><canvas id="schoolTypeChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">📍 DISTRICT DISTRIBUTION</div><canvas id="districtChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">👥 STUDENT ENROLLMENT BY GENDER</div><canvas id="genderChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">🛏️ ITN DISTRIBUTION BY GENDER</div><canvas id="itnGenderChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">📦 SOURCE OF ITNs</div><canvas id="itnSourceChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">✅ SUFFICIENCY OF ITN SUPPLY</div><canvas id="sufficiencyChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">🚧 CHALLENGES ENCOUNTERED</div><canvas id="challengesChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">⭐ OVERALL RATING</div><canvas id="ratingChart" class="chart-canvas"></canvas></div>
        <div class="chart-container"><div class="chart-title">📊 COMPREHENSIVE OVERVIEW</div><canvas id="comprehensiveChart" class="chart-canvas"></canvas></div>
    `;

    setTimeout(() => {
        if (data.schoolTypes) renderChart('schoolTypeChart', 'bar', data.schoolTypes, '#004080');
        if (data.districts) renderChart('districtChart', 'bar', data.districts, '#17a2b8', true);
        if (data.totalMaleStudents !== undefined) renderPie('genderChart', { Male: data.totalMaleStudents, Female: data.totalFemaleStudents });
        if (data.itnsMale !== undefined) renderPie('itnGenderChart', { 'Males': data.itnsMale, 'Females': data.itnsFemale });
        if (data.itnSource) renderDoughnut('itnSourceChart', data.itnSource);
        if (data.sufficientITNs) renderPie('sufficiencyChart', data.sufficientITNs);
        if (data.challenges) renderChart('challengesChart', 'bar', data.challenges, '#dc3545', true);
        if (data.overallRating) renderPolar('ratingChart', data.overallRating);
        if (data.totalEnrollment !== undefined) {
            renderChart('comprehensiveChart', 'bar', {
                'Enrolled': data.totalEnrollment || 0,
                'Eligible': data.totalEligible || 0,
                'Present': data.totalPresent || 0,
                'ITNs Received': data.totalITNsReceived || 0,
                'ITNs Distributed': data.totalITNsDistributed || 0,
                'Remaining': data.totalITNsRemaining || 0
            }, ['#004080', '#0056b3', '#17a2b8', '#28a745', '#ffc107', '#dc3545']);
        }
    }, 100);
}

function renderChart(id, type, d, color, horizontal) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    const colors = Array.isArray(color) ? color : Object.keys(d).map(() => color);
    new Chart(ctx, {
        type, data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: colors, borderWidth: 1 }] },
        options: { responsive: true, maintainAspectRatio: true, indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: false } }, scales: { [horizontal ? 'x' : 'y']: { beginAtZero: true, ticks: { stepSize: 1 } } } }
    });
}

function renderPie(id, d) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    new Chart(ctx, { type: 'pie', data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ['#004080', '#dc3545', '#28a745', '#ffc107', '#17a2b8'], borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, plugins: { legend: { position: 'bottom' } } } });
}

function renderDoughnut(id, d) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    new Chart(ctx, { type: 'doughnut', data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ['#004080', '#0056b3', '#17a2b8', '#28a745', '#ffc107', '#dc3545', '#6f42c1'], borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, plugins: { legend: { position: 'right' } } } });
}

function renderPolar(id, d) {
    const ctx = document.getElementById(id);
    if (!ctx) return;
    new Chart(ctx, { type: 'polarArea', data: { labels: Object.keys(d), datasets: [{ data: Object.values(d), backgroundColor: ['#28a745', '#5cb85c', '#ffc107', '#fd7e14', '#dc3545'], borderWidth: 2, borderColor: '#fff' }] }, options: { responsive: true, plugins: { legend: { position: 'right' } } } });
}

// Close modals on overlay click
document.getElementById('draftsModal').addEventListener('click', function(e) { if (e.target === this) closeDraftsModal(); });
document.getElementById('draftNameModal').addEventListener('click', function(e) { if (e.target === this) cancelDraftName(); });
document.getElementById('analysisModal').addEventListener('click', function(e) { if (e.target === this) closeAnalysisModal(); });

// Initialize
init();
