(function() {
    var guide = document.querySelector('.month-guide');
    if (!guide) {
        return;
    }

    var tabs = Array.prototype.slice.call(guide.querySelectorAll('.month-tab'));
    var panels = Array.prototype.slice.call(guide.querySelectorAll('.month-panel'));

    function activate(month) {
        tabs.forEach(function(tab) {
            var selected = tab.dataset.month === month;
            tab.classList.toggle('active', selected);
            tab.setAttribute('aria-selected', selected ? 'true' : 'false');
        });

        panels.forEach(function(panel) {
            panel.classList.toggle('active', panel.dataset.monthPanel === month);
        });
    }

    tabs.forEach(function(tab) {
        tab.setAttribute('role', 'tab');
        tab.setAttribute('aria-selected', tab.classList.contains('active') ? 'true' : 'false');
        tab.addEventListener('click', function() {
            activate(tab.dataset.month);
        });
    });

    var currentMonth = guide.dataset.currentMonth;
    if (currentMonth) {
        activate(currentMonth);
    }
})();
