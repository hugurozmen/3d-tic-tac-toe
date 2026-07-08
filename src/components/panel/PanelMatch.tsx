import { Lightbulb, Shield, Sparkles, Zap } from 'lucide-react';
import {
  FINAL_SIX_POWER_DESCRIPTION,
  FINAL_SIX_POWER_LABEL,
  FINAL_SIX_POWER_OPTIONS,
  FINAL_SIX_POWER_SHORT_LABEL,
  type FinalSixPowerId,
} from '../../game/finalSixPowers';
import type { PanelMatchProps } from './types';

const POWER_PLAYERS = ['X', 'O'] as const;

function powerIcon(power: FinalSixPowerId) {
  if (power === 'power-cell' || power === 'charged-cell') {
    return <Sparkles size={15} />;
  }

  if (power === 'surge-line') {
    return <Zap size={15} />;
  }

  return <Shield size={15} />;
}

export function PanelMatch({
  canHumanChoosePower,
  canShowPowerPanel,
  coachEnabled,
  finalSixPowers,
  linesBonusScores,
  mode,
  powerPicker,
  powerSelection,
  showCoachPrompt,
  showFinalSixNudge,
  onDismissFinalSixNudge,
  onPowerSelectionChange,
  onTryCoach,
}: PanelMatchProps) {
  const powerOptions = FINAL_SIX_POWER_OPTIONS[finalSixPowers.mode];
  const showMatchActivity =
    canShowPowerPanel || coachEnabled || showCoachPrompt || showFinalSixNudge;

  if (!showMatchActivity) {
    return null;
  }

  return (
    <section className="panel-section panel-section-match" aria-label="Match">
      <div className="panel-section-heading">
        <span>Match</span>
        <small>Live help and Final Six state</small>
      </div>

      <div className="panel-section-body">
        {showFinalSixNudge ? (
          <div className="coach-prompt final-six-nudge" aria-label="Final Six powers hint">
            <div>
              <strong>Final Six Powers</strong>
              <span>
                The cube is charged. Pick a glowing cell to turn the endgame into
                a visible board effect.
              </span>
            </div>
            <button type="button" onClick={onDismissFinalSixNudge}>
              <Sparkles size={15} />
              <span>Got it</span>
            </button>
          </div>
        ) : null}

        {coachEnabled ? (
          <div className="coach-legend" aria-label="Coach legend">
            <span>
              <i className="legend-dot legend-score" aria-hidden="true" />
              Score
            </span>
            <span>
              <i className="legend-dot legend-block" aria-hidden="true" />
              Block
            </span>
            <span>
              <i className="legend-dot legend-both" aria-hidden="true" />
              Score + block
            </span>
          </div>
        ) : null}

        {showCoachPrompt ? (
          <div className="coach-prompt" aria-label="Try Coach prompt">
            <div>
              <strong>Try Coach</strong>
              <span>See scoring moves, blocks, and cross-floor threats.</span>
            </div>
            <button type="button" onClick={onTryCoach}>
              <Lightbulb size={15} />
              <span>Try Coach</span>
            </button>
          </div>
        ) : null}

        {canShowPowerPanel ? (
          <div className="power-card" aria-label="Final Six Powers">
            <div className="power-header">
              <div>
                <span>Final Six</span>
                <strong>Final Six Powers (beta)</strong>
              </div>
              <span className="power-score">
                Bonus {linesBonusScores.X}-{linesBonusScores.O}
              </span>
            </div>

            {finalSixPowers.phase === 'inactive' ? (
              <p className="power-copy">At Final Six, choose on the board.</p>
            ) : null}

            {finalSixPowers.phase === 'choosing' ? (
              <>
                <div className="power-draft-status" aria-live="polite">
                  <strong>Choose on board</strong>
                  <span>
                    {mode === 'solo' && !canHumanChoosePower
                      ? 'AI chooses'
                      : `${powerPicker ?? '-'} chooses`}
                  </span>
                </div>
                <div className="power-options">
                  {powerOptions.map((power) => (
                    <button
                      key={power}
                      aria-pressed={powerSelection === power}
                      className={`power-option ${
                        powerSelection === power ? 'active' : ''
                      }`}
                      disabled={!powerPicker || !canHumanChoosePower}
                      type="button"
                      title={FINAL_SIX_POWER_DESCRIPTION[power]}
                      onClick={() => onPowerSelectionChange(power)}
                    >
                      {powerIcon(power)}
                      <span>{FINAL_SIX_POWER_SHORT_LABEL[power]}</span>
                    </button>
                  ))}
                </div>
              </>
            ) : null}

            {finalSixPowers.phase === 'active' ? (
              <div className="power-player-list">
                {POWER_PLAYERS.map((player) => {
                  const choice = finalSixPowers.players[player].choice;
                  const target =
                    choice?.id === 'power-cell' ||
                    choice?.id === 'charged-cell'
                      ? `Cell ${(choice.cell ?? 0) + 1}`
                      : choice?.line
                        ? `Cells ${choice.line
                            .map((cell) => cell + 1)
                            .join('-')}`
                        : '-';

                  return (
                    <div key={player} className="power-player-row">
                      <div>
                        <span>{player} Power</span>
                        <strong>
                          {choice ? FINAL_SIX_POWER_LABEL[choice.id] : '-'}
                        </strong>
                        <small>{choice ? target : 'Not chosen'}</small>
                      </div>
                      <span className={choice?.triggered ? 'used' : 'ready'}>
                        {choice?.triggered ? 'Used' : 'Ready'}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}
