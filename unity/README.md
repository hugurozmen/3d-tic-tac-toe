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

- **Çizgiler** (varsayılan) ve **Klasik** kural setleri
- **Tek oyuncu** (4 zorluk: Kolay / Dengeli / Zor / Usta — web ile aynı AI)
  ve **iki oyuncu** (aynı cihazda) modları
- **5 turluk maç** (3 tur kazanan maçı alır, açılış sırası dönüşümlü)
- Mobil kontroller: tek parmak sürükleme ile **kamera döndürme**, iki parmak
  ile **yakınlaştırma**, dokunarak **hamle**
- Tamamlanan çizgiler için ışın efekti, kazanan çizgi vurgusu
- Türkçe / İngilizce arayüz (cihaz diline göre otomatik)
- AI arka plan iş parçacığında çalışır; arayüz hiç takılmaz

Sahne, tahta ve arayüz tamamen çalışma anında kodla kurulur
(`GameBootstrap` → `GameController`); prefab veya sahne bağlantısı
gerekmez, bu yüzden birleştirme çatışması riski düşüktür.

## Henüz portlanmayanlar (yol haritası)

- Online odalar (WebSocket sunucusu `server/online-server.mjs` ile konuşan
  bir C# istemcisi gerekir)
- Günlük bulmaca, Koç modu, joker/güç sistemleri, öğretici
- Pie Rule arayüzü (çekirdekte hazır: `Ai.ShouldSwapClassicPie`,
  `MatchState.RemapForSideSwap`)

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
| `Scripts/Game/GameHud.cs` | Çalışma anında kurulan menü/HUD (uGUI) |
| `Scripts/Game/GameStrings.cs` | TR/EN metinler |

`Scripts/Core/` hiçbir Unity API'si kullanmaz; web sürümüyle davranış
eşitliği, depo dışında derlenen birim testleriyle doğrulanmıştır (49 hat,
kural değerlendirmeleri, AI'nin kazanma/engelleme hamleleri, maç akışı).
