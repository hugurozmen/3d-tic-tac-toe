import { Circle, Equal, LoaderCircle, Trophy, X } from 'lucide-react';
import type { GameRuleset, LineScores, Player } from '../game/rules';
import { useI18n } from '../i18n';

export type StageHudProps = {
  currentPlayer: Player;
  handoverId?: number;
  isAiThinking: boolean;
  isComplete: boolean;
  isDraw: boolean;
  lineScores: LineScores;
  matchScoreText: string;
  remainingCells: number;
  ruleset: GameRuleset;
  status: string;
  onlineTurn?: {
    localPlayer: Player;
    owner: 'local' | 'opponent';
  } | null;
};

const markIcon = (player: Player) =>
  player === 'X' ? (
    <X aria-hidden="true" size={17} />
  ) : (
    <Circle aria-hidden="true" size={16} />
  );

export function StageHud({
  currentPlayer,
  handoverId = 0,
  isAiThinking,
  isComplete,
  isDraw,
  lineScores,
  matchScoreText,
  remainingCells,
  ruleset,
  status,
  onlineTurn = null,
}: StageHudProps) {
  const { t } = useI18n();

  return (
    <div
      className={`stage-hud stage-hud-ruleset-${ruleset} ${
        isComplete ? 'stage-hud-terminal' : ''
      } ${isDraw ? 'stage-hud-draw' : ''} ${
        onlineTurn ? 'stage-hud-online' : ''
      }`}
      aria-label={t('aria.stageHud')}
    >
      <div
        key={onlineTurn ? `online-handover-${handoverId}` : 'local-turn'}
        className={`stage-hud-turn turn-${currentPlayer.toLowerCase()} ${
          onlineTurn
            ? `online-turn-${onlineTurn.owner} online-local-mark-${onlineTurn.localPlayer.toLowerCase()} ${
                onlineTurn.owner === 'local' && handoverId > 0
                  ? 'online-turn-handover'
                  : ''
              }`
            : ''
        }`}
        aria-live="polite"
        role="status"
      >
        {isDraw ? (
          <Equal aria-hidden="true" size={17} />
        ) : isComplete ? (
          <Trophy aria-hidden="true" size={17} />
        ) : isAiThinking ? (
          <LoaderCircle
            className="stage-hud-thinking"
            aria-hidden="true"
            size={17}
          />
        ) : (
          markIcon(currentPlayer)
        )}
        <span>
          <small>{t(isComplete ? 'hud.result' : 'hud.turn')}</small>
          <strong>{status}</strong>
        </span>
      </div>

      {ruleset === 'lines' ? (
        <div className="stage-hud-stat stage-hud-lines">
          <small>{t('hud.lines')}</small>
          <strong>
            {lineScores.X}–{lineScores.O}
          </strong>
        </div>
      ) : null}

      <div className="stage-hud-stat stage-hud-match">
        <small>{t('hud.match')}</small>
        <strong>{matchScoreText}</strong>
      </div>

      {ruleset === 'lines' ? (
        <div
          className={`stage-hud-stat stage-hud-remaining ${
            remainingCells > 0 && remainingCells <= 6 ? 'tense' : ''
          }`}
        >
          <small>{t('hud.remaining')}</small>
          <strong>{remainingCells}</strong>
        </div>
      ) : null}
    </div>
  );
}
