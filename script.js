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
            var scale = 1 + 0.2 * influence;
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
    // Bypass: führt mit Seitenabstand am optionalen Element vorbei
    function bypassAroundOptional(aPrev, aNext, optRect, tlRect, timelineWidth) {
        var clearance = 28; // Abstand zum optionalen Element
        var optLeft = optRect.left - tlRect.left;
        var optRight = optRect.right - tlRect.left;
        var yTop = optRect.top - tlRect.top;
        var yBottom = optRect.bottom - tlRect.top;
        // Bevorzugt links vorbeiführen (optional ist rechtsbündig),
        // bei wenig Platz nach rechts ausweichen
        var minEdge = 24;
        var preferredLeftX = Math.max(minEdge, optLeft - clearance);
        var preferredRightX = Math.min(timelineWidth - minEdge, optRight + clearance);

        var useLeft = (preferredLeftX > minEdge + 20); // genug Platz links
        var bypassX = useLeft ? preferredLeftX : preferredRightX;

        // Kontrollpunktabstände pro Segment
        var d1 = Math.max(60, yTop - aPrev.y);
        var dMid = Math.max(60, yBottom - yTop);
        var d2 = Math.max(60, aNext.y - yBottom);

        var c1 = Math.min(220, d1 * 0.45);
        var cMid = Math.min(200, dMid * 0.35);
        var c2 = Math.min(220, d2 * 0.45);

        // Drei Segmente mit vertikalen Tangenten an Start, Oberkante, Unterkante, Ende
        var dPath =
            'M ' + aPrev.x + ' ' + aPrev.y +
            ' C ' + aPrev.x + ' ' + (aPrev.y + c1) + ', ' + bypassX + ' ' + (yTop - c1) + ', ' + bypassX + ' ' + yTop +
            ' C ' + bypassX + ' ' + (yTop + cMid) + ', ' + bypassX + ' ' + (yBottom - cMid) + ', ' + bypassX + ' ' + yBottom +
            ' C ' + bypassX + ' ' + (yBottom + c2) + ', ' + aNext.x + ' ' + (aNext.y - c2) + ', ' + aNext.x + ' ' + aNext.y;

        return dPath;
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

                var pathD = bypassAroundOptional(aPrev, aNext, optRect, tlRect, timeline.clientWidth);

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