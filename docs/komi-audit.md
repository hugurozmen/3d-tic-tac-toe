# Çizgiler "Açılış Komisi" Denge Auditi

**Soru** (tasarım raporu §2.3 / yol haritası #7): *"Tahta dolduğunda skorlar
eşitse turu açılışı yapmayan oyuncu kazanır"* (komi) kuralı Çizgiler'i
dengeler mi ve varsayılan yapılmalı mı?

**Yöntem:** Unity portunun saf C# çekirdeği (`unity/Assets/TicTacube/Scripts/Core/`,
web `ai.ts`/`rules.ts`'in doğrulanmış birebir portu) üzerinde mono konsol
harness'ı ile ayna self-play. Açıcı her oyunda dönüşümlü; "komi" sütunu aynı
oyunların beraberlikleri açılmayana yazılarak yeniden puanlanır (komi AI'nın
oyun içi kararlarını değiştirmez, yalnız hükmü değiştirir — bu yüzden aynı
oyun kümesi iki kuralla da puanlanabilir). Deterministik zorluklar (Zor/Usta)
serbest açılışta tek yörüngeye çöktüğü için web harness'ının `forcedOpenings`
tekniğiyle ilk hamle 27 hücrede sırayla zorlanan ek setler koşuldu.

## Sonuçlar

| Set | Oyun | Açıcı kazanma % (mevcut, karar veren oyunlar) | Beraberlik % | Açıcı kazanma % (komi, tüm oyunlar) |
|---|---:|---:|---:|---:|
| Dengeli, serbest açılış | 400 | **%99,3** (303 karar veren) | %24,3 | %75,3 |
| Dengeli, zorunlu açılışlar | 216 | %66,7 (120) | %44,4 | %37,0 |
| Zor, zorunlu açılışlar | 216 | %11,1 (72) | %66,7 | %3,7 |
| Usta, zorunlu açılışlar | 108 | %100,0 (60) | %44,4 | %55,6 |

## Okuma notları

- **Serbest açılış satırı gerçek oyuna en yakın olandır:** açıcı kendi en iyi
  hamlesini seçer. Dengeli'de karar veren turların %99'unu açıcı alıyor —
  açıcı avantajı rapordaki tahminden de sert.
- **Zorunlu açılış setleri alt sınırdır:** ilk hamle kasıtlı kötü hücrelere de
  zorlandığı için açıcıyı cezalandırır (Zor'daki %11 bunun ürünü: savunmacı
  AI kötü açılışı affetmiyor). Gerçek değer iki ölçümün arasındadır.
- **Komi beraberlik deliğini tamamen kapatıyor** (%24-67 → %0) ve açıcı
  avantajını ciddi törpülüyor (Dengeli serbest: ~%87 skor payından %75 kazanma
  payına; Usta zorunlu: %100 → %55,6).
- Ama **tek başına %45-55 denge bandına sokmuyor** (Dengeli serbest %75,3) ve
  Zor profilinde ters yöne taşırabiliyor (%3,7 — zorunlu-açılış yanlılığıyla
  birlikte okunmalı).

## Karar

1. **Komi varsayılan OLMASIN.** Denge bandı kriterini tek başına tutturmuyor
   ve zorluk profiline göre savrulma riski var.
2. Maçlar arası **açılış rotasyonu** (sprint'te uygulandı) varsayılan seviyede
   kalan adalet düzeltmesidir: avantaj sıfırlanmaz ama iki oyuncuya eşit
   dağıtılır.
3. Komi, raporun **"Turnuva Çizgileri"** paketinde (§3.2) merkez-normalize
   çizgi ağırlığıyla birlikte sunulsun: komi beraberliği bitirir, merkez
   ağırlığı açılış avantajının ana kaynağını (merkezli hatlar) inceltir;
   paket yayınlanmadan önce aynı harness'la birlikte ölçülmeli.

**Harness:** tek dosyalık C# konsol programı; Core dosyalarıyla `mcs` ile
derlenir. Yeniden koşmak için rapor §2.5'teki kalıp yeterlidir.
