import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const { chooseDetectedLanguage } = require('../../electron/language-detection.cjs') as {
  chooseDetectedLanguage: (ranked: Array<[string, number]>, mapping: Record<string, string>) => {
    iso: string; language: string; confident: boolean;
  };
};

const mapping = { eng: 'eng', fra: 'fra', deu: 'deu' };

describe('OCR language detection guard', () => {
  it('falls back to English when short-document scores are too close', () => {
    expect(chooseDetectedLanguage([['fra', 1], ['eng', .98]], mapping)).toEqual({
      iso: 'und', language: 'eng', confident: false
    });
  });

  it('uses a clearly separated supported language', () => {
    expect(chooseDetectedLanguage([['fra', 1], ['eng', .82]], mapping)).toEqual({
      iso: 'fra', language: 'fra', confident: true
    });
  });
});
