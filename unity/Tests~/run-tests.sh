#!/usr/bin/env bash
# Unity-free test runner for the TicTacube port. Compiles the game code
# against hand-written Unity stubs with mcs and runs the suites with mono
# (no Unity installation needed). The trailing ~ in this folder's name
# makes Unity ignore it, so nothing here ships in a build.
#
# Usage: ./run-tests.sh [--online]
#   default   CoreTests (rules/AI/variants, incl. the seeded web-parity
#             checks for AI personalities) + ProgressionTests (ladder,
#             achievements, daily goals, prefs)
#   --online  additionally runs OnlineTests against a locally started
#             server/online-server.mjs (needs node)
#
# The *Audit.cs files are measurement harnesses, not pass/fail tests:
#   mcs -out:audit.exe PersonalityAudit.cs ../Assets/TicTacube/Scripts/Core/*.cs && mono audit.exe
set -euo pipefail
cd "$(dirname "$0")"

CORE=../Assets/TicTacube/Scripts/Core/*.cs
GAME=../Assets/TicTacube/Scripts/Game
OUT=$(mktemp -d)
trap 'rm -rf "$OUT"' EXIT

echo "== CoreTests"
mcs -out:"$OUT/core.exe" CoreTests.cs $CORE
mono "$OUT/core.exe"

echo "== ProgressionTests"
mcs -out:"$OUT/prog.exe" ProgressionTests.cs UnityStubs.cs $CORE \
    "$GAME/GamePrefs.cs" "$GAME/GameStrings.cs" "$GAME/Achievements.cs" \
    "$GAME/DailyGoals.cs" "$GAME/Ladder.cs"
mono "$OUT/prog.exe"

if [ "${1:-}" = "--online" ]; then
    echo "== OnlineTests (starting local server)"
    node ../../server/online-server.mjs &
    SERVER=$!
    trap 'kill $SERVER 2>/dev/null; rm -rf "$OUT"' EXIT
    sleep 1
    mcs -out:"$OUT/online.exe" OnlineTests.cs UnityStubs.cs $CORE \
        ../Assets/TicTacube/Scripts/Online/*.cs
    mono "$OUT/online.exe"
fi
