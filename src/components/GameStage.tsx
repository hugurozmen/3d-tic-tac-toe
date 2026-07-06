import {
  Equal,
  Home,
  RefreshCw,
  RotateCcw,
  RotateCw,
  Trophy,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { Suspense, forwardRef, lazy } from 'react';
import type {
  BoardLayout,
  BoardViewAction,
  BoardViewCommand,
} from '../game/boardView';
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
  coachScoreCells: number[];
  currentPlayer: Player;
  disabled: boolean;
  finalLines: number[][];
  lastMove: number | null;
  layout: BoardLayout;
  openedText: string;
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
  onResetRound: () => void;
  onSelect: (index: number) => void;
  onViewCommand: (action: BoardViewAction) => void;
};

export const GameStage = forwardRef<HTMLElement, GameStageProps>(
  function GameStage(
    {
      board,
      coachBlockCells,
      coachScoreCells,
      currentPlayer,
      disabled,
      finalLines,
      lastMove,
      layout,
      openedText,
      result,
      resultLabel,
      scannerFloor,
      scoredLines,
      stageNotice,
      theme,
      viewCommand,
      onFloorChange,
      onResetRound,
      onSelect,
      onViewCommand,
    },
    ref,
  ) {
    return (
      <section ref={ref} className="game-stage" aria-label="3D XOX board">
        {layout === 'scanner' ? (
          <ScannerBoard
            board={board}
            currentPlayer={currentPlayer}
            disabled={disabled}
            floor={scannerFloor}
            coachBlockCells={coachBlockCells}
            coachScoreCells={coachScoreCells}
            finalLines={finalLines}
            lastMove={lastMove}
            scoredLines={scoredLines}
            theme={theme}
            winningLine={result.winningLine}
            onFloorChange={onFloorChange}
            onSelect={onSelect}
          />
        ) : (
          <Suspense
            fallback={
              <div className="stage-loading">
                <span className="online-spinner" aria-hidden="true" />
                <span>Preparing the board…</span>
              </div>
            }
          >
            <BoardScene
              board={board}
              coachBlockCells={coachBlockCells}
              coachScoreCells={coachScoreCells}
              currentPlayer={currentPlayer}
              disabled={disabled}
              finalLines={finalLines}
              layout={layout}
              scoredLines={scoredLines}
              theme={theme}
              viewCommand={viewCommand}
              winningLine={result.winningLine}
              onSelect={onSelect}
            />
          </Suspense>
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
            <button type="button" onClick={onResetRound}>
              <RefreshCw size={15} />
              <span>Play again</span>
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
