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

console.log('12/12 arayüz ve online sözleşme testi başarılı');
