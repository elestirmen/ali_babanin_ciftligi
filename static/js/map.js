/**
 * Ali Baba'nin Ciftligi - Harita Modulu
 * Leaflet + OpenStreetMap ile kovan ve arilik markerlarini gosterir.
 *
 * Katman mantigi:
 * - Ogul Kovanlari: Her ogul kovani icin tek marker (duplikasyon yok)
 * - Sabit Ariliklar: Ana arilik markeri (popup icinde istatistikler)
 * - Kontrol Gerekenler: Dikkat gerektiren sabit kovanlar (circleMarker, offset ile)
 * - Pasifler: Pasif ogul kovanlari ve sabit kovanlar
 */

(function () {
    'use strict';

    // Harita baslatma - Urgup/Kapadokya merkez
    const map = L.map('map', {
        zoomControl: false
    }).setView([38.63, 34.82], 13);

    // Zoom kontrolunu sol alta koy
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    // OpenStreetMap tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    }).addTo(map);

    // --- Marker renk belirleme ---
    function getSwarmColor(durum, aktif, overdue) {
        if (!aktif) return 'gray';
        if (durum === 'Taşındı' || durum === 'İptal edildi') return 'gray';
        if (overdue) return 'red';
        if (durum === 'Oğul girdi' || durum === 'Ana arı kontrol edildi') return 'green';
        if (durum === 'Arı hareketi var') return 'yellow';
        if (durum === 'Boş') return 'blue';
        return 'blue';
    }

    function getFixedColor(durum, aktif, overdue) {
        if (!aktif || durum === 'Pasif') return 'gray';
        if (overdue || durum === 'Kontrol gerekli' || durum === 'Hastalık şüphesi var') return 'red';
        if (durum === 'Güçlü' || durum === 'Bal durumu iyi') return 'green';
        if (durum === 'Orta') return 'yellow';
        if (durum === 'Zayıf' || durum === 'Ana arı sorunu var') return 'red';
        return 'blue';
    }

    // --- Renk kodlari ---
    const ICON_COLORS = {
        green: '#388E3C',
        yellow: '#F9A825',
        blue: '#1976D2',
        red: '#D32F2F',
        gray: '#9E9E9E'
    };

    // --- Renkli ikon olusturma (buyuk markerlar icin) ---
    function createIcon(color, type) {
        const symbols = {
            swarm: '🏕️',
            apiary: '🏠',
            fixed: '📦'
        };

        const fillColor = ICON_COLORS[color] || ICON_COLORS.blue;
        const symbol = symbols[type] || '📍';

        const svgIcon = `
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="42" viewBox="0 0 32 42">
            <path d="M16 0C7.16 0 0 7.16 0 16c0 12 16 26 16 26s16-14 16-26C32 7.16 24.84 0 16 0z"
                  fill="${fillColor}" stroke="#fff" stroke-width="1.5"/>
            <circle cx="16" cy="15" r="10" fill="white" opacity="0.9"/>
            <text x="16" y="19" text-anchor="middle" font-size="12">${symbol}</text>
        </svg>`;

        return L.divIcon({
            html: svgIcon,
            className: 'custom-marker',
            iconSize: [32, 42],
            iconAnchor: [16, 42],
            popupAnchor: [0, -36]
        });
    }

    // --- Popup HTML olusturma (genel) ---
    function createPopupContent(item) {
        const name = item.ad || item.kovan_no || item.arilik_adi || 'Bilinmiyor';
        const durum = item.durum || '';
        const sonKontrol = item.son_kontrol_tarihi
            ? formatDate(item.son_kontrol_tarihi)
            : 'Hiç kontrol edilmedi';

        let photoHtml = '';
        if (item.fotograf) {
            photoHtml = `<img src="${item.fotograf}" alt="Fotograf" class="popup-photo">`;
        }

        let overdueWarning = '';
        if (item.overdue) {
            overdueWarning = '<span style="color:#D32F2F;font-weight:600;">⚠️ Kontrol zamanı geçmiş</span>';
        }

        const lat = item.latitude;
        const lng = item.longitude;
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        const detailUrl = item.detail_url || '#';

        return `
            <div>
                <div class="popup-title">${escapeHtml(name)}</div>
                ${photoHtml}
                <div class="popup-info">
                    ${durum ? `<span>📊 ${escapeHtml(durum)}</span>` : ''}
                    <span>📅 ${escapeHtml(sonKontrol)}</span>
                    ${overdueWarning}
                </div>
                <div class="popup-actions">
                    <a href="${detailUrl}" class="popup-detail-btn">Detay</a>
                    <a href="${navUrl}" target="_blank" rel="noopener" class="popup-nav-btn">Yol Tarifi</a>
                </div>
            </div>
        `;
    }

    // --- Arilik popup'i (istatistiklerle) ---
    function createApiaryPopupContent(item) {
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;

        let statsHtml = '';
        const toplam = item.toplam_kovan_sayisi || 0;
        const kontrol = item.kontrol_gereken_sayisi || 0;
        const pasif = item.pasif_sayisi || 0;
        const aktif = toplam - pasif;

        statsHtml = `
            <span>📦 Toplam: <b>${toplam}</b> kovan</span>
            <span>✅ Aktif: <b>${aktif}</b></span>
            ${kontrol > 0 ? `<span style="color:#D32F2F;font-weight:600;">⚠️ Kontrol gereken: <b>${kontrol}</b></span>` : ''}
            ${pasif > 0 ? `<span style="color:#9E9E9E;">🔇 Pasif: <b>${pasif}</b></span>` : ''}
        `;

        return `
            <div>
                <div class="popup-title">${escapeHtml(item.arilik_adi)}</div>
                <div class="popup-info">
                    ${item.aciklama ? `<span>${escapeHtml(item.aciklama)}</span>` : ''}
                    ${statsHtml}
                </div>
                <div class="popup-actions">
                    <a href="${item.detail_url}" class="popup-detail-btn">Detay</a>
                    <a href="${navUrl}" target="_blank" rel="noopener" class="popup-nav-btn">Yol Tarifi</a>
                </div>
            </div>
        `;
    }

    // --- Sabit kovan popup (circleMarker icin) ---
    function createFixedHivePopupContent(item) {
        const displayName = `${item.arilik_adi} - ${item.kovan_no}`;
        const durum = item.durum || '';
        const sonKontrol = item.son_kontrol_tarihi
            ? formatDate(item.son_kontrol_tarihi)
            : 'Hiç kontrol edilmedi';

        let overdueWarning = '';
        if (item.overdue) {
            overdueWarning = '<span style="color:#D32F2F;font-weight:600;">⚠️ Kontrol zamanı geçmiş</span>';
        }

        return `
            <div>
                <div class="popup-title">${escapeHtml(displayName)}</div>
                <div class="popup-info">
                    ${durum ? `<span>📊 ${escapeHtml(durum)}</span>` : ''}
                    <span>📅 ${escapeHtml(sonKontrol)}</span>
                    ${overdueWarning}
                </div>
                <div class="popup-actions">
                    <a href="${item.detail_url}" class="popup-detail-btn">Detay</a>
                </div>
            </div>
        `;
    }

    // --- Yardimci fonksiyonlar ---
    function formatDate(dateStr) {
        if (!dateStr) return 'Belirtilmedi';
        try {
            const parts = dateStr.split('-');
            return `${parts[2]}.${parts[1]}.${parts[0]}`;
        } catch (e) {
            return dateStr;
        }
    }

    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // --- Ust uste binen kovanlar icin offset hesapla ---
    // Ayni ariliga ait kovanlar icin kucuk offset vererek ust uste binmeyi azalt
    const offsetCounters = {};
    function getOffset(arilikId) {
        if (!offsetCounters[arilikId]) {
            offsetCounters[arilikId] = 0;
        }
        const index = offsetCounters[arilikId]++;
        // Daire seklinde offset (her kovan icin farkli aci)
        const angle = (index * 72 + 15) * (Math.PI / 180); // 72 derece aralik
        const radius = 0.0004; // ~40m
        return {
            lat: Math.sin(angle) * radius,
            lng: Math.cos(angle) * radius
        };
    }

    // --- Layer gruplari ---
    const layers = {
        swarmHives: L.layerGroup(),
        apiaries: L.layerGroup(),
        kontrolGerekenler: L.layerGroup(),
        pasifler: L.layerGroup()
    };

    // Tum katmanlari haritaya ekle
    Object.values(layers).forEach(layer => layer.addTo(map));

    // Layer kontrolu
    const overlayMaps = {
        '🏕️ Oğul Kovanları': layers.swarmHives,
        '🏠 Sabit Arılıklar': layers.apiaries,
        '⚠️ Kontrol Gerekenler': layers.kontrolGerekenler,
        '🔇 Pasifler': layers.pasifler
    };

    L.control.layers(null, overlayMaps, {
        position: 'topright',
        collapsed: true
    }).addTo(map);

    // --- Veriyi yukle ---
    function loadMapData() {
        fetch('/api/map-data')
            .then(response => {
                if (!response.ok) throw new Error('Veri alinamadi');
                return response.json();
            })
            .then(data => {
                const allCoords = [];

                // Ogul kovanlari - her kayit icin tek marker
                if (data.swarm_hives) {
                    data.swarm_hives.forEach(item => {
                        const color = getSwarmColor(item.durum, item.aktif, item.overdue);
                        const icon = createIcon(color, 'swarm');
                        const marker = L.marker([item.latitude, item.longitude], { icon });
                        marker.bindPopup(createPopupContent(item), { maxWidth: 260 });

                        // Pasif: sadece pasif katmanina
                        if (!item.aktif || item.durum === 'Taşındı' || item.durum === 'İptal edildi') {
                            layers.pasifler.addLayer(marker);
                        }
                        // Kontrol gereken: sadece ogul katmanina (kirmizi marker zaten uyari veriyor)
                        else {
                            layers.swarmHives.addLayer(marker);
                        }

                        allCoords.push([item.latitude, item.longitude]);
                    });
                }

                // Ariliklar - ana marker (istatistiklerle)
                if (data.apiaries) {
                    data.apiaries.forEach(item => {
                        // Kontrol gereken kovan varsa sari, yoksa yesil
                        const color = (item.kontrol_gereken_sayisi > 0) ? 'yellow' : 'green';
                        const icon = createIcon(color, 'apiary');
                        const marker = L.marker([item.latitude, item.longitude], { icon });

                        marker.bindPopup(createApiaryPopupContent(item), { maxWidth: 280 });
                        layers.apiaries.addLayer(marker);
                        allCoords.push([item.latitude, item.longitude]);
                    });
                }

                // Sabit kovanlar - kontrol gereken/pasif olanlar circleMarker ile
                // Ust uste binmeyi azaltmak icin offset kullan
                if (data.fixed_hives) {
                    data.fixed_hives.forEach(item => {
                        const color = getFixedColor(item.durum, item.aktif, item.overdue);
                        const fillColor = ICON_COLORS[color] || ICON_COLORS.blue;

                        // Offset hesapla (ayni arilik icin farkli pozisyonlar)
                        const offset = getOffset(item.arilik_id);
                        const lat = item.latitude + offset.lat;
                        const lng = item.longitude + offset.lng;

                        const circleMarker = L.circleMarker([lat, lng], {
                            radius: 8,
                            fillColor: fillColor,
                            color: '#fff',
                            weight: 2,
                            opacity: 1,
                            fillOpacity: 0.85
                        });

                        circleMarker.bindPopup(createFixedHivePopupContent(item), { maxWidth: 240 });

                        // Pasif kovanlar pasif katmanina, kontrol gerekenler kontrol katmanina
                        if (!item.aktif || item.durum === 'Pasif') {
                            layers.pasifler.addLayer(circleMarker);
                        } else {
                            layers.kontrolGerekenler.addLayer(circleMarker);
                        }
                    });
                }

                // Haritayi tum noktalari gosterecek sekilde ayarla
                if (allCoords.length > 0) {
                    const bounds = L.latLngBounds(allCoords);
                    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
                }
            })
            .catch(error => {
                console.error('Harita verisi yuklenemedi:', error);
            });
    }

    // Sayfa yuklenince verileri cek
    loadMapData();

    // Custom marker stili (CSS class)
    const style = document.createElement('style');
    style.textContent = `.custom-marker { background: none; border: none; }`;
    document.head.appendChild(style);

})();
