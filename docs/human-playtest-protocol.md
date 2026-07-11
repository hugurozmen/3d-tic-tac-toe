# 3D XOX balance playtest protocol

Use this protocol for the four balance questions that self-play cannot answer:
whether center feels compulsory, whether the last six Standard Lines moves stay
meaningful, whether Casual is approachable, and whether players can distinguish
Hard from Smart without labels.

## Setup

- Obtain each participant's informed consent, use a pseudonymous participant
  ID, and do not record names, contact details, or other identifying data in
  the response CSV. Participants may stop or withdraw their rows at any time.
- Recruit 6–10 players, split roughly evenly between new/casual players and
  experienced abstract-strategy players.
- Allow 45–60 minutes per player. Use Scanner, Lines Mode, and Final Six Powers
  **off** unless a step says otherwise.
- Record the build SHA, device/viewport, prior 3D XOX experience, session order,
  opener, opening cell, score after move 21, final score, and result for every game.
- Before sessions, run `npm run ai:selfplay -- --full-openings`. Keep its output
  with the notes so human impressions can be compared with the seat-swapped data.
- Counterbalance each slash-separated order below between participants. For the
  blind test, call the opponents only **A** and **B**; do not expose difficulty.

Suggested recruitment copy:

> Help test a 3D strategy game for 45–60 minutes. You will play short matches
> and describe what feels fair, readable, tense, or confusing. No account or
> personal data is required; the build records no research data automatically.

## Session order

### 1. Warm-up — 3 minutes

Show Scanner controls and the Lines objective, then let the player make a few
moves with Coach on. Do not explain center value or AI behavior.

Ask: “In your own words, how do you score?” and “What does Coach show you?” Stop
and clarify only if the player cannot continue unaided.

### 2. Casual approachability — 2 games

Play Casual once with the player opening and once with the AI opening. Alternate
which game comes first. Keep Coach available at the player’s choice.

After each game ask on a 1–5 scale:

1. How fair did the opponent feel?
2. How often did you understand why it moved?
3. Did mistakes feel recoverable?
4. Would you choose this opponent for another quick game?

Then ask: “Name one move that felt smart, silly, or frustrating.” Record observed
hesitation, threat misses, hint use, and whether the player won—not just ratings.

### 3. Center pressure — 2 games versus Smart

In one game ask the player to open at the cube center. In the other, ask them to
choose their strongest non-center opener. Counterbalance Center/Non-center order
across participants; the player opens both games so the opening comparison stays
paired and controlled. Keep Coach off for the first three moves so it does not
choose the opener for them.

After both games ask:

- “If winning mattered, would you ever avoid center?” Why?
- “Which non-center opening looked genuinely viable?”
- “Did center feel valuable, preferred, or mandatory?”
- Rate opening freedom from 1 (one correct move) to 5 (many credible moves).

Compare score differential and result as a pair; do not infer center pressure from
the winner alone. Also record the player’s first choice in a separate, unprompted
opening when time permits.

### 4. Standard final-six relevance — 2 full games

Play Standard Lines versus Smart with Final Six Powers off. At exactly six empty
cells, pause before the next move and record the score and current leader. Ask:

- “Who do you expect to win, and how confident are you (0–100%)?”
- “Can the trailing player still change the result?”
- “Which remaining cell matters most, and why?”

Finish without coaching from the moderator. Record whether the final leader differs
from the move-21 leader, whether a non-tie lead changes during the last six moves,
and the absolute score-differential swing. Then ask: “Did the ending feel tense,
solvable, or automatic?” and “When did you believe the result was decided?”

### 5. Blind Smart versus Hard identity — 4 games

Each player faces both hidden opponents twice, once in each seat. Use order ABBA
for half the participants and BAAB for the rest; independently randomize whether A
is Smart or Hard. Keep theme, delay, Coach setting, and opener treatment identical.

After every game ask for difficulty (1–5), fairness (1–5), and one sentence about
the opponent’s style. Reveal neither identity until all four games are complete.
Then ask:

- “Which opponent was stronger?” Confidence 0–100%?
- “What behavior separated them?”
- “Which was more fun, and which would you rematch?”
- “Did either feel unfair, passive, or indistinguishable?”

Record identification accuracy separately from preference. A stronger AI that
players cannot distinguish, or can distinguish only by delay, still lacks identity.

### 6. Debrief — 5 minutes

Ask: “What was the most satisfying decision?”, “What felt predetermined?”, and
“What single change would make you play tomorrow?” End with an unaided choice of
next opponent and opening cell.

## Readout

Report results by experience cohort and order, not only as one average. Include:

- center/non-center paired score differential, result, and opening-freedom rating;
- move-21 outcome-change rate, last-six lead-change rate, differential swing, and
  predicted-winner confidence;
- Casual fairness, recoverability, rematch intent, hint use, and observed confusion;
- blind Smart/Hard identification accuracy, confidence, fun preference, and the
  behaviors players used to tell them apart.

Treat comments as evidence when tied to a move or observed behavior. Keep raw notes
and contradictions; do not turn a small convenience sample into a balance claim.

## Recording and analysis

Copy `docs/human-playtest-responses.csv` into the gitignored `playtest-data/`
directory, add one row per completed game, then run:

```sh
npm run playtest:analyze -- path/to/responses.csv
```

The analyzer rejects missing or contradictory protocol data before reporting the
four readouts above by overall sample, experience cohort, and counterbalanced
order. Use these exact values for categorical fields:

- `experience_cohort`: `new_casual` or `experienced`;
- `session`: `casual`, `center`, `final_six`, or `blind`;
- controlled setup: `ruleset=lines`, `board_view=scanner`,
  `lines_variant=standard`, and `final_six_powers=off`;
- `player_mark`: `X` or `O`; `opener`: `player` or `ai`; `coach_used`: `yes`
  or `no`; `result`: `win`, `draw`, or `loss`, all from the player's view;
- Casual `condition_order`: `player-ai` or `ai-player`;
- center `condition_order`: `center-non_center` or `non_center-center`, with
  `opening_condition` set to `center` or `non_center`;
- final-six `condition_order` records the actual opener sequence:
  `player-player`, `player-ai`, `ai-player`, or `ai-ai`;
- final-six predictions: `player`, `ai`, or `draw`; yes/no observations use
  `yes` or `no`, while `trailing_player_can_change` may also be `unsure`;
- blind `condition_order`: `ABBA` or `BAAB`; hidden opponent `A` or `B`; actual
  difficulty `Smart` or `Hard`.

Center and blind sessions contain answers asked once after a pair/set. Put those
answers on exactly one row in that session with `pair_summary=yes`; use
`pair_summary=no` on its other rows. Narrative fields should contain `none` when
the moderator observed nothing, rather than being left blank. Keep game numbers
sequential within each participant/session: 1–2 for Casual, center, and final-six,
and 1–4 for the blind set.
