# Terminal AI'ya verilecek promptlar

Her blok tek başına yeterlidir — sırayla ver, birini bitirmeden ötekine geçme.
Sonlarında **SEN** yazan adımlar otomatikleşmez (tarayıcı, konsol, parola
gerektirir); onları kendin yaparsın.

---

## 1 — Site metinlerini doldur

> `~/Projects/puffychat-site` klasöründe statik bir web sitesi var. Dört HTML
> dosyasında (`index.html`, `gizlilik/index.html`, `hesap-silme/index.html`,
> `destek/index.html`) `[ŞİRKET UNVANI]` ve `[ADRES]` yer tutucuları geçiyor.
> Bunları şu değerlerle değiştir:
>
> - ŞİRKET UNVANI: «buraya şirketin tam unvanını yaz»
> - ADRES: «buraya açık adresi yaz»
>
> Değiştirdikten sonra hiçbir dosyada `[ŞİRKET` ya da `[ADRES` kalmadığını
> `grep -rn` ile doğrula ve bana göster. Başka hiçbir şeyi değiştirme.

---

## 2 — Depoyu oluştur ve yayına al

> `~/Projects/puffychat-site` klasöründeki statik siteyi GitHub Pages'te
> yayınla. Adımlar:
>
> 1. Klasörde git deposu başlat, hepsini commit et (`main` dalı).
> 2. `gh` CLI kuruluysa ve girişliyse, `gh repo create puffychat-site --public
>    --source=. --remote=origin --push` ile depoyu oluştur ve gönder.
>    `gh` yoksa dur ve bana söyle — depoyu ben elle açacağım.
> 3. Depo oluştuktan sonra GitHub Pages'i `main` dalının kökünden yayınla
>    (`gh api -X POST repos/:owner/puffychat-site/pages -f source[branch]=main
>    -f source[path]=/` ya da eşdeğeri).
> 4. Bittiğinde bana depo URL'sini ve geçici Pages adresini
>    (`<kullanici>.github.io/puffychat-site` ya da özel alan adı) yaz.
>
> Klasörde zaten `CNAME` (puffychat.com) ve `.nojekyll` dosyaları var,
> onlara dokunma.

---

## 3 — SEN: Namecheap DNS

Bu otomatikleşmiyor, Namecheap panelinden elle yapacaksın.

`puffychat.com` → Advanced DNS. **Mevcut MX ve TXT kayıtlarına DOKUNMA** —
e-posta zinciri (SPF, DKIM, DMARC) onlarda.

Eklenecekler:

| Tip   | Host | Değer                  |
|-------|------|------------------------|
| A     | @    | 185.199.108.153        |
| A     | @    | 185.199.109.153        |
| A     | @    | 185.199.110.153        |
| A     | @    | 185.199.111.153        |
| CNAME | www  | `<kullanici>.github.io.` |

Kayıtlar yayıldıktan sonra GitHub → Settings → Pages → **Enforce HTTPS**.

---

## 4 — SEN: Firebase hesabı tarafı

Terminal AI bunu yapamaz, tarayıcı ve Google girişi gerekiyor.

1. `npm i -g firebase-tools`
2. `firebase login` (tarayıcı açılır)
3. Firebase konsolu → puffy-app-25f93 projesi → **App Distribution**'ı etkinleştir
4. **Testers & groups** → yeni grup: `testciler`
5. O grupta **Invite links** sekmesi → yeni davet bağlantısı üret
6. Linki arkadaşlarına ver (bir kez "bilinmeyen kaynaklara izin" isteyecek)

---

## 5 — İlk test sürümünü dağıt

> `~/Projects/puffy` Flutter projesinde `scripts/dagit.sh` adında bir dağıtım
> script'i var: sürüm numarasını artırır, release APK derler ve Firebase App
> Distribution ile `testciler` grubuna gönderir.
>
> Önce ön koşulları doğrula: `flutter` ve `firebase` komutları PATH'te mi,
> `firebase login:list` girişli bir hesap gösteriyor mu, `android/key.properties`
> var mı. Eksik varsa dur ve bana söyle.
>
> Hepsi tamamsa script'i çalıştır: `./scripts/dagit.sh "ilk test sürümü"`.
> Çıktıyı bana göster. Hata olursa script'i değiştirme, hatayı bana anlat.

---

## 6 — Değişiklikleri derlemeden önce doğrula

> `~/Projects/puffy` Flutter projesinde bugün şu dosyalar değişti:
> `lib/features/room/room_screen.dart`, `lib/core/services/auth_service.dart`,
> `lib/core/services/room_members_service.dart`,
> `lib/features/profile/profile_detail_screen.dart`,
> `lib/features/profile/widgets/profile_avatar.dart`.
>
> `flutter analyze` çalıştır ve YALNIZ bu dosyalarla ilgili hata/uyarıları
> bana raporla. Projede başka birçok dosyada eskiden kalma uyarılar olabilir,
> onları listeleme. Hiçbir dosyayı kendiliğinden düzeltme — önce bana göster.
