// Cosmetic UI behavior only — does not touch form submission or backend logic.
document.addEventListener('DOMContentLoaded', function () {
    var dropzone = document.getElementById('dropzone');
    var fileInput = document.getElementById('file');
    var hint = document.getElementById('fileHint');

    if (!dropzone || !fileInput || !hint) return;

    function updateHint() {
        var files = fileInput.files;
        if (!files || files.length === 0) {
            hint.textContent = 'No files selected';
        } else if (files.length === 1) {
            hint.textContent = files[0].name;
        } else {
            hint.textContent = files.length + ' files selected';
        }
    }

    fileInput.addEventListener('change', updateHint);

    ['dragenter', 'dragover'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
            e.preventDefault();
            dropzone.classList.add('is-dragover');
        });
    });

    ['dragleave', 'drop'].forEach(function (evt) {
        dropzone.addEventListener(evt, function (e) {
            e.preventDefault();
            dropzone.classList.remove('is-dragover');
        });
    });

    dropzone.addEventListener('drop', function (e) {
        if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
            fileInput.files = e.dataTransfer.files;
            updateHint();
        }
    });
});

// ---------------------------------------------------------------
// Live background: topographic flood-contour field + radar sweep.
// Purely decorative — ambient motion behind the UI panels.
// Respects prefers-reduced-motion and pauses when tab is hidden.
// ---------------------------------------------------------------
(function () {
    var canvas = document.getElementById('bg-canvas');
    if (!canvas || !canvas.getContext) return;

    var ctx = canvas.getContext('2d');
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var width, height, dpr;
    var t = 0;
    var raf = null;
    var running = true;

    var SIGNAL = '91, 127, 255';   // --signal
    var ALERT  = '255, 107, 74';   // --alert

    // Drifting "detection" points — echoes the system scanning for structures
    var POINT_COUNT = 14;
    var points = [];

    function makePoint() {
        return {
            x: Math.random(),
            y: Math.random(),
            r: 1.1 + Math.random() * 1.6,
            phase: Math.random() * Math.PI * 2,
            speed: 0.05 + Math.random() * 0.08,
            hue: Math.random() < 0.82 ? SIGNAL : ALERT
        };
    }

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        width = canvas.clientWidth = window.innerWidth;
        height = canvas.clientHeight = window.innerHeight;
        canvas.width = Math.floor(width * dpr);
        canvas.height = Math.floor(height * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function initPoints() {
        points = [];
        for (var i = 0; i < POINT_COUNT; i++) points.push(makePoint());
    }

    // Contour line: a sine-perturbed horizontal band, like flood-level isolines
    function drawContour(yBase, amp, freq, phase, alpha, color, lineWidth) {
        ctx.beginPath();
        var step = 18;
        for (var x = -step; x <= width + step; x += step) {
            var y = yBase + Math.sin((x * freq) + phase) * amp +
                     Math.sin((x * freq * 2.3) + phase * 1.7) * (amp * 0.32);
            if (x === -step) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.strokeStyle = 'rgba(' + color + ', ' + alpha + ')';
        ctx.lineWidth = lineWidth;
        ctx.stroke();
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);

        // Base vignette wash
        var grad = ctx.createRadialGradient(
            width * 0.18, height * -0.05, 0,
            width * 0.18, height * -0.05, width * 0.75
        );
        grad.addColorStop(0, 'rgba(' + SIGNAL + ', 0.07)');
        grad.addColorStop(1, 'rgba(' + SIGNAL + ', 0)');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Topographic flood-contour lines drifting upward slowly
        var bands = 7;
        for (var i = 0; i < bands; i++) {
            var spread = height / (bands - 1);
            var yBase = (i * spread + t * 6) % (height + spread) - spread / 2;
            var depth = i / bands; // 0 = nearest/brightest
            var alpha = 0.05 + (1 - depth) * 0.10;
            var color = i % 5 === 0 ? ALERT : SIGNAL;
            drawContour(
                yBase,
                26 + depth * 18,
                0.0022 + depth * 0.0009,
                t * 0.4 + i * 1.3,
                alpha,
                color,
                1
            );
        }

        // Drifting detection points with soft pulse + occasional scan ring
        for (var p = 0; p < points.length; p++) {
            var pt = points[p];
            var px = pt.x * width;
            var py = pt.y * height;
            var pulse = (Math.sin(t * pt.speed * 6 + pt.phase) + 1) / 2; // 0..1
            var radius = pt.r + pulse * 1.4;
            var op = 0.18 + pulse * 0.35;

            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + pt.hue + ', ' + op + ')';
            ctx.fill();

            // faint scan ring expanding outward on the pulse peak
            if (pulse > 0.92) {
                ctx.beginPath();
                ctx.arc(px, py, radius + (pulse - 0.92) * 220, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(' + pt.hue + ', ' + (0.92 - pulse) * 2.2 + ')';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }

        // Slow rotating radar sweep, anchored top-right, very low opacity
        var cx = width * 0.96;
        var cy = height * 0.02;
        var sweepR = Math.max(width, height) * 0.9;
        var angle = t * 0.18;

        var sweepGrad = ctx.createConicGradient
            ? ctx.createConicGradient(angle, cx, cy)
            : null;

        ctx.save();
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        var a0 = angle;
        var a1 = angle + 0.9;
        ctx.arc(cx, cy, sweepR, a0, a1);
        ctx.closePath();
        if (sweepGrad) {
            sweepGrad.addColorStop(0, 'rgba(' + SIGNAL + ', 0.05)');
            sweepGrad.addColorStop(0.5, 'rgba(' + SIGNAL + ', 0.0)');
            ctx.fillStyle = sweepGrad;
        } else {
            ctx.fillStyle = 'rgba(' + SIGNAL + ', 0.025)';
        }
        ctx.fill();
        ctx.restore();
    }

    function tick() {
        if (!running) return;
        t += 0.016;
        draw();
        raf = requestAnimationFrame(tick);
    }

    function start() {
        if (raf) return;
        running = true;
        raf = requestAnimationFrame(tick);
    }

    function stop() {
        running = false;
        if (raf) cancelAnimationFrame(raf);
        raf = null;
    }

    resize();
    initPoints();
    draw();

    if (!reduceMotion) {
        start();
    }

    window.addEventListener('resize', function () {
        resize();
        draw();
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop();
        else if (!reduceMotion) start();
    });
})();