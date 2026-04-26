import sqlite3
conn = sqlite3.connect('ali_baba.db')
conn.row_factory = sqlite3.Row
rows = conn.execute('SELECT ad, son_kontrol_tarihi, kurulum_tarihi FROM swarm_hives ORDER BY id DESC').fetchall()
for r in rows:
    print(f"ad={r['ad']}, son_kontrol={r['son_kontrol_tarihi']}, kurulum={r['kurulum_tarihi']}")
conn.close()
