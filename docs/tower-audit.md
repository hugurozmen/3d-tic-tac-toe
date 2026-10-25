# Kule (Yerçekimi) Modu Denge Auditi

**Soru** (tasarım raporu §3.1 `[DOĞRULANMALI]`): *"Sütun kısıtı açılış
avantajını törpüler"* hipotezi doğru mu?

**Yöntem:** `docs/komi-audit.md` ile aynı harness; `Ai.ChooseMove(...,
gravity: true)` ile ayna self-play, açıcı dönüşümlü. Deterministik
zorluklarda (Zor/Usta) ilk hamle 9 yasal taban hücresinde sırayla zorlandı.

## Sonuçlar

| Set | Oyun | Açıcı kazanma % (karar veren) | Beraberlik % | Açıcı genel % (beraberlik=0,5) |
|---|---:|---:|---:|---:|
| Kule-Çizgiler Dengeli | 300 | %19,3 (274) | %8,7 | **%22,0** |
| Kule-Çizgiler Zor (zorunlu) | 108 | %11,1 (108) | %0,0 | %11,1 |
| Kule-Çizgiler Usta (zorunlu) | 54 | %0,0 (24) | %55,6 | %27,8 |
| Kule-Klasik Dengeli | 300 | %88,3 (300) | %0,0 | **%88,3** |
| Kule-Klasik Zor (zorunlu) | 108 | %100,0 (108) | %0,0 | %100,0 |
| Kule-Klasik Usta (zorunlu) | 54 | %77,8 (54) | %0,0 | %77,8 |

## Bulgular

1. **Hipotez Çizgiler'de fazlasıyla doğru çıktı — avantaj tersine döndü:**
   Kule-Çizgiler'de karar veren oyunların büyük çoğunluğunu **ikinci
   oyuncu** kazanıyor (açıcı genel payı %11-28). Sütun yapısında her
   yığının "cevap taşı" güçlü: rakibin taşının üstüne oturan taş aynı
   dikey/çapraz hatları keserken kendi hatlarını açıyor. Ayrıca serbest
   Çizgiler'in %24-33'lük beraberlik deliği Kule'de Dengeli'de %8,7'ye
   düşüyor — tur neredeyse her zaman kazananla bitiyor.
2. **Kule-Klasik'te açıcı hâlâ ezici** (%78-100, hiç beraberlik yok).
   Sütun kısıtı Klasik'in "ilk tehdit zinciri kazanır" doğasını
   değiştirmiyor; üstelik Kule'de Pie kuralı da yok.
3. Usta-Çizgiler'in %55,6 beraberliği küçük/zorunlu örneklemde; serbest
   açılışlı gerçek oyunlarda Dengeli satırı daha temsilidir.

## Karar

- **Kule-Çizgiler olduğu gibi yayında kalsın:** düşük beraberlik + taraf
  avantajının yönü oyuncular arasında maçtan maça **açılış rotasyonuyla**
  (uygulandı) eşitleniyor. "İkinci oyuncu avantajlıdır" bilgisi kural
  açıklamasına eklenebilir (bilenler için meta, bilmeyen için sürpriz
  değil — düşük öncelik).
- **Kule-Klasik için not:** açıcı avantajı serbest Klasik'teki kadar sert
  ve pie yok. Rotasyon maç düzeyinde adaleti sağlıyor; tur düzeyinde
  istenirse ileride "Kule-Pie" (ilk düşen taştan sonra taraf değişimi
  teklifi) ölçülüp eklenebilir — şimdilik kapsam dışı.
- Rapor §2.5 kıstasına göre hiçbir Kule seti %45-55 bandında değil; ancak
  bandın amacı *tek turluk adalet*ti ve rotasyon + Bo3/Bo5 formatları bu
  riski taşıyor. Varsayılan mod değişmedi (Çizgiler).

**Harness:** `TowerAudit` — Core dosyalarıyla `mcs` ile derlenen tek
dosyalık konsol programı (komi auditi kalıbının aynısı).
