# Design Validation Report

Source of truth: [GitHub issue #15](https://github.com/hugurozmen/3d-tic-tac-toe/issues/15)  
Generated (Europe/Istanbul): 2026-07-11
Command: `npm run design:audit -- --variant both --games 24 --seed 20260707`
Variant mode: `both`

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

Recommendation: **prototype center-normalized Lines variant**.

The automated data should be treated as a design signal, not a final verdict. If
the next human playtest confirms the same risks, prototype a small Lines Mode
tune rather than changing the rule permanently.

## Lines Mode Self-Play Matrix

| Scenario | Games | X/O | Opener win | Opener score | Center score | Non-center opener | Avg final score | Avg diff | Lead changes | Multi-line | Final-6 changed | Lines by 9/18/27 |
| --- | ---: | --- | ---: | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- |
| Casual vs Casual | 24 | Casual/Casual | 70.8% | 81.3% | 94.4% | 73.3% | 7.21-6.88 | 1.75 | 1.29 | 1.00 | 37.5% | 1.58/8.08/14.08 |
| Smart vs Smart | 24 | Smart/Smart | 66.7% | 81.3% | 95.5% | 69.2% | 7.13-6.92 | 1.21 | 0.33 | 0.83 | 20.8% | 1.08/7.71/14.04 |
| Hard vs Hard | 24 | Hard/Hard | 50.0% | 62.5% | 100.0% | 25.0% | 5.25-5.75 | 1.00 | 1.75 | 0.50 | 25.0% | 1.50/6.50/11.00 |
| Master vs Master | 24 | Master/Master | 100.0% | 100.0% | 100.0% | 100.0% | 5.50-5.50 | 1.00 | 0.50 | 0.25 | 25.0% | 0.50/5.25/11.00 |
| Smart vs Casual | 24 | Smart/Casual | 54.2% | 60.4% | 75.0% | 45.8% | 7.58-6.08 | 1.83 | 0.58 | 0.46 | 25.0% | 1.71/7.46/13.67 |
| Casual vs Smart | 24 | Casual/Smart | 45.8% | 58.3% | 75.0% | 46.4% | 5.92-7.58 | 2.08 | 0.38 | 0.88 | 29.2% | 1.63/8.25/13.50 |
| Hard vs Smart | 24 | Hard/Smart | 41.7% | 68.8% | 83.3% | 54.2% | 6.42-6.04 | 0.54 | 0.92 | 0.33 | 37.5% | 1.21/7.38/12.46 |
| Smart vs Hard | 24 | Smart/Hard | 50.0% | 72.9% | 75.0% | 70.8% | 5.04-5.92 | 0.88 | 1.29 | 0.29 | 4.2% | 1.33/6.71/10.96 |
| Master vs Hard | 24 | Master/Hard | 100.0% | 100.0% | 100.0% | 100.0% | 5.75-5.75 | 1.00 | 1.00 | 0.25 | 25.0% | 1.25/6.25/11.50 |
| Hard vs Master | 24 | Hard/Master | 50.0% | 62.5% | 100.0% | 25.0% | 5.25-5.50 | 0.75 | 1.75 | 0.25 | 25.0% | 1.25/6.75/10.75 |

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
| Smart vs Smart | 50.0%/64.6%/20.8% | 90.9%/95.5% | 46.2%/69.2% | 77.3%/0.0%/22.7% | 72.7% | 4.2% | -0.21/0.38 abs |
| Hard vs Hard | 75.0%/87.5%/0.0% | 100.0%/100.0% | 0.0%/25.0% | 100.0%/0.0%/0.0% | 0.0% | 0.0% | -0.50/1.00 abs |
| Master vs Master | 50.0%/50.0%/50.0% | 100.0%/100.0% | 100.0%/100.0% | 100.0%/0.0%/0.0% | 33.3% | 0.0% | -0.25/0.25 abs |
| Smart vs Casual | 66.7%/72.9%/20.8% | 66.7%/75.0% | 41.7%/45.8% | 77.3%/13.6%/9.1% | 54.5% | 4.2% | +0.29/0.96 abs |
| Casual vs Smart | 58.3%/70.8%/16.7% | 60.0%/75.0% | 35.7%/46.4% | 78.9%/0.0%/21.1% | 52.6% | 20.8% | +0.00/1.08 abs |
| Hard vs Smart | 37.5%/64.6%/8.3% | 66.7%/83.3% | 16.7%/54.2% | 55.6%/0.0%/44.4% | 66.7% | 45.8% | -0.38/0.71 abs |
| Smart vs Hard | 33.3%/56.3%/20.8% | 50.0%/75.0% | 50.0%/70.8% | 100.0%/0.0%/0.0% | 50.0% | 25.0% | -0.21/0.21 abs |
| Master vs Hard | 50.0%/50.0%/50.0% | 100.0%/100.0% | 100.0%/100.0% | 100.0%/0.0%/0.0% | 33.3% | 0.0% | -0.25/0.25 abs |
| Hard vs Master | 75.0%/87.5%/0.0% | 100.0%/100.0% | 0.0%/25.0% | 100.0%/0.0%/0.0% | 0.0% | 0.0% | -0.25/0.25 abs |

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
| Casual | 96 | 26.0% | 35.9% | -0.79 | 19.8% |
| Smart | 144 | 36.1% | 52.4% | +0.32 | 32.6% |
| Hard | 144 | 40.3% | 54.9% | +0.17 | 29.2% |
| Master | 96 | 50.0% | 53.1% | +0.06 | 6.3% |

Participant games count both sides of each Lines scenario, so mirror matches add
equal wins and losses to the same difficulty. The signed line differential is
from that difficulty's perspective.

## Coach Proxy Metrics

| Scenario | Coach turns | Any hint | Avg hints/turn | One-hint turns | Top hint followed | Score hints | Block hints | Both hints |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Casual vs Casual | 648 | 87.2% | 3.55 | 12.0% | 33.5% | 67.6% | 76.9% | 25.0% |
| Smart vs Smart | 648 | 81.5% | 2.56 | 18.4% | 53.7% | 47.4% | 71.0% | 17.4% |
| Hard vs Hard | 648 | 72.2% | 1.87 | 20.4% | 50.9% | 39.8% | 60.2% | 14.8% |
| Master vs Master | 648 | 82.4% | 2.53 | 16.7% | 48.1% | 50.9% | 74.1% | 14.8% |
| Smart vs Casual | 648 | 84.3% | 2.90 | 16.4% | 44.1% | 60.3% | 73.0% | 13.4% |
| Casual vs Smart | 648 | 82.9% | 2.75 | 16.7% | 40.1% | 57.9% | 70.5% | 17.4% |
| Hard vs Smart | 648 | 76.2% | 2.13 | 19.1% | 54.9% | 41.5% | 62.2% | 17.9% |
| Smart vs Hard | 648 | 75.0% | 1.66 | 28.2% | 57.7% | 30.4% | 60.0% | 19.8% |
| Master vs Hard | 648 | 79.6% | 2.19 | 19.4% | 53.7% | 44.4% | 69.4% | 19.4% |
| Hard vs Master | 648 | 75.9% | 2.08 | 21.3% | 50.9% | 42.6% | 65.7% | 15.7% |

## Coach Follow Rate By Difficulty

| Difficulty | Coach turns | Top hint followed | One-obvious-move turns |
| --- | ---: | ---: | ---: |
| Casual | 1296 | 31.8% | 15.1% |
| Smart | 1944 | 55.6% | 20.3% |
| Hard | 1944 | 51.5% | 19.5% |
| Master | 1296 | 51.4% | 19.4% |

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
| Smart vs Casual | 12.5% | 37.5% | 25.0% | 25.0% |
| Master vs Hard | 0.0% | 100.0% | 0.0% | 0.0% |

## Audit-Only Center-Normalized Variant

| Scenario | Standard opener score | Variant opener score | Standard center owner score | Variant center owner score | Standard avg diff | Variant avg diff | Standard final-6 changed | Variant final-6 changed |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| Casual vs Casual | 81.3% | 85.4% | 77.1% | 60.4% | 1.75 | 1.50 | 37.5% | 25.0% |
| Smart vs Smart | 81.3% | 89.6% | 64.6% | 52.1% | 1.21 | 1.03 | 20.8% | 16.7% |
| Hard vs Hard | 62.5% | 75.0% | 87.5% | 75.0% | 1.00 | 0.69 | 25.0% | 50.0% |
| Master vs Master | 100.0% | 100.0% | 50.0% | 50.0% | 1.00 | 0.69 | 25.0% | 25.0% |
| Smart vs Casual | 60.4% | 62.5% | 72.9% | 62.5% | 1.83 | 1.44 | 25.0% | 25.0% |
| Casual vs Smart | 58.3% | 54.2% | 70.8% | 58.3% | 2.08 | 1.82 | 29.2% | 12.5% |
| Hard vs Smart | 68.8% | 83.3% | 64.6% | 45.8% | 0.54 | 0.63 | 37.5% | 29.2% |
| Smart vs Hard | 72.9% | 81.3% | 56.3% | 47.9% | 0.88 | 0.82 | 4.2% | 20.8% |
| Master vs Hard | 100.0% | 100.0% | 50.0% | 50.0% | 1.00 | 0.81 | 25.0% | 25.0% |
| Hard vs Master | 62.5% | 75.0% | 87.5% | 75.0% | 0.75 | 0.44 | 25.0% | 50.0% |

The center-normalized variant is a non-player-facing audit hook. It discounts
completed lines that pass through cell 14 during report scoring only. Standard
Lines remains the default game ruleset and UI ruleset.

## Final Six Wildcards Experimental Variant

Final Six Wildcards audit not run for this report.

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

Final Six Powers v2 audit not run for this report.

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

Final Six Powers v3 audit not run for this report.

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
| Smart vs Smart | 8 | 4.88 | 87.5% | 0.0% | 56.3% |
| Hard vs Hard | 8 | 5.00 | 100.0% | 0.0% | 62.5% |
| Master vs Master | 8 | 5.00 | 100.0% | 0.0% | 100.0% |
| Hard vs Smart | 8 | 4.38 | 62.5% | 0.0% | 100.0% |
| Master vs Hard | 8 | 5.00 | 100.0% | 0.0% | 100.0% |

Best-of-5 simulations alternate openers by round and end when one side reaches
3 round wins.

## Answers To Issue #15 Questions

1. **Is Lines Mode actually fairer than Classic?**  
   Automated evidence says Lines Mode is fairer on sudden-death pressure but not
   automatically opener-neutral. Mirror Lines opener score averaged
   81.3%, while Classic mirror opener score
   averaged 91.7%. Lines also uses the full
   board, whereas Classic mirror rounds ended in about
   7.88
   moves on average.

2. **Does center still dominate?**  
   Center is still very strong. Across Lines scenarios, center-opening score
   averaged 89.8% versus 61.0%
   for non-center opening probes. That is useful strategic gravity, but it is a
   design risk if human playtests show players feel forced into center.

3. **Are matches decided too early?**  
   Not always. The final 6 cells changed the actual winner/tie state in
   25.4% of Lines rounds on average, and Lines
   rounds averaged 0.98
   lead changes. If human players still feel the outcome is obvious early, tune
   endgame scoring tension rather than assuming the math is solved.

4. **Is Coach helping or over-solving the game?**  
   Coach is informative but has over-solving risk. Across the matrix, Coach had
   at least one hint on 79.7%
   of turns, exactly one hint on 18.9%
   of turns, and the AI followed the top hint on
   48.8%
   of turns. This supports keeping Coach as a learning layer, while playtesting
   whether always-visible hints should taper after onboarding.

5. **Is Smart the right default AI?**  
   Smart remains plausible as the default. Its aggregate Lines score rate was
   52.4%, with an average signed line
   differential of +0.32. In
   Smart mirror rounds, average score was
   7.13-6.92. It should feel competent without being the final boss.

6. **Is Master strong without making the game feel pointless?**  
   Master is strong, but the current data does not prove it is oppressive.
   Master aggregate score rate was 53.1%
   with signed line differential +0.06.
   In Master vs Hard, X score rate was
   50.0% as the listed stronger side,
   and average final score was
   5.75-5.75. Human frustration notes are still required.

7. **Does Best-of-5 improve the story?**  
   Automated match simulations support Best-of-5 as useful framing. First-round
   losers won the match in 0.0% of simulated
   focus matches, and 90.0%
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

Decision: **prototype center-normalized Lines variant**.

Do not close issue #15 from this report alone. Close it only after adding human
playtest notes or explicitly accepting automated validation as sufficient for
this release.
