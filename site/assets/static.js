/* Static pages (e.g. accessibility statement): just the prototype banner. */
(function () { var s = window.CC.getState(); var p = document.getElementById('proto'); if (p) p.innerHTML = window.CC.protoBanner(s, ''); })();
