import { Clipboard, Sparkles } from 'lucide-react';
import { useState } from 'react';
import {
  DIFFICULTY_LABEL,
  DIFFICULTY_OPTIONS,
  RULESET_LABEL,
} from '../../game/options';
import type { PanelDailyProgressProps } from './types';
import { PanelModal } from './PanelModal';

const DAILY_FLOORS = [0, 1, 2] as const;
const formatCell = (move: number | null) => (move === null ? '-' : move + 1);

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

  const openDaily = () => {
    onDismissDailyNudge();
    setDailyOpen(true);
  };

  return (
    <section
      className="panel-section panel-section-daily-progress"
      aria-label="Daily and progress"
    >
      <div className="panel-section-heading">
        <span>Daily & Progress</span>
        <small>Local goals and puzzle</small>
      </div>

      <div className="entry-row-list">
        {showDailyNudge ? (
          <div className="coach-prompt daily-nudge" aria-label="Daily puzzle hint">
            <div>
              <strong>Daily puzzle unlocked</strong>
              <span>Try one quick board challenge after your first match.</span>
            </div>
            <button type="button" onClick={openDaily}>
              <Sparkles size={15} />
              <span>Open</span>
            </button>
          </div>
        ) : null}

        <button className="panel-entry-row" type="button" onClick={openDaily}>
          <div>
            <span>Daily #{dailyPuzzle.id}</span>
            <strong>{dailyPuzzle.title}</strong>
          </div>
          <small>{dailyPuzzleResult ? 'Result saved' : 'Play today'}</small>
        </button>

        <button
          className="panel-entry-row"
          type="button"
          onClick={() => setProgressOpen(true)}
        >
          <div>
            <span>Progress</span>
            <strong>Streaks & unlocks</strong>
          </div>
          <small>{themeUnlockProgress.filter((item) => item.unlocked).length}/3 accents</small>
        </button>
      </div>

      {dailyOpen ? (
        <PanelModal
          ariaLabel="Daily puzzle"
          title={`Daily #${dailyPuzzle.id}`}
          onClose={() => setDailyOpen(false)}
        >
          <div className="daily-puzzle-card modal-card-body">
            <div className="daily-puzzle-header">
              <div>
                <span>Daily #{dailyPuzzle.id}</span>
                <strong>{dailyPuzzle.title}</strong>
              </div>
              <span>{RULESET_LABEL[dailyPuzzle.ruleset]}</span>
            </div>
            <p>{dailyPuzzle.prompt}</p>
            <div className="daily-puzzle-board">
              {DAILY_FLOORS.map((floor) => (
                <div key={floor} className="daily-puzzle-floor">
                  <span>Floor {floor + 1}</span>
                  <div className="daily-puzzle-grid">
                    {Array.from({ length: 9 }, (_, cell) => {
                      const index = floor * 9 + cell;
                      const value = dailyPuzzle.board[index];
                      const isPicked = dailyPuzzleResult?.move === index;
                      const isBest = dailyPuzzleResult?.bestMove === index;

                      return (
                        <button
                          key={index}
                          aria-label={`Daily puzzle cell ${index + 1}, ${
                            value ?? 'empty'
                          }`}
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
                          onClick={() => onDailyPuzzleMove(index)}
                        >
                          {value ?? index + 1}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
            {dailyPuzzleResult ? (
              <div
                className={`daily-puzzle-result ${
                  dailyPuzzleResult.solved ? 'solved' : 'missed'
                }`}
              >
                <div className="daily-result-moves">
                  <span>Best move {formatCell(dailyPuzzleResult.bestMove)}</span>
                  <span>Your move {formatCell(dailyPuzzleResult.move)}</span>
                </div>
                <p>{dailyPuzzleResult.explanation}</p>
                {dailyPuzzleResult.solved ? (
                  <button
                    className="daily-share"
                    type="button"
                    onClick={onShareDailyPuzzle}
                  >
                    <Clipboard size={15} />
                    <span>{dailyPuzzleShareCopied ? 'Copied' : 'Share'}</span>
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </PanelModal>
      ) : null}

      {progressOpen ? (
        <PanelModal
          ariaLabel="Local progress"
          title="Local progress"
          onClose={() => setProgressOpen(false)}
        >
          <div className="progress-card modal-card-body">
            <div className="progress-card-header">
              <span>Progress</span>
              <strong>Local only</strong>
            </div>
            <div className="streak-grid" aria-label="Win streak by difficulty">
              {DIFFICULTY_OPTIONS.map((level) => (
                <div key={level} className="streak-tile">
                  <span>{DIFFICULTY_LABEL[level]}</span>
                  <strong>{difficultyStreaks[level]}</strong>
                </div>
              ))}
            </div>
            <div className="retention-stat-grid">
              <div>
                <span>Best margin</span>
                <strong>+{retentionStats.bestLinesWinMargin}</strong>
              </div>
              <div>
                <span>Total lines</span>
                <strong>{retentionStats.totalLinesScored}</strong>
              </div>
              <div
                className={`master-badge ${
                  retentionStats.masterWins > 0 ? 'earned' : ''
                }`}
              >
                <span>Master wins</span>
                <strong>{retentionStats.masterWins}</strong>
              </div>
            </div>
            <div className="retention-stat-grid progress-lifetime-grid">
              <div>
                <span>Lifetime</span>
                <strong>
                  {lifetimeScore.X}-{lifetimeScore.O}
                </strong>
              </div>
              <div>
                <span>Life draws</span>
                <strong>{lifetimeScore.draws}</strong>
              </div>
              <div>
                <span>Last move</span>
                <strong>{formatCell(lastMove)}</strong>
              </div>
            </div>
            <div className="theme-progress-list" aria-label="Theme accent progress">
              <div className="theme-progress-heading">
                <span>Theme accents</span>
                <strong>
                  {themeUnlockProgress.filter((item) => item.unlocked).length}/3
                </strong>
              </div>
              {themeUnlockProgress.map((item) => (
                <div key={item.id} className="theme-progress-row">
                  <div>
                    <span>{item.label}</span>
                    <small>{item.detail}</small>
                  </div>
                  <strong>{item.valueText}</strong>
                  <i aria-hidden="true">
                    <span
                      style={{ width: `${Math.round(item.progress * 100)}%` }}
                    />
                  </i>
                </div>
              ))}
            </div>
          </div>
        </PanelModal>
      ) : null}
    </section>
  );
}
