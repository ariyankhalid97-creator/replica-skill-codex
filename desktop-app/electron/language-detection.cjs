'use strict';

function chooseDetectedLanguage(ranked, mapping, minimumMargin = 0.05) {
  const [first = ['und', 0], second = ['und', 0]] = ranked;
  const confident = first[0] !== 'und' && first[1] - second[1] >= minimumMargin;
  const iso = confident ? first[0] : 'und';
  return { iso, language: mapping[iso] || 'eng', confident };
}

module.exports = { chooseDetectedLanguage };
