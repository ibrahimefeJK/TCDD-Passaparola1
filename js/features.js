(function () {
  'use strict';

  var installPrompt = null;
  var firebaseState = null;
  var roomCode = '';
  var roomRef = null;
  var playerId = '';
  var playerName = '';
  var role = '';
  var roomStatus = '';
  var roomUnsubscribe = null;
  var offsetUnsubscribe = null;
  var serverOffset = 0;
  var onlineGameStarted = false;
  var latestPlayers = [];
  var latestRoom = null;
  var lastProgressKey = '';
  var safeAreaCache = { key: '', top: 0, right: 0, bottom: 0, left: 0 };

  function $(id) { return document.getElementById(id); }
  function show(id) { window.PassaparolaApp.showScreen(id); }
  function setStatus(message) { $('onlineStatus').textContent = message || ''; }
  function escapeHtml(value) { var element = document.createElement('div'); element.textContent = String(value); return element.innerHTML; }
  function isStandalone() { return matchMedia('(display-mode: standalone)').matches || navigator.standalone === true; }

  function detectDevice() {
    var mobileAgent = /Android|iPhone|iPad|iPod|Mobile|Tablet/i.test(navigator.userAgent);
    var mobileMedia = matchMedia('(max-width: 820px)').matches || matchMedia('(pointer: coarse)').matches;
    document.documentElement.classList.toggle('mobile-ui', mobileAgent || mobileMedia);
    document.documentElement.classList.toggle('standalone', isStandalone());
    updateViewport();
  }
  function updateViewport() {
    var viewport = window.visualViewport; var height = viewport ? viewport.height : window.innerHeight; var width = viewport ? viewport.width : window.innerWidth;
    var root = document.documentElement; var portrait = height >= width; var safe = safeAreaInsets(width, height); var game = $('gameScreen'), world = $('gameWorld'); var gameVisible = game && !game.classList.contains('hidden'); var layoutWidth = gameVisible && world ? world.clientWidth : width, layoutHeight = gameVisible && world ? world.clientHeight : height; var headerHeight = gameVisible ? world.querySelector('header').offsetHeight : (height < 650 ? 50 : 58); var scoreHeight = gameVisible ? world.querySelector('.scorebar').offsetHeight : (height < 650 ? 86 : 98); var stageBudget = Math.max(220, layoutHeight - headerHeight - scoreHeight - safe.top - safe.bottom); var playMinimum = 194; var verticalRingBudget = Math.max(126, stageBudget - playMinimum - 10); var ringSize = portrait ? Math.min((layoutWidth - safe.left - safe.right - 18) * .78, layoutHeight * .39, verticalRingBudget, 356) : Math.min((layoutHeight - headerHeight - scoreHeight - safe.top - safe.bottom - 12) * .92, layoutWidth * .42, 342);
    var controlHeight = Math.max(36, Math.min(54, 48, stageBudget * .14)); var questionFont = Math.max(12, Math.min(23, layoutHeight * .024));
    root.style.setProperty('--app-height', Math.round(height) + 'px'); root.style.setProperty('--app-width', Math.round(width) + 'px'); root.style.setProperty('--screen-ratio', (width / Math.max(1, height)).toFixed(4)); root.style.setProperty('--safe-top-px', safe.top + 'px'); root.style.setProperty('--safe-right-px', safe.right + 'px'); root.style.setProperty('--safe-bottom-px', safe.bottom + 'px'); root.style.setProperty('--safe-left-px', safe.left + 'px'); root.style.setProperty('--stage-budget', Math.round(stageBudget) + 'px'); root.style.setProperty('--ring-size', Math.max(126, Math.round(ringSize)) + 'px'); root.style.setProperty('--ring-zone', Math.max(132, Math.round(ringSize + 6)) + 'px'); root.style.setProperty('--mobile-control-height', Math.round(controlHeight) + 'px'); root.style.setProperty('--mobile-question-font', questionFont.toFixed(1) + 'px');
    root.classList.toggle('landscape-ui', width > height); root.classList.toggle('short-viewport', height < 650); root.classList.toggle('very-short-viewport', height < 540); root.classList.toggle('narrow-viewport', width < 360); root.classList.toggle('tall-viewport', height >= 800);
    var keyboardOpen = window.visualViewport && window.visualViewport.height < window.innerHeight * 0.76;
    root.classList.toggle('keyboard-open', Boolean(keyboardOpen) && !root.classList.contains('voice-mode'));
  }
  function safeAreaInsets(width, height) { var key = Math.round(width) + 'x' + Math.round(height); if (safeAreaCache.key === key) return safeAreaCache; var probe = document.createElement('div'); probe.style.cssText = 'position:fixed;visibility:hidden;pointer-events:none;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)'; document.body.appendChild(probe); var style = getComputedStyle(probe); safeAreaCache = { key: key, top: parseFloat(style.paddingTop) || 0, right: parseFloat(style.paddingRight) || 0, bottom: parseFloat(style.paddingBottom) || 0, left: parseFloat(style.paddingLeft) || 0 }; probe.remove(); return safeAreaCache; }
  function finishSplash() {
    setTimeout(function () {
      $('splash').classList.add('fade');
      setTimeout(function () { $('splash').remove(); show('modeScreen'); }, 480);
    }, 2500);
  }
  function installSupport() {
    window.addEventListener('beforeinstallprompt', function (event) {
      event.preventDefault(); installPrompt = event; if (!isStandalone()) $('installBtn').classList.remove('hidden');
    });
    $('installBtn').onclick = async function () {
      if (!installPrompt) return;
      installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; $('installBtn').classList.add('hidden');
    };
    window.addEventListener('appinstalled', function () { $('installBtn').classList.add('hidden'); });
    if (/iPhone|iPad|iPod/i.test(navigator.userAgent) && !isStandalone()) $('iosHelp').classList.remove('hidden');
    $('iosHelp').onclick = function () { alert('Safari’de Paylaş düğmesine dokunun, ardından “Ana Ekrana Ekle” seçeneğini seçin.'); };
    if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./service-worker.js').catch(function (error) { console.error('Service Worker:', error); });
  }

  async function firebase() {
    if (firebaseState) return firebaseState;
    var config = window.PASSAPAROLA_FIREBASE_CONFIG;
    if (!config || /BURAYA|PROJE_ID/.test(JSON.stringify(config))) throw Error('Firebase ayarları henüz yapılandırılmamış.');
    var appSdk = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js');
    var dbSdk = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-database.js');
    var authSdk = await import('https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js');
    var app = appSdk.initializeApp(config);
    var credential = await authSdk.signInAnonymously(authSdk.getAuth(app));
    firebaseState = { db: dbSdk.getDatabase(app), api: dbSdk, user: credential.user };
    offsetUnsubscribe = dbSdk.onValue(dbSdk.ref(firebaseState.db, '.info/serverTimeOffset'), function (snapshot) { serverOffset = Number(snapshot.val()) || 0; });
    return firebaseState;
  }
  function randomCode() { return String(Math.floor(100000 + Math.random() * 900000)); }
  async function unusedRoomCode(state) {
    for (var attempt = 0; attempt < 8; attempt += 1) {
      var code = randomCode(); var snapshot = await state.api.get(state.api.ref(state.db, 'rooms/' + code));
      if (!snapshot.exists()) return code;
    }
    throw Error('Oda kodu üretilemedi. Lütfen yeniden deneyin.');
  }
  function playerArray(players) {
    return Object.keys(players || {}).map(function (id) { return Object.assign({ id: id }, players[id]); }).sort(function (a, b) {
      return (b.score || 0) - (a.score || 0) || String(a.name || '').localeCompare(String(b.name || ''), 'tr');
    });
  }
  function roomBackup() {
    if (!roomCode || !latestRoom) return null;
    return { backupType: 'tcdd-passaparola-room', version: 1, exportedAt: new Date().toISOString(), roomCode: roomCode,
      status: latestRoom.status || roomStatus, settings: Object.assign({}, latestRoom.settings || {}), questions: JSON.parse(JSON.stringify(latestRoom.questions || [])),
      rules: { selectedQuestionIds: (latestRoom.questions || []).map(function (question) { return question.id; }), finishReason: latestRoom.finishReason || null },
      leaderboard: playerArray(latestRoom.players).map(function (entry) { return { name: entry.name || 'İsimsiz', score: Number(entry.score) || 0, correct: Number(entry.correct) || 0, wrong: Number(entry.wrong) || 0, status: entry.status || 'waiting', remainingSeconds: Number(entry.remainingSeconds) || 0 }; }) };
  }
  function exportRoomBackup() { var backup = roomBackup(); if (!backup) { window.PassaparolaApp.toast('Yedeklenecek oda verisi bulunamadı.'); return; } window.PassaparolaApp.downloadBackup(backup); window.PassaparolaApp.toast('Oda ' + roomCode + ' yedeği indirildi.'); }
  function importRoomBackup(event) { var file = event.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function () { try { var backup = JSON.parse(reader.result); if (backup.backupType !== 'tcdd-passaparola-room' || !backup.settings || !Array.isArray(backup.questions) || !Array.isArray(backup.leaderboard)) throw Error('invalid'); window.PassaparolaApp.showBackupReport(backup); event.target.value = ''; } catch (error) { window.PassaparolaApp.toast('Geçersiz oda yedeği; canlı veriler değiştirilmedi.'); } }; reader.readAsText(file, 'utf-8'); }
  function clearRoomListeners() {
    if (roomUnsubscribe) roomUnsubscribe(); roomUnsubscribe = null;
    lastProgressKey = ''; latestPlayers = []; latestRoom = null;
  }
  function resetOnlineState() {
    clearRoomListeners(); roomCode = ''; roomRef = null; playerId = ''; playerName = ''; role = ''; roomStatus = '';
    onlineGameStarted = false; document.body.classList.remove('onlineStudent');
  }

  async function createRoom() {
    var allowed = await window.PassaparolaApp.askPin('Öğretmen PIN Kodu'); if (!allowed) return;
    var local = window.PassaparolaApp.getData(); var questions = window.PassaparolaApp.getActiveQuestions();
    if (!questions.length) { setStatus('Yönetim Paneli’nden en az bir aktif soru seçin.'); return; }
    try {
      setStatus('Oda hazırlanıyor…'); var state = await firebase(); var code = await unusedRoomCode(state);
      roomCode = code; role = 'teacher'; roomRef = state.api.ref(state.db, 'rooms/' + code); roomStatus = 'waiting';
      await state.api.set(roomRef, {
        teacherUid: state.user.uid, teacherOnline: true, createdAt: state.api.serverTimestamp(), status: 'waiting',
        settings: { title: local.settings.title, subtitle: local.settings.subtitle, durationSeconds: local.settings.durationSeconds, lastThirtyWarning: local.settings.lastThirtyWarning },
        questions: questions, players: {}
      });
      state.api.onDisconnect(state.api.ref(state.db, 'rooms/' + code + '/teacherOnline')).set(false);
      renderTeacherSetup(code, questions, local.settings); show('teacherPanel'); listenRoom(code, 'teacher');
    } catch (error) { setStatus('Oda oluşturulamadı: ' + error.message); }
  }
  function renderTeacherSetup(code, questions, settings) {
    $('teacherRoomCode').textContent = code; $('teacherDuration').value = settings.durationSeconds || 240;
    $('teacherQuestionList').innerHTML = questions.map(function (question) { return '<label title="' + escapeHtml(question.question) + '"><input type="checkbox" value="' + escapeHtml(question.id) + '" checked><span>' + question.letter + '</span></label>'; }).join('');
    $('teacherStart').classList.remove('hidden'); $('teacherStart').disabled = false; $('teacherFinish').classList.add('hidden');
    $('teacherDuration').disabled = false; $('teacherQuestionList').querySelectorAll('input').forEach(function (input) { input.disabled = false; });
    $('teacherStatus').textContent = 'Öğrenciler bekleniyor.';
  }
  async function startRoom() {
    if (role !== 'teacher' || !firebaseState || roomStatus !== 'waiting') return;
    var checked = Array.from($('teacherQuestionList').querySelectorAll('input:checked')).map(function (input) { return input.value; });
    var questions = window.PassaparolaApp.getActiveQuestions().filter(function (question) { return checked.indexOf(question.id) >= 0; });
    var duration = Math.min(3600, Math.max(10, Number($('teacherDuration').value) || 240));
    if (!questions.length) { window.PassaparolaApp.toast('En az bir soru seçin.'); return; }
    try {
      $('teacherStart').disabled = true; $('teacherStatus').textContent = 'Yarışma tüm öğrencilere gönderiliyor…';
      await firebaseState.api.update(roomRef, {
        status: 'running', startAt: firebaseState.api.serverTimestamp(), startedBy: firebaseState.user.uid,
        startRevision: Date.now() + '_' + Math.random().toString(36).slice(2), questions: questions,
        settings: Object.assign({}, latestRoom && latestRoom.settings || {}, { durationSeconds: duration })
      });
    } catch (error) { $('teacherStart').disabled = false; $('teacherStatus').textContent = 'Başlatılamadı: ' + error.message; }
  }
  async function finishRoom() {
    if (role !== 'teacher' || !firebaseState || roomStatus === 'finished') return;
    if (!confirm('Yarışma tüm öğrenciler için bitirilecek. Emin misiniz?')) return;
    await firebaseState.api.update(roomRef, { status: 'finished', endedAt: firebaseState.api.serverTimestamp(), finishReason: 'teacher' });
  }

  async function joinRoom() {
    playerName = $('onlineName').value.trim(); roomCode = $('joinCode').value.trim();
    if (!playerName || !/^[0-9]{6}$/.test(roomCode)) { setStatus('Adınızı ve 6 haneli oda kodunu girin.'); return; }
    try {
      setStatus('Odaya bağlanılıyor…'); var state = await firebase(); var reference = state.api.ref(state.db, 'rooms/' + roomCode); var snapshot = await state.api.get(reference);
      if (!snapshot.exists()) throw Error('Oda bulunamadı.');
      var room = snapshot.val(); if (room.status !== 'waiting') throw Error('Bu yarışma başlamış veya sona ermiş. Yeni katılım kapalı.');
      playerId = state.user.uid; role = 'student'; roomRef = reference; roomStatus = room.status; onlineGameStarted = false;
      await state.api.set(state.api.ref(state.db, 'rooms/' + roomCode + '/players/' + playerId), {
        name: playerName, score: 0, correct: 0, wrong: 0, currentLetter: '—', remainingSeconds: Number(room.settings && room.settings.durationSeconds) || 240,
        status: 'waiting', joinedAt: state.api.serverTimestamp(), updatedAt: state.api.serverTimestamp()
      });
      state.api.onDisconnect(state.api.ref(state.db, 'rooms/' + roomCode + '/players/' + playerId + '/status')).set('disconnected');
      $('waitingCode').textContent = roomCode; $('waitingName').textContent = playerName + ', bağlantınız hazır.'; show('waitingRoom'); listenRoom(roomCode, 'student');
    } catch (error) { setStatus(error.message); }
  }

  async function leaveWaiting() {
    if (role === 'student' && firebaseState && playerId && roomCode && !onlineGameStarted) {
      await firebaseState.api.remove(firebaseState.api.ref(firebaseState.db, 'rooms/' + roomCode + '/players/' + playerId)).catch(function () {});
    }
    resetOnlineState(); show('onlineLobby');
  }
  async function teacherHome() {
    if (role === 'teacher' && firebaseState && roomRef && roomStatus === 'running') {
      if (!confirm('Devam eden yarışma sonlandırılacak. Ana sayfaya dönülsün mü?')) return;
      await firebaseState.api.update(roomRef, { status: 'finished', endedAt: firebaseState.api.serverTimestamp(), finishReason: 'teacher-left' }).catch(function () {});
    }
    if (role === 'teacher' && firebaseState && roomRef) await firebaseState.api.remove(roomRef).catch(function () {});
    resetOnlineState(); show('modeScreen');
  }
  function listenRoom(code, listenerRole) {
    clearRoomListeners();
    roomUnsubscribe = firebaseState.api.onValue(firebaseState.api.ref(firebaseState.db, 'rooms/' + code), function (snapshot) {
      if (!snapshot.exists()) { window.PassaparolaApp.toast('Oda kapatıldı.'); resetOnlineState(); show('modeScreen'); return; }
      var room = snapshot.val(); latestRoom = room; roomStatus = room.status; latestPlayers = playerArray(room.players);
      if (listenerRole === 'teacher') renderTeacherMonitor(room);
      else handleStudentRoom(room);
    }, function (error) { window.PassaparolaApp.toast('Canlı bağlantı kesildi: ' + error.message); });
  }
  function renderTeacherMonitor(room) {
    var players = playerArray(room.players); $('connectedCount').textContent = players.length + ' öğrenci';
    $('teacherPlayers').innerHTML = players.map(function (entry) {
      var status = entry.status || 'waiting'; var labels = { waiting: 'Bekliyor', playing: 'Yarışıyor', finished: 'Tamamladı', disconnected: 'Bağlantı kesildi' };
      return '<tr><td data-label="Öğrenci"><b>' + escapeHtml(entry.name || 'İsimsiz') + '</b></td><td data-label="Durum"><span class="studentStatus ' + status + '">' + (labels[status] || status) + '</span></td><td data-label="Puan"><b>' + (entry.score || 0) + '</b></td><td data-label="Aktif harf">' + escapeHtml(entry.currentLetter || '—') + '</td><td data-label="Kalan süre">' + window.PassaparolaApp.format(entry.remainingSeconds == null ? room.settings.durationSeconds : entry.remainingSeconds) + '</td></tr>';
    }).join('') || '<tr class="emptyTeacherRow"><td colspan="5">Henüz öğrenci katılmadı.</td></tr>';
    if (room.status === 'running') {
      $('teacherStart').classList.add('hidden'); $('teacherFinish').classList.remove('hidden'); $('teacherDuration').disabled = true;
      $('teacherQuestionList').querySelectorAll('input').forEach(function (input) { input.disabled = true; });
      $('teacherStatus').textContent = 'Yarışma canlı olarak devam ediyor.';
    } else if (room.status === 'finished') {
      $('teacherStart').classList.add('hidden'); $('teacherFinish').classList.add('hidden'); $('teacherStatus').textContent = 'Yarışma sona erdi.';
    } else $('teacherStatus').textContent = players.length ? players.length + ' öğrenci başlatma komutunu bekliyor.' : 'Öğrenciler bekleniyor.';
  }
  function handleStudentRoom(room) {
    if (room.status === 'waiting') return;
    if (room.status === 'running' && !onlineGameStarted && Number(room.startAt)) {
      onlineGameStarted = true;
      window.PassaparolaApp.startOnlineGame({ questions: room.questions || [], settings: room.settings || {}, playerName: playerName, startAt: Number(room.startAt), serverOffset: serverOffset });
      syncProgress(window.PassaparolaApp.snapshot('playing'));
    }
    if (room.status === 'finished' && onlineGameStarted) {
      window.PassaparolaApp.finishOnlineFromTeacher();
      window.PassaparolaApp.showOnlineLeaderboard(roomCode, latestPlayers);
    }
  }
  async function syncProgress(progress) {
    if (role !== 'student' || !firebaseState || !playerId || !roomCode || !onlineGameStarted) return;
    var key = [progress.score, progress.correct, progress.wrong, progress.currentLetter, progress.remainingSeconds, progress.status].join('|');
    if (key === lastProgressKey) return; lastProgressKey = key;
    var payload = { name: playerName, score: progress.score || 0, correct: progress.correct || 0, wrong: progress.wrong || 0,
      currentLetter: progress.currentLetter || '—', remainingSeconds: Math.max(0, Number(progress.remainingSeconds) || 0), status: progress.status || 'playing', updatedAt: firebaseState.api.serverTimestamp() };
    await firebaseState.api.update(firebaseState.api.ref(firebaseState.db, 'rooms/' + roomCode + '/players/' + playerId), payload).catch(function (error) { console.error('Skor eşitleme:', error); });
  }
  function showOnlineLeaders() { window.PassaparolaApp.showOnlineLeaderboard(roomCode, latestPlayers); }

  function init() {
    detectDevice(); window.addEventListener('resize', detectDevice); window.addEventListener('orientationchange', function () { setTimeout(detectDevice, 120); });
    if (window.visualViewport) { window.visualViewport.addEventListener('resize', updateViewport); window.visualViewport.addEventListener('scroll', updateViewport); }
    window.addEventListener('passaparola:layout-settings', updateViewport);
    finishSplash(); installSupport();
    $('offlineMode').onclick = function () { window.PassaparolaApp.enterOffline(); };
    $('onlineMode').onclick = function () { setStatus(''); show('onlineLobby'); };
    $('backModes').onclick = function () { show('modeScreen'); };
    $('createRoom').onclick = createRoom; $('joinRoom').onclick = joinRoom; $('leaveWaiting').onclick = leaveWaiting;
    $('teacherStart').onclick = startRoom; $('teacherFinish').onclick = finishRoom; $('teacherHome').onclick = teacherHome;
    $('teacherExport').onclick = exportRoomBackup; $('teacherImport').onchange = importRoomBackup;
    $('copyRoomCode').onclick = async function () { try { await navigator.clipboard.writeText(roomCode); window.PassaparolaApp.toast('Oda kodu kopyalandı.'); } catch (error) { window.PassaparolaApp.toast('Oda kodu: ' + roomCode); } };
    $('aboutBtn').onclick = function () { window.location.href = 'about.html?v=4'; };
    window.addEventListener('passaparola:progress', function (event) { syncProgress(event.detail); });
    window.addEventListener('passaparola:finished', function (event) { syncProgress(Object.assign({}, event.detail.snapshot, { status: 'finished' })).then(showOnlineLeaders); });
    window.addEventListener('passaparola:home-request', function () { resetOnlineState(); window.PassaparolaApp.resetGame(); show('modeScreen'); });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
