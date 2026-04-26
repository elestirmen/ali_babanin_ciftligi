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

    if (!mapEl || !latInput || !lngInput || typeof L === 'undefined') {
        return;
    }

    function parseCoord(value) {
        const parsed = parseFloat(String(value || '').replace(',', '.'));
        return Number.isFinite(parsed) ? parsed : null;
    }

    const existingLat = parseCoord(latInput.value);
    const existingLng = parseCoord(lngInput.value);
    const defaultLat = parseCoord(mapEl.dataset.defaultLat) || 38.63;
    const defaultLng = parseCoord(mapEl.dataset.defaultLng) || 34.82;
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

    const map = L.map(mapEl, {
        zoomControl: true,
        layers: [standardLayer]
    }).setView(
        hasExistingPoint ? [existingLat, existingLng] : [defaultLat, defaultLng],
        hasExistingPoint ? 16 : 13
    );

    L.control.layers({
        'Standart': standardLayer,
        'Uydu': satelliteLayer,
        'Topografya': topoLayer
    }, null, {
        position: 'topright',
        collapsed: true
    }).addTo(map);

    let marker = null;

    function setMarker(lat, lng, shouldPan) {
        const latlng = [lat, lng];
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
