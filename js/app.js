(function () {
  'use strict';

  var Defaults = window.PassaparolaDefaults;
  var Storage = window.PassaparolaStorage;
  var Engine = window.PassaparolaEngine.Engine;
  var data = Storage.load();
  var engine = new Engine();
  var timerId = null;
  var endAt = 0;
  var startedAt = 0;
  var serverOffset = 0;
  var pausedRemaining = 0;
  var stoppedAt = 0;
  var player = '';
  var gameMode = 'idle';
  var locked = false;
  var stopped = false;
  var recorded = false;
  var lastRemaining = null;
  var adminTab = 'settings';
  var modalResolver = null;
  var recognition = null;
  var voiceMode = false;
  var USER_SETTINGS_KEY = 'tcdd_passaparola_user_settings_v1';
  var userSettings = { scale: 100, voiceSensitivity: 'normal', highContrast: false, reduceEffects: false };
  var PIN_LOCK_KEY = 'tcdd_passaparola_pin_lock_v1';

  function $(id) { return document.getElementById(id); }
  function escapeHtml(value) { var element = document.createElement('div'); element.textContent = String(value); return element.innerHTML; }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function format(seconds) { seconds = Math.max(0, Number(seconds) || 0); return String(Math.floor(seconds / 60)).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0'); }
  function toast(message) { $('toast').textContent = message; $('toast').className = 'show'; clearTimeout(toast.timer); toast.timer = setTimeout(function () { $('toast').className = ''; }, 2100); }
  function loadUserSettings() { try { userSettings = Object.assign({}, userSettings, JSON.parse(localStorage.getItem(USER_SETTINGS_KEY) || '{}')); } catch (error) {} userSettings.scale = Math.min(112, Math.max(78, Number(userSettings.scale) || 100)); }
  function applyUserSettings() { var root = document.documentElement, scale = userSettings.scale / 100; root.style.setProperty('--user-scale', scale.toFixed(2)); root.style.setProperty('--desktop-ring-max', Math.round(700 * scale) + 'px'); root.style.setProperty('--scaled-answer-height', Math.round(66 * scale) + 'px'); root.style.setProperty('--scaled-action-height', Math.round(76 * scale) + 'px'); root.style.setProperty('--scaled-base-font', Math.round(16 * scale) + 'px'); root.style.setProperty('--scaled-question-max', Math.round(37 * scale) + 'px'); root.style.setProperty('--scaled-letter-max', Math.round(56 * scale) + 'px'); root.style.setProperty('--scaled-core-max', Math.round(150 * scale) + 'px'); root.classList.toggle('high-contrast', Boolean(userSettings.highContrast)); root.classList.toggle('reduce-effects', Boolean(userSettings.reduceEffects)); if ($('uiScale')) { $('uiScale').value = userSettings.scale; $('uiScaleValue').textContent = userSettings.scale + '%'; $('voiceSensitivity').value = userSettings.voiceSensitivity; $('highContrast').checked = Boolean(userSettings.highContrast); $('reduceEffects').checked = Boolean(userSettings.reduceEffects); } localStorage.setItem(USER_SETTINGS_KEY, JSON.stringify(userSettings)); window.dispatchEvent(new CustomEvent('passaparola:layout-settings'));
  }
  function openUserSettings() { applyUserSettings(); $('userSettingsPanel').classList.remove('hidden'); $('userSettingsBtn').setAttribute('aria-expanded', 'true'); }
  function closeUserSettings() { $('userSettingsPanel').classList.add('hidden'); $('userSettingsBtn').setAttribute('aria-expanded', 'false'); }

  function hashPin(pin) {
    var bytes = new TextEncoder().encode('tcdd-passaparola:' + String(pin));
    return crypto.subtle.digest('SHA-256', bytes).then(function (buffer) {
      return Array.from(new Uint8Array(buffer)).map(function (byte) { return byte.toString(16).padStart(2, '0'); }).join('');
    });
  }

  var screenIds = ['modeScreen', 'onlineLobby', 'waitingRoom', 'teacherPanel', 'gameScreen', 'adminScreen'];
  function showScreen(id) {
    screenIds.forEach(function (screenId) { $(screenId).classList.toggle('hidden', screenId !== id); });
    document.body.dataset.screen = id.replace('Screen', '').replace('Room', '').replace('Panel', '').toLowerCase();
    requestAnimationFrame(function () { window.dispatchEvent(new CustomEvent('passaparola:layout-settings')); });
  }

  function openModal(html, onReady) {
    $('modalBody').innerHTML = html; $('modal').classList.remove('hidden');
    requestAnimationFrame(function () { if (onReady) onReady(); });
  }
  function closeModal(result) {
    $('modal').classList.add('hidden');
    if (modalResolver) { var resolve = modalResolver; modalResolver = null; resolve(result); }
  }
  function askPin(title) {
    if (modalResolver) closeModal(false);
    return new Promise(function (resolve) {
      modalResolver = resolve;
      var lock = pinLockState();
      if (lock.until > Date.now()) { modalResolver = null; resolve(false); showPinLock(lock.until); return; }
      openModal('<h2 id="modalTitle">' + escapeHtml(title || 'Yönetici PIN Kodu') + '</h2><p class="securityNote">3 hatalı girişten sonra panel 15 dakika kilitlenir.</p><label>PIN<input id="pinInput" type="password" inputmode="numeric" autocomplete="current-password"></label><button id="pinSubmit" class="action">GİRİŞ</button>', function () {
        var input = $('pinInput');
        async function submit() {
          var entered = input.value;
          var valid = Boolean(data.settings.adminPinHash) && await hashPin(entered) === data.settings.adminPinHash;
          if (valid) { localStorage.removeItem(PIN_LOCK_KEY); closeModal(true); }
          else {
            var failed = pinLockState(); failed.attempts += 1;
            if (failed.attempts >= 3) { failed = { attempts: 0, until: Date.now() + 15 * 60 * 1000 }; localStorage.setItem(PIN_LOCK_KEY, JSON.stringify(failed)); closeModal(false); showPinLock(failed.until); return; }
            localStorage.setItem(PIN_LOCK_KEY, JSON.stringify(failed)); input.value = ''; input.focus(); toast('PIN hatalı. Kalan deneme: ' + (3 - failed.attempts));
          }
        }
        $('pinSubmit').onclick = submit;
        input.onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); submit(); } };
        input.focus();
      });
    });
  }
  function pinLockState() { try { var state = JSON.parse(localStorage.getItem(PIN_LOCK_KEY) || '{}'); if (state.until && state.until <= Date.now()) { localStorage.removeItem(PIN_LOCK_KEY); return { attempts: 0, until: 0 }; } return { attempts: Number(state.attempts) || 0, until: Number(state.until) || 0 }; } catch (error) { return { attempts: 0, until: 0 }; } }
  function showPinLock(until) { var minutes = Math.max(1, Math.ceil((until - Date.now()) / 60000)); openModal('<h2 id="modalTitle">YÖNETİM GİRİŞİ KİLİTLENDİ</h2><p>Çok sayıda hatalı PIN denemesi algılandı. Bu tarayıcıda giriş yaklaşık <b>' + minutes + ' dakika</b> sonra yeniden açılacak.</p><p class="securityNote">Sayfayı yenilemek kilidi kaldırmaz.</p>'); }

  function activeQuestions() { return window.PassaparolaEngine.activeQuestions(data.questions); }
  function applySettings(settings) {
    var current = settings || data.settings;
    $('title').textContent = current.title; $('subtitle').textContent = current.subtitle;
    document.title = current.title + ' – ' + current.subtitle;
    if (!engine.running) $('timer').textContent = format(current.durationSeconds);
  }
  function buildRing() {
    $('ring').querySelectorAll('.letter').forEach(function (letter) { letter.remove(); });
    Defaults.letters.forEach(function (letter, index) {
      var element = document.createElement('div');
      var angle = (-90 + index * 360 / Defaults.letters.length) * Math.PI / 180;
      element.className = 'letter'; element.dataset.letter = letter; element.textContent = letter;
      element.style.left = (50 + 45 * Math.cos(angle)) + '%'; element.style.top = (50 + 45 * Math.sin(angle)) + '%';
      $('ring').appendChild(element);
    });
    renderRing();
  }
  function renderRing() {
    var enabled = {};
    var currentQuestions = engine.questions.length ? engine.questions : activeQuestions();
    currentQuestions.forEach(function (question) { enabled[question.letter] = true; });
    Defaults.letters.forEach(function (letter) {
      var element = document.querySelector('.letter[data-letter="' + letter + '"]');
      var status = engine.status[letter] || 'idle';
      var labels = { idle: 'bekliyor', active: 'aktif soru', correct: 'doğru cevaplandı', wrong: 'yanlış cevaplandı', passed: 'pas geçildi' };
      element.className = 'letter ' + status + (enabled[letter] ? '' : ' empty');
      element.setAttribute('aria-label', letter + ' harfi – ' + labels[status]);
    });
  }
  function setControls(enabled) {
    $('answerInput').disabled = !enabled; $('checkBtn').disabled = !enabled; $('passBtn').disabled = !enabled; $('voiceBtn').disabled = !enabled;
    if (!enabled) stopVoiceRecognition();
    if (enabled) { $('answerInput').value = ''; if (!voiceMode && !document.documentElement.classList.contains('mobile-ui')) $('answerInput').focus({ preventScroll: true }); }
  }
  function speechNormalize(value) { return String(value || '').toLocaleLowerCase('tr-TR').replace(/ı/g, 'i').replace(/ğ/g, 'g').replace(/ü/g, 'u').replace(/ş/g, 's').replace(/ö/g, 'o').replace(/ç/g, 'c').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function phoneticKey(value) { return speechNormalize(value).replace(/b|p/g, 'P').replace(/d|t/g, 'T').replace(/k|g/g, 'K').replace(/z|s/g, 'S').replace(/c|j/g, 'C').replace(/f|v/g, 'F').replace(/[ae]/g, 'A').replace(/[iu]/g, 'I').replace(/o/g, 'O').replace(/(.)\1+/g, '$1').replace(/\s/g, ''); }
  function editSimilarity(left, right) { if (left === right) return 1; if (!left.length || !right.length) return 0; var matrix = Array.from({ length: left.length + 1 }, function (_, row) { return Array.from({ length: right.length + 1 }, function (__, column) { return row ? (column ? 0 : row) : column; }); }); for (var i = 1; i <= left.length; i += 1) for (var j = 1; j <= right.length; j += 1) { var cost = left[i - 1] === right[j - 1] ? 0 : 1; matrix[i][j] = Math.min(matrix[i - 1][j] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j - 1] + cost); if (i > 1 && j > 1 && left[i - 1] === right[j - 2] && left[i - 2] === right[j - 1]) matrix[i][j] = Math.min(matrix[i][j], matrix[i - 2][j - 2] + cost); } return 1 - matrix[left.length][right.length] / Math.max(left.length, right.length); }
  function bigrams(value) { var compact = value.replace(/\s/g, ''); if (compact.length < 2) return compact ? [compact] : []; var result = []; for (var i = 0; i < compact.length - 1; i += 1) result.push(compact.slice(i, i + 2)); return result; }
  function diceSimilarity(left, right) { var a = bigrams(left), b = bigrams(right), used = {}, matches = 0; a.forEach(function (pair) { var index = b.findIndex(function (candidate, candidateIndex) { return candidate === pair && !used[candidateIndex]; }); if (index >= 0) { used[index] = true; matches += 1; } }); return a.length + b.length ? 2 * matches / (a.length + b.length) : 0; }
  function syllableShape(value) { return speechNormalize(value).replace(/[^aeiou]+/g, 'C').replace(/[aeiou]+/g, 'V').replace(/(.)\1+/g, '$1'); }
  function lcsSimilarity(left, right) { var row = Array(right.length + 1).fill(0); for (var i = 1; i <= left.length; i += 1) { var previous = 0; for (var j = 1; j <= right.length; j += 1) { var saved = row[j]; row[j] = left[i - 1] === right[j - 1] ? previous + 1 : Math.max(row[j], row[j - 1]); previous = saved; } } return Math.max(left.length, right.length) ? row[right.length] / Math.max(left.length, right.length) : 0; }
  function coreSimilarity(left, right) { var best = editSimilarity(left, right), maxLeft = Math.min(8, Math.floor(left.length * .42)), maxRight = Math.min(8, Math.floor(right.length * .42)); for (var a = 0; a <= maxLeft; a += 1) for (var b = 0; b <= maxRight; b += 1) { var l = left.slice(0, left.length - a), r = right.slice(0, right.length - b); if (l.length >= 4 && r.length >= 4) best = Math.max(best, editSimilarity(l, r) * .95); } return best; }
  function pronunciationScore(spoken, expected) { var left = speechNormalize(spoken).replace(/\s/g, ''), right = speechNormalize(expected).replace(/\s/g, ''); if (!left || !right) return 0; var maxLength = Math.max(left.length, right.length), lengthRatio = Math.min(left.length, right.length) / maxLength; if (lengthRatio < .48) return 0; var leftPhonetic = phoneticKey(left), rightPhonetic = phoneticKey(right); var score = coreSimilarity(left, right) * .27 + coreSimilarity(leftPhonetic, rightPhonetic) * .31 + diceSimilarity(leftPhonetic, rightPhonetic) * .17 + lcsSimilarity(leftPhonetic, rightPhonetic) * .13 + editSimilarity(syllableShape(left), syllableShape(right)) * .12; if (leftPhonetic[0] !== rightPhonetic[0] && score < .76) score *= .82; return Math.min(1, score); }
  function voiceThreshold(length) { var levels = { high: .52, normal: .57, flexible: .48 }, base = levels[userSettings.voiceSensitivity] || levels.normal; return length <= 3 ? Math.max(.72, base + .12) : length <= 5 ? base + .05 : base; }
  function tolerantVoiceAnswer(transcript) { var question = engine.current, best = null; if (!question) return null; question.acceptedAnswers.forEach(function (answer) { var score = pronunciationScore(transcript, answer); if (!best || score > best.score) best = { answer: answer, score: score, transcript: transcript }; }); var length = speechNormalize(transcript).replace(/\s/g, '').length; return best && best.score >= voiceThreshold(length) ? best : null; }
  function isPassCommand(transcript) { var normal = speechNormalize(transcript).replace(/\s/g, ''); if (/^pass?$/.test(normal) || /^pas[dt][ae]$/.test(normal)) return true; if (normal.indexOf('pas') !== 0) return false; var tail = normal.slice(3); return tail.length > 0 && tail.length <= 10 && (tail.indexOf('gec') === 0 || pronunciationScore(tail.slice(0, Math.min(4, tail.length)), 'gec') >= .42); }
  function selectVoiceResult(event) { var alternatives = event.results && event.results[0] ? Array.from(event.results[0]).map(function (item) { return item.transcript; }).filter(Boolean) : []; var command = alternatives.find(isPassCommand); if (command) return { command: 'pass', transcript: command }; var best = null; alternatives.forEach(function (transcript) { var match = tolerantVoiceAnswer(transcript); if (match && (!best || match.score > best.score)) best = match; }); return best || { transcript: alternatives[0] || '' }; }
  function setVoiceMode(active) { voiceMode = Boolean(active); document.documentElement.classList.toggle('voice-mode', voiceMode); $('answerInput').readOnly = voiceMode; if (voiceMode) { $('answerInput').setAttribute('inputmode', 'none'); $('answerInput').blur(); if (document.activeElement === $('answerInput')) document.body.focus(); } else $('answerInput').setAttribute('inputmode', 'text'); }
  function stopVoiceRecognition() { if (recognition) { try { recognition.abort(); } catch (error) {} recognition = null; } $('voiceBtn').classList.remove('listening'); $('voiceBtn').setAttribute('aria-pressed', 'false'); }
  function voiceError(message) { stopVoiceRecognition(); feedback(message, 'bad'); toast(message); }
  function startVoiceRecognition() {
    if ($('voiceBtn').disabled || locked || stopped) return;
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { voiceError('Bu tarayıcı sesli cevap özelliğini desteklemiyor.'); return; }
    setVoiceMode(true); stopVoiceRecognition(); recognition = new SpeechRecognition(); recognition.lang = 'tr-TR'; recognition.interimResults = false; recognition.maxAlternatives = 5; recognition.continuous = false;
    recognition.onstart = function () { $('voiceBtn').classList.add('listening'); $('voiceBtn').setAttribute('aria-pressed', 'true'); feedback('DİNLENİYOR… Cevabınızı söyleyin.', 'voiceFeedback'); };
    recognition.onresult = function (event) { var result = selectVoiceResult(event); stopVoiceRecognition(); if (!result.transcript) { voiceError('Ses anlaşılamadı. Lütfen tekrar deneyin.'); return; } if (result.command === 'pass') { feedback('SESLİ PAS KOMUTU ALINDI', 'passFeedback'); setTimeout(function () { act('pass'); }, 120); return; } $('answerInput').value = result.answer || result.transcript.trim(); feedback(result.answer ? 'FONETİK EŞLEŞME · %' + Math.round(result.score * 100) : 'Sesli cevap alındı.', result.answer ? 'ok' : 'voiceFeedback'); setTimeout(function () { act('answer'); }, 180); };
    recognition.onerror = function (event) { var messages = { 'not-allowed': 'Mikrofon izni verilmedi. Tarayıcı ayarlarından mikrofonu açın.', 'service-not-allowed': 'Ses tanıma hizmetine erişilemiyor.', 'no-speech': 'Ses algılanamadı. Mikrofona daha yakın konuşun.', 'audio-capture': 'Kullanılabilir bir mikrofon bulunamadı.', network: 'Ses tanıma için ağ bağlantısı kurulamadı.' }; voiceError(messages[event.error] || 'Sesli cevap alınamadı. Lütfen tekrar deneyin.'); };
    recognition.onend = function () { if (recognition) stopVoiceRecognition(); };
    try { recognition.start(); } catch (error) { voiceError('Mikrofon başlatılamadı. Lütfen tekrar deneyin.'); }
  }
  function showCurrent() {
    var question = engine.current; var letter = question ? question.letter : '—';
    $('activeLetter').textContent = letter; $('activeLetter2').textContent = letter;
    $('questionText').textContent = question ? question.question : 'Yarışma tamamlandı.';
    $('score').textContent = engine.score; renderRing(); setControls(engine.running && !locked && !stopped);
    emitProgress();
  }
  function feedback(text, className) { $('feedback').textContent = text; $('feedback').className = className || ''; }
  function setGameButton(state) {
    var button = $('startBtn');
    button.classList.toggle('stopped', state === 'stopped'); button.disabled = gameMode !== 'offline';
    button.textContent = state === 'running' ? '■ DURDUR' : state === 'stopped' ? '▶ DEVAM ET' : '▶ BAŞLAT';
    $('resetBtn').classList.toggle('hidden', state !== 'stopped');
  }

  function startOfflineDialog() {
    if (engine.running) { toast('Oyun zaten devam ediyor.'); return; }
    if (!activeQuestions().length) { openModal('<h2 id="modalTitle">OYUN BAŞLATILAMIYOR</h2><p>Yönetim Paneli’nden en az bir aktif soru oluşturun.</p>'); return; }
    openModal('<h2 id="modalTitle">YARIŞMAYA HAZIR MISINIZ?</h2><label>YARIŞMACI ADI<input id="playerName" maxlength="60" autocomplete="name"></label><button class="action" id="beginGame">OYUNU BAŞLAT</button>', function () {
      $('beginGame').onclick = beginOffline; $('playerName').onkeydown = function (event) { if (event.key === 'Enter') beginOffline(); }; $('playerName').focus();
    });
  }
  function beginOffline() {
    var name = $('playerName').value.trim(); if (!name) { toast('Yarışmacı adı zorunludur.'); return; }
    player = name; gameMode = 'offline'; recorded = false; locked = false; stopped = false;
    engine.start(data.questions); $('player').textContent = player; feedback(''); setGameButton('running'); closeModal(); showCurrent();
    startTimer(Date.now(), data.settings.durationSeconds, 0);
  }
  function enterOffline() {
    resetGame(); gameMode = 'offline'; document.body.classList.remove('onlineStudent'); showScreen('gameScreen'); setGameButton('idle');
  }

  function startTimer(startTimestamp, durationSeconds, offset) {
    stopTimer(); startedAt = Number(startTimestamp) || Date.now(); serverOffset = Number(offset) || 0;
    endAt = startedAt + Math.max(10, Number(durationSeconds) || 240) * 1000; lastRemaining = null;
    tick(); timerId = setInterval(tick, 250);
  }
  function stopTimer() { if (timerId) { clearInterval(timerId); timerId = null; } }
  function remainingSeconds() {
    var now = Date.now() + (gameMode === 'online' ? serverOffset : 0);
    return Math.max(0, Math.ceil((endAt - now) / 1000));
  }
  function tick() {
    var remaining = remainingSeconds();
    $('timer').textContent = format(remaining);
    $('timer').classList.toggle('urgent', data.settings.lastThirtyWarning && remaining <= 30);
    if (remaining !== lastRemaining) { lastRemaining = remaining; emitProgress(); }
    if (remaining <= 0) finish('Süre doldu');
  }
  function act(kind) {
    if (!engine.running || locked || stopped) return;
    locked = true; setControls(false);
    var result;
    if (kind === 'pass') { result = engine.resolve('passed'); feedback('PAS', 'passFeedback'); }
    else {
      var value = $('answerInput').value;
      if (!value.trim()) { locked = false; setControls(true); toast('Lütfen bir cevap girin.'); return; }
      result = engine.answer(value); feedback(result.correct ? 'DOĞRU' : 'YANLIŞ', result.correct ? 'ok' : 'bad');
    }
    showCurrent();
    setTimeout(function () {
      if (result.restart) { engine.restartRound(); feedback('YANLIŞ – A HARFİNDEN TEKRAR', 'bad'); }
      locked = false;
      if (result.ended) finish('Tamamlandı'); else showCurrent();
    }, result.restart ? 700 : 480);
  }
  function stopGame() {
    if (gameMode !== 'offline' || !engine.running || stopped) return;
    pausedRemaining = remainingSeconds(); stoppedAt = Date.now(); stopTimer(); stopped = true; locked = true;
    setControls(false); setGameButton('stopped'); feedback('OYUN DURDURULDU', 'bad'); toast('Oyun ve süre durduruldu.');
  }
  function resumeGame() {
    if (gameMode !== 'offline' || !engine.running || !stopped) return;
    startedAt += Date.now() - stoppedAt; endAt = Date.now() + pausedRemaining * 1000; stopped = false; locked = false;
    setGameButton('running'); feedback('OYUN DEVAM EDİYOR', 'ok'); showCurrent(); tick(); timerId = setInterval(tick, 250);
  }
  function resetGame() {
    stopTimer(); engine.reset(); player = ''; locked = false; recorded = false; stopped = false; lastRemaining = null;
    $('player').textContent = '—'; $('score').textContent = '0'; feedback('');
    $('questionText').textContent = 'Yarışmaya başlamak için BAŞLAT düğmesine basın.';
    $('activeLetter').textContent = $('activeLetter2').textContent = '—'; $('timer').textContent = format(data.settings.durationSeconds);
    setGameButton('idle'); renderRing(); setControls(false);
  }
  function snapshot(status) {
    return { name: player, score: engine.score, correct: engine.correct, wrong: engine.wrong,
      currentLetter: engine.current ? engine.current.letter : '—', remainingSeconds: remainingSeconds(),
      status: status || (engine.running ? 'playing' : 'finished') };
  }
  function emitProgress(status) { window.dispatchEvent(new CustomEvent('passaparola:progress', { detail: snapshot(status) })); }
  function finish(reason) {
    if (!engine.running && recorded) return;
    engine.running = false; stopTimer(); setControls(false); setGameButton('idle');
    var used = Math.max(0, Math.round(((gameMode === 'online' ? Date.now() + serverOffset : Date.now()) - startedAt) / 1000));
    if (gameMode === 'offline' && !recorded) {
      data.leaderboard.push({ id: Date.now() + '_' + Math.random().toString(36).slice(2), playerName: player, score: engine.score,
        totalQuestions: engine.questions.length, correct: engine.correct, wrong: engine.wrong, usedSeconds: used,
        finishReason: reason, playedAt: new Date().toISOString() });
      Storage.save(data);
    }
    recorded = true; renderRing(); emitProgress('finished');
    if (gameMode === 'online') {
      window.dispatchEvent(new CustomEvent('passaparola:finished', { detail: { reason: reason, snapshot: snapshot('finished') } }));
      return;
    }
    openModal('<h2 id="modalTitle">' + (reason === 'Süre doldu' ? 'SÜRE DOLDU!' : 'OYUN TAMAMLANDI') + '</h2><p><b>Yarışmacı:</b> ' + escapeHtml(player) + '</p><p><b>Doğru:</b> ' + engine.correct + ' &nbsp; <b>Yanlış:</b> ' + engine.wrong + ' &nbsp; <b>Puan:</b> ' + engine.score + '</p><button class="action" id="showLocalLeaders">LİDERLİK SIRALAMASI</button><button class="action" id="newGame">YENİ OYUN</button>', function () {
      $('showLocalLeaders').onclick = function () { closeModal(); showLocalLeaderboard(); };
      $('newGame').onclick = function () { closeModal(); resetGame(); startOfflineDialog(); };
    });
  }
  function showLocalLeaderboard() {
    var leaders = sortedLeaders(); $('roomLabel').textContent = 'Çevrimdışı sonuçlar';
    $('livePlayers').innerHTML = leaders.map(function (entry, index) { return '<li><span>' + (index + 1) + '. ' + escapeHtml(entry.playerName) + '</span><span>' + entry.score + ' puan · ' + format(entry.usedSeconds) + '</span></li>'; }).join('') || '<li>Henüz sonuç yok.</li>';
    $('liveBoard').classList.remove('hidden');
  }

  function startOnlineGame(options) {
    data.settings = Object.assign({}, data.settings, options.settings || {});
    var roomQuestions = (options.questions || []).map(function (question) { var copy = clone(question); copy.enabled = true; return copy; });
    player = String(options.playerName || 'Online Oyuncu'); gameMode = 'online'; recorded = false; locked = false; stopped = false;
    document.body.classList.add('onlineStudent'); showScreen('gameScreen'); applySettings(data.settings);
    engine.start(roomQuestions); $('player').textContent = player; feedback('ONLINE ODA BAŞLADI', 'ok'); setGameButton('running'); showCurrent();
    startTimer(options.startAt, data.settings.durationSeconds, options.serverOffset || 0);
  }
  function finishOnlineFromTeacher() { if (gameMode === 'online' && !recorded) finish('Öğretmen yarışmayı bitirdi'); }

  function requestAdmin() {
    askPin('Yönetici PIN Kodu').then(function (allowed) { if (allowed) { adminTab = 'settings'; showScreen('adminScreen'); renderAdmin(); } });
  }
  function activeCount() { return activeQuestions().length; }
  function backupToolbar() { return '<div class="backupToolbar"><span>Yerel oda verileri</span><button class="action quickExport" type="button">YEDEĞİ İNDİR</button><label class="quiet fileAction">YEDEĞİ GERİ YÜKLE<input class="quickImport" type="file" accept="application/json,.json" hidden></label></div>'; }
  function bindBackupToolbar() { document.querySelectorAll('.quickExport').forEach(function (button) { button.onclick = exportData; }); document.querySelectorAll('.quickImport').forEach(function (input) { input.onchange = importData; }); }
  function renderAdmin() {
    document.querySelectorAll('.admin nav button').forEach(function (button) { button.classList.toggle('selected', button.dataset.tab === adminTab); });
    if (adminTab === 'settings') renderSettings();
    else if (adminTab === 'questions') renderQuestions('', null);
    else if (adminTab === 'leaders') renderLeaders();
    else renderBackup();
    if (adminTab !== 'backup') { $('adminContent').insertAdjacentHTML('afterbegin', backupToolbar()); bindBackupToolbar(); }
  }
  function renderSettings() {
    $('adminContent').innerHTML = '<div class="card"><h2>Genel Ayarlar</h2><div class="formGrid"><label>Oyun başlığı<input id="setTitle" value="' + escapeHtml(data.settings.title) + '"></label><label>Alt başlık<input id="setSub" value="' + escapeHtml(data.settings.subtitle) + '"></label><label>Oyun süresi (10–3600 saniye)<input id="setDuration" type="number" min="10" max="3600" value="' + data.settings.durationSeconds + '"></label><label>Yeni yönetici PIN’i<input id="setPin" type="password" inputmode="numeric" minlength="6" maxlength="12" placeholder="Değiştirmek istemiyorsanız boş bırakın"></label><label><input id="setWarning" type="checkbox" ' + (data.settings.lastThirtyWarning ? 'checked' : '') + '> Son 30 saniye uyarısı</label><div><b>Aktif Soru: ' + activeCount() + ' / ' + Defaults.letters.length + '</b></div></div><button id="saveSettings" class="action">AYARLARI KAYDET</button></div>';
    $('saveSettings').onclick = async function () {
      var newPin = $('setPin').value.trim();
      if (newPin && !/^\d{6,12}$/.test(newPin)) { toast('PIN 6–12 rakamdan oluşmalıdır.'); return; }
      var currentHash = data.settings.adminPinHash || Defaults.settings.adminPinHash;
      data.settings = { title: $('setTitle').value.trim() || Defaults.settings.title, subtitle: $('setSub').value.trim() || Defaults.settings.subtitle,
        durationSeconds: Math.min(3600, Math.max(10, Number($('setDuration').value) || 240)), lastThirtyWarning: $('setWarning').checked,
        adminPinHash: newPin ? await hashPin(newPin) : currentHash };
      Storage.save(data); applySettings(); toast('Ayarlar kaydedildi.'); renderSettings();
    };
  }
  function questionPool(letter) { return data.questions.filter(function (question) { return question.letter === letter; }); }
  function renderQuestions(search, openLetter) {
    var filter = String(search || '').toLocaleLowerCase('tr-TR');
    var accordions = Defaults.letters.filter(function (letter) {
      return letter.toLocaleLowerCase('tr-TR').includes(filter) || questionPool(letter).some(function (question) { return question.question.toLocaleLowerCase('tr-TR').includes(filter); });
    }).map(function (letter) {
      var pool = questionPool(letter); var selected = pool.find(function (question) { return question.selected; }) || pool[0]; var enabled = pool.some(function (question) { return question.enabled; });
      return '<details class="letterAccordion" data-letter="' + letter + '" ' + (openLetter === letter ? 'open' : '') + '><summary><span class="letterBadge">' + letter + '</span><span><b>' + escapeHtml(selected && selected.question || 'Henüz soru girilmedi') + '</b><br><span class="questionCount">' + pool.length + ' soru · ' + (enabled ? 'Aktif' : 'Pasif') + '</span></span><label class="letterEnable" onclick="event.stopPropagation()"><input type="checkbox" ' + (enabled ? 'checked' : '') + '> Harfi kullan</label></summary><div class="letterAccordionBody">' + pool.map(function (question, index) {
        return '<div class="poolItem" data-id="' + escapeHtml(question.id) + '"><label class="poolChoice"><input type="radio" name="selected_' + letter + '" value="' + escapeHtml(question.id) + '" ' + (question === selected ? 'checked' : '') + '> Online ve çevrimdışı oyunda bu soru seçilsin</label><label>Soru ' + (index + 1) + '<textarea class="poolQuestion" rows="3">' + escapeHtml(question.question) + '</textarea></label><label>Ana doğru cevap<input class="poolMain" value="' + escapeHtml(question.acceptedAnswers[0] || '') + '"></label><label>Alternatif doğru cevaplar<input class="poolAlt" value="' + escapeHtml(question.acceptedAnswers.slice(1).join(', ')) + '" placeholder="Virgülle ayırın"></label>' + (pool.length > 1 ? '<button class="danger removePool" data-id="' + escapeHtml(question.id) + '">SORUYU SİL</button>' : '') + '</div>';
      }).join('') + '<div class="poolActions">' + (pool.length < 4 ? '<button class="quiet addPool">＋ YENİ SORU EKLE</button>' : '') + '<button class="action saveLetter">' + letter + ' HARFİNİ KAYDET</button></div></div></details>';
    }).join('');
    $('adminContent').innerHTML = '<div class="card"><h2>Soru Bankası <small>Aktif Harf: ' + activeCount() + ' / ' + Defaults.letters.length + '</small></h2><p>Her harf için en fazla 4 soru ve alternatif cevaplar tanımlayın. Seçili soru yarışmada kullanılır.</p><input id="qSearch" placeholder="Harf veya soruda ara…" value="' + escapeHtml(search || '') + '"></div>' + accordions;
    $('qSearch').oninput = function () { renderQuestions(this.value, null); };
    document.querySelectorAll('.letterAccordion').forEach(function (details) {
      var letter = details.dataset.letter;
      var add = details.querySelector('.addPool'); if (add) add.onclick = function () {
        var pool = questionPool(letter); if (pool.length >= 4) return;
        data.questions.push({ id: 'q_' + Date.now() + '_' + Math.random().toString(36).slice(2), letter: letter, question: '', acceptedAnswers: [], enabled: false, selected: false });
        renderQuestions($('qSearch').value, letter);
      };
      details.querySelectorAll('.removePool').forEach(function (button) { button.onclick = function () {
        if (!confirm('Bu soru havuzdan silinecek. Emin misiniz?')) return;
        data.questions = data.questions.filter(function (question) { return question.id !== button.dataset.id; });
        renderQuestions($('qSearch').value, letter);
      }; });
      details.querySelector('.saveLetter').onclick = function () { saveLetter(details); };
    });
  }
  function saveLetter(details) {
    var letter = details.dataset.letter; var pool = questionPool(letter);
    details.querySelectorAll('.poolItem').forEach(function (item) {
      var question = pool.find(function (candidate) { return candidate.id === item.dataset.id; });
      if (!question) return;
      question.question = item.querySelector('.poolQuestion').value.trim();
      question.acceptedAnswers = [item.querySelector('.poolMain').value].concat(item.querySelector('.poolAlt').value.split(',')).map(function (answer) { return answer.trim(); }).filter(Boolean);
    });
    var selectedInput = details.querySelector('input[type="radio"]:checked'); var enabled = details.querySelector('.letterEnable input').checked;
    var selected = selectedInput && pool.find(function (question) { return question.id === selectedInput.value; });
    if (!selected || !selected.question || !selected.acceptedAnswers.length) { toast('Seçili sorunun metni ve ana cevabı zorunludur.'); return; }
    pool.forEach(function (question) { question.selected = question === selected; question.enabled = enabled && question === selected; });
    Storage.save(data); buildRing(); toast(letter + ' harfi kaydedildi.'); renderQuestions($('qSearch').value, letter);
  }
  function sortedLeaders() { return data.leaderboard.slice().sort(function (a, b) { return b.score - a.score || a.usedSeconds - b.usedSeconds || new Date(a.playedAt) - new Date(b.playedAt); }); }
  function renderLeaders() {
    var rows = sortedLeaders().map(function (entry, index) { return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(entry.playerName) + '</td><td>' + entry.score + '/' + entry.totalQuestions + '</td><td>' + format(entry.usedSeconds) + '</td><td>' + new Date(entry.playedAt).toLocaleString('tr-TR') + '</td><td><button class="danger delLeader" data-id="' + entry.id + '">SİL</button></td></tr>'; }).join('') || '<tr><td colspan="6">Henüz kayıt yok.</td></tr>';
    $('adminContent').innerHTML = '<div class="card"><h2>Liderlik Tablosu</h2><table class="leader"><thead><tr><th>#</th><th>YARIŞMACI</th><th>PUAN</th><th>SÜRE</th><th>TARİH</th><th></th></tr></thead><tbody>' + rows + '</tbody></table><button id="clearLeaders" class="danger">TÜMÜNÜ TEMİZLE</button></div>';
    document.querySelectorAll('.delLeader').forEach(function (button) { button.onclick = function () { data.leaderboard = data.leaderboard.filter(function (entry) { return entry.id !== button.dataset.id; }); Storage.save(data); renderLeaders(); }; });
    $('clearLeaders').onclick = function () { if (confirm('Bütün sonuçlar silinecek. Emin misiniz?')) { data.leaderboard = []; Storage.save(data); renderLeaders(); } };
  }
  function renderBackup() {
    $('adminContent').innerHTML = '<div class="card"><h2>Yedekleme / Geri Yükleme</h2><p>Sorular, ayarlar ve liderlik kayıtları tek JSON dosyasında taşınır.</p><button id="exportBtn" class="action">YEDEĞİ İNDİR</button> <label class="quiet" style="display:inline-block">YEDEĞİ GERİ YÜKLE<input id="importFile" type="file" accept="application/json,.json" hidden></label><p><button id="resetData" class="danger">VARSAYILANLARA DÖN</button></p></div>';
    $('exportBtn').onclick = exportData; $('importFile').onchange = importData;
    $('resetData').onclick = function () { if (confirm('Tüm yerel veriler varsayılana dönecek. Emin misiniz?')) { data = Storage.fresh(); Storage.save(data); applySettings(); buildRing(); renderBackup(); toast('Varsayılan veriler yüklendi.'); } };
  }
  function localBackup() { return { backupType: 'tcdd-passaparola-room', version: 1, exportedAt: new Date().toISOString(), roomCode: 'yerel', status: 'tamamlandı', settings: clone(data.settings), questions: clone(activeQuestions()), leaderboard: clone(sortedLeaders()) }; }
  function downloadBackup(backup) { var blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }); var link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = 'oda-' + String(backup.roomCode || 'yerel').toLowerCase() + '-yedek.json'; link.click(); setTimeout(function () { URL.revokeObjectURL(link.href); }, 500); }
  function exportData() { downloadBackup(localBackup()); toast('Oda yedeği indirildi.'); }
  function backupReport(backup) { var settings = backup.settings || {}; var leaders = Array.isArray(backup.leaderboard) ? backup.leaderboard : []; var questions = Array.isArray(backup.questions) ? backup.questions : []; var rules = '<li>Süre: <b>' + format(settings.durationSeconds || 0) + '</b></li><li>Son 30 saniye uyarısı: <b>' + (settings.lastThirtyWarning ? 'Açık' : 'Kapalı') + '</b></li><li>Soru sayısı: <b>' + questions.length + '</b></li>'; var rows = leaders.map(function (entry, index) { return '<tr><td>' + (index + 1) + '</td><td>' + escapeHtml(entry.name || entry.playerName || 'İsimsiz') + '</td><td>' + (Number(entry.score) || 0) + '</td><td>' + (entry.correct == null ? '—' : Number(entry.correct)) + '</td></tr>'; }).join('') || '<tr><td colspan="4">Bu yedekte sıralama kaydı yok.</td></tr>'; openModal('<div class="backupReport"><span class="reportTag">GEÇMİŞ ODA RAPORU</span><h2 id="modalTitle">Oda ' + escapeHtml(backup.roomCode || 'yerel') + '</h2><p>Bu rapor yalnızca görüntülenir; canlı odaya veri yazmaz.</p><ul>' + rules + '</ul><h3>Yarışma sonu sıralaması</h3><div class="reportTableWrap"><table><thead><tr><th>#</th><th>Yarışmacı</th><th>Puan</th><th>Doğru</th></tr></thead><tbody>' + rows + '</tbody></table></div></div>'); }
  function importData(event) { var file = event.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var parsed = JSON.parse(reader.result); if (parsed.backupType !== 'tcdd-passaparola-room' || !parsed.settings || !Array.isArray(parsed.questions) || !Array.isArray(parsed.leaderboard)) throw Error('invalid'); backupReport(parsed); event.target.value = ''; } catch (error) { toast('Geçersiz yedek; mevcut veriler korunuyor.'); } }; reader.readAsText(file, 'utf-8'); }

  function init() {
    applySettings(); buildRing(); resetGame();
    $('startBtn').onclick = function () { if (stopped) resumeGame(); else if (engine.running) stopGame(); else startOfflineDialog(); };
    $('resetBtn').onclick = function () { if (stopped && confirm('Durdurulan yarışma kaydedilmeden silinecek. Emin misiniz?')) resetGame(); };
    $('checkBtn').onclick = function () { act('answer'); }; $('passBtn').onclick = function () { act('pass'); };
    $('voiceBtn').onclick = function () { if ($('voiceBtn').classList.contains('listening')) stopVoiceRecognition(); else startVoiceRecognition(); };
    $('answerInput').onpointerdown = function () { setVoiceMode(false); };
    $('answerInput').onkeydown = function (event) { if (event.key === 'Enter') { event.preventDefault(); act('answer'); } };
    $('homeAdminBtn').onclick = requestAdmin;
    $('fullBtn').onclick = function () { if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(function () { toast('Tam ekran kullanılamıyor.'); }); else toast('Tam ekran desteklenmiyor.'); };
    $('gameHome').onclick = function () { if (gameMode === 'online') return; if (engine.running && !confirm('Devam eden oyun sonlandırılacak. Ana sayfaya dönülsün mü?')) return; resetGame(); gameMode = 'idle'; showScreen('modeScreen'); };
    $('modalClose').onclick = function () { closeModal(false); }; $('modal').onclick = function (event) { if (event.target === $('modal')) closeModal(false); };
    $('closeAdmin').onclick = function () { showScreen('modeScreen'); };
    document.querySelectorAll('.admin nav button').forEach(function (button) { button.onclick = function () { adminTab = button.dataset.tab; renderAdmin(); }; });
    $('closeLive').onclick = function () { $('liveBoard').classList.add('hidden'); };
    $('leaderHome').onclick = function () { $('liveBoard').classList.add('hidden'); if (gameMode !== 'online') { resetGame(); showScreen('modeScreen'); } else window.dispatchEvent(new CustomEvent('passaparola:home-request')); };
    loadUserSettings(); applyUserSettings(); $('userSettingsBtn').onclick = openUserSettings; $('userSettingsClose').onclick = closeUserSettings;
    $('uiScale').oninput = function () { userSettings.scale = Number(this.value); applyUserSettings(); };
    $('voiceSensitivity').onchange = function () { userSettings.voiceSensitivity = this.value; applyUserSettings(); };
    $('highContrast').onchange = function () { userSettings.highContrast = this.checked; applyUserSettings(); };
    $('reduceEffects').onchange = function () { userSettings.reduceEffects = this.checked; applyUserSettings(); };
    $('resetUserSettings').onclick = function () { userSettings = { scale: 100, voiceSensitivity: 'normal', highContrast: false, reduceEffects: false }; applyUserSettings(); toast('Kullanıcı ayarları sıfırlandı.'); };
    window.addEventListener('beforeunload', stopTimer);
  }

  document.addEventListener('DOMContentLoaded', init);
  window.PassaparolaApp = {
    showScreen: showScreen, enterOffline: enterOffline, askPin: askPin, requestAdmin: requestAdmin,
    getData: function () { return clone(data); }, getActiveQuestions: function () { return clone(activeQuestions()); },
    startOnlineGame: startOnlineGame, finishOnlineFromTeacher: finishOnlineFromTeacher,
    showOnlineLeaderboard: function (roomCode, players) {
      $('roomLabel').textContent = 'Oda: ' + roomCode;
      $('livePlayers').innerHTML = players.map(function (entry, index) { return '<li><span>' + (index + 1) + '. ' + escapeHtml(entry.name || 'İsimsiz') + '</span><span>' + (entry.score || 0) + ' puan · ' + (entry.status === 'finished' ? 'tamamlandı' : entry.currentLetter || '—') + '</span></li>'; }).join('') || '<li>Henüz sonuç yok.</li>';
      $('liveBoard').classList.remove('hidden');
    },
    toast: toast, format: format, snapshot: snapshot, resetGame: resetGame, downloadBackup: downloadBackup, showBackupReport: backupReport
  };
  window.PassaparolaAppTest = { resetGame: resetGame, speechNormalize: speechNormalize, pronunciationScore: pronunciationScore, tolerantVoiceAnswer: tolerantVoiceAnswer, isPassCommand: isPassCommand };
})();
