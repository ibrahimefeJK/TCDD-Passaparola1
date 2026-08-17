(function (global) {
  'use strict';

  function activeQuestions(questions) {
    var seen = {};
    return questions.filter(function (question) {
      var valid = question.enabled === true && String(question.question || '').trim() !== '' &&
        Array.isArray(question.acceptedAnswers) && question.acceptedAnswers.length > 0 && !seen[question.letter];
      if (valid) seen[question.letter] = true;
      return valid;
    }).map(function (question) { return JSON.parse(JSON.stringify(question)); });
  }

  function Engine() { this.reset(); }
  Engine.prototype.reset = function () {
    this.questions = []; this.status = {}; this.queue = []; this.passQueue = [];
    this.current = null; this.score = 0; this.correct = 0; this.wrong = 0;
    this.running = false; this.awaitingRestart = false;
  };
  Engine.prototype.start = function (questions) {
    this.reset(); this.questions = activeQuestions(questions);
    for (var index = 0; index < this.questions.length; index += 1) {
      this.status[this.questions[index].letter] = 'idle'; this.queue.push(this.questions[index]);
    }
    this.running = this.queue.length > 0;
    if (this.running) this.next();
    return this.current;
  };
  Engine.prototype.next = function () {
    if (!this.running) return null;
    if (!this.queue.length) this.queue = this.passQueue.splice(0);
    if (!this.queue.length) { this.running = false; this.current = null; return null; }
    this.current = this.queue.shift(); this.status[this.current.letter] = 'active'; return this.current;
  };
  Engine.prototype.restartRound = function () {
    if (!this.running || !this.awaitingRestart) return this.current;
    this.status = {}; this.queue = []; this.passQueue = [];
    for (var index = 0; index < this.questions.length; index += 1) {
      this.status[this.questions[index].letter] = 'idle'; this.queue.push(this.questions[index]);
    }
    this.current = null; this.score = 0; this.correct = 0; this.awaitingRestart = false;
    return this.next();
  };
  Engine.prototype.resolve = function (kind) {
    if (!this.running || !this.current || this.awaitingRestart) return { ended: !this.running };
    var question = this.current;
    if (kind === 'correct') {
      this.status[question.letter] = 'correct'; this.score += 1; this.correct += 1;
    } else if (kind === 'wrong') {
      this.status[question.letter] = 'wrong'; this.wrong += 1; this.awaitingRestart = true;
      return { ended: false, restart: true, next: null };
    } else {
      this.status[question.letter] = 'passed'; this.passQueue.push(question);
    }
    this.current = null;
    var next = this.next();
    return { ended: !this.running, next: next };
  };
  Engine.prototype.answer = function (value) {
    function normalize(text) { return String(text).trim().replace(/\s+/g, ' ').toLocaleLowerCase('tr-TR'); }
    var correct = this.current && this.current.acceptedAnswers.some(function (answer) { return normalize(answer) === normalize(value); });
    var expected = this.current ? this.current.acceptedAnswers[0] : '';
    var result = this.resolve(correct ? 'correct' : 'wrong');
    result.correct = Boolean(correct); result.answer = expected; return result;
  };

  global.PassaparolaEngine = { Engine: Engine, activeQuestions: activeQuestions };
})(window);
