# TicTacube Unity Portu — Oyun Tasarımı İnceleme Raporu

**Kapsam:** `unity/` altındaki Unity mobil portu (Core: `Rules.cs`, `Ai.cs`, `Match.cs`, `WinningLines.cs`; Game: `GameController.cs`, `GameHud.cs`, `BoardView.cs`, `CameraOrbit.cs`, `CellView.cs`, `GameAudio.cs`, `GamePrefs.cs`; Online: `OnlineClient.cs`). Bağlam olarak web sürümünün portlanmamış sistemleri (`src/game/puzzles.ts`, `coach.ts`, `coachLadder.ts`, `wildcards.ts`, `finalSixPowers.ts`, `retention.ts`, `linesTension.ts`, `linesVariant.ts`), önceki 5-persona playtest sentezi ve `docs/design-validation.md` self-play raporu incelendi.

**Kısıt çerçevesi:** Tek geliştirici; primitif + çalışma anı uGUI + prosedürel ses; PlayerPrefs; online sunucu protokolü sabit; monetizasyon yok. Aşağıdaki her öneri bu çerçeveye sığacak şekilde tasarlandı.

**Kanıt etiketleri:** `[KANIT]` = koddan/veriden doğrudan çıkarım. `[DOĞRULANMALI]` = güçlü hipotez, ölçüm yöntemi belirtildi. Self-play sayıları `docs/design-validation.md`'den; Core web `ai.ts`/`rules.ts`'in birebir portu olduğu için (unity/README.md böyle beyan ediyor ve dışarıda derlenen birim testleriyle doğrulanmış) bu sayılar Unity için de geçerli kabul edildi — ancak senaryolar 24'er oyunluk, küçük örneklem.

---

## 1. Yönetici Özeti

### En güçlü 3 yan

1. **Saf, test edilebilir, iş parçacığı-güvenli çekirdek.** `Core/` ve `Online/` hiç Unity API'si kullanmıyor; AI `GameController.MaybeStartAiTurn`'da `Task.Run` ile arka planda koşuyor ve `AiMinThinkSeconds = 0.5f` ile insanlaştırılıyor. `WinningLines.Validate` 49 hattı her açılışta doğruluyor. Bu mimari, aşağıda önerilen her kural varyantının önce ucuz bir konsol self-play koşusuyla ölçülüp sonra UI'a bağlanmasına izin veriyor — tek geliştirici için en değerli altyapı bu.

2. **Erişilebilirlik/okunabilirlik temeli türünün üstünde ve playtest bulguları gerçekten kapatılmış.** Seç-onayla akışı + dpi-tabanlı dokunma ölü bölgesi (`CameraOrbit.TapMaxTravel`, `TapMaxSeconds = 0.8f`), dolu hücrede açık kalan collider (`CellView` yorumu: ray arkadaki hücreye sızamaz), şekil-kodlu ışınlar (X = küp, O = silindir; `BoardView.CreateBeam(square:)`), eski ışınların soluklaşması (`beamXDim/beamODim`), katman tonları + patlatılmış görünüm, Efektler/Ses anahtarları, teselli mesajı, pie'nin kayıt-devam döngüsünde bile korunması (`GameController.HandlePieRule` yorumu). Önceki persona planının 14 maddesinin neredeyse tamamı kodda duruyor.

3. **Savunmacı, sunucu-otoriter online istemci.** `OnlineClient` generation damgalama, ack timeout → transport kaybı kurtarma, artan gecikmeli rejoin, koltuk geri alma (`lastOnlineSession` ile "Room is full" tuzağını atlatma) ve stale snapshot filtresi içeriyor. Protokol sabitken istemci tarafında sosyal katman inşa etmek için güvenilir bir zemin var.

### En zayıf 3 yan

1. **"Yarın neden geri geleyim?" sorusunun cevabı yok.** Kalıcı ilerleme sadece `GamePrefs.RecordMatch`'ün (kural seti × zorluk) başına tuttuğu W/L + seri. Beraberlik hiç kaydedilmiyor (`StatsData`'da Draws alanı yok; `FinishRound` yalnız `match.Winner != null` iken `RecordMatch` çağırıyor) — oysa self-play'e göre Dengeli/Zor seviyede Çizgiler turlarının ~%29-33'ü berabere bitiyor; varsayılan tek-tur maçta oyuncu üç oyundan birinde "iz bırakmayan" bir sonuçla kapanış yaşıyor `[KANIT]`. Günlük tetikleyici (bulmaca/hedef), başarım, merdiven, maç geçmişi yok; web'in `retention.ts`/`puzzles.ts` katmanı portlanmamış.

2. **Varsayılan deneyim yapısal olarak taraflı: solo'da insan her zaman açıyor.** `GameController.StartMatch` her maçta `humanPlayer = X` ve `MatchState.Create(Player.X)` kuruyor; varsayılan maç uzunluğu tek tur (`GameHud.menuTargetWins = 1`). Çizgiler'de açıcının skor beklentisi ayna eşleşmelerde %62-100 (Smart ayna %81,3) — yani varsayılan kurulumda zorluk etiketleri sistematik olarak "olduğundan kolay" oynuyor ve istatistikler şişiyor; Bo3'e geçen oyuncu 2. turda aniden ters rüzgâr yiyor `[KANIT — self-play açıcı skorları + kod]`.

3. **Üst beceri bandında Çizgiler düzleşiyor ve oyun bunu oyuncuya hiç anlatmıyor.** AI'nın Lines değerlendirmesi sistematik savunmacı (`Ai.cs: LinesRivalWeights` × 1.08 ≈ kendi hatlarından %16-24 ağır; rakip tehdit hücresi 58-72'ye karşı kendi 42-54; `replyRisk` cezası 105-150). Sonuç: Zor/Usta aynalarında tur başına toplam skor 5,25-5,75'e düşüyor (Casual'da 7,2), 21. hamledeki lider turların %55-100'ünde tutuyor, "comeback mümkün" oranı Zor aynasında %0 `[KANIT]`. Oyunda ne liderlik değişimini kutlayan, ne son-6 gerilimini gösteren (web'deki `linesTension.ts` portlanmamış), ne de geride kalana yol gösteren tek bir sistem var — skor açıldığı anda turun kalan 10 hamlesi ölü zaman.

---

## 2. Çekirdek Oyun Teşhisi

### 2.1 Klasik: ilk hamle avantajı gerçek, pie doğru ilaç — ama AI pie'ye karşı saf oynuyor

3x3x3 Klasik, teoride ilk oyuncunun kazandığı çözülmüş bir oyundur (merkez açılışı zorlama kazanç üretir). Self-play bunu yansıtıyor: Klasik ayna eşleşmelerinde açıcı kazanma oranı Dengeli/Zor/Usta'da %100, ortalama tur 7-9 hamle `[KANIT]`. Pie Rule bu yüzden doğru çözüm ve kodda eksiksiz (`Ai.ShouldSwapClassicPie`, `MatchState.RemapForSideSwap`, `GameController.HandlePieRule`).

Ancak eşik matematiği (`Ai.cs: ShouldSwapClassicPie`) somut bir istismar açığı bırakıyor. Takas değeri `PositionalBonus(ilkHamle)*3 + LineParticipation(ilkHamle)*8 + (merkezse 34)`:

| İlk hamle | Hat sayısı | Takas değeri | Kolay (104) | Dengeli (78) | Zor (66) | Usta (54) |
|---|---:|---:|---|---|---|---|
| Merkez (13) | 13 | **186** | Takas | Takas | Takas | Takas |
| Köşe | 7 | **77** | Hayır | **Hayır (1 puanla!)** | Takas | Takas |
| Yüz merkezi (`EdgeCenters`: 4,10,12,14,16,22) | 5 | **40** | Hayır | Hayır | Hayır | Hayır |
| Kenar ortası (`MiddleFaceCenters`) | 4 | **44** | Hayır | Hayır | Hayır | Hayır |

İki sonuç `[KANIT]`:

1. **AI açıcıyken pie'yi hiç hesaba katmıyor.** `ChooseClassicMove`'daki `ClassicOpeningBook` Kolay dışında her zorlukta ilk hamlede merkezi oynuyor. Pie solo Klasik'te hep açık olduğu için, takas etmeyi bilen bir insan AI'nın her açılışında merkezi bedavaya devralır. AI kendi eşiğiyle tutarsız: kendisi 186'lık hamleyi takas ederdi, ama rakibine 186'lık hamle hediye ediyor.
2. **İnsan açıcıyken anti-pie meta var ama görünmez:** Dengeli'ye karşı köşe aç (77 < 78, AI takas etmez, köşe güçlü kalır); Usta'ya karşı en iyisi yüz merkezi (40 — AI'nın takas etmediği en değerli hamle). Oyun bu pazarlık katmanını hiçbir yerde öğretmiyor.

**Öneri (S maliyet):** `ChooseClassicMove`'a "pie aktif ve tahta boş" dalı ekle: Zor/Usta açılışı yüz merkezi (ör. 4), Dengeli açılışı köşe olsun. Bu AI'nın web ile hamle eşitliğini bozar — ya aynı değişikliği `src/game/ai.ts`'e de uygula ya da Unity'de `pieAware` bayrağıyla opsiyonel yap. Pie kartına da (`GameHud.ShowPiePrompt`) Kolay zorlukta tek satır rehber ekle: "İpucu: merkez açılışı güçlüdür — takas etmek genelde iyidir."

### 2.2 Klasik ağırlıklarında ters sıralama

`Ai.cs: PositionalBonus` merkez 16 / köşe 7 / kenar ortası (`MiddleFaceCenters`, hücre başına **4 hat**) 4 / yüz merkezi (`EdgeCenters`, hücre başına **5 hat**) **0** veriyor — yani hat katılımı daha yüksek olan hücre sınıfı daha düşük bonus alıyor `[KANIT — hat sayımları: merkez 13, köşe 7, yüz merkezi 5, kenar ortası 4; toplam 147 = 49×3 ile doğrulandı]`. Lines tarafındaki `LinesPositionalBonus` (30/18/16/11) doğru sıralamada. Etkisi muhtemelen küçük (minimax bunu kısmen telafi eder) ama `ScoreMove`'un hamle sıralamasını ve `ShouldSwapClassicPie` değerlerini saptırıyor. **Web ile birlikte düzeltilmeli** (port eşitliği bozulmasın); düzeltme sonrası Klasik self-play ile zorluk ayrımının korunduğu teyit edilmeli `[DOĞRULANMALI — aşağıdaki 2.5 yöntemiyle]`.

### 2.3 Çizgiler: parite avantajı, beraberlik deliği ve comeback kuraklığı

- **Parite:** X açtığında 14 taşa karşı 13 taş koyuyor; self-play açıcı skoru ayna eşleşmelerde %62,5-100 `[KANIT]`. Pie Klasik'e özgü; Çizgiler'de hiçbir dengeleyici yok.
- **Beraberlik:** Çizgi sayıları eşit bitebiliyor ve tek-tur maçta `matchEndedByDraw` maçı "Berabere!" ile kapatıyor; istatistiğe hiçbir şey yazılmıyor (bkz. Özet-zayıf 1). Beraberlik oranı Dengeli %32,6 / Zor %29,2 `[KANIT]`.
- **Comeback:** Lider@21 tutma oranları yüksek, son-6'da sonuç değişimi ortalama %25 `[KANIT]`. AI'nın savunmacı eğilimi (2.köşe: `LinesRivalWeights`, tehdit ağırlıkları, `replyRisk`) üst seviyede düşük skorlu blok savaşına yakınsıyor; `ScoreLinesBoard`'daki kademeli `diffWeight` (165→225→285→1100) AI'nın sonoyunu ciddiye almasını sağlıyor ama *oyuncu tarafında* geriden gelmeyi kolaylaştıran hiçbir mekanik yok.

**Tek taşla üç kuş — "açılış komisi" kuralı (S maliyet):** *"Tahta dolduğunda skorlar eşitse, turu açılışı YAPMAYAN oyuncu kazanır."* Bu (a) pariteden gelen açıcı avantajını yarım çizgilik komiyle dengeler, (b) beraberliği tamamen ortadan kaldırır (tek-tur maçın antiklimaksı biter), (c) geride kalan ikinci oyuncuya her zaman canlı bir hedef bırakır ("eşitlersem kazanırım"). Uygulama: `Rules.EvaluateLinesBoard` opener bilmediği için v1'de `GameController.FinishRound` çözümlesin + menü kural açıklamasına tek cümle; v2'de AI'ya öğretmek için `ScoreLinesBoard`'a opener parametresi. **Varsayılan yapmadan önce ölç** `[DOĞRULANMALI — 2.5]`: web `aiSelfPlay.ts` zaten `opener`/`forcedOpenings` destekliyor; komi kuralını TS tarafında 10 satırla prototipleyip `npm run design:audit` matrisinde açıcı skorunun %50'ye yaklaştığını göster, sonra C#'a port et.

- **Merkez çekimi:** Merkezli açılış skoru %89,8'e karşı merkezsiz %61,0 `[KANIT]`. Web'in kararı "center-normalized varyantı prototiple" idi (`linesVariant.ts`: merkezden geçen çizgi 0,75 sayılır). Bu, komiden bağımsız ikinci bir ayar düğmesi; ikisini birden varsayılana almak yerine 3.2'deki "Turnuva" modunda paketlemeyi öneriyorum.

### 2.4 Kill-move okunabilirliği: veri var, gösterim düz

Çizgiler'in en keyifli anı çoklu çizgi hamlesi; AI bunu güçlü biliyor (`ScoreLinesCandidateShallow`: `immediateGain*270` + `MultiLineBonus*260`) ve gerçekleştiğinde kutlanıyor (`CelebrateLines`: "ÇİFT!", sarsıntı). Ama **öncesinde** oyuncuya görünmüyor: `GameController.UpdateHints` → `Rules.GetThreatCells` hücreleri tekilleştiriyor, bu yüzden 1 çizgi kapatan hücreyle 3 çizgi kapatan hücre aynı yeşil küp `[KANIT]`. Aynısı kırmızı tarafta: iki tehdidi birden kesen hücre tek tehdit kesenle aynı.

**Öneri (S):** `Rules`'a `GetThreatCellCounts(board, player) → Dictionary<int,int>` ekle (mevcut `GetLineThreats` üstünde 10 satır); `BoardView.ShowHints` küp ölçeğini sayıya göre büyütsün (0,55 / 0,7 / 0,85) ve 2+ için küpün üstüne mini işaret kümesi koysun. İkinci adım (S): AI'nın `replyRisk` kavramını oyuncuya da ver — seçili hücre onaylanmadan önce "bu hamle rakibe N çizgi bırakıyor" uyarısını `hintLabel`'da göster (`GetBestImmediateLineGain(next, rival)` zaten var; seç-onayla akışı bunun için biçilmiş kaftan).

### 2.5 Nasıl ölçülür (tüm `[DOĞRULANMALI]` maddeleri için tek yöntem)

Core birebir port olduğu için **denge deneylerini TS tarafında yap, kazananı C#'a taşı**: `npm run ai:selfplay` / `npm run design:audit` (metodoloji ve taban çizgisi `docs/design-validation.md`'de hazır — açıcı skoru, merkez sahibi skoru, lider@21, son-6 değişimi, lead change metrikleri). Unity'ye özgü kurallar (ör. yerçekimi modu) için: dört Core dosyası saf C# olduğundan 100 satırlık bir `dotnet` konsol harness'ı (depo dışı birim testlerinin kurduğu kalıbın aynısı) yeterli. Kıstas önerileri: bir varyant "dengeli" sayılır ⇔ ayna eşleşmede açıcı skoru %45-55, beraberlik <%10, son-6 sonuç değişimi >%25.

---

## 3. Oyun Modu / Format Önerileri

Mevcut iki kural seti iyi bir taban: Çizgiler (puan yarışı, ana mod) + Klasik (hızlı, pie'li). Eksik olan üç şey: *fiziksel okunabilirliği yüksek bir giriş modu*, *rekabetçiler için dengelenmiş bir format* ve *oturum çeşitliliği*. Hepsi mevcut `Ruleset` enum'una eklenen dal + `GameController`/`GameHud` akışıyla yapılır; hiçbirinde asset yok.

### 3.1 "Kule" — yerçekimli Çizgiler/Klasik (amiral gemisi önerisi)

- **Kural:** Taşlar sütuna bırakılır; işaret, o (x,z) sütunundaki **en alttaki boş hücreye** düşer (Score Four / 3B Connect-4 ailesi). Hamle uzayı her an en fazla 9 seçenek.
- **Kazanma:** İki alt varyant — *Kule Klasik*: ilk 3'lü çizgi kazanır; *Kule Çizgileri*: tahta dolana kadar oyna, çizgi başına 1 puan (49 hat aynen geçerli).
- **Tur yapısı:** Mevcut maç uzunluğu seçenekleri aynen; pie gerekmez (sütun kısıtı açılış avantajını törpüler — `[DOĞRULANMALI`, 2.5 harness'ıyla ölç]).
- **Neden eğlenceli:** 3B XOX'un en büyük UX vergisini (iç hücreye kamera manevrası, 27 hedef arasında derinlik okuma) **kuralla** sıfırlıyor: hedef 9 sütun, taşın nereye gideceği her zaman belli. Zorlama taktikleri ("alt taşı koyarsam üstünü rakibe açarım") Connect-4 oyuncularının bildiği, öğretmesi kolay bir gerilim üretir. Düşüş animasyonu (lerp + mevcut pop) bedava juice.
- **Segment:** Elif/Zeynep/Meral (casual, çocuk, erişilebilirlik) için ana giriş kapısı; Kerem için yeni taktik uzay.
- **Uygulama:** `Rules.GetAvailableMoves`'u saran `GetGravityMoves(board)` (her sütunun en alt boşu); `Ai.ChooseMove`'a legal-hamle filtresi parametresi (mevcut skorlayıcılar aynen çalışır, sadece aday kümesi daralır — `GetLinesCandidateMoves`/`GetCandidateMoves` filtreden geçer); `GameController.OnCellTapped` dokunulan hücreyi sütununa çevirir; `BoardView.SetMark`'a y-düşüş animasyonu. Maliyet: M.

### 3.2 "Turnuva Çizgileri" — dengelenmiş rekabet varyantı

- **Kural:** Çizgiler + şu üç ayar: (1) eşitlikte açılmayan taraf kazanır (açılış komisi, 2.3), (2) merkezden geçen çizgiler 0,75 puan (web `linesVariant.ts`'in `CENTER_NORMALIZED_LINE_WEIGHT`'i; skor HUD'da "7,5" gibi gösterilir), (3) maç uzunluğu en az Bo3.
- **Kazanma:** Tur = ağırlıklı çizgi toplamı; eşitlik ikinci oyuncuya. Maç = mevcut `MatchState`.
- **Neden eğlenceli:** "Kim açtıysa kazanır + merkez şart" hissini (self-play'in iki ana riski) tek pakette söndürür; ayna maçlar gerçek beceri sınavına döner. Skorun küsuratlı olması "merkez hattı ucuz" kuralını kendiliğinden öğretir.
- **Segment:** Kerem (stratejist) ve online rekabetçiler — not: online'da sunucu kural setini belirlediği için bu mod **yalnız yerel** (protokol sabit kısıtına takılır; menüde "yerel mod" diye işaretle).
- **Uygulama:** `Rules.EvaluateLinesBoard`'a opsiyonel `LinesVariantOptions` (komi + merkez ağırlığı); `Ai.ScoreLinesBoard`'un `lineDiff`'i ağırlıklı skora geçer; `GameHud` kural açıklaması. Önce TS'te audit (2.5). Maliyet: S-M.

### 3.3 "Yıldırım" — hamle süreli Çizgiler

- **Kural:** Her oyuncuya hamle başına 7 sn (Kolay/Dengeli) veya 5 sn (Zor/Usta). Süre dolarsa hamle **otomatik olarak en iyi analiz hücresine değil, rastgele boş hücreye** oynanır (aksi halde süre dolması avantaja dönüşür). AI `AiMinThinkSeconds`'ı korur.
- **Kazanma/tur:** Çizgiler kuralları aynen; tek tur varsayılan.
- **Neden eğlenceli:** 27 hamlelik Çizgiler turunun orta bölümündeki sarkmayı (zayıf yan 3) tempoya çevirir; "yanlış yere basma" riski gerilimin parçası olur (seç-onayla kapalı oynanır — `QuickMove` zorunlu, menüde belirtilir). Baran segmenti (juice/tempo) için oturum çeşitliliği; günlük hedef sistemine "1 Yıldırım turu kazan" diye bağlanır.
- **Segment:** Genç/mid-core; Meral segmenti için **asla varsayılan yapılmaz** (bkz. Yapma Listesi).
- **Uygulama:** `GameController`'a tur sayacı + `GameHud`'a üst şeritte incelen süre çubuğu (mevcut `turnStrip`'in genişlik animasyonu); timeout'ta `PlaceMark(random)`. Maliyet: S-M.

### 3.4 Web sistemlerinin port sıralaması (maliyet/değer)

| Sıra | Sistem | Değer | Maliyet | Karar |
|---|---|---|---|---|
| 1 | **Günlük bulmaca** (`puzzles.ts`) | Çok yüksek: tek başına günlük dönüş tetikleyicisi; içerik üretimi gerektirmez (tarih-tohumlu 4 deterministik üreteç) | M (çözücüler ~150 satır saf C#; UI = mevcut tahta + tek hamle + sonuç kartı; PlayerPrefs'e `dateKey`+seri) | **Port et** (bkz. 4.1) |
| 2 | **Son-6 gerilim bandı** (`linesTension.ts`) | Orta-yüksek: Çizgiler sonoyununa isim ve dram verir ("Son 6: +2'ye kadar ve 1 blok canlı") | S (80 satır; mevcut `hintLabel`'a yazılır) | **Port et** |
| 3 | **Koç merdiveni** (`coach.ts` + `coachLadder.ts`) | Orta: Analiz katmanı değerin ~%70'ini zaten veriyor; asıl yenilik merdiven (ilk 3 turda tam ipucu, sonra yumuşak) + metinli açıklama | M (açıklama metinleri `GameStrings`'e; merdiven mantığı 60 satır) | Kısmen port: merdiven + "neden" metni; ayrı mod yapma |
| 4 | **Retention istatistikleri + aksan kilidi** (`retention.ts`) | Orta: `totalLinesScored`, `bestLinesWinMargin`, `masterWins` başarım sistemine hammadde; aksan kilidi = sadece `GameHud` renk sabitleri + `BoardView` materyal paletinin alternatifi | S-M | 4.2/4.5 içinde erit |
| 5 | **Wildcards / Final Six Powers** (`wildcards.ts`, `finalSixPowers.ts`) | Belirsiz: web'de bile denge auditleri "not run" (`design-validation.md`), oyuncuya hiç açılmamış deney | L (draft UI + AI entegrasyonu + denge turu) | **Port etme** (bkz. Yapma Listesi) |

---

## 4. Tutundurma ve İlerleme (monetizasyonsuz)

İlke: içerik üretme, **mevcut maçları anlamlandır**. Tümü PlayerPrefs'e sığar.

### 4.1 Günlük bulmaca

- **Spec:** Günde 1 bulmaca; tür tarih-tohumlu rotasyon (`puzzles.ts` birebir: en-iyi-Lines-hamlesi / maks-çizgi / Klasik-kazan / iki-hamlede-kazan). Tahta hazır pozisyonla kurulur, oyuncu tek hamle yapar, doğru/yanlış + açıklama kartı; gün içinde tek deneme sayılır, sonrası "pratik". Bulmaca serisi (üst üste gün) ayrı sayaç.
- **Nereye oturur:** Yeni `Core/Puzzles.cs` (saf C#, `boardWithMarks` + çözücüler; `findClassicWinInTwoMoves` dahil hepsi `Rules` üstünde); `GameController`'a `StartDailyPuzzle()` fazı (`GamePhase`'e `Puzzle` eklemek yerine tek turluk özel maç + hamle sonrası `FinishRound` yerine sonuç kartı); menüye "Günlük Bulmaca" satırı + "✓ çözüldü" rozeti (`GamePrefs`'e `tictacube_daily_result` JSON'u, `dateKey` doğrulamalı). Paylaşım metni (`shareText`) `GUIUtility.systemCopyBuffer` ile "kopyala" butonu — sosyal yayılım, sunucusuz.

### 4.2 Başarımlar (tek seferlik rozetler)

- **Spec:** ~16 başarımlık statik tablo; her biri `id`, TR/EN ad, koşul. Örnek set: *İlk çizgi; Tek hamlede 2 çizgi; Tek hamlede 3+ çizgi; Merkezsiz tur kazan (merkez hücren yokken); 21. hamlede gerideyken turu kazan (comeback — `FinishRound`'da hamle 21 anındaki `LineScore` karşılaştırması için `moveHistory` yeterli); Pie takası sonrası turu kazan; Zor'u yen; Usta'yı yen; Usta'ya karşı 3 seri; 10+ çizgili tur; Beraberliği koru (Usta'ya karşı); Klasik'te 7 hamlede kazan; Toplam 100 çizgi; Her zorlukta en az 1 galibiyet; Günlük bulmacada 7 gün seri; Online ilk maç.*
- **Nereye oturur:** `Game/Achievements.cs` (statik tanımlar + `Check(event)`), tetik noktaları `GameController.CelebrateLines`, `FinishRound`, `PieAnswer`, online `HandleOnlineRoundState`; kazanımda mevcut `hud.Toast` + `GameAudio.PlayLines(2)`; menüde `GameHud`'a kaydırılabilir mini liste paneli (mevcut `CreateText` kalıbı; GameHud büyüdüğü için ayrı `AchievementsPanel` sınıfı önerilir). Depolama: `GamePrefs`'e virgüllü id seti + sayaçlar (`totalLines` için `retention.ts`'teki `totalLinesScored` mantığı).

### 4.3 Günlük hedefler (3'lü rotasyon)

- **Spec:** Her gün tarih-tohumlu 3 hedef (deterministik, sunucusuz): havuzdan ör. *"Dengeli+ zorlukta 1 tur kazan", "Tek hamlede 2 çizgi yap", "Toplam 6 çizgi tamamla", "1 Klasik turu kazan", "Günlük bulmacayı çöz"*. Hepsi biterse "gün tamamlandı" yıldızı; yıldız serisi ayrı gösterilir. Ödül yok — ödül, sayaç ve kutlamanın kendisi (monetizasyonsuz tutundurmada hedefin görünürlüğü yeterli kaldıraç).
- **Nereye oturur:** `Game/DailyGoals.cs`; ilerleme olayları başarım tetikleriyle aynı kancalardan; menü üstünde (statsLabel altı) tek satır özet "Bugün: 2/3 ✦"; `GamePrefs`'e `dateKey` + ilerleme JSON'u.

### 4.4 Rakip merdiveni + AI kişilikleri

- **Spec (merdiven):** 12 basamaklı tek yönlü merdiven; her basamak = zorluk + kural + koşul paketi. Örn: 1) Kolay-Çizgiler; 3) Dengeli-Çizgiler "2+ fark ile kazan"; 5) Dengeli-Klasik (pie açık); 7) Zor-Çizgiler "AI açar" (`MatchState.Create(Player.O)`); 9) Zor-Klasik; 11) Usta-Çizgiler; 12) Usta-Bo3. Basamak koşulları `FinishRound`'da kontrol edilir (fark koşulu için `lastResult.LineScore` hazır). Kazanılan basamak yıldızla işaretlenir, istenen basamak tekrar oynanabilir.
- **Spec (kişilikler, v2):** Kişilik = `Ai`'ye eklenen çarpan profili (varsayılan profil mevcut sabitler → web eşitliği korunur): *Saldırgan* (`LinesRivalWeights` etkisi ×0,85, `CreatesThreats` ×1,5), *Kale* (savunma ×1,2), *Merkezkaç* (`LinesPositionalBonus` merkez 30→8), *Kumarbaz* (Dengeli'nin `softerMove` olasılığı 0,12→0,35). Her kişiliğe isim + tek cümle tanıtım; merdiven basamaklarına serpilir. Kişilikler yalnız Unity'de kalabilir (hamle eşitliği iddiası varsayılan profil için sürer) — README'ye not düş.
- **Değer:** "4 zorluk" düz listesini hedefli bir ilerleme hattına çevirir; Kerem segmentinin "gelişimimi ölçemiyorum" şikâyetinin yapısal cevabı.

### 4.5 Küçük ama etkili

- **Maç geçmişi:** Son 10 maç (tarih, kural, zorluk, skor) `GamePrefs`'e halka tampon; menüde statsLabel'a dokununca açılan mini liste. (S)
- **Beraberliği kayda al:** `StatsData`'ya `Draws` ekle; `FinishRound`'da `matchEndedByDraw` yolunda da yaz. Seriyi bozmasın. (S)
- **Aksan paletleri:** `retention.ts`'teki kilit eşikleri (Dengeli×3 / Zor×2 / Usta×1 serisi vb.) üç alternatif X/O/vurgu paletini açsın; palet = `GameHud` renk sabitleri + `BoardView.LoadMaterial` fallback renklerinin ikinci seti (çalışma anında `new Material` kopyaları, asset yok). Tek iyi varsayılan artık mevcut olduğu için önceki turda reddedilen "tema" fikri bugün ucuz ve güvenli. (S-M)

---

## 5. Online'ın Sosyal Katmanı (protokole dokunmadan, istemci-yerel)

Gerçekçi sınır: protokolde kimlik, sohbet, emote, niyet sinyali yok ve eklenemez. Yapılabilecekler iki sınıf: **(a) eldeki snapshot/olay akışından türetilen bilgi**, **(b) cihaz-yerel kalıcılık.**

1. **Bekleme ekranını vitrine çevir (S, en yüksek değer):** `OnlineStatus.Waiting`'de oda kodu şu an `hintLabel`'da küçük yazı. Kod ekran ortasında dev puntoyla + "Kodu Kopyala" (`GUIUtility.systemCopyBuffer`) + "arkadaşına gönder, o 'Odaya Katıl'dan girsin" yönergesi. Davet sürtünmesi şu an online'ın en büyük gerçek engeli.
2. **Rövanş akışını netleştir (S):** Maç bitiminde buton "Yeni Maç" yerine **"Rövanş (iki taraf da başlatabilir)"**; rakip `reset-match` tetiklediğinde mevcut "Yeni tur!" toast'u yerine "Rakip rövanş istedi — başlıyor!" + fanfar. Teknik olarak aynı `SendResetMatch`; fark tamamen sunum.
3. **Oda-yerel maç geçmişi (S-M):** İstemci her `MatchComplete` snapshot'ında sonucu `(tarih, roomId, kural, benimSkor-rakipSkor)` olarak PlayerPrefs'e yazar; bekleme/sonuç ekranında "Bu odada: Sen 2-1" ve menüde "Online: 7G-4M". Kimlik yok, dürüst etiket: "oda bazlı".
4. **Rakip tempo göstergesi (S):** Son snapshot'tan bu yana geçen süre zaten ölçülebilir; rakip sırası 20 sn'yi aşınca `thinkingLabel`'da "Rakip düşünüyor (23 sn)…", 60 sn'de "Rakip hâlâ orada — bağlantısı kopmuş olabilir" (gerçek kopuşta zaten `PeerWaiting` geliyor). Hamle sürelerinin son-5 ortalamasından "hızlı/temkinli oynuyor" etiketi mümkün ama kozmetik; süre sayacı yeter.
5. **Gecikme noktası (S):** `pendingActionSentAtMs` → `action-ack` arası RTT ölçülüp köşede 3 kademeli renk noktası (yalnız kendi aksiyonlarında örnekleme — dürüst sınır). `ack-timeout` zaten var; bu onun erken uyarısı.
6. **Maç sonu özeti (M):** İstemci tur boyu her snapshot'ı gördüğü için hamle listesi yerelde tutulabilir → maç bitiminde "özet" paneli: tur tur skorlar + en iyi hamlen ("+2 ÇİFT, hamle 19"). İleri adım: aynı veriyle **yerel replay** (hamleleri `SetMark` ile sırayla oynatan izleyici) — offline maçlar için de aynı bileşen kullanılır (`moveHistory` zaten var).
7. **Online istatistiklerin menü görünürlüğü (S):** `RefreshMenuLabels` online modda `statsLabel`'ı boş bırakıyor; 3. maddedeki toplam oraya yazılabilir.

**Yapılamayacağını açıkça kabul et:** emote/hazır mesaj (protokolde kanal yok; hamle zamanlamasına bilgi gömmek gibi hack'ler denenmemeli), isim/avatar, eşleştirme, sunucu taraflı seri/elo.

---

## 6. His / Juice ve Okunabilirlik — mevcutun üstüne ince ayar

Temel paket yerinde (pop, halka, ışın soluklaştırma, "+1" uçan yazı, konfeti, prosedürel ses, gecikmeli sonuç paneli, Tahtaya Bak). Eksik ve fazlalıklar:

**Eksikler (ucuzdan pahalıya):**
1. **Skor tick animasyonu:** `GameHud.SetScores`/`SetOnlineScores` metni anında değiştiriyor; çizgi skoru 0,3 sn'de eski değerden yenisine saysın + değişen tarafın rengiyle kısa parlasın. Puanın "ağırlığı" için en ucuz kazanım.
2. **"Rakip düşünüyor…" canlandırma:** `thinkingLabel` statik; nokta sayısını `Time.time`'a bağla (kod 3 satır).
3. **Liderlik anlatısı (Çizgiler'in dram eksiğine doğrudan ilaç):** `PlaceMark` sonrası `lineDiff` işaret değiştirdiğinde toast: "Öne geçtin!" / "Rakip öne geçti!" / "Eşitlik!"; son-6'ya girildiğinde `linesTension` bandı (3.4-#2). Oyunun orta bölümüne hikâye verir, sıfır kural değişikliği.
4. **Hayalet taş önizlemesi:** Seçili hücrede yarı saydam X/O göster (`CellView.SetSelected` bugün sadece büyütüp vurguluyor); hem derinlik okuması hem "neyi onaylıyorum" netliği. Mevcut `CreateXMark/CreateOMark`'ın %50 alfa materyalli kopyası.
5. **Patlatılmış görünümde ışınları kaybetme:** `BoardView.SetLayersSeparated` tüm ışınları kapatıyor; `BeamEntry.Line` saklandığı için `ApplySeparation` her karede ışın transformunu `SeparatedCellPosition(line[0])–(line[2])`'den yeniden kurabilir — katmanlar açılırken ışınların esneyerek takip etmesi hem bilgi kaybını önler hem başlı başına hoş bir efekt.
6. **Sonuç gecikmesini dokunuşla atlama:** `ShowResultDelayed` 1,4 sn kilitli; beklerken ekrana dokunan paneli hemen alsın (tempolu oyuncu için).
7. **Analiz küplerinde büyüklük kodlaması:** 2.4'te anlatıldı.
8. **Solo'da çizgi skoru "Sen/Rakip" dili:** `lineScoreLabel` hâlâ "X 3 - 2 O"; maç skoru gibi "Sen 3 - 2" olmalı (Meral bulgusunun yarım kalan kısmı).

**Fazlalık / riskler:**
1. **Titreşim ayrımı:** `GameAudio.Vibrate` *Efektler* anahtarına bağlı, ses anahtarına değil; `Handheld.Vibrate()` Android'de uzun ve kaba. Her çizgide titreşim yerine yalnız çoklu çizgi + tur sonunda titret; menü etiketine "(titreşim dahil)" ekle veya ayrı "Titreşim" anahtarı aç.
2. **Çift kutlama yığılması:** Çoklu çizgide aynı anda ses + sarsıntı + büyük yazı + ışınlar; üstüne 6.1'in skor parlaması gelince taşabilir — sarsıntıyı yalnız 3+ çizgiye saklamak düşünülebilir (hissiyatla karar ver).
3. **Konfeti rigidbody'leri:** 42 küp × fizik kabul edilebilir; ama 60 fps hedefli eski cihaz testinde sorun çıkarsa parçacık yerine transform-lerp'e çevirmek yeterli. Şimdilik dokunma.

---

## 7. Yol Haritası

Etki 1-5 (5 = tutundurma/his üzerinde en büyük), maliyet S/M/L (S ≈ ≤1 gün, M ≈ 2-4 gün, L ≈ 1 hafta+).

| # | Öneri | Kategori | Etki | Maliyet | Öncelik | Dokunduğu dosyalar |
|---|---|---|---:|---|---:|---|
| 1 | Skor tick + düşünüyor animasyonu + liderlik/son-6 toast'ları (6.1-3) | His | 4 | S | 1 | `GameHud.cs`, `GameController.cs`, yeni `LinesTension` mantığı |
| 2 | Günlük bulmaca portu (4.1) | Tutundurma | 5 | M | 2 | yeni `Core/Puzzles.cs`, `GameController.cs`, `GameHud.cs`, `GamePrefs.cs`, `GameStrings.cs` |
| 3 | Tek-tur açılış rotasyonu: son açıcıyı PlayerPrefs'te tut, maçlar arası dönüşümlü aç (Özet-zayıf 2) | Denge | 4 | S | 3 | `GameController.StartMatch`, `GamePrefs.cs` |
| 4 | Analiz küplerinde çoklu-çizgi büyüklüğü + "rakibe N çizgi bırakır" uyarısı (2.4) | Okunabilirlik | 4 | S | 4 | `Rules.cs`, `BoardView.cs`, `GameController.UpdateHints`, `GameHud.cs` |
| 5 | Online bekleme vitrini + kod kopyala + rövanş dili (5.1-2) | Online | 4 | S | 5 | `GameHud.cs`, `GameController.cs` |
| 6 | Beraberlik kaydı + `StatsData.Draws` (4.5) | Tutundurma | 3 | S | 6 | `GamePrefs.cs`, `GameController.FinishRound`, `GameHud.cs` |
| 7 | Açılış komisi: TS'te audit → Çizgiler'e opsiyon (2.3) | Denge | 4 | S (TS) + S (C#) | 7 | `src/game/` (deney), `Rules.cs`, `GameController.cs`, `GameHud.cs` |
| 8 | Başarımlar v1 (10-12 rozet) (4.2) | Tutundurma | 4 | M | 8 | yeni `Game/Achievements.cs`, `GameController.cs`, `GameHud.cs`, `GamePrefs.cs` |
| 9 | Klasik AI'nın pie-farkında açılışı + pie kartında ipucu (2.1) | Denge | 3 | S | 9 | `Ai.cs` (+ web `ai.ts` eşitliği), `GameHud.cs` |
| 10 | Günlük hedefler (4.3) | Tutundurma | 4 | M | 10 | yeni `Game/DailyGoals.cs`, `GameHud.cs`, `GamePrefs.cs` |
| 11 | Hayalet taş önizleme + sonuç atlama + solo "Sen" skoru (6.4,6,8) | His | 3 | S | 11 | `CellView.cs`, `BoardView.cs`, `GameHud.cs`, `GameController.cs` |
| 12 | Kule (yerçekimi) modu (3.1) | Mod | 4 | M-L | 12 | `Rules.cs`, `Ai.cs`, `GameController.cs`, `BoardView.cs`, `GameHud.cs` |
| 13 | Rakip merdiveni (4.4) | Tutundurma | 4 | M | 13 | yeni `Game/Ladder.cs`, `GameController.cs`, `GameHud.cs`, `GamePrefs.cs` |
| 14 | Online maç özeti + yerel replay (5.6) | Online | 3 | M | 14 | `GameController.cs`, `GameHud.cs`, `BoardView.cs` |
| 15 | Turnuva Çizgileri varyantı (3.2) | Mod | 3 | S-M | 15 | `src/game/` (audit), `Rules.cs`, `Ai.cs`, `GameHud.cs` |
| 16 | Patlatılmış görünümde ışın takibi (6.5) | Okunabilirlik | 2 | S | 16 | `BoardView.cs` |
| 17 | AI kişilikleri (4.4 v2) | Tutundurma | 3 | M | 17 | `Ai.cs`, `GameController.cs`, `GameHud.cs` |
| 18 | Yıldırım modu (3.3) | Mod | 2 | S-M | 18 | `GameController.cs`, `GameHud.cs` |
| 19 | Aksan paletleri + kilitler (4.5) | Tutundurma | 2 | S-M | 19 | `GameHud.cs`, `BoardView.cs`, `GamePrefs.cs` |
| 20 | Titreşim ayarı ayrıştırma (6-fazla-1) | His | 2 | S | 20 | `GameAudio.cs`, `GameHud.cs`, `GamePrefs.cs` |
| 21 | Klasik `PositionalBonus` yüz-merkezi düzeltmesi (2.2) | Denge | 1 | S (web ile eş) | 21 | `Ai.cs`, `src/game/ai.ts` |

### İlk sprint: "önce bunu yap" (1 hafta hedefi)

1. **#1** Skor tick + düşünüyor animasyonu + "Öne geçtin / Son 6" toast'ları — bir günde oyunun orta bölümüne nabız katar.
2. **#3** Açılış rotasyonu — iki satırlık adalet düzeltmesi; istatistiklerin anlamı buna bağlı.
3. **#4** Analiz çoklu-çizgi kodlaması — kill-move okunabilirliği, stratejist segmentin tavanını açar.
4. **#5** Online bekleme vitrini + kod kopyala — online'ın gerçek dünyada kurulabilmesinin önkoşulu.
5. **#6** Beraberlik kaydı — veri bütünlüğü, 5 dk'lık iş.
6. **#2** Günlük bulmaca portu — sprint'in büyük parçası; tutundurmanın bel kemiği.
7. **#7 (TS ayağı)** Komi audit'ini web harness'ında koştur — sprint sonunda elinde "varsayılan yapılmalı mı" verisi olsun.

---

## 8. Yapma Listesi (cazip ama zararlı)

1. **Wildcards / Final Six Powers'ı port etmek.** Web'de iki ayrı versiyonu yazılmış ama denge auditleri hiç koşulmamış (`design-validation.md`: "audit not run") ve oyunculara açılmamış. Çizgiler'in bütün gücü "her 3'lü = 1 puan" netliğinde; +1/+2 bonus katmanı bu netliği bozar, draft UI'sı tek geliştiriciye L maliyettir ve sonoyun tansiyonu sorunu komi + son-6 bandı + liderlik anlatısıyla çok daha ucuza çözülür. Hipotez ileride canlanırsa önce TS'te audit koş.
2. **4x4x4 tahtaya büyümek.** "Daha derin olsun" diye gelecek ilk fikir. 76 hat, yeniden ayarlanacak AI, iki kat kamera/okunabilirlik vergisi; mevcut erişilebilirlik yatırımının (katman görünümü, ipuçları, ışın dili) tamamı yeniden yapılır. Derinlik ihtiyacını Kule modu ve Turnuva varyantı sıfır okunabilirlik vergisiyle karşılar.
3. **Süreyi varsayılan yapmak / her moda sayaç koymak.** Yıldırım opsiyonel kalmalı. Meral/Elif segmenti (titrek el, seç-onayla akışı) zaman baskısıyla birleşemez; seç-onayla + sayaç kombinasyonu kendi içinde çelişir.
4. **Yerel Elo / puan rozu üretmek.** Tek cihazda, kimliksiz protokolde Elo sahte bir sayıdır; kaybedince düşen sayı monetizasyonsuz oyunda sadece ceza üretir. Seri + merdiven + başarım aynı motivasyonu kayıpsız verir.
5. **AI hamlesine otomatik kamera dönüşü ve "canlılık" için sürekli salınan hücreler.** İkisi de önceki playtest turunda gerekçeleriyle reddedildi (bulantı, hareketli dokunma hedefi, pil); yeni his maddeleri eklerken bu iki fikrin geri sızmasına izin verme — son hamle halkası + katman görünümü aynı işi hareketsiz yapıyor.
6. **Online protokolünü istemci hilesiyle genişletmeye çalışmak** (hamle zamanlamasına/sıra dışı reset'lere "emote" anlamı yüklemek vb.). Sunucu aksiyonları doğruluyor; bu yol kırılgan, rakip istemcide anlamsız ve web istemcisiyle uyumu bozar. Sosyal katman 5. bölümdeki istemci-yerel sınırda kalmalı.

---

*Rapor sonu. Tüm satır/sembol referansları bu depodaki mevcut koda işaret eder: ör. `Ai.cs: LineWeights = {0, 4, 34, 420}`, `ShouldSwapClassicPie` eşikleri `{104, 78, 66, 54}`, `ScoreLinesBoard` diffWeight kademeleri `{165, 225, 285, 1100}`, `GameHud.menuTargetWins = 1`, `GameController.ResultDelaySeconds = 1.4f`.*
