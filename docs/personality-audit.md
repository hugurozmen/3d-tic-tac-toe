# AI Kişilik Auditi (Unity, Çizgiler)

Yöntem: `Ai.ChooseMove` üzerinden self-play — varsayılan profil X, kişilik
profili O; açıcı dönüşümlü; Zor/Usta deterministik oynadığı için her oyuna
taraf başına bir rastgele merkez-dışı açılış taşı zorlanır. 120 oyun/konfig.
Harness: scratchpad `PersonalityAudit.cs` (repo dışı, `mcs`/`mono` ile koşar).

## Sonuçlar (kişilik O'nun galibiyeti / varsayılanın / beraberlik)

| Konfig | Kişilik | Varsayılan | Beraberlik | Ort. fark (varsayılan lehine) |
|---|---|---|---|---|
| Kontrol @Dengeli | 39 | 34 | 47 | −0.02 |
| **Kumarbaz** @Dengeli | 31 | 52 | 37 | +0.62 |
| **Kale** @Dengeli | 39 | 33 | 48 | −0.09 |
| Kontrol @Zor | 15 | 21 | 84 | +0.08 |
| **Saldırgan** @Zor | 25 | 25 | 70 | +0.05 |
| Kontrol @Usta | 10 | 18 | 92 | +0.15 |
| **Merkezkaç** @Usta | 14 | 44 | 62 | +0.41 |
| **Kale** @Usta | 9 | 16 | 95 | +0.17 |

## Okumalar ve kararlar

1. **Kumarbaz belirgin zayıf** (bilerek: hamlelerin %35'inde "yumuşak"
   top-3 alternatifi dener). 3. basamağın "2+ fark" koşulu için doğru
   rakip.
2. **Kale gücü korur, beraberliğe sürükler** (Usta'da 95/120). Bu yüzden
   10. basamağın "3+ farkla yen" koşulu Kale'den alınıp **Saldırgan'a**
   verildi: Saldırgan oyunları iki yöne de keskinleştiriyor (Zor'da
   beraberlik 84→70), büyük fark ancak onda gerçekçi.
3. **Merkezkaç Usta'yı somut biçimde zayıflatıyor** (varsayılan 44 galibiyet
   vs kontrol 18) — ilk Usta basamağı (9) için tasarlanmış okunabilir zaaf.
4. **Spesifikasyon sapması:** raporun "LinesPositionalBonus merkez 30→8"
   önerisi probe harness'ında Zor/Usta'da **tek bir hamleyi bile
   değiştirmedi** (merkez çoğunlukla taktiksel zorunlu seçim; çekim asıl
   `ScoreLinesBoard`'daki sahiplik terimi ve açık-çizgi sayımlarından
   geliyor; −300 bonus bile seçimi devirmedi, kırılma −400 ile −800
   arasında). Görünür kişilik için Merkezkaç üç parçayla kuruldu:
   ilk 10 taş boyunca açık merkezi aday listesinden çıkaran açılış kuralı
   (`CenterAvoidPlies=10` — kasıtlı istismar edilebilir zaaf: merkez
   tehdidi kur, görmezden gelsin), kalıcı eğilim `CenterBonus=−120` ve
   `CenterOwnershipMul=0.25` (rastgele orta oyunlarında hamlelerin ~%17'si
   değişiyor, merkez alımı 59→53/120).
5. **Web eşitliği:** varsayılan profil tüm çarpanlarda 1.0 /
   `CenterAvoidPlies=0`; `x * 1.0` IEEE-kesin olduğundan profil verilmeyen
   her çağrı bit-bit eski davranıştır (CoreTests'te tohumlu eşitlik testi).
   Kişilikler yalnız Unity'de ve yalnız Çizgiler'de; Klasik hiçbir profilde
   değişmez.
