/* =====================================================
   app.js – Quran Website Core Logic
   Uses Quran.com API v4 for text, audio, and tafsir
   Supports Dark/Light mode, Font controller, Ayah Repeater,
   and Tafsir translation modal.
   ===================================================== */

// --- Configuration ---
const API = 'https://api.quran.com/api/v4';
const AUDIO_BASE = 'https://verses.quran.com/';

// --- DOM Elements ---
const surahListEl     = document.getElementById('surahList');
const searchInput     = document.getElementById('searchSurah');
const mainContent     = document.getElementById('mainContent');
const welcomeScreen   = document.getElementById('welcomeScreen');
const surahView       = document.getElementById('surahView');
const loadingEl       = document.getElementById('loading');
const versesContainer = document.getElementById('versesContainer');
const surahNameEl     = document.getElementById('surahName');
const surahInfoEl     = document.getElementById('surahInfo');
const bismillahEl     = document.getElementById('bismillah');
const surahHeaderCard = document.getElementById('surahHeaderCard');

// Player & Settings Controls
const audioElement    = document.getElementById('audioElement');
const playPauseBtn    = document.getElementById('playPauseBtn');
const prevBtn         = document.getElementById('prevBtn');
const nextBtn         = document.getElementById('nextBtn');
const seekBar         = document.getElementById('seekBar');
const playerSurah     = document.getElementById('playerSurah');
const playerAyah      = document.getElementById('playerAyah');
const reciterSelect   = document.getElementById('reciterSelect');
const repeatSelect    = document.getElementById('repeatSelect');

const themeToggle     = document.getElementById('themeToggle');
const fontDecrease    = document.getElementById('fontDecrease');
const fontIncrease    = document.getElementById('fontIncrease');
const fontSizeDisplay = document.getElementById('fontSizeDisplay');

// Stats & Modals
const pointsEl        = document.getElementById('points');
const versesReadEl    = document.getElementById('versesRead');
const badgeNotif      = document.getElementById('badgeNotification');
const badgeTextEl     = document.getElementById('badgeText');

const tafsirModal     = document.getElementById('tafsirModal');
const closeTafsirBtn  = document.getElementById('closeTafsirBtn');
const tafsirAyahText  = document.getElementById('tafsirAyahText');
const tafsirText      = document.getElementById('tafsirText');
const translationText = document.getElementById('translationText');

// Sidebar toggle
const sidebarToggle   = document.getElementById('sidebarToggle');
const sidebar         = document.getElementById('sidebar');

// --- State ---
let chapters = [];
let reciters = [];
let selectedReciterId = parseInt(localStorage.getItem('selectedReciter') || '7');
let currentSurahId = null;
let currentSurahName = '';
let currentVerses = [];
let currentAudioFiles = [];
let currentAyahIndex = 0;
let isPlaying = false;

// Repeater counter
let currentRepeatCount = 1;

// Font size state
let baseFontSize = parseInt(localStorage.getItem('userFontSize') || '26');

// Display Mode State
let displayMode = localStorage.getItem('displayMode') || 'both'; // both, text, audio

// Theme state
let isDarkMode = localStorage.getItem('isDarkMode') === 'true';

// Reward state
let points = parseInt(localStorage.getItem('quranPoints') || '0');
let versesRead = parseInt(localStorage.getItem('quranVersesRead') || '0');
let listenedSet = new Set(JSON.parse(localStorage.getItem('quranListened') || '[]'));

pointsEl.textContent = points;
versesReadEl.textContent = versesRead;

// =====================================================
//  THEME & FONT SIZE MANAGEMENT
// =====================================================
function updateThemeUI() {
  if (isDarkMode) {
    document.body.classList.add('dark-theme');
    themeToggle.textContent = '☀️';
  } else {
    document.body.classList.remove('dark-theme');
    themeToggle.textContent = '🌙';
  }
}

themeToggle.addEventListener('click', () => {
  isDarkMode = !isDarkMode;
  localStorage.setItem('isDarkMode', isDarkMode);
  updateThemeUI();
});

function applyFontSize() {
  fontSizeDisplay.textContent = `${baseFontSize}px`;
  // Apply font size directly to verses container CSS variables or rules
  document.documentElement.style.setProperty('--verse-font-size', `${baseFontSize}px`);
  // Update class styles on runtime
  const arElements = document.querySelectorAll('.verse-arabic, .tafsir-ayah-box p');
  arElements.forEach(el => {
    el.style.fontSize = `${baseFontSize}px`;
  });
}

fontIncrease.addEventListener('click', () => {
  if (baseFontSize < 48) {
    baseFontSize += 2;
    localStorage.setItem('userFontSize', baseFontSize);
    applyFontSize();
  }
});

fontDecrease.addEventListener('click', () => {
  if (baseFontSize > 18) {
    baseFontSize -= 2;
    localStorage.setItem('userFontSize', baseFontSize);
    applyFontSize();
  }
});

// Initialize Settings
updateThemeUI();
applyFontSize();

// =====================================================
//  DISPLAY MODE MANAGEMENT
// =====================================================
function updateDisplayModeUI() {
  document.body.classList.remove('mode-text-only', 'mode-audio-only');
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === displayMode);
  });
  
  if (displayMode === 'text') {
    document.body.classList.add('mode-text-only');
    audioElement.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
  } else if (displayMode === 'audio') {
    document.body.classList.add('mode-audio-only');
  }
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    displayMode = btn.dataset.mode;
    localStorage.setItem('displayMode', displayMode);
    updateDisplayModeUI();
  });
});

updateDisplayModeUI();

// =====================================================
//  UTILITIES & PROGRESS MANAGEMENT
// =====================================================
function saveState() {
  localStorage.setItem('quranPoints', points);
  localStorage.setItem('quranVersesRead', versesRead);
  localStorage.setItem('quranListened', JSON.stringify([...listenedSet]));
}

function showLoading() {
  loadingEl.style.display = 'block';
  welcomeScreen.style.display = 'none';
  surahView.style.display = 'none';
}

function hideLoading() {
  loadingEl.style.display = 'none';
}

function showBadge(text) {
  badgeTextEl.textContent = text;
  badgeNotif.style.display = 'flex';
  badgeNotif.style.animation = 'none';
  void badgeNotif.offsetWidth;
  badgeNotif.style.animation = 'badgeIn 0.5s ease forwards';
  setTimeout(() => {
    badgeNotif.style.display = 'none';
  }, 3500);
}

function checkBadges() {
  const thresholds = [
    { count: 10,   label: '🌱 بداية مباركة! 10 آيات' },
    { count: 50,   label: '⭐ ممتاز! 50 آية' },
    { count: 100,  label: '🏅 رائع! 100 آية' },
    { count: 500,  label: '🏆 مبدع! 500 آية' },
    { count: 1000, label: '👑 خاتم القرآن! 1000 آية' },
    { count: 3000, label: '💎 متميّز! 3000 آية' },
    { count: 6236, label: '🌙 أتممت القرآن كاملاً! 6236 آية' },
  ];
  for (const t of thresholds) {
    if (versesRead === t.count) {
      showBadge(t.label);
      break;
    }
  }
}

function addPoints(verseKey) {
  if (listenedSet.has(verseKey)) return;
  listenedSet.add(verseKey);
  points += 1;
  versesRead += 1;
  pointsEl.textContent = points;
  versesReadEl.textContent = versesRead;
  saveState();
  checkBadges();
}

// =====================================================
//  TAFSIR & MODAL LOGIC
// =====================================================
let currentActiveVerseKey = null;
let currentActiveArabicText = '';

const tafsirSelect = document.getElementById('tafsirSelect');

async function loadTafsirContent(verseKey, tafsirEdition) {
  tafsirText.textContent = 'جارٍ تحميل التفسير...';
  try {
    const tafsirUrl = `https://api.alquran.cloud/v1/ayah/${verseKey}/${tafsirEdition}`;
    const res = await fetch(tafsirUrl).then(r => r.json());
    if (res.code === 200 && res.data) {
      tafsirText.textContent = res.data.text;
    } else {
      tafsirText.textContent = 'تعذر العثور على التفسير المختار لهذه الآية.';
    }
  } catch (err) {
    console.error('Tafsir load failure:', err);
    tafsirText.textContent = 'حدث خطأ أثناء تحميل التفسير.';
  }
}

async function openTafsir(verseKey, arabicText) {
  currentActiveVerseKey = verseKey;
  currentActiveArabicText = arabicText;

  tafsirAyahText.textContent = arabicText;
  translationText.textContent = 'Loading translation...';
  tafsirModal.style.display = 'flex';
  applyFontSize();

  const selectedEdition = tafsirSelect ? tafsirSelect.value : 'ar.muyassar';

  try {
    const transUrl = `${API}/verses/by_key/${verseKey}?translations=20`;

    // Fetch tafsir and translation in parallel
    const [_, transRes] = await Promise.all([
      loadTafsirContent(verseKey, selectedEdition),
      fetch(transUrl).then(r => r.json())
    ]);

    // Handle Translation response
    if (transRes.verse && transRes.verse.translations && transRes.verse.translations.length > 0) {
      const rawText = transRes.verse.translations[0].text;
      translationText.textContent = rawText.replace(/<sup[^>]*>.*?<\/sup>/g, '');
    } else {
      translationText.textContent = 'Translation not found.';
    }
  } catch (err) {
    console.error('Modal data load failure:', err);
  }
}

if (tafsirSelect) {
  tafsirSelect.addEventListener('change', () => {
    if (currentActiveVerseKey) {
      loadTafsirContent(currentActiveVerseKey, tafsirSelect.value);
    }
  });
}

closeTafsirBtn.addEventListener('click', () => {
  tafsirModal.style.display = 'none';
});

// Close modal when clicking outside the content
tafsirModal.addEventListener('click', (e) => {
  if (e.target === tafsirModal) {
    tafsirModal.style.display = 'none';
  }
});

// =====================================================
//  API FUNCTIONS
// =====================================================
async function fetchChapters() {
  const res = await fetch(`${API}/chapters?language=ar`);
  const data = await res.json();
  return data.chapters;
}

async function fetchVerses(chapterId) {
  const res = await fetch(
    `${API}/verses/by_chapter/${chapterId}?language=ar&words=false&per_page=300&fields=text_uthmani`
  );
  const data = await res.json();
  return data.verses;
}

async function fetchAudioFiles(chapterId, reciterId) {
  const res = await fetch(
    `${API}/recitations/${reciterId}/by_chapter/${chapterId}?per_page=300`
  );
  const data = await res.json();
  return data.audio_files;
}

async function fetchReciters() {
  const res = await fetch(`${API}/resources/recitations?language=ar`);
  const data = await res.json();
  return data.recitations || [];
}

// =====================================================
//  RECITERS RENDER
// =====================================================
function renderReciters(recitersList) {
  reciterSelect.innerHTML = '';
  recitersList.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.id;
    const name = r.translated_name?.name || r.reciter_name || `قارئ #${r.id}`;
    const style = r.style || '';
    opt.textContent = style ? `${name} (${style})` : name;
    reciterSelect.appendChild(opt);
  });
  // Set saved reciter, fallback to first
  if ([...reciterSelect.options].some(o => parseInt(o.value) === selectedReciterId)) {
    reciterSelect.value = selectedReciterId;
  } else {
    reciterSelect.selectedIndex = 0;
    selectedReciterId = parseInt(reciterSelect.value);
  }
}

reciterSelect.addEventListener('change', async () => {
  selectedReciterId = parseInt(reciterSelect.value);
  localStorage.setItem('selectedReciter', selectedReciterId);

  if (currentSurahId) {
    try {
      currentAudioFiles = await fetchAudioFiles(currentSurahId, selectedReciterId);
      if (isPlaying) {
        playAyah(currentAyahIndex);
      }
    } catch (err) {
      console.error('Error switching reciter audio:', err);
    }
  }
});

// =====================================================
//  SURAH LIST RENDER
// =====================================================
function renderSurahList(chaptersData) {
  surahListEl.innerHTML = '';
  chaptersData.forEach(ch => {
    const li = document.createElement('li');
    li.className = 'surah-item';
    li.dataset.id = ch.id;
    li.innerHTML = `
      <div class="surah-item-number">${ch.id}</div>
      <div class="surah-item-info">
        <div class="surah-item-name">${ch.name_arabic}</div>
        <span>${ch.translated_name.name} · ${ch.verses_count} آية</span>
      </div>
    `;
    li.addEventListener('click', () => {
      loadSurah(ch.id);
      if (window.innerWidth <= 768) {
        sidebar.classList.remove('open');
      }
    });
    surahListEl.appendChild(li);
  });
}

searchInput.addEventListener('input', () => {
  const q = searchInput.value.trim();
  const items = surahListEl.querySelectorAll('.surah-item');
  items.forEach(item => {
    const name = item.querySelector('.surah-item-name').textContent;
    const num = item.dataset.id;
    const match = name.includes(q) || num.includes(q);
    item.style.display = match ? '' : 'none';
  });
});

// =====================================================
//  LOAD SURAH
// =====================================================
async function loadSurah(surahId) {
  if (currentSurahId === surahId && currentVerses.length > 0) return;
  
  audioElement.pause();
  audioElement.src = '';
  isPlaying = false;
  playPauseBtn.textContent = '▶';
  
  showLoading();
  currentSurahId = surahId;
  currentVerses = [];
  currentAudioFiles = [];
  currentAyahIndex = 0;

  try {
    document.querySelectorAll('.surah-item').forEach(el => {
      el.classList.toggle('active', parseInt(el.dataset.id) === surahId);
    });

    const [verses, audioFiles] = await Promise.all([
      fetchVerses(surahId),
      fetchAudioFiles(surahId, selectedReciterId)
    ]);

    if (currentSurahId !== surahId) return;

    currentVerses = verses;
    currentAudioFiles = audioFiles;
    currentAyahIndex = 0;

    const ch = chapters.find(c => c.id === surahId);
    currentSurahName = ch ? ch.name_arabic : '';

    surahNameEl.textContent = currentSurahName;
    surahInfoEl.textContent = ch
      ? `${ch.revelation_place === 'makkah' ? 'مكية' : 'مدنية'} · ${ch.verses_count} آية`
      : '';
    bismillahEl.style.display = surahId === 1 || surahId === 9 ? 'none' : 'block';

    versesContainer.innerHTML = '';
    verses.forEach((v, i) => {
      const card = document.createElement('div');
      card.className = 'verse-card';
      card.dataset.index = i;
      card.style.animationDelay = `${Math.min(i * 0.04, 0.8)}s`;
      card.innerHTML = `
        <div class="verse-top">
          <div class="verse-number">${v.verse_number}</div>
          <div style="display:flex; gap: 6px;">
            <button class="verse-bookmark-btn settings-btn" style="width:34px; height:34px; font-size:12px;" title="حفظ مكان التوقف">🔖</button>
            <button class="verse-share-btn settings-btn" style="width:34px; height:34px; font-size:12px;" title="مشاركة الآية">📲</button>
            <button class="verse-tafsir-btn settings-btn" style="width:34px; height:34px; font-size:12px;" title="عرض التفسير والترجمة">📖</button>
            <button class="verse-play-btn" title="تشغيل هذه الآية">▶</button>
          </div>
        </div>
        <div class="verse-arabic">${v.text_uthmani}</div>
      `;

      card.querySelector('.verse-play-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        playAyah(i);
      });
      card.querySelector('.verse-tafsir-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        openTafsir(v.verse_key, v.text_uthmani);
      });
      card.querySelector('.verse-share-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        shareVerse(currentSurahName, v.verse_number, v.text_uthmani);
      });
      card.querySelector('.verse-bookmark-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        saveBookmark(currentSurahId, currentSurahName, i, v.verse_number);
      });
      card.addEventListener('click', () => {
        if (displayMode === 'text') {
          openTafsir(v.verse_key, v.text_uthmani);
        } else {
          playAyah(i);
        }
      });

      versesContainer.appendChild(card);
    });

    applyFontSize();
    hideLoading();
    surahView.style.display = 'block';
    window.scrollTo({ top: 0, behavior: 'smooth' });

  } catch (err) {
    console.error('Error loading surah:', err);
    hideLoading();
    versesContainer.innerHTML = `<p style="text-align:center;color:#999;padding:40px;">حدث خطأ في تحميل السورة. تحقق من اتصال الإنترنت.</p>`;
    surahView.style.display = 'block';
  }
}

// =====================================================
//  AUDIO PLAYBACK & REPEATER LOGIC
// =====================================================
function playAyah(index) {
  if (!currentAudioFiles || !currentAudioFiles[index]) return;

  currentAyahIndex = index;
  const audioFile = currentAudioFiles[index];
  const url = AUDIO_BASE + audioFile.url;

  // Initialize repeat counter for this new verse
  currentRepeatCount = 1;

  audioElement.src = url;
  audioElement.play().catch(console.error);
  isPlaying = true;
  playPauseBtn.textContent = '⏸';

  playerSurah.textContent = currentSurahName;
  playerAyah.textContent = `الآية ${currentVerses[index].verse_number}`;

  document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('playing'));
  const activeCard = document.querySelector(`.verse-card[data-index="${index}"]`);
  if (activeCard) {
    activeCard.classList.add('playing');
    activeCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

audioElement.addEventListener('timeupdate', () => {
  if (audioElement.duration) {
    seekBar.value = (audioElement.currentTime / audioElement.duration) * 100;
  }
});

audioElement.addEventListener('ended', () => {
  const verseKey = `${currentSurahId}:${currentVerses[currentAyahIndex].verse_number}`;
  addPoints(verseKey);

  const maxRepeat = parseInt(repeatSelect.value);

  if (currentRepeatCount < maxRepeat) {
    // Repeat current ayah
    currentRepeatCount++;
    audioElement.currentTime = 0;
    audioElement.play().catch(console.error);
  } else {
    // Move to next ayah
    if (currentAyahIndex < currentVerses.length - 1) {
      playAyah(currentAyahIndex + 1);
    } else {
      isPlaying = false;
      playPauseBtn.textContent = '▶';
      document.querySelectorAll('.verse-card').forEach(c => c.classList.remove('playing'));
    }
  }
});

seekBar.addEventListener('input', () => {
  if (audioElement.duration) {
    audioElement.currentTime = (seekBar.value / 100) * audioElement.duration;
  }
});

// Player controls
playPauseBtn.addEventListener('click', () => {
  if (!audioElement.src || audioElement.src === '') {
    if (currentVerses.length > 0) playAyah(0);
    return;
  }
  if (isPlaying) {
    audioElement.pause();
    isPlaying = false;
    playPauseBtn.textContent = '▶';
  } else {
    audioElement.play().catch(console.error);
    isPlaying = true;
    playPauseBtn.textContent = '⏸';
  }
});

prevBtn.addEventListener('click', () => {
  if (currentAyahIndex > 0) {
    playAyah(currentAyahIndex - 1);
  }
});

nextBtn.addEventListener('click', () => {
  if (currentAyahIndex < currentVerses.length - 1) {
    playAyah(currentAyahIndex + 1);
  }
});

// =====================================================
//  SIDEBAR TOGGLE
// =====================================================
sidebarToggle.addEventListener('click', () => {
  sidebar.classList.toggle('open');
});

document.addEventListener('click', (e) => {
  if (window.innerWidth <= 768 &&
      !sidebar.contains(e.target) &&
      !sidebarToggle.contains(e.target)) {
    sidebar.classList.remove('open');
  }
});

// =====================================================
//  BOOKMARK & LAST READ
// =====================================================
const resumeBookmarkBtn = document.getElementById('resumeBookmarkBtn');
let savedBookmark = JSON.parse(localStorage.getItem('quranBookmark') || 'null');

function updateBookmarkBtnUI() {
  if (savedBookmark && resumeBookmarkBtn) {
    resumeBookmarkBtn.style.display = 'block';
    resumeBookmarkBtn.textContent = `🔖 واصل: ${savedBookmark.surahName} (${savedBookmark.ayahNum})`;
  }
}

function saveBookmark(surahId, surahName, index, ayahNum) {
  savedBookmark = { surahId, surahName, index, ayahNum };
  localStorage.setItem('quranBookmark', JSON.stringify(savedBookmark));
  updateBookmarkBtnUI();
  showBadge(`تم حفظ المرجعية: ${surahName} (الآية ${ayahNum})`);
}

if (resumeBookmarkBtn) {
  resumeBookmarkBtn.addEventListener('click', async () => {
    if (savedBookmark) {
      await loadSurah(savedBookmark.surahId);
      setTimeout(() => {
        const card = document.querySelector(`.verse-card[data-index="${savedBookmark.index}"]`);
        if (card) {
          card.scrollIntoView({ behavior: 'smooth', block: 'center' });
          card.classList.add('playing');
          setTimeout(() => card.classList.remove('playing'), 3000);
        }
      }, 500);
    }
  });
}

updateBookmarkBtnUI();

// =====================================================
//  SHARE AYAH LOGIC
// =====================================================
function shareVerse(surahName, verseNumber, text) {
  const shareText = `﴿ ${text} ﴾\n[سورة ${surahName} - الآية ${verseNumber}]\n\nتم المشاركة من موقع القرآن الكريم 🌙`;
  if (navigator.share) {
    navigator.share({
      title: `سورة ${surahName} - الآية ${verseNumber}`,
      text: shareText
    }).catch(() => {});
  } else {
    navigator.clipboard.writeText(shareText).then(() => {
      showBadge('تم نسخ الآية للحافظة بنجاح 📋');
    });
  }
}

// Helper: Convert 24h format "15:30" to 12h format "3:30 م" or "3:30 ص"
function formatTo12Hour(timeStr) {
  if (!timeStr) return '--:--';
  const cleanTime = timeStr.split(' ')[0]; // remove timezone if any
  const parts = cleanTime.split(':');
  let hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  const period = hours >= 12 ? 'م' : 'ص';
  hours = hours % 12;
  if (hours === 0) hours = 12;
  return `${hours}:${minutes} ${period}`;
}

const prayerMethodSelect = document.getElementById('prayerMethodSelect');
let currentPrayerMethod = localStorage.getItem('prayerMethod') || '3';

if (prayerMethodSelect) {
  prayerMethodSelect.value = currentPrayerMethod;
  prayerMethodSelect.addEventListener('change', () => {
    currentPrayerMethod = prayerMethodSelect.value;
    localStorage.setItem('prayerMethod', currentPrayerMethod);
    fetchPrayerTimes();
  });
}

async function fetchPrayerTimes() {
  const defaultLat = 33.3152, defaultLng = 44.3661;
  getPrayerData(defaultLat, defaultLng);

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        getPrayerData(pos.coords.latitude, pos.coords.longitude);
      },
      () => {},
      { timeout: 3000 }
    );
  }
}

async function getPrayerData(lat, lng) {
  try {
    const res = await fetch(`https://api.aladhan.com/v1/timings?latitude=${lat}&longitude=${lng}&method=${currentPrayerMethod}`);
    const data = await res.json();
    if (data.code === 200 && data.data && data.data.timings) {
      const t = data.data.timings;
      const fajrEl = document.getElementById('prayFajr');
      const sunriseEl = document.getElementById('praySunrise');
      const dhuhrEl = document.getElementById('prayDhuhr');
      const asrEl = document.getElementById('prayAsr');
      const maghribEl = document.getElementById('prayMaghrib');
      const ishaEl = document.getElementById('prayIsha');

      if (fajrEl) fajrEl.textContent = formatTo12Hour(t.Fajr);
      if (sunriseEl) sunriseEl.textContent = formatTo12Hour(t.Sunrise);
      if (dhuhrEl) dhuhrEl.textContent = formatTo12Hour(t.Dhuhr);
      if (asrEl) asrEl.textContent = formatTo12Hour(t.Asr);
      if (maghribEl) maghribEl.textContent = formatTo12Hour(t.Maghrib);
      if (ishaEl) ishaEl.textContent = formatTo12Hour(t.Isha);
    }
  } catch (err) {
    console.error('Prayer times fetch error:', err);
  }
}

fetchPrayerTimes();

// =====================================================
//  ATHKAR & DUAS MODAL LOGIC
// =====================================================
const athkarModal = document.getElementById('athkarModal');
const openAthkarBtn = document.getElementById('openAthkarBtn');
const closeAthkarBtn = document.getElementById('closeAthkarBtn');
const athkarListContainer = document.getElementById('athkarListContainer');

const headerAthkarBtn = document.getElementById('headerAthkarBtn');

const athkarData = {
  sabah: [
    { text: "أَصْبَحْنَا وَأَصْبَحَ الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.", count: 1 },
    { text: "اللَّهُمَّ بِكَ أَصْبَحْنَا، وَبِكَ أَمْسَيْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ النُّشُورُ.", count: 1 },
    { text: "اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ.\n\n(سيد الاستغفار)", count: 1 },
    { text: "اللَّهُمَّ إِنِّي أَصْبَحْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لاَ إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ.", count: 4 },
    { text: "اللَّهُمَّ مَا أَصْبَحَ بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.", count: 1 },
    { text: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ.\n\nاللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لاَ إِلَهَ إِلاَّ أَنْتَ.", count: 3 },
    { text: "حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.", count: 7 },
    { text: "بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.", count: 3 },
    { text: "رَضِيتُ بِاللَّهِ رَبًّا، وَبِالإِسْلاَمِ دِيناً، وَبِمُحَمَّدٍ ﷺ نَبِيًّا.", count: 3 },
    { text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ: عَدَدَ خَلْقِهِ، وَرِضَا نَفْسِهِ، وَزِنَةَ عَرْشِهِ، وَمِدَادَ كَلِمَاتِهِ.", count: 3 },
    { text: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ.", count: 1 },
    { text: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ.\n\nاللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي.", count: 1 },
    { text: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنَ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ وَقَهْرِ الرِّجَالِ.", count: 1 },
    { text: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.", count: 3 },
    { text: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ ﷺ.", count: 10 }
  ],
  massa: [
    { text: "أَمْسَيْنَا وَأَمْسَى الْمُلْكُ لِلَّهِ، وَالْحَمْدُ لِلَّهِ لاَ إِلَهَ إِلاَّ اللَّهُ وَحْدَهُ لاَ شَرِيكَ لَهُ، لَهُ الْمُلْكُ وَلَهُ الْحَمْدُ وَهُوَ عَلَى كُلِّ شَيْءٍ قَدِيرٌ.", count: 1 },
    { text: "اللَّهُمَّ بِكَ أَمْسَيْنَا، وَبِكَ أَصْبَحْنَا، وَبِكَ نَحْيَا، وَبِكَ نَمُوتُ وَإِلَيْكَ الْمَصِيرُ.", count: 1 },
    { text: "اللَّهُمَّ أَنْتَ رَبِّي لاَ إِلَهَ إِلاَّ أَنْتَ، خَلَقْتَنِي وَأَنَا عَبْدُكَ، وَأَنَا عَلَى عَهْدِكَ وَوَعْدِكَ مَا اسْتَطَعْتُ، أَعُوذُ بِكَ مِنْ شَرِّ مَا صَنَعْتُ، أَبُوءُ لَكَ بِنِعْمَتِكَ عَلَيَّ، وَأَبُوءُ بِذَنْبِي فَاغْفِرْ لِي فَإِنَّهُ لاَ يَغْفِرُ الذُّنُوبَ إِلاَّ أَنْتَ.\n\n(سيد الاستغفار)", count: 1 },
    { text: "اللَّهُمَّ إِنِّي أَمْسَيْتُ أُشْهِدُكَ، وَأُشْهِدُ حَمَلَةَ عَرْشِكَ، وَمَلاَئِكَتَكَ، وَجَمِيعَ خَلْقِكَ، أَنَّكَ أَنْتَ اللَّهُ لاَ إِلَهَ إِلاَّ أَنْتَ وَحْدَكَ لاَ شَرِيكَ لَكَ، وَأَنَّ مُحَمَّداً عَبْدُكَ وَرَسُولُكَ.", count: 4 },
    { text: "اللَّهُمَّ مَا أَمْسَى بِي مِنْ نِعْمَةٍ أَوْ بِأَحَدٍ مِنْ خَلْقِكَ فَمِنْكَ وَحْدَكَ لاَ شَرِيكَ لَكَ، فَلَكَ الْحَمْدُ وَلَكَ الشُّكْرُ.", count: 1 },
    { text: "اللَّهُمَّ عَافِنِي فِي بَدَنِي، اللَّهُمَّ عَافِنِي فِي سَمْعِي، اللَّهُمَّ عَافِنِي فِي بَصَرِي، لاَ إِلَهَ إِلاَّ أَنْتَ.\n\nاللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْكُفْرِ وَالْفَقْرِ، وَأَعُوذُ بِكَ مِنْ عَذَابِ الْقَبْرِ، لاَ إِلَهَ إِلاَّ أَنْتَ.", count: 3 },
    { text: "أَعُوذُ بِكَلِمَاتِ اللَّهِ التَّامَّاتِ مِنْ شَرِّ مَا خَلَقَ.", count: 3 },
    { text: "حَسْبِيَ اللَّهُ لاَ إِلَهَ إِلاَّ هُوَ عَلَيْهِ تَوَكَّلْتُ وَهُوَ رَبُّ الْعَرْشِ الْعَظِيمِ.", count: 7 },
    { text: "بِسْمِ اللَّهِ الَّذِي لاَ يَضُرُّ مَعَ اسْمِهِ شَيْءٌ فِي الأَرْضِ وَلاَ فِي السَّمَاءِ وَهُوَ السَّمِيعُ الْعَلِيمُ.", count: 3 },
    { text: "اللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي الدُّنْيَا وَالآخِرَةِ.\n\nاللَّهُمَّ إِنِّي أَسْأَلُكَ الْعَفْوَ وَالْعَافِيَةَ فِي دِينِي وَدُنْيَايَ وَأَهْلِي وَمَالِي.\n\nاللَّهُمَّ اسْتُرْ عَوْرَاتِي وَآمِنْ رَوْعَاتِي.", count: 1 },
    { text: "اللَّهُمَّ إِنِّي أَعُوذُ بِكَ مِنَ الْهَمِّ وَالْحَزَنِ، وَأَعُوذُ بِكَ مِنَ الْعَجْزِ وَالْكَسَلِ، وَأَعُوذُ بِكَ مِنَ الْجُبْنِ وَالْبُخْلِ، وَأَعُوذُ بِكَ مِنْ غَلَبَةِ الدَّيْنِ وَقَهْرِ الرِّجَالِ.", count: 1 },
    { text: "سُبْحَانَ اللَّهِ وَبِحَمْدِهِ.", count: 100 },
    { text: "اللَّهُمَّ إِنَّكَ عَفُوٌّ تُحِبُّ الْعَفْوَ فَاعْفُ عَنِّي.", count: 3 },
    { text: "يَا حَيُّ يَا قَيُّومُ بِرَحْمَتِكَ أَسْتَغِيثُ، أَصْلِحْ لِي شَأْنِي كُلَّهُ وَلاَ تَكِلْنِي إِلَى نَفْسِي طَرْفَةَ عَيْنٍ.", count: 1 },
    { text: "اللَّهُمَّ صَلِّ وَسَلِّمْ عَلَى نَبِيِّنَا مُحَمَّدٍ ﷺ.", count: 10 }
  ],
  quran: [
    { text: "رَبَّنَا آتِنَا فِي الدُّنْيَا حَسَنَةً وَفِي الآخِرَةِ حَسَنَةً وَقِنَا عَذَابَ النَّارِ", count: 1 },
    { text: "رَبَّنَا لاَ تُزِغْ قُلُوبَنَا بَعْدَ إِذْ هَدَيْتَنَا وَهَبْ لَنَا مِن لَّدُنكَ رَحْمَةً إِنَّكَ أَنتَ الْوَهَّابُ", count: 1 },
    { text: "رَبِّ اشْرَحْ لِي صَدْرِي وَيَسِّرْ لِي أَمْرِي وَاحْلُلْ عُقْدَةً مِّن لِّسَانِي يَفْقَهُوا قَوْلِي", count: 1 },
    { text: "رَبِّ أَوْزِعْنِي أَنْ أَشْكُرَ نِعْمَتَكَ الَّتِي أَنْعَمْتَ عَلَيَّ وَعَلَى وَالِدَيَّ وَأَنْ أَعْمَلَ صَالِحًا تَرْضَاهُ", count: 1 },
    { text: "رَّبِّ زِدْنِي عِلْمًا", count: 1 }
  ]
};

function renderAthkarList(tab) {
  athkarListContainer.innerHTML = '';
  const items = athkarData[tab] || [];
  items.forEach((item) => {
    let currentCount = item.count;
    const card = document.createElement('div');
    card.className = 'athkar-card';
    card.innerHTML = `
      <p>${item.text}</p>
      <div class="athkar-card-footer">
        <span>التكرار الأصلي: ${item.count}</span>
        <button class="athkar-count-btn">التكرار المتبقي: ${currentCount}</button>
      </div>
    `;
    const btn = card.querySelector('.athkar-count-btn');
    btn.addEventListener('click', () => {
      if (currentCount > 1) {
        currentCount--;
        btn.textContent = `التكرار المتبقي: ${currentCount}`;
      } else {
        btn.textContent = 'تم ✓';
        btn.style.background = 'var(--accent-teal)';
      }
    });
    athkarListContainer.appendChild(card);
  });
}

function openAthkarModal() {
  if (athkarModal) {
    athkarModal.style.display = 'flex';
    renderAthkarList('sabah');
  }
}

if (openAthkarBtn) openAthkarBtn.addEventListener('click', openAthkarModal);
if (headerAthkarBtn) headerAthkarBtn.addEventListener('click', openAthkarModal);

if (closeAthkarBtn) {
  closeAthkarBtn.addEventListener('click', () => {
    athkarModal.style.display = 'none';
  });
}

if (athkarModal) {
  athkarModal.addEventListener('click', (e) => {
    if (e.target === athkarModal) {
      athkarModal.style.display = 'none';
    }
  });
}

document.querySelectorAll('.athkar-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.athkar-tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    renderAthkarList(btn.dataset.tab);
  });
});

// =====================================================
//  INITIALIZATION
// =====================================================
(async function init() {
  try {
    const [chaptersData, recitersData] = await Promise.all([
      fetchChapters(),
      fetchReciters()
    ]);

    chapters = chaptersData;
    reciters = recitersData;

    renderSurahList(chapters);
    renderReciters(reciters);

    console.log(`✅ تم تحميل ${chapters.length} سورة و ${reciters.length} قارئ`);
  } catch (err) {
    console.error('Failed to initialize:', err);
    surahListEl.innerHTML = '<li style="padding:20px;color:#999;">فشل تحميل البيانات. تحقق من الاتصال بالإنترنت.</li>';
  }
})();

