import { Circle, HelpCircle, Trophy, X } from 'lucide-react';
import type { Player } from '../../game/rules';
import type { PanelScoreboardProps } from './types';

function markIcon(player: Player) {
  return player === 'X' ? <X size={18} /> : <Circle size={18} />;
}

export function PanelScoreboard({
  animationEvents,
  baseLineScores,
  currentPlayer,
  isAiThinking,
  lineScores,
  linesBonusScores,
  linesEndgameText,
  match,
  matchWinnerText,
  nextOpenerText,
  openerText,
  recentBlockCount,
  recentLineCount,
  recentLinePlayer,
  remainingCells,
  result,
  ruleset,
  status,
  isPowerScoreMode,
  onOpenGuide,
}: PanelScoreboardProps) {
  const lineScoreEventClass = [
    recentLineCount > 0 ? 'score-bump' : '',
    recentLineCount > 1 ? 'multi-line' : '',
  ]
    .filter(Boolean)
    .join(' ');
  const emptyCellsTense =
    ruleset === 'lines' &&
    !isPowerScoreMode &&
    remainingCells > 0 &&
    remainingCells <= 6 &&
    !result.isComplete;
  const hasLineBonus = linesBonusScores.X > 0 || linesBonusScores.O > 0;
  const hasPowerBonusEvent = animationEvents.some(
    (event) => event.type === 'power-triggered' && event.bonus > 0,
  );
  const hasFinalSixEvent = animationEvents.some(
    (event) => event.type === 'final-six-start',
  );
  const hasMatchEndEvent = animationEvents.some(
    (event) => event.type === 'match-end',
  );

  return (
    <div className="panel-sticky-top">
      <header className="panel-header">
        <div>
          <p className="eyebrow">3x3x3</p>
          <h1>3D XOX</h1>
        </div>
        <div className="header-side">
          <div
            className={`turn-badge ${
              result.winner
                ? 'turn-win'
                : currentPlayer === 'X'
                  ? 'turn-x'
                  : 'turn-o'
            } ${isAiThinking ? 'thinking' : ''}`}
            aria-label={status}
          >
            {isAiThinking ? (
              <span className="thinking-spinner" aria-hidden="true" />
            ) : result.winner ? (
              <Trophy size={20} />
            ) : (
              markIcon(currentPlayer)
            )}
            <span>{status}</span>
          </div>
          <button
            aria-label="How to play"
            className="icon-button"
            type="button"
            onClick={onOpenGuide}
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </header>

      <section className="panel-scoreboard" aria-label="Round and score">
        <div className="scoreboard-meta">
          <div>
            <span>Round</span>
            <strong>{match.roundNumber}</strong>
          </div>
          <div>
            <span>{match.winner ? 'Winner' : 'Match'}</span>
            <strong>
              {matchWinnerText ?? `${match.score.X}-${match.score.O}`}
            </strong>
          </div>
          <div>
            <span>Draws</span>
            <strong>{match.score.draws}</strong>
          </div>
          <div>
            <span>Opener</span>
            <strong>{openerText}</strong>
          </div>
          <div>
            <span>Next</span>
            <strong>{match.isComplete ? 'Done' : nextOpenerText}</strong>
          </div>
        </div>

        {ruleset === 'lines' ? (
          <>
            <div
              className={`line-score-card ${
                recentBlockCount > 0 ? 'block-event' : ''
              }`}
              aria-label="Lines score"
              aria-live="polite"
            >
              <div
                className={`line-score-tile line-score-x ${
                  recentLinePlayer === 'X' ? lineScoreEventClass : ''
                }`}
              >
                <span>{isPowerScoreMode ? 'X total' : 'X lines'}</span>
                <strong>{lineScores.X}</strong>
              </div>
              <div
                className={`line-score-tile line-score-round ${
                  recentLineCount > 0 ? lineScoreEventClass : ''
                }`}
              >
                <span>{isPowerScoreMode ? 'Lines' : 'Round'}</span>
                <strong>
                  {isPowerScoreMode
                    ? `${baseLineScores.X}-${baseLineScores.O}`
                    : `${lineScores.X}-${lineScores.O}`}
                </strong>
              </div>
              <div
                className={`line-score-tile line-score-o ${
                  recentLinePlayer === 'O' ? lineScoreEventClass : ''
                }`}
              >
                <span>{isPowerScoreMode ? 'O total' : 'O lines'}</span>
                <strong>{lineScores.O}</strong>
              </div>
              <div
                className={`line-score-tile ${
                  isPowerScoreMode ? 'line-score-bonus' : 'line-score-empty'
                } ${emptyCellsTense ? 'tension' : ''} ${
                  hasPowerBonusEvent ? 'score-bump power-bonus-bump' : ''
                } ${hasFinalSixEvent ? 'final-six-bump' : ''}`}
              >
                <span>
                  {isPowerScoreMode
                    ? 'Bonus'
                    : emptyCellsTense
                      ? 'Final cells'
                      : 'Empty'}
                </span>
                <strong>
                  {isPowerScoreMode
                    ? `${linesBonusScores.X}-${linesBonusScores.O}`
                    : remainingCells}
                </strong>
              </div>
            </div>
            {linesEndgameText || hasFinalSixEvent ? (
              <p
                className={`line-tension-note ${
                  hasFinalSixEvent ? 'final-six-live' : ''
                }`}
                aria-live="polite"
              >
                {hasFinalSixEvent ? 'Final Six: cube charged' : linesEndgameText}
              </p>
            ) : null}
            {hasLineBonus ? (
              <p className="line-bonus-note" aria-live="polite">
                Lines {baseLineScores.X}-{baseLineScores.O} + Bonus{' '}
                {linesBonusScores.X}-{linesBonusScores.O} = Total {lineScores.X}-
                {lineScores.O}
              </p>
            ) : null}
          </>
        ) : null}

        {hasMatchEndEvent ? (
          <span className="scoreboard-match-complete">Match complete</span>
        ) : null}
      </section>
    </div>
  );
}
