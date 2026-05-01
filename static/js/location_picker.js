/**
 * Formlarda koordinat secmek icin kucuk Leaflet haritasi.
 */
(function () {
    'use strict';

    const mapEl = document.getElementById('locationPickerMap');
    const latInput = document.getElementById('latitude');
    const lngInput = document.getElementById('longitude');
    const locateBtn = document.getElementById('btnGetLocation');
    const statusEl = document.getElementById('locationStatus');
    const contextUrl = mapEl ? (mapEl.dataset.contextUrl || '') : '';
    const contextTypes = mapEl
        ? String(mapEl.dataset.contextTypes || 'swarm_hives')
            .split(',')
            .map(type => type.trim())
            .filter(Boolean)
        : [];
    const contextLabel = mapEl ? (mapEl.dataset.contextLabel || 'Mevcut kovanlar') : 'Mevcut kovanlar';

    if (!mapEl || !latInput || !lngInput || typeof L === 'undefined') {
        return;
    }

    function parseCoord(value) {
        const parsed = parseFloat(String(value || '').replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
    }

    function escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text || '';
        return div.innerHTML;
    }

    const existingLat = parseCoord(latInput.value);
    const existingLng = parseCoord(lngInput.value);
    const defaultLat = parseCoord(mapEl.dataset.defaultLat) || 38.63;
    const defaultLng = parseCoord(mapEl.dataset.defaultLng) || 34.82;
    const radiusMeters = parseCoord(mapEl.dataset.radiusMeters);
    const selectedRadiusMeters = radiusMeters && radiusMeters > 0 ? radiusMeters : null;
    const hasExistingPoint = existingLat !== null && existingLng !== null;

    const standardLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
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
    const contextLayer = L.layerGroup();

    const map = L.map(mapEl, {
        zoomControl: true,
        layers: [satelliteLayer]
    }).setView(
        hasExistingPoint ? [existingLat, existingLng] : [defaultLat, defaultLng],
        hasExistingPoint ? 16 : 13
    );

    if (contextUrl) {
        contextLayer.addTo(map);
    }

    const overlayLayers = contextUrl ? { [contextLabel]: contextLayer } : null;
    L.control.layers({
        'Standart': standardLayer,
        'Uydu': satelliteLayer,
        'Topografya': topoLayer
    }, overlayLayers, {
        position: 'topright',
        collapsed: true
    }).addTo(map);

    let marker = null;
    let radiusCircle = null;

    function setMarker(lat, lng, shouldPan) {
        const latlng = [lat, lng];
        if (selectedRadiusMeters) {
            if (!radiusCircle) {
                radiusCircle = L.circle(latlng, {
                    radius: selectedRadiusMeters,
                    color: '#F9A825',
                    weight: 2,
                    opacity: 0.8,
                    fillColor: '#F9A825',
                    fillOpacity: 0.16,
                    interactive: false
                }).addTo(map);
            } else {
                radiusCircle.setLatLng(latlng);
            }
        }
        if (!marker) {
            marker = L.marker(latlng, { draggable: true }).addTo(map);
            marker.on('dragend', function () {
                const next = marker.getLatLng();
                updateInputs(next.lat, next.lng, false);
            });
        } else {
            marker.setLatLng(latlng);
        }
        if (shouldPan) {
            map.setView(latlng, Math.max(map.getZoom(), 16));
        }
    }

    function updateInputs(lat, lng, shouldPan) {
        latInput.value = lat.toFixed(6);
        lngInput.value = lng.toFixed(6);
        setMarker(lat, lng, shouldPan);
        if (statusEl) {
            statusEl.textContent = 'Konum seçildi.';
        }
    }

    if (hasExistingPoint) {
        setMarker(existingLat, existingLng, false);
    }

    function contextPointName(type, item) {
        if (type === 'fixed_hives') {
            return `${item.arilik_adi || 'Arılık'} - ${item.kovan_no || 'Kovan'}`;
        }
        if (type === 'apiaries') {
            return item.arilik_adi || 'Arılık';
        }
        if (type === 'swarm_clusters') {
            return item.ad || 'Oğul mevkii';
        }
        return item.ad || item.kovan_no || 'Oğul kovanı';
    }

    function contextPointTypeLabel(type) {
        if (type === 'fixed_hives') return 'Sabit kovan';
        if (type === 'apiaries') return 'Arılık';
        if (type === 'swarm_clusters') return 'Oğul mevkii';
        return 'Oğul kovanı';
    }

    function contextPointColor(type, item) {
        if (!item.aktif && (type === 'swarm_hives' || type === 'fixed_hives')) {
            return '#9E9E9E';
        }
        if (item.overdue || item.kontrol_gereken_sayisi > 0) {
            return '#D32F2F';
        }
        if (type === 'fixed_hives') return '#1976D2';
        if (type === 'apiaries') return '#388E3C';
        if (type === 'swarm_clusters') return '#F9A825';
        return '#5D4037';
    }

    function addContextPoint(type, item, coords) {
        const lat = parseCoord(item.latitude);
        const lng = parseCoord(item.longitude);
        if (lat === null || lng === null) {
            return;
        }

        const color = contextPointColor(type, item);
        const point = L.circleMarker([lat, lng], {
            radius: 6,
            fillColor: color,
            color: '#fff',
            weight: 2,
            opacity: 1,
            fillOpacity: 0.9,
            bubblingMouseEvents: false
        }).addTo(contextLayer);
        const typeLabel = contextPointTypeLabel(type);
        const name = contextPointName(type, item);
        const statusHtml = item.durum ? `<br><small>${escapeHtml(item.durum)}</small>` : '';
        point.bindPopup(`<strong>${escapeHtml(name)}</strong><br>${escapeHtml(typeLabel)}${statusHtml}`);
        coords.push([lat, lng]);
    }

    function loadContextPoints() {
        if (!contextUrl || contextTypes.length === 0) {
            return;
        }

        fetch(contextUrl)
            .then(response => {
                if (!response.ok) throw new Error('Referans noktaları alınamadı.');
                return response.json();
            })
            .then(data => {
                const coords = [];
                contextTypes.forEach(type => {
                    const items = Array.isArray(data[type]) ? data[type] : [];
                    items.forEach(item => addContextPoint(type, item, coords));
                });
                if (!hasExistingPoint && coords.length > 0) {
                    map.fitBounds(L.latLngBounds(coords), { padding: [30, 30], maxZoom: 16 });
                }
            })
            .catch(error => {
                console.error('Referans noktaları yüklenemedi:', error);
            });
    }

    loadContextPoints();

    map.on('click', function (event) {
        updateInputs(event.latlng.lat, event.latlng.lng, true);
    });

    function syncFromInputs() {
        const lat = parseCoord(latInput.value);
        const lng = parseCoord(lngInput.value);
        if (lat === null || lng === null || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
            return;
        }
        setMarker(lat, lng, false);
    }

    latInput.addEventListener('change', syncFromInputs);
    lngInput.addEventListener('change', syncFromInputs);

    if (locateBtn) {
        locateBtn.addEventListener('click', function () {
            if (!navigator.geolocation) {
                if (statusEl) {
                    statusEl.textContent = 'Tarayıcınız konum desteği sunmuyor.';
                }
                return;
            }

            if (statusEl) {
                statusEl.textContent = 'Konum alınıyor...';
            }
            locateBtn.disabled = true;

            navigator.geolocation.getCurrentPosition(
                function (pos) {
                    updateInputs(pos.coords.latitude, pos.coords.longitude, true);
                    locateBtn.disabled = false;
                },
                function (err) {
                    if (statusEl) {
                        statusEl.textContent = 'Konum alınamadı: ' + err.message;
                    }
                    locateBtn.disabled = false;
                },
                { enableHighAccuracy: true, timeout: 15000 }
            );
        });
    }

    setTimeout(function () {
        map.invalidateSize();
    }, 100);
})();
