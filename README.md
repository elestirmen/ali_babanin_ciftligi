# Ali Baba'nın Çiftliği

Köy arazisindeki oğul yakalama kovanları ile mevcut arılıktaki sabit kovanları harita üzerinde yönetmek ve izlemek için geliştirilmiş tek sunucu (Flask) web uygulaması. Kapadokya/Ürgüp odaklı public bilgilendirme sayfaları, ziyaretçi mesajları ve yönetim paneli tek kod tabanında toplanır.

> **Güvenlik:** Admin paneli kovan/arılık **konum verisi** ve özel kovan fotoğrafları tutar. Public bilgi sayfaları internete açılabilir; admin panelini ise yalnızca güçlü parolaya bırakmayın. Nginx Proxy Manager access list, ek basic auth, VPN veya yerel ağ kısıtı gibi ikinci bir erişim katmanı kullanın. Varsayılan geliştirme şifresi `alibaba`dır; Docker/production modunda güvensiz parolalarla uygulama başlamaz.

---

## İçindekiler

1. [Özellikler](#özellikler)  
2. [Genel mimari](#genel-mimari)  
3. [Hızlı başlangıç (geliştirme)](#hızlı-başlangıç-geliştirme)  
4. [Ortam değişkenleri](#ortam-değişkenleri)  
5. [Docker ve ters vekil (NPM)](#docker-ve-ters-vekil-npm)  
6. [URL özeti (public / korumalı)](#url-özeti-public--korumalı)  
7. [Test](#test)  
8. [Teknolojiler ve bağımlılıklar](#teknolojiler-ve-bağımlılıklar)  
9. [Bilinen sınırlamalar ve ipuçları](#bilinen-sınırlamalar-ve-ipuçları)  
10. [Gelecek planlar](#gelecek-planlar)  
11. [Lisans](#lisans)  

---

## Özellikler

### Public site (parola gerekmez)

- Ana sayfa, `/gunluk` (günlük), `/mesaj-birak` (ziyaretçi mesajı), `/bal-hikayeleri` (bal hikayeleri listesi ve detay).
- Oğul ve sabit kovan **konumları** public tarafta gösterilmez; içerik ve çiftlik özeti amaçlı sayfalar.
- PWA: `manifest` ve `service_worker` ile public sayfalarda temel çevrimdışı destek; `/offline` yedek sayfa.
- Public günlük ve bal hikayesi görselleri `/public-media/...` üzerinden servis edilir.

### Yönetim ve harita (giriş gerekir)

- **Oğul kovanları:** listeleme, ekleme/düzenleme, haritada konum, EXIF veya tarayıcıdan GPS, durum, fotoğraf, ulaşım notları, hızlı durum güncellemesi.
- **Sabit arılıklar ve kovanlar:** arılık alanları, grid/kroki görünümü, kovan detayı, **QR kod** (doğru host ile; aşağıdaki bölüme bakın), kontrol kayıtları ve geçmişi.
- **Harita:** Leaflet, katmanlar (standart, uydu, topografik vb.), filtreler, Google Maps ile yol tarifi, 7 günden eski kontrol uyarıları.
- **API:** `GET /api/map-data` (girişli oturum; harita verisi).
- **Admin:** `/admin` (panel), mesaj yönetimi, içerik ve yazı/bal hikayesi yönetimi.

### Güvenlik özellikleri (uygulama içi)

- Oturum tabanlı giriş; `POST`/`PUT`/`PATCH`/`DELETE` isteklerinde **CSRF** kontrolü.
- Kovan/kontrol fotoğrafları ve QR dosyaları private medya route'ları üzerinden sadece girişten sonra servis edilir.
- Yüklenen görseller Pillow ile yeniden kaydedilir; EXIF/GPS metadata bilgisi dosyada tutulmaz.
- Ters vekil (Nginx Proxy Manager vb.) arkasında `ALI_BABA_PROXY_FIX=1` ile `ProxyFix` etkinleştirilebilir (Docker imajı varsayılan olarak bunu kullanır).

---

## Genel mimari

| Bileşen | Açıklama |
|--------|----------|
| **Sunucu** | Python 3, Flask 3.x |
| **Üretim** | Gunicorn (Docker `CMD` içinde) |
| **Veri** | SQLite (`ALI_BABA_DB_PATH`; Docker’da kalıcı volume önerilir) |
| **Dosyalar** | Private fotoğraflar, QR dosyaları ve public içerik görselleri ayrı klasörlerde (`ALI_BABA_UPLOAD_FOLDER`, `ALI_BABA_QR_FOLDER`, `ALI_BABA_PUBLIC_UPLOAD_FOLDER`) |
| **Ön yüz** | Jinja şablonları, sunucu tarafı formlar, vanilla JS (`static/js/…`), Leaflet harita |

**Önemli dosyalar:** `app.py` (tüm rotalar ve iş kuralları), `init_db.py` (şema + örnek veri), `tests/` (unittest).

---

## Hızlı başlangıç (geliştirme)

**Gereksinim:** Python 3.10+ önerilir (Docker imajı 3.12 kullanır).

```bash
cd ali_babanin_ciftligi
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
python init_db.py
python app.py
```

- Varsayılan: `http://127.0.0.1:5000`  
- Aynı ağdaki telefondan erişim için (QR dahil) örneğin:  
  `ALI_BABA_HOST=0.0.0.0` ve makinenin yerel IP’si üzerinden bağlanın.

**İlk veritabanı:** `init_db.py` yoksa `app.py` tek başına uyarı verir; önce `init_db.py` çalıştırın.

---

## Ortam değişkenleri

| Değişken | Açıklama | Örnek / varsayılan |
|----------|----------|--------------------|
| `ALI_BABA_PASSWORD` | Giriş parolası | Geliştirme: `alibaba` (kod içi varsayılan) — **üretimde değiştirin** |
| `ALI_BABA_SECRET_KEY` | Flask oturum imzası | Rastgele uzun dize; yoksa her başlangıçta yeni üretilir (oturumlar sıfırlanır) |
| `ALI_BABA_HOST` | Geliştirme sunucusu adresi | `127.0.0.1`; ağ erişimi için `0.0.0.0` |
| `ALI_BABA_PORT` | Port | Geliştirme: `5000`; Docker örneği: `51847` |
| `ALI_BABA_DEBUG` | Flask debug | `0` veya `1` |
| `ALI_BABA_DB_PATH` | SQLite dosya yolu | `ali_baba.db` veya `/data/ali_baba.db` |
| `ALI_BABA_UPLOAD_FOLDER` | Private kovan/kontrol fotoğrafları | `uploads` veya Docker’da `/data/uploads` |
| `ALI_BABA_QR_FOLDER` | Private QR çıktıları | `qrcodes` veya Docker’da `/data/qrcodes` |
| `ALI_BABA_PUBLIC_UPLOAD_FOLDER` | Public günlük/bal görselleri | `public_uploads` veya Docker’da `/data/public_uploads` |
| `ALI_BABA_PUBLIC_URL` | Dış domain (opsiyonel) | Son `/` olmadan; mutlak public URL üretmek için |
| `ALI_BABA_PROXY_FIX` | `ProxyFix` (X-Forwarded-*) | Docker’da `1` |
| `ALI_BABA_REQUIRE_SECURE_PASSWORD` | Güvensiz production parolalarını reddeder | Docker’da `1` |
| `GUNICORN_WORKERS` | Gunicorn işçi sayısı | `2` |
| `ALI_BABA_ASSET_VERSION` | Önbellek kırma (opsiyonel) | Boş bırakılırsa dosya mtime’dan türetilir |

**Güvenli gizli anahtar üretme:**

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

**Windows PowerShell (örnek):**

```powershell
$env:ALI_BABA_HOST = "0.0.0.0"
$env:ALI_BABA_PASSWORD = "güçlü-parola"
python app.py
```

---

## Docker ve ters vekil (NPM)

Proje, **Nginx Proxy Manager** ile aynı Docker ağına bağlanacak şekilde örüklüdür. Varsayılan uygulama portu `51847`; NPM’de hedef `ali-baba-ciftligi:51847` olmalıdır.

1. `cp .env.example .env` ve `.env` içinde en az `ALI_BABA_PASSWORD`, `ALI_BABA_SECRET_KEY` (ve isteğe bağlı `ALI_BABA_PUBLIC_URL`, `ALI_BABA_PORT`) doldurun.  
2. NPM ağı yoksa oluşturun: `docker network create npm-net`  
3. `docker compose up -d --build`

Compose, veritabanı, private fotoğraflar, QR kodlar ve public içerik görselleri için named volume'leri otomatik oluşturur.

**Örnek NPM proxy host (metin):**

- Domain: kendi alan adınız  
- Şema: `http` (konteynere)  
- Forward hostname: `ali-baba-ciftligi`  
- Port: `51847`  
- SSL: Let’s Encrypt vb.; “Force SSL” açık olabilir  

`docker-compose.yml` içinde `ALI_BABA_PROXY_FIX=1`, kalıcı DB/yükleme yolları ve `ALI_BABA_REQUIRE_SECURE_PASSWORD=1` tanımlıdır.

**Yerel üretim (Docker olmadan):** `gunicorn` ile `app:app` bağlayın; ortam değişkenlerini ve `init_db` ilk kurulumu unutmayın.

---

## URL özeti (public / korumalı)

| Alan | Örnek yollar |
|------|----------------|
| **Public** | `/`, `/mesaj-birak`, `/gunluk`, `/bal-hikayeleri`, `/bal-hikayeleri/<id>`, `/public-media/<dosya>`, `/offline`, `/manifest.webmanifest`, `/sw.js` |
| **Giriş** | `/login`, `/logout` |
| **Panel** | `/admin`, `/admin/messages`, `/admin/content`, `/admin/posts`, `/admin/honey-stories` … |
| **Harita / veri (oturum gerekir)** | `/admin/hives` ve oğul–arılık–kovan rotaları, `/media/uploads/<dosya>`, `/media/qrcodes/<dosya>`, `GET /api/map-data` |

Tam rota listesi `app.py` içindeki `@app.route` tanımlarında.

---

## Test

```bash
python -m unittest discover -s tests
```

---

## Teknolojiler ve bağımlılıklar

- **Flask** 3.x, **Gunicorn** (üretim)  
- **SQLite** 3 (stdlib + `sqlite3`)  
- **Pillow** (EXIF’ten GPS), **qrcode**  
- **Leaflet** + döşeme kaynakları (OpenStreetMap ve ek katmanlar)  

`requirements.txt` kilitli sürümleri listeler.

---

## Bilinen sınırlamalar ve ipuçları

- **QR kod:** URL’ler `request.host_url` / `ALI_BABA_PUBLIC_URL` ile üretilir. Uygulamayı yalnızca `http://localhost:…` ile açarsanız, telefondan taranan QR’da `localhost` cihazın kendisine gider; **çalışmaz**. Aynı Wi‑Fi’de test için `http://192.168.x.x:port` veya `ALI_BABA_PUBLIC_URL` ile dışarıdan erişilebilir gerçek bir adres kullanın.  
- **Güvenlik modeli:** Tek parola; çoklu kullanıcı veya ayrıntılı rol yoktur. Hassas veri için ek katman (VPN, ağ kısıtı, HTTP Basic veya ters vekilde ek koruma) düşünün.  
- **PWA:** Public tarafta temel destek vardı; “tam offline uygulama” seviyesi gelecekte genişletilebilir (bkz. aşağı).

---

## Gelecek planlar

- [ ] Kullanıcı yönetimi ve daha ayrıntılı yetkilendirme  
- [ ] PWA / çevrimdışı deneyimini genişletme (daha kapsamlı cache ve senkron)  
- [ ] CSV / Excel dışa aktarma  
- [ ] Harita karo (tile) çevrimdışı veya kendi karo sunucusu  
- [ ] Bildirim veya e‑posta hatırlatma (kontrol tarihleri)  

---

## Lisans

Bu proje özel kullanım içindir.
