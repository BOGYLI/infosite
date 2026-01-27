// Zufällige Kartenbreiten/-positionen, durchgängige Ankerpunkte,
// breite Linien ohne Pfeilspitzen, großer Wasserzeichen-Jahrgang und Trennlinie – ES5-kompatibel
(function () {
    var timeline = document.querySelector('.timeline');
    if (!timeline) return;
    var steps = Array.prototype.slice.call(timeline.querySelectorAll('.step'));
    var svg = document.getElementById('flow');
    var pathsGroup = document.getElementById('flowPaths');
    var EDGE_PAD = 22;           // Innenabstand für Ankerpunkte von der Kartenkante
    var MIN_DELTA_FACTOR = 0.08; // Mindest-x-Abstand relativ zur Timelinebreite
    var ticking = false;
    var randomized = false;
    function randBetween(min, max) { return Math.random() * (max - min) + min; }
    function clamp(val, min, max) { return Math.max(min, Math.min(max, val)); }
    // Zufällige Layout-Parameter speichern (stabil bei Resize)
    function randomizeLayout() {
        for (var i = 0; i < steps.length; i++) {
            var el = steps[i];
            var isOpt = el.getAttribute('data-optional') === 'true';
            var wf = isOpt ? randBetween(0.55, 0.75) : randBetween(0.65, 0.95); // optional schmaler
            var pf = isOpt ? randBetween(0.65, 0.95) : randBetween(0.05, 0.95); // optional eher rechts
            var ax = randBetween(0.25, 0.75); // ein durchgängiger Punkt für oben/unten (nicht zu nah am Rand)
            el.setAttribute('data-wf', wf.toFixed(4));
            el.setAttribute('data-pf', pf.toFixed(4));
            el.setAttribute('data-ax', ax.toFixed(4));
        }
        randomized = true;
        applyLayoutFromData();
    }
    function applyLayoutFromData() {
        var tlWidth = timeline.clientWidth;
        for (var i = 0; i < steps.length; i++) {
            var el = steps[i];
            var wf = parseFloat(el.getAttribute('data-wf') || '0.8');
            var pf = parseFloat(el.getAttribute('data-pf') || '0.5');
            var widthPx = Math.round(tlWidth * wf);
            var maxLeft = Math.max(0, tlWidth - widthPx);
            var leftPx = Math.round(maxLeft * pf);
            el.style.width = widthPx + 'px';
            el.style.marginLeft = leftPx + 'px';
            el.style.marginRight = '0';
        }
    }
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
    function getRectRel(el) {
        var tlRect = timeline.getBoundingClientRect();
        var r = el.getBoundingClientRect();
        return {
            left: r.left - tlRect.left,
            top: r.top - tlRect.top,
            right: r.right - tlRect.left,
            bottom: r.bottom - tlRect.top,
            width: r.width,
            height: r.height
        };
    }
    // Durchgängige Ankerpunkte (gleicher x für oben/unten), mit Innenabstand
    function getAnchors(el) {
        var rr = getRectRel(el);
        var ax = parseFloat(el.getAttribute('data-ax') || '0.5');
        var xMin = rr.left + EDGE_PAD;
        var xMax = rr.right - EDGE_PAD;
        var x = clamp(rr.left + rr.width * ax, xMin, xMax);
        return { top: { x: x, y: rr.top }, bottom: { x: x, y: rr.bottom }, rect: rr };
    }
    // Weiche Kubik-Bezier mit vertikalen Tangenten
    function cubicPath(x1, y1, x2, y2) {
        var dY = Math.max(60, y2 - y1);
        var c = Math.min(300, dY * 0.45);
        return 'M ' + x1 + ' ' + y1 +
            ' C ' + x1 + ' ' + (y1 + c) + ', ' + x2 + ' ' + (y2 - c) + ', ' + x2 + ' ' + y2;
    }
    // Mindest-x-Abstand für aufeinanderfolgende Anker
    function ensureMinDelta(prevAnchorX, nextEl, minDelta) {
        var anchorsNext = getAnchors(nextEl);
        var nextX = anchorsNext.top.x;
        var dx = Math.abs(nextX - prevAnchorX);
        if (dx < minDelta) {
            var targetX = prevAnchorX + (nextX >= prevAnchorX ? minDelta : -minDelta);
            var xMin = anchorsNext.rect.left + EDGE_PAD;
            var xMax = anchorsNext.rect.right - EDGE_PAD;
            var newX = clamp(targetX, xMin, xMax);
            var newAx = (newX - anchorsNext.rect.left) / anchorsNext.rect.width;
            nextEl.setAttribute('data-ax', newAx.toFixed(4));
            return getAnchors(nextEl);
        }
        return anchorsNext;
    }
    // Bypass um optionales Element: seitlicher Korridor mit Abstand
    function bypassAroundOptional(aPrev, optEl, aNext) {
        var tlRect = timeline.getBoundingClientRect();
        var optRectAbs = optEl.getBoundingClientRect();
        var rrOptLeft = optRectAbs.left - tlRect.left;
        var rrOptRight = optRectAbs.right - tlRect.left;
        var yTop = optRectAbs.top - tlRect.top;
        var yBottom = optRectAbs.bottom - tlRect.top;
        var clearance = 36; // Abstand zum optionalen Element
        var minEdge = 28;
        var tlWidth = timeline.clientWidth;

        // bevorzugt links (optional meist rechts), sonst rechts
        var leftX = Math.max(minEdge, rrOptLeft - clearance);
        var rightX = Math.min(tlWidth - minEdge, rrOptRight + clearance);
        var useLeft = (leftX > minEdge + 24);
        var bypassX = useLeft ? leftX : rightX;

        var d1 = Math.max(60, yTop - aPrev.y);
        var dMid = Math.max(60, yBottom - yTop);
        var d2 = Math.max(60, aNext.y - yBottom);

        var c1 = Math.min(260, d1 * 0.45);
        var cMid = Math.min(240, dMid * 0.40);
        var c2 = Math.min(260, d2 * 0.45);

        return 'M ' + aPrev.x + ' ' + aPrev.y +
            ' C ' + aPrev.x + ' ' + (aPrev.y + c1) + ', ' + bypassX + ' ' + (yTop - c1) + ', ' + bypassX + ' ' + yTop +
            ' C ' + bypassX + ' ' + (yTop + cMid) + ', ' + bypassX + ' ' + (yBottom - cMid) + ', ' + bypassX + ' ' + yBottom +
            ' C ' + bypassX + ' ' + (yBottom + c2) + ', ' + aNext.x + ' ' + (aNext.y - c2) + ', ' + aNext.x + ' ' + aNext.y;
    }
    // Jahrgangsanzeige (Wasserzeichen) aktualisieren
    var gradeNumberEl = document.querySelector('.grade-indicator .grade-number');
    function updateGradeIndicator() {
        if (!gradeNumberEl) return;
        var seps = Array.prototype.slice.call(timeline.querySelectorAll('.grade-separator'));
        var pageY = window.pageYOffset || document.documentElement.scrollTop || 0;
        var threshold = 120;
        var current = 4;
        for (var i = 0; i < seps.length; i++) {
            var sepTop = seps[i].getBoundingClientRect().top + (window.pageYOffset || document.documentElement.scrollTop || 0);
            if (sepTop <= pageY + threshold) {
                var g = parseInt(seps[i].getAttribute('data-grade'), 10);
                if (!isNaN(g)) current = g;
            }
        }
        gradeNumberEl.textContent = current;
    }
    function renderFlow() {
        if (!svg || !pathsGroup) return;
        svg.setAttribute('width', timeline.clientWidth);
        svg.setAttribute('height', timeline.clientHeight);

        while (pathsGroup.firstChild) { pathsGroup.removeChild(pathsGroup.firstChild); }

        var minDelta = Math.max(50, Math.round(timeline.clientWidth * MIN_DELTA_FACTOR));

        // Hauptverbindungen
        for (var i = 0; i < steps.length - 1; i++) {
            var prevAnchors = getAnchors(steps[i]);
            var nextAnchors = ensureMinDelta(prevAnchors.bottom.x, steps[i + 1], minDelta);

            var aPrev = prevAnchors.bottom;
            var aNext = nextAnchors.top;

            var p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('d', cubicPath(aPrev.x, aPrev.y, aNext.x, aNext.y));
            p.setAttribute('class', 'flow-path main');
            pathsGroup.appendChild(p);
        }

        // Bypass für optionale Schritte
        for (var j = 0; j < steps.length; j++) {
            var opt = steps[j];
            if (opt.getAttribute('data-optional') === 'true') {
                var prev = steps[j - 1];
                var next = steps[j + 1];
                if (!prev || !next) continue;

                var prevAnchors2 = getAnchors(prev);
                var nextAnchors2 = ensureMinDelta(prevAnchors2.bottom.x, next, minDelta);

                var dBypass = bypassAroundOptional(prevAnchors2.bottom, opt, nextAnchors2.top);
                var bp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                bp.setAttribute('d', dBypass);
                bp.setAttribute('class', 'flow-path bypass');
                pathsGroup.appendChild(bp);
            }
        }
    }
    function updateAll() {
        if (!randomized) randomizeLayout(); else applyLayoutFromData();
        updateScale();
        renderFlow();
        updateGradeIndicator();
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
    updateAll();
})();