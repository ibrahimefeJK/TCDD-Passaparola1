(function (global) {
  'use strict';

  var KEY = 'tcdd_passaparola_v1';

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function fresh() {
    return {
      version: 3,
      settings: clone(global.PassaparolaDefaults.settings),
      questions: clone(global.PassaparolaDefaults.questions),
      leaderboard: []
    };
  }

  function valid(data) {
    return data && [1, 2, 3].indexOf(data.version) >= 0 && data.settings &&
      Array.isArray(data.questions) && Array.isArray(data.leaderboard);
  }

  function normalize(source) {
    var base = fresh();
    var seenIds = {};
    var enabledLetters = {};
    var selectedLetters = {};
    base.settings = Object.assign(base.settings, source.settings || {});
    base.questions = (source.questions || []).filter(function (question) {
      return global.PassaparolaDefaults.letters.indexOf(question.letter) >= 0;
    }).map(function (question, index) {
      var id = String(question.id || question.letter + '_' + index);
      while (seenIds[id]) id = question.letter + '_' + Date.now() + '_' + index;
      seenIds[id] = true;
      var enabled = question.enabled === true && !enabledLetters[question.letter];
      var selected = (question.selected === true || enabled) && !selectedLetters[question.letter];
      if (enabled) enabledLetters[question.letter] = true;
      if (selected) selectedLetters[question.letter] = true;
      return {
        id: id,
        letter: question.letter,
        question: String(question.question || ''),
        acceptedAnswers: Array.isArray(question.acceptedAnswers) ? question.acceptedAnswers.map(String).filter(function (answer) { return answer.trim(); }) : [],
        enabled: enabled,
        selected: selected
      };
    });
    global.PassaparolaDefaults.questions.forEach(function (question) {
      if (!base.questions.some(function (item) { return item.letter === question.letter; })) {
        base.questions.push(clone(question));
      }
    });
    global.PassaparolaDefaults.letters.forEach(function (letter) {
      var pool = base.questions.filter(function (question) { return question.letter === letter; });
      if (!pool.some(function (question) { return question.selected; }) && pool[0]) pool[0].selected = true;
    });
    base.leaderboard = source.leaderboard.slice();
    base.version = 3;
    return base;
  }

  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      var parsed = JSON.parse(raw);
      return valid(parsed) ? normalize(parsed) : fresh();
    } catch (error) {
      return fresh();
    }
  }

  function save(data) {
    try {
      data.version = 3;
      localStorage.setItem(KEY, JSON.stringify(data));
      return true;
    } catch (error) {
      return false;
    }
  }

  global.PassaparolaStorage = { load: load, save: save, fresh: fresh, valid: valid, normalize: normalize, key: KEY };
})(window);
