import os
import sqlite3
import tempfile
import unittest
from pathlib import Path


_tmp = tempfile.TemporaryDirectory()
_base = Path(_tmp.name)
os.environ['ALI_BABA_DB_PATH'] = str(_base / 'test.db')
os.environ['ALI_BABA_UPLOAD_FOLDER'] = str(_base / 'uploads')
os.environ['ALI_BABA_QR_FOLDER'] = str(_base / 'qrcodes')
os.environ['ALI_BABA_SECRET_KEY'] = 'test-secret'
os.environ['ALI_BABA_PASSWORD'] = 'alibaba'

import app as app_module  # noqa: E402
import init_db  # noqa: E402


class AppSecurityAndValidationTests(unittest.TestCase):
    @classmethod
    def tearDownClass(cls):
        _tmp.cleanup()

    def setUp(self):
        db_path = Path(app_module.DB_PATH)
        if db_path.exists():
            db_path.unlink()
        Path(app_module.UPLOAD_FOLDER).mkdir(parents=True, exist_ok=True)
        Path(app_module.QR_FOLDER).mkdir(parents=True, exist_ok=True)
        init_db.DB_PATH = app_module.DB_PATH
        init_db.create_tables()
        app_module.app.config.update(TESTING=True)
        self.client = app_module.app.test_client()

    def login(self):
        response = self.client.post('/login', data={'password': 'alibaba'})
        self.assertEqual(response.status_code, 302)
        with self.client.session_transaction() as sess:
            return sess['_csrf_token']

    def count_rows(self, table):
        conn = sqlite3.connect(app_module.DB_PATH)
        try:
            return conn.execute(f'SELECT COUNT(*) FROM {table}').fetchone()[0]
        finally:
            conn.close()

    def fetch_one(self, query, args=()):
        conn = sqlite3.connect(app_module.DB_PATH)
        conn.row_factory = sqlite3.Row
        try:
            return conn.execute(query, args).fetchone()
        finally:
            conn.close()

    def test_public_home_is_visible_and_admin_requires_login(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Ali Baba", response.data)

        response = self.client.get('/admin')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.headers['Location'])

    def test_login_accepts_alibaba_password(self):
        response = self.client.post('/login', data={'password': 'yanlis'})
        self.assertEqual(response.status_code, 200)

        response = self.client.post('/login', data={'password': 'alibaba'})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers['Location'], '/admin')

    def test_public_message_can_be_left_without_login(self):
        response = self.client.post('/mesaj-birak', data={
            'ad': 'Ziyaretci',
            'iletisim': 'ziyaretci@example.com',
            'konu': 'Bal',
            'mesaj': 'Merhaba, bal hakkında bilgi almak istiyorum.',
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers['Location'], '/mesaj-birak')
        self.assertEqual(self.count_rows('public_messages'), 1)
        message = self.fetch_one('SELECT kategori FROM public_messages')
        self.assertEqual(message['kategori'], 'Diğer')

    def test_admin_message_filters_and_status_update(self):
        token = self.login()
        app_module.execute_db('''
            INSERT INTO public_messages (ad, iletisim, kategori, konu, mesaj)
            VALUES (?, ?, ?, ?, ?)
        ''', ('Ziyaretci', 'ziyaretci@example.com', 'Ziyaret talebi', 'Ziyaret', 'Hafta sonu gelebilir miyiz?'))

        response = self.client.get('/admin/messages?durum=Yeni&kategori=Ziyaret+talebi&q=hafta')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Ziyaretci', response.data)

        response = self.client.post('/admin/messages/1/status', data={
            'csrf_token': token,
            'durum': 'Ziyaret planlandı',
            'yanit_notu': 'Cumartesi uygun.',
        })
        self.assertEqual(response.status_code, 302)
        message = self.fetch_one('SELECT durum, yanit_notu, okundu FROM public_messages WHERE id = 1')
        self.assertEqual(message['durum'], 'Ziyaret planlandı')
        self.assertEqual(message['yanit_notu'], 'Cumartesi uygun.')
        self.assertEqual(message['okundu'], 1)

    def test_admin_messages_require_login(self):
        response = self.client.get('/admin/messages')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.headers['Location'])

    def test_csrf_required_for_post_routes(self):
        self.login()
        response = self.client.post('/apiaries/new', data={'arilik_adi': 'Test'})
        self.assertEqual(response.status_code, 400)

    def test_location_picker_is_rendered_on_coordinate_forms(self):
        self.login()

        response = self.client.get('/swarm-hives/new')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'locationPickerMap', response.data)
        self.assertIn(b'js/location_picker.js', response.data)

        response = self.client.get('/apiaries/new')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'locationPickerMap', response.data)
        self.assertIn(b'js/location_picker.js', response.data)

    def test_invalid_swarm_status_is_rejected(self):
        token = self.login()
        response = self.client.post('/swarm-hives/new', data={
            'csrf_token': token,
            'ad': 'Test Kovan',
            'durum': 'Gecersiz Durum',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.count_rows('swarm_hives'), 0)

    def test_duplicate_fixed_hive_number_is_rejected(self):
        token = self.login()
        apiary_id = app_module.execute_db(
            'INSERT INTO apiaries (arilik_adi, latitude, longitude) VALUES (?, ?, ?)',
            ('Ana Arilik', 38.63, 34.82)
        )
        app_module.execute_db(
            '''INSERT INTO fixed_hives
               (arilik_id, kovan_no, sira_no, konum_no, durum)
               VALUES (?, ?, ?, ?, ?)''',
            (apiary_id, 'K1', 1, 1, 'Orta')
        )

        response = self.client.post(f'/apiaries/{apiary_id}/fixed-hives/new', data={
            'csrf_token': token,
            'kovan_no': 'K1',
            'sira_no': '2',
            'konum_no': '2',
            'kat_sayisi': '1',
            'cerceve_sayisi': '10',
            'durum': 'Orta',
        })
        self.assertEqual(response.status_code, 200)
        self.assertEqual(self.count_rows('fixed_hives'), 1)

    def test_public_url_overrides_absolute_url_generation(self):
        previous_public_url = app_module.PUBLIC_URL
        app_module.PUBLIC_URL = 'https://alibaba.urgup.keenetic.link'
        try:
            with app_module.app.test_request_context('/', base_url='http://internal.local'):
                url = app_module.build_public_url('fixed_hive_detail', id=7)
        finally:
            app_module.PUBLIC_URL = previous_public_url

        self.assertEqual(url, 'https://alibaba.urgup.keenetic.link/fixed-hives/7')

    def test_admin_hives_table_and_quick_updates(self):
        token = self.login()
        apiary_id = app_module.execute_db(
            'INSERT INTO apiaries (arilik_adi) VALUES (?)',
            ('Ana Arilik',)
        )
        fixed_id = app_module.execute_db(
            '''INSERT INTO fixed_hives
               (arilik_id, kovan_no, sira_no, konum_no, durum, son_kontrol_tarihi, aktif)
               VALUES (?, ?, ?, ?, ?, ?, ?)''',
            (apiary_id, 'K1', 1, 1, 'Orta', '2026-04-20', 1)
        )
        swarm_id = app_module.execute_db(
            '''INSERT INTO swarm_hives
               (ad, durum, son_kontrol_tarihi, aktif)
               VALUES (?, ?, ?, ?)''',
            ('Dere Kenari', 'Boş', '2026-04-20', 1)
        )

        response = self.client.get('/admin/hives')
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'Dere Kenari', response.data)
        self.assertIn(b'K1', response.data)

        response = self.client.post(f'/admin/hives/fixed/{fixed_id}/quick-update', data={
            'csrf_token': token,
            'durum': 'Güçlü',
            'son_kontrol_tarihi': '2026-04-26',
            'aktif': 'on',
        })
        self.assertEqual(response.status_code, 302)
        fixed = self.fetch_one('SELECT durum, son_kontrol_tarihi, aktif FROM fixed_hives WHERE id = ?', (fixed_id,))
        self.assertEqual(fixed['durum'], 'Güçlü')
        self.assertEqual(fixed['son_kontrol_tarihi'], '2026-04-26')
        self.assertEqual(fixed['aktif'], 1)

        response = self.client.post(f'/admin/hives/swarm/{swarm_id}/quick-update', data={
            'csrf_token': token,
            'durum': 'Oğul girdi',
            'son_kontrol_tarihi': '2026-04-26',
        })
        self.assertEqual(response.status_code, 302)
        swarm = self.fetch_one('SELECT durum, son_kontrol_tarihi, aktif FROM swarm_hives WHERE id = ?', (swarm_id,))
        self.assertEqual(swarm['durum'], 'Oğul girdi')
        self.assertEqual(swarm['son_kontrol_tarihi'], '2026-04-26')
        self.assertEqual(swarm['aktif'], 0)


if __name__ == '__main__':
    unittest.main()
