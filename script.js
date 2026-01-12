// Scroll-Scaling und dynamische Pfeile 
(function () {
    const timeline = document.querySelector('.timeline');
    const steps = Array.from(timeline.querySelectorAll('.step'));
    const svg = document.getElementById('flow');
    const pathsGroup = document.getElementById('flowPaths');
    let ticking = false;
    function updateScale() {
        const vh = window.innerHeight;
        const center = vh / 2;
        for (const el of steps) {
            const rect = el.getBoundingClientRect();
            const elCenter = rect.top + rect.height / 2;
            const distance = Math.abs(elCenter - center);
            const influence = Math.max(0, 1 - distance / center);
            const scale = 1 + 0.2 * influence; // bis +20% 
            el.style.transform = `scale(${scale.toFixed(3)})`;
        }
    }
    function getAnchor(el) {
        const tlRect = timeline.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return {
            top: { x: r.left + r.width / 2 - tlRect.left, y: r.top - tlRect.top },
            bottom: { x: r.left + r.width / 2 - tlRect.left, y: r.bottom - tlRect.top }
        };
    }
    function cubicPath(x1, y1, x2, y2) {
        const dY = Math.max(40, y2 - y1);
        const c = Math.min(240, dY * 0.45);
        return `M ${x1} ${y1} C ${x1} ${y1 + c}, ${x2} ${y2 - c}, ${x2} ${y2}`;
    }
    // Bypass mit seitlichem „Vorbeiführen“ nahe der optionalen Karte 
    function bypassPath(x1, y1, x2, y2, optRectCenterY, sideOffset) {
        const midY = optRectCenterY;
        const xMid = x1 + sideOffset; // seitlicher Bauch 
        const dTotal = Math.max(60, y2 - y1);
        const cHalf = Math.min(180, dTotal * 0.25); // Zwei Kubiksegmente, vertikale Tangenten an Start/Mitte/Ende 
        return [
            `M ${x1} ${y1} C ${x1} ${y1 + cHalf}, ${xMid} ${midY - cHalf}, ${xMid} ${midY}`,
            `C ${xMid} ${midY + cHalf}, ${x2} ${y2 - cHalf}, ${x2} ${y2}`].join(' ');
    }
    function renderFlow() {
        // SVG-Größe an Timeline anpassen 
        svg.setAttribute('width', timeline.clientWidth);
        svg.setAttribute('height', timeline.clientHeight);
        // Alte Pfade entfernen 
        while (pathsGroup.firstChild) pathsGroup.removeChild(pathsGroup.firstChild);
        // Hauptverbindungen zwischen aufeinanderfolgenden Schritten 
        for (let i = 0; i < steps.length - 1; i++) {
            const a1 = getAnchor(steps[i]).bottom;
            const a2 = getAnchor(steps[i + 1]).top;
            const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            p.setAttribute('d', cubicPath(a1.x, a1.y, a2.x, a2.y));
            p.setAttribute('class', 'flow-path main');
            p.setAttribute('marker-end', 'url(#arrowHeadMain)');
            pathsGroup.appendChild(p);
        }
        // Bypass für optionale Schritte (verbindet den vorherigen mit dem nächsten Schritt) 
        for (let j = 0; j < steps.length; j++) {
            const opt = steps[j];
            if (opt.dataset.optional === 'true') {
                const prev = steps[j - 1];
                const next = steps[j + 1];
                if (!prev || !next) continue;
                const aPrev = getAnchor(prev).bottom;
                const aNext = getAnchor(next).top;
                // Position der optionalen Karte für den „Bauch“ des Bypass 
                const optRect = opt.getBoundingClientRect();
                const tlRect = timeline.getBoundingClientRect();
                const optCenterY = (optRect.top + optRect.bottom) / 2 - tlRect.top;
                // Seite wählen (rechts), und bei wenig Platz automatisch nach links ausweichen 
                const rightSpace = timeline.clientWidth - aPrev.x - 40;
                const leftSpace = aPrev.x - 40;
                const preferredOffset = 80;
                const sideOffset = rightSpace > preferredOffset ? preferredOffset : (leftSpace > preferredOffset ? -preferredOffset : 0);
                const pathD = bypassPath(aPrev.x, aPrev.y, aNext.x, aNext.y, optCenterY, sideOffset);
                const bp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                bp.setAttribute('d', pathD); bp.setAttribute('class', 'flow-path bypass');
                bp.setAttribute('marker-end', 'url(#arrowHeadBypass)'); pathsGroup.appendChild(bp);
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
    // Auf-/Zuklappen neu zeichnen 
    steps.forEach(s => {
        s.addEventListener('toggle', onScrollOrResize);
    });
    // Initial 
    updateAll();
})();