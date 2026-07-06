import type {
  BoardLayout,
  BoardViewCommand,
} from '../../game/boardView';
import type { CoachHint } from '../../game/coach';
import type { LinesEndgameAnalysis } from '../../game/linesTension';
import type { Board, Player } from '../../game/rules';
import type { SceneTheme } from '../../theme';

export type BoardSceneProps = {
  board: Board;
  coachBlockCells: number[];
  coachHints: CoachHint[];
  coachScoreCells: number[];
  coachSoftScoreCells: number[];
  currentPlayer: Player;
  disabled: boolean;
  finalPhase: LinesEndgameAnalysis | null;
  finalLines: number[][];
  layout: BoardLayout;
  scoredLines: number[][];
  theme: SceneTheme;
  viewCommand: BoardViewCommand | null;
  winningLine: number[];
  onSelect: (index: number) => void;
};

export type CellProps = {
  armed: boolean;
  currentPlayer: Player;
  disabled: boolean;
  index: number;
  coachMark: 'score' | 'block' | 'both' | 'soft-score' | null;
  coachExplanation: string | null;
  lineMark: 'final' | 'scored' | 'win' | null;
  layout: BoardLayout;
  tensionMark: 'score' | 'block' | 'both' | null;
  theme: SceneTheme;
  value: Player | null;
  onArm: (index: number | null) => void;
  onHover: (index: number | null) => void;
  onSelect: (index: number) => void;
};

export type SceneContentProps = BoardSceneProps & {
  armedCell: number | null;
  hoveredCell: number | null;
  onArmCell: (index: number | null) => void;
  onHoverCell: (index: number | null) => void;
};
