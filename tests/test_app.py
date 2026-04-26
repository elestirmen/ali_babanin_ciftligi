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

    def test_pages_require_login(self):
        response = self.client.get('/')
        self.assertEqual(response.status_code, 302)
        self.assertIn('/login', response.headers['Location'])

    def test_login_accepts_alibaba_password(self):
        response = self.client.post('/login', data={'password': 'yanlis'})
        self.assertEqual(response.status_code, 200)

        response = self.client.post('/login', data={'password': 'alibaba'})
        self.assertEqual(response.status_code, 302)
        self.assertEqual(response.headers['Location'], '/')

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


if __name__ == '__main__':
    unittest.main()
