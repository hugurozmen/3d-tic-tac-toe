import { describe, expect, it } from 'vitest';
import {
  createI18n,
  getDailyPuzzlePrompt,
  getDailyPuzzleResultExplanation,
  getDailyPuzzleTitle,
  getThemeProgressCopy,
  labelDifficulty,
  labelPower,
  translateOnlineMessage,
  translatePowerMessage,
} from '../i18n';
import { evaluateDailyPuzzleMove, getDailyPuzzle } from './puzzles';

describe('i18n', () => {
  it('translates labels and interpolated messages to Turkish', () => {
    const i18n = createI18n('tr');

    expect(i18n.t('setup.title')).toBe('Kurulum');
    expect(i18n.t('result.roundPrefix', { round: 2, text: 'X kazandı' })).toBe(
      'Tur 2: X kazandı',
    );
    expect(labelDifficulty(i18n, 'balanced')).toBe('Akıllı');
    expect(labelPower(i18n, 'charged-cell')).toBe('Yüklü Hücre');
    expect(i18n.t('puzzle.floor', { floor: 2 })).toBe('Kat 2');
    expect(i18n.t('puzzle.toMove', { player: 'X' })).toBe("Sıra X'de");
  });

  it('localizes known online and power messages at the UI boundary', () => {
    const i18n = createI18n('tr');

    expect(translateOnlineMessage(i18n, 'Invalid room code')).toBe(
      'Geçersiz oda kodu',
    );
    expect(translatePowerMessage(i18n, 'Charged Cell +2')).toBe(
      'Yüklü Hücre +2',
    );
  });

  it('formats daily puzzle copy in Turkish without changing puzzle data', () => {
    const i18n = createI18n('tr');
    const puzzle = getDailyPuzzle(new Date(2026, 0, 2));
    const result = evaluateDailyPuzzleMove(puzzle, puzzle.bestMove ?? 0);

    expect(getDailyPuzzleTitle(i18n, puzzle)).toBe('En çok çizgi');
    expect(getDailyPuzzlePrompt(i18n, puzzle)).toBe('En çok çizgi skorunu yap');
    expect(getDailyPuzzleResultExplanation(i18n, puzzle, result)).toContain(
      'doğru',
    );
  });

  it('localizes theme unlock progress copy', () => {
    const i18n = createI18n('tr');
    const copy = getThemeProgressCopy(i18n, {
      detail: 'Smart x3, Hard x2, or one Master win',
      id: 'ranked-focus',
      label: 'Ranked focus',
      progress: 0.2,
      unlocked: false,
      valueText: '1/3 Smart',
    });

    expect(copy.label).toBe('Dereceli odak');
    expect(copy.detail).toContain('Akıllı');
    expect(copy.valueText).toBe('1/3 Akıllı');
  });
});
