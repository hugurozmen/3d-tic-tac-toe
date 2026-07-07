import { useCallback, useEffect, useRef, useState } from 'react';
import { Player } from './rules';

export type GameAnimationEvent =
  | { type: 'place'; id: number; player: Player; cell: number }
  | { type: 'score-line'; id: number; player: Player; lines: number[][] }
  | { type: 'multi-line'; id: number; player: Player; lines: number[][] }
  | { type: 'block'; id: number; player: Player; lines: number[][] }
  | { type: 'final-six-start'; id: number }
  | {
      type: 'power-selected';
      id: number;
      player: Player;
      power: string;
      cell?: number;
      line?: number[];
    }
  | {
      type: 'power-triggered';
      id: number;
      player: Player;
      power: string;
      bonus: number;
      cell?: number;
      line?: number[];
      shieldDenied?: boolean;
    }
  | { type: 'round-end'; id: number; winner: Player | null; isDraw: boolean }
  | { type: 'match-end'; id: number; winner: Player };

export type GameAnimationEventInput = GameAnimationEvent extends infer Event
  ? Event extends GameAnimationEvent
    ? Omit<Event, 'id'>
    : never
  : never;

export type AnimationTone = 'block' | 'glass' | 'place' | 'power' | 'score';

const EVENT_DURATIONS: Record<GameAnimationEvent['type'], number> = {
  block: 520,
  'final-six-start': 1100,
  'match-end': 1300,
  'multi-line': 980,
  place: 240,
  'power-selected': 900,
  'power-triggered': 980,
  'round-end': 900,
  'score-line': 640,
};

const REDUCED_MOTION_DURATIONS: Record<GameAnimationEvent['type'], number> = {
  block: 420,
  'final-six-start': 700,
  'match-end': 800,
  'multi-line': 640,
  place: 180,
  'power-selected': 650,
  'power-triggered': 700,
  'round-end': 650,
  'score-line': 520,
};

export const shouldReduceMotion = (
  matcher: Pick<MediaQueryList, 'matches'> | null | undefined,
) => Boolean(matcher?.matches);

export const getAnimationDuration = (
  event: GameAnimationEvent,
  reduceMotion = false,
) =>
  reduceMotion
    ? REDUCED_MOTION_DURATIONS[event.type]
    : EVENT_DURATIONS[event.type];

export const getAnimationTone = (
  event: GameAnimationEvent,
): AnimationTone => {
  if (event.type === 'block') {
    return 'block';
  }

  if (event.type === 'final-six-start') {
    return 'glass';
  }

  if (event.type === 'place') {
    return 'place';
  }

  if (event.type === 'power-selected' || event.type === 'power-triggered') {
    return event.type === 'power-triggered' && event.shieldDenied
      ? 'block'
      : 'power';
  }

  return 'score';
};

export const getAnimationLines = (event: GameAnimationEvent) => {
  if (
    event.type === 'score-line' ||
    event.type === 'multi-line' ||
    event.type === 'block'
  ) {
    return event.lines;
  }

  if (
    (event.type === 'power-selected' || event.type === 'power-triggered') &&
    event.line
  ) {
    return [event.line];
  }

  return [];
};

export const getAnimationCells = (event: GameAnimationEvent) => {
  if (event.type === 'place') {
    return [event.cell];
  }

  if (
    (event.type === 'power-selected' || event.type === 'power-triggered') &&
    event.cell !== undefined
  ) {
    return [event.cell];
  }

  return Array.from(new Set(getAnimationLines(event).flat()));
};

export const createAnimationEventFactory = (startId = 0) => {
  let nextId = startId;

  return (input: GameAnimationEventInput): GameAnimationEvent => ({
    ...input,
    id: (nextId += 1),
  } as GameAnimationEvent);
};

export function useGameAnimationEvents() {
  const [events, setEvents] = useState<GameAnimationEvent[]>([]);
  const createEventRef = useRef(createAnimationEventFactory());
  const timersRef = useRef<number[]>([]);

  const clearAnimationEvents = useCallback(() => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    setEvents([]);
  }, []);

  const pushAnimationEvent = useCallback((input: GameAnimationEventInput) => {
    const event = createEventRef.current(input);
    const reduceMotion =
      typeof window !== 'undefined' &&
      shouldReduceMotion(
        window.matchMedia('(prefers-reduced-motion: reduce)'),
      );

    setEvents((current) => [...current, event]);

    const timer = window.setTimeout(() => {
      setEvents((current) => current.filter((item) => item.id !== event.id));
      timersRef.current = timersRef.current.filter((item) => item !== timer);
    }, getAnimationDuration(event, reduceMotion));

    timersRef.current.push(timer);

    return event;
  }, []);

  useEffect(() => clearAnimationEvents, [clearAnimationEvents]);

  return {
    animationEvents: events,
    clearAnimationEvents,
    pushAnimationEvent,
  };
}
