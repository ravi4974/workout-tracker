// Chart.js CDN loader
(function() {
  if (!window.Chart) {
    var script = document.createElement('script');
    script.src = 'https://cdn.jsdelivr.net/npm/chart.js';
    script.onload = function() { window._chartjs_loaded = true; };
    document.head.appendChild(script);
  } else {
    window._chartjs_loaded = true;
  }
})();
