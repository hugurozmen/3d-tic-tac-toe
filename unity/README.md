# TicTacube — Unity Mobil Port

Web'deki TicTacube'un (3x3x3 XOX) Unity ile yazılmış native mobil sürümü.
Çekirdek oyun mantığı (`Assets/TicTacube/Scripts/Core/`) web sürümündeki
`src/game/rules.ts`, `src/game/ai.ts` ve `src/game/match.ts` dosyalarının
birebir portudur; yapay zeka web'dekiyle aynı hamleleri oynar.

> Not: Bu depo zaten Capacitor ile paketlenmiş durumda (`android/` ve `ios/`
> klasörleri). Tüm özelliklerle (online odalar, günlük bulmaca, koç...)
> hızlı bir mobil sürüm istiyorsanız `npm run mobile:sync` yolu yeterlidir.
> Bu Unity portu, tam native performans ve native oyun hissi isteyen senaryo
> içindir.

## Bu portta neler var

Oyun ve arayüz, 5 farklı oyuncu personasıyla yapılan playtest geri
bildirimlerine göre geliştirildi (casual, stratejist, çocuk, "juice" odaklı
genç oyuncu ve erişilebilirlik ihtiyaçları olan oyuncu).

### Oyun

- **Dört kural seçeneği**: Çizgiler (varsayılan), Klasik ve ikisinin
  **Kule** varyantları — Kule'de taşlar sütuna bırakılır ve Connect-4 gibi
  en alttaki boş hücreye düşer (her an en çok 9 hedef; iç hücrelere kamera
  döndürme derdi kuralla ortadan kalkar). Sütunun herhangi bir hücresine
  dokunmak yeter, taş düşüş animasyonuyla yerine oturur. Kule'de Pie
  kuralı yoktur ve istatistikler ayrı tutulur. Menüde seçili kuralın tek
  cümlelik açıklaması gösterilir (Kule yalnız yerel modlarda — online
  sunucusu kural setini sabitler)
- **Günlük Bulmaca**: tarih-tohumlu, web sürümüyle aynı gün aynı bulmaca
  (4 tür rotasyonu: en iyi Çizgiler hamlesi / maks çizgi / Klasik kazanç /
  iki hamlede kazanç); günde tek deneme sayılır, sonrası pratik; bulmaca
  serisi ve paylaş-kopyala
- **Açılış rotasyonu**: yerel maçlarda açılış hakkı maçtan maça dönüşümlü
  (açıcının ölçülü bir avantajı var — istatistikler artık taraflı değil)
- **Liderlik anlatısı + Son-6 bandı** (Çizgiler): öne geçişlerde anlık
  bildirim; son 6 hücrede "Son N: +S şans ve B blok canlı" gerilim şeridi
- **Online odalar**: web sürümüyle aynı WebSocket oda sunucusuna
  (`server/online-server.mjs`) bağlanır — oda kur, 5 haneli kodla katıl,
  kopan bağlantıda oturum kimliğiyle otomatik/elle yeniden bağlan; sunucu
  otoritedir (hamleler sunucuda doğrulanır), best-of-5 maç akışı ve her
  iki kural seti desteklenir. Web istemcisiyle karşılıklı oynanabilir.
- **Tek oyuncu** (4 zorluk: Kolay / Dengeli / Zor / Usta — web ile aynı AI)
  ve **iki oyuncu** (aynı cihazda) modları
- **Maç uzunluğu seçimi**: tek tur, 2 galibiyet veya 3 galibiyet; açılış
  sırası dönüşümlü
- **Pie Rule** (Klasik): ilk hamleden sonra rakip taraf değişimi
  isteyebilir; AI da web'dekiyle aynı eşiklerle karar verir
- **İstatistik ve seri**: zorluk + kural seti başına galibiyet/mağlubiyet/
  beraberlik, güncel ve en iyi seri (cihazda saklanır; beraberlik seriyi
  bozmaz)
- **Kaldığın yerden devam**: maç durumu her hamlede kaydedilir; uygulama
  kapansa bile menüden sürdürülür
- **Rehberli ilk tur**: ilk oyunda adım adım ipucu çubuğu; kurallar oyun
  içinde öğrenilir
- **Analiz modu** (aç/kapa): engellemen gereken hücreler kırmızı, puan
  getirecek hücreler yeşil ipucu küpleriyle gösterilir; küp boyutu hücrenin
  tamamladığı çizgi sayısıyla büyür (çoklu-çizgi kill-move'lar ayırt edilir)
  ve seçim sırasında "bu hamle rakibe N çizgi bırakıyor" uyarısı verilir

### Kontroller ve erişilebilirlik

- Tek parmak sürükleme ile **kamera döndürme** (titrek el dostu ölü bölge),
  iki parmak ile **yakınlaştırma**
- **Seç-onayla hamle akışı**: önce hücreyi seç, sonra iri Onayla düğmesine
  bas (menüden "Hızlı hamle" ile tek dokunuşa dönebilir)
- **Geri Al** düğmesi (tek oyunculuda insan+AI hamlesini çift olarak alır)
- **Katmanlar** düğmesi: tahtayı kat kat açan patlatılmış görünüm — iç
  hücrelere kamera döndürmeden erişim
- Işınlar **şekille de kodlu**: X çizgileri kare kesitli, O çizgileri
  yuvarlak (renk körlüğü için); yeni ışın gelince eskiler soluklaşır
- Katman başına ton farkı + kat çerçeveleri ile derinlik okuması
- Sarsıntı/yanıp sönme efektleri **Efektler** anahtarıyla kapatılabilir

### Görsel / ses geri bildirimi

- Taş yerleştirmede **pop animasyonu**, son hamlede **renkli halka + kısa
  yanıp sönme** (rakibin hamlesini aramazsın)
- Çizgi tamamlandığında **"+1" uçan yazı**; tek hamlede çoklu çizgide
  büyük bonus yazısı + hafif kamera sarsıntısı
- **Prosedürel sesler** (dosyasız, çalışma anında üretilir): dokunma tıkı,
  çizgi çını, tur/maç fanfarı; çizgi tamamlamada titreşim
- Tur/maç kazanınca **konfeti**; kaybedince teselli mesajı ("Yine de N
  çizgi tamamladın!")
- Sonuç paneli ~1,5 sn gecikir ve hafif karartmayla gelir: kazanan ışınlar
  önce tahtada **pulse** yapar; **Tahtaya Bak** düğmesiyle panel gizlenip
  son konum incelenebilir
- Sıra göstergesi oyuncunun renginde; ekranın üstünde aynı renkte ince
  şerit; skor yazıları büyük puntolu ve konturlu; çizgi skoru tek tek
  sayarak güncellenir ve kısa altın parlamayla vurgulanır; "Rakip
  düşünüyor…" yazısı canlı nokta animasyonlu
- Türkçe / İngilizce arayüz (cihaz diline göre otomatik, menüden
  değiştirilebilir ve hatırlanır)
- AI arka plan iş parçacığında çalışır; arayüz hiç takılmaz

Sahne, tahta ve arayüz tamamen çalışma anında kodla kurulur
(`GameBootstrap` → `GameController`); prefab veya sahne bağlantısı
gerekmez, bu yüzden birleştirme çatışması riski düşüktür.

## Henüz portlanmayanlar (yol haritası)

- Günlük bulmaca, joker/güç sistemleri, tema seçimi

## Online mod notları

- Menüde Mod'u **Online Oda** yapınca sunucu adresi ve oda kodu alanları
  açılır. Oda kurunca kod ekran ortasında büyük puntoyla gösterilir ve
  **Kodu Kopyala** ile panoya alınır; maç bitiminde **Rövanş** akışı iki
  taraftan da başlatılabilir. Varsayılan adres `ws://127.0.0.1:8787` (editörde yerel test
  için); gerçek cihazda kendi sunucunun adresini yaz (ör.
  `wss://sunucun.example`). Adres cihazda hatırlanır.
- Yerel test: depoda `npm run online:server` ile sunucuyu başlat, Unity
  editöründe bir istemci + tarayıcıda web istemcisiyle (veya ikinci bir
  editör/cihazla) aynı odaya bağlan.
- Online'da Geri Al, Analiz ve Pie Rule kapalıdır (sunucu kuralları:
  Bo5, pie off); tur/maç sıfırlamayı iki taraf da tetikleyebilir.
- Taşıma katmanı `System.Net.WebSockets.ClientWebSocket` kullanır:
  Android/iOS (IL2CPP dahil) desteklenir, WebGL desteklenmez.

## Projeyi açma

1. Unity Hub → **Add** → bu `unity/` klasörünü seçin.
2. Unity **2021.3 LTS veya üzeri** ile açın (2022.3 LTS önerilir; proje
   2022.3.45f1 ile işaretlidir, farklı sürüm seçerseniz Unity otomatik
   yükseltir).
3. Açılınca `Assets/TicTacube/Scenes/Main.unity` sahnesini açıp **Play**'e
   basın. (Sahne bozuk görünürse boş bir sahne de yeterlidir — oyun
   `RuntimeInitializeOnLoadMethod` ile her sahnede kendini kurar.)

Editörde test: fare ile sürükleyip döndürün, tekerlekle yakınlaşın,
tıklayarak hamle yapın.

## Android derlemesi

1. Unity Hub'dan editöre **Android Build Support** modülünü ekleyin
   (OpenJDK + SDK/NDK dahil).
2. **File → Build Settings → Android → Switch Platform**.
3. **Edit → Project Settings → Player**:
   - Company Name / Product Name doldurun,
   - **Other Settings → Identification**: Package Name (ör.
     `com.sirketiniz.tictacube`), Minimum API Level 24+,
   - **Resolution and Presentation**: Default Orientation = Portrait
     (önerilir; arayüz dikey için tasarlandı).
4. **Build** (test için APK) veya **Build App Bundle** (Play Store için AAB,
   Player Settings'te keystore imzası gerekir).

## iOS derlemesi

1. Editöre **iOS Build Support** modülünü ekleyin (derleme için macOS +
   Xcode şarttır).
2. **File → Build Settings → iOS → Switch Platform → Build** ile Xcode
   projesi üretin.
3. Xcode'da Signing & Capabilities altında Team seçin, Bundle Identifier
   girin, cihazda çalıştırın / arşivleyip TestFlight'a yükleyin.

## Kod haritası

| Dosya | Görev |
| --- | --- |
| `Scripts/Core/WinningLines.cs` | 49 kazanma hattının üretimi ve doğrulaması |
| `Scripts/Core/Rules.cs` | Tahta değerlendirme, tehditler (saf C#) |
| `Scripts/Core/Ai.cs` | İki kural seti için AI (web `ai.ts` birebir port) |
| `Scripts/Core/Match.cs` | 5 turluk maç durumu |
| `Scripts/Game/GameBootstrap.cs` | Sahneyi kodla kuran giriş noktası |
| `Scripts/Game/GameController.cs` | Oyun akışı, AI iş parçacığı |
| `Scripts/Game/BoardView.cs` | 3B tahta, işaretler, çizgi ışınları |
| `Scripts/Game/CameraOrbit.cs` | Dokunmatik kamera + hamle algılama |
| `Scripts/Game/GameHud.cs` | Çalışma anında kurulan menü/HUD/sonuç/pie arayüzü (uGUI) |
| `Scripts/Game/GameAudio.cs` | Prosedürel sesler + titreşim |
| `Scripts/Game/GamePrefs.cs` | Ayarlar, istatistikler, maç kaydı (PlayerPrefs) |
| `Scripts/Game/GameStrings.cs` | TR/EN metinler |
| `Scripts/Online/MiniJson.cs` | Protokol için küçük JSON ayrıştırıcı/yazıcı |
| `Scripts/Online/OnlineProtocol.cs` | Oda protokolü mesaj/snapshot modelleri |
| `Scripts/Online/OnlineClient.cs` | WebSocket istemcisi: oda akışı, aksiyon zarfları, yeniden bağlanma |

`Scripts/Core/` ve `Scripts/Online/` hiçbir Unity API'si kullanmaz; web
sürümüyle davranış eşitliği depo dışında derlenen birim testleriyle, online
istemci ise **gerçek oda sunucusuna karşı** uçtan uca testlerle doğrulanmıştır
(oda kurma/katılma, hamle/ret senaryoları, tur-maç sıfırlama, oturum devralma,
sunucu skorlarının çekirdek kurallarla birebir tutması).
