# 🐝 Ali Baba'nın Çiftliği

Köy arazisine koyduğumuz oğul yakalama kovanlarını ve mevcut arılıktaki sabit kovanları harita üzerinde takip etmek için geliştirilmiş web uygulaması.

> **⚠️ GÜVENLİK UYARISI:** Bu uygulama kovan konum bilgilerini içerir. Kovan konumları hassas bilgidir ve kötü niyetli kişiler tarafından kovanların çalınması veya zarar verilmesi amacıyla kullanılabilir. **Bu uygulamayı halka açık internette yayınlamayın!** Uygulamada basit parola girişi vardır; varsayılan şifre `alibaba`dır.

## Özellikler

### 🏕️ Oğul Kovanları
- Oğul yakalama kovanlarını haritada takip
- GPS konumu otomatik alma (fotoğraftan EXIF veya tarayıcıdan)
- Haritadan tıklayarak konum seçme
- Durum takibi (Boş, Arı hareketi var, Oğul girdi, vb.)
- Fotoğraf yükleme
- Ulaşım notları

### 🏠 Sabit Arılıklar ve Kovanlar
- Arılık alanlarını kaydetme
- Arılık konumunu haritadan seçme
- Her arılığa bağlı sabit kovanları yönetme
- Arılık krokisi görünümü (grid layout)
- QR kod üretimi (kovan detayına hızlı erişim)

### 📋 Kontrol Kayıtları
- Her sabit kovan için detaylı kontrol kaydı
- Arı yoğunluğu, yavru durumu, bal durumu, polen gelişi
- Ana arı gözlemi, hastalık belirtileri, saldırganlık
- Besleme ve ilaçlama kayıtları
- Kontrol geçmişi görüntüleme

### 📱 QR Kod Kullanımı
- QR kod üretimi `request.host_url` ile çalışır.
- **Önemli:** Eğer uygulamayı `localhost` üzerinden açıp QR kod üretirseniz, telefonla taradığınızda QR kod çalışmaz çünkü telefonunuz `localhost`u kendi cihazı olarak algılar.
- Telefonla QR kod kullanmak için uygulamaya **yerel IP adresi** üzerinden girin (örn: `http://192.168.1.96:5000`). Böylece QR kodlar da bu IP ile üretilir ve aynı ağdaki telefondan taranabilir.

### 🗺️ Harita
- Tüm kovanlar Leaflet haritasında
- Standart, uydu, topografya ve açık ton harita katmanları
- Katman kontrolü (oğul kovanları, sabit arılıklar, kontrol gerekenler, pasifler)
- Duruma göre renkli markerlar
- Google Maps ile yol tarifi
- 7 günden eski kontrol uyarıları

## Kurulum

### Linux / macOS
```bash
cd ali_babanin_ciftligi
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python init_db.py
python app.py
```

### Windows
```cmd
cd ali_babanin_ciftligi
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
python init_db.py
python app.py
```

Uygulama `http://localhost:5000` adresinde çalışacaktır.

## Docker ve Nginx Proxy Manager ile Yayın

Bu repo, Nginx Proxy Manager ile aynı Docker ağına bağlanacak şekilde
hazırlanmıştır. Varsayılan uygulama portu `51847`'dir ve NPM proxy host hedefi
`ali-baba-ciftligi:51847` olmalıdır.

```bash
cp .env.example .env
python - <<'PY'
import secrets
print("ALI_BABA_SECRET_KEY=" + secrets.token_hex(32))
PY
```

`.env` içinde en az şu değerleri ayarlayın:

```bash
ALI_BABA_PASSWORD=guclu-bir-parola
ALI_BABA_SECRET_KEY=uzun-rastgele-bir-deger
ALI_BABA_PUBLIC_URL=https://alibaba.urgup.keenetic.link
ALI_BABA_PORT=51847
```

Ardından:

```bash
docker compose up -d --build
```

NPM tarafında proxy host:

```text
Domain: alibaba.urgup.keenetic.link
Scheme: http
Forward Hostname/IP: ali-baba-ciftligi
Forward Port: 51847
SSL: Let's Encrypt, Force SSL açık
```

## Giriş ve Ayarlar

- Varsayılan giriş şifresi: `alibaba`
- Varsayılan çalışma adresi: `127.0.0.1:5000`
- Telefonda QR kod kullanmak için aynı ağda çalıştırırken host değerini yerel ağa açın.

### Ortam değişkenleri

```bash
ALI_BABA_PASSWORD=alibaba
ALI_BABA_SECRET_KEY=uzun-rastgele-bir-deger
ALI_BABA_HOST=127.0.0.1
ALI_BABA_PORT=5000
ALI_BABA_DEBUG=0
ALI_BABA_DB_PATH=ali_baba.db
```

Windows PowerShell örneği:

```powershell
$env:ALI_BABA_HOST = "0.0.0.0"
$env:ALI_BABA_PASSWORD = "alibaba"
python app.py
```

## Test

```bash
python -m unittest discover -s tests
```

## Teknolojiler

- **Backend:** Python Flask
- **Veritabanı:** SQLite
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Harita:** Leaflet + OpenStreetMap
- **Fotoğraf:** Pillow (EXIF GPS okuma)
- **QR Kod:** qrcode kütüphanesi

## Gelecek Planlar

- [ ] Kullanıcı yönetimi ve daha ayrıntılı yetkilendirme
- [ ] PWA desteği (offline çalışma)
- [ ] CSV / Excel dışa aktarma
- [ ] Offline harita tile desteği
- [ ] Bildirim sistemi (kontrol hatırlatma)

## Lisans

Bu proje özel kullanım içindir.
