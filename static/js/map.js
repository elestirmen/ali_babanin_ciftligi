/**
 * Ali Baba'nin Ciftligi - Harita Modulu
 * Leaflet + OpenStreetMap ile kovan ve arilik markerlarini gosterir.
 *
 * Katman mantigi:
 * - Ogul Kovanlari: Her ogul kovani icin tek marker (duplikasyon yok)
 * - Ogul Noktalari: Birden fazla ogul kovani icin yakalama noktasi markeri
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
    const focusTarget = parseFocusTarget();
    const markerRegistry = new Map();

    // Zoom kontrolunu sol alta koy
    L.control.zoom({ position: 'bottomleft' }).addTo(map);

    const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19
    });

    const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: 'Tiles &copy; Esri',
            maxZoom: 19
        }
    );

    const topoLayer = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap',
        maxZoom: 17
    });

    const lightLayer = L.tileLayer(
        'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
            maxZoom: 20
        }
    );

    satelliteLayer.addTo(map);

    const guideTargets = new Map();
    let guidance = {
        watchId: null,
        target: null,
        userMarker: null,
        accuracyCircle: null,
        line: null,
        arrowMarker: null,
        distanceLabel: null,
        control: null,
        panelEl: null,
        hasCentered: false,
        heading: null,
        compassStatus: null,
        orientationListenersActive: false,
        compassTimer: null,
        lastData: null,
        lastUserLatLng: null,
        mapRotationEnabled: false,
        mapRotationActive: false,
        mapRotationEventsActive: false,
        renderFrame: null
    };

    // --- Marker renk belirleme ---
    function parseFocusTarget() {
        const focus = new URLSearchParams(window.location.search).get('focus') || '';
        const match = focus.match(/^(swarm|fixed|apiary|cluster)-(\d+)$/);
        if (!match) return null;
        return {
            type: match[1],
            id: Number(match[2]),
            key: `${match[1]}:${match[2]}`
        };
    }

    function mapDataUrl() {
        if (!focusTarget) return '/api/map-data';
        const params = new URLSearchParams();
        params.set('focus', `${focusTarget.type}-${focusTarget.id}`);
        return `/api/map-data?${params.toString()}`;
    }

    function rememberMarker(type, id, marker, lat, lng) {
        const key = `${type}:${id}`;
        markerRegistry.set(key, {
            marker,
            latLng: [Number(lat), Number(lng)]
        });
    }

    function focusSelectedMarker() {
        if (!focusTarget) return;
        const entry = markerRegistry.get(focusTarget.key);
        if (!entry) return;
        map.setView(entry.latLng, Math.max(map.getZoom(), 17), { animate: true });
        window.setTimeout(() => {
            entry.marker.openPopup();
        }, 180);
    }

    // 3 ana renk + gri (pasif). Babanin bakisini sadelestirir:
    //   yesil = durum iyi, sari = izle/dikkat, kirmizi = acil git, gri = pasif
    function getSwarmColor(durum, aktif, overdue) {
        if (!aktif) return 'gray';
        if (durum === 'Taşındı' || durum === 'İptal edildi') return 'gray';
        if (overdue) return 'red';
        if (durum === 'Oğul girdi' || durum === 'Ana arı kontrol edildi') return 'green';
        // Bos veya ari hareketi var: dikkat (sari)
        return 'yellow';
    }

    function getFixedColor(durum, aktif, overdue) {
        if (!aktif || durum === 'Pasif') return 'gray';
        if (overdue || durum === 'Kontrol gerekli' || durum === 'Hastalık şüphesi var' || durum === 'Zayıf' || durum === 'Ana arı sorunu var') return 'red';
        if (durum === 'Güçlü' || durum === 'Bal durumu iyi') return 'green';
        if (durum === 'Orta') return 'yellow';
        return 'green';
    }

    // --- Renk kodlari ---
    const ICON_COLORS = {
        green: '#388E3C',
        yellow: '#F9A825',
        red: '#D32F2F',
        gray: '#9E9E9E'
    };

    // --- Renkli ikon olusturma (buyuk markerlar icin) ---
    function createIcon(color, type) {
        const symbols = {
            swarm: '🏕️',
            cluster: '📍',
            apiary: '🏠',
            fixed: '📦'
        };

        const fillColor = ICON_COLORS[color] || ICON_COLORS.green;
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
    function createPopupContent(item, targetType) {
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
        const guideKey = registerGuideTarget(targetType || 'target', item.id, name, lat, lng);

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
                    <a href="${navUrl}" target="_blank" rel="noopener" class="popup-icon-btn popup-nav-btn" title="Yol Tarifi" aria-label="Yol Tarifi">🧭</a>
                    <button type="button" class="popup-icon-btn popup-guide-btn" data-guide-key="${guideKey}" title="Kuş Uçumu" aria-label="Kuş Uçumu">➡️</button>
                </div>
            </div>
        `;
    }

    // --- Ogul noktasi popup'i ---
    function createSwarmClusterPopupContent(item) {
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
        const guideKey = registerGuideTarget('cluster', item.id, item.ad, item.latitude, item.longitude);

        const toplam = item.toplam_kovan_sayisi || 0;
        const aktif = item.aktif_kovan_sayisi || 0;
        const kontrol = item.kontrol_gereken_sayisi || 0;
        const pasif = item.pasif_sayisi || 0;

        return `
            <div>
                <div class="popup-title">${escapeHtml(item.ad)}</div>
                <div class="popup-info">
                    ${item.aciklama ? `<span>${escapeHtml(item.aciklama)}</span>` : ''}
                    <span>🏕️ Toplam: <b>${toplam}</b> oğul kovanı</span>
                    <span>✅ Aktif: <b>${aktif}</b></span>
                    ${kontrol > 0 ? `<span style="color:#D32F2F;font-weight:600;">⚠️ Kontrol gereken: <b>${kontrol}</b></span>` : ''}
                    ${pasif > 0 ? `<span style="color:#9E9E9E;">🔇 Pasif: <b>${pasif}</b></span>` : ''}
                </div>
                <div class="popup-actions">
                    <a href="${item.detail_url}" class="popup-detail-btn">Detay</a>
                    <a href="${navUrl}" target="_blank" rel="noopener" class="popup-icon-btn popup-nav-btn" title="Yol Tarifi" aria-label="Yol Tarifi">🧭</a>
                    <button type="button" class="popup-icon-btn popup-guide-btn" data-guide-key="${guideKey}" title="Kuş Uçumu" aria-label="Kuş Uçumu">➡️</button>
                </div>
            </div>
        `;
    }

    function createSwarmClusterRadiusCircle(item) {
        return L.circle([item.latitude, item.longitude], {
            radius: 50,
            color: '#F9A825',
            weight: 2,
            opacity: 0.75,
            fillColor: '#F9A825',
            fillOpacity: 0.14,
            interactive: false
        });
    }

    // --- Arilik popup'i (istatistiklerle) ---
    function createApiaryPopupContent(item) {
        const navUrl = `https://www.google.com/maps/dir/?api=1&destination=${item.latitude},${item.longitude}`;
        const guideKey = registerGuideTarget('apiary', item.id, item.arilik_adi, item.latitude, item.longitude);

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
                    <a href="${navUrl}" target="_blank" rel="noopener" class="popup-icon-btn popup-nav-btn" title="Yol Tarifi" aria-label="Yol Tarifi">🧭</a>
                    <button type="button" class="popup-icon-btn popup-guide-btn" data-guide-key="${guideKey}" title="Kuş Uçumu" aria-label="Kuş Uçumu">➡️</button>
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
        const guideKey = registerGuideTarget('fixed', item.id, displayName, item.latitude, item.longitude);

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
                    <button type="button" class="popup-icon-btn popup-guide-btn" data-guide-key="${guideKey}" title="Kuş Uçumu" aria-label="Kuş Uçumu">➡️</button>
                </div>
            </div>
        `;
    }

    // --- Yardimci fonksiyonlar ---
    function registerGuideTarget(type, id, name, lat, lng) {
        const key = `${type}:${id}`;
        const target = {
            key,
            name: name || 'Hedef',
            lat: Number(lat),
            lng: Number(lng)
        };
        if (Number.isFinite(target.lat) && Number.isFinite(target.lng)) {
            guideTargets.set(key, target);
        }
        return key;
    }

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

    function formatDistance(meters) {
        if (!Number.isFinite(meters)) return 'Ölçülemiyor';
        if (meters < 1000) return `${Math.round(meters)} m`;
        if (meters < 10000) return `${(meters / 1000).toFixed(2)} km`;
        return `${(meters / 1000).toFixed(1)} km`;
    }

    function calculateBearing(fromLatLng, toLatLng) {
        const lat1 = fromLatLng.lat * Math.PI / 180;
        const lat2 = toLatLng.lat * Math.PI / 180;
        const deltaLng = (toLatLng.lng - fromLatLng.lng) * Math.PI / 180;
        const y = Math.sin(deltaLng) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) -
            Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLng);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function bearingToCompass(bearing) {
        const directions = ['K', 'KD', 'D', 'GD', 'G', 'GB', 'B', 'KB'];
        return directions[Math.round(bearing / 45) % directions.length];
    }

    function normalizeDegrees(value) {
        return (value % 360 + 360) % 360;
    }

    function relativeDirectionLabel(angle) {
        if (!Number.isFinite(angle)) return 'Pusula bekleniyor';
        if (angle < 22.5 || angle >= 337.5) return 'Düz ileride';
        if (angle < 67.5) return 'Sağ önde';
        if (angle < 112.5) return 'Sağda';
        if (angle < 157.5) return 'Sağ arkada';
        if (angle < 202.5) return 'Arkada';
        if (angle < 247.5) return 'Sol arkada';
        if (angle < 292.5) return 'Solda';
        return 'Sol önde';
    }

    function isCompactGuidancePanel() {
        return window.matchMedia && window.matchMedia('(max-width: 640px)').matches;
    }

    function createArrowIcon(bearing) {
        return L.divIcon({
            html: `<div class="guidance-arrow-inner" style="transform: rotate(${bearing}deg);">▲</div>`,
            className: 'guidance-arrow-icon',
            iconSize: [38, 38],
            iconAnchor: [19, 19]
        });
    }

    function getTranslateString(point) {
        if (L.Browser.any3d) {
            return `translate3d(${point.x}px, ${point.y}px, 0px)`;
        }
        return `translate(${point.x}px, ${point.y}px)`;
    }

    function getMapPanePosition() {
        return L.DomUtil.getPosition(map.getPane('mapPane')) || L.point(0, 0);
    }

    function setMapPaneTransform(rotation) {
        const mapPane = map.getPane('mapPane');
        const panePos = getMapPanePosition();
        const mapSize = map.getSize();
        const originX = (mapSize.x / 2) - panePos.x;
        const originY = (mapSize.y / 2) - panePos.y;

        mapPane.style.transformOrigin = `${originX}px ${originY}px`;
        mapPane.style.transform = `${getTranslateString(panePos)} rotate(${rotation}deg)`;
    }

    function applyMapRotation() {
        const canRotate = guidance.target && guidance.mapRotationEnabled && Number.isFinite(guidance.heading);
        const mapEl = map.getContainer();

        if (!canRotate) {
            resetMapRotation();
            return;
        }

        const rotation = -guidance.heading;
        guidance.mapRotationActive = true;
        mapEl.classList.add('map-rotating');
        mapEl.style.setProperty('--map-counter-rotation', `${guidance.heading}deg`);
        setMapPaneTransform(rotation);
    }

    function resetMapRotation() {
        const mapEl = map.getContainer();
        const mapPane = map.getPane('mapPane');

        if (!guidance.mapRotationActive && !mapEl.classList.contains('map-rotating')) return;

        guidance.mapRotationActive = false;
        mapEl.classList.remove('map-rotating');
        mapEl.style.removeProperty('--map-counter-rotation');
        mapPane.style.transformOrigin = '';
        mapPane.style.transform = getTranslateString(getMapPanePosition());
    }

    function setMapRotationEvents(active) {
        if (active && !guidance.mapRotationEventsActive) {
            map.on('move zoomend moveend viewreset resize', applyMapRotation);
            guidance.mapRotationEventsActive = true;
        } else if (!active && guidance.mapRotationEventsActive) {
            map.off('move zoomend moveend viewreset resize', applyMapRotation);
            guidance.mapRotationEventsActive = false;
        }
    }

    function scheduleGuidanceRender() {
        if (guidance.renderFrame) return;
        guidance.renderFrame = window.requestAnimationFrame(function () {
            guidance.renderFrame = null;
            applyMapRotation();
            renderGuidancePanel(guidance.lastData);
        });
    }

    function toggleMapRotation() {
        guidance.mapRotationEnabled = !guidance.mapRotationEnabled;
        if (guidance.mapRotationEnabled && guidance.lastUserLatLng && Number.isFinite(guidance.heading)) {
            map.panTo(guidance.lastUserLatLng, { animate: false });
        }
        applyMapRotation();
        renderGuidancePanel(guidance.lastData);
    }

    function ensureGuidanceControl() {
        if (guidance.control) return;

        const control = L.control({ position: 'bottomright' });
        control.onAdd = function () {
            const div = L.DomUtil.create('div', 'guidance-panel');
            L.DomEvent.disableClickPropagation(div);
            L.DomEvent.disableScrollPropagation(div);
            guidance.panelEl = div;
            return div;
        };
        control.addTo(map);
        guidance.control = control;
    }

    function renderGuidancePanel(data) {
        ensureGuidanceControl();
        if (!guidance.panelEl || !guidance.target) return;

        const targetName = escapeHtml(guidance.target.name);
        const distance = data ? formatDistance(data.distance) : 'Konum bekleniyor';
        const direction = data ? `${Math.round(data.bearing)}° ${bearingToCompass(data.bearing)}` : 'Konum bekleniyor';
        const accuracy = data && Number.isFinite(data.accuracy)
            ? `Konum hassasiyeti: ~${Math.round(data.accuracy)} m`
            : 'Konum izni bekleniyor';
        const hasRelativeBearing = data && Number.isFinite(data.bearing) && Number.isFinite(guidance.heading);
        const relativeBearing = hasRelativeBearing ? normalizeDegrees(data.bearing - guidance.heading) : null;
        const compassHeading = Number.isFinite(guidance.heading)
            ? `Telefon yönü: ${Math.round(guidance.heading)}° ${bearingToCompass(guidance.heading)}`
            : (guidance.compassStatus || 'Telefon pusulası bekleniyor');
        const compassClass = hasRelativeBearing ? '' : ' guidance-compass-waiting';
        const compassArrowStyle = hasRelativeBearing ? `transform: rotate(${relativeBearing}deg);` : '';
        const compassText = hasRelativeBearing
            ? `${relativeDirectionLabel(relativeBearing)} · ${Math.round(relativeBearing)}°`
            : 'Telefona göre yön bekleniyor';
        const rotationActive = guidance.mapRotationEnabled && Number.isFinite(guidance.heading);
        const compactPanel = isCompactGuidancePanel();
        const rotationButtonText = guidance.mapRotationEnabled
            ? (compactPanel ? 'Sabit' : 'Haritayı Sabitle')
            : (compactPanel ? 'Döndür' : 'Haritayı Döndür');
        const rotationStatus = rotationActive
            ? 'Harita telefon yönüne göre dönüyor'
            : (guidance.mapRotationEnabled ? 'Harita için pusula bekleniyor' : 'Harita kuzey sabit');

        guidance.panelEl.innerHTML = `
            <div class="guidance-panel-title">Kuş Uçumu</div>
            <div class="guidance-panel-target">${targetName}</div>
            <div class="guidance-panel-main">
                <strong>${distance}</strong>
                <span>${direction}</span>
            </div>
            <div class="guidance-compass${compassClass}">
                <div class="guidance-compass-dial" aria-hidden="true">
                    <div class="guidance-compass-arrow" style="${compassArrowStyle}">▲</div>
                </div>
                <div class="guidance-compass-text">
                    <strong>${compassText}</strong>
                    <span>${compassHeading}</span>
                    <span>${rotationStatus}</span>
                </div>
            </div>
            <div class="guidance-panel-note">${accuracy}</div>
            <div class="guidance-panel-actions">
                <button type="button" class="guidance-rotate-btn${guidance.mapRotationEnabled ? ' active' : ''}" aria-pressed="${guidance.mapRotationEnabled ? 'true' : 'false'}">${rotationButtonText}</button>
                <button type="button" class="guidance-stop-btn">Bitir</button>
            </div>
        `;

        const rotateBtn = guidance.panelEl.querySelector('.guidance-rotate-btn');
        if (rotateBtn) {
            rotateBtn.addEventListener('click', toggleMapRotation);
        }

        const stopBtn = guidance.panelEl.querySelector('.guidance-stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', stopGuidance);
        }
    }

    function showGuidanceError(message) {
        ensureGuidanceControl();
        if (!guidance.panelEl || !guidance.target) return;
        guidance.panelEl.innerHTML = `
            <div class="guidance-panel-title">Kuş Uçumu</div>
            <div class="guidance-panel-target">${escapeHtml(guidance.target.name)}</div>
            <div class="guidance-panel-note guidance-error">${escapeHtml(message)}</div>
            <button type="button" class="guidance-stop-btn">Bitir</button>
        `;
        const stopBtn = guidance.panelEl.querySelector('.guidance-stop-btn');
        if (stopBtn) {
            stopBtn.addEventListener('click', stopGuidance);
        }
    }

    function startGuidance(target) {
        if (!target || !Number.isFinite(target.lat) || !Number.isFinite(target.lng)) {
            alert('Bu hedef için koordinat bulunamadı.');
            return;
        }
        if (!navigator.geolocation) {
            alert('Tarayıcınız konum desteği sunmuyor.');
            return;
        }

        stopGuidance();
        guidance.target = target;
        guidance.hasCentered = false;
        guidance.mapRotationEnabled = true;
        setMapRotationEvents(true);
        renderGuidancePanel(null);
        map.closePopup();
        startCompassTracking();

        guidance.watchId = navigator.geolocation.watchPosition(
            updateGuidance,
            function (error) {
                let message = 'Konum alınamadı.';
                if (error.code === error.PERMISSION_DENIED) {
                    message = 'Konum izni verilmedi.';
                } else if (error.code === error.POSITION_UNAVAILABLE) {
                    message = 'Konum bilgisi şu anda kullanılamıyor.';
                } else if (error.code === error.TIMEOUT) {
                    message = 'Konum alma süresi doldu.';
                }
                showGuidanceError(message);
            },
            {
                enableHighAccuracy: true,
                maximumAge: 2000,
                timeout: 15000
            }
        );
    }

    function updateGuidance(position) {
        if (!guidance.target) return;

        const userLatLng = L.latLng(position.coords.latitude, position.coords.longitude);
        const targetLatLng = L.latLng(guidance.target.lat, guidance.target.lng);
        const distance = userLatLng.distanceTo(targetLatLng);
        const bearing = calculateBearing(userLatLng, targetLatLng);
        const accuracy = position.coords.accuracy;
        const midpoint = L.latLng(
            (userLatLng.lat + targetLatLng.lat) / 2,
            (userLatLng.lng + targetLatLng.lng) / 2
        );
        guidance.lastData = { distance, bearing, accuracy };
        guidance.lastUserLatLng = userLatLng;

        if (!guidance.userMarker) {
            guidance.userMarker = L.circleMarker(userLatLng, {
                radius: 7,
                color: '#FFFFFF',
                weight: 3,
                fillColor: '#1565C0',
                fillOpacity: 1
            }).addTo(map);
        } else {
            guidance.userMarker.setLatLng(userLatLng);
        }

        if (!guidance.accuracyCircle) {
            guidance.accuracyCircle = L.circle(userLatLng, {
                radius: accuracy || 0,
                color: '#1565C0',
                weight: 1,
                fillColor: '#1565C0',
                fillOpacity: 0.08
            }).addTo(map);
        } else {
            guidance.accuracyCircle.setLatLng(userLatLng);
            guidance.accuracyCircle.setRadius(accuracy || 0);
        }

        if (!guidance.line) {
            guidance.line = L.polyline([userLatLng, targetLatLng], {
                color: '#F9A825',
                weight: 4,
                opacity: 0.95,
                dashArray: '8, 10'
            }).addTo(map);
        } else {
            guidance.line.setLatLngs([userLatLng, targetLatLng]);
        }

        if (!guidance.arrowMarker) {
            guidance.arrowMarker = L.marker(userLatLng, {
                icon: createArrowIcon(bearing),
                interactive: false,
                zIndexOffset: 900
            }).addTo(map);
        } else {
            guidance.arrowMarker.setLatLng(userLatLng);
            guidance.arrowMarker.setIcon(createArrowIcon(bearing));
        }

        const distanceLabelHtml = `
            <div class="guidance-distance-label">
                ${formatDistance(distance)} · ${Math.round(bearing)}° ${bearingToCompass(bearing)}
            </div>
        `;
        if (!guidance.distanceLabel) {
            guidance.distanceLabel = L.marker(midpoint, {
                icon: L.divIcon({
                    html: distanceLabelHtml,
                    className: 'guidance-distance-icon',
                    iconSize: [150, 30],
                    iconAnchor: [75, 15]
                }),
                interactive: false
            }).addTo(map);
        } else {
            guidance.distanceLabel.setLatLng(midpoint);
            guidance.distanceLabel.setIcon(L.divIcon({
                html: distanceLabelHtml,
                className: 'guidance-distance-icon',
                iconSize: [150, 30],
                iconAnchor: [75, 15]
            }));
        }

        if (!guidance.hasCentered) {
            map.fitBounds(L.latLngBounds([userLatLng, targetLatLng]), {
                padding: [56, 56],
                maxZoom: 18,
                animate: false
            });
            guidance.hasCentered = true;
        } else if (guidance.mapRotationEnabled && Number.isFinite(guidance.heading)) {
            map.panTo(userLatLng, { animate: false });
        }

        applyMapRotation();
        renderGuidancePanel({ distance, bearing, accuracy });
    }

    function getScreenOrientationAngle() {
        if (window.screen && window.screen.orientation && Number.isFinite(window.screen.orientation.angle)) {
            return window.screen.orientation.angle;
        }
        if (Number.isFinite(window.orientation)) {
            return window.orientation;
        }
        return 0;
    }

    function getCompassHeading(event) {
        if (Number.isFinite(event.webkitCompassHeading)) {
            return normalizeDegrees(event.webkitCompassHeading);
        }
        if (Number.isFinite(event.alpha) && (event.absolute || event.type === 'deviceorientationabsolute')) {
            return normalizeDegrees(360 - event.alpha + getScreenOrientationAngle());
        }
        return null;
    }

    function handleDeviceOrientation(event) {
        if (!guidance.target) return;

        const heading = getCompassHeading(event);
        if (!Number.isFinite(heading)) return;

        guidance.heading = heading;
        guidance.compassStatus = 'Telefon pusulası aktif';
        if (guidance.compassTimer) {
            window.clearTimeout(guidance.compassTimer);
            guidance.compassTimer = null;
        }
        scheduleGuidanceRender();
    }

    function addCompassListeners() {
        if (guidance.orientationListenersActive) return;
        window.addEventListener('deviceorientationabsolute', handleDeviceOrientation, true);
        window.addEventListener('deviceorientation', handleDeviceOrientation, true);
        guidance.orientationListenersActive = true;
        guidance.compassStatus = 'Telefon pusulası dinleniyor';
        renderGuidancePanel(guidance.lastData);
        guidance.compassTimer = window.setTimeout(function () {
            if (!guidance.target || Number.isFinite(guidance.heading)) return;
            guidance.compassStatus = 'Pusula verisi alınamadı; HTTPS veya sensör desteği gerekebilir';
            renderGuidancePanel(guidance.lastData);
        }, 3000);
    }

    function startCompassTracking() {
        if (typeof window.DeviceOrientationEvent === 'undefined') {
            guidance.compassStatus = 'Bu tarayıcı telefon pusulası verisi sunmuyor';
            renderGuidancePanel(guidance.lastData);
            return;
        }

        if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
            window.DeviceOrientationEvent.requestPermission()
                .then(function (state) {
                    if (!guidance.target) return;
                    if (state === 'granted') {
                        addCompassListeners();
                    } else {
                        guidance.compassStatus = 'Telefon pusulası izni verilmedi';
                        renderGuidancePanel(guidance.lastData);
                    }
                })
                .catch(function () {
                    if (!guidance.target) return;
                    guidance.compassStatus = 'Telefon pusulası başlatılamadı';
                    renderGuidancePanel(guidance.lastData);
                });
            return;
        }

        addCompassListeners();
    }

    function stopCompassTracking() {
        if (guidance.compassTimer) {
            window.clearTimeout(guidance.compassTimer);
            guidance.compassTimer = null;
        }
        if (guidance.orientationListenersActive) {
            window.removeEventListener('deviceorientationabsolute', handleDeviceOrientation, true);
            window.removeEventListener('deviceorientation', handleDeviceOrientation, true);
            guidance.orientationListenersActive = false;
        }
    }

    function stopGuidance() {
        if (guidance.watchId !== null && navigator.geolocation) {
            navigator.geolocation.clearWatch(guidance.watchId);
        }
        stopCompassTracking();
        setMapRotationEvents(false);
        if (guidance.renderFrame) {
            window.cancelAnimationFrame(guidance.renderFrame);
            guidance.renderFrame = null;
        }
        resetMapRotation();

        ['userMarker', 'accuracyCircle', 'line', 'arrowMarker', 'distanceLabel'].forEach(function (key) {
            if (guidance[key]) {
                map.removeLayer(guidance[key]);
            }
        });

        if (guidance.control) {
            guidance.control.remove();
        }

        guidance = {
            watchId: null,
            target: null,
            userMarker: null,
            accuracyCircle: null,
            line: null,
            arrowMarker: null,
            distanceLabel: null,
            control: null,
            panelEl: null,
            hasCentered: false,
            heading: null,
            compassStatus: null,
            orientationListenersActive: false,
            compassTimer: null,
            lastData: null,
            lastUserLatLng: null,
            mapRotationEnabled: false,
            mapRotationActive: false,
            mapRotationEventsActive: false,
            renderFrame: null
        };
    }

    // --- Ust uste binen kovanlar icin offset hesapla ---
    // Ayni ariliga ait kovanlar icin kucuk offset vererek ust uste binmeyi azalt
    const offsetCounters = {};
    function getOffset(groupId) {
        if (!offsetCounters[groupId]) {
            offsetCounters[groupId] = 0;
        }
        const index = offsetCounters[groupId]++;
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
        swarmClusters: L.layerGroup(),
        apiaries: L.layerGroup(),
        kontrolGerekenler: L.layerGroup(),
        pasifler: L.layerGroup(),
        focus: L.layerGroup()
    };

    // Tum katmanlari haritaya ekle
    Object.values(layers).forEach(layer => layer.addTo(map));

    // Layer kontrolu
    const baseMaps = {
        'Standart': standardLayer,
        'Uydu': satelliteLayer,
        'Topografya': topoLayer,
        'Açık Ton': lightLayer
    };

    const overlayMaps = {
        '🏕️ Oğul Kovanları': layers.swarmHives,
        '📍 Oğul Noktaları': layers.swarmClusters,
        '🏠 Sabit Arılıklar': layers.apiaries,
        '⚠️ Kontrol Gerekenler': layers.kontrolGerekenler,
        '🔇 Pasifler': layers.pasifler,
        '📍 Seçili Kovan': layers.focus
    };

    L.control.layers(baseMaps, overlayMaps, {
        position: 'topright',
        collapsed: true
    }).addTo(map);

    // --- Veriyi yukle ---
    function loadMapData() {
        fetch(mapDataUrl())
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
                        let lat = item.latitude;
                        let lng = item.longitude;
                        if (!item.has_own_location && item.cluster_id) {
                            const offset = getOffset(`swarm-${item.cluster_id}`);
                            lat += offset.lat;
                            lng += offset.lng;
                        }
                        const marker = L.marker([lat, lng], { icon });
                        marker.bindPopup(createPopupContent(item, 'swarm'), { maxWidth: 280 });
                        rememberMarker('swarm', item.id, marker, lat, lng);

                        if (item.focused) {
                            layers.focus.addLayer(marker);
                        }
                        // Pasif: sadece pasif katmanina
                        else if (!item.aktif || item.durum === 'Taşındı' || item.durum === 'İptal edildi') {
                            layers.pasifler.addLayer(marker);
                        }
                        // Kontrol gereken: sadece ogul katmanina (kirmizi marker zaten uyari veriyor)
                        else {
                            layers.swarmHives.addLayer(marker);
                        }

                        allCoords.push([lat, lng]);
                    });
                }

                // Ogul noktalari - ust marker
                if (data.swarm_clusters) {
                    data.swarm_clusters.forEach(item => {
                        let color = 'green';
                        if ((item.toplam_kovan_sayisi || 0) === 0) {
                            color = 'gray';
                        } else if ((item.kontrol_gereken_sayisi || 0) > 0) {
                            color = 'yellow';
                        }
                        const icon = createIcon(color, 'cluster');
                        const radiusCircle = createSwarmClusterRadiusCircle(item);
                        const marker = L.marker([item.latitude, item.longitude], { icon });

                        marker.bindPopup(createSwarmClusterPopupContent(item), { maxWidth: 280 });
                        rememberMarker('cluster', item.id, marker, item.latitude, item.longitude);
                        if (item.focused) {
                            layers.focus.addLayer(radiusCircle);
                            layers.focus.addLayer(marker);
                        } else {
                            layers.swarmClusters.addLayer(radiusCircle);
                            layers.swarmClusters.addLayer(marker);
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
                        rememberMarker('apiary', item.id, marker, item.latitude, item.longitude);
                        if (item.focused) {
                            layers.focus.addLayer(marker);
                        } else {
                            layers.apiaries.addLayer(marker);
                        }
                        allCoords.push([item.latitude, item.longitude]);
                    });
                }

                // Sabit kovanlar - kontrol gereken/pasif olanlar circleMarker ile
                // Ust uste binmeyi azaltmak icin offset kullan
                if (data.fixed_hives) {
                    data.fixed_hives.forEach(item => {
                        const color = getFixedColor(item.durum, item.aktif, item.overdue);
                        const fillColor = ICON_COLORS[color] || ICON_COLORS.green;

                        let lat = item.latitude;
                        let lng = item.longitude;
                        if (!item.has_own_location) {
                            const offset = getOffset(`apiary-${item.arilik_id}`);
                            lat += offset.lat;
                            lng += offset.lng;
                        }

                        const circleMarker = L.circleMarker([lat, lng], {
                            radius: item.focused ? 11 : 8,
                            fillColor: fillColor,
                            color: item.focused ? '#FFD54F' : '#fff',
                            weight: item.focused ? 3 : 2,
                            opacity: 1,
                            fillOpacity: 0.85
                        });

                        circleMarker.bindPopup(createFixedHivePopupContent(item), { maxWidth: 240 });
                        rememberMarker('fixed', item.id, circleMarker, lat, lng);

                        // Pasif kovanlar pasif katmanina, kontrol gerekenler kontrol katmanina
                        if (item.focused) {
                            layers.focus.addLayer(circleMarker);
                        } else if (!item.aktif || item.durum === 'Pasif') {
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
                focusSelectedMarker();
                renderMapSummary(data);
            })
            .catch(error => {
                console.error('Harita verisi yuklenemedi:', error);
            });
    }

    // --- Ozet karti ---
    function renderMapSummary(data) {
        const el = document.getElementById('mapSummary');
        if (!el) return;

        let good = 0;
        let warn = 0;
        let alert = 0;

        (data.swarm_hives || []).forEach(item => {
            if (!item.aktif || item.durum === 'Taşındı' || item.durum === 'İptal edildi') return;
            if (item.overdue) {
                alert += 1;
            } else if (item.durum === 'Arı hareketi var' || item.durum === 'Boş') {
                warn += 1;
            } else {
                good += 1;
            }
        });

        (data.fixed_hives || []).forEach(item => {
            if (!item.aktif || item.durum === 'Pasif') return;
            if (item.overdue || item.durum === 'Kontrol gerekli' || item.durum === 'Hastalık şüphesi var' || item.durum === 'Zayıf' || item.durum === 'Ana arı sorunu var') {
                alert += 1;
            } else if (item.durum === 'Orta') {
                warn += 1;
            } else {
                good += 1;
            }
        });

        const total = good + warn + alert;
        if (total === 0) {
            el.innerHTML = '<span class="map-summary-loading">Henüz aktif kovan yok</span>';
            return;
        }

        const parts = [];
        parts.push(`<span class="map-summary-item good"><span class="dot"></span>${good}</span>`);
        if (warn > 0) {
            parts.push(`<span class="map-summary-item warn"><span class="dot"></span>${warn}</span>`);
        }
        if (alert > 0) {
            parts.push(`<span class="map-summary-item alert"><span class="dot"></span>${alert}</span>`);
        }
        el.innerHTML = parts.join('');
        el.title = `${good} sağlıklı · ${warn} dikkat · ${alert} kontrol gerekiyor`;
    }

    // --- Hizli ekle FAB ---
    const fabEl = document.getElementById('mapFab');
    if (fabEl) {
        const toggleBtn = fabEl.querySelector('.map-fab-toggle');
        toggleBtn.addEventListener('click', function (event) {
            event.stopPropagation();
            const open = fabEl.classList.toggle('open');
            toggleBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        });
        document.addEventListener('click', function (event) {
            if (!fabEl.contains(event.target)) {
                fabEl.classList.remove('open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
        });
    }

    // Sayfa yuklenince verileri cek
    loadMapData();

    map.getContainer().addEventListener('click', function (event) {
        const button = event.target.closest ? event.target.closest('.popup-guide-btn') : null;
        if (!button) return;

        event.preventDefault();
        event.stopPropagation();
        const target = guideTargets.get(button.dataset.guideKey);
        if (target) {
            startGuidance(target);
        }
    });

    // Custom marker stili (CSS class)
    const style = document.createElement('style');
    style.textContent = `.custom-marker { background: none; border: none; }`;
    document.head.appendChild(style);

})();
