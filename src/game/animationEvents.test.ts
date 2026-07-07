import { describe, expect, it } from 'vitest';
import {
  createAnimationEventFactory,
  getAnimationCellMoments,
  getAnimationCells,
  getAnimationDuration,
  getAnimationLineMoments,
  getAnimationLines,
  getAnimationTone,
  shouldReduceMotion,
} from './animationEvents';

describe('animation events', () => {
  it('creates deterministic placement events', () => {
    const createEvent = createAnimationEventFactory(40);
    const event = createEvent({
      cell: 13,
      player: 'X',
      type: 'place',
    });

    expect(event).toEqual({
      cell: 13,
      id: 41,
      player: 'X',
      type: 'place',
    });
    expect(getAnimationCells(event)).toEqual([13]);
    expect(getAnimationLines(event)).toEqual([]);
    expect(getAnimationTone(event)).toBe('place');
  });

  it('creates scoring, multi-line, and block events from line facts', () => {
    const createEvent = createAnimationEventFactory();
    const score = createEvent({
      lines: [[0, 1, 2]],
      player: 'O',
      type: 'score-line',
    });
    const combo = createEvent({
      lines: [
        [0, 1, 2],
        [2, 5, 8],
      ],
      player: 'O',
      type: 'multi-line',
    });
    const block = createEvent({
      lines: [[9, 10, 11]],
      player: 'X',
      type: 'block',
    });

    expect(score.id).toBe(1);
    expect(combo.id).toBe(2);
    expect(block.id).toBe(3);
    expect(getAnimationCells(combo)).toEqual([0, 1, 2, 5, 8]);
    expect(getAnimationTone(score)).toBe('score');
    expect(getAnimationTone(block)).toBe('block');
  });

  it('creates final-six, power-selected, and power-triggered events', () => {
    const createEvent = createAnimationEventFactory(10);
    const finalSix = createEvent({ type: 'final-six-start' });
    const selected = createEvent({
      cell: 20,
      player: 'X',
      power: 'charged-cell',
      type: 'power-selected',
    });
    const triggered = createEvent({
      bonus: 2,
      cell: 20,
      line: [18, 19, 20],
      player: 'X',
      power: 'charged-cell',
      type: 'power-triggered',
    });

    expect(finalSix.id).toBe(11);
    expect(getAnimationTone(finalSix)).toBe('glass');
    expect(getAnimationCells(selected)).toEqual([20]);
    expect(getAnimationLines(triggered)).toEqual([[18, 19, 20]]);
    expect(getAnimationTone(triggered)).toBe('power');
  });

  it('uses calmer durations for reduced-motion users', () => {
    const createEvent = createAnimationEventFactory();
    const event = createEvent({
      lines: [
        [0, 1, 2],
        [2, 5, 8],
      ],
      player: 'O',
      type: 'multi-line',
    });

    expect(shouldReduceMotion({ matches: true })).toBe(true);
    expect(shouldReduceMotion({ matches: false })).toBe(false);
    expect(getAnimationDuration(event, true)).toBeLessThan(
      getAnimationDuration(event, false),
    );
  });

  it('derives authored line moments without adding event types', () => {
    const createEvent = createAnimationEventFactory();
    const events = [
      createEvent({
        lines: [
          [0, 1, 2],
          [2, 5, 8],
        ],
        player: 'X',
        type: 'multi-line',
      }),
      createEvent({
        bonus: 1,
        cell: 8,
        line: [2, 5, 8],
        player: 'O',
        power: 'shield-cell',
        shieldDenied: true,
        type: 'power-triggered',
      }),
    ];

    const lineMoments = getAnimationLineMoments(events);
    const cellMoments = getAnimationCellMoments(events);

    expect(lineMoments).toMatchObject([
      {
        delayMs: 0,
        eventType: 'multi-line',
        isCombo: true,
        sequence: 0,
        tone: 'score',
      },
      {
        delayMs: 170,
        eventType: 'multi-line',
        isCombo: true,
        sequence: 1,
        tone: 'score',
      },
      {
        eventType: 'power-triggered',
        shieldDenied: true,
        tone: 'block',
      },
    ]);
    expect(cellMoments.filter((moment) => moment.cell === 2)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ step: 2, tone: 'score' }),
        expect.objectContaining({ step: 0, tone: 'score' }),
        expect.objectContaining({ step: 0, tone: 'block' }),
      ]),
    );
  });
});
