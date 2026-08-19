const fs = require('fs');
const vm = require('vm');
const assert = require('assert');

const source = fs.readFileSync('js/app.js', 'utf8');
const start = source.indexOf('function speechNormalize');
const end = source.indexOf('function selectVoiceResult');
assert(start >= 0 && end > start, 'Ses eşleştirme fonksiyonları bulunmalı');

const context = { userSettings: { voiceSensitivity: 'normal' }, engine: { current: null } };
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);

assert.equal(context.speechNormalize('ŞÖNT  IĞDIR'), 'sont igdir');
context.engine.current = { acceptedAnswers: ['Elektrifikasyon'] };
assert(context.tolerantVoiceAnswer('elektrikasyon'), 'Eksik heceli elektrifikasyon telaffuzu kabul edilmeli');
assert(context.tolerantVoiceAnswer('elektrifikasyonlardan'), 'Uzun Türkçe ekler kök eşleşmesini bozmamalı');
assert.equal(context.tolerantVoiceAnswer('portakal'), null, 'Alakasız kelime reddedilmeli');
context.engine.current = { acceptedAnswers: ['Peron'] };
assert(context.tolerantVoiceAnswer('beron'), 'b-p akustik dönüşümü kabul edilmeli');
context.engine.current = { acceptedAnswers: ['Sinyal'] };
assert(context.tolerantVoiceAnswer('sinyla'), 'Harf yer değiştirmesi kabul edilmeli');
['pas', 'pass', 'pasde', 'pas geç', 'pas geçelim'].forEach(value => assert(context.isPassCommand(value), value + ' komutu pas sayılmalı'));

console.log('11/11 fonetik ses eşleştirme testi başarılı');
