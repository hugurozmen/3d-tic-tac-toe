import {
  Equal,
  Home,
  RefreshCw,
  RotateCcw,
  RotateCw,
  ScanLine,
  TriangleAlert,
  Trophy,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  Component,
  Suspense,
  forwardRef,
  lazy,
  type ReactNode,
} from 'react';
import type {
  BoardLayout,
  BoardViewAction,
  BoardViewCommand,
} from '../game/boardView';
import type { CoachHint } from '../game/coach';
import type { FinalSixPowerBoardEffects } from '../game/finalSixPowers';
import type { LinesEndgameAnalysis } from '../game/linesTension';
import type { Board, GameResult, Player } from '../game/rules';
import type { SceneTheme } from '../theme';
import { ScannerBoard } from './ScannerBoard';

const loadBoardScene = () =>
  import('./BoardScene').then((module) => ({
    default: module.BoardScene,
  }));

const BoardScene = lazy(loadBoardScene);

export const preloadBoardScene = () => {
  void loadBoardScene();
};

type GameStageProps = {
  board: Board;
  coachBlockCells: number[];
  coachHints: CoachHint[];
  coachScoreCells: number[];
  coachSoftScoreCells: number[];
  currentPlayer: Player;
  disabled: boolean;
  finalPhase: LinesEndgameAnalysis | null;
  finalLines: number[][];
  lastMove: number | null;
  layout: BoardLayout;
  matchResultLabel: string | null;
  openedText: string;
  powerEffects: FinalSixPowerBoardEffects;
  result: GameResult;
  resultLabel: string | null;
  scannerFloor: number;
  scoredLines: number[][];
  stageNotice: {
    count?: number;
    id: number;
    text: string;
    tone: 'block' | 'score' | 'system';
  } | null;
  theme: SceneTheme;
  viewCommand: BoardViewCommand | null;
  onFloorChange: (floor: number) => void;
  onResetMatch: () => void;
  onResetRound: () => void;
  onSelect: (index: number) => void;
  onUseScanner: () => void;
  onViewCommand: (action: BoardViewAction) => void;
};

class BoardSceneBoundary extends Component<
  {
    children: ReactNode;
    fallback: ReactNode;
    resetKey: BoardLayout;
  },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(previousProps: { resetKey: BoardLayout }) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.hasError) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export const GameStage = forwardRef<HTMLElement, GameStageProps>(
  function GameStage(
    {
      board,
      coachBlockCells,
      coachHints,
      coachScoreCells,
      coachSoftScoreCells,
      currentPlayer,
      disabled,
      finalPhase,
      finalLines,
      lastMove,
      layout,
      matchResultLabel,
      openedText,
      powerEffects,
      result,
      resultLabel,
      scannerFloor,
      scoredLines,
      stageNotice,
      theme,
      viewCommand,
      onFloorChange,
      onResetMatch,
      onResetRound,
      onSelect,
      onUseScanner,
      onViewCommand,
    },
    ref,
  ) {
    const boardSceneFallback = (
      <div className="stage-error" role="alert">
        <TriangleAlert size={26} />
        <strong>3D board could not start</strong>
        <span>Scanner remains available for this round.</span>
        <button type="button" onClick={onUseScanner}>
          <ScanLine size={16} />
          <span>Scanner</span>
        </button>
      </div>
    );

    return (
      <section ref={ref} className="game-stage" aria-label="3D XOX board">
        {layout === 'scanner' ? (
          <ScannerBoard
            board={board}
            currentPlayer={currentPlayer}
            disabled={disabled}
            floor={scannerFloor}
            coachBlockCells={coachBlockCells}
            coachHints={coachHints}
            coachScoreCells={coachScoreCells}
            coachSoftScoreCells={coachSoftScoreCells}
            finalLines={finalLines}
            finalPhase={finalPhase}
            lastMove={lastMove}
            powerEffects={powerEffects}
            scoredLines={scoredLines}
            theme={theme}
            winningLine={result.winningLine}
            onFloorChange={onFloorChange}
            onSelect={onSelect}
          />
        ) : (
          <BoardSceneBoundary fallback={boardSceneFallback} resetKey={layout}>
            <Suspense
              fallback={
                <div className="stage-loading" role="status" aria-live="polite">
                  <span className="stage-loading-cube" aria-hidden="true">
                    <i />
                    <i />
                    <i />
                  </span>
                  <span>Preparing 3D board</span>
                </div>
              }
            >
              <BoardScene
                board={board}
                coachBlockCells={coachBlockCells}
                coachHints={coachHints}
                coachScoreCells={coachScoreCells}
                coachSoftScoreCells={coachSoftScoreCells}
                currentPlayer={currentPlayer}
                disabled={disabled}
                finalPhase={finalPhase}
                finalLines={finalLines}
                layout={layout}
                powerEffects={powerEffects}
                scoredLines={scoredLines}
                theme={theme}
                viewCommand={viewCommand}
                winningLine={result.winningLine}
                onSelect={onSelect}
              />
            </Suspense>
          </BoardSceneBoundary>
        )}
        {stageNotice ? (
          <div
            key={stageNotice.id}
            className={`stage-toast notice-${stageNotice.tone} ${
              (stageNotice.count ?? 0) > 1 ? 'multi' : ''
            }`}
            role="status"
          >
            {stageNotice.text}
          </div>
        ) : null}
        {finalPhase ? (
          <div className="final-phase-cue" role="status" aria-live="polite">
            {finalPhase.text}
          </div>
        ) : null}
        {result.winner || result.isDraw ? (
          <div
            className={`round-result ${
              result.winner
                ? result.winner === 'X'
                  ? 'win-x'
                  : 'win-o'
                : 'draw'
            }`}
            role="status"
          >
            <span className="round-result-label">
              {result.winner ? <Trophy size={17} /> : <Equal size={17} />}
              <strong>
                {resultLabel ??
                  (result.winner
                    ? `${result.winner} wins the round`
                    : 'Round drawn')}
              </strong>
            </span>
            <span className="round-result-opener">{openedText}</span>
            {matchResultLabel ? (
              <span className="round-result-match">{matchResultLabel}</span>
            ) : null}
            <button
              type="button"
              onClick={matchResultLabel ? onResetMatch : onResetRound}
            >
              <RefreshCw size={15} />
              <span>{matchResultLabel ? 'New match' : 'Play again'}</span>
            </button>
          </div>
        ) : null}
        {layout !== 'scanner' ? (
          <div className="stage-actions" aria-label="Board view controls">
            <button
              aria-label="Rotate board left"
              title="Rotate left"
              type="button"
              onClick={() => onViewCommand('rotate-left')}
            >
              <RotateCcw size={18} />
            </button>
            <button
              aria-label="Rotate board right"
              title="Rotate right"
              type="button"
              onClick={() => onViewCommand('rotate-right')}
            >
              <RotateCw size={18} />
            </button>
            <button
              aria-label="Zoom board in"
              title="Zoom in"
              type="button"
              onClick={() => onViewCommand('zoom-in')}
            >
              <ZoomIn size={18} />
            </button>
            <button
              aria-label="Zoom board out"
              title="Zoom out"
              type="button"
              onClick={() => onViewCommand('zoom-out')}
            >
              <ZoomOut size={18} />
            </button>
            <button
              aria-label="Reset board view"
              title="Reset view"
              type="button"
              onClick={() => onViewCommand('reset')}
            >
              <Home size={18} />
            </button>
          </div>
        ) : null}
      </section>
    );
  },
);
