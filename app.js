const WORKOUT_DAYS = {
    1: { name: "Push + Glutes", exercises: ["Bench Press","Incline DB Press","Cable Fly","Hip Thrust","Overhead Press","Lateral Raise","Overhead Tricep Extension","Face Pulls"] },
    2: { name: "Pull + Legs", exercises: ["Barbell Row","Lat Pulldown","Seated Cable Row","Walking Lunges","Single Arm DB Row","Face Pulls","Barbell Curl","Rear Delt Fly"] },
    3: { name: "Legs + Arms", exercises: ["Back Squat","Leg Press","Bulgarian Split Squat","Hammer Curl","Leg Extension","Hip Abduction","Standing Calf Raise","Seated Calf Raise"] },
    4: { name: "Posterior Chain + Triceps", exercises: ["Deadlift","Romanian Deadlift","Tricep Pushdown","Good Mornings","Leg Curl","Cable Pull-Through","Back Extension","Reverse Hyperextension"] },
    5: { name: "Shoulders & Arms + Carries", exercises: ["Overhead Press","Arnold Press","Farmer's Carry","Rear Delt Fly","Barbell Curl","Hammer Curl","Skull Crushers","Tricep Dips"] },
    6: { name: "Full Body + Shoulder Isolation", exercises: ["Pull-Ups","Front Squat","Push Press","Lateral Raise","Pendlay Row","Goblet Squat","Ab Wheel Rollout","Pallof Press"] }
};

const FOCUS_LABELS  = { 1:"1 — Very Low",2:"2 — Low",3:"3 — Low",4:"4 — Moderate",5:"5 — Good",6:"6 — Good",7:"7 — High",8:"8 — High",9:"9 — Peak",10:"10 — Peak" };
const ENERGY_LABELS = { 1:"1 — Drained",2:"2 — Tired",3:"3 — Low",4:"4 — Okay",5:"5 — Okay",6:"6 — Good",7:"7 — Good",8:"8 — Energized",9:"9 — Energized",10:"10 — Peak" };

let currentDay = 1;
let statsDay   = 1;
let volumeChart = null;
let liftChart   = null;
let isViewOnly  = false;

// ── JSONBin Cloud Sync ────────────────────────────────
const JSONBIN_BIN_ID  = '6a2d691ada38895dfeba5451';
const JSONBIN_API_KEY = '$2a$10$f4VXQRC9w/7slqzM33xbHuCBuYX.9HDxFMgZ4g7dkQ3U9oStRiTr6';

async function loadFromCloud() {
    try {
        const res = await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}/latest`, {
            headers: { 'X-Master-Key': JSONBIN_API_KEY }
        });
        if (!res.ok) return;
        const json  = await res.json();
        const cloud = json.record;
        if (cloud.strengthTrackerData) localStorage.setItem('strengthTrackerData', JSON.stringify(cloud.strengthTrackerData));
        if (cloud.warmupValues)        localStorage.setItem('warmupValues',         JSON.stringify(cloud.warmupValues));
        if (cloud.workoutStats)        localStorage.setItem('workoutStats',         JSON.stringify(cloud.workoutStats));
        if (cloud.goalsData)           localStorage.setItem('goalsData',            JSON.stringify(cloud.goalsData));
        if (cloud.redLightData)        localStorage.setItem('redLightData',         JSON.stringify(cloud.redLightData));
        if (cloud.prLog)               localStorage.setItem('prLog',                JSON.stringify(cloud.prLog));
    } catch (e) {
        console.warn('Cloud load failed, using local data', e);
    }
}

async function saveToCloud() {
    try {
        await fetch(`https://api.jsonbin.io/v3/b/${JSONBIN_BIN_ID}`, {
            method:  'PUT',
            headers: { 'Content-Type': 'application/json', 'X-Master-Key': JSONBIN_API_KEY },
            body:    JSON.stringify({
                strengthTrackerData: JSON.parse(localStorage.getItem('strengthTrackerData') || '{"workouts":[]}'),
                warmupValues:        JSON.parse(localStorage.getItem('warmupValues')         || '{}'),
                workoutStats:        JSON.parse(localStorage.getItem('workoutStats')         || '{"sessions":[]}'),
                goalsData:           JSON.parse(localStorage.getItem('goalsData')            || '[]'),
                redLightData:        JSON.parse(localStorage.getItem('redLightData')         || '[]'),
                prLog:               JSON.parse(localStorage.getItem('prLog')                || '[]')
            })
        });
    } catch (e) {
        console.warn('Cloud save failed', e);
    }
}

// ── Startup ───────────────────────────────────────────

window.addEventListener('load', async function () {
    const params = new URLSearchParams(window.location.search);
    if (params.has('view')) {
        isViewOnly = true;
        const encoded = params.get('d');
        if (encoded) {
            try { window._sharedData = JSON.parse(LZString.decompressFromEncodedURIComponent(encoded)); }
            catch (e) { window._sharedData = { workouts: [] }; }
        }
        enterViewMode();
    } else {
        await loadFromCloud();
        checkAuth();
    }
});

// ── Auth ──────────────────────────────────────────────

function checkAuth() {
    const hasPw   = !!localStorage.getItem('adminPwHash');
    const isAuthed = !!sessionStorage.getItem('authenticated');
    if (!hasPw) {
        show('screen-set'); hide('screen-login');
    } else if (!isAuthed) {
        hide('screen-set'); show('screen-login');
    } else {
        hide('auth-overlay'); bootApp();
    }
}

function setPassword() {
    const pw = document.getElementById('set-pw').value.trim();
    const c  = document.getElementById('set-pw-confirm').value.trim();
    const err = document.getElementById('set-error');
    if (pw.length < 4) { err.textContent = 'At least 4 characters required.'; return; }
    if (pw !== c)      { err.textContent = 'Passwords do not match.'; return; }
    localStorage.setItem('adminPwHash', hashPassword(pw));
    sessionStorage.setItem('authenticated', '1');
    hide('auth-overlay'); bootApp();
}

function login() {
    const pw  = document.getElementById('login-pw').value;
    const err = document.getElementById('login-error');
    if (hashPassword(pw) !== localStorage.getItem('adminPwHash')) {
        err.textContent = 'Incorrect password.';
        document.getElementById('login-pw').value = '';
        return;
    }
    sessionStorage.setItem('authenticated', '1');
    hide('auth-overlay'); bootApp();
}

function logout() { sessionStorage.removeItem('authenticated'); location.reload(); }

function hashPassword(pw) {
    const s = pw + 'st-app-salt';
    let h = 0;
    for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
    return Math.abs(h).toString(36);
}

// ── View-Only ─────────────────────────────────────────

function enterViewMode() {
    hide('auth-overlay');
    show('view-banner');
    bootApp();
    document.querySelectorAll('input, textarea, select, button.tab').forEach(el => {
        if (el.id !== 'exercise-select' && el.id !== 'goal-exercise') el.disabled = true;
    });
    document.getElementById('exercise-select').disabled = false;
    if (document.getElementById('goal-exercise')) document.getElementById('goal-exercise').disabled = false;
    hide('save-btn');
}

// ── Boot ──────────────────────────────────────────────

function bootApp() {
    document.getElementById('current-date').textContent = new Date().toLocaleDateString('en-US', {
        weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });
    if (!isViewOnly) {
        loadWarmupValues();
        document.getElementById('warmup-row').addEventListener('change', saveWarmupValues);
        document.getElementById('warmup-sled').addEventListener('change', saveWarmupValues);
        show('share-btn'); show('logout-btn'); show('summary-btn');
    }
    populateExerciseSelects();
    renderWorkout(1);
    updateStreakDisplay();
}

// ── Helpers ───────────────────────────────────────────

function show(id) { const el = document.getElementById(id); if (el) el.style.display = ''; }
function hide(id) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }

// ── Warmup ────────────────────────────────────────────

function loadWarmupValues() {
    const s = JSON.parse(localStorage.getItem('warmupValues') || '{}');
    document.getElementById('warmup-row').value  = s.row  || 10;
    document.getElementById('warmup-sled').value = s.sled || 90;
}
function saveWarmupValues() {
    localStorage.setItem('warmupValues', JSON.stringify({
        row:  document.getElementById('warmup-row').value,
        sled: document.getElementById('warmup-sled').value
    }));
    saveToCloud();
}

// ── Page Navigation ───────────────────────────────────

function showPage(name) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('page-' + name).classList.add('active');
    document.querySelector('[data-page="' + name + '"]').classList.add('active');
    if (name === 'volume')  renderVolumePage();
    if (name === 'bylift')  updateLiftPage();
    if (name === 'stats')   renderStatsPage();
    if (name === 'goals')   renderGoalsPage();
    if (name === 'redlight') renderRedLightPage();
}

// ── Streak ────────────────────────────────────────────

function calculateStreak() {
    const data  = loadData();
    if (!data.workouts.length) return 0;
    const dates = [...new Set(data.workouts.map(w => w.date))].sort();
    const today = new Date().toISOString().split('T')[0];
    const yest  = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    if (!dates.includes(today) && !dates.includes(yest)) return 0;
    let streak = 0;
    let check  = dates.includes(today) ? new Date() : new Date(Date.now() - 86400000);
    while (true) {
        const d = check.toISOString().split('T')[0];
        if (dates.includes(d)) { streak++; check = new Date(check.getTime() - 86400000); }
        else break;
    }
    return streak;
}

function updateStreakDisplay() {
    const s = calculateStreak();
    const badge = document.getElementById('streak-badge');
    if (s > 0) {
        document.getElementById('streak-count').textContent = s;
        badge.style.display = 'block';
    } else {
        badge.style.display = 'none';
    }
}

// ── Workout Page ──────────────────────────────────────

function selectDay(day) {
    currentDay = day;
    document.querySelectorAll('.day-tabs .tab').forEach((t, i) => t.classList.toggle('active', i + 1 === day));
    renderWorkout(day);
}

function renderWorkout(day) {
    const dayData = WORKOUT_DAYS[day];
    document.getElementById('day-label').textContent = `Day ${day} — ${dayData.name}`;
    const section = document.getElementById('workout-section');
    section.innerHTML = '';

    dayData.exercises.forEach(exercise => {
        const lastWeights  = getLastValues(exercise, 'weight');
        const lastReps     = getLastValues(exercise, 'reps');
        const lastNotes    = getLastNotes(exercise);
        const suggestion   = getOverloadSuggestion(exercise);
        const notesOpen    = lastNotes ? 'open' : '';
        const notesDisplay = lastNotes ? 'block' : 'none';
        const dis          = isViewOnly ? 'disabled' : '';

        let setsHTML = '';
        for (let s = 0; s < 4; s++) {
            setsHTML += `<div class="set-row">
                <span class="set-label">Set ${s + 1}</span>
                <div class="set-inputs">
                    <div>
                        <input type="number" class="reps-input" placeholder="Reps" min="1" max="30" value="${lastReps[s] || 8}" ${dis}>
                        <div class="input-label">reps</div>
                    </div>
                    <div>
                        <input type="number" class="weight-input" placeholder="0" min="0" step="2.5" ${lastWeights[s] ? `value="${lastWeights[s]}"` : ''} ${dis}>
                        <div class="input-label">lbs</div>
                    </div>
                </div>
            </div>`;
        }

        const hintHTML = suggestion
            ? `<div class="overload-hint">&#128161; Ready to increase — try ${suggestion} lbs</div>`
            : '';

        const card = document.createElement('div');
        card.className = 'exercise-card';
        card.innerHTML = `
            <div class="exercise-header">
                <div>
                    <h3>${exercise}</h3>
                    ${hintHTML}
                </div>
                <button class="complete-btn" onclick="toggleComplete(this)" title="Mark complete">&#10003;</button>
            </div>
            <div class="sets-container">${setsHTML}</div>
            <div class="notes-section">
                <button class="notes-toggle ${notesOpen}" onclick="toggleNotes(this)">
                    <span class="notes-caret">&#9658;</span> Notes
                </button>
                <textarea class="notes-area" placeholder="Add notes..." ${dis} style="display:${notesDisplay}">${lastNotes}</textarea>
            </div>`;
        section.appendChild(card);
    });
}

function getLastValues(name, field) {
    const data  = loadData();
    const match = data.workouts.filter(w => w.exercises.some(e => e.name === name))
                               .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!match) return [];
    const ex = match.exercises.find(e => e.name === name);
    return ex ? ex.sets.map(s => s[field]) : [];
}

function getLastNotes(name) {
    const data  = loadData();
    const match = data.workouts.filter(w => w.exercises.some(e => e.name === name))
                               .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
    if (!match) return '';
    const ex = match.exercises.find(e => e.name === name);
    return ex ? (ex.notes || '') : '';
}

function toggleComplete(btn) {
    const card = btn.closest('.exercise-card');
    card.classList.toggle('completed');
    btn.classList.toggle('done');
}

function toggleNotes(btn) {
    btn.classList.toggle('open');
    const area = btn.nextElementSibling;
    area.style.display = area.style.display === 'block' ? 'none' : 'block';
}

// ── Progressive Overload Suggestions ─────────────────

function getOverloadSuggestion(name) {
    const data    = loadData();
    const recent  = data.workouts
        .filter(w => w.exercises.some(e => e.name === name))
        .sort((a, b) => new Date(b.date) - new Date(a.date))
        .slice(0, 3);
    if (recent.length < 3) return null;
    const allHit = recent.every(w => {
        const ex = w.exercises.find(e => e.name === name);
        return ex && ex.sets.every(s => s.reps >= 8);
    });
    if (!allHit) return null;
    const ex = recent[0].exercises.find(e => e.name === name);
    return Math.max(...ex.sets.map(s => s.weight)) + 5;
}

// ── Save Workout & PR Detection ───────────────────────

function saveWorkout() {
    if (isViewOnly) return;
    const dayData  = WORKOUT_DAYS[currentDay];
    const exercises = [];
    document.querySelectorAll('.exercise-card').forEach((card, i) => {
        const sets = [];
        card.querySelectorAll('.set-row').forEach(row => {
            sets.push({
                reps:   parseInt(row.querySelector('.reps-input').value)    || 8,
                weight: parseFloat(row.querySelector('.weight-input').value) || 0
            });
        });
        const notes = card.querySelector('.notes-area').value.trim();
        exercises.push({ name: dayData.exercises[i], sets, notes });
    });

    const data  = loadData();
    const today = new Date().toISOString().split('T')[0];

    // Detect PRs before saving today's data
    const prs = detectPRs(exercises, today, data);

    const idx = data.workouts.findIndex(w => w.date === today && w.day === currentDay);
    const workout = { date: today, day: currentDay, exercises };
    if (idx >= 0) data.workouts[idx] = workout; else data.workouts.push(workout);
    saveData(data);

    // Store PR records
    if (prs.length > 0) storePRs(prs, today);

    flashSaveButton();
    updateStreakDisplay();

    if (prs.length > 0) showPRModal(prs);
}

function detectPRs(exercises, today, data) {
    return exercises.reduce((prs, ex) => {
        const pastMax = data.workouts
            .filter(w => w.date !== today)
            .flatMap(w => w.exercises)
            .filter(e => e.name === ex.name)
            .flatMap(e => e.sets)
            .reduce((m, s) => Math.max(m, s.weight), 0);
        const todayMax = Math.max(...ex.sets.map(s => s.weight));
        if (todayMax > pastMax && todayMax > 0) prs.push({ name: ex.name, weight: todayMax, previous: pastMax });
        return prs;
    }, []);
}

function storePRs(prs, date) {
    const stored = JSON.parse(localStorage.getItem('prLog') || '[]');
    prs.forEach(pr => stored.push({ ...pr, date }));
    localStorage.setItem('prLog', JSON.stringify(stored));
    saveToCloud();
}

function showPRModal(prs) {
    document.getElementById('pr-list').innerHTML = prs.map(pr => `
        <div class="pr-item">
            <div class="pr-name">${pr.name}</div>
            <div class="pr-weight">${pr.weight} lbs ${pr.previous > 0 ? `<span style="color:#666">(prev: ${pr.previous} lbs)</span>` : '(first time!)'}</div>
        </div>`).join('');
    show('pr-modal');
}
function closePRModal() { hide('pr-modal'); }

function flashSaveButton() {
    const btn = document.querySelector('.save-btn');
    btn.textContent = 'Saved!'; btn.classList.add('saved');
    setTimeout(() => { btn.textContent = 'Save Workout'; btn.classList.remove('saved'); }, 2000);
}

// ── Share ─────────────────────────────────────────────

function generateShareLink() {
    const compressed = LZString.compressToEncodedURIComponent(JSON.stringify(loadData()));
    const url = `${window.location.origin}${window.location.pathname}?view=1&d=${compressed}`;
    navigator.clipboard.writeText(url).then(showToast).catch(() => window.prompt('Copy this link:', url));
}
function showToast() {
    const t = document.getElementById('share-toast');
    t.classList.add('show');
    setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Total Volume Page ─────────────────────────────────

function renderVolumePage() {
    const data     = loadData();
    const sessions = data.workouts.sort((a, b) => new Date(a.date) - new Date(b.date));
    const volumes  = sessions.map(w => w.exercises.reduce((t, ex) => t + ex.sets.reduce((s, set) => s + set.weight * set.reps, 0), 0));

    document.getElementById('volume-hint').style.display = sessions.length ? 'none' : 'block';
    const ctx = document.getElementById('volume-chart').getContext('2d');
    if (volumeChart) volumeChart.destroy();
    volumeChart = new Chart(ctx, {
        type: 'bar',
        data: { labels: sessions.map(w => w.date), datasets: [{ label: 'Total Volume (lbs)', data: volumes, backgroundColor: 'rgba(99,179,237,0.45)', borderColor: '#63b3ed', borderWidth: 2, borderRadius: 6 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#888' } } }, scales: { x: { ticks: { color: '#555' }, grid: { color: '#1e1e1e' } }, y: { ticks: { color: '#555' }, grid: { color: '#1e1e1e' }, title: { display: true, text: 'lbs', color: '#555' } } } }
    });

    const tbody = document.querySelector('#volume-table tbody');
    if (!sessions.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="5">No sessions logged yet.</td></tr>'; return; }
    tbody.innerHTML = sessions.slice().reverse().map((w, i) => {
        const vol = volumes[sessions.length - 1 - i];
        return `<tr><td>${w.date}</td><td>Day ${w.day}</td><td>${WORKOUT_DAYS[w.day].name}</td><td>${vol.toLocaleString()} lbs</td><td>${w.exercises.length}</td></tr>`;
    }).join('');
}

// ── By Lift Page ──────────────────────────────────────

function populateExerciseSelects() {
    const all = [];
    Object.values(WORKOUT_DAYS).forEach(d => d.exercises.forEach(e => { if (!all.includes(e)) all.push(e); }));
    all.sort();

    ['exercise-select', 'goal-exercise'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        el.innerHTML = id === 'goal-exercise' ? '<option value="">— Select Exercise —</option>' : '';
        all.forEach(ex => { const o = document.createElement('option'); o.value = ex; o.textContent = ex; el.appendChild(o); });
    });
}

function updateLiftPage() {
    const name = document.getElementById('exercise-select').value;
    if (!name) return;
    const data    = loadData();
    const prLog   = JSON.parse(localStorage.getItem('prLog') || '[]');
    const entries = data.workouts
        .filter(w => w.exercises.some(e => e.name === name))
        .sort((a, b) => new Date(a.date) - new Date(b.date))
        .map(w => ({ date: w.date, sets: w.exercises.find(e => e.name === name).sets }));

    document.getElementById('lift-table-title').textContent = name + ' — Set History';
    document.getElementById('lift-hint').style.display = entries.length ? 'none' : 'block';

    const colors = ['#e84393','#63b3ed','#68d391','#f6ad55'];
    const ctx = document.getElementById('lift-chart').getContext('2d');
    if (liftChart) liftChart.destroy();
    liftChart = new Chart(ctx, {
        type: 'line',
        data: { labels: entries.map(e => e.date), datasets: [0,1,2,3].map(s => ({ label: `Set ${s+1}`, data: entries.map(e => e.sets[s] ? e.sets[s].weight : null), borderColor: colors[s], backgroundColor: 'transparent', borderWidth: 2, pointBackgroundColor: colors[s], pointRadius: 4, tension: 0.3, spanGaps: true })) },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { labels: { color: '#888' } } }, scales: { x: { ticks: { color: '#555' }, grid: { color: '#1e1e1e' } }, y: { ticks: { color: '#555' }, grid: { color: '#1e1e1e' }, title: { display: true, text: 'Weight (lbs)', color: '#555' } } } }
    });

    const tbody = document.querySelector('#lift-table tbody');
    if (!entries.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="7">No data yet.</td></tr>'; return; }
    tbody.innerHTML = entries.slice().reverse().map(e => {
        const w = [0,1,2,3].map(s => e.sets[s] ? e.sets[s].weight : '—');
        const max = Math.max(...e.sets.map(s => s.weight));
        const isPR = prLog.some(p => p.date === e.date && p.name === name && p.weight === max);
        return `<tr><td>${e.date}</td><td>${w[0]}</td><td>${w[1]}</td><td>${w[2]}</td><td>${w[3]}</td><td class="max-cell">${max}</td><td>${isPR ? '<span class="pr-badge">PR</span>' : ''}</td></tr>`;
    }).join('');
}

// ── Session Stats Page ────────────────────────────────

function selectStatsDay(day) {
    statsDay = day;
    document.querySelectorAll('.stats-day-tabs .tab').forEach((t, i) => t.classList.toggle('active', i + 1 === day));
    loadStatsIntoForm();
}

function toggleWorkoutOther(sel) {
    const o = document.getElementById('stat-type-other');
    o.style.display = sel.value === 'Other' ? 'block' : 'none';
    if (sel.value !== 'Other') o.value = '';
}

function toggleMusicOther(sel) {
    const o = document.getElementById('stat-music-note');
    o.style.display = sel.value === 'SoundCloud' ? 'block' : 'none';
    if (sel.value !== 'SoundCloud') o.value = '';
}

function updateFocusDisplay(v)  { document.getElementById('focus-display').textContent  = FOCUS_LABELS[v]  || v; }
function updateEnergyDisplay(v) { document.getElementById('energy-display').textContent = ENERGY_LABELS[v] || v; }

function loadStatsIntoForm() {
    const today = new Date().toISOString().split('T')[0];
    const all   = loadStatsData();
    const ex    = all.sessions.find(s => s.date === today && s.day === statsDay) || {};

    document.getElementById('stat-time').value     = ex.time     || '';
    document.getElementById('stat-calories').value = ex.calories || '';
    document.getElementById('stat-hr').value       = ex.heartRate || '';
    document.getElementById('stat-sleep').value    = ex.sleep    || '';

    const presets = ['Strength Training','Yoga','Pilates','Run','Other',''];
    const t = ex.workoutType || '';
    document.getElementById('stat-type').value = presets.includes(t) ? t : 'Other';
    const tOther = document.getElementById('stat-type-other');
    tOther.style.display = !presets.includes(t) && t ? 'block' : 'none';
    tOther.value = !presets.includes(t) ? t : '';

    const musicPresets = ['Hip Hop / Rap','Rock / Metal','Electronic / EDM','Pop','R&B / Soul','Classical','Podcasts','SoundCloud','Silence',''];
    const m = ex.music || '';
    document.getElementById('stat-music').value = musicPresets.includes(m) ? m : '';
    const mNote = document.getElementById('stat-music-note');
    mNote.style.display = m === 'SoundCloud' ? 'block' : 'none';
    mNote.value = ex.musicNote || '';

    const focus  = ex.focusLevel  || 5;
    const energy = ex.energyLevel || 5;
    document.getElementById('stat-focus').value  = focus;
    document.getElementById('stat-energy').value = energy;
    updateFocusDisplay(focus);
    updateEnergyDisplay(energy);
}

function saveStats() {
    const today   = new Date().toISOString().split('T')[0];
    const typeVal = document.getElementById('stat-type').value;
    const entry   = {
        date:        today,
        day:         statsDay,
        time:        document.getElementById('stat-time').value || '0',
        calories:    document.getElementById('stat-calories').value || '0',
        heartRate:   document.getElementById('stat-hr').value || '0',
        sleep:       document.getElementById('stat-sleep').value || '0',
        focusLevel:  document.getElementById('stat-focus').value,
        energyLevel: document.getElementById('stat-energy').value,
        workoutType: typeVal === 'Other' ? (document.getElementById('stat-type-other').value.trim() || 'Other') : (typeVal || '—'),
        music:       document.getElementById('stat-music').value,
        musicNote:   document.getElementById('stat-music-note').value.trim()
    };
    const all = loadStatsData();
    const idx = all.sessions.findIndex(s => s.date === today && s.day === statsDay);
    if (idx >= 0) all.sessions[idx] = entry; else all.sessions.push(entry);
    saveStatsData(all);

    const btn = document.getElementById('stats-save-btn');
    btn.textContent = 'Saved!'; btn.classList.add('saved');
    setTimeout(() => { btn.textContent = 'Save Stats'; btn.classList.remove('saved'); }, 2000);

    renderStatsTable();
    renderMusicCorrelation();
}

function renderStatsPage() { loadStatsIntoForm(); renderStatsTable(); renderMusicCorrelation(); }

function renderStatsTable() {
    const all   = loadStatsData();
    const tbody = document.querySelector('#stats-table tbody');
    if (!all.sessions.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="10">No stats logged yet.</td></tr>'; return; }
    tbody.innerHTML = all.sessions.slice().sort((a,b) => new Date(b.date)-new Date(a.date)).map(s =>
        `<tr><td>${s.date}</td><td>Day ${s.day}</td><td>${s.time}m</td><td>${s.calories}</td><td>${s.heartRate}</td><td>${s.sleep}h</td><td>${FOCUS_LABELS[s.focusLevel]||s.focusLevel}</td><td>${ENERGY_LABELS[s.energyLevel]||s.energyLevel}</td><td>${s.music||'—'}${s.musicNote ? ' ('+s.musicNote+')' : ''}</td><td>${s.workoutType}</td></tr>`
    ).join('');
}

function renderMusicCorrelation() {
    const all     = loadStatsData();
    const workout = loadData();
    const byGenre = {};

    all.sessions.forEach(s => {
        const genre = s.music || 'None';
        if (!byGenre[genre]) byGenre[genre] = { count: 0, focus: 0, energy: 0, volume: 0 };
        const g = byGenre[genre];
        g.count++;
        g.focus  += parseInt(s.focusLevel)  || 0;
        g.energy += parseInt(s.energyLevel) || 0;
        const w = workout.workouts.find(w => w.date === s.date && w.day === s.day);
        if (w) g.volume += w.exercises.reduce((t, ex) => t + ex.sets.reduce((sv, set) => sv + set.weight * set.reps, 0), 0);
    });

    const tbody = document.querySelector('#music-table tbody');
    const genres = Object.keys(byGenre);
    if (!genres.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="5">Log a few sessions with music to see correlations.</td></tr>'; return; }
    tbody.innerHTML = genres.sort((a,b) => byGenre[b].count - byGenre[a].count).map(g => {
        const d = byGenre[g];
        return `<tr><td>${g}</td><td>${d.count}</td><td>${(d.focus/d.count).toFixed(1)}</td><td>${(d.energy/d.count).toFixed(1)}</td><td>${Math.round(d.volume/d.count).toLocaleString()}</td></tr>`;
    }).join('');
}

function loadStatsData()    { return JSON.parse(localStorage.getItem('workoutStats') || '{"sessions":[]}'); }
function saveStatsData(d)   { localStorage.setItem('workoutStats', JSON.stringify(d)); saveToCloud(); }

// ── Weekly Summary ────────────────────────────────────

function showWeeklySummary() {
    const today  = new Date();
    const day    = today.getDay();
    const monday = new Date(today);
    monday.setDate(today.getDate() - (day === 0 ? 6 : day - 1));
    const weekDates = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date(monday);
        d.setDate(monday.getDate() + i);
        weekDates.push(d.toISOString().split('T')[0]);
    }

    const data    = loadData();
    const stats   = loadStatsData();
    const prLog   = JSON.parse(localStorage.getItem('prLog') || '[]');

    const weekWorkouts = data.workouts.filter(w => weekDates.includes(w.date));
    const weekStats    = stats.sessions.filter(s => weekDates.includes(s.date));
    const weekPRs      = prLog.filter(p => weekDates.includes(p.date));

    const totalVolume  = weekWorkouts.reduce((t, w) => t + w.exercises.reduce((te, ex) => te + ex.sets.reduce((ts, s) => ts + s.weight * s.reps, 0), 0), 0);
    const avgFocus     = weekStats.length ? (weekStats.reduce((t, s) => t + parseInt(s.focusLevel || 5), 0) / weekStats.length).toFixed(1) : '—';
    const avgSleep     = weekStats.length ? (weekStats.reduce((t, s) => t + parseFloat(s.sleep || 0), 0) / weekStats.length).toFixed(1) : '—';
    const uniqueDays   = new Set(weekWorkouts.map(w => w.date)).size;

    document.getElementById('summary-dates').textContent = `${weekDates[0]} → ${weekDates[6]}`;
    document.getElementById('summary-grid').innerHTML = `
        <div class="summary-stat"><div class="s-label">Workouts</div><div class="s-value">${uniqueDays}/6</div><div class="s-sub">days this week</div></div>
        <div class="summary-stat"><div class="s-label">Total Volume</div><div class="s-value">${totalVolume.toLocaleString()}</div><div class="s-sub">lbs lifted</div></div>
        <div class="summary-stat"><div class="s-label">New PRs</div><div class="s-value">${weekPRs.length}</div><div class="s-sub">personal records</div></div>
        <div class="summary-stat"><div class="s-label">Avg Focus</div><div class="s-value">${avgFocus}</div><div class="s-sub">out of 10</div></div>
        <div class="summary-stat"><div class="s-label">Avg Sleep</div><div class="s-value">${avgSleep}</div><div class="s-sub">hours/night</div></div>
        <div class="summary-stat"><div class="s-label">Avg Energy</div><div class="s-value">${weekStats.length ? (weekStats.reduce((t,s)=>t+parseInt(s.energyLevel||5),0)/weekStats.length).toFixed(1) : '—'}</div><div class="s-sub">out of 10</div></div>`;
    show('summary-modal');
}
function closeSummaryModal() { hide('summary-modal'); }

// ── Goals Page ────────────────────────────────────────

function addGoal() {
    const exercise = document.getElementById('goal-exercise').value;
    const target   = parseFloat(document.getElementById('goal-weight').value);
    const date     = document.getElementById('goal-date').value;
    if (!exercise || !target) { alert('Please select an exercise and enter a target weight.'); return; }

    const goals = loadGoalsData();
    goals.push({ id: Date.now(), exercise, target, deadline: date || null });
    saveGoalsData(goals);

    document.getElementById('goal-exercise').value = '';
    document.getElementById('goal-weight').value   = '';
    document.getElementById('goal-date').value     = '';
    renderGoalsList();
}

function deleteGoal(id) {
    const goals = loadGoalsData().filter(g => g.id !== id);
    saveGoalsData(goals);
    renderGoalsList();
}

function getCurrentMax(name) {
    return loadData().workouts
        .flatMap(w => w.exercises).filter(e => e.name === name)
        .flatMap(e => e.sets).reduce((m, s) => Math.max(m, s.weight), 0);
}

function renderGoalsPage() { renderGoalsList(); }

function renderGoalsList() {
    const goals = loadGoalsData();
    const list  = document.getElementById('goals-list');
    if (!goals.length) { list.innerHTML = '<p class="goals-empty">No goals yet. Add one above.</p>'; return; }

    list.innerHTML = goals.map(g => {
        const current  = getCurrentMax(g.exercise);
        const pct      = Math.min(100, g.target > 0 ? Math.round((current / g.target) * 100) : 0);
        const achieved = current >= g.target;
        return `<div class="goal-card ${achieved ? 'achieved' : ''}">
            <div class="goal-header">
                <div>
                    <div class="goal-name">${achieved ? '&#127942; ' : ''}${g.exercise}</div>
                    <div class="goal-meta">${g.deadline ? 'Target date: ' + g.deadline : 'No deadline set'}</div>
                </div>
                <button class="goal-delete" onclick="deleteGoal(${g.id})">&#10005;</button>
            </div>
            <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${pct}%"></div></div>
            <div class="goal-stats">
                <span class="current">Current: ${current} lbs</span>
                <span>${pct}%</span>
                <span class="target">Goal: ${g.target} lbs</span>
            </div>
        </div>`;
    }).join('');
}

function loadGoalsData()   { return JSON.parse(localStorage.getItem('goalsData') || '[]'); }
function saveGoalsData(d)  { localStorage.setItem('goalsData', JSON.stringify(d)); saveToCloud(); }

// ── Red Light Therapy ─────────────────────────────────

function renderRedLightPage() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('rl-date').value = today;
    renderRedLightSummary();
    renderRedLightTable();
}

function logRedLight() {
    const date     = document.getElementById('rl-date').value;
    const duration = parseInt(document.getElementById('rl-duration').value) || 0;
    if (!date) { alert('Please select a date.'); return; }

    const sessions = loadRedLightData();
    sessions.unshift({ id: Date.now(), date, duration });
    saveRedLightData(sessions);

    document.getElementById('rl-duration').value = '';
    renderRedLightSummary();
    renderRedLightTable();

    const btn = document.querySelector('#page-redlight .save-btn');
    btn.textContent = 'Logged!'; btn.classList.add('saved');
    setTimeout(() => { btn.textContent = 'Log Session'; btn.classList.remove('saved'); }, 2000);
}

function renderRedLightSummary() {
    const sessions   = loadRedLightData();
    const total      = sessions.length;
    const totalMins  = sessions.reduce((t, s) => t + (s.duration || 0), 0);
    const totalHours = (totalMins / 60).toFixed(1);

    const thisWeek = sessions.filter(s => {
        const d = new Date(s.date);
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 86400000);
        return d >= weekAgo;
    }).length;

    document.getElementById('redlight-summary').innerHTML = `
        <div class="rl-stat"><div class="rl-value">${total}</div><div class="rl-label">Total Sessions</div></div>
        <div class="rl-stat"><div class="rl-value">${totalHours}h</div><div class="rl-label">Total Time</div></div>
        <div class="rl-stat"><div class="rl-value">${thisWeek}</div><div class="rl-label">This Week</div></div>`;
}

function renderRedLightTable() {
    const sessions = loadRedLightData();
    const tbody    = document.querySelector('#redlight-table tbody');
    if (!sessions.length) { tbody.innerHTML = '<tr class="empty-row"><td colspan="3">No sessions logged yet.</td></tr>'; return; }
    tbody.innerHTML = sessions.map((s, i) =>
        `<tr><td>${sessions.length - i}</td><td>${s.date}</td><td>${s.duration ? s.duration + ' min' : '—'}</td></tr>`
    ).join('');
}

function loadRedLightData()   { return JSON.parse(localStorage.getItem('redLightData') || '[]'); }
function saveRedLightData(d)  { localStorage.setItem('redLightData', JSON.stringify(d)); saveToCloud(); }

// ── Storage ───────────────────────────────────────────

function loadData()    { if (isViewOnly && window._sharedData) return window._sharedData; return JSON.parse(localStorage.getItem('strengthTrackerData') || '{"workouts":[]}'); }
function saveData(d)   { localStorage.setItem('strengthTrackerData', JSON.stringify(d)); saveToCloud(); }
