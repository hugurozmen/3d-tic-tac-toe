import { Clipboard, Sparkles } from 'lucide-react';
import { useState } from 'react';
import { DIFFICULTY_OPTIONS } from '../../game/options';
import type { DailyPuzzle, DailyPuzzleResult } from '../../game/puzzles';
import {
  formatMoveCell,
  getDailyPuzzlePrompt,
  getDailyPuzzleResultExplanation,
  getDailyPuzzleTitle,
  getThemeProgressCopy,
  labelDifficulty,
  labelRuleset,
  useI18n,
} from '../../i18n';
import type { PanelDailyProgressProps } from './types';
import { PanelModal } from './PanelModal';

const DAILY_FLOORS = [0, 1, 2] as const;

type DailyPuzzleBoardProps = {
  dailyPuzzle: DailyPuzzle;
  dailyPuzzleResult: DailyPuzzleResult | null;
  onMove: (move: number) => void;
};

export function DailyPuzzleBoard({
  dailyPuzzle,
  dailyPuzzleResult,
  onMove,
}: DailyPuzzleBoardProps) {
  const { t } = useI18n();

  return (
    <div className="daily-puzzle-board">
      {DAILY_FLOORS.map((floor) => (
        <section
          key={floor}
          className="daily-puzzle-floor"
          aria-label={t('puzzle.floorBoard', { floor: floor + 1 })}
        >
          <span className="daily-puzzle-floor-label">
            {t('puzzle.floor', { floor: floor + 1 })}
          </span>
          <div className="daily-puzzle-grid">
            {Array.from({ length: 9 }, (_, cell) => {
              const index = floor * 9 + cell;
              const row = Math.floor(cell / 3) + 1;
              const column = (cell % 3) + 1;
              const value = dailyPuzzle.board[index];
              const isPicked = dailyPuzzleResult?.move === index;
              const isBest = dailyPuzzleResult?.bestMove === index;

              return (
                <button
                  key={index}
                  aria-label={t('puzzle.cellLabel', {
                    cell: index + 1,
                    column,
                    floor: floor + 1,
                    row,
                    value: value ?? t('cell.empty'),
                  })}
                  className={[
                    'daily-cell',
                    value ? `occupied mark-${value.toLowerCase()}` : '',
                    isPicked ? 'picked' : '',
                    isBest ? 'best' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  disabled={Boolean(value) || Boolean(dailyPuzzleResult)}
                  type="button"
                  onClick={() => onMove(index)}
                >
                  {value ?? index + 1}
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function PanelDailyProgress({
  dailyPuzzle,
  dailyPuzzleResult,
  dailyPuzzleShareCopied,
  difficultyStreaks,
  lastMove,
  lifetimeScore,
  retentionStats,
  showDailyNudge,
  themeUnlockProgress,
  onDailyPuzzleMove,
  onDismissDailyNudge,
  onShareDailyPuzzle,
}: PanelDailyProgressProps) {
  const [dailyOpen, setDailyOpen] = useState(false);
  const [progressOpen, setProgressOpen] = useState(false);
  const i18n = useI18n();
  const { t } = i18n;
  const dailyTitle = getDailyPuzzleTitle(i18n, dailyPuzzle);
  const dailyPrompt = getDailyPuzzlePrompt(i18n, dailyPuzzle);

  const openDaily = () => {
    onDismissDailyNudge();
    setDailyOpen(true);
  };

  return (
    <section
      className="panel-section panel-section-daily-progress"
      aria-label={t('aria.dailyProgress')}
    >
      <div className="panel-section-heading">
        <span>{t('progress.dailyAndProgress')}</span>
        <small>{t('progress.localGoals')}</small>
      </div>

      <div className="entry-row-list">
        {showDailyNudge ? (
          <div className="coach-prompt daily-nudge" aria-label={t('aria.dailyPuzzleHint')}>
            <div>
              <strong>{t('progress.dailyPuzzleUnlocked')}</strong>
              <span>{t('progress.dailyPuzzleUnlockedText')}</span>
            </div>
            <button type="button" onClick={openDaily}>
              <Sparkles size={15} />
              <span>{t('action.open')}</span>
            </button>
          </div>
        ) : null}

        <button className="panel-entry-row" type="button" onClick={openDaily}>
          <div>
            <span>{t('progress.dailyTitle', { id: dailyPuzzle.id })}</span>
            <strong>{dailyTitle}</strong>
          </div>
          <small>
            {dailyPuzzleResult ? t('progress.resultSaved') : t('progress.playToday')}
          </small>
        </button>

        <button
          className="panel-entry-row"
          type="button"
          onClick={() => setProgressOpen(true)}
        >
          <div>
            <span>{t('progress.progress')}</span>
            <strong>{t('progress.streaks')}</strong>
          </div>
          <small>
            {themeUnlockProgress.filter((item) => item.unlocked).length}/3{' '}
            {t('progress.accents')}
          </small>
        </button>
      </div>

      {dailyOpen ? (
        <PanelModal
          ariaLabel={t('aria.dailyPuzzle')}
          title={t('progress.dailyTitle', { id: dailyPuzzle.id })}
          onClose={() => setDailyOpen(false)}
        >
          <div className="daily-puzzle-card modal-card-body">
            <div className="daily-puzzle-header">
              <div>
                <span>{t('progress.dailyTitle', { id: dailyPuzzle.id })}</span>
                <strong>{dailyTitle}</strong>
              </div>
              <span>{labelRuleset(i18n, dailyPuzzle.ruleset)}</span>
            </div>
            <div className="daily-puzzle-instructions">
              <p>{dailyPrompt}</p>
              <span
                className={`daily-puzzle-turn mark-${dailyPuzzle.player.toLowerCase()}`}
              >
                {t('puzzle.toMove', { player: dailyPuzzle.player })}
              </span>
            </div>
            <DailyPuzzleBoard
              dailyPuzzle={dailyPuzzle}
              dailyPuzzleResult={dailyPuzzleResult}
              onMove={onDailyPuzzleMove}
            />
            {dailyPuzzleResult ? (
              <div
                className={`daily-puzzle-result ${
                  dailyPuzzleResult.solved ? 'solved' : 'missed'
                }`}
              >
                <div
                  className="daily-result-announcement"
                  aria-live="polite"
                  role="status"
                >
                  <div className="daily-result-moves">
                    <span>
                      {t('puzzle.bestMove', {
                        cell: formatMoveCell(dailyPuzzleResult.bestMove),
                      })}
                    </span>
                    <span>
                      {t('puzzle.yourMove', {
                        cell: formatMoveCell(dailyPuzzleResult.move),
                      })}
                    </span>
                  </div>
                  <p>
                    {getDailyPuzzleResultExplanation(
                      i18n,
                      dailyPuzzle,
                      dailyPuzzleResult,
                    )}
                  </p>
                </div>
                {dailyPuzzleResult.solved ? (
                  <button
                    className="daily-share"
                    type="button"
                    onClick={onShareDailyPuzzle}
                  >
                    <Clipboard size={15} />
                    <span>
                      {dailyPuzzleShareCopied ? t('action.copied') : t('action.share')}
                    </span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </PanelModal>
      ) : null}

      {progressOpen ? (
        <PanelModal
          ariaLabel={t('aria.localProgress')}
          title={t('progress.localProgress')}
          onClose={() => setProgressOpen(false)}
        >
          <div className="progress-card modal-card-body">
            <div className="progress-card-header">
              <span>{t('progress.localProgress')}</span>
              <strong>{t('progress.localOnly')}</strong>
            </div>
            <div className="streak-grid" aria-label={t('aria.winStreaks')}>
              {DIFFICULTY_OPTIONS.map((level) => (
                <div key={level} className="streak-tile">
                  <span>{labelDifficulty(i18n, level)}</span>
                  <strong>{difficultyStreaks[level]}</strong>
                </div>
              ))}
            </div>
            <div className="retention-stat-grid">
              <div>
                <span>{t('progress.bestMargin')}</span>
                <strong>+{retentionStats.bestLinesWinMargin}</strong>
              </div>
              <div>
                <span>{t('progress.totalLines')}</span>
                <strong>{retentionStats.totalLinesScored}</strong>
              </div>
              <div
                className={`master-badge ${
                  retentionStats.masterWins > 0 ? 'earned' : ''
                }`}
              >
                <span>{t('progress.masterWins')}</span>
                <strong>{retentionStats.masterWins}</strong>
              </div>
            </div>
            <div className="retention-stat-grid progress-lifetime-grid">
              <div>
                <span>{t('progress.lifetime')}</span>
                <strong>
                  {lifetimeScore.X}-{lifetimeScore.O}
                </strong>
              </div>
              <div>
                <span>{t('progress.lifeDraws')}</span>
                <strong>{lifetimeScore.draws}</strong>
              </div>
              <div>
                <span>{t('progress.lastMove')}</span>
                <strong>{formatMoveCell(lastMove)}</strong>
              </div>
            </div>
            <div className="theme-progress-list" aria-label={t('aria.themeProgress')}>
              <div className="theme-progress-heading">
                <span>{t('progress.themeAccents')}</span>
                <strong>
                  {themeUnlockProgress.filter((item) => item.unlocked).length}/3
                </strong>
              </div>
              {themeUnlockProgress.map((item) => {
                const copy = getThemeProgressCopy(i18n, item);

                return (
                  <div key={item.id} className="theme-progress-row">
                    <div>
                      <span>{copy.label}</span>
                      <small>{copy.detail}</small>
                    </div>
                    <strong>{copy.valueText}</strong>
                    <i aria-hidden="true">
                      <span
                        style={{ width: `${Math.round(item.progress * 100)}%` }}
                      />
                    </i>
                  </div>
                );
              })}
            </div>
          </div>
        </PanelModal>
      ) : null}
    </section>
  );
}
