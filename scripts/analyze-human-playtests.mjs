#!/usr/bin/env node

import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const CSV_FIELDS = [
  'participant_id',
  'experience_cohort',
  'session',
  'game_number',
  'condition_order',
  'build_sha',
  'device_viewport',
  'prior_3dxox_experience',
  'ruleset',
  'board_view',
  'lines_variant',
  'final_six_powers',
  'player_mark',
  'opener',
  'opening_cell',
  'score_move_21_player',
  'score_move_21_ai',
  'final_score_player',
  'final_score_ai',
  'result',
  'coach_used',
  'observed_hesitation',
  'threat_misses',
  'confusion_observed',
  'observed_confusion',
  'move_comment',
  'fairness_1_5',
  'understood_ai_1_5',
  'recoverability_1_5',
  'rematch_intent_1_5',
  'opening_condition',
  'pair_summary',
  'opening_freedom_1_5',
  'avoid_center',
  'viable_non_center_opening',
  'center_feel',
  'center_comment',
  'predicted_winner_move_21',
  'prediction_confidence_0_100',
  'trailing_player_can_change',
  'critical_remaining_cell',
  'critical_cell_reason',
  'last_six_non_tie_lead_changed',
  'ending_feel',
  'believed_decided',
  'hidden_opponent',
  'actual_difficulty',
  'blind_difficulty_1_5',
  'blind_style',
  'identified_stronger',
  'identity_confidence_0_100',
  'fun_preference',
  'rematch_preference',
  'identity_behavior',
  'identity_concern',
  'notes',
];

const SESSION_NAMES = ['casual', 'center', 'final_six', 'blind'];
const COHORTS = ['new_casual', 'experienced'];

export class PlaytestValidationError extends Error {
  constructor(errors) {
    super(`Playtest CSV has ${errors.length} validation error${errors.length === 1 ? '' : 's'}.`);
    this.name = 'PlaytestValidationError';
    this.errors = errors;
  }
}

/** Parse RFC 4180-style CSV, including escaped quotes and quoted newlines. */
export function parseCsv(text) {
  const records = [];
  let row = [];
  let field = '';
  let quoted = false;
  let line = 1;
  let recordLine = 1;

  const finishRow = () => {
    row.push(field);
    const nonEmpty = row.some((value) => value.trim() !== '');
    if (nonEmpty) records.push({ cells: row, line: recordLine });
    row = [];
    field = '';
    recordLine = line + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
        if (char === '\n') line += 1;
      }
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
    } else if (char === ',') {
      row.push(field);
      field = '';
    } else if (char === '\n') {
      finishRow();
      line += 1;
      recordLine = line;
    } else if (char !== '\r') {
      field += char;
    }
  }

  if (quoted) {
    throw new PlaytestValidationError([`Line ${recordLine}: unclosed quoted field.`]);
  }
  if (field !== '' || row.length > 0) finishRow();
  if (records.length === 0) {
    throw new PlaytestValidationError(['The CSV is empty.']);
  }

  const headers = records[0].cells.map((value, index) =>
    index === 0 ? value.replace(/^\uFEFF/, '').trim() : value.trim(),
  );
  const duplicateHeaders = headers.filter(
    (header, index) => header && headers.indexOf(header) !== index,
  );
  if (duplicateHeaders.length > 0) {
    throw new PlaytestValidationError([
      `Header has duplicate column(s): ${[...new Set(duplicateHeaders)].join(', ')}.`,
    ]);
  }

  const raggedRows = records
    .slice(1)
    .filter((record) => record.cells.length !== headers.length)
    .map(
      (record) =>
        `Line ${record.line}: expected ${headers.length} columns but found ${record.cells.length}.`,
    );
  if (raggedRows.length > 0) throw new PlaytestValidationError(raggedRows);

  const rows = records.slice(1).map((record) => {
    const values = {};
    headers.forEach((header, index) => {
      values[header] = (record.cells[index] ?? '').trim();
    });
    return { ...values, _line: record.line };
  });
  return { headers, rows };
}

function groupBy(items, keyFor) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFor(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  return groups;
}

function leader(playerScore, aiScore) {
  if (playerScore > aiScore) return 'player';
  if (aiScore > playerScore) return 'ai';
  return 'draw';
}

function expectedResult(row) {
  const outcome = leader(Number(row.final_score_player), Number(row.final_score_ai));
  return outcome === 'player' ? 'win' : outcome === 'ai' ? 'loss' : 'draw';
}

function validateRequired(row, field, errors) {
  if (!row[field]) errors.push(`Line ${row._line}: ${field} is required.`);
}

function validateEnum(row, field, values, errors, required = true) {
  if (!row[field]) {
    if (required) validateRequired(row, field, errors);
    return;
  }
  if (!values.includes(row[field])) {
    errors.push(`Line ${row._line}: ${field} must be one of ${values.join(', ')}; received "${row[field]}".`);
  }
}

function validateInteger(row, field, min, max, errors, required = true) {
  if (!row[field]) {
    if (required) validateRequired(row, field, errors);
    return;
  }
  const value = Number(row[field]);
  if (!Number.isInteger(value) || value < min || value > max) {
    errors.push(`Line ${row._line}: ${field} must be an integer from ${min} to ${max}; received "${row[field]}".`);
  }
}

function validateCommonRow(row, errors) {
  for (const field of [
    'participant_id',
    'condition_order',
    'build_sha',
    'device_viewport',
    'prior_3dxox_experience',
  ]) {
    validateRequired(row, field, errors);
  }
  validateEnum(row, 'experience_cohort', COHORTS, errors);
  validateEnum(row, 'session', SESSION_NAMES, errors);
  validateInteger(row, 'game_number', 1, 4, errors);
  validateEnum(row, 'ruleset', ['lines'], errors);
  validateEnum(row, 'board_view', ['scanner'], errors);
  validateEnum(row, 'lines_variant', ['standard'], errors);
  validateEnum(row, 'final_six_powers', ['off'], errors);
  validateEnum(row, 'player_mark', ['X', 'O'], errors);
  validateEnum(row, 'opener', ['player', 'ai'], errors);
  validateInteger(row, 'opening_cell', 1, 27, errors);
  validateInteger(row, 'score_move_21_player', 0, 49, errors);
  validateInteger(row, 'score_move_21_ai', 0, 49, errors);
  validateInteger(row, 'final_score_player', 0, 49, errors);
  validateInteger(row, 'final_score_ai', 0, 49, errors);
  validateEnum(row, 'result', ['win', 'draw', 'loss'], errors);
  validateEnum(row, 'coach_used', ['yes', 'no'], errors);

  if (row.player_mark === 'X' && row.opener && row.opener !== 'player') {
    errors.push(`Line ${row._line}: player_mark X requires opener=player in this Lines protocol.`);
  }
  if (row.player_mark === 'O' && row.opener && row.opener !== 'ai') {
    errors.push(`Line ${row._line}: player_mark O requires opener=ai in this Lines protocol.`);
  }
  if (
    row.final_score_player &&
    row.score_move_21_player &&
    Number(row.final_score_player) < Number(row.score_move_21_player)
  ) {
    errors.push(`Line ${row._line}: player score cannot decrease after move 21.`);
  }
  if (
    row.final_score_ai &&
    row.score_move_21_ai &&
    Number(row.final_score_ai) < Number(row.score_move_21_ai)
  ) {
    errors.push(`Line ${row._line}: AI score cannot decrease after move 21.`);
  }
  if (row.result && row.final_score_player && row.final_score_ai && row.result !== expectedResult(row)) {
    errors.push(`Line ${row._line}: result=${row.result} conflicts with final score ${row.final_score_player}-${row.final_score_ai}.`);
  }
}

function validateCasualRow(row, errors) {
  validateEnum(row, 'condition_order', ['player-ai', 'ai-player'], errors);
  validateEnum(row, 'observed_hesitation', ['yes', 'no'], errors);
  validateInteger(row, 'threat_misses', 0, 27, errors);
  validateEnum(row, 'confusion_observed', ['yes', 'no'], errors);
  validateRequired(row, 'observed_confusion', errors);
  validateRequired(row, 'move_comment', errors);
  validateInteger(row, 'fairness_1_5', 1, 5, errors);
  validateInteger(row, 'understood_ai_1_5', 1, 5, errors);
  validateInteger(row, 'recoverability_1_5', 1, 5, errors);
  validateInteger(row, 'rematch_intent_1_5', 1, 5, errors);
}

function validateCenterRow(row, errors) {
  validateEnum(row, 'condition_order', ['center-non_center', 'non_center-center'], errors);
  validateEnum(row, 'opening_condition', ['center', 'non_center'], errors);
  validateEnum(row, 'pair_summary', ['yes', 'no'], errors);
  if (row.opener && row.opener !== 'player') {
    errors.push(`Line ${row._line}: center-pressure games require the player to open.`);
  }
  if (row.opening_condition === 'center' && row.opening_cell && Number(row.opening_cell) !== 14) {
    errors.push(`Line ${row._line}: center condition must open cell 14.`);
  }
  if (row.opening_condition === 'non_center' && row.opening_cell && Number(row.opening_cell) === 14) {
    errors.push(`Line ${row._line}: non_center condition cannot open cell 14.`);
  }
  if (row.pair_summary === 'yes') {
    validateInteger(row, 'opening_freedom_1_5', 1, 5, errors);
    validateEnum(row, 'avoid_center', ['yes', 'no', 'unsure'], errors);
    validateRequired(row, 'viable_non_center_opening', errors);
    validateEnum(row, 'center_feel', ['valuable', 'preferred', 'mandatory'], errors);
    validateRequired(row, 'center_comment', errors);
  }
}

function validateFinalSixRow(row, errors) {
  validateEnum(row, 'condition_order', ['player-player', 'player-ai', 'ai-player', 'ai-ai'], errors);
  validateEnum(row, 'predicted_winner_move_21', ['player', 'ai', 'draw'], errors);
  validateInteger(row, 'prediction_confidence_0_100', 0, 100, errors);
  validateEnum(row, 'trailing_player_can_change', ['yes', 'no', 'unsure'], errors);
  validateInteger(row, 'critical_remaining_cell', 1, 27, errors);
  validateRequired(row, 'critical_cell_reason', errors);
  validateEnum(row, 'last_six_non_tie_lead_changed', ['yes', 'no'], errors);
  validateEnum(row, 'ending_feel', ['tense', 'solvable', 'automatic'], errors);
  validateRequired(row, 'believed_decided', errors);
  if (row.coach_used && row.coach_used !== 'no') {
    errors.push(`Line ${row._line}: Standard final-six games require coach_used=no.`);
  }
}

function validateBlindRow(row, errors) {
  validateEnum(row, 'condition_order', ['ABBA', 'BAAB'], errors);
  validateEnum(row, 'hidden_opponent', ['A', 'B'], errors);
  validateEnum(row, 'actual_difficulty', ['Smart', 'Hard'], errors);
  validateInteger(row, 'blind_difficulty_1_5', 1, 5, errors);
  validateInteger(row, 'fairness_1_5', 1, 5, errors);
  validateRequired(row, 'blind_style', errors);
  validateEnum(row, 'pair_summary', ['yes', 'no'], errors);
  if (row.pair_summary === 'yes') {
    validateEnum(row, 'identified_stronger', ['A', 'B', 'same'], errors);
    validateInteger(row, 'identity_confidence_0_100', 0, 100, errors);
    validateEnum(row, 'fun_preference', ['A', 'B', 'same'], errors);
    validateEnum(row, 'rematch_preference', ['A', 'B', 'same'], errors);
    validateRequired(row, 'identity_behavior', errors);
    validateRequired(row, 'identity_concern', errors);
  }
}

function validateSessionGroup(participantId, session, rows, errors) {
  const expectedCount = { casual: 2, center: 2, final_six: 2, blind: 4 }[session];
  const sorted = [...rows].sort((a, b) => Number(a.game_number) - Number(b.game_number));
  if (rows.length !== expectedCount) {
    errors.push(`${participantId}/${session}: expected ${expectedCount} game rows; found ${rows.length}.`);
    return;
  }
  const numbers = sorted.map((row) => Number(row.game_number));
  const expectedNumbers = Array.from({ length: expectedCount }, (_, index) => index + 1);
  if (numbers.join(',') !== expectedNumbers.join(',')) {
    errors.push(`${participantId}/${session}: game_number values must be ${expectedNumbers.join(', ')}.`);
  }
  if (new Set(rows.map((row) => row.condition_order)).size !== 1) {
    errors.push(`${participantId}/${session}: condition_order must stay constant within the session.`);
  }

  if (session === 'casual') {
    const expected = rows[0].condition_order === 'player-ai' ? ['player', 'ai'] : ['ai', 'player'];
    if (sorted.map((row) => row.opener).join(',') !== expected.join(',')) {
      errors.push(`${participantId}/casual: opener sequence must match condition_order=${rows[0].condition_order}.`);
    }
  }
  if (session === 'center') {
    const expected = rows[0].condition_order === 'center-non_center'
      ? ['center', 'non_center']
      : ['non_center', 'center'];
    if (sorted.map((row) => row.opening_condition).join(',') !== expected.join(',')) {
      errors.push(`${participantId}/center: opening sequence must match condition_order=${rows[0].condition_order}.`);
    }
    if (rows.filter((row) => row.pair_summary === 'yes').length !== 1) {
      errors.push(`${participantId}/center: exactly one row must have pair_summary=yes.`);
    }
  }
  if (session === 'final_six') {
    const expected = rows[0].condition_order.split('-');
    if (sorted.map((row) => row.opener).join(',') !== expected.join(',')) {
      errors.push(`${participantId}/final_six: opener sequence must match condition_order=${rows[0].condition_order}.`);
    }
  }
  if (session === 'blind') {
    const expected = rows[0].condition_order.split('');
    if (sorted.map((row) => row.hidden_opponent).join(',') !== expected.join(',')) {
      errors.push(`${participantId}/blind: opponent sequence must match condition_order=${rows[0].condition_order}.`);
    }
    if (rows.filter((row) => row.pair_summary === 'yes').length !== 1) {
      errors.push(`${participantId}/blind: exactly one row must have pair_summary=yes.`);
    }
    for (const opponent of ['A', 'B']) {
      const opponentRows = rows.filter((row) => row.hidden_opponent === opponent);
      if (new Set(opponentRows.map((row) => row.actual_difficulty)).size !== 1) {
        errors.push(`${participantId}/blind: opponent ${opponent} must map to one actual difficulty.`);
      }
      if (new Set(opponentRows.map((row) => row.player_mark)).size !== 2) {
        errors.push(`${participantId}/blind: player must face opponent ${opponent} once as X and once as O.`);
      }
    }
    const mapping = new Map(rows.map((row) => [row.hidden_opponent, row.actual_difficulty]));
    if (mapping.get('A') === mapping.get('B')) {
      errors.push(`${participantId}/blind: A and B must map to different Smart/Hard identities.`);
    }
    if (new Set(rows.map((row) => row.coach_used)).size !== 1) {
      errors.push(`${participantId}/blind: Coach setting must stay identical across all four games.`);
    }
  }
}

export function validatePlaytestRows(headers, rows) {
  const errors = [];
  const missingHeaders = CSV_FIELDS.filter((field) => !headers.includes(field));
  if (missingHeaders.length > 0) {
    errors.push(`Missing required column(s): ${missingHeaders.join(', ')}.`);
  }
  if (rows.length === 0) errors.push('The CSV has a header but no game rows.');

  for (const row of rows) {
    validateCommonRow(row, errors);
    if (row.session === 'casual') validateCasualRow(row, errors);
    if (row.session === 'center') validateCenterRow(row, errors);
    if (row.session === 'final_six') validateFinalSixRow(row, errors);
    if (row.session === 'blind') validateBlindRow(row, errors);
  }

  const uniqueGames = new Set();
  for (const row of rows) {
    const key = `${row.participant_id}/${row.session}/${row.game_number}`;
    if (uniqueGames.has(key)) errors.push(`Line ${row._line}: duplicate game key ${key}.`);
    uniqueGames.add(key);
  }

  const byParticipant = groupBy(rows, (row) => row.participant_id);
  for (const [participantId, participantRows] of byParticipant) {
    for (const field of ['experience_cohort', 'prior_3dxox_experience']) {
      if (new Set(participantRows.map((row) => row[field])).size !== 1) {
        errors.push(`${participantId}: ${field} must stay constant across the participant's rows.`);
      }
    }
    const bySession = groupBy(participantRows, (row) => row.session);
    for (const [session, sessionRows] of bySession) {
      if (SESSION_NAMES.includes(session)) {
        validateSessionGroup(participantId, session, sessionRows, errors);
      }
    }
  }

  if (errors.length > 0) throw new PlaytestValidationError(errors);
  return rows;
}

const average = (values) =>
  values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;

const ratio = (items, predicate) =>
  items.length === 0 ? null : items.filter(predicate).length / items.length;

function dimensions(items) {
  const groups = [{ label: 'Overall', items }];
  for (const cohort of [...new Set(items.map((item) => item.cohort))].sort()) {
    groups.push({ label: `Cohort: ${cohort}`, items: items.filter((item) => item.cohort === cohort) });
  }
  for (const order of [...new Set(items.map((item) => item.order))].sort()) {
    groups.push({ label: `Order: ${order}`, items: items.filter((item) => item.order === order) });
  }
  return groups;
}

function countResults(rows) {
  return ['win', 'draw', 'loss'].map((result) => rows.filter((row) => row.result === result).length);
}

function preferenceDifficulty(letter, mapping) {
  return letter === 'same' ? 'same' : mapping[letter];
}

export function analyzePlaytestRows(rows) {
  const participants = [...new Set(rows.map((row) => row.participant_id))];
  const sessionsPresent = groupBy(rows, (row) => row.session);

  const casualItems = (sessionsPresent.get('casual') ?? []).map((row) => ({
    row,
    cohort: row.experience_cohort,
    order: row.condition_order,
  }));
  const casualGroups = dimensions(casualItems).map(({ label, items }) => {
    const games = items.map((item) => item.row);
    return {
      label,
      games: games.length,
      fairness: average(games.map((row) => Number(row.fairness_1_5))),
      understood: average(games.map((row) => Number(row.understood_ai_1_5))),
      recoverability: average(games.map((row) => Number(row.recoverability_1_5))),
      rematchIntent: average(games.map((row) => Number(row.rematch_intent_1_5))),
      hintUseRate: ratio(games, (row) => row.coach_used === 'yes'),
      confusionRate: ratio(games, (row) => row.confusion_observed === 'yes'),
      hesitationRate: ratio(games, (row) => row.observed_hesitation === 'yes'),
      threatMisses: average(games.map((row) => Number(row.threat_misses))),
      winRate: ratio(games, (row) => row.result === 'win'),
    };
  });

  const centerPairs = [];
  const centerByParticipant = groupBy(sessionsPresent.get('center') ?? [], (row) => row.participant_id);
  for (const [participantId, pairRows] of centerByParticipant) {
    const center = pairRows.find((row) => row.opening_condition === 'center');
    const nonCenter = pairRows.find((row) => row.opening_condition === 'non_center');
    const summary = pairRows.find((row) => row.pair_summary === 'yes');
    centerPairs.push({
      participantId,
      cohort: center.experience_cohort,
      order: center.condition_order,
      center,
      nonCenter,
      centerDifferential: Number(center.final_score_player) - Number(center.final_score_ai),
      nonCenterDifferential: Number(nonCenter.final_score_player) - Number(nonCenter.final_score_ai),
      openingFreedom: Number(summary.opening_freedom_1_5),
      summary,
    });
  }
  const centerGroups = dimensions(centerPairs).map(({ label, items }) => {
    const centerRows = items.map((item) => item.center);
    const nonCenterRows = items.map((item) => item.nonCenter);
    const comparisons = items.map((item) => item.centerDifferential - item.nonCenterDifferential);
    return {
      label,
      pairs: items.length,
      centerDifferential: average(items.map((item) => item.centerDifferential)),
      nonCenterDifferential: average(items.map((item) => item.nonCenterDifferential)),
      pairedDelta: average(comparisons),
      centerResults: countResults(centerRows),
      nonCenterResults: countResults(nonCenterRows),
      centerBetterRate: ratio(comparisons, (value) => value > 0),
      equalRate: ratio(comparisons, (value) => value === 0),
      nonCenterBetterRate: ratio(comparisons, (value) => value < 0),
      openingFreedom: average(items.map((item) => item.openingFreedom)),
    };
  });

  const finalSixItems = (sessionsPresent.get('final_six') ?? []).map((row) => {
    const move21Leader = leader(Number(row.score_move_21_player), Number(row.score_move_21_ai));
    const finalLeader = leader(Number(row.final_score_player), Number(row.final_score_ai));
    const move21Differential = Number(row.score_move_21_player) - Number(row.score_move_21_ai);
    const finalDifferential = Number(row.final_score_player) - Number(row.final_score_ai);
    return {
      row,
      cohort: row.experience_cohort,
      order: row.condition_order,
      move21Leader,
      finalLeader,
      outcomeChanged: move21Leader !== finalLeader,
      differentialSwing: Math.abs(finalDifferential - move21Differential),
      predictionCorrect: row.predicted_winner_move_21 === finalLeader,
    };
  });
  const finalSixGroups = dimensions(finalSixItems).map(({ label, items }) => ({
    label,
    games: items.length,
    outcomeChangeRate: ratio(items, (item) => item.outcomeChanged),
    leadChangeRate: ratio(items, (item) => item.row.last_six_non_tie_lead_changed === 'yes'),
    differentialSwing: average(items.map((item) => item.differentialSwing)),
    predictionConfidence: average(items.map((item) => Number(item.row.prediction_confidence_0_100))),
    predictionAccuracy: ratio(items, (item) => item.predictionCorrect),
    comebackBeliefRate: ratio(items, (item) => item.row.trailing_player_can_change === 'yes'),
    tenseRate: ratio(items, (item) => item.row.ending_feel === 'tense'),
  }));

  const blindParticipants = [];
  const blindByParticipant = groupBy(sessionsPresent.get('blind') ?? [], (row) => row.participant_id);
  for (const [participantId, blindRows] of blindByParticipant) {
    const summary = blindRows.find((row) => row.pair_summary === 'yes');
    const mapping = Object.fromEntries(blindRows.map((row) => [row.hidden_opponent, row.actual_difficulty]));
    const identified = preferenceDifficulty(summary.identified_stronger, mapping);
    blindParticipants.push({
      participantId,
      cohort: summary.experience_cohort,
      order: summary.condition_order,
      rows: blindRows,
      summary,
      mapping,
      identified,
      identificationCorrect: identified === 'Hard',
      indistinguishable: identified === 'same',
      funPreference: preferenceDifficulty(summary.fun_preference, mapping),
      rematchPreference: preferenceDifficulty(summary.rematch_preference, mapping),
    });
  }
  const blindGroups = dimensions(blindParticipants).map(({ label, items }) => {
    const gameRows = items.flatMap((item) => item.rows);
    const smartRows = gameRows.filter((row) => row.actual_difficulty === 'Smart');
    const hardRows = gameRows.filter((row) => row.actual_difficulty === 'Hard');
    return {
      label,
      participants: items.length,
      identificationAccuracy: ratio(items, (item) => item.identificationCorrect),
      indistinguishableRate: ratio(items, (item) => item.indistinguishable),
      confidence: average(items.map((item) => Number(item.summary.identity_confidence_0_100))),
      smartFunRate: ratio(items, (item) => item.funPreference === 'Smart'),
      hardFunRate: ratio(items, (item) => item.funPreference === 'Hard'),
      sameFunRate: ratio(items, (item) => item.funPreference === 'same'),
      smartRematchRate: ratio(items, (item) => item.rematchPreference === 'Smart'),
      hardRematchRate: ratio(items, (item) => item.rematchPreference === 'Hard'),
      sameRematchRate: ratio(items, (item) => item.rematchPreference === 'same'),
      smartDifficulty: average(smartRows.map((row) => Number(row.blind_difficulty_1_5))),
      hardDifficulty: average(hardRows.map((row) => Number(row.blind_difficulty_1_5))),
      smartFairness: average(smartRows.map((row) => Number(row.fairness_1_5))),
      hardFairness: average(hardRows.map((row) => Number(row.fairness_1_5))),
    };
  });

  const missingSessions = [];
  const rowsByParticipant = groupBy(rows, (row) => row.participant_id);
  for (const [participantId, participantRows] of rowsByParticipant) {
    const present = new Set(participantRows.map((row) => row.session));
    for (const session of SESSION_NAMES) {
      if (!present.has(session)) missingSessions.push(`${participantId}: ${session}`);
    }
  }

  return {
    sample: {
      participants: participants.length,
      games: rows.length,
      cohorts: Object.fromEntries(
        COHORTS.map((cohort) => [
          cohort,
          new Set(rows.filter((row) => row.experience_cohort === cohort).map((row) => row.participant_id)).size,
        ]),
      ),
      missingSessions,
    },
    casual: {
      groups: casualGroups,
      evidence: casualItems.map(({ row }) => ({
        participantId: row.participant_id,
        confusion: row.observed_confusion,
        moveComment: row.move_comment,
        notes: row.notes,
      })),
    },
    center: {
      groups: centerGroups,
      evidence: centerPairs.map((item) => ({
        participantId: item.participantId,
        feel: item.summary.center_feel,
        avoidCenter: item.summary.avoid_center,
        viableOpening: item.summary.viable_non_center_opening,
        comment: item.summary.center_comment,
      })),
    },
    finalSix: {
      groups: finalSixGroups,
      evidence: finalSixItems.map((item) => ({
        participantId: item.row.participant_id,
        criticalCell: item.row.critical_remaining_cell,
        reason: item.row.critical_cell_reason,
        endingFeel: item.row.ending_feel,
        believedDecided: item.row.believed_decided,
      })),
    },
    blind: {
      groups: blindGroups,
      evidence: blindParticipants.map((item) => ({
        participantId: item.participantId,
        behavior: item.summary.identity_behavior,
        concern: item.summary.identity_concern,
        styles: item.rows.map((row) => `${row.hidden_opponent}: ${row.blind_style}`),
      })),
    },
  };
}

const fixed = (value, digits = 2) => (value === null ? 'n/a' : value.toFixed(digits));
const percent = (value) => (value === null ? 'n/a' : `${(value * 100).toFixed(1)}%`);
const markdown = (value) => String(value ?? '').replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
const wdl = (values) => `${values[0]}/${values[1]}/${values[2]}`;

function table(headers, rows) {
  return [
    `| ${headers.join(' | ')} |`,
    `| ${headers.map(() => '---').join(' | ')} |`,
    ...rows.map((row) => `| ${row.map(markdown).join(' | ')} |`),
  ].join('\n');
}

function evidenceLines(items, format) {
  if (items.length === 0) return '_No valid rows for this session._';
  return items.map((item) => `- ${format(item)}`).join('\n');
}

export function renderPlaytestReport(analysis) {
  const casualTable = table(
    ['Group', 'Games', 'Fair', 'Understood', 'Recoverable', 'Rematch', 'Coach', 'Confusion', 'Hesitation', 'Threat misses', 'Player wins'],
    analysis.casual.groups.map((group) => [
      group.label,
      group.games,
      fixed(group.fairness),
      fixed(group.understood),
      fixed(group.recoverability),
      fixed(group.rematchIntent),
      percent(group.hintUseRate),
      percent(group.confusionRate),
      percent(group.hesitationRate),
      fixed(group.threatMisses),
      percent(group.winRate),
    ]),
  );
  const centerTable = table(
    ['Group', 'Pairs', 'Center diff', 'Non-center diff', 'Paired delta', 'Center W/D/L', 'Non-center W/D/L', 'Center/non/tie better', 'Opening freedom'],
    analysis.center.groups.map((group) => [
      group.label,
      group.pairs,
      fixed(group.centerDifferential),
      fixed(group.nonCenterDifferential),
      fixed(group.pairedDelta),
      wdl(group.centerResults),
      wdl(group.nonCenterResults),
      `${percent(group.centerBetterRate)}/${percent(group.nonCenterBetterRate)}/${percent(group.equalRate)}`,
      fixed(group.openingFreedom),
    ]),
  );
  const finalSixTable = table(
    ['Group', 'Games', 'Outcome changed', 'Lead changed', 'Abs diff swing', 'Prediction confidence', 'Prediction accuracy', 'Comeback believed', 'Tense'],
    analysis.finalSix.groups.map((group) => [
      group.label,
      group.games,
      percent(group.outcomeChangeRate),
      percent(group.leadChangeRate),
      fixed(group.differentialSwing),
      `${fixed(group.predictionConfidence, 1)}%`,
      percent(group.predictionAccuracy),
      percent(group.comebackBeliefRate),
      percent(group.tenseRate),
    ]),
  );
  const blindTable = table(
    ['Group', 'Players', 'Correct ID', 'Same/indistinct', 'Confidence', 'Fun S/H/same', 'Rematch S/H/same', 'Difficulty S/H', 'Fairness S/H'],
    analysis.blind.groups.map((group) => [
      group.label,
      group.participants,
      percent(group.identificationAccuracy),
      percent(group.indistinguishableRate),
      `${fixed(group.confidence, 1)}%`,
      `${percent(group.smartFunRate)}/${percent(group.hardFunRate)}/${percent(group.sameFunRate)}`,
      `${percent(group.smartRematchRate)}/${percent(group.hardRematchRate)}/${percent(group.sameRematchRate)}`,
      `${fixed(group.smartDifficulty)}/${fixed(group.hardDifficulty)}`,
      `${fixed(group.smartFairness)}/${fixed(group.hardFairness)}`,
    ]),
  );

  const incomplete = analysis.sample.missingSessions.length === 0
    ? 'All recorded participants have all four protocol sessions.'
    : `Incomplete participant/session combinations: ${analysis.sample.missingSessions.join(', ')}.`;

  return `# 3D XOX human playtest readout

Sample: **${analysis.sample.participants} participant(s)** and **${analysis.sample.games} game(s)** — new/casual ${analysis.sample.cohorts.new_casual}, experienced ${analysis.sample.cohorts.experienced}. ${incomplete}

Small-sample guardrail: report observations and contradictions as evidence, not population-level balance claims.

## Casual approachability

${casualTable}

Evidence tied to observed play:

${evidenceLines(analysis.casual.evidence, (item) => `**${markdown(item.participantId)}** — confusion: ${markdown(item.confusion)}; move: ${markdown(item.moveComment)}${item.notes ? `; notes: ${markdown(item.notes)}` : ''}`)}

## Center versus non-center paired openings

Differentials are player score minus AI score. Paired delta is center differential minus the same participant's non-center differential. W/D/L is from the player's perspective.

${centerTable}

Opening-freedom evidence:

${evidenceLines(analysis.center.evidence, (item) => `**${markdown(item.participantId)}** — center felt ${markdown(item.feel)}; avoid center: ${markdown(item.avoidCenter)}; viable opening: ${markdown(item.viableOpening)}; ${markdown(item.comment)}`)}

## Standard final-six relevance

Outcome changed compares the move-21 leader with the final leader. Absolute differential swing is \`|final player differential - move-21 player differential|\`.

${finalSixTable}

Decision evidence:

${evidenceLines(analysis.finalSix.evidence, (item) => `**${markdown(item.participantId)}** — cell ${markdown(item.criticalCell)}: ${markdown(item.reason)}; ending ${markdown(item.endingFeel)}; decided ${markdown(item.believedDecided)}`)}

## Blind Smart versus Hard identity

S/H means Smart/Hard after decoding each participant's randomized A/B mapping. Correct ID means the participant selected the hidden Hard opponent as stronger; “same” remains separate as indistinguishable.

${blindTable}

Identity evidence:

${evidenceLines(analysis.blind.evidence, (item) => `**${markdown(item.participantId)}** — separator: ${markdown(item.behavior)}; concern: ${markdown(item.concern)}; ${item.styles.map(markdown).join('; ')}`)}
`;
}

export async function analyzePlaytestFile(filePath) {
  const parsed = parseCsv(await readFile(filePath, 'utf8'));
  const rows = validatePlaytestRows(parsed.headers, parsed.rows);
  return analyzePlaytestRows(rows);
}

function usage() {
  return `Usage: npm run playtest:analyze -- <responses.csv> [--json]

Start from docs/human-playtest-responses.csv. The command validates the protocol
fields before printing a cohort- and order-aware Markdown readout.`;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    console.log(usage());
    return;
  }
  const json = args.includes('--json');
  const filePath = args.find((arg) => !arg.startsWith('-'));
  if (!filePath) {
    console.error(usage());
    process.exitCode = 1;
    return;
  }
  try {
    const analysis = await analyzePlaytestFile(filePath);
    console.log(json ? JSON.stringify(analysis, null, 2) : renderPlaytestReport(analysis));
  } catch (error) {
    if (error instanceof PlaytestValidationError) {
      console.error(error.message);
      for (const issue of error.errors) console.error(`- ${issue}`);
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main();
}
