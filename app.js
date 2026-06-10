/* =============================================
   PULSE OF HUMANITY — FULL FIRESTORE EDITION
   Users + Pulses both live in Firestore
   ============================================= */

// ── Firebase Init ──────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey:            "AIzaSyBRdDYyWGnHzomM4e_4DEagRBG2JF3Na04",
  authDomain:        "nyu-itp-32868.firebaseapp.com",
  projectId:         "nyu-itp-32868",
  storageBucket:     "nyu-itp-32868.firebasestorage.app",
  messagingSenderId: "947909949573",
  appId:             "1:947909949573:web:64be68ce8c9f56669f51ec",
  measurementId:     "G-QDP6KNBNXQ"
};

firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// ── State ──────────────────────────────────────────────────────────────────
let currentUser     = null;   // { username, displayName, avatarColor }
let allEntries      = [];     // live-synced from Firestore
let currentFilter   = 'all';
let unsubscribeFeed = null;

// ── Mood Config ────────────────────────────────────────────────────────────
const MOOD_LEVELS = [
  { min: 0,  max: 15,  emoji: '☠️',  label: 'Apocalyptic',       class: 'mood-apocalyptic', color: '#ff2d55' },
  { min: 15, max: 35,  emoji: '😨',  label: 'Very Dark',          class: 'mood-dark',        color: '#ff6b35' },
  { min: 35, max: 48,  emoji: '😔',  label: 'Gloomy',             class: 'mood-dark',        color: '#c084fc' },
  { min: 48, max: 53,  emoji: '😐',  label: 'Uncertain',          class: 'mood-neutral',     color: '#a78bfa' },
  { min: 53, max: 65,  emoji: '🙂',  label: 'Cautiously Hopeful', class: 'mood-hopeful',     color: '#60d4b0' },
  { min: 65, max: 82,  emoji: '😊',  label: 'Hopeful',            class: 'mood-hopeful',     color: '#2ed4aa' },
  { min: 82, max: 95,  emoji: '🌟',  label: 'Very Optimistic',    class: 'mood-optimistic',  color: '#00d4aa' },
  { min: 95, max: 101, emoji: '✨',  label: 'Pure Optimism',      class: 'mood-optimistic',  color: '#7fffd4' },
];

function getMoodLevel(v) {
  return MOOD_LEVELS.find(m => v >= m.min && v < m.max) || MOOD_LEVELS[3];
}

// ── Session (localStorage — just remembers who is logged in) ───────────────
function saveSession(user) { localStorage.setItem('poh_session', JSON.stringify(user)); }
function clearSession()    { localStorage.removeItem('poh_session'); }
function getSession()      { try { return JSON.parse(localStorage.getItem('poh_session')); } catch { return null; } }

// ── Helpers ────────────────────────────────────────────────────────────────
function simpleHash(str) {
  let h = 5381;
  for (let i = 0; i < str.length; i++) { h = ((h << 5) + h) + str.charCodeAt(i); h = h & h; }
  return h.toString(16);
}

function generateAvatarColor(username) {
  const palette = [
    'linear-gradient(135deg,#7c3aed,#ec4899)',
    'linear-gradient(135deg,#0ea5e9,#6366f1)',
    'linear-gradient(135deg,#f59e0b,#ef4444)',
    'linear-gradient(135deg,#10b981,#3b82f6)',
    'linear-gradient(135deg,#f43f5e,#8b5cf6)',
    'linear-gradient(135deg,#06b6d4,#10b981)',
    'linear-gradient(135deg,#a855f7,#ec4899)',
    'linear-gradient(135deg,#f97316,#eab308)',
  ];
  let h = 0;
  for (const c of username) h += c.charCodeAt(0);
  return palette[h % palette.length];
}

function getTimeAgo(ts) {
  if (!ts) return 'just now';
  const date = ts.toDate ? ts.toDate() : new Date(ts);
  const sec  = Math.floor((Date.now() - date.getTime()) / 1000);
  if (sec < 60)  return 'just now';
  const min = Math.floor(sec / 60);
  if (min < 60)  return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24)   return `${hr}h ago`;
  const d = Math.floor(hr / 24);
  if (d < 7)     return `${d}d ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function escapeHTML(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}

// ── Toast ──────────────────────────────────────────────────────────────────
let _toastTimer;
function showToast(msg, type = '') {
  let t = document.getElementById('toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'toast'; t.className = 'toast';
    document.body.appendChild(t);
  }
  clearTimeout(_toastTimer);
  t.textContent = msg; t.className = `toast ${type}`;
  void t.offsetWidth; t.classList.add('show');
  _toastTimer = setTimeout(() => t.classList.remove('show'), 3500);
}

// ── UI helpers ─────────────────────────────────────────────────────────────
function showError(id, msg) {
  const el = document.getElementById(id);
  el.textContent = msg; el.classList.remove('hidden');
}
function clearErrors() {
  ['login-error','signup-error'].forEach(id => document.getElementById(id).classList.add('hidden'));
}
function setLoading(btnId, loading, defaultText) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.querySelector('span').textContent = loading ? 'Loading…' : defaultText;
}

// ── Tab Switch ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('login-form').classList.toggle('hidden', tab !== 'login');
  document.getElementById('signup-form').classList.toggle('hidden', tab === 'login');
  document.getElementById('tab-login').classList.toggle('active',  tab === 'login');
  document.getElementById('tab-signup').classList.toggle('active', tab !== 'login');
  clearErrors();
}

// ── Sign Up → saved to Firestore users collection ─────────────────────────
async function handleSignup(e) {
  e.preventDefault();
  const username    = document.getElementById('signup-username').value.trim().toLowerCase();
  const displayName = document.getElementById('signup-displayname').value.trim();
  const password    = document.getElementById('signup-password').value;

  if (username.length < 3)            { showError('signup-error', 'Username must be at least 3 characters.'); return; }
  if (!/^[a-z0-9_]+$/.test(username)) { showError('signup-error', 'Letters, numbers, and underscores only.'); return; }
  if (password.length < 6)            { showError('signup-error', 'Password must be at least 6 characters.'); return; }

  setLoading('signup-btn', true, 'Join the Conversation');
  try {
    // Check if username is taken (doc ID = username)
    const existing = await db.collection('users').doc(username).get();
    if (existing.exists) {
      showError('signup-error', 'That username is already taken!');
      return;
    }

    const avatarColor = generateAvatarColor(username);

    // Save user to Firestore
    await db.collection('users').doc(username).set({
      username,
      displayName,
      passwordHash: simpleHash(password),
      avatarColor,
      createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    });

    currentUser = { username, displayName, avatarColor };
    saveSession(currentUser);
    enterApp();
    showToast('🎉 Welcome to Pulse of Humanity!', 'success');

  } catch (err) {
    console.error('Signup error:', err);
    showError('signup-error', `Error: ${err.message}`);
  } finally {
    setLoading('signup-btn', false, 'Join the Conversation');
  }
}

// ── Sign In → verified against Firestore ──────────────────────────────────
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username').value.trim().toLowerCase();
  const password = document.getElementById('login-password').value;

  setLoading('login-btn', true, 'Sign In');
  try {
    const doc = await db.collection('users').doc(username).get();

    if (!doc.exists || doc.data().passwordHash !== simpleHash(password)) {
      showError('login-error', 'Invalid username or password.');
      return;
    }

    const data    = doc.data();
    currentUser   = { username, displayName: data.displayName, avatarColor: data.avatarColor };
    saveSession(currentUser);
    enterApp();
    showToast(`👋 Welcome back, ${data.displayName}!`, 'success');

  } catch (err) {
    console.error('Login error:', err);
    showError('login-error', `Error: ${err.message}`);
  } finally {
    setLoading('login-btn', false, 'Sign In');
  }
}

// ── Sign Out ───────────────────────────────────────────────────────────────
function handleLogout() {
  if (unsubscribeFeed) { unsubscribeFeed(); unsubscribeFeed = null; }
  currentUser = null; allEntries = [];
  clearSession();

  document.getElementById('auth-screen').classList.add('active');
  document.getElementById('app-screen').classList.remove('active');
  document.getElementById('login-form').reset();
  document.getElementById('signup-form').reset();
  clearErrors();
  switchTab('login');
  showToast('👋 Signed out.', '');
}

// ── Enter App ──────────────────────────────────────────────────────────────
function enterApp() {
  document.getElementById('auth-screen').classList.remove('active');
  document.getElementById('app-screen').classList.add('active');

  document.getElementById('user-display-name').textContent = currentUser.displayName;
  const av = document.getElementById('user-avatar-display');
  av.textContent      = currentUser.displayName[0].toUpperCase();
  av.style.background = currentUser.avatarColor || 'linear-gradient(135deg,#7c3aed,#00d4aa)';

  updateSlider(50);
  startFeedListener();
}

// ── Real-Time Feed from Firestore ──────────────────────────────────────────
function startFeedListener() {
  showFeedLoading(true);

  unsubscribeFeed = db.collection('pulses')
    .orderBy('timestamp', 'desc')
    .onSnapshot(snapshot => {
      allEntries = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      showFeedLoading(false);
      renderFeed();
      updateStats();
      updateWorldMood();
    }, err => {
      console.error('Firestore listener error:', err);
      showFeedLoading(false);
      showToast(`⚠️ ${err.code}: ${err.message}`, 'error');
    });
}

function showFeedLoading(on) {
  const list = document.getElementById('feed-list');
  let loader = document.getElementById('feed-loader');
  if (on && !loader) {
    loader = document.createElement('div');
    loader.id = 'feed-loader';
    loader.style.cssText = 'text-align:center;padding:48px;color:var(--text-muted);';
    loader.innerHTML = '<div style="font-size:36px;margin-bottom:12px;animation:pulse 1.5s ease infinite">🌍</div><p>Connecting to the world…</p>';
    list.prepend(loader);
  } else if (!on && loader) {
    loader.remove();
  }
}

// ── Submit Pulse → Firestore pulses collection ─────────────────────────────
async function submitEntry() {
  if (!currentUser) return;

  const slider  = document.getElementById('mood-slider');
  const value   = parseInt(slider.value);
  const thought = document.getElementById('thought-input').value.trim();
  const mood    = getMoodLevel(value);

  const btn     = document.getElementById('submit-btn');
  const btnText = document.getElementById('submit-text');
  const btnIcon = document.getElementById('submit-icon');
  btn.disabled  = true;
  btnText.textContent = 'Saving…';

  try {
    // Write pulse to Firestore
    const docRef = await db.collection('pulses').add({
      username:    currentUser.username,
      displayName: currentUser.displayName,
      avatarColor: currentUser.avatarColor,
      moodValue:   value,
      moodLabel:   mood.label,
      moodEmoji:   mood.emoji,
      moodClass:   mood.class,
      thought:     thought,
      timestamp:   firebase.firestore.FieldValue.serverTimestamp(),
    });

    console.log('✅ Pulse saved:', docRef.id);

    // Animate button
    btnText.textContent = 'Saved! ✨';
    btnIcon.innerHTML   = '<path d="M20 6L9 17l-5-5" stroke="currentColor" stroke-width="2"/>';

    // Reset form
    document.getElementById('thought-input').value = '';
    document.getElementById('char-count').textContent = '0 / 500';
    slider.value = 50;
    updateSlider(50);

    showToast('🌍 Your pulse has been shared with the world!', 'success');
    setTimeout(() => {
      document.querySelector('.feed-section').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 400);

  } catch (err) {
    console.error('Write error:', err);
    showToast(`❌ Failed to save: ${err.message}`, 'error');
  } finally {
    setTimeout(() => {
      btn.disabled        = false;
      btnText.textContent = 'Submit My Pulse';
      btnIcon.innerHTML   = '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>';
    }, 2500);
  }
}

// ── Slider ─────────────────────────────────────────────────────────────────
function updateSlider(value) {
  const val  = parseInt(value);
  const mood = getMoodLevel(val);

  document.getElementById('mood-emoji').textContent = mood.emoji;
  document.getElementById('mood-label').textContent = mood.label;
  document.getElementById('mood-label').style.color = mood.color;
  document.getElementById('mood-value').textContent = `${val}% optimistic`;

  const emojiEl = document.getElementById('mood-emoji');
  emojiEl.style.transform = 'scale(1.3) rotate(-5deg)';
  setTimeout(() => { emojiEl.style.transform = 'scale(1)'; }, 200);
  emojiEl.style.filter = `drop-shadow(0 0 16px ${mood.color})`;

  const glow   = document.getElementById('slider-glow');
  const slider = document.getElementById('mood-slider');
  glow.style.left       = `${(val / 100) * slider.offsetWidth - 30}px`;
  glow.style.background = mood.color;
  glow.style.boxShadow  = `0 0 20px ${mood.color}`;

  const ind = document.getElementById('mood-indicator');
  ind.style.borderColor = `${mood.color}40`;
  ind.style.boxShadow   = `0 0 24px ${mood.color}15`;
}

// ── Char Count ─────────────────────────────────────────────────────────────
function updateCharCount(textarea) {
  const n  = textarea.value.length;
  const el = document.getElementById('char-count');
  el.textContent = `${n} / 500`;
  el.style.color = n > 450 ? '#ff6b87' : n > 350 ? '#fbbf24' : 'var(--text-muted)';
}

// ── Filter ─────────────────────────────────────────────────────────────────
function filterFeed(filter, btn) {
  currentFilter = filter;
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderFeed();
}

// ── Render Feed ─────────────────────────────────────────────────────────────
function renderFeed() {
  const feedList  = document.getElementById('feed-list');
  const feedEmpty = document.getElementById('feed-empty');

  let entries = [...allEntries];
  if (currentFilter === 'apocalyptic') entries = entries.filter(e => e.moodValue < 40);
  else if (currentFilter === 'neutral')    entries = entries.filter(e => e.moodValue >= 40 && e.moodValue < 65);
  else if (currentFilter === 'optimistic') entries = entries.filter(e => e.moodValue >= 65);

  feedList.querySelectorAll('.feed-card').forEach(el => el.remove());

  if (!entries.length) { feedEmpty.style.display = 'block'; return; }
  feedEmpty.style.display = 'none';
  entries.forEach((entry, i) => feedList.appendChild(createFeedCard(entry, i)));
}

function createFeedCard(entry, i) {
  const card = document.createElement('div');
  card.className = `feed-card ${entry.moodClass || 'mood-neutral'}`;
  card.style.animationDelay = `${Math.min(i * 0.04, 0.5)}s`;

  const mood    = getMoodLevel(entry.moodValue);
  const initial = (entry.displayName || entry.username || '?')[0].toUpperCase();
  const thought = entry.thought
    ? `<p class="feed-thought">"${escapeHTML(entry.thought)}"</p>`
    : `<p class="feed-no-thought">Shared their pulse without words.</p>`;

  card.innerHTML = `
    <div class="feed-card-header">
      <div class="feed-card-user">
        <div class="feed-avatar" style="background:${entry.avatarColor || 'linear-gradient(135deg,#7c3aed,#00d4aa)'}">${initial}</div>
        <div class="user-info">
          <div class="feed-username">${escapeHTML(entry.displayName || entry.username)}</div>
          <div class="feed-time">${getTimeAgo(entry.timestamp)}</div>
        </div>
      </div>
      <div class="feed-mood">
        <span class="feed-mood-emoji">${entry.moodEmoji}</span>
        <span class="feed-mood-label" style="color:${mood.color}">${entry.moodLabel}</span>
        <span class="feed-mood-score">${entry.moodValue}%</span>
      </div>
    </div>
    <div class="feed-card-body">
      ${thought}
      <div class="feed-mini-bar"><div class="feed-mini-bar-fill" style="width:${entry.moodValue}%"></div></div>
    </div>
  `;
  return card;
}

// ── Stats ──────────────────────────────────────────────────────────────────
function updateStats() {
  const total = allEntries.length;
  document.getElementById('stat-total').textContent = total;

  if (!total) {
    document.getElementById('stat-avg-emoji').textContent = '—';
    document.getElementById('stat-optimism').textContent  = '—';
    document.getElementById('stat-today').textContent     = '0';
    return;
  }

  const avg  = Math.round(allEntries.reduce((s, e) => s + e.moodValue, 0) / total);
  const mood = getMoodLevel(avg);
  document.getElementById('stat-avg-emoji').textContent = mood.emoji;
  document.getElementById('stat-optimism').textContent  = `${avg}%`;

  const todayStr   = new Date().toDateString();
  const todayCount = allEntries.filter(e => {
    if (!e.timestamp) return false;
    const d = e.timestamp.toDate ? e.timestamp.toDate() : new Date(e.timestamp);
    return d.toDateString() === todayStr;
  }).length;
  document.getElementById('stat-today').textContent = todayCount;
}

function updateWorldMood() {
  const total = allEntries.length;
  const avg   = total ? Math.round(allEntries.reduce((s, e) => s + e.moodValue, 0) / total) : 50;
  const mood  = getMoodLevel(avg);
  document.getElementById('world-mood-fill').style.width  = `${avg}%`;
  document.getElementById('world-mood-score').textContent = total ? `${mood.emoji} ${mood.label} (${avg}%)` : '—';
}

// ── Init ───────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  currentUser = getSession();
  if (currentUser) { enterApp(); }
  else { document.getElementById('auth-screen').classList.add('active'); }

  document.getElementById('thought-input')
    ?.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') submitEntry();
    });
});
