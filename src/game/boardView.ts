export type BoardLayout = 'cube' | 'floors' | 'scanner';

export type BoardViewAction =
  | 'reset'
  | 'rotate-left'
  | 'rotate-right'
  | 'zoom-in'
  | 'zoom-out';

export type BoardViewCommand = {
  action: BoardViewAction;
  id: number;
};

export const BOARD_LAYOUTS: BoardLayout[] = ['cube', 'floors', 'scanner'];
