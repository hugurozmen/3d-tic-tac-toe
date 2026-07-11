# Human playtest evidence status

Updated: 2026-07-11

## Current evidence

- Real participants completed: **0 / 6–10 target**.
- Human games recorded: **0 / 60–100 target**.
- Center-pressure decision: **not validated**.
- Standard final-six relevance: **not validated**.
- Casual approachability: **not validated**.
- Blind Smart-versus-Hard identity: **not validated**.

The data in `scripts/fixtures/human-playtest-sample.csv` is synthetic and exists
only to test parsing, validation, pairing, and report calculations. It must not
be included in a design readout or described as player evidence.

## Collection workflow

1. Follow `docs/human-playtest-protocol.md` and obtain informed consent.
2. Copy `docs/human-playtest-responses.csv` into the gitignored
   `playtest-data/` directory.
3. Record only pseudonymous participant IDs; do not record identifying data.
4. Validate and summarize the completed file:

   ```sh
   npm run playtest:analyze -- playtest-data/responses.csv
   ```

5. Preserve contradictory observations and analyze the overall sample, both
   experience cohorts, and each counterbalanced order before changing balance.

Until those sessions are completed, automated self-play is a design signal—not
proof that center pressure, endgame tension, approachability, or AI personality
feel right to players.
