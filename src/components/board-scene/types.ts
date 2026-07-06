import type {
  BoardLayout,
  BoardViewCommand,
} from '../../game/boardView';
import type { Board, Player } from '../../game/rules';
import type { SceneTheme } from '../../theme';

export type BoardSceneProps = {
  board: Board;
  coachBlockCells: number[];
  coachScoreCells: number[];
  currentPlayer: Player;
  disabled: boolean;
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
  coachMark: 'score' | 'block' | 'both' | null;
  lineMark: 'final' | 'scored' | 'win' | null;
  layout: BoardLayout;
  theme: SceneTheme;
  value: Player | null;
  onArm: (index: number | null) => void;
  onSelect: (index: number) => void;
};

export type SceneContentProps = BoardSceneProps & {
  armedCell: number | null;
  onArmCell: (index: number | null) => void;
};
