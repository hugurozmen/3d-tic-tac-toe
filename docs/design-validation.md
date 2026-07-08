# Design Validation Report

Source of truth: [GitHub issue #15](https://github.com/hugurozmen/3d-tic-tac-toe/issues/15)  
Generated (Europe/Istanbul): 2026-07-07  
Command: `npm run design:audit -- --variant final-six-powers-v3 --games 24 --seed 20260707`
Variant mode: `final-six-powers-v3`

## Scope

This report validates the current Lines design plus audit-only/local prototype
variants. It uses deterministic AI self-play plus automated Coach-hint analysis.
It does not promote any prototype to default, add retention, add cosmetics, or
make permanent rules changes.

Human subjective playtest evidence is still missing, so issue #15 should remain
open after this report. The automated data can identify design risk, but it
cannot fully answer confusion, satisfaction, frustration, or replay desire.

## Tooling Notes

- `npm run design:audit` is the source of the fairness, scoring, Coach, and
  Best-of-5 metrics below.
- `npm run product:final-pass` remains useful release/playability smoke
  coverage, but it does not emit design-fun or design-fairness metrics. It
  should not replace human playtest notes for issue #15.
- `--variant final-six-wildcards` runs the same deterministic Lines matrix
  with local-only Wildcard draft/use rules and includes bonus scores in final
  totals.
- `--variant final-six-powers-v2` runs Standard Lines, the current Wildcards
  experiment, and Final Six Powers v2 for direct comparison.
- `--variant final-six-powers-v3` adds Final Six Powers v3 to the same
  comparison, with charged-cell and shield-value metrics.

## Recommendation

Recommendation: **tune Lines Mode**.

The automated data should be treated as a design signal, not a final verdict. If
the next human playtest confirms the same risks, prototype a small Lines Mode
tune rather than changing the rule permanently.

## Lines Mode Self-Play Matrix

| Scenario | Games | X/O | Opener win | Opener score | Center score | Non-center opener | Avg final score | Avg diff | Lead changes | Multi-line | Final-6 changed | Lines by 9/18/27 |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Casual vs Casual | 24 | Casual/Casual | 70.8% | 81.3% | 94.4% | 73.3% | 7.21-6.88 | 1.75 | 1.29 | 1.00 | 37.5% | 1.58/8.08/14.08 |
| Smart vs Smart | 24 | Smart/Smart | 70.8% | 72.9% | 95.5% | 53.8% | 6.75-5.83 | 2.58 | 0.42 | 0.67 | 4.2% | 1.08/7.96/12.58 |
| Hard vs Hard | 24 | Hard/Hard | 25.0% | 37.5% | 0.0% | 75.0% | 6.25-6.00 | 0.75 | 1.00 | 0.75 | 0.0% | 1.50/8.75/12.25 |
| Master vs Master | 24 | Master/Master | 75.0% | 87.5% | 100.0% | 75.0% | 5.25-5.50 | 1.75 | 0.50 | 0.25 | 25.0% | 1.00/6.50/10.75 |
| Smart vs Casual | 24 | Smart/Casual | 66.7% | 75.0% | 87.5% | 62.5% | 7.04-6.08 | 1.88 | 0.79 | 0.58 | 29.2% | 1.96/7.67/13.13 |
| Casual vs Smart | 24 | Casual/Smart | 58.3% | 66.7% | 95.0% | 46.4% | 6.63-7.79 | 2.33 | 0.63 | 1.00 | 20.8% | 1.92/8.54/14.42 |
| Hard vs Smart | 24 | Hard/Smart | 12.5% | 27.1% | 41.7% | 12.5% | 6.21-6.33 | 1.13 | 0.96 | 0.38 | 12.5% | 1.21/8.54/12.54 |
| Smart vs Hard | 24 | Smart/Hard | 33.3% | 56.3% | 33.3% | 79.2% | 5.96-6.04 | 0.58 | 0.88 | 0.25 | 20.8% | 1.33/7.38/12.00 |
| Master vs Hard | 24 | Master/Hard | 25.0% | 50.0% | 50.0% | 50.0% | 6.50-5.50 | 1.00 | 0.50 | 0.75 | 25.0% | 1.25/7.25/12.00 |
| Hard vs Master | 24 | Hard/Master | 25.0% | 37.5% | 50.0% | 25.0% | 5.00-6.25 | 1.25 | 1.00 | 0.25 | 25.0% | 1.25/7.75/11.25 |

Notes:

- Opener score gives the first mover 1.0 for a win, 0.5 for a draw, and 0 for a
  loss.
- Center score is the same score rate for the side that opened on cell 14.
- Non-center opener uses forced corner/floor-center opening probes mixed with
  natural openings.
- Each matchup alternates X/O openers across games to approximate player-first
  and AI-first equivalents where possible.
- Final-6 changed means the leader or tie state at move 21 did not match the
  final winner.

## Center And Endgame Diagnostics

| Scenario | Center owner W/S/L | Center opener W/S | Non-center opener W/S | Leader@21 held/lost/draw | Comeback available@21 | Final move changed | Final-6 swing |
| --- | --- | --- | --- | --- | ---: | ---: | --- |
| Casual vs Casual | 66.7%/77.1%/12.5% | 88.9%/94.4% | 60.0%/73.3% | 66.7%/14.3%/19.0% | 57.1% | 29.2% | +0.08/1.25 abs |
| Smart vs Smart | 75.0%/77.1%/20.8% | 90.9%/95.5% | 53.8%/53.8% | 100.0%/0.0%/0.0% | 31.8% | 4.2% | -0.08/1.00 abs |
| Hard vs Hard | 0.0%/12.5%/75.0% | 0.0%/0.0% | 50.0%/75.0% | 100.0%/0.0%/0.0% | 100.0% | 0.0% | -0.25/0.25 abs |
| Master vs Master | 50.0%/62.5%/25.0% | 100.0%/100.0% | 50.0%/75.0% | 75.0%/0.0%/25.0% | 50.0% | 0.0% | -0.25/1.25 abs |
| Smart vs Casual | 70.8%/79.2%/12.5% | 83.3%/87.5% | 50.0%/62.5% | 76.2%/9.5%/14.3% | 47.6% | 4.2% | +0.08/1.00 abs |
| Casual vs Smart | 70.8%/79.2%/12.5% | 90.0%/95.0% | 35.7%/46.4% | 89.5%/0.0%/10.5% | 42.1% | 12.5% | +0.17/1.42 abs |
| Hard vs Smart | 50.0%/64.6%/20.8% | 25.0%/41.7% | 0.0%/12.5% | 100.0%/0.0%/0.0% | 78.6% | 20.8% | -0.21/0.38 abs |
| Smart vs Hard | 8.3%/31.3%/45.8% | 8.3%/33.3% | 58.3%/79.2% | 100.0%/0.0%/0.0% | 87.5% | 25.0% | +0.13/0.29 abs |
| Master vs Hard | 25.0%/50.0%/25.0% | 50.0%/50.0% | 0.0%/50.0% | 66.7%/0.0%/33.3% | 66.7% | 25.0% | +0.25/0.75 abs |
| Hard vs Master | 50.0%/62.5%/25.0% | 50.0%/50.0% | 0.0%/25.0% | 100.0%/0.0%/0.0% | 50.0% | 0.0% | -0.75/0.75 abs |

Diagnostics notes:

- Center owner includes whoever eventually owns cell 14, not only games that
  opened center.
- Leader@21 held/lost/draw compares the move-21 leader to the final result.
- Comeback available@21 is an optimistic exact search of the final six cells:
  at least one legal continuation still lets the trailing side win or draw.
- Final-6 swing is signed X-minus-O score swing from move 21 to the final board;
  the second value is absolute swing.

## Classic Comparison

| Scenario | Games | Opener win | Opener score | Center score | Avg line score | Avg diff | Avg moves | Pie swaps |
| --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: |
| Classic Casual mirror | 24 | 66.7% | 66.7% | 55.6% | 0.25-0.75 | 1.00 | 6.50 | 9 |
| Classic Smart mirror | 24 | 100.0% | 100.0% | 100.0% | 0.50-0.50 | 1.00 | 7.00 | 24 |
| Classic Hard mirror | 24 | 100.0% | 100.0% | 100.0% | 0.50-0.50 | 1.00 | 9.00 | 24 |
| Classic Master mirror | 24 | 100.0% | 100.0% | 100.0% | 0.50-0.50 | 1.00 | 9.00 | 24 |

Classic runs use the current Classic AI and Pie Rule model. They are included
only as a fairness baseline; this report does not recommend removing Classic.

## Win Rate By Difficulty

| Difficulty | Participant games | Win rate | Score rate | Avg signed line diff | Draw rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Casual | 96 | 31.3% | 40.6% | -0.53 | 18.8% |
| Smart | 144 | 47.9% | 57.6% | +0.36 | 19.4% |
| Hard | 144 | 21.5% | 38.2% | -0.38 | 33.3% |
| Master | 96 | 50.0% | 65.6% | +0.56 | 31.3% |

Participant games count both sides of each Lines scenario, so mirror matches add
equal wins and losses to the same difficulty. The signed line differential is
from that difficulty's perspective.

## Coach Proxy Metrics

| Scenario | Coach turns | Any hint | Avg hints/turn | One-hint turns | Top hint followed | Score hints | Block hints | Both hints |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Casual vs Casual | 648 | 87.2% | 3.55 | 12.0% | 33.5% | 67.6% | 76.9% | 25.0% |
| Smart vs Smart | 648 | 76.2% | 1.83 | 27.5% | 60.6% | 32.7% | 60.0% | 19.9% |
| Hard vs Hard | 648 | 70.4% | 1.80 | 23.1% | 59.3% | 38.0% | 59.3% | 14.8% |
| Master vs Master | 648 | 68.5% | 1.29 | 28.7% | 60.2% | 24.1% | 50.9% | 20.4% |
| Smart vs Casual | 648 | 81.2% | 2.38 | 19.6% | 46.1% | 52.8% | 65.9% | 9.4% |
| Casual vs Smart | 648 | 83.0% | 2.55 | 17.6% | 44.1% | 55.2% | 67.0% | 15.6% |
| Hard vs Smart | 648 | 74.1% | 1.82 | 24.1% | 58.5% | 37.2% | 59.9% | 16.8% |
| Smart vs Hard | 648 | 73.8% | 1.71 | 26.4% | 59.6% | 31.9% | 59.0% | 21.8% |
| Master vs Hard | 648 | 70.4% | 1.60 | 26.9% | 59.3% | 34.3% | 55.6% | 15.7% |
| Hard vs Master | 648 | 71.3% | 1.64 | 26.9% | 60.2% | 33.3% | 56.5% | 14.8% |

## Coach Follow Rate By Difficulty

| Difficulty | Coach turns | Top hint followed | One-obvious-move turns |
| --- | ---: | ---: | ---: |
| Casual | 1296 | 31.9% | 16.7% |
| Smart | 1944 | 59.7% | 24.4% |
| Hard | 1944 | 59.1% | 22.0% |
| Master | 1296 | 60.6% | 30.1% |

Coach proxy interpretation:

- Any hint rate estimates how often Coach has tactical advice to show.
- One-hint turns estimate how often Coach may feel like a single obvious answer.
- Top hint followed estimates how often the AI chose the first Coach-listed
  cell, which is a rough proxy for Coach over-solving the move.
- One-obvious-move turns are turns where Coach had exactly one tactical cell to
  show.

## Margin Distributions

| Scenario | 0 lines | 1 line | 2 lines | 3+ lines |
| --- | ---: | ---: | ---: | ---: |
| Smart vs Casual | 16.7% | 20.8% | 33.3% | 29.2% |
| Master vs Hard | 50.0% | 25.0% | 0.0% | 25.0% |

## Audit-Only Center-Normalized Variant

Variant comparison not run for this audit.

The center-normalized variant is a non-player-facing audit hook. It discounts
completed lines that pass through cell 14 during report scoring only. Standard
Lines remains the default game ruleset and UI ruleset.

## Final Six Wildcards Experimental Variant

| Scenario | First-player score | Center-owner score | Avg final margin | Final-6 changed | Final move changed | Comeback after 21 | Wildcard used | Winner/tie changed | Bonus points by type |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Casual vs Casual | 87.5% | 75.0% | 1.38 | 45.8% | 37.5% | 42.9% | 79.2% used/draft, 100.0% games | 8.3% | Double Line 0.75/g; Block Bonus 0.71/g; Corner Spark 0.13/g; Last Word 0.00/g |
| Smart vs Smart | 72.9% | 77.1% | 2.33 | 4.2% | 4.2% | 0.0% | 68.8% used/draft, 100.0% games | 0.0% | Double Line 0.58/g; Block Bonus 0.75/g; Corner Spark 0.04/g; Last Word 0.00/g |
| Hard vs Hard | 25.0% | 25.0% | 0.50 | 25.0% | 0.0% | 33.3% | 62.5% used/draft, 75.0% games | 25.0% | Double Line 0.75/g; Block Bonus 0.50/g; Corner Spark 0.00/g; Last Word 0.00/g |
| Master vs Master | 75.0% | 75.0% | 1.75 | 25.0% | 0.0% | 25.0% | 75.0% used/draft, 100.0% games | 25.0% | Double Line 0.75/g; Block Bonus 0.75/g; Corner Spark 0.00/g; Last Word 0.00/g |
| Smart vs Casual | 75.0% | 83.3% | 1.54 | 33.3% | 16.7% | 33.3% | 77.1% used/draft, 100.0% games | 12.5% | Double Line 0.71/g; Block Bonus 0.71/g; Corner Spark 0.13/g; Last Word 0.00/g |
| Casual vs Smart | 62.5% | 79.2% | 1.96 | 29.2% | 8.3% | 10.5% | 79.2% used/draft, 100.0% games | 12.5% | Double Line 0.67/g; Block Bonus 0.71/g; Corner Spark 0.21/g; Last Word 0.00/g |
| Hard vs Smart | 14.6% | 56.3% | 1.63 | 37.5% | 0.0% | 0.0% | 62.5% used/draft, 95.8% games | 25.0% | Double Line 0.50/g; Block Bonus 0.75/g; Corner Spark 0.00/g; Last Word 0.00/g |
| Smart vs Hard | 47.9% | 39.6% | 0.46 | 37.5% | 25.0% | 37.5% | 79.2% used/draft, 100.0% games | 37.5% | Double Line 0.67/g; Block Bonus 0.75/g; Corner Spark 0.17/g; Last Word 0.00/g |
| Master vs Hard | 50.0% | 50.0% | 1.50 | 50.0% | 25.0% | 33.3% | 62.5% used/draft, 75.0% games | 25.0% | Double Line 0.75/g; Block Bonus 0.50/g; Corner Spark 0.00/g; Last Word 0.00/g |
| Hard vs Master | 37.5% | 62.5% | 1.25 | 25.0% | 0.0% | 0.0% | 75.0% used/draft, 100.0% games | 0.0% | Double Line 0.75/g; Block Bonus 0.75/g; Corner Spark 0.00/g; Last Word 0.00/g |

Wildcard audit notes:

- The draft is deterministic: at six empty cells, three Wildcards are revealed,
  the trailing player by Lines score picks first, then the other player picks
  from the remaining options.
- The audit uses a Wildcard only when a deterministic bonus-scoring move exists.
- Final scores include normal Lines plus Wildcard bonus points; standard Lines
  remains the default player-facing ruleset.
- Winner/tie changed compares the final board result before Wildcard bonus to
  the final total after Wildcard bonus.

## Final Six Powers v2 Experimental Variant

| Scenario | First-player score | Center-owner score | Avg final margin | Final-6 changed | Final move changed | Comeback after 21 | Power triggered | Charged cell used | Shield value | Winner/tie changed | Bonus by power type |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Casual vs Casual | 47.9% | 64.6% | 1.46 | 37.5% | 33.3% | 28.6% | 62.5% trigger/pick, 100.0% games | n/a | n/a | 45.8% | Power Cell 2.50/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Smart vs Smart | 60.4% | 64.6% | 1.42 | 25.0% | 33.3% | 18.2% | 43.8% trigger/pick, 83.3% games | n/a | n/a | 20.8% | Power Cell 1.75/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Hard vs Hard | 0.0% | 50.0% | 1.25 | 50.0% | 0.0% | 33.3% | 75.0% trigger/pick, 100.0% games | n/a | n/a | 50.0% | Power Cell 3.00/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Master vs Master | 75.0% | 75.0% | 1.25 | 25.0% | 50.0% | 25.0% | 62.5% trigger/pick, 100.0% games | n/a | n/a | 25.0% | Power Cell 2.50/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Smart vs Casual | 54.2% | 79.2% | 1.79 | 37.5% | 8.3% | 38.1% | 64.6% trigger/pick, 100.0% games | n/a | n/a | 33.3% | Power Cell 2.42/g; Surge Line 0.17/g; Bonus denied 0.00/g |
| Casual vs Smart | 35.4% | 68.8% | 2.46 | 54.2% | 4.2% | 42.1% | 64.6% trigger/pick, 100.0% games | n/a | n/a | 45.8% | Power Cell 2.58/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Hard vs Smart | 12.5% | 58.3% | 1.79 | 41.7% | 8.3% | 0.0% | 54.2% trigger/pick, 79.2% games | n/a | n/a | 29.2% | Power Cell 2.17/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Smart vs Hard | 27.1% | 27.1% | 1.08 | 62.5% | 0.0% | 50.0% | 79.2% trigger/pick, 100.0% games | n/a | n/a | 41.7% | Power Cell 3.17/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Master vs Hard | 37.5% | 62.5% | 1.00 | 25.0% | 50.0% | 33.3% | 75.0% trigger/pick, 100.0% games | n/a | n/a | 25.0% | Power Cell 3.00/g; Surge Line 0.00/g; Bonus denied 0.00/g |
| Hard vs Master | 25.0% | 75.0% | 1.75 | 50.0% | 25.0% | 0.0% | 62.5% trigger/pick, 100.0% games | n/a | n/a | 25.0% | Power Cell 2.50/g; Surge Line 0.00/g; Bonus denied 0.00/g |

Power audit notes:

- Powers are deterministic and local-only: at six empty cells, the trailing
  player by Lines score chooses first, then the other player chooses.
- Power Cell, Surge Line, and Shield Line are represented as cell/line targets
  in the simulation, not hidden text effects.
- Final scores include normal Lines plus power bonus points; standard Lines
  remains the default player-facing ruleset.
- Winner/tie changed compares the final board result before power bonus to the
  final total after power bonus.

## Final Six Powers v3 Experimental Variant

| Scenario | First-player score | Center-owner score | Avg final margin | Final-6 changed | Final move changed | Comeback after 21 | Power triggered | Charged cell used | Shield value | Winner/tie changed | Bonus by power type |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Casual vs Casual | 68.8% | 77.1% | 1.88 | 45.8% | 29.2% | 38.1% | 70.8% trigger/pick, 95.8% games | 78.0% | 57.1% | 29.2% | Charged Cell 2.50/g; Shield Cell 0.17/g; Bonus denied 0.08/g |
| Smart vs Smart | 70.8% | 70.8% | 2.67 | 8.3% | 0.0% | 4.5% | 45.8% trigger/pick, 70.8% games | 58.3% | 50.0% | 12.5% | Charged Cell 1.33/g; Shield Cell 0.25/g; Bonus denied 0.04/g |
| Hard vs Hard | 12.5% | 37.5% | 0.75 | 25.0% | 0.0% | 33.3% | 62.5% trigger/pick, 75.0% games | 83.3% | 0.0% | 25.0% | Charged Cell 2.50/g; Shield Cell 0.00/g; Bonus denied 0.00/g |
| Master vs Master | 100.0% | 50.0% | 2.00 | 0.0% | 0.0% | 0.0% | 37.5% trigger/pick, 50.0% games | 60.0% | 33.3% | 25.0% | Charged Cell 1.00/g; Shield Cell 0.25/g; Bonus denied 0.25/g |
| Smart vs Casual | 68.8% | 81.3% | 1.88 | 37.5% | 8.3% | 33.3% | 66.7% trigger/pick, 87.5% games | 84.2% | 50.0% | 16.7% | Charged Cell 2.25/g; Shield Cell 0.21/g; Bonus denied 0.17/g |
| Casual vs Smart | 54.2% | 79.2% | 2.46 | 29.2% | 8.3% | 15.8% | 75.0% trigger/pick, 95.8% games | 80.0% | 75.0% | 20.8% | Charged Cell 2.50/g; Shield Cell 0.25/g; Bonus denied 0.08/g |
| Hard vs Smart | 29.2% | 41.7% | 1.42 | 29.2% | 0.0% | 7.1% | 52.1% trigger/pick, 75.0% games | 68.3% | 71.4% | 41.7% | Charged Cell 1.67/g; Shield Cell 0.21/g; Bonus denied 0.17/g |
| Smart vs Hard | 39.6% | 22.9% | 1.08 | 50.0% | 0.0% | 12.5% | 72.9% trigger/pick, 87.5% games | 79.5% | 0.0% | 29.2% | Charged Cell 2.92/g; Shield Cell 0.00/g; Bonus denied 0.00/g |
| Master vs Hard | 62.5% | 37.5% | 1.25 | 0.0% | 25.0% | 0.0% | 62.5% trigger/pick, 75.0% games | 83.3% | 50.0% | 25.0% | Charged Cell 2.00/g; Shield Cell 0.25/g; Bonus denied 0.25/g |
| Hard vs Master | 50.0% | 50.0% | 1.00 | 0.0% | 0.0% | 0.0% | 37.5% trigger/pick, 50.0% games | 60.0% | 33.3% | 25.0% | Charged Cell 1.00/g; Shield Cell 0.25/g; Bonus denied 0.25/g |

Power v3 audit notes:

- Powers v3 removes Surge from the playable prototype and tests a simpler
  charged-cell core plus Shield Cell counterplay.
- Charged Cell is a chosen empty cell that pays +2 only when the owner later
  scores or blocks from that cell.
- Shield Cell targets an opponent threat cell; if the opponent plays it, their
  power bonus is denied and the shielder gains +1.
- Final scores include normal Lines plus power bonus points; standard Lines
  remains the default player-facing ruleset.
- Winner/tie changed compares the final board result before power bonus to the
  final total after power bonus.

## Best-of-5 Match Simulation

| Matchup | Matches | Avg rounds | Went to 5 | First-round loser won | X match score rate |
| --- | ---: | ---: | ---: | ---: | ---: |
| Smart vs Smart | 8 | 4.50 | 50.0% | 12.5% | 43.8% |
| Hard vs Hard | 8 | 5.00 | 100.0% | 0.0% | 37.5% |
| Master vs Master | 8 | 5.00 | 100.0% | 0.0% | 62.5% |
| Hard vs Smart | 8 | 5.00 | 100.0% | 25.0% | 43.8% |
| Master vs Hard | 8 | 4.50 | 50.0% | 0.0% | 100.0% |

Best-of-5 simulations alternate openers by round and end when one side reaches
3 round wins.

## Answers To Issue #15 Questions

1. **Is Lines Mode actually fairer than Classic?**  
   Automated evidence says Lines Mode is fairer on sudden-death pressure but not
   automatically opener-neutral. Mirror Lines opener score averaged
   69.8%, while Classic mirror opener score
   averaged 91.7%. Lines also uses the full
   board, whereas Classic mirror rounds ended in about
   7.88
   moves on average.

2. **Does center still dominate?**  
   Center is still very strong. Across Lines scenarios, center-opening score
   averaged 64.7% versus 55.3%
   for non-center opening probes. That is useful strategic gravity, but it is a
   design risk if human playtests show players feel forced into center.

3. **Are matches decided too early?**  
   Not always. The final 6 cells changed the actual winner/tie state in
   20.0% of Lines rounds on average, and Lines
   rounds averaged 0.80
   lead changes. If human players still feel the outcome is obvious early, tune
   endgame scoring tension rather than assuming the math is solved.

4. **Is Coach helping or over-solving the game?**  
   Coach is informative but has over-solving risk. Across the matrix, Coach had
   at least one hint on 75.6%
   of turns, exactly one hint on 23.3%
   of turns, and the AI followed the top hint on
   54.1%
   of turns. This supports keeping Coach as a learning layer, while playtesting
   whether always-visible hints should taper after onboarding.

5. **Is Smart the right default AI?**  
   Smart remains plausible as the default. Its aggregate Lines score rate was
   57.6%, with an average signed line
   differential of +0.36. In
   Smart mirror rounds, average score was
   6.75-5.83. It should feel competent without being the final boss.

6. **Is Master strong without making the game feel pointless?**  
   Master is strong, but the current data does not prove it is oppressive.
   Master aggregate score rate was 65.6%
   with signed line differential +0.56.
   In Master vs Hard, X score rate was
   50.0% as the listed stronger side,
   and average final score was
   6.50-5.50. Human frustration notes are still required.

7. **Does Best-of-5 improve the story?**  
   Automated match simulations support Best-of-5 as useful framing. First-round
   losers won the match in 7.5% of simulated
   focus matches, and 80.0%
   went to five rounds. That gives opener alternation and comeback language more
   work to do than isolated rounds.

8. **Recommended design changes, if any.**  
   Do not change rules permanently yet. The next step should be a human
   playtest cycle focused on center pressure, Coach dependency, and whether the
   final third feels alive. If those playtests agree with the automated risks,
   prototype a small Lines Mode tune: late-game combo emphasis, limited Coach
   ladder, or center normalization. Avoid retention or cosmetics as substitutes.

## Remaining Design Risks

- Center may still be psychologically mandatory even if non-center probes can
  win some games.
- Coach may make tactical turns too explicit for experienced players.
- Product-final-pass and self-play prove mechanics; they do not prove that
  players can explain wins/losses or want another match.
- No human 2P playtest notes are included here, so replay interest remains
  unproven.

## Decision

Decision: **tune Lines Mode**.

Do not close issue #15 from this report alone. Close it only after adding human
playtest notes or explicitly accepting automated validation as sufficient for
this release.
