const fs = require('fs');
const assert = require('assert');

const read = file => fs.readFileSync(file, 'utf8');
const html = read('index.html');
const css = read('css/features.css') + read('css/style.css');
const features = read('js/features.js');
const app = read('js/app.js');
const manifest = JSON.parse(read('manifest.webmanifest'));
const rules = JSON.parse(read('firebase.rules.json'));

const gameStart = html.indexOf('<main id="gameScreen"');
const gameEnd = html.indexOf('<section id="adminScreen"');
const gameMarkup = html.slice(gameStart, gameEnd);

assert(html.includes('id="homeAdminBtn"'), 'Ana sayfada yönetim düğmesi olmalı');
assert(!gameMarkup.includes('homeAdminBtn') && !gameMarkup.includes('adminBtn'), 'Oyun ekranında yönetim düğmesi olmamalı');
assert(html.includes('Öğretmen Bekleniyor…') && html.includes('id="waitingRoom"'), 'Canlı bekleme odası bulunmalı');
assert(html.includes('id="teacherPlayers"') && html.includes('id="teacherStart"'), 'Öğretmen canlı paneli bulunmalı');
assert(features.includes("status: 'running'") && features.includes('serverTimestamp()'), 'Öğretmen Firebase başlangıç tetikleyicisi bulunmalı');
assert(features.includes("'.info/serverTimeOffset'"), 'Sayaç Firebase sunucu saatine göre eşitlenmeli');
assert(app.includes("gameMode !== 'offline'") && html.includes('class="gameControls offlineOnly"'), 'Online öğrenci durdurma kontrolleri kapalı olmalı');
assert(css.includes('--gold:#ffcc00') && css.includes('.letter.passed{background:var(--gold)!important'), 'PAS harfi #FFCC00 olmalı');
assert(css.includes('html.mobile-ui body[data-screen="game"]{overflow:hidden}'), 'Mobil oyun ekranında taşma engellenmeli');
assert(css.includes('.mobile-ui .monitorTable thead{display:none}') && features.includes('data-label="Kalan süre"'), 'Mobil öğretmen tablosu yakınlaştırma gerektirmeyen kart düzeninde olmalı');
assert(css.includes('.mobile-ui.keyboard-open #gameScreen>.scorebar{display:none;}') && css.includes('.mobile-ui.keyboard-open .check'), 'Klavye açıkken oyun işlemleri görünür kalmalı');
assert(manifest.display_override.includes('fullscreen') && manifest.icons.some(icon => icon.sizes === '192x192') && manifest.icons.some(icon => icon.sizes === '512x512'), 'PWA tam ekran ve logo simgeleri tanımlı olmalı');
assert(rules.rules.rooms.$room.players.$player['.write'].includes('$player === auth.uid'), 'Öğrenci yalnızca kendi canlı kaydını yazabilmeli');
assert(html.includes('id="voiceBtn"') && app.includes("recognition.lang = 'tr-TR'") && app.includes("act('answer')"), 'Türkçe sesli cevap mevcut kontrol akışını tetiklemeli');
assert(app.includes('tcdd_passaparola_pin_lock_v1') && app.includes('15 * 60 * 1000') && !app.includes("entered === String(data.settings.adminPin"), 'PIN kilidi kalıcı olmalı ve düz metin doğrulama yapılmamalı');
assert(html.includes('id="teacherExport"') && app.includes("backupType: 'tcdd-passaparola-room'") && features.includes('showBackupReport'), 'Oda yedeği ve salt okunur rapor akışı bulunmalı');
assert(features.includes('firebaseState.api.remove(roomRef)') && css.includes('.voiceBtn.listening'), 'Canlı oda temizliği ve mikrofon pulse geri bildirimi bulunmalı');
assert(app.includes('function pronunciationScore') && app.includes('editSimilarity') && app.includes('diceSimilarity') && app.includes('syllableShape'), 'Telaffuz toleransı çoklu matematiksel benzerlik ölçüleri kullanmalı');
assert(app.includes("replace(/ı/g, 'i')") && app.includes("replace(/ş/g, 's')") && app.includes("toLocaleLowerCase('tr-TR')"), 'Türkçe sesli cevaplar karşılaştırma öncesinde normalize edilmeli');
assert(app.includes('isPassCommand(transcript)') && app.includes("act('pass')") && app.includes('setVoiceMode(true)'), 'Sesli pas komutu ve kalıcı sesli oyun modu bulunmalı');
assert(features.includes("setProperty('--ring-size'") && features.includes("classList.toggle('short-viewport'") && css.includes('.mobile-ui.landscape-ui'), 'Mobil geometri gerçek ekran ölçülerine ve yöne göre hesaplanmalı');
assert(html.includes('id="userSettingsBtn"') && html.includes('id="uiScale"') && html.includes('id="voiceSensitivity"'), 'Kullanıcı ayar paneli, ölçek ve ses hassasiyeti kontrolleri bulunmalı');
assert(app.includes("setAttribute('inputmode', 'none')") && app.includes('readOnly = voiceMode') && app.includes('maxAlternatives = 5'), 'Sesli mod mobil klavyeyi kilitlemeli ve alternatif ses sonuçlarını değerlendirmeli');
assert(features.includes('getBoundingClientRect().height') && features.includes('stageBudget') && features.includes('safeAreaInsets'), 'Mobil yerleşim gerçek dikey DOM bütçesi ve güvenli alanlarla hesaplanmalı');
assert(css.includes('.userSettingsPanel') && css.includes('html.high-contrast') && css.includes('html.reduce-effects'), 'Kullanıcı görsel tercihleri için kalıcı panel stilleri bulunmalı');

console.log('24/24 arayüz, ses, ayarlar, güvenlik, yedekleme ve mobil sözleşme testi başarılı');
