# 🐝 Ali Baba'nın Çiftliği

Köy arazisine koyduğumuz oğul yakalama kovanlarını ve mevcut arılıktaki sabit kovanları harita üzerinde takip etmek için geliştirilmiş web uygulaması.

> **⚠️ GÜVENLİK UYARISI:** Bu uygulama kovan konum bilgilerini içerir. Kovan konumları hassas bilgidir ve kötü niyetli kişiler tarafından kovanların çalınması veya zarar verilmesi amacıyla kullanılabilir. **Bu uygulamayı halka açık internette yayınlamayın!** Yalnızca yerel ağda veya güvenli bir şekilde erişim sağlayın. İleride kullanıcı girişi ve yetkilendirme eklenecektir.

## Özellikler

### 🏕️ Oğul Kovanları
- Oğul yakalama kovanlarını haritada takip
- GPS konumu otomatik alma (fotoğraftan EXIF veya tarayıcıdan)
- Durum takibi (Boş, Arı hareketi var, Oğul girdi, vb.)
- Fotoğraf yükleme
- Ulaşım notları

### 🏠 Sabit Arılıklar ve Kovanlar
- Arılık alanlarını kaydetme
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

## Teknolojiler

- **Backend:** Python Flask
- **Veritabanı:** SQLite
- **Frontend:** HTML, CSS, Vanilla JavaScript
- **Harita:** Leaflet + OpenStreetMap
- **Fotoğraf:** Pillow (EXIF GPS okuma)
- **QR Kod:** qrcode kütüphanesi

## Gelecek Planlar

- [ ] Kullanıcı girişi ve yetkilendirme
- [ ] PWA desteği (offline çalışma)
- [ ] CSV / Excel dışa aktarma
- [ ] Offline harita tile desteği
- [ ] Bildirim sistemi (kontrol hatırlatma)

## Lisans

Bu proje özel kullanım içindir.
