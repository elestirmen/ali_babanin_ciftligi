(function() {
    if (!('serviceWorker' in navigator)) {
        return;
    }

    window.addEventListener('load', function() {
        navigator.serviceWorker.register('/sw.js').catch(function() {
            // Service worker destegi opsiyonel; hata sessizce gecilir.
        });
    });
})();
