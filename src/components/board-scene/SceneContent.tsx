import { Text } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import * as THREE from 'three';
import {
  getAnimationCells,
  getAnimationLineMoments,
  getAnimationLines,
} from '../../game/animationEvents';
import { CameraControls, CameraRig } from './Camera';
import { Cell } from './Cell';
import {
  LayoutMorphProvider,
  useLayoutMorphProgress,
} from './LayoutMorphContext';
import {
  AuthoredLineBeam,
  BoardRails,
  CoachLinePath,
  CoreGlow,
  CubeShell,
  FinalSixChargePulse,
  FloorIdentity,
  FloorPlates,
  PowerBonusFloat,
  ScanFloor,
  ShieldImpact,
  WinBeam,
} from './Environment';
import {
  LAYOUT_MORPH_DURATION_MS,
  interpolateLayoutMorph,
  layoutMorphTarget,
} from './layoutMorph';
import type { SceneContentProps } from './types';

function usePrefersReducedMotion() {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() =>
    typeof window === 'undefined'
      ? false
      : window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const updatePreference = () =>
      setPrefersReducedMotion(mediaQuery.matches);

    updatePreference();
    mediaQuery.addEventListener('change', updatePreference);

    return () => mediaQuery.removeEventListener('change', updatePreference);
  }, []);

  return prefersReducedMotion;
}

function MorphSensitiveEffects({ children }: { children: ReactNode }) {
  const group = useRef<THREE.Group>(null);
  const morphProgress = useLayoutMorphProgress();

  useFrame(() => {
    if (!group.current) {
      return;
    }

    const progress = morphProgress.current;

    // Cell-relative beams and HTML effects use exact endpoint geometry. Hide
    // them during the brief plane morph so they never detach or teleport
    // across the moving board, then restore them at the settled endpoint.
    group.current.visible = progress === 0 || progress === 1;
  });

  return (
    <group
      ref={group}
      visible={morphProgress.current === 0 || morphProgress.current === 1}
    >
      {children}
    </group>
  );
}

export function SceneContent({
  armedCell,
  animationEvents,
  board,
  coachBlockCells,
  coachHints,
  coachScoreCells,
  coachSoftScoreCells,
  currentPlayer,
  disabled,
  finalPhase,
  finalLines,
  hoveredCell,
  layout,
  powerEffects,
  scoredLines,
  theme,
  viewCommand,
  winningLine,
  onArmCell,
  onHoverCell,
  onSelect,
}: SceneContentProps) {
  const group = useRef<THREE.Group>(null);
  const morphProgress = useRef(layoutMorphTarget(layout));
  const morphAnimation = useRef({
    elapsedMs: LAYOUT_MORPH_DURATION_MS,
    from: morphProgress.current,
    to: morphProgress.current,
  });
  const prefersReducedMotion = usePrefersReducedMotion();
  const { gl } = useThree();
  const classicWinningCells = new Set(winningLine);
  const scoredCells = new Set(scoredLines.flatMap((line) => line));
  const finalCells = new Set(finalLines.flatMap((line) => line));
  const scoreCells = new Set(coachScoreCells);
  const blockCells = new Set(coachBlockCells);
  const softScoreCells = new Set(coachSoftScoreCells);
  const finalPhaseScoreCells = new Set(finalPhase?.scoringCells ?? []);
  const finalPhaseBlockCells = new Set(finalPhase?.blockingCells ?? []);
  const powerCellByCell = new Map(
    powerEffects.powerCells
      .filter((choice) => choice.cell !== null)
      .map((choice) => [choice.cell!, choice]),
  );
  const powerPreviewByCell = new Map(
    powerEffects.previewCells.map((preview) => [preview.cell, preview]),
  );
  const previewSurgeCells = new Set(
    powerEffects.previewLines
      .filter((preview) => preview.kind === 'surge-line')
      .flatMap((preview) => preview.line),
  );
  const previewShieldCells = new Set(
    powerEffects.previewLines
      .filter(
        (preview) =>
          preview.kind === 'shield-line' || preview.kind === 'shield-cell',
      )
      .flatMap((preview) => preview.line),
  );
  const shieldChoiceByCell = new Map(
    powerEffects.shieldLines
      .filter((choice) => choice.cell !== null)
      .map((choice) => [choice.cell!, choice]),
  );
  const surgeCells = new Set(
    powerEffects.surgeLines.flatMap((choice) => choice.line ?? []),
  );
  const shieldCells = new Set(
    powerEffects.shieldLines.flatMap((choice) => choice.line ?? []),
  );
  const chargedEmptyCells = new Set(powerEffects.chargedEmptyCells);
  const triggerCells = new Set(
    powerEffects.trigger
      ? powerEffects.trigger.line ?? [powerEffects.trigger.cell].filter(
          (cell): cell is number => cell !== null,
        )
      : [],
  );
  const animationLineMoments = getAnimationLineMoments(animationEvents);
  const scoreEventLines = animationEvents
    .filter(
      (event) => event.type === 'score-line' || event.type === 'multi-line',
    )
    .flatMap(getAnimationLines);
  const blockEventLines = animationEvents
    .filter((event) => event.type === 'block')
    .flatMap(getAnimationLines);
  const placeEventCells = new Set(
    animationEvents
      .filter((event) => event.type === 'place')
      .flatMap(getAnimationCells),
  );
  const scoreEventCells = new Set(scoreEventLines.flatMap((line) => line));
  const blockEventCells = new Set(blockEventLines.flatMap((line) => line));
  const powerEventCells = new Set(
    animationEvents
      .filter(
        (event) =>
          event.type === 'power-selected' || event.type === 'power-triggered',
      )
      .flatMap(getAnimationCells),
  );
  const hasFinalSixStartEvent = animationEvents.some(
    (event) => event.type === 'final-six-start',
  );
  let latestPlaceCell: number | null = null;

  for (let index = animationEvents.length - 1; index >= 0; index -= 1) {
    const event = animationEvents[index];

    if (event.type === 'place') {
      latestPlaceCell = event.cell;
      break;
    }
  }
  const finalSixPulseCells = board
    .map((value, index) => (value === null ? index : null))
    .filter((cell): cell is number => cell !== null);
  const powerTriggerEvents = animationEvents.flatMap((event) =>
    event.type === 'power-triggered' ? [event] : [],
  );
  const hintsByCell = new Map(coachHints.map((hint) => [hint.cell, hint]));
  const activeCoachCell = armedCell ?? hoveredCell;
  const activeCoachHint =
    activeCoachCell === null ? null : hintsByCell.get(activeCoachCell) ?? null;
  const activeCoachColor =
    activeCoachHint?.kind === 'score'
      ? '#74f0a7'
      : activeCoachHint?.kind === 'block'
        ? '#ff6f76'
        : activeCoachHint?.kind === 'both'
          ? '#f8d65a'
          : null;
  const beamLine =
    scoredLines[0] ??
    (winningLine.length === 3 ? winningLine : finalLines[0] ?? []);
  const beamColor = scoredLines[0] ? '#74f0a7' : theme.win;

  useLayoutEffect(() => {
    const target = layoutMorphTarget(layout);

    if (prefersReducedMotion) {
      morphProgress.current = target;
      morphAnimation.current = {
        elapsedMs: LAYOUT_MORPH_DURATION_MS,
        from: target,
        to: target,
      };
      return;
    }

    morphAnimation.current = {
      elapsedMs: 0,
      from: morphProgress.current,
      to: target,
    };
  }, [layout, prefersReducedMotion]);

  useEffect(() => {
    gl.domElement.dataset.boardLayout = layout;
  }, [gl, layout]);

  useFrame(({ clock }, delta) => {
    const animation = morphAnimation.current;

    if (animation.elapsedMs < LAYOUT_MORPH_DURATION_MS) {
      animation.elapsedMs = Math.min(
        LAYOUT_MORPH_DURATION_MS,
        animation.elapsedMs + delta * 1000,
      );
      morphProgress.current = interpolateLayoutMorph(
        animation.from,
        animation.to,
        animation.elapsedMs,
      );
    }

    if (!group.current) {
      return;
    }

    group.current.rotation.y = Math.sin(clock.elapsedTime * 0.16) * 0.06;
  });

  return (
    <>
      <ambientLight intensity={theme.ambient} />
      <directionalLight position={[3, 4, 5]} intensity={theme.directional} />
      <pointLight position={[-4, -3, -2]} color={theme.point} intensity={1.45} />
      <LayoutMorphProvider progress={morphProgress}>
        <group ref={group}>
        <BoardRails theme={theme} />
        <FloorIdentity theme={theme} />
        {theme.cubeShell ? <CubeShell theme={theme} /> : null}
        <FloorPlates theme={theme} />
        {theme.coreGlow ? <CoreGlow theme={theme} /> : null}
        {powerEffects.chargedState ? (
          <group>
            <pointLight color="#f8d65a" distance={6.8} intensity={1.05} />
            <mesh>
              <sphereGeometry args={[1.72, 28, 18]} />
              <meshBasicMaterial
                blending={THREE.AdditiveBlending}
                color="#f8d65a"
                depthWrite={false}
                opacity={0.055}
                transparent
              />
            </mesh>
          </group>
        ) : null}
        <MorphSensitiveEffects>
          {theme.winBeam && beamLine.length === 3 ? (
            <WinBeam
              color={beamColor}
              layout={layout}
              line={beamLine}
              theme={theme}
            />
          ) : null}
          {hasFinalSixStartEvent ? (
            <FinalSixChargePulse cells={finalSixPulseCells} layout={layout} />
          ) : null}
          {activeCoachHint && activeCoachColor ? (
            <CoachLinePath
              color={activeCoachColor}
              layout={layout}
              line={activeCoachHint.primaryLine}
            />
          ) : null}
          {animationLineMoments.map((moment) => (
            <AuthoredLineBeam
              key={`authored-${moment.eventId}-${moment.sequence}-${moment.line.join('-')}`}
              color={
                moment.tone === 'block'
                  ? '#ff6f76'
                  : moment.tone === 'power'
                    ? '#f8d65a'
                    : '#74f0a7'
              }
              delayMs={moment.delayMs}
              impactCell={moment.tone === 'block' ? latestPlaceCell : null}
              isCombo={moment.isCombo}
              layout={layout}
              line={moment.line}
              tone={moment.tone}
            />
          ))}
          {powerTriggerEvents.map((event) => (
            <PowerBonusFloat
              key={`power-float-${event.id}`}
              bonus={event.bonus}
              cell={event.cell}
              layout={layout}
              shieldDenied={event.shieldDenied}
            />
          ))}
          {powerTriggerEvents
            .filter(
              (event) => event.shieldDenied || event.power === 'shield-cell',
            )
            .map((event) => (
              <ShieldImpact
                key={`shield-impact-${event.id}`}
                cell={event.cell}
                layout={layout}
              />
            ))}
          {powerEffects.previewLines.map((preview) => (
            <CoachLinePath
              key={`preview-${preview.kind}-${preview.player}-${preview.line.join('-')}`}
              color={preview.kind === 'surge-line' ? '#74f0a7' : '#ff6f76'}
              layout={layout}
              line={preview.line}
            />
          ))}
          {powerEffects.surgeLines.map((choice) =>
            choice.line ? (
              <CoachLinePath
                key={`surge-${choice.player}-${choice.line.join('-')}`}
                color={choice.triggered ? '#f8d65a' : '#74f0a7'}
                layout={layout}
                line={choice.line}
              />
            ) : null,
          )}
          {powerEffects.shieldLines.map((choice) =>
            choice.line ? (
              <CoachLinePath
                key={`shield-${choice.player}-${choice.line.join('-')}`}
                color={choice.triggered ? '#f8d65a' : '#ff6f76'}
                layout={layout}
                line={choice.line}
              />
            ) : null,
          )}
        </MorphSensitiveEffects>
        {board.map((value, index) => {
          const isScore = !value && scoreCells.has(index);
          const isBlock = !value && blockCells.has(index);
          const isSoftScore = !value && softScoreCells.has(index);
          const isFinalPhaseScore = !value && finalPhaseScoreCells.has(index);
          const isFinalPhaseBlock = !value && finalPhaseBlockCells.has(index);
          const coachHint = hintsByCell.get(index);
          const powerCell = powerCellByCell.get(index);
          const powerPreview = powerPreviewByCell.get(index);
          const shieldChoice = shieldChoiceByCell.get(index);
          const isPowerSurge = surgeCells.has(index);
          const isPowerShield = shieldCells.has(index);
          const isPowerShieldCell = Boolean(shieldChoice);
          const isPowerPreviewSurge = previewSurgeCells.has(index);
          const isPowerPreviewShield = previewShieldCells.has(index);
          const isPowerTrigger = triggerCells.has(index);
          const isPowerChargedEmpty =
            !value &&
            chargedEmptyCells.has(index) &&
            !powerCell &&
            !powerPreview &&
            !isPowerShieldCell;
          const coachMark =
            isScore && isBlock
              ? 'both'
              : isScore
                ? 'score'
                : isBlock
                  ? 'block'
                  : isSoftScore
                    ? 'soft-score'
                    : null;
          const tensionMark =
            isFinalPhaseScore && isFinalPhaseBlock
              ? 'both'
              : isFinalPhaseScore
                ? 'score'
                : isFinalPhaseBlock
                  ? 'block'
                  : null;
          const cellPowerMark = isPowerTrigger
            ? 'power-trigger'
            : powerCell
              ? powerCell.id
              : powerPreview
                ? 'power-preview'
                : isPowerSurge || isPowerPreviewSurge
                  ? 'surge-line'
                  : isPowerShieldCell && shieldChoice
                    ? shieldChoice.id
                    : isPowerShield || isPowerPreviewShield
                      ? 'shield-line'
                      : isPowerChargedEmpty
                        ? 'power-charged-empty'
                        : null;
          const cellPowerText =
            powerPreview?.label ??
            (powerCell
              ? '+2'
              : isPowerSurge
                ? '+2'
                : isPowerShieldCell
                  ? shieldChoice?.id === 'shield-cell'
                    ? '+1'
                    : 'SH'
                  : null);
          const eventMark = powerEventCells.has(index)
            ? 'power'
            : scoreEventCells.has(index)
              ? 'score'
              : blockEventCells.has(index)
                ? 'block'
                : placeEventCells.has(index)
                  ? 'place'
                  : null;

          return (
            <Cell
              key={index}
              armed={armedCell === index}
              coachMark={coachMark}
              currentPlayer={currentPlayer}
              disabled={disabled}
              eventMark={eventMark}
              index={index}
              coachExplanation={coachHint?.shortLabel ?? null}
              lineMark={
                classicWinningCells.has(index)
                  ? 'win'
                  : finalCells.has(index)
                    ? 'final'
                    : scoredCells.has(index)
                      ? 'scored'
                      : null
              }
              powerMark={cellPowerMark}
              powerText={cellPowerText}
              tensionMark={tensionMark}
              theme={theme}
              value={value}
              onArm={onArmCell}
              onHover={onHoverCell}
              onSelect={onSelect}
            />
          );
        })}
        </group>
        {theme.scanFloor ? <ScanFloor theme={theme} /> : null}
      </LayoutMorphProvider>
      <Text
        anchorX="center"
        anchorY="middle"
        color={theme.title}
        fontSize={0.18}
        position={[0, -2.48, 0]}
        rotation={[-0.3, 0, 0]}
      >
        TicTacube
      </Text>
      <CameraRig layout={layout} />
      <CameraControls command={viewCommand} layout={layout} />
    </>
  );
}
