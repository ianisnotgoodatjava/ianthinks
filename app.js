/* ian — all the interactive bits. No dependencies, no build step. */
(function () {
  'use strict';

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------------------------------------------------- theme toggle
     Cycles auto → light → dark. "auto" follows the OS setting.
     Stored per-browser; wrapped because private mode can throw. */
  var root = document.documentElement;
  var btn = document.getElementById('theme-toggle');

  function store(k, v) { try { v === null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (e) {} }
  function read(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }

  function paint(mode) {
    if (btn) btn.querySelector('.theme-label').textContent =
      mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Auto';
  }

  if (btn) {
    paint(read('theme') || 'auto');
    btn.addEventListener('click', function () {
      var now = root.dataset.theme || 'auto';
      var next = now === 'auto' ? 'light' : now === 'light' ? 'dark' : 'auto';
      if (next === 'auto') { delete root.dataset.theme; store('theme', null); }
      else { root.dataset.theme = next; store('theme', next); }
      paint(next);
    });
  }

  /* ---------------------------------------------------- category filter
     Reads data-cat off each <li>. Syncs to the URL hash so a filtered
     view is linkable, and announces the result for screen readers. */
  var chips = Array.prototype.slice.call(document.querySelectorAll('.chip'));
  /* direct children only — an entry body may contain lists of its own */
  var items = Array.prototype.slice.call(document.querySelectorAll('#feed > li'));
  var none = document.getElementById('noresults');
  var status = document.getElementById('filter-status');

  var coming = document.getElementById('coming');
  var filters = document.querySelector('.filters');

  /* nothing published yet: show what's planned, hide controls that do nothing */
  if (!items.length) {
    if (filters) filters.hidden = true;
    if (none) none.hidden = true;
    var rule = document.querySelector('.section-rule');
    if (rule) rule.hidden = true;
  } else if (coming) {
    coming.hidden = true;
  }

  if (chips.length && items.length) {
    /* count per category, shown on the chips */
    chips.forEach(function (chip) {
      var key = chip.dataset.filter;
      var n = key === 'all' ? items.length
            : items.filter(function (li) { return li.dataset.cat === key; }).length;
      var slot = chip.querySelector('.count');
      if (slot) slot.textContent = n ? n : '';
      if (!n && key !== 'all') chip.disabled = true;
    });

    /* Filtering is a layout change, so hand it to the browser's view
       transition when there is one: rows cross-fade and slide into their
       new positions instead of snapping. */
    function apply(key, push) {
      if (!reduced && document.startViewTransition) {
        try {
          document.startViewTransition(function () { applyNow(key, push); });
          return;
        } catch (e) { /* fall through to the plain path */ }
      }
      applyNow(key, push);
    }

    function applyNow(key, push) {
      var shown = 0;

      chips.forEach(function (c) {
        var on = c.dataset.filter === key;
        c.classList.toggle('is-active', on);
        c.setAttribute('aria-pressed', on ? 'true' : 'false');
      });

      items.forEach(function (li) {
        var show = key === 'all' || li.dataset.cat === key;
        li.hidden = !show;
        if (show) {
          shown++;
          if (!reduced) {
            li.classList.remove('filter-in');
            void li.offsetWidth;          /* restart the animation */
            li.classList.add('filter-in');
          }
        }
      });

      if (none) none.hidden = shown > 0;
      if (status) status.textContent =
        shown + (shown === 1 ? ' entry' : ' entries') +
        (key === 'all' ? '' : ' in ' + key);

      if (push) {
        var url = key === 'all' ? '#' : '#' + key;
        try { history.replaceState(null, '', url); } catch (e) {}
      }
    }

    chips.forEach(function (chip, i) {
      chip.addEventListener('click', function () { apply(chip.dataset.filter, true); });

      /* arrow keys move between chips, like a real toolbar */
      chip.addEventListener('keydown', function (e) {
        var d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
        if (!d) return;
        e.preventDefault();
        var next = chips[(i + d + chips.length) % chips.length];
        next.focus();
      });
    });

    /* honour #markets etc. on load */
    var initial = (location.hash || '').replace('#', '');
    if (initial && chips.some(function (c) { return c.dataset.filter === initial; })) {
      /* applyNow, not apply: on first load the view transition this would
         start is immediately superseded and silently dropped, so the filter
         never landed. Nothing to animate on first paint anyway. */
      applyNow(initial, false);
    }
  }

  /* ---------------------------------------------------- scroll reveal */
  var reveals = document.querySelectorAll('.reveal');
  if (reduced || !('IntersectionObserver' in window)) {
    Array.prototype.forEach.call(reveals, function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (rows) {
      rows.forEach(function (row, i) {
        if (!row.isIntersecting) return;
        var el = row.target;
        setTimeout(function () { el.classList.add('in'); }, i * 70);
        io.unobserve(el);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    Array.prototype.forEach.call(reveals, function (el) { io.observe(el); });
  }

  /* ---------------------------------------------------- hero parallax
     Each .layer moves at its own rate, so the ridges separate as you
     scroll. Reads are batched into rAF to stay off the scroll thread. */
  var hero = document.getElementById('hero');
  var layers = hero ? hero.querySelectorAll('.layer') : [];

  if (hero && layers.length && !reduced) {
    var ticking = false;

    function frame() {
      var y = window.scrollY || window.pageYOffset;
      var h = hero.offsetHeight || 1;
      var t = Math.max(0, Math.min(1.4, y / h));
      Array.prototype.forEach.call(layers, function (g) {
        var depth = parseFloat(g.dataset.depth) || 0;
        g.setAttribute('transform', 'translate(0 ' + (t * depth * -34).toFixed(2) + ')');
      });
      ticking = false;
    }

    window.addEventListener('scroll', function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(frame);
    }, { passive: true });

    frame();
  }

  /* ---------------------------------------------------- reading progress
     The bar across the top of the page. */
  var bar = document.querySelector('.progress');
  if (bar) {
    var tick = false;
    window.addEventListener('scroll', function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () {
        var max = document.body.scrollHeight - window.innerHeight;
        bar.style.width = (max > 0 ? (window.scrollY / max) * 100 : 0) + '%';
        tick = false;
      });
    }, { passive: true });
  }

  /* ---------------------------------------------------- sticky top bar
     Fades the wordmark in and frosts the bar once the hero scrolls past.
     A sentinel beats a scroll listener here — no work on every frame. */
  var topbar = document.getElementById('topbar');
  if (topbar && 'IntersectionObserver' in window) {
    var sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = 'position:absolute;top:0;left:0;height:1px;width:1px;';
    document.body.appendChild(sentinel);

    new IntersectionObserver(function (rows) {
      topbar.classList.toggle('is-stuck', !rows[0].isIntersecting);
    }, { threshold: 0 }).observe(sentinel);
  }


  /* ====================================================================
     INTERACTIVE LAYER
     Command palette + search, keyboard nav, sortable tables, inline
     charts, code blocks, animated disclosure. Still no dependencies.
     ==================================================================== */

  root.classList.add('js');

  var entryItems = Array.prototype.slice.call(
    document.querySelectorAll('#feed > li.entry-item'));

  /* ---------------------------------------------------- small helpers */
  function grab(el, sel) {
    var n = el.querySelector(sel);
    return n ? n.textContent.replace(/\s+/g, ' ').trim() : '';
  }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function rxEsc(s) { return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function slug(s) {
    return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  }
  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  /* ---------------------------------------------------- animated disclosure
     <details> can't animate on its own, so we drive the height ourselves
     and only flip the `open` attribute at the right end of the motion. */
  function setOpen(card, want) {
    var body = card.querySelector('.entry-body');
    if (!body || reduced || !body.animate) { card.open = want; return; }

    if (card._anim) { card._anim.cancel(); card._anim = null; }
    var ease = 'cubic-bezier(.22,.78,.28,1)';

    /* clip only for the duration of the motion — a permanent overflow:hidden
       would cut off chart tooltips that sit above their box */
    body.style.overflow = 'hidden';

    if (want) {
      card.open = true;
      var h = body.scrollHeight;
      card._anim = body.animate(
        [{ height: 0, opacity: 0 }, { height: h + 'px', opacity: 1 }],
        { duration: 280, easing: ease }
      );
    } else {
      card._anim = body.animate(
        [{ height: body.scrollHeight + 'px', opacity: 1 }, { height: 0, opacity: 0 }],
        { duration: 210, easing: ease }
      );
    }
    card._anim.onfinish = function () {
      if (!want) card.open = false;
      body.style.overflow = '';
      card._anim = null;
    };
  }

  entryItems.forEach(function (li, i) {
    var card = li.querySelector('details.entry-card');
    if (!card) return;
    var sum = card.querySelector('summary');
    if (!sum) return;
    sum.addEventListener('click', function (e) {
      e.preventDefault();
      setOpen(card, !card.open);
    });
    /* unique name lets the browser tween each row during a filter change */
    if (!reduced) li.style.viewTransitionName = 'entry' + i;
  });

  /* ---------------------------------------------------- search index */
  var index = entryItems.map(function (li, i) {
    var title = grab(li, '.entry-title');
    if (!li.id) li.id = 'e-' + (slug(title) || i);
    var rec = {
      li: li,
      card: li.querySelector('details.entry-card'),
      title: title,
      cat: grab(li, '.cat'),
      meta: grab(li, '.entry-meta'),
      note: grab(li, '.entry-note'),
      body: grab(li, '.entry-body'),
      key: li.dataset.cat || ''
    };
    rec.hay = (rec.title + ' ' + rec.cat + ' ' + rec.meta + ' ' +
               rec.note + ' ' + rec.body).toLowerCase();
    return rec;
  });

  function score(rec, terms) {
    var total = 0;
    for (var i = 0; i < terms.length; i++) {
      var t = terms[i];
      if (rec.hay.indexOf(t) < 0) return -1;      /* every term must land */
      var title = rec.title.toLowerCase();
      var at = title.indexOf(t);
      if (at === 0) total += 14;
      else if (at > 0) total += new RegExp('\\b' + rxEsc(t)).test(title) ? 10 : 7;
      else if (rec.cat.toLowerCase().indexOf(t) >= 0) total += 6;
      else if (rec.note.toLowerCase().indexOf(t) >= 0) total += 4;
      else if (rec.meta.toLowerCase().indexOf(t) >= 0) total += 4;
      else total += 2;
    }
    return total;
  }

  function search(q) {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!terms.length) return index.slice();
    return index
      .map(function (r) { return { r: r, s: score(r, terms) }; })
      .filter(function (x) { return x.s >= 0; })
      .sort(function (a, b) { return b.s - a.s; })
      .map(function (x) { return x.r; });
  }

  /* highlight matches without ever injecting unescaped source text */
  function mark(raw, terms) {
    var live = terms.filter(Boolean);
    if (!live.length) return esc(raw);
    var rx = new RegExp('(' + live.map(rxEsc).join('|') + ')', 'ig');
    var out = '', last = 0, m;
    while ((m = rx.exec(raw)) !== null) {
      if (rx.lastIndex === m.index) { rx.lastIndex++; continue; }
      out += esc(raw.slice(last, m.index)) + '<mark>' + esc(m[0]) + '</mark>';
      last = m.index + m[0].length;
    }
    return out + esc(raw.slice(last));
  }

  /* ---------------------------------------------------- jump to an entry */
  function reveal(rec) {
    if (rec.li.hidden) {
      var all = document.querySelector('.chip[data-filter="all"]');
      if (all) all.click();
    }
    if (rec.card && !rec.card.open) setOpen(rec.card, true);

    requestAnimationFrame(function () {
      rec.li.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' });
      var sum = rec.card && rec.card.querySelector('summary');
      if (sum) sum.focus({ preventScroll: true });
      rec.li.classList.remove('is-target');
      void rec.li.offsetWidth;
      rec.li.classList.add('is-target');
    });
  }

  /* ---------------------------------------------------- command palette */
  if (index.length) {
    var trigger = el('button', 'search-btn',
      '<svg viewBox="0 0 16 16" aria-hidden="true" class="search-ico">' +
      '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 L14 14"/></svg>' +
      '<span class="search-label">Search</span>' +
      '<kbd class="search-kbd">' + (/Mac|iP/.test(navigator.platform) ? '⌘K' : 'Ctrl K') + '</kbd>');
    trigger.type = 'button';
    trigger.setAttribute('aria-label', 'Search entries');

    var themeBtn = document.getElementById('theme-toggle');
    if (themeBtn && themeBtn.parentNode) themeBtn.parentNode.insertBefore(trigger, themeBtn);

    var dlg = el('dialog', 'palette');
    dlg.setAttribute('aria-label', 'Search entries');
    dlg.innerHTML =
      '<div class="palette-head">' +
        '<svg viewBox="0 0 16 16" aria-hidden="true" class="search-ico">' +
        '<circle cx="7" cy="7" r="4.5"/><path d="M10.5 10.5 L14 14"/></svg>' +
        '<input id="palette-input" type="text" autocomplete="off" spellcheck="false" ' +
        'placeholder="Search entries…" role="combobox" aria-expanded="true" ' +
        'aria-controls="palette-results" aria-autocomplete="list">' +
        '<kbd>esc</kbd>' +
      '</div>' +
      '<ul class="palette-results" id="palette-results" role="listbox" aria-label="Results"></ul>' +
      '<div class="palette-foot">' +
        '<span><kbd>↑</kbd><kbd>↓</kbd> move</span>' +
        '<span><kbd>↵</kbd> open</span>' +
        '<span class="palette-count" aria-live="polite"></span>' +
      '</div>';
    document.body.appendChild(dlg);

    var input   = dlg.querySelector('#palette-input');
    var list    = dlg.querySelector('.palette-results');
    var counter = dlg.querySelector('.palette-count');
    var hits = [], active = -1;

    function draw() {
      var terms = input.value.toLowerCase().split(/\s+/).filter(Boolean);
      hits = search(input.value);
      list.innerHTML = '';

      if (!hits.length) {
        list.appendChild(el('li', 'palette-empty', 'No entry matches “' + esc(input.value) + '”'));
        counter.textContent = '';
        active = -1;
        return;
      }

      hits.forEach(function (rec, i) {
        var li = el('li', 'palette-hit');
        li.id = 'hit-' + i;
        li.setAttribute('role', 'option');
        li.setAttribute('aria-selected', 'false');
        li.dataset.cat = rec.key;
        li.innerHTML =
          '<i class="dot d-' + esc(rec.key) + '"></i>' +
          '<span class="hit-main">' +
            '<span class="hit-title">' + mark(rec.title, terms) + '</span>' +
            '<span class="hit-note">' + mark(rec.note || rec.cat, terms) + '</span>' +
          '</span>' +
          '<span class="hit-meta">' + esc(rec.meta) + '</span>';
        li.addEventListener('click', function () { choose(i); });
        li.addEventListener('mousemove', function () { focusHit(i); });
        list.appendChild(li);
      });

      counter.textContent = hits.length + (hits.length === 1 ? ' entry' : ' entries');
      focusHit(0);
    }

    function focusHit(i) {
      var nodes = list.querySelectorAll('.palette-hit');
      if (!nodes.length) return;
      active = (i + nodes.length) % nodes.length;
      Array.prototype.forEach.call(nodes, function (n, j) {
        var on = j === active;
        n.classList.toggle('is-active', on);
        n.setAttribute('aria-selected', on ? 'true' : 'false');
        if (on) {
          input.setAttribute('aria-activedescendant', n.id);
          n.scrollIntoView({ block: 'nearest' });
        }
      });
    }

    function choose(i) {
      var rec = hits[i];
      if (!rec) return;
      close();
      reveal(rec);
    }

    function open(seed) {
      if (dlg.open) return;
      input.value = seed || '';
      if (typeof dlg.showModal === 'function') dlg.showModal();
      else dlg.setAttribute('open', '');
      draw();
      input.focus();
      input.select();
    }
    function close() {
      if (!dlg.open) return;
      if (typeof dlg.close === 'function') dlg.close();
      else dlg.removeAttribute('open');
    }

    trigger.addEventListener('click', function () { open(); });
    input.addEventListener('input', draw);

    input.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowDown')      { e.preventDefault(); focusHit(active + 1); }
      else if (e.key === 'ArrowUp')   { e.preventDefault(); focusHit(active - 1); }
      else if (e.key === 'Home')      { e.preventDefault(); focusHit(0); }
      else if (e.key === 'End')       { e.preventDefault(); focusHit(hits.length - 1); }
      else if (e.key === 'Enter')     { e.preventDefault(); choose(active); }
    });

    /* clicking the backdrop closes it */
    dlg.addEventListener('click', function (e) { if (e.target === dlg) close(); });

    document.addEventListener('keydown', function (e) {
      var t = e.target || {};
      var tag = (t.tagName || '').toLowerCase();
      var typing = tag === 'input' || tag === 'textarea' || t.isContentEditable;

      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        dlg.open ? close() : open();
      } else if (e.key === '/' && !typing && !dlg.open) {
        e.preventDefault();
        open();
      }
    });

    /* ?q=foo opens the palette primed, so a search is linkable */
    var q = (location.search.match(/[?&]q=([^&]*)/) || [])[1];
    if (q) open(decodeURIComponent(q.replace(/\+/g, ' ')));
  }

  /* ---------------------------------------------------- sortable tables */
  function num(v) {
    var n = parseFloat(String(v).replace(/[^0-9.\-]/g, ''));
    return isNaN(n) ? null : n;
  }

  Array.prototype.forEach.call(document.querySelectorAll('table.mini'), function (tbl) {
    var head = tbl.tHead && tbl.tHead.rows[0];
    var body = tbl.tBodies[0];
    if (!head || !body || body.rows.length < 2) return;

    Array.prototype.forEach.call(head.cells, function (th, col) {
      th.setAttribute('aria-sort', 'none');
      var label = th.textContent.trim();
      var b = el('button', 'th-sort',
        '<span>' + esc(label) + '</span><i class="sort-ind" aria-hidden="true"></i>');
      b.type = 'button';
      b.title = 'Sort by ' + label;
      th.textContent = '';
      th.appendChild(b);

      b.addEventListener('click', function () {
        var dir = th.getAttribute('aria-sort') === 'ascending' ? -1 : 1;

        Array.prototype.forEach.call(head.cells, function (o) {
          o.setAttribute('aria-sort', 'none');
        });
        th.setAttribute('aria-sort', dir === 1 ? 'ascending' : 'descending');

        var rows = Array.prototype.slice.call(body.rows);
        var numeric = rows.filter(function (r) {
          return r.cells[col] && num(r.cells[col].textContent) !== null;
        }).length > rows.length / 2;

        rows.sort(function (a, b2) {
          var av = a.cells[col] ? a.cells[col].textContent.trim() : '';
          var bv = b2.cells[col] ? b2.cells[col].textContent.trim() : '';
          if (numeric) {
            var an = num(av), bn = num(bv);
            if (an === null && bn === null) return 0;
            if (an === null) return 1;          /* blanks and em-dashes last */
            if (bn === null) return -1;
            return (an - bn) * dir;
          }
          return av.localeCompare(bv) * dir;
        });

        rows.forEach(function (r) { body.appendChild(r); });
        tbl.classList.add('did-sort');
      });
    });
  });

  /* ---------------------------------------------------- inline charts
     <div class="chart" data-values="1,2,3" data-labels="a,b,c"
          data-kind="line|bar" data-unit="%" data-caption="…"></div>  */
  Array.prototype.forEach.call(document.querySelectorAll('.chart'), function (box) {
    var vals = (box.dataset.values || '').split(/[,\s]+/)
      .filter(Boolean).map(Number).filter(function (n) { return !isNaN(n); });
    if (vals.length < 2) return;

    var labels = (box.dataset.labels || '').split(',').map(function (s) { return s.trim(); });
    var bar = box.dataset.kind === 'bar';
    var unit = box.dataset.unit || '';
    var W = 320, H = 96, PAD = 6;

    var lo = Math.min.apply(null, vals), hi = Math.max.apply(null, vals);
    if (bar && lo > 0) lo = 0;
    var span = (hi - lo) || 1;
    var x = function (i) { return PAD + i * ((W - PAD * 2) / (vals.length - 1 || 1)); };
    var y = function (v) { return H - PAD - ((v - lo) / span) * (H - PAD * 2); };

    var shapes = '';
    if (bar) {
      var bw = (W - PAD * 2) / vals.length;
      shapes = vals.map(function (v, i) {
        var bx = PAD + i * bw, by = y(v);
        return '<rect class="ch-bar" x="' + (bx + bw * 0.16).toFixed(1) + '" y="' + by.toFixed(1) +
               '" width="' + (bw * 0.68).toFixed(1) + '" height="' + Math.max(1, H - PAD - by).toFixed(1) + '"/>';
      }).join('');
    } else {
      var pts = vals.map(function (v, i) { return x(i).toFixed(1) + ',' + y(v).toFixed(1); });
      shapes =
        '<path class="ch-area" d="M' + PAD + ',' + (H - PAD) + ' L' + pts.join(' L') +
          ' L' + (W - PAD) + ',' + (H - PAD) + ' Z"/>' +
        '<polyline class="ch-line" points="' + pts.join(' ') + '"/>' +
        vals.map(function (v, i) {
          return '<circle class="ch-dot" cx="' + x(i).toFixed(1) + '" cy="' + y(v).toFixed(1) + '" r="2.6"/>';
        }).join('');
    }

    var summary = vals.map(function (v, i) {
      return (labels[i] ? labels[i] + ': ' : '') + v + unit;
    }).join(', ');

    box.innerHTML =
      '<div class="chart-readout" aria-hidden="true"><b></b><span></span></div>' +
      '<svg class="chart-svg" viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" ' +
        'role="img" aria-label="' + esc((box.dataset.caption || 'Chart') + '. ' + summary) + '">' +
        '<line class="ch-cursor" x1="0" y1="' + PAD + '" x2="0" y2="' + (H - PAD) + '"/>' +
        shapes +
      '</svg>' +
      (box.dataset.caption ? '<p class="chart-cap">' + esc(box.dataset.caption) + '</p>' : '');

    var svg = box.querySelector('.chart-svg');
    var out = box.querySelector('.chart-readout');
    var cur = box.querySelector('.ch-cursor');
    var marks = box.querySelectorAll(bar ? '.ch-bar' : '.ch-dot');

    box.tabIndex = 0;
    box.setAttribute('role', 'group');
    box.setAttribute('aria-label', (box.dataset.caption || 'Chart') + '. Use arrow keys to read values.');

    function show(i) {
      if (i < 0 || i >= vals.length) return;
      box.dataset.at = i;
      out.querySelector('b').textContent = vals[i] + unit;
      out.querySelector('span').textContent = labels[i] || ('#' + (i + 1));
      var cx = bar ? (PAD + (i + 0.5) * ((W - PAD * 2) / vals.length)) : x(i);
      out.style.left = ((cx / W) * 100) + '%';
      cur.setAttribute('x1', cx); cur.setAttribute('x2', cx);
      box.classList.add('is-reading');
      Array.prototype.forEach.call(marks, function (m, j) {
        m.classList.toggle('is-on', j === i);
      });
    }
    function hide() {
      box.classList.remove('is-reading');
      Array.prototype.forEach.call(marks, function (m) { m.classList.remove('is-on'); });
    }

    function at(clientX) {
      var r = svg.getBoundingClientRect();
      var f = (clientX - r.left) / (r.width || 1);
      return Math.max(0, Math.min(vals.length - 1, Math.round(f * (vals.length - 1))));
    }

    svg.addEventListener('pointermove', function (e) { show(bar
      ? Math.max(0, Math.min(vals.length - 1,
          Math.floor(((e.clientX - svg.getBoundingClientRect().left) /
          (svg.getBoundingClientRect().width || 1)) * vals.length)))
      : at(e.clientX)); });
    svg.addEventListener('pointerleave', hide);
    box.addEventListener('blur', hide);
    box.addEventListener('focus', function () { show(Number(box.dataset.at) || 0); });
    box.addEventListener('keydown', function (e) {
      var i = Number(box.dataset.at) || 0;
      if (e.key === 'ArrowRight')     { e.preventDefault(); show(Math.min(vals.length - 1, i + 1)); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); show(Math.max(0, i - 1)); }
      else if (e.key === 'Home')      { e.preventDefault(); show(0); }
      else if (e.key === 'End')       { e.preventDefault(); show(vals.length - 1); }
    });
  });

  /* ---------------------------------------------------- code blocks
     Line-based highlighting: comments are decided per line so a URL's
     "//" and a shell "#" in the middle of a command stay intact. */
  var KEYWORDS = {
    shell: 'cd|git|npm|npx|make|sudo|echo|export|cat|ls|mkdir|rm|cp|mv|curl|wget|node|deno|python3|python|pip|brew|docker|ssh|chmod|grep|sed|awk|if|then|fi|for|in|do|done|while|case|esac',
    js: 'const|let|var|function|return|if|else|for|while|new|class|extends|import|from|export|default|await|async|try|catch|finally|throw|typeof|instanceof|null|undefined|true|false|this',
    python: 'def|return|if|elif|else|for|while|import|from|as|class|try|except|finally|raise|with|pass|yield|lambda|in|is|not|and|or|None|True|False'
  };

  function guessLang(src) {
    if (/^\s*(?:\$ )?(?:git|npm|npx|cd|make|sudo|brew|curl|docker|pip|python3?|ls|mkdir)\b/m.test(src)) return 'shell';
    if (/\b(?:def|import)\b.*:/.test(src) && !/[;{]/.test(src)) return 'python';
    if (/\b(?:const|let|function|=>|require\()/.test(src)) return 'js';
    return '';
  }

  function highlight(src, lang) {
    var kw = KEYWORDS[lang];
    var hashComments = lang === 'shell' || lang === 'python';
    var slashComments = lang === 'js';

    return src.split('\n').map(function (line) {
      if (hashComments && /^\s*#/.test(line)) {
        return '<span class="t-c">' + esc(line) + '</span>';
      }
      var code = line, trail = '';
      if (slashComments) {
        var at = line.indexOf('//');
        /* not a URL's slashes, and not inside an obvious string */
        if (at > 0 && line.charAt(at - 1) !== ':' && !/["'`]/.test(line.slice(0, at))) {
          code = line.slice(0, at);
          trail = '<span class="t-c">' + esc(line.slice(at)) + '</span>';
        } else if (at === 0) {
          return '<span class="t-c">' + esc(line) + '</span>';
        }
      }

      var rx = new RegExp(
        '(\'(?:\\\\.|[^\'\\\\])*\'|"(?:\\\\.|[^"\\\\])*"|`(?:\\\\.|[^`\\\\])*`)' +
        '|\\b(0x[0-9a-fA-F]+|\\d+(?:\\.\\d+)?)\\b' +
        (kw ? '|\\b(' + kw + ')\\b' : ''), 'g');

      var out = '', last = 0, m;
      while ((m = rx.exec(code)) !== null) {
        out += esc(code.slice(last, m.index));
        var cls = m[1] ? 't-s' : m[2] ? 't-n' : 't-k';
        out += '<span class="' + cls + '">' + esc(m[0]) + '</span>';
        last = rx.lastIndex;
      }
      return out + esc(code.slice(last)) + trail;
    }).join('\n');
  }

  Array.prototype.forEach.call(document.querySelectorAll('.entry-body pre'), function (pre) {
    if (pre.closest('.code-block')) return;
    var code = pre.querySelector('code') || pre;
    var raw = code.textContent;
    var lang = (pre.dataset.lang || guessLang(raw)).toLowerCase();

    code.innerHTML = highlight(raw, lang);

    var fig = el('figure', 'code-block');
    pre.parentNode.insertBefore(fig, pre);

    var bar = el('figcaption', 'code-bar',
      '<span class="code-lang">' + esc(lang || 'text') + '</span>');
    var copy = el('button', 'code-copy', '<span>Copy</span>');
    copy.type = 'button';
    copy.setAttribute('aria-label', 'Copy code to clipboard');
    bar.appendChild(copy);
    fig.appendChild(bar);
    fig.appendChild(pre);

    copy.addEventListener('click', function () {
      function done(ok) {
        copy.classList.toggle('is-ok', ok);
        copy.classList.toggle('is-bad', !ok);
        copy.querySelector('span').textContent = ok ? 'Copied' : 'Press ⌘C';
        setTimeout(function () {
          copy.classList.remove('is-ok', 'is-bad');
          copy.querySelector('span').textContent = 'Copy';
        }, 1600);
      }
      /* the async API is blocked in some embedded/unfocused contexts,
         so fall through to selecting the text rather than just failing */
      function legacy() {
        try {
          var sel = window.getSelection();
          var rng = document.createRange();
          rng.selectNodeContents(code);
          sel.removeAllRanges();
          sel.addRange(rng);
          var ok = document.execCommand('copy');
          if (ok) sel.removeAllRanges();
          return ok;
        } catch (err) { return false; }
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(raw).then(
          function () { done(true); },
          function () { done(legacy()); }
        );
      } else {
        done(legacy());
      }
    });
  });


  /* ---------------------------------------------------- co-packaged optics diagram
     Each .cpo figure is a schematic you can poke at. The copy lives in the
     page as <dl class="cpo-key"> — that's the no-JS fallback and the source
     for the read-out panel, so there's one copy of every description. The two
     flow buttons walk a dot along an invisible rail (#cpo-tx / #cpo-rx) and
     light each block as the signal reaches it. */
  var CPO_FLOWS = {
    tx: {
      rail: 'cpo-tx',
      label: 'Transmit',
      steps: [
        { until: 0.206, part: 'asic',  tone: 'is-el',
          title: 'Switch ASIC',
          text: 'The ASIC drives an electrical signal out across a few millimetres of package wiring. In a pluggable this is where the DSP would sit; here the path is short enough to do without one.' },
        { until: 0.377, part: 'eic',   tone: 'is-el',
          title: 'EIC — driver',
          text: 'In the electronic IC, the driver amplifies that signal and swings the modulator sitting next door on the photonic IC.' },
        { until: 0.531, part: 'pic',   tone: 'is-opt',
          title: 'PIC — modulator',
          text: 'The modulator stamps the data onto the continuous-wave light the external laser is feeding in. From here on it is an optical signal.' },
        { until: 0.629, part: 'fau',   tone: 'is-opt',
          title: 'FAU',
          text: 'The fiber attach unit couples the modulated light off the package and into the fiber ribbon.' },
        { until: 1,     part: 'fiber', tone: 'is-opt',
          title: 'Out to the network',
          text: 'Much further than copper would carry it, at higher bandwidth density, and indifferent to electromagnetic interference.' }
      ]
    },
    rx: {
      rail: 'cpo-rx',
      label: 'Receive',
      steps: [
        { until: 0.371, part: 'fiber', tone: 'is-opt',
          title: 'In from the network',
          text: 'An optical signal arrives on the fiber ribbon at the other edge of the package.' },
        { until: 0.469, part: 'fau',   tone: 'is-opt',
          title: 'FAU',
          text: 'The fiber attach unit couples the light off the fiber and into the photonic IC.' },
        { until: 0.611, part: 'pic',   tone: 'is-opt',
          title: 'PIC — photodetector',
          text: 'The photodetector converts the optical signal back into an electrical current.' },
        { until: 0.754, part: 'eic',   tone: 'is-el',
          title: 'EIC — TIA',
          text: 'The transimpedance amplifier amplifies and conditions that current into a signal the ASIC can read.' },
        { until: 1,     part: 'asic',  tone: 'is-el',
          title: 'Back into the switch ASIC',
          text: 'The whole electrical leg of the return trip is millimetres of package wiring — the reason co-packaging buys back so much power.' }
      ]
    }
  };

  Array.prototype.forEach.call(document.querySelectorAll('.cpo'), function (fig) {
    var svg   = fig.querySelector('svg');
    var panel = fig.querySelector('.cpo-panel');
    var pTitle = fig.querySelector('.cpo-panel-title');
    var pText  = fig.querySelector('.cpo-panel-text');
    var dot   = fig.querySelector('.cpo-dot');
    if (!svg || !panel || !pTitle || !pText) return;

    var parts = Array.prototype.slice.call(fig.querySelectorAll('.cpo-part'));
    var btns  = Array.prototype.slice.call(fig.querySelectorAll('.cpo-btn'));
    var home  = { title: pTitle.textContent, text: pText.textContent };

    /* copy, read straight out of the no-JS key */
    var copy = {};
    Array.prototype.forEach.call(fig.querySelectorAll('.cpo-key dt'), function (dt) {
      var dd = dt.nextElementSibling;
      if (dt.dataset.part && dd) {
        copy[dt.dataset.part] = { title: dt.textContent.trim(), text: dd.textContent.trim() };
      }
    });

    var raf = 0, timer = 0;

    function step(el) {
      var tag = panel.querySelector('.cpo-panel-step');
      if (!el) { if (tag) tag.remove(); return; }
      if (!tag) {
        tag = document.createElement('p');
        tag.className = 'cpo-panel-step';
        panel.insertBefore(tag, pTitle);
      }
      tag.textContent = el;
    }

    function say(title, text, tag) {
      step(tag || null);
      pTitle.textContent = title;
      pText.textContent = text;
    }

    /* on a narrow screen the stage scrolls sideways, so pan it to whatever
       we're talking about rather than letting the signal leave the viewport */
    var stage = fig.querySelector('.cpo-stage');
    function pans() { return stage && stage.scrollWidth > stage.clientWidth + 2; }

    function follow(x) {
      if (!pans()) return;
      var w = svg.getBoundingClientRect().width;
      if (!w) return;
      stage.scrollLeft = Math.max(0, x * (w / 720) - stage.clientWidth / 2);
    }
    function centerOn(el) {
      if (!el || !pans() || !el.getBoundingClientRect) return;
      var r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
      var to = stage.scrollLeft + (r.left + r.width / 2) - (s.left + s.width / 2);
      if (stage.scrollTo) stage.scrollTo({ left: to, behavior: reduced ? 'auto' : 'smooth' });
      else stage.scrollLeft = to;
    }

    function lit(key, pan) {
      var first = null;
      parts.forEach(function (g) {
        var on = !!key && g.dataset.part === key;
        g.classList.toggle('is-lit', on);
        if (on && !first) first = g;
      });
      if (pan) centerOn(first);
    }
    function active(key) {
      var first = null;
      parts.forEach(function (g) {
        var on = !!key && g.dataset.part === key;
        g.classList.toggle('is-active', on);
        if (on && !first) first = g;
      });
      centerOn(first);
    }

    function stop() {
      if (raf) { cancelAnimationFrame(raf); raf = 0; }
      if (timer) { clearTimeout(timer); timer = 0; }
      fig.classList.remove('is-flowing');
      if (dot) dot.setAttribute('class', 'cpo-dot');
      lit(null);
      btns.forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    }

    function reset() {
      stop();
      active(null);
      say(home.title, home.text);
    }

    function run(key, btn) {
      var flow = CPO_FLOWS[key];
      var rail = flow && svg.querySelector('#' + flow.rail);
      if (!flow || !rail || !dot || !rail.getTotalLength) return;

      stop();
      active(null);
      btn.setAttribute('aria-pressed', 'true');
      if (key === 'tx') fig.classList.add('is-flowing');

      var len = rail.getTotalLength();
      if (!len) return;
      var n = flow.steps.length;

      /* reduce-motion: no travelling dot, just walk the captions */
      if (reduced) {
        var i = 0;
        (function tick() {
          var s = flow.steps[i];
          lit(s.part, true);
          say(s.title, s.text, flow.label + ' · step ' + (i + 1) + ' of ' + n);
          if (++i < n) timer = setTimeout(tick, 2600);
          else timer = setTimeout(function () { lit(null); btn.setAttribute('aria-pressed', 'false'); }, 2600);
        })();
        return;
      }

      var DUR = 7600, t0 = 0, shown = -1;
      dot.setAttribute('class', 'cpo-dot is-on ' + flow.steps[0].tone);

      raf = requestAnimationFrame(function frame(now) {
        if (!t0) t0 = now;
        var t = Math.min(1, (now - t0) / DUR);
        var pt = rail.getPointAtLength(t * len);
        dot.setAttribute('cx', pt.x.toFixed(1));
        dot.setAttribute('cy', pt.y.toFixed(1));
        follow(pt.x);

        var idx = 0;
        while (idx < n - 1 && t > flow.steps[idx].until) idx++;
        if (idx !== shown) {
          shown = idx;
          var s = flow.steps[idx];
          dot.setAttribute('class', 'cpo-dot is-on ' + s.tone);
          lit(s.part);
          say(s.title, s.text, flow.label + ' · step ' + (idx + 1) + ' of ' + n);
        }

        if (t < 1) raf = requestAnimationFrame(frame);
        else {
          raf = 0;
          timer = setTimeout(function () {
            if (dot) dot.setAttribute('class', 'cpo-dot');
            lit(null);
            fig.classList.remove('is-flowing');
            btn.setAttribute('aria-pressed', 'false');
          }, 1100);
        }
      });
    }

    parts.forEach(function (g) {
      function pick() {
        var k = g.dataset.part;
        if (!copy[k]) return;
        stop();
        active(k);
        say(copy[k].title, copy[k].text);
      }
      g.addEventListener('click', pick);
      g.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Spacebar') { e.preventDefault(); pick(); }
      });
    });

    btns.forEach(function (b) {
      b.setAttribute('aria-pressed', 'false');
      b.addEventListener('click', function () {
        var k = b.dataset.flow;
        if (k === 'reset') reset(); else run(k, b);
      });
    });

    /* a closed <details> would report zero-length rails, so stop on close */
    var card = fig.closest ? fig.closest('details') : null;
    if (card) card.addEventListener('toggle', function () { if (!card.open) reset(); });
  });

  /* ---------------------------------------------------- scroll-linked hero
     Publishes 0→1 progress as a custom property; the stylesheet decides
     what to do with it, so this stays one cheap write per frame. */
  if (hero && !reduced) {
    var heroTick = false;
    function heroFrame() {
      var h = hero.offsetHeight || 1;
      var t = Math.max(0, Math.min(1, (window.scrollY || window.pageYOffset) / h));
      hero.style.setProperty('--t', t.toFixed(3));
      heroTick = false;
    }
    window.addEventListener('scroll', function () {
      if (heroTick) return;
      heroTick = true;
      requestAnimationFrame(heroFrame);
    }, { passive: true });
    heroFrame();
  }

})();
