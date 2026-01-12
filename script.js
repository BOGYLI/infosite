// Scroll-Scaling und dynamische Pfeile – kompatibel (ES5)
(function () {
    var timeline = document.querySelector('.timeline');
    if (!timeline) return;
    var steps = Array.prototype.slice.call(timeline.querySelectorAll('.step'));
    var svg = document.getElementById('flow');
    var pathsGroup = document.getElementById('flowPaths');
    var ticking = false;
    function updateScale() {
        var vh = window.innerHeight || document.documentElement.clientHeight;
        var center = vh / 2;
        for (var i = 0; i < steps.length; i++) {
            var el = steps[i];
            var rect = el.getBoundingClientRect();
            var elCenter = rect.top + rect.height / 2;
            var distance = Math.abs(elCenter - center);
            var influence = Math.max(0, 1 - distance / center);
            var scale = 1 + 0.2 * influence; // bis +20%
            el.style.transform = 'scale(' + scale.toFixed(3) + ')';
        }
    }
    function getAnchor(el) {
        var tlRect = timeline.getBoundingClientRect();
        var r = el.getBoundingClientRect();
        return {
            top: {
                x: r.left + r.width / 2 - tlRect.left,
                y: r.top - tlRect.top
            },
            bottom: {
                x: r.left + r.width / 2 - tlRect.left,
                y: r.bottom - tlRect.top
            }
        };
    }
    // Vertikale Tangenten am Start und Ende – weiche Kubik-Bezier
    function cubicPath(x1, y1, x2, y2) {
        var dY = Math.max(60, y2 - y1);
        var c = Math.min(260, dY * 0.45);
        return 'M ' + x1 + ' ' + y1 +
            ' C ' + x1 + ' ' + (y1 + c) + ', ' + x2 + ' ' + (y2 - c) + ', ' + x2 + ' ' + y2;
    }
    // Bypass führt seitlich am optionalen Schritt vorbei (bevorzugt links)
    function bypassPath(x1, y1, x2, y2, optRectCenterY, sideOffset) {
        var midY = optRectCenterY;
        var xMid = x1 + sideOffset;
        var dTotal = Math.max(80, y2 - y1);
        var cHalf = Math.min(200, dTotal * 0.25);
        return [
            'M ' + x1 + ' ' + y1 +
            ' C ' + x1 + ' ' + (y1 + cHalf) + ', ' + xMid + ' ' + (midY - cHalf) + ', ' + xMid + ' ' + midY,
            'C ' + xMid + ' ' + (midY + cHalf) + ', ' + x2 + ' ' + (y2 - cHalf) + ', ' + x2 + ' ' + y2
        ].join(' ');
    }
    function renderFlow() {
        if (!svg || !pathsGroup) return;
        // SVG an Timeline anpassen
        svg.setAttribute('width', timeline.clientWidth);
        svg.setAttribute('height', timeline.clientHeight);

        // Alte Pfade löschen
        while (pathsGroup.firstChild) {
            pathsGroup.removeChild(pathsGroup.firstChild);
        }

        // Hauptverbindungen
        for (var i = 0; i < steps.length - 1; i++) {
            var a1 = getAnchor(steps[i]).bottom;
            var a2 = getAnchor(steps[i + 1]).top;

            var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('d', cubicPath(a1.x, a1.y, a2.x, a2.y));
            p.setAttribute('class', 'flow-path main');
            p.setAttribute('marker-end', 'url(#arrowHeadMain)');
            pathsGroup.appendChild(p);
        }

        // Bypass für optionale Schritte (vorheriger -> nächster Schritt)
        for (var j = 0; j < steps.length; j++) {
            var opt = steps[j];
            if (opt.getAttribute('data-optional') === 'true') {
                var prev = steps[j - 1];
                var next = steps[j + 1];
                if (!prev || !next) continue;

                var aPrev = getAnchor(prev).bottom;
                var aNext = getAnchor(next).top;

                var optRect = opt.getBoundingClientRect();
                var tlRect = timeline.getBoundingClientRect();
                var optCenterY = (optRect.top + optRect.bottom) / 2 - tlRect.top;

                // Bevorzugt links vorbeiführen (da optional rechtsbündig),
                // bei wenig Platz nach rechts ausweichen
                var preferredOffset = 110;
                var leftSpace = aPrev.x - 60;
                var rightSpace = timeline.clientWidth - aPrev.x - 60;

                var sideOffset = -Math.min(preferredOffset, Math.max(60, leftSpace));
                if (Math.abs(sideOffset) < 60 && rightSpace > 80) {
                    sideOffset = Math.min(preferredOffset, rightSpace);
                }

                var pathD = bypassPath(aPrev.x, aPrev.y, aNext.x, aNext.y, optCenterY, sideOffset);
                var bp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                bp.setAttribute('d', pathD);
                bp.setAttribute('class', 'flow-path bypass');
                bp.setAttribute('marker-end', 'url(#arrowHeadBypass)');
                pathsGroup.appendChild(bp);
            }
        }
    }
    function updateAll() {
        updateScale();
        renderFlow();
        ticking = false;
    }
    function onScrollOrResize() {
        if (!ticking) {
            window.requestAnimationFrame(updateAll);
            ticking = true;
        }
    }
    window.addEventListener('scroll', onScrollOrResize, { passive: true });
    window.addEventListener('resize', onScrollOrResize);
    for (var k = 0; k < steps.length; k++) {
        steps[k].addEventListener('toggle', onScrollOrResize);
    }
    // Initial
    updateAll();
})();