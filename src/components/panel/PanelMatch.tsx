import { Lightbulb, Shield, Sparkles, Zap } from 'lucide-react';
import {
  FINAL_SIX_POWER_OPTIONS,
  type FinalSixPowerId,
} from '../../game/finalSixPowers';
import {
  labelPower,
  labelPowerDescription,
  labelPowerShort,
  useI18n,
} from '../../i18n';
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
  const i18n = useI18n();
  const { t } = i18n;
  const powerOptions = FINAL_SIX_POWER_OPTIONS[finalSixPowers.mode];
  const showMatchActivity =
    canShowPowerPanel || coachEnabled || showCoachPrompt || showFinalSixNudge;

  if (!showMatchActivity) {
    return null;
  }

  return (
    <section className="panel-section panel-section-match" aria-label={t('aria.match')}>
      <div className="panel-section-heading">
        <span>{t('match.match')}</span>
        <small>
          {canShowPowerPanel ? t('finalSix.title') : t('options.coach')}
        </small>
      </div>

      <div className="panel-section-body">
        {showFinalSixNudge ? (
          <div className="coach-prompt final-six-nudge" aria-label={t('aria.powerHint')}>
            <div>
              <strong>{t('finalSix.title')}</strong>
              <span>
                {t('finalSix.copy')}
              </span>
            </div>
            <button type="button" onClick={onDismissFinalSixNudge}>
              <Sparkles size={15} />
              <span>{t('action.gotIt')}</span>
            </button>
          </div>
        ) : null}

        {coachEnabled ? (
          <div className="coach-legend" aria-label={t('aria.coachLegend')}>
            <span>
              <i className="legend-dot legend-score" aria-hidden="true" />
              {t('coach.legend.score')}
            </span>
            <span>
              <i className="legend-dot legend-block" aria-hidden="true" />
              {t('coach.legend.block')}
            </span>
            <span>
              <i className="legend-dot legend-both" aria-hidden="true" />
              {t('coach.legend.both')}
            </span>
          </div>
        ) : null}

        {showCoachPrompt ? (
          <div className="coach-prompt" aria-label={t('aria.coachPrompt')}>
            <div>
              <strong>{t('coach.tryTitle')}</strong>
              <span>{t('coach.tryText')}</span>
            </div>
            <button type="button" onClick={onTryCoach}>
              <Lightbulb size={15} />
              <span>{t('action.tryCoach')}</span>
            </button>
          </div>
        ) : null}

        {canShowPowerPanel ? (
          <div className="power-card" aria-label={t('aria.powers')}>
            <div className="power-header">
              <div>
                <span>{t('finalSix.heading')}</span>
                <strong>{t('endgame.finalSixPowers')}</strong>
              </div>
              <span className="power-score">
                {t('lines.bonus')} {linesBonusScores.X}-{linesBonusScores.O}
              </span>
            </div>

            {finalSixPowers.phase === 'inactive' ? (
              <p className="power-copy">{t('finalSix.chooseBoard')}</p>
            ) : null}

            {finalSixPowers.phase === 'choosing' ? (
              <>
                <div className="power-draft-status" aria-live="polite">
                  <strong>{t('finalSix.chooseOnBoard')}</strong>
                  <span>
                    {mode === 'solo' && !canHumanChoosePower
                      ? t('finalSix.pickerAi')
                      : t('finalSix.pickerPlayer', {
                          player: powerPicker ?? '-',
                        })}
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
                      title={labelPowerDescription(i18n, power)}
                      onClick={() => onPowerSelectionChange(power)}
                    >
                      {powerIcon(power)}
                      <span>{labelPowerShort(i18n, power)}</span>
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
                      ? t('puzzle.cell', { cell: (choice.cell ?? 0) + 1 })
                      : choice?.line
                        ? `${t('power.cell')} ${choice.line
                            .map((cell) => cell + 1)
                            .join('-')}`
                        : '-';

                  return (
                    <div key={player} className="power-player-row">
                      <div>
                        <span>{t('finalSix.playerPower', { player })}</span>
                        <strong>
                          {choice ? labelPower(i18n, choice.id) : '-'}
                        </strong>
                        <small>{choice ? target : t('power.notChosen')}</small>
                      </div>
                      <span className={choice?.triggered ? 'used' : 'ready'}>
                        {choice?.triggered ? t('finalSix.used') : t('finalSix.ready')}
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
