import {
  createContext,
  type ReactNode,
  useContext,
  useMemo,
} from 'react';
import type { BoardLayout } from './game/boardView';
import type { CoachHint } from './game/coach';
import type { FinalSixPowerId } from './game/finalSixPowers';
import type { LinesEndgameAnalysis } from './game/linesTension';
import type { DailyPuzzle, DailyPuzzleResult } from './game/puzzles';
import type { ThemeUnlockProgress } from './game/retention';
import type { Difficulty, GameMode, GameRuleset, Player } from './game/rules';
import type { ThemeId } from './theme';

export const LOCALE_OPTIONS = ['en', 'tr'] as const;
export type Locale = (typeof LOCALE_OPTIONS)[number];

type MessageValues = Record<string, number | string>;

const en = {
  'action.clear': 'Clear',
  'action.close': 'Close',
  'action.copied': 'Copied',
  'action.copy': 'Copy',
  'action.gotIt': 'Got it',
  'action.host': 'Host',
  'action.join': 'Join',
  'action.keepPlaying': 'Keep playing',
  'action.newMatch': 'New match',
  'action.newRound': 'New round',
  'action.open': 'Open',
  'action.playAgain': 'Play again',
  'action.reconnect': 'Reconnect',
  'action.resetMatch': 'Reset match',
  'action.share': 'Share',
  'action.switch': 'Switch',
  'action.tryCoach': 'Try Coach',
  'aria.board': '3D XOX board',
  'aria.boardControls': 'Board view controls',
  'aria.coachLegend': 'Coach legend',
  'aria.coachPrompt': 'Try Coach prompt',
  'aria.dailyProgress': 'Daily and progress',
  'aria.dailyPuzzle': 'Daily puzzle',
  'aria.dailyPuzzleHint': 'Daily puzzle hint',
  'aria.floorSelector': 'Floor selector',
  'aria.gameControls': 'Game controls',
  'aria.howToPlay': 'How to play',
  'aria.localProgress': 'Local progress',
  'aria.match': 'Match',
  'aria.pieDecision': 'Pie Rule decision',
  'aria.powerHint': 'Final Six powers hint',
  'aria.powers': 'Final Six Powers',
  'aria.roundScore': 'Round and score',
  'aria.score': 'Lines score',
  'aria.themeProgress': 'Theme accent progress',
  'aria.winStreaks': 'Win streak by difficulty',
  'cell.animation.block': 'block animation active',
  'cell.animation.place': 'placement animation active',
  'cell.animation.power': 'power animation active',
  'cell.animation.score': 'scoring animation active',
  'cell.blockHint': 'block hint',
  'cell.blocksLine': 'blocks a line',
  'cell.chargedFinalSix': 'charged final-six cell',
  'cell.coachConnector': 'part of a cross-floor {kind} hint',
  'cell.empty': 'empty',
  'cell.finalBlock': 'final-6 blocking move, blocks {count}',
  'cell.finalLine': 'final winning line',
  'cell.finalScore': 'final-6 scoring move, scores {count}',
  'cell.finalScoreBlock': 'final-6 scoring and blocking move, scores {score} and blocks {block}',
  'cell.floor': 'floor {floor}',
  'cell.lineScored': 'scored line',
  'cell.place': 'Place {player} at cell {cell}, floor {floor}',
  'cell.powerAnimation': 'power animation active',
  'cell.powerPathShield': 'Shield Cell path',
  'cell.powerPathSurge': 'Surge Line path',
  'cell.powerPreview': '{label} preview for {power}',
  'cell.read': 'Cell {cell}, {mark}',
  'cell.scoreAndBlock': 'score and block',
  'cell.scoreAndBlockHint': 'score and block hints',
  'cell.scoreHint': 'score hint',
  'cell.scoreHintFocus': 'score hint available on focus: {label}',
  'cell.scoresAndBlocks': 'completes and blocks lines',
  'cell.scoresLine': 'completes a line',
  'cell.showFloor': 'Show floor {floor}',
  'cell.winningLine': 'winning line',
  'coach.activeAuto': 'Coach is active automatically.',
  'coach.auto': 'Auto',
  'coach.block': 'Block',
  'coach.disabledOnline': 'Coach disabled online',
  'coach.legend.block': 'Block',
  'coach.legend.both': 'Score + block',
  'coach.legend.score': 'Score',
  'coach.onNotice': 'Coach on: green scores, red blocks',
  'coach.score': 'Score',
  'coach.tryTitle': 'Try Coach',
  'coach.tryText': 'See scoring moves, blocks, and cross-floor threats.',
  'confirm.abandon': 'Abandon this round?',
  'dialog.guideLine1Body': 'Keep playing until all 27 cells fill; every 3-cell row scores, and the higher total wins.',
  'dialog.guideLine1Title': 'Lines is the main game.',
  'dialog.guideLine2Body': 'Cells 1, 14, and 27 form one diagonal through the cube.',
  'dialog.guideLine2Title': '3D lines cross floors.',
  'dialog.howToPlay': 'How to play',
  'dialog.pieBody': 'The second player may swap sides after the first move.',
  'dialog.pieRule': 'Pie Rule',
  'dialog.swapSides': 'Swap sides',
  'dialog.keepSides': 'Keep sides',
  'difficulty.balanced': 'Smart',
  'difficulty.easy': 'Casual',
  'difficulty.hard': 'Hard',
  'difficulty.master': 'Master',
  'endgame.finalSixPowers': 'Final Six Powers (beta)',
  'endgame.finalSixPowersShort': 'Final Six Powers',
  'endgame.standard': 'Standard',
  'finalSix.chooseBoard': 'At Final Six, choose on the board.',
  'finalSix.chooseTargetNotice': 'Choose a glowing power target',
  'finalSix.chargedNotice': 'Final Six: cube charged',
  'finalSix.chargesCube': 'Final Six charges the cube',
  'finalSix.copy': 'The cube is charged. Pick a glowing cell to turn the endgame into a visible board effect.',
  'finalSix.heading': 'Final Six',
  'finalSix.localOnly': 'Final Six Powers are local prototype only',
  'finalSix.pickerAi': 'AI chooses',
  'finalSix.pickerPlayer': '{player} chooses',
  'finalSix.playerPower': '{player} Power',
  'finalSix.powerChosen': '{player} chose {power}',
  'finalSix.ready': 'Ready',
  'finalSix.title': 'Final Six Powers',
  'finalSix.used': 'Used',
  'finalSix.chooseOnBoard': 'Choose on board',
  'game.ai': 'AI',
  'game.aiMode': 'AI mode',
  'game.classic': 'Classic',
  'game.draw': 'Draw',
  'game.duoMode': '2-player mode',
  'game.lines': 'Lines',
  'game.lineScoring': 'line scoring',
  'game.noSide': 'No side',
  'game.online': 'Online',
  'game.onlineMode': 'online mode',
  'game.pieOff': 'off',
  'game.pieOn': 'on',
  'game.playerLocal': '{player} local',
  'game.suddenDeath': 'sudden death',
  'game.twoPlayer': '2P',
  'game.x': 'X',
  'game.o': 'O',
  'language.english': 'English',
  'language.label': 'Language',
  'language.turkish': 'Turkish',
  'layout.cube': 'Cube',
  'layout.floors': 'Floors',
  'layout.scanner': 'Scanner',
  'lines.bonus': 'Bonus',
  'lines.empty': 'Empty',
  'lines.finalCells': 'Final cells',
  'lines.finalBoardFilled': 'Final board filled',
  'lines.line': 'line',
  'lines.lines': 'lines',
  'lines.block': 'block',
  'lines.blocks': 'blocks',
  'lines.round': 'Round',
  'lines.scoreMath': 'Lines {baseX}-{baseO} + Bonus {bonusX}-{bonusO} = Total {totalX}-{totalO}',
  'lines.total': 'Total',
  'lines.xLines': 'X lines',
  'lines.xTotal': 'X total',
  'lines.oLines': 'O lines',
  'lines.oTotal': 'O total',
  'match.complete': 'Match complete',
  'match.done': 'Done',
  'match.draws': 'Draws',
  'match.match': 'Match',
  'match.next': 'Next',
  'match.nextContext': '{opener} next',
  'match.opener': 'Opener',
  'match.round': 'Round',
  'match.winner': 'Winner',
  'notice.aiKeptSides': 'AI kept sides',
  'notice.aiSwappedSides': 'AI swapped sides',
  'notice.bonus': '+{count} bonus',
  'notice.onlineLocked': 'Online room settings are locked',
  'notice.opponentNewRound': 'Opponent started a new round',
  'notice.opponentResetMatch': 'Opponent reset the match',
  'notice.reconnectMove': 'Reconnect the room before moving',
  'notice.reconnectReset': 'Reconnect the room before resetting',
  'notice.sidesKept': 'Sides kept',
  'notice.sidesSwapped': 'Sides swapped',
  'online.clearRoom': 'Clear',
  'online.configurationMissing': 'Online server is not configured. Set VITE_ONLINE_SERVER_URL to a wss:// room server before publishing Online mode.',
  'online.connectionTimeout': 'Connection timeout. Check the room server and try again.',
  'online.hostDecides': 'Host decides',
  'online.invalidCode': 'Invalid room code',
  'online.invalidSettings': 'Invalid room settings',
  'online.invalidUrl': 'Online server URL is invalid.',
  'online.locked': 'Locked',
  'online.localServer': 'Local server',
  'online.missingServer': 'Missing server',
  'online.notConfigured': 'not configured',
  'online.productionServer': 'Production server',
  'online.reconnectWait': 'Room paused - reconnect or wait for the opponent.',
  'online.room': 'Room',
  'online.roomCode': 'Room code',
  'online.roomNotFound': 'Room not found',
  'online.roomRulesClassic': '{ruleset} room - Pie {pie}',
  'online.roomRulesLines': '{ruleset} room',
  'online.server': 'Server',
  'online.serverFull': 'Server is full',
  'online.serverHttps': 'Online server must use wss:// when the game is served over HTTPS.',
  'online.serverUrlScheme': 'Online server URL must start with ws:// or wss://.',
  'online.status.connected': 'connected',
  'online.status.connecting': 'connecting',
  'online.status.disconnected': 'disconnected',
  'online.status.error': 'error',
  'online.status.idle': 'idle',
  'online.status.reconnecting': 'reconnecting',
  'online.status.waiting': 'waiting',
  'online.waiting': 'Waiting for an opponent - share the room code.',
  'online.hint': 'Coach disabled online. Final Six Powers are local prototype only.',
  'options.coach': 'Coach',
  'options.sound': 'Sound',
  'options.style': 'Style',
  'options.subtitle': 'View, theme, sound, Coach',
  'options.title': 'Options',
  'options.view': 'View',
  'power.bonusDenied': 'Bonus denied',
  'power.chargedCell': 'Charged Cell',
  'power.chargedCellDescription': 'Choose one empty charged cell. If it scores or blocks later, +2.',
  'power.charge': 'Charge',
  'power.cell': 'Cell',
  'power.notChosen': 'Not chosen',
  'power.powerCell': 'Power Cell',
  'power.powerCellDescription': 'Choose an empty cell. If it scores or blocks later, +2.',
  'power.shield': 'Shield',
  'power.shieldCell': 'Shield Cell',
  'power.shieldCellDescription': 'Choose an opponent threat cell. If they play it, +1 and deny their power bonus.',
  'power.shieldDeniedBonus': 'Shield denied bonus',
  'power.shieldLine': 'Shield Line',
  'power.shieldLineDescription': 'Choose an opponent threat line. Its power bonus is denied.',
  'power.surge': 'Surge',
  'power.surgeLine': 'Surge Line',
  'power.surgeLineDescription': 'Choose your open line. Completing it later gives +2.',
  'progress.accents': 'accents',
  'progress.bestMargin': 'Best margin',
  'progress.dailyPuzzleUnlocked': 'Daily puzzle unlocked',
  'progress.dailyPuzzleUnlockedText': 'Try one quick board challenge after your first match.',
  'progress.dailyTitle': 'Daily #{id}',
  'progress.dailyAndProgress': 'Daily & Progress',
  'progress.lastMove': 'Last move',
  'progress.lifeDraws': 'Life draws',
  'progress.lifetime': 'Lifetime',
  'progress.localGoals': 'Local goals and puzzle',
  'progress.localOnly': 'Local only',
  'progress.localProgress': 'Local progress',
  'progress.masterWins': 'Master wins',
  'progress.playToday': 'Play today',
  'progress.progress': 'Progress',
  'progress.resultSaved': 'Result saved',
  'progress.streaks': 'Streaks & unlocks',
  'progress.themeAccents': 'Theme accents',
  'progress.totalLines': 'Total lines',
  'progress.unlock.accentReady': 'Accent ready',
  'progress.unlock.hardStreak.detail': 'Hard x3 or Master x2',
  'progress.unlock.hardStreak.label': 'Hard streak',
  'progress.unlock.masterLineage.detail': 'Master x3',
  'progress.unlock.masterLineage.label': 'Master lineage',
  'progress.unlock.rankedFocus.detail': 'Smart x3, Hard x2, or one Master win',
  'progress.unlock.rankedFocus.label': 'Ranked focus',
  'puzzle.bestLines.prompt': 'Find the best Lines move',
  'puzzle.bestLines.title': 'Best Lines move',
  'puzzle.bestMove': 'Best move {cell}',
  'puzzle.cell': 'Cell {cell}',
  'puzzle.cellEmpty': 'Daily puzzle cell {cell}, {value}',
  'puzzle.classicFinish.title': 'Classic finish',
  'puzzle.classicWin.prompt': 'Find the Classic win',
  'puzzle.classicWinTwo.prompt': 'Find the Classic win in two',
  'puzzle.explanation.bestLines': 'Cell {cell} completes the cleanest Lines score and protects the margin.',
  'puzzle.explanation.classicWin': 'Cell {cell} finishes the middle-floor row for X.',
  'puzzle.explanation.classicWinTwo': 'Cell {cell} creates two Classic threats, so O cannot cover both.',
  'puzzle.explanation.maxLines': 'Cell {cell} scores four space diagonals at once.',
  'puzzle.maxLines.prompt': 'Score the most lines',
  'puzzle.maxLines.title': 'Most lines',
  'puzzle.resultMiss': 'Cell {cell} was the best move. {explanation}',
  'puzzle.resultSolved': 'Cell {cell} is right. {explanation}',
  'puzzle.shareText': '3D XOX Daily #{id} - solved in 1',
  'puzzle.winInTwo.title': 'Win in two',
  'puzzle.yourMove': 'Your move {cell}',
  'result.aiWinsByLines': 'AI wins by lines, {score}',
  'result.aiWinsMatch': 'AI wins the match, {score}',
  'result.aiWinsRound': 'AI wins the round',
  'result.drawByLines': 'Draw by lines, {score}',
  'result.openedAi': 'AI opened',
  'result.openedPlayer': '{player} opened',
  'result.openedYou': 'You opened',
  'result.opensAi': 'AI opens',
  'result.opensPlayer': '{player} opens',
  'result.opensYou': 'You open',
  'result.roundDrawn': 'Round drawn',
  'result.roundPrefix': 'Round {round}: {text}',
  'result.youWinByLines': 'You win by lines, {score}',
  'result.youWinMatch': 'You win the match, {score}',
  'result.youWinRound': 'You win the round',
  'result.playerWinsByLines': '{player} wins by lines, {score}',
  'result.playerWinsMatch': '{player} wins the match, {score}',
  'result.playerWinsRound': '{player} wins the round',
  'setup.changingStarts': 'Changing these starts a new round',
  'setup.difficulty': 'AI',
  'setup.endgame': 'Endgame',
  'setup.mode': 'Mode',
  'setup.rules': 'Rules',
  'setup.switchEndgameConfirm': 'Switching the Lines endgame resets the active best of 5.',
  'setup.switchModeConfirm': 'Switching to {mode} ends the current round without scoring it.',
  'setup.switchRulesConfirm': 'Switching to {ruleset} resets the active best of 5.',
  'setup.switchSideConfirm': 'Switching sides ends the current round without scoring it.',
  'setup.title': 'Setup',
  'setup.youPlay': 'You play',
  'scanner.caption': 'Floor {floor} of 3',
  'sound.off': 'Off',
  'sound.on': 'On',
  'stage.boardCouldNotStart': '3D board could not start',
  'stage.prepareBoard': 'Preparing 3D board',
  'stage.scannerAvailable': 'Scanner remains available for this round.',
  'status.aiChoosing': 'AI choosing',
  'status.aiThinking': '{player} thinking',
  'status.aiWinsMatch': 'AI wins match',
  'status.choosePower': 'Choose Power',
  'status.draw': 'Draw',
  'status.drawScore': 'Draw {score}',
  'status.onlineSetup': 'Online setup',
  'status.pairOnline': 'Pair online',
  'status.playerPower': '{player} power',
  'status.playerRemote': '{player} remote',
  'status.playerTurn': '{player} turn',
  'status.playerWins': '{player} wins',
  'status.playerWinsMatch': '{player} wins match',
  'status.playerWinsScore': '{player} wins {score}',
  'status.roomReady': 'Room ready',
  'status.swapChoice': 'Swap choice',
  'status.youWinMatch': 'You win match',
  'theme.cage': 'Cage',
  'theme.crystal': 'Crystal',
  'theme.frosted': 'Frosted',
  'theme.glass': 'Glass',
  'theme.holo': 'Hologram',
  'view.reset': 'Reset view',
  'view.resetBoard': 'Reset board view',
  'view.rotateBoardLeft': 'Rotate board left',
  'view.rotateBoardRight': 'Rotate board right',
  'view.rotateLeft': 'Rotate left',
  'view.rotateRight': 'Rotate right',
  'view.zoomBoardIn': 'Zoom board in',
  'view.zoomBoardOut': 'Zoom board out',
  'view.zoomIn': 'Zoom in',
  'view.zoomOut': 'Zoom out',
};

const tr = {
  'action.clear': 'Temizle',
  'action.close': 'Kapat',
  'action.copied': 'Kopyalandı',
  'action.copy': 'Kopyala',
  'action.gotIt': 'Anladım',
  'action.host': 'Kur',
  'action.join': 'Katıl',
  'action.keepPlaying': 'Oynamaya devam',
  'action.newMatch': 'Yeni maç',
  'action.newRound': 'Yeni tur',
  'action.open': 'Aç',
  'action.playAgain': 'Tekrar oyna',
  'action.reconnect': 'Yeniden bağlan',
  'action.resetMatch': 'Maçı sıfırla',
  'action.share': 'Paylaş',
  'action.switch': 'Değiştir',
  'action.tryCoach': 'Koçu dene',
  'aria.board': '3D XOX tahtası',
  'aria.boardControls': 'Tahta görünüm kontrolleri',
  'aria.coachLegend': 'Koç göstergesi',
  'aria.coachPrompt': 'Koçu dene uyarısı',
  'aria.dailyProgress': 'Günlük ve ilerleme',
  'aria.dailyPuzzle': 'Günlük bulmaca',
  'aria.dailyPuzzleHint': 'Günlük bulmaca ipucu',
  'aria.floorSelector': 'Kat seçici',
  'aria.gameControls': 'Oyun kontrolleri',
  'aria.howToPlay': 'Nasıl oynanır',
  'aria.localProgress': 'Yerel ilerleme',
  'aria.match': 'Maç',
  'aria.pieDecision': 'Pie Rule kararı',
  'aria.powerHint': 'Final Altı güçleri ipucu',
  'aria.powers': 'Final Altı Güçleri',
  'aria.roundScore': 'Tur ve skor',
  'aria.score': 'Lines skoru',
  'aria.themeProgress': 'Tema aksanı ilerlemesi',
  'aria.winStreaks': 'Zorluğa göre galibiyet serisi',
  'cell.animation.block': 'blok animasyonu aktif',
  'cell.animation.place': 'yerleştirme animasyonu aktif',
  'cell.animation.power': 'güç animasyonu aktif',
  'cell.animation.score': 'skor animasyonu aktif',
  'cell.blockHint': 'blok ipucu',
  'cell.blocksLine': 'bir çizgiyi bloklar',
  'cell.chargedFinalSix': 'yüklü final altı hücresi',
  'cell.coachConnector': 'katlar arası {kind} ipucunun parçası',
  'cell.empty': 'boş',
  'cell.finalBlock': 'final-6 blok hamlesi, {count} bloklar',
  'cell.finalLine': 'final kazandıran çizgi',
  'cell.finalScore': 'final-6 skor hamlesi, {count} kazandırır',
  'cell.finalScoreBlock': 'final-6 skor ve blok hamlesi, {score} kazandırır ve {block} bloklar',
  'cell.floor': 'kat {floor}',
  'cell.lineScored': 'skor alınan çizgi',
  'cell.place': '{player} işaretini hücre {cell}, kat {floor} konumuna koy',
  'cell.powerAnimation': 'güç animasyonu aktif',
  'cell.powerPathShield': 'Kalkan Hücre yolu',
  'cell.powerPathSurge': 'Dalga Çizgisi yolu',
  'cell.powerPreview': '{power} için {label} önizlemesi',
  'cell.read': 'Hücre {cell}, {mark}',
  'cell.scoreAndBlock': 'skor ve blok',
  'cell.scoreAndBlockHint': 'skor ve blok ipuçları',
  'cell.scoreHint': 'skor ipucu',
  'cell.scoreHintFocus': 'odakta skor ipucu: {label}',
  'cell.scoresAndBlocks': 'çizgi tamamlar ve bloklar',
  'cell.scoresLine': 'bir çizgiyi tamamlar',
  'cell.showFloor': 'Kat {floor} göster',
  'cell.winningLine': 'kazanan çizgi',
  'coach.activeAuto': 'Koç otomatik olarak aktif.',
  'coach.auto': 'Otomatik',
  'coach.block': 'Blok',
  'coach.disabledOnline': 'Koç çevrimiçi modda kapalı',
  'coach.legend.block': 'Blok',
  'coach.legend.both': 'Skor + blok',
  'coach.legend.score': 'Skor',
  'coach.onNotice': 'Koç açık: yeşil skor, kırmızı blok',
  'coach.score': 'Skor',
  'coach.tryTitle': 'Koçu dene',
  'coach.tryText': 'Skor hamlelerini, blokları ve katlar arası tehditleri gör.',
  'confirm.abandon': 'Bu turdan çıkılsın mı?',
  'dialog.guideLine1Body': '27 hücrenin tamamı dolana kadar oyna; her 3 hücrelik çizgi skor getirir, yüksek toplam kazanır.',
  'dialog.guideLine1Title': 'Lines ana oyundur.',
  'dialog.guideLine2Body': '1, 14 ve 27 hücreleri küpün içinden geçen tek bir çapraz oluşturur.',
  'dialog.guideLine2Title': '3D çizgiler katları aşar.',
  'dialog.howToPlay': 'Nasıl oynanır',
  'dialog.pieBody': 'İkinci oyuncu ilk hamleden sonra taraf değiştirebilir.',
  'dialog.pieRule': 'Pie Rule',
  'dialog.swapSides': 'Taraf değiştir',
  'dialog.keepSides': 'Tarafları koru',
  'difficulty.balanced': 'Akıllı',
  'difficulty.easy': 'Rahat',
  'difficulty.hard': 'Zor',
  'difficulty.master': 'Usta',
  'endgame.finalSixPowers': 'Final Altı Güçleri (beta)',
  'endgame.finalSixPowersShort': 'Final Altı Güçleri',
  'endgame.standard': 'Standart',
  'finalSix.chooseBoard': 'Final Altı geldiğinde tahtadan seçim yap.',
  'finalSix.chooseTargetNotice': 'Parlayan bir güç hedefi seç',
  'finalSix.chargedNotice': 'Final Altı: küp yüklendi',
  'finalSix.chargesCube': 'Final Altı küpü yükler',
  'finalSix.copy': 'Küp yüklendi. Oyun sonunu görünür bir tahta etkisine çevirmek için parlayan bir hücre seç.',
  'finalSix.heading': 'Final Altı',
  'finalSix.localOnly': 'Final Altı Güçleri yalnızca yerel prototip',
  'finalSix.pickerAi': 'AI seçiyor',
  'finalSix.pickerPlayer': '{player} seçiyor',
  'finalSix.playerPower': '{player} Gücü',
  'finalSix.powerChosen': '{player}, {power} seçti',
  'finalSix.ready': 'Hazır',
  'finalSix.title': 'Final Altı Güçleri',
  'finalSix.used': 'Kullanıldı',
  'finalSix.chooseOnBoard': 'Tahtada seç',
  'game.ai': 'AI',
  'game.aiMode': 'AI modu',
  'game.classic': 'Classic',
  'game.draw': 'Berabere',
  'game.duoMode': '2 oyuncu modu',
  'game.lines': 'Lines',
  'game.lineScoring': 'çizgi skoru',
  'game.noSide': 'Taraf yok',
  'game.online': 'Çevrimiçi',
  'game.onlineMode': 'çevrimiçi mod',
  'game.pieOff': 'kapalı',
  'game.pieOn': 'açık',
  'game.playerLocal': '{player} yerel',
  'game.suddenDeath': 'ani ölüm',
  'game.twoPlayer': '2P',
  'game.x': 'X',
  'game.o': 'O',
  'language.english': 'İngilizce',
  'language.label': 'Dil',
  'language.turkish': 'Türkçe',
  'layout.cube': 'Küp',
  'layout.floors': 'Katlar',
  'layout.scanner': 'Tarayıcı',
  'lines.bonus': 'Bonus',
  'lines.empty': 'Boş',
  'lines.finalCells': 'Son hücreler',
  'lines.finalBoardFilled': 'Final tahtası doldu',
  'lines.line': 'çizgi',
  'lines.lines': 'çizgi',
  'lines.block': 'blok',
  'lines.blocks': 'blok',
  'lines.round': 'Tur',
  'lines.scoreMath': 'Lines {baseX}-{baseO} + Bonus {bonusX}-{bonusO} = Toplam {totalX}-{totalO}',
  'lines.total': 'Toplam',
  'lines.xLines': 'X çizgi',
  'lines.xTotal': 'X toplam',
  'lines.oLines': 'O çizgi',
  'lines.oTotal': 'O toplam',
  'match.complete': 'Maç tamamlandı',
  'match.done': 'Bitti',
  'match.draws': 'Beraberlik',
  'match.match': 'Maç',
  'match.next': 'Sıradaki',
  'match.nextContext': 'sırada {opener}',
  'match.opener': 'Açan',
  'match.round': 'Tur',
  'match.winner': 'Kazanan',
  'notice.aiKeptSides': 'AI tarafları korudu',
  'notice.aiSwappedSides': 'AI taraf değiştirdi',
  'notice.bonus': '+{count} bonus',
  'notice.onlineLocked': 'Çevrimiçi oda ayarları kilitli',
  'notice.opponentNewRound': 'Rakip yeni tur başlattı',
  'notice.opponentResetMatch': 'Rakip maçı sıfırladı',
  'notice.reconnectMove': 'Hamle yapmadan önce odaya yeniden bağlan',
  'notice.reconnectReset': 'Sıfırlamadan önce odaya yeniden bağlan',
  'notice.sidesKept': 'Taraflar korundu',
  'notice.sidesSwapped': 'Taraflar değişti',
  'online.clearRoom': 'Temizle',
  'online.configurationMissing': 'Çevrimiçi sunucu yapılandırılmamış. Online modu yayınlamadan önce VITE_ONLINE_SERVER_URL değerini wss:// oda sunucusuna ayarla.',
  'online.connectionTimeout': 'Bağlantı zaman aşımına uğradı. Oda sunucusunu kontrol edip tekrar dene.',
  'online.hostDecides': 'Kurucu belirler',
  'online.invalidCode': 'Geçersiz oda kodu',
  'online.invalidSettings': 'Geçersiz oda ayarları',
  'online.invalidUrl': 'Çevrimiçi sunucu URL geçersiz.',
  'online.locked': 'Kilitli',
  'online.localServer': 'Yerel sunucu',
  'online.missingServer': 'Sunucu yok',
  'online.notConfigured': 'yapılandırılmadı',
  'online.productionServer': 'Üretim sunucusu',
  'online.reconnectWait': 'Oda durakladı - yeniden bağlan veya rakibi bekle.',
  'online.room': 'Oda',
  'online.roomCode': 'Oda kodu',
  'online.roomNotFound': 'Oda bulunamadı',
  'online.roomRulesClassic': '{ruleset} odası - {pie}',
  'online.roomRulesLines': '{ruleset} odası',
  'online.server': 'Sunucu',
  'online.serverFull': 'Sunucu dolu',
  'online.serverHttps': 'Oyun HTTPS üzerinden sunulduğunda çevrimiçi sunucu wss:// kullanmalı.',
  'online.serverUrlScheme': 'Çevrimiçi sunucu URL ws:// veya wss:// ile başlamalı.',
  'online.status.connected': 'bağlandı',
  'online.status.connecting': 'bağlanıyor',
  'online.status.disconnected': 'bağlantı koptu',
  'online.status.error': 'hata',
  'online.status.idle': 'boşta',
  'online.status.reconnecting': 'yeniden bağlanıyor',
  'online.status.waiting': 'bekliyor',
  'online.waiting': 'Rakip bekleniyor - oda kodunu paylaş.',
  'online.hint': 'Koç çevrimiçi modda kapalı. Final Altı Güçleri yalnızca yerel prototip.',
  'options.coach': 'Koç',
  'options.sound': 'Ses',
  'options.style': 'Stil',
  'options.subtitle': 'Görünüm, tema, ses, Koç',
  'options.title': 'Seçenekler',
  'options.view': 'Görünüm',
  'power.bonusDenied': 'Bonus engellendi',
  'power.chargedCell': 'Yüklü Hücre',
  'power.chargedCellDescription': 'Bir boş yüklü hücre seç. Daha sonra skor alır veya blok yaparsa +2.',
  'power.charge': 'Yük',
  'power.cell': 'Hücre',
  'power.notChosen': 'Seçilmedi',
  'power.powerCell': 'Güç Hücresi',
  'power.powerCellDescription': 'Bir boş hücre seç. Daha sonra skor alır veya blok yaparsa +2.',
  'power.shield': 'Kalkan',
  'power.shieldCell': 'Kalkan Hücre',
  'power.shieldCellDescription': 'Rakibin tehdit hücresini seç. Rakip oynarsa +1 alır ve güç bonusunu engellersin.',
  'power.shieldDeniedBonus': 'Kalkan bonusu engelledi',
  'power.shieldLine': 'Kalkan Çizgisi',
  'power.shieldLineDescription': 'Rakibin tehdit çizgisini seç. Güç bonusu engellenir.',
  'power.surge': 'Dalga',
  'power.surgeLine': 'Dalga Çizgisi',
  'power.surgeLineDescription': 'Kendi açık çizgini seç. Sonradan tamamlarsan +2.',
  'progress.accents': 'aksan',
  'progress.bestMargin': 'En iyi fark',
  'progress.dailyPuzzleUnlocked': 'Günlük bulmaca açıldı',
  'progress.dailyPuzzleUnlockedText': 'İlk maçtan sonra hızlı bir tahta meydan okuması dene.',
  'progress.dailyTitle': 'Günlük #{id}',
  'progress.dailyAndProgress': 'Günlük & İlerleme',
  'progress.lastMove': 'Son hamle',
  'progress.lifeDraws': 'Toplam beraberlik',
  'progress.lifetime': 'Toplam',
  'progress.localGoals': 'Yerel hedefler ve bulmaca',
  'progress.localOnly': 'Yalnızca yerel',
  'progress.localProgress': 'Yerel ilerleme',
  'progress.masterWins': 'Usta galibiyetleri',
  'progress.playToday': 'Bugün oyna',
  'progress.progress': 'İlerleme',
  'progress.resultSaved': 'Sonuç kaydedildi',
  'progress.streaks': 'Seriler & açılımlar',
  'progress.themeAccents': 'Tema aksanları',
  'progress.totalLines': 'Toplam çizgi',
  'progress.unlock.accentReady': 'Aksan hazır',
  'progress.unlock.hardStreak.detail': 'Zor x3 veya Usta x2',
  'progress.unlock.hardStreak.label': 'Zor seri',
  'progress.unlock.masterLineage.detail': 'Usta x3',
  'progress.unlock.masterLineage.label': 'Usta soyu',
  'progress.unlock.rankedFocus.detail': 'Akıllı x3, Zor x2 veya bir Usta galibiyeti',
  'progress.unlock.rankedFocus.label': 'Dereceli odak',
  'puzzle.bestLines.prompt': 'En iyi Lines hamlesini bul',
  'puzzle.bestLines.title': 'En iyi Lines hamlesi',
  'puzzle.bestMove': 'En iyi hamle {cell}',
  'puzzle.cell': 'Hücre {cell}',
  'puzzle.cellEmpty': 'Günlük bulmaca hücresi {cell}, {value}',
  'puzzle.classicFinish.title': 'Classic bitiriş',
  'puzzle.classicWin.prompt': 'Classic kazancını bul',
  'puzzle.classicWinTwo.prompt': 'İki hamlede Classic kazancını bul',
  'puzzle.explanation.bestLines': 'Hücre {cell} en temiz Lines skorunu tamamlar ve farkı korur.',
  'puzzle.explanation.classicWin': 'Hücre {cell}, X için orta kat sırasını bitirir.',
  'puzzle.explanation.classicWinTwo': 'Hücre {cell} iki Classic tehdidi oluşturur, O ikisini birden kapatamaz.',
  'puzzle.explanation.maxLines': 'Hücre {cell} aynı anda dört uzay çaprazından skor alır.',
  'puzzle.maxLines.prompt': 'En çok çizgi skorunu yap',
  'puzzle.maxLines.title': 'En çok çizgi',
  'puzzle.resultMiss': 'Hücre {cell} en iyi hamleydi. {explanation}',
  'puzzle.resultSolved': 'Hücre {cell} doğru. {explanation}',
  'puzzle.shareText': '3D XOX Günlük #{id} - 1 hamlede çözüldü',
  'puzzle.winInTwo.title': 'İki hamlede kazan',
  'puzzle.yourMove': 'Senin hamlen {cell}',
  'result.aiWinsByLines': 'AI çizgilerle kazandı, {score}',
  'result.aiWinsMatch': 'AI maçı kazandı, {score}',
  'result.aiWinsRound': 'AI turu kazandı',
  'result.drawByLines': 'Çizgilerde beraberlik, {score}',
  'result.openedAi': 'AI açtı',
  'result.openedPlayer': '{player} açtı',
  'result.openedYou': 'Sen açtın',
  'result.opensAi': 'AI açar',
  'result.opensPlayer': '{player} açar',
  'result.opensYou': 'Sen açarsın',
  'result.roundDrawn': 'Tur berabere',
  'result.roundPrefix': 'Tur {round}: {text}',
  'result.youWinByLines': 'Çizgilerle kazandın, {score}',
  'result.youWinMatch': 'Maçı kazandın, {score}',
  'result.youWinRound': 'Turu kazandın',
  'result.playerWinsByLines': '{player} çizgilerle kazandı, {score}',
  'result.playerWinsMatch': '{player} maçı kazandı, {score}',
  'result.playerWinsRound': '{player} turu kazandı',
  'setup.changingStarts': 'Bunları değiştirmek yeni tur başlatır',
  'setup.difficulty': 'AI',
  'setup.endgame': 'Oyun sonu',
  'setup.mode': 'Mod',
  'setup.rules': 'Kurallar',
  'setup.switchEndgameConfirm': 'Lines oyun sonunu değiştirmek aktif best of 5 maçını sıfırlar.',
  'setup.switchModeConfirm': '{mode} moduna geçmek mevcut turu skora yazmadan bitirir.',
  'setup.switchRulesConfirm': '{ruleset} kuralına geçmek aktif best of 5 maçını sıfırlar.',
  'setup.switchSideConfirm': 'Taraf değiştirmek mevcut turu skora yazmadan bitirir.',
  'setup.title': 'Kurulum',
  'setup.youPlay': 'Sen oynarsın',
  'scanner.caption': 'Kat {floor} / 3',
  'sound.off': 'Kapalı',
  'sound.on': 'Açık',
  'stage.boardCouldNotStart': '3D tahta başlayamadı',
  'stage.prepareBoard': '3D tahta hazırlanıyor',
  'stage.scannerAvailable': 'Tarayıcı bu tur için kullanılabilir.',
  'status.aiChoosing': 'AI seçiyor',
  'status.aiThinking': '{player} düşünüyor',
  'status.aiWinsMatch': 'AI maçı kazandı',
  'status.choosePower': 'Güç seç',
  'status.draw': 'Berabere',
  'status.drawScore': 'Berabere {score}',
  'status.onlineSetup': 'Çevrimiçi kurulum',
  'status.pairOnline': 'Çevrimiçi eşleş',
  'status.playerPower': '{player} gücü',
  'status.playerRemote': '{player} uzakta',
  'status.playerTurn': 'Sıra {player}',
  'status.playerWins': '{player} kazandı',
  'status.playerWinsMatch': '{player} maçı kazandı',
  'status.playerWinsScore': '{player} kazandı {score}',
  'status.roomReady': 'Oda hazır',
  'status.swapChoice': 'Değişim seçimi',
  'status.youWinMatch': 'Maçı kazandın',
  'theme.cage': 'Kafes',
  'theme.crystal': 'Kristal',
  'theme.frosted': 'Buzlu',
  'theme.glass': 'Cam',
  'theme.holo': 'Hologram',
  'view.reset': 'Görünümü sıfırla',
  'view.resetBoard': 'Tahta görünümünü sıfırla',
  'view.rotateBoardLeft': 'Tahtayı sola döndür',
  'view.rotateBoardRight': 'Tahtayı sağa döndür',
  'view.rotateLeft': 'Sola döndür',
  'view.rotateRight': 'Sağa döndür',
  'view.zoomBoardIn': 'Tahtayı yakınlaştır',
  'view.zoomBoardOut': 'Tahtayı uzaklaştır',
  'view.zoomIn': 'Yakınlaştır',
  'view.zoomOut': 'Uzaklaştır',
} satisfies Record<keyof typeof en, string>;

export type I18nKey = keyof typeof en;

const messages: Record<Locale, Record<I18nKey, string>> = { en, tr };

const localeLabels: Record<Locale, string> = {
  en: 'English',
  tr: 'Türkçe',
};

const difficultyLabels: Record<Difficulty, I18nKey> = {
  balanced: 'difficulty.balanced',
  easy: 'difficulty.easy',
  hard: 'difficulty.hard',
  master: 'difficulty.master',
};

const layoutLabels: Record<BoardLayout, I18nKey> = {
  cube: 'layout.cube',
  floors: 'layout.floors',
  scanner: 'layout.scanner',
};

const modeLabels: Record<GameMode, I18nKey> = {
  duo: 'game.duoMode',
  online: 'game.onlineMode',
  solo: 'game.aiMode',
};

const rulesetLabels: Record<GameRuleset, I18nKey> = {
  classic: 'game.classic',
  lines: 'game.lines',
};

const rulesetDescriptions: Record<GameRuleset, I18nKey> = {
  classic: 'game.suddenDeath',
  lines: 'game.lineScoring',
};

const themeLabels: Record<ThemeId, I18nKey> = {
  cage: 'theme.cage',
  crystal: 'theme.crystal',
  frosted: 'theme.frosted',
  glass: 'theme.glass',
  holo: 'theme.holo',
};

const powerLabels: Record<FinalSixPowerId, I18nKey> = {
  'charged-cell': 'power.chargedCell',
  'power-cell': 'power.powerCell',
  'shield-cell': 'power.shieldCell',
  'shield-line': 'power.shieldLine',
  'surge-line': 'power.surgeLine',
};

const powerShortLabels: Record<FinalSixPowerId, I18nKey> = {
  'charged-cell': 'power.charge',
  'power-cell': 'power.cell',
  'shield-cell': 'power.shield',
  'shield-line': 'power.shield',
  'surge-line': 'power.surge',
};

const powerDescriptions: Record<FinalSixPowerId, I18nKey> = {
  'charged-cell': 'power.chargedCellDescription',
  'power-cell': 'power.powerCellDescription',
  'shield-cell': 'power.shieldCellDescription',
  'shield-line': 'power.shieldLineDescription',
  'surge-line': 'power.surgeLineDescription',
};

const onlineMessageKeys: Record<string, I18nKey> = {
  'Connection timeout. Check the room server and try again.':
    'online.connectionTimeout',
  'Invalid room code': 'online.invalidCode',
  'Invalid room settings': 'online.invalidSettings',
  'Online server URL is invalid.': 'online.invalidUrl',
  'Online server URL must start with ws:// or wss://.': 'online.serverUrlScheme',
  'Online server is not configured. Set VITE_ONLINE_SERVER_URL to a wss:// room server before publishing Online mode.':
    'online.configurationMissing',
  'Online server must use wss:// when the game is served over HTTPS.':
    'online.serverHttps',
  'Room not found': 'online.roomNotFound',
  'Server is full': 'online.serverFull',
};

const powerMessageKeys: Record<string, I18nKey> = {
  'Bonus denied': 'power.bonusDenied',
  'Charged Cell +2': 'power.chargedCell',
  'Power Cell +2': 'power.powerCell',
  'Shield +1': 'power.shield',
  'Shield denied bonus': 'power.shieldDeniedBonus',
  'Surge Line +2': 'power.surgeLine',
};

export type I18n = {
  locale: Locale;
  t: (key: I18nKey, values?: MessageValues) => string;
};

const I18nContext = createContext<I18n | null>(null);

export function getInitialLocale(): Locale {
  const languages =
    typeof navigator === 'undefined'
      ? []
      : [navigator.language, ...(navigator.languages ?? [])];

  return languages.some((language) => language.toLowerCase().startsWith('tr'))
    ? 'tr'
    : 'en';
}

export function createI18n(locale: Locale): I18n {
  const catalog = messages[locale] ?? messages.en;

  return {
    locale,
    t: (key, values) => {
      const template = catalog[key] ?? messages.en[key] ?? key;

      if (!values) {
        return template;
      }

      return template.replace(/\{(\w+)\}/g, (match, name) =>
        values[name] === undefined ? match : String(values[name]),
      );
    },
  };
}

export function I18nProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: I18n;
}) {
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);

  if (!value) {
    throw new Error('useI18n must be used inside I18nProvider');
  }

  return value;
}

export const useI18nValue = (locale: Locale) =>
  useMemo(() => createI18n(locale), [locale]);

export const labelLocale = (_i18n: I18n, locale: Locale) =>
  localeLabels[locale];

export const labelDifficulty = ({ t }: I18n, difficulty: Difficulty) =>
  t(difficultyLabels[difficulty]);

export const labelLayout = ({ t }: I18n, layout: BoardLayout) =>
  t(layoutLabels[layout]);

export const labelMode = ({ t }: I18n, mode: GameMode) => t(modeLabels[mode]);

export const labelRuleset = ({ t }: I18n, ruleset: GameRuleset) =>
  t(rulesetLabels[ruleset]);

export const labelRulesetDescription = ({ t }: I18n, ruleset: GameRuleset) =>
  t(rulesetDescriptions[ruleset]);

export const labelTheme = ({ t }: I18n, theme: ThemeId) =>
  t(themeLabels[theme]);

export const labelPower = ({ t }: I18n, power: FinalSixPowerId) =>
  t(powerLabels[power]);

export const labelPowerShort = ({ t }: I18n, power: FinalSixPowerId) =>
  t(powerShortLabels[power]);

export const labelPowerDescription = ({ t }: I18n, power: FinalSixPowerId) =>
  t(powerDescriptions[power]);

export const translatePowerMessage = (i18n: I18n, message: string) => {
  const key = powerMessageKeys[message];

  if (!key) {
    return message;
  }

  if (message.endsWith('+2')) {
    return `${i18n.t(key)} +2`;
  }

  if (message.endsWith('+1')) {
    return `${i18n.t(key)} +1`;
  }

  return i18n.t(key);
};

export const translateOnlineMessage = (i18n: I18n, message: string | null) => {
  if (!message) {
    return null;
  }

  const key = onlineMessageKeys[message];

  return key ? i18n.t(key) : message;
};

const formatCell = (move: number | null) => (move === null ? '-' : move + 1);

const formatCells = (line: number[]) =>
  line.map((index) => index + 1).join('-');

const floorOf = (index: number) => Math.floor(index / 9) + 1;

const floorSpan = (line: number[]) =>
  Array.from(new Set(line.map(floorOf))).sort((a, b) => a - b);

const lineText = (i18n: I18n, line: number[]) => {
  const floors = floorSpan(line);

  if (i18n.locale === 'en') {
    const floorText =
      floors.length === 1
        ? `floor ${floors[0]}`
        : `floors ${floors.join('-')}`;

    return `cells ${formatCells(line)} on ${floorText}`;
  }

  const floorText =
    floors.length === 1
      ? `kat ${floors[0]}`
      : `katlar ${floors.join('-')}`;

  return `${formatCells(line)} hücreleri / ${floorText}`;
};

export const translateCoachHint = (
  i18n: I18n,
  hint: CoachHint,
  rival: Player,
) => {
  const scoreLine = hint.scoreLines[0];
  const blockLine = hint.blockLines[0];
  const scoreText = scoreLine ? lineText(i18n, scoreLine) : '';
  const blockText = blockLine ? lineText(i18n, blockLine) : '';

  if (hint.kind === 'both') {
    return {
      accessibleLabel:
        i18n.locale === 'tr'
          ? `${scoreText} çizgisini tamamlar ve ${rival} için ${blockText} çizgisini bloklar`
          : `completes a line through ${scoreText} and blocks ${rival} through ${blockText}`,
      explanation:
        i18n.locale === 'tr'
          ? `Hücre ${hint.cell + 1}, ${scoreText} çizgisinde skor alır ve ${rival} için ${blockText} çizgisini bloklar.`
          : `Cell ${hint.cell + 1} scores on ${scoreText} and blocks ${rival} on ${blockText}.`,
      shortLabel:
        i18n.locale === 'tr'
          ? `Skor + blok: ${formatCells(hint.primaryLine)}`
          : `Score + block: ${formatCells(hint.primaryLine)}`,
    };
  }

  if (hint.kind === 'score') {
    return {
      accessibleLabel:
        i18n.locale === 'tr'
          ? `${scoreText} çizgisini tamamlar`
          : `completes a line through ${scoreText}`,
      explanation:
        i18n.locale === 'tr'
          ? `Hücre ${hint.cell + 1}, ${scoreText} çizgisinde skor alır.`
          : `Cell ${hint.cell + 1} scores on ${scoreText}.`,
      shortLabel:
        i18n.locale === 'tr'
          ? `Skor: ${formatCells(hint.primaryLine)}`
          : `Score: ${formatCells(hint.primaryLine)}`,
    };
  }

  return {
    accessibleLabel:
      i18n.locale === 'tr'
        ? `${rival} için ${blockText} çizgisini bloklar`
        : `blocks ${rival} through ${blockText}`,
    explanation:
      i18n.locale === 'tr'
        ? `Hücre ${hint.cell + 1}, ${rival} için ${blockText} çizgisini bloklar.`
        : `Cell ${hint.cell + 1} blocks ${rival} on ${blockText}.`,
    shortLabel:
      i18n.locale === 'tr'
        ? `Blok: ${formatCells(hint.primaryLine)}`
        : `Block: ${formatCells(hint.primaryLine)}`,
  };
};

export const formatLinesEndgameText = (
  i18n: I18n,
  analysis: LinesEndgameAnalysis | null,
) => {
  if (!analysis) {
    return null;
  }

  const score = analysis.maxScoreLines;
  const block = analysis.maxBlockLines;
  let swingText: string;

  if (score > 0 && block > 0) {
    swingText =
      i18n.locale === 'tr'
        ? `en fazla +${score} ve ${block} blok`
        : `up to +${score} and ${block} block`;
  } else if (score > 0) {
    swingText =
      i18n.locale === 'tr'
        ? `en fazla +${score} çizgi`
        : `up to +${score} ${score === 1 ? 'line' : 'lines'}`;
  } else if (block > 0) {
    swingText =
      i18n.locale === 'tr'
        ? `${block} blok canlı`
        : `${block} ${block === 1 ? 'block' : 'blocks'} live`;
  } else {
    swingText = i18n.locale === 'tr' ? 'her hücre önemli' : 'every cell matters';
  }

  return i18n.locale === 'tr'
    ? `Final ${analysis.remainingCells}: ${swingText}`
    : `Final ${analysis.remainingCells}: ${swingText}`;
};

export const getDailyPuzzleTitle = (i18n: I18n, puzzle: DailyPuzzle) => {
  const titleKey: Record<DailyPuzzle['kind'], I18nKey> = {
    'best-lines': 'puzzle.bestLines.title',
    'classic-win': 'puzzle.classicFinish.title',
    'classic-win-two': 'puzzle.winInTwo.title',
    'max-lines': 'puzzle.maxLines.title',
  };

  return i18n.t(titleKey[puzzle.kind]);
};

export const getDailyPuzzlePrompt = (i18n: I18n, puzzle: DailyPuzzle) => {
  const promptKey: Record<DailyPuzzle['kind'], I18nKey> = {
    'best-lines': 'puzzle.bestLines.prompt',
    'classic-win': 'puzzle.classicWin.prompt',
    'classic-win-two': 'puzzle.classicWinTwo.prompt',
    'max-lines': 'puzzle.maxLines.prompt',
  };

  return i18n.t(promptKey[puzzle.kind]);
};

export const getDailyPuzzleExplanation = (
  i18n: I18n,
  puzzle: DailyPuzzle,
) => {
  const explanationKey: Record<DailyPuzzle['kind'], I18nKey> = {
    'best-lines': 'puzzle.explanation.bestLines',
    'classic-win': 'puzzle.explanation.classicWin',
    'classic-win-two': 'puzzle.explanation.classicWinTwo',
    'max-lines': 'puzzle.explanation.maxLines',
  };

  return i18n.t(explanationKey[puzzle.kind], {
    cell: formatCell(puzzle.bestMove),
  });
};

export const getDailyPuzzleResultExplanation = (
  i18n: I18n,
  puzzle: DailyPuzzle,
  result: DailyPuzzleResult,
) => {
  const explanation = getDailyPuzzleExplanation(i18n, puzzle);

  return result.solved
    ? i18n.t('puzzle.resultSolved', {
        cell: formatCell(result.move),
        explanation,
      })
    : i18n.t('puzzle.resultMiss', {
        cell: formatCell(result.bestMove),
        explanation,
      });
};

export const getDailyPuzzleShareText = (i18n: I18n, puzzle: DailyPuzzle) =>
  i18n.t('puzzle.shareText', { id: puzzle.id });

export const formatMoveCell = (move: number | null) => formatCell(move);

export const getThemeProgressCopy = (
  i18n: I18n,
  item: ThemeUnlockProgress,
) => {
  const idToKeys: Record<
    string,
    { detail: I18nKey; label: I18nKey }
  > = {
    'hard-streak': {
      detail: 'progress.unlock.hardStreak.detail',
      label: 'progress.unlock.hardStreak.label',
    },
    'master-lineage': {
      detail: 'progress.unlock.masterLineage.detail',
      label: 'progress.unlock.masterLineage.label',
    },
    'ranked-focus': {
      detail: 'progress.unlock.rankedFocus.detail',
      label: 'progress.unlock.rankedFocus.label',
    },
  };
  const keys = idToKeys[item.id];
  const valueText = item.unlocked
    ? i18n.t('progress.unlock.accentReady')
    : item.valueText
        .replace(/\bSmart\b/g, labelDifficulty(i18n, 'balanced'))
        .replace(/\bHard\b/g, labelDifficulty(i18n, 'hard'))
        .replace(/\bMaster\b/g, labelDifficulty(i18n, 'master'));

  return {
    detail: keys ? i18n.t(keys.detail) : item.detail,
    label: keys ? i18n.t(keys.label) : item.label,
    valueText,
  };
};
