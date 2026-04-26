"""
Ali Baba'nin Ciftligi - Veritabani Baslatma Scripti
Bu script calistirildiginda SQLite veritabanini olusturur ve ornek veriler ekler.
Ornek koordinatlar Urgup/Nevsehir civaridir.
"""

import sqlite3
import os
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'ali_baba.db')


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def create_tables():
    conn = get_db()
    cursor = conn.cursor()

    # Ogul kovanlari tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS swarm_hives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ad TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            kurulum_tarihi TEXT,
            son_kontrol_tarihi TEXT,
            durum TEXT DEFAULT 'Boş',
            ulasim_notu TEXT,
            genel_not TEXT,
            fotograf_yolu TEXT,
            aktif INTEGER DEFAULT 1,
            olusturma_tarihi TEXT DEFAULT (datetime('now', 'localtime')),
            guncelleme_tarihi TEXT DEFAULT (datetime('now', 'localtime'))
        )
    ''')

    # Sabit ariliklar tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS apiaries (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            arilik_adi TEXT NOT NULL,
            latitude REAL,
            longitude REAL,
            aciklama TEXT,
            olusturma_tarihi TEXT DEFAULT (datetime('now', 'localtime')),
            guncelleme_tarihi TEXT DEFAULT (datetime('now', 'localtime'))
        )
    ''')

    # Sabit kovanlar tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS fixed_hives (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            arilik_id INTEGER NOT NULL,
            kovan_no TEXT NOT NULL,
            sira_no INTEGER DEFAULT 1,
            konum_no INTEGER DEFAULT 1,
            ana_ari_yili INTEGER,
            kat_sayisi INTEGER DEFAULT 1,
            cerceve_sayisi INTEGER DEFAULT 10,
            durum TEXT DEFAULT 'Orta',
            son_kontrol_tarihi TEXT,
            genel_not TEXT,
            fotograf_yolu TEXT,
            qr_kod_yolu TEXT,
            aktif INTEGER DEFAULT 1,
            olusturma_tarihi TEXT DEFAULT (datetime('now', 'localtime')),
            guncelleme_tarihi TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (arilik_id) REFERENCES apiaries(id) ON DELETE CASCADE
        )
    ''')

    # Kontrol kayitlari tablosu
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS inspections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            kovan_id INTEGER NOT NULL,
            kontrol_tarihi TEXT NOT NULL,
            ari_yogunlugu TEXT DEFAULT 'Orta',
            yavru_durumu TEXT DEFAULT 'Normal',
            bal_durumu TEXT DEFAULT 'Orta',
            polen_gelisi TEXT DEFAULT 'Normal',
            ana_ari_goruldu TEXT DEFAULT 'Hayır',
            yumurta_var TEXT DEFAULT 'Hayır',
            hastalik_belirtisi TEXT DEFAULT 'Yok',
            saldirganlik TEXT DEFAULT 'Düşük',
            besleme_yapildi TEXT DEFAULT 'Hayır',
            ilaclama_yapildi TEXT DEFAULT 'Hayır',
            notlar TEXT,
            fotograf_yolu TEXT,
            olusturma_tarihi TEXT DEFAULT (datetime('now', 'localtime')),
            FOREIGN KEY (kovan_id) REFERENCES fixed_hives(id) ON DELETE CASCADE
        )
    ''')

    conn.commit()
    conn.close()
    print("[OK] Tablolar olusturuldu.")


def insert_sample_data():
    conn = get_db()
    cursor = conn.cursor()

    # Mevcut veri var mi kontrol et
    cursor.execute("SELECT COUNT(*) FROM swarm_hives")
    if cursor.fetchone()[0] > 0:
        print("[INFO] Veritabaninda zaten veri var, ornek veri eklenmedi.")
        conn.close()
        return

    bugun = datetime.now().strftime('%Y-%m-%d')
    uc_gun_once = (datetime.now() - timedelta(days=3)).strftime('%Y-%m-%d')
    on_gun_once = (datetime.now() - timedelta(days=10)).strftime('%Y-%m-%d')
    yirmi_gun_once = (datetime.now() - timedelta(days=20)).strftime('%Y-%m-%d')

    # --- Ogul Kovanlari ---
    # Urgup kuzeybatisi - Kapadokya bolgesi
    cursor.execute('''
        INSERT INTO swarm_hives (ad, latitude, longitude, kurulum_tarihi, son_kontrol_tarihi, durum, ulasim_notu, genel_not, aktif)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('Peri Bacasi Kovan', 38.6420, 34.8050, yirmi_gun_once, uc_gun_once,
          'Arı hareketi var',
          'Urgup-Goreme yolundan saga don, 300m sonra kayaligin altinda',
          'Guneye bakan yamacta, ruzgardan korunakli, peri bacalari yakininda', 1))

    cursor.execute('''
        INSERT INTO swarm_hives (ad, latitude, longitude, kurulum_tarihi, son_kontrol_tarihi, durum, ulasim_notu, genel_not, aktif)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', ('Dere Kenari Kovan', 38.6280, 34.8250, yirmi_gun_once, on_gun_once,
          'Boş',
          'Mustafapasa yolu uzerinde, dere kenarindaki sogut agacinin yaninda',
          'Su kaynagina yakin, iyi konum', 1))

    # --- Arilik ---
    # Urgup merkeze yakin bir arilik
    cursor.execute('''
        INSERT INTO apiaries (arilik_adi, latitude, longitude, aciklama)
        VALUES (?, ?, ?, ?)
    ''', ('Ana Arilik', 38.6350, 34.8150,
          'Urgup guney yamacinda, ana arilik alani. Ruzgardan korunakli, gunesli alan. Kapadokya florasina yakin.'))

    arilik_id = cursor.lastrowid

    # --- Sabit Kovanlar ---
    kovanlar = [
        (arilik_id, 'K1', 1, 1, 2024, 2, 10, 'Güçlü', uc_gun_once, 'En verimli kovan', 1),
        (arilik_id, 'K2', 1, 2, 2024, 1, 10, 'Orta', uc_gun_once, 'Gecen yil bolunmus', 1),
        (arilik_id, 'K3', 1, 3, 2023, 2, 12, 'Kontrol gerekli', on_gun_once, 'Ana ari yasli, degisim gerekebilir', 1),
        (arilik_id, 'K4', 2, 1, 2025, 1, 8, 'Zayıf', on_gun_once, 'Yeni kurulmus, destekleniyor', 1),
        (arilik_id, 'K5', 2, 2, 2023, 1, 10, 'Pasif', yirmi_gun_once, 'Ana ari olmus, birlestirilecek', 0),
    ]

    for k in kovanlar:
        cursor.execute('''
            INSERT INTO fixed_hives (arilik_id, kovan_no, sira_no, konum_no, ana_ari_yili, kat_sayisi, cerceve_sayisi, durum, son_kontrol_tarihi, genel_not, aktif)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', k)

    # --- Kontrol Kayitlari ---
    cursor.execute('''
        INSERT INTO inspections (kovan_id, kontrol_tarihi, ari_yogunlugu, yavru_durumu, bal_durumu, polen_gelisi,
                                  ana_ari_goruldu, yumurta_var, hastalik_belirtisi, saldirganlik,
                                  besleme_yapildi, ilaclama_yapildi, notlar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (1, uc_gun_once, 'Güçlü', 'Çok iyi', 'İyi', 'Yoğun',
          'Evet', 'Evet', 'Yok', 'Düşük',
          'Hayır', 'Hayır', 'Kovan cok iyi durumda, bal suzumune yakin.'))

    cursor.execute('''
        INSERT INTO inspections (kovan_id, kontrol_tarihi, ari_yogunlugu, yavru_durumu, bal_durumu, polen_gelisi,
                                  ana_ari_goruldu, yumurta_var, hastalik_belirtisi, saldirganlik,
                                  besleme_yapildi, ilaclama_yapildi, notlar)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (3, on_gun_once, 'Zayıf', 'Zayıf', 'Az', 'Az',
          'Hayır', 'Hayır', 'Şüpheli', 'Yüksek',
          'Evet', 'Hayır', 'Ana ari gorulemedi, yumurta yok. Ana ari sorunu olabilir. Varroa suphesi var.'))

    conn.commit()
    conn.close()
    print("[OK] Ornek veriler eklendi.")


if __name__ == '__main__':
    print("Ali Baba'nin Ciftligi - Veritabani Baslatiliyor...")
    create_tables()
    insert_sample_data()
    print(f"[OK] Veritabani hazir: {DB_PATH}")
