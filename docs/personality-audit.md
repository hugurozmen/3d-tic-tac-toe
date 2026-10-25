# AI Kişilik Auditi (Unity, Çizgiler)

Yöntem: `Ai.ChooseMove` üzerinden self-play — varsayılan profil X, kişilik
profili O; açıcı dönüşümlü; Zor/Usta deterministik oynadığı için her oyuna
taraf başına bir rastgele merkez-dışı açılış taşı zorlanır. 120 oyun/konfig.
Harness: `unity/Tests~/PersonalityAudit.cs` (Unity gerekmez; `mcs`/`mono`
ile koşar — bkz. `unity/Tests~/run-tests.sh` başlığı). "3+ fark" sütunları
10. basamağın koşulu için toplandı.

## Sonuçlar

| Konfig | Kişilik G | Varsayılan G | Beraberlik | Ort. fark (vars. lehine) | 3+ fark: vars./kişilik |
|---|---|---|---|---|---|
| Kontrol @Dengeli | 39 | 34 | 47 | −0.02 | — |
| **Kumarbaz** @Dengeli | 31 | 52 | 37 | +0.62 | — |
| **Kale** @Dengeli | 39 | 33 | 48 | −0.09 | — |
| Kontrol @Zor | 15 | 21 | 84 | +0.08 | — |
| **Saldırgan** @Zor | 25 | 25 | 70 | +0.05 | — |
| Kontrol @Usta | 10 | 18 | 92 | +0.15 | 8 / 3 |
| **Saldırgan** @Usta | 7 | 19 | 94 | +0.24 | 8 / 0 |
| **Merkezkaç** @Usta (taktik istisnalı) | 30 | 32 | 58 | +0.11 | 11 / 2 |
| **Kale** @Usta | 9 | 16 | 95 | +0.17 | 8 / 0 |
| **Kumarbaz** @Usta | 10 | 18 | 92 | +0.15 | 8 / 3 |

## Okumalar ve kararlar

1. **Kumarbaz belirgin zayıf — yalnız Dengeli'de** (yumuşak-hamle dalı
   yalnız Dengeli yolunda; Usta satırı kontrole birebir eşit çıkarak no-op
   doğrulandı). 3. basamağın "2+ fark" koşulu için doğru rakip; başka
   zorluğa atanmamalı.
2. **Kale gücü korur, beraberliğe sürükler** (Usta'da 95/120 — ancak
   kontrol Usta zaten 92/120 beraberlikçi; fark gürültü payında). Kule
   basamakları 4 ve 7'de.
3. **Saldırgan keskinleştirmesi Zor'a özgü** (beraberlik 84→70); Usta'nın
   derinlik-2 aramasında etki kayboluyor (94 beraberlik, 3+ fark 0). Bu
   yüzden ilk ölçümsüz "10. basamak = Saldırgan" ataması geri alındı;
   Saldırgan 6. basamakta (Zor, AI açar) kaldı.
4. **Merkezkaç, taktik istisnasıyla, Usta'yı kararlı oyunlara zorlayan tek
   profil** (beraberlik 92→58; 3+ farklı galibiyet 8→11). İlk sürümdeki
   filtre taktik zorunluluğu da engelliyordu — rakip (a, merkez, b) kurunca
   Usta bloke edemiyor, AI-vs-AI'da 14-44'e kadar düşüyordu; istisna
   (merkez iki taraftan biri için çizgi tamamlıyorsa oynanabilir kalır)
   açığı kapattı (30-32). Atama: **9. basamak saf Usta** (dürüst kapı),
   **10. basamak Merkezkaç** — "3+ farkla yen" ancak tasarlanmış çatlağı
   olan rakipte gerçekçi. Oyuncu merkezi ilk hamlede alırsa Merkezkaç
   pratikte saf Usta'ya yaklaşır (kalan etki `CenterOwnershipMul`);
   basamağın taban zorluğu bu durumda da korunur.
5. **Spesifikasyon sapması:** raporun "LinesPositionalBonus merkez 30→8"
   önerisi probe harness'ında Zor/Usta'da **tek bir hamleyi bile
   değiştirmedi** (merkez çoğunlukla taktiksel zorunlu seçim; çekim asıl
   `ScoreLinesBoard`'daki sahiplik terimi ve açık-çizgi sayımlarından
   geliyor; −300 bonus bile seçimi devirmedi, kırılma −400 ile −800
   arasında). Görünür kişilik için Merkezkaç üç parçayla kuruldu: ilk 10
   taş boyunca açık merkezi aday listesinden çıkaran açılış kuralı
   (`CenterAvoidPlies=10`, yukarıdaki taktik istisnasıyla), kalıcı eğilim
   `CenterBonus=−120` ve `CenterOwnershipMul=0.25` (rastgele orta
   oyunlarında hamlelerin ~%17'si değişiyor, merkez alımı 59→53/120).
6. **Web eşitliği:** varsayılan profil tüm çarpanlarda 1.0 /
   `CenterAvoidPlies=0`; `x * 1.0` IEEE-kesin olduğundan profil verilmeyen
   her çağrı bit-bit eski davranıştır. Tohumlu eşitlik testi ve kişilik
   davranış testleri depoda: `unity/Tests~/CoreTests.cs`
   (`unity/Tests~/run-tests.sh` ile koşulur). Kişilikler yalnız Unity'de
   ve yalnız Çizgiler'de; Klasik hiçbir profilde değişmez.
