// Reset scroll position on every fresh page load (not on same-page hash jumps).
// Without this, some browsers/preview frames carry the previous page's scroll
// offset into the newly-loaded page, making links appear to "land too far down".
// This must be an INSTANT jump, not an animated one: the site sets
// `scroll-behavior: smooth` on <html> globally, and window.scrollTo() honors
// that unless told otherwise. On most pages a stray leftover scroll offset is
// small and the smooth correction is imperceptible -- but on pages with a very
// tall section (like Outreach's scroll-driven globe), that same correction
// becomes a long, visibly animated glide back up to the top right after the
// page loads. Passing behavior:'instant' forces an immediate jump regardless
// of the page's smooth-scroll setting.
if('scrollRestoration' in history){
  history.scrollRestoration = 'manual';
}
function resetScrollInstant(){
  if(!window.location.hash){
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }
}
resetScrollInstant();
window.addEventListener('pageshow', resetScrollInstant);

(function(){
  // ---------- Header height CSS var (so sticky elements below the header,
  // like the Outreach page's globe, can sit flush under it without a
  // hardcoded pixel guess) ----------
  function setHeaderHeightVar(){
    var header = document.querySelector('header.site');
    if(header) document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  }
  setHeaderHeightVar();
  window.addEventListener('resize', setHeaderHeightVar);

  // ---------- Scroll reveal ----------
  var els = document.querySelectorAll('.reveal');
  if('IntersectionObserver' in window){
    var io = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(entry.isIntersecting){
          entry.target.classList.add('in');
          io.unobserve(entry.target);
        }
      });
    }, {threshold:0.14, rootMargin:'0px 0px -40px 0px'});
    els.forEach(function(el){ io.observe(el); });
  } else {
    els.forEach(function(el){ el.classList.add('in'); });
  }

  // ---------- Hero parallax (home only) ----------
  var media = document.getElementById('heroMedia');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(media && !reduceMotion){
    window.addEventListener('scroll', function(){
      var y = window.scrollY;
      if(y < 700){
        media.style.transform = 'scale(1.06) translateY(' + (y * 0.08) + 'px)';
      }
    }, {passive:true});
  }

  // ---------- Live service status ----------
  // Service windows in America/Chicago local time, [dayOfWeek(0=Sun..6=Sat), startMin, endMin, label]
  var WINDOWS = [
    {day:0, start:9*60+30,  end:10*60+15, label:"Sunday morning classes"},
    {day:0, start:10*60+30, end:12*60,    label:"Sunday morning worship"},
    {day:0, start:17*60,    end:18*60,    label:"Sunday evening worship"},
    {day:3, start:19*60,    end:20*60+15, label:"Wednesday evening classes"}
  ];
  var NEXT_LABELS = [
    {day:0, start:9*60+30,  label:"Sunday at 9:30 AM"},
    {day:0, start:10*60+30, label:"Sunday at 10:30 AM"},
    {day:0, start:17*60,    label:"Sunday at 5:00 PM"},
    {day:3, start:19*60,    label:"Wednesday at 7:00 PM"}
  ];
  function chicagoNow(){
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone:'America/Chicago', weekday:'short', hour:'numeric', minute:'numeric', hour12:false
    }).formatToParts(new Date());
    var map = {};
    parts.forEach(function(p){ map[p.type] = p.value; });
    var days = {Sun:0,Mon:1,Tue:2,Wed:3,Thu:4,Fri:5,Sat:6};
    var hour = parseInt(map.hour, 10) % 24;
    var minute = parseInt(map.minute, 10);
    return {day: days[map.weekday], minutes: hour*60 + minute};
  }
  function updateLiveStatus(){
    var els = document.querySelectorAll('[data-live-status]');
    if(!els.length) return;
    var now = chicagoNow();
    var active = WINDOWS.find(function(w){
      return w.day === now.day && now.minutes >= w.start && now.minutes <= w.end;
    });
    els.forEach(function(root){
      var dot = root.querySelector('.live-dot');
      var text = root.querySelector('.live-text');
      if(active){
        dot && dot.classList.add('is-live');
        if(text) text.textContent = 'Live now — ' + active.label;
      } else {
        dot && dot.classList.remove('is-live');
        // find next window
        var candidates = NEXT_LABELS.map(function(w){
          var deltaDays = (w.day - now.day + 7) % 7;
          var minutesUntil = deltaDays*24*60 + (w.start - now.minutes);
          if(minutesUntil <= 0) minutesUntil += 7*24*60;
          return {label:w.label, minutesUntil: minutesUntil};
        }).sort(function(a,b){ return a.minutesUntil - b.minutesUntil; });
        if(text) text.textContent = 'Not live right now — next stream ' + candidates[0].label;
      }
    });
  }
  updateLiveStatus();
  setInterval(updateLiveStatus, 60000);

  // ---------- Maps links: Apple Maps on iOS/macOS, Google Maps elsewhere ----------
  (function(){
    var isAppleDevice = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent) &&
      !window.MSStream;
    if(!isAppleDevice) return;
    document.querySelectorAll('a.maps-link').forEach(function(a){
      try {
        var url = new URL(a.href);
        var q = url.searchParams.get('q');
        if(q){ a.href = 'https://maps.apple.com/?q=' + encodeURIComponent(q); }
      } catch(err){ /* leave the Google Maps link as-is */ }
    });
  })();

  // ---------- Copy-to-call phone numbers ----------
  // tel: links fail inside this sandboxed preview, so phone numbers are
  // buttons that copy the number to the clipboard instead, with brief
  // text feedback on the button itself.
  document.addEventListener('click', function(e){
    var btn = e.target.closest('[data-phone]');
    if(!btn) return;
    var display = btn.getAttribute('data-phone-display') || btn.getAttribute('data-phone');
    var original = btn.dataset.originalText;
    if(original === undefined){
      original = btn.textContent;
      btn.dataset.originalText = original;
    }
    function showCopied(){
      btn.textContent = 'Copied ' + display;
      btn.classList.add('is-copied');
      clearTimeout(btn._copyTimeout);
      btn._copyTimeout = setTimeout(function(){
        btn.textContent = btn.dataset.originalText;
        btn.classList.remove('is-copied');
      }, 1800);
    }
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(display).then(showCopied, showCopied);
    } else {
      showCopied();
    }
  });

  // ---------- Mobile nav drawer ----------
  var menuToggle = document.querySelector('.menu-toggle');
  var mobileNav = document.getElementById('mobileNav');
  var mobileBackdrop = document.getElementById('mobileNavBackdrop');
  var mobileNavClose = document.querySelector('.mobile-nav-close');
  if(menuToggle && mobileNav && mobileBackdrop){
    function closeMobileNav(){
      menuToggle.classList.remove('is-open');
      menuToggle.setAttribute('aria-expanded', 'false');
      mobileNav.classList.remove('is-open');
      mobileBackdrop.classList.remove('is-open');
      document.body.classList.remove('nav-open');
    }
    function openMobileNav(){
      menuToggle.classList.add('is-open');
      menuToggle.setAttribute('aria-expanded', 'true');
      mobileNav.classList.add('is-open');
      mobileBackdrop.classList.add('is-open');
      document.body.classList.add('nav-open');
    }
    menuToggle.addEventListener('click', function(){
      if(mobileNav.classList.contains('is-open')){ closeMobileNav(); } else { openMobileNav(); }
    });
    mobileBackdrop.addEventListener('click', closeMobileNav);
    if(mobileNavClose) mobileNavClose.addEventListener('click', closeMobileNav);
    mobileNav.querySelectorAll('a').forEach(function(a){
      a.addEventListener('click', closeMobileNav);
    });
    document.addEventListener('keydown', function(e){
      if(e.key === 'Escape') closeMobileNav();
    });
    window.addEventListener('resize', function(){
      if(window.innerWidth > 980) closeMobileNav();
    });
  }
})();

// ---------- Site feedback / ticket widget ----------
// A floating button that lets ANYONE (no sign-in, just a typed name) click
// any element on the page and submit a ticket, without ever leaving the
// site. This relies on fetch() POSTs to an external Google Form endpoint,
// which only works on a real, normally-hosted page -- earlier testing
// inside the claude.ai Artifact preview tool (a sandboxed iframe that
// blocks essentially all outbound requests/navigation except Google
// Fonts) ruled out an embedded iframe, window.open()/new tabs, and even a
// hidden <form> POST, before fetch() was confirmed to work once deployed
// here on GitHub Pages. A no-cors POST can't be read (opaque response),
// but Google's formResponse endpoint doesn't send back anything useful to
// read anyway -- the promise still resolves/rejects based on whether the
// request actually went out, which is enough to show a real error instead
// of a false "Thanks". Responses land in a Sheet Caleb manages directly --
// a Status value per row is the queue.
(function(){
  var FORM_ID = '1FAIpQLSewJ7ixjmGK5atQfAP9Jnb5OpLOrg4Dc9-UjvC_MUA4_OQzyQ';
  var ACTION_URL = 'https://docs.google.com/forms/d/e/' + FORM_ID + '/formResponse';
  var ENTRY_NAME = 'entry.431702534';
  var ENTRY_PAGE = 'entry.222459965';
  var ENTRY_NOTE = 'entry.22561278';

  var active = false;

  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'feedback-fab';
  btn.textContent = 'Leave Feedback';
  document.body.appendChild(btn);

  var hint = document.createElement('div');
  hint.className = 'feedback-hint';
  hint.textContent = 'Click anything on the page to flag it — Esc for general feedback instead';
  document.body.appendChild(hint);

  var hoverBox = document.createElement('div');
  hoverBox.className = 'feedback-hoverbox';
  document.body.appendChild(hoverBox);

  // ---- modal: a real form, not an embed of Google's own ----
  var overlay = document.createElement('div');
  overlay.className = 'feedback-modal-overlay';
  overlay.innerHTML =
    '<div class="feedback-modal" role="dialog" aria-label="Site feedback">' +
      '<button type="button" class="feedback-modal-close" aria-label="Close">&times;</button>' +
      '<h3 class="feedback-modal-title">Leave feedback</h3>' +
      '<p class="feedback-modal-page"></p>' +
      '<form class="feedback-form">' +
        '<label>Your name<input type="text" name="' + ENTRY_NAME + '" required></label>' +
        '<label>What should we fix or change?<textarea name="' + ENTRY_NOTE + '" rows="4" required></textarea></label>' +
        '<input type="hidden" name="' + ENTRY_PAGE + '">' +
        '<button type="submit" class="btn btn-primary">Submit ticket</button>' +
      '</form>' +
      '<p class="feedback-modal-thanks">Thanks &mdash; that&rsquo;s on Caleb&rsquo;s list now.</p>' +
      '<p class="feedback-modal-error" style="display:none;">Something went wrong sending that &mdash; mind trying again in a moment?</p>' +
    '</div>';
  document.body.appendChild(overlay);
  var modalClose = overlay.querySelector('.feedback-modal-close');
  var modalPage = overlay.querySelector('.feedback-modal-page');
  var form = overlay.querySelector('.feedback-form');
  var nameField = form.querySelector('[name="' + ENTRY_NAME + '"]');
  var noteField = form.querySelector('[name="' + ENTRY_NOTE + '"]');
  var pageField = form.querySelector('[name="' + ENTRY_PAGE + '"]');

  function describeElement(el){
    if(!el || el === document.body || el === document.documentElement) return '';
    var text = (el.textContent || '').trim().replace(/\s+/g, ' ');
    if(text.length > 60) text = text.slice(0, 60) + '…';
    var label = el.id ? '#' + el.id : (el.className && typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName.toLowerCase());
    return text ? (label + ' — "' + text + '"') : label;
  }

  function openForm(note){
    var page = location.pathname.split('/').pop() || 'index.html';
    pageField.value = page;
    modalPage.textContent = 'About: ' + page;
    nameField.value = '';
    noteField.value = note || '';
    form.classList.remove('is-hidden');
    overlay.querySelector('.feedback-modal-thanks').classList.remove('is-visible');
    overlay.classList.add('is-open');
    document.body.classList.add('feedback-modal-open');
    setTimeout(function(){ nameField.focus(); }, 50);
  }

  function closeForm(){
    overlay.classList.remove('is-open');
    document.body.classList.remove('feedback-modal-open');
  }

  function isOwnWidget(el){
    return !!(el && el.closest && el.closest('.feedback-fab, .feedback-hint, .feedback-hoverbox, .feedback-modal-overlay'));
  }

  function setActive(on){
    active = on;
    document.body.classList.toggle('feedback-mode', on);
    btn.classList.toggle('is-active', on);
    btn.textContent = on ? 'Cancel' : 'Leave Feedback';
    hoverBox.style.display = on ? 'block' : 'none';
    if(!on){ hoverBox.style.width = '0px'; hoverBox.style.height = '0px'; }
  }

  document.addEventListener('mousemove', function(e){
    if(!active) return;
    var el = document.elementFromPoint(e.clientX, e.clientY);
    if(!el || isOwnWidget(el)){ hoverBox.style.width = '0px'; hoverBox.style.height = '0px'; return; }
    var r = el.getBoundingClientRect();
    hoverBox.style.left = (r.left + window.scrollX) + 'px';
    hoverBox.style.top = (r.top + window.scrollY) + 'px';
    hoverBox.style.width = r.width + 'px';
    hoverBox.style.height = r.height + 'px';
  }, { passive: true });

  // Capture phase so picking mode intercepts the click before the page's
  // own links/buttons act on it (otherwise clicking a nav link while
  // picking would navigate away instead of opening the form).
  document.addEventListener('click', function(e){
    if(!active) return;
    if(isOwnWidget(e.target)) return; // let the widget's own controls work normally
    e.preventDefault();
    e.stopPropagation();
    var note = describeElement(e.target);
    setActive(false);
    openForm(note);
  }, true);

  document.addEventListener('keydown', function(e){
    if(e.key !== 'Escape') return;
    if(active){ setActive(false); openForm(''); }
    else if(overlay.classList.contains('is-open')){ closeForm(); }
  });

  btn.addEventListener('click', function(){
    setActive(!active);
  });

  modalClose.addEventListener('click', closeForm);
  overlay.addEventListener('click', function(e){
    if(e.target === overlay) closeForm();
  });

  form.addEventListener('submit', function(e){
    e.preventDefault();
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    var body = new URLSearchParams();
    body.set(ENTRY_NAME, nameField.value);
    body.set(ENTRY_NOTE, noteField.value);
    body.set(ENTRY_PAGE, pageField.value);
    var errorEl = overlay.querySelector('.feedback-modal-error');
    errorEl.style.display = 'none';
    // mode:'no-cors' means the response can't be read (opaque) -- Google's
    // formResponse endpoint doesn't send back anything useful to read
    // anyway. The promise still resolves/rejects based on whether the
    // request actually went out over the network, which is enough signal
    // to tell a real send from a blocked one.
    fetch(ACTION_URL, { method: 'POST', mode: 'no-cors', body: body })
      .then(function(){
        form.classList.add('is-hidden');
        overlay.querySelector('.feedback-modal-thanks').classList.add('is-visible');
        setTimeout(closeForm, 1800);
      })
      .catch(function(){
        submitBtn.disabled = false;
        errorEl.style.display = 'block';
      });
  });
})();


// ---------- Feedback queue (feedback-queue.html only) ----------
// Reads the feedback form's response Sheet, published read-only as CSV, and
// renders every ticket client-side. Only runs on the one page that has the
// #ticketList container -- a no-op everywhere else.
(function(){
  var list = document.getElementById('ticketList');
  if(!list) return;

  var CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTK1ealeGJa5LFfmeMvGJ_WC--dR4Pvk2c-snR-2rXSFUEaptU_77stFj52Ohhisbs0OmhStcGwfUud/pub?gid=365415904&single=true&output=csv';
  var filtersEl = document.getElementById('ticketFilters');
  var emptyEl = document.getElementById('ticketEmpty');
  var errorEl = document.getElementById('ticketError');
  var STATUS_ORDER = ['New', 'In Progress', 'Done'];
  var currentFilter = 'All';
  var tickets = [];

  // Minimal RFC4180 CSV parser -- handles quoted fields, embedded commas,
  // embedded newlines, and "" escaped quotes, which plain .split(',') can't.
  function parseCSV(text){
    var rows = [], row = [], field = '', i = 0, inQuotes = false;
    while(i < text.length){
      var c = text[i];
      if(inQuotes){
        if(c === '"'){
          if(text[i + 1] === '"'){ field += '"'; i += 2; continue; }
          inQuotes = false; i++; continue;
        }
        field += c; i++; continue;
      }
      if(c === '"'){ inQuotes = true; i++; continue; }
      if(c === ','){ row.push(field); field = ''; i++; continue; }
      if(c === '\r'){ i++; continue; }
      if(c === '\n'){ row.push(field); rows.push(row); row = []; field = ''; i++; continue; }
      field += c; i++;
    }
    if(field.length || row.length){ row.push(field); rows.push(row); }
    return rows;
  }

  function escapeHtml(s){
    return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function normalizeStatus(raw){
    var s = (raw || '').trim();
    if(/^in.?progress$/i.test(s)) return 'In Progress';
    if(/^done|resolved|complete/i.test(s)) return 'Done';
    return 'New'; // blank, "New", or anything unrecognized defaults to New
  }

  function statusClass(status){
    return 'ticket-status-' + status.toLowerCase().replace(/\s+/g, '-');
  }

  function render(){
    list.innerHTML = '';
    var shown = tickets.filter(function(t){ return currentFilter === 'All' || t.status === currentFilter; });
    if(!shown.length){
      emptyEl.style.display = 'block';
      emptyEl.textContent = tickets.length ? 'No tickets with that status.' : 'No tickets yet.';
      return;
    }
    emptyEl.style.display = 'none';
    shown.forEach(function(t){
      var card = document.createElement('div');
      card.className = 'ticket-card';
      card.innerHTML =
        '<div class="ticket-card-top">' +
          '<span class="ticket-status ' + statusClass(t.status) + '">' + escapeHtml(t.status) + '</span>' +
          '<span class="ticket-page">' + escapeHtml(t.page) + '</span>' +
          '<span class="ticket-time">' + escapeHtml(t.timestamp) + '</span>' +
        '</div>' +
        '<p class="ticket-message">' + escapeHtml(t.message) + '</p>' +
        '<p class="ticket-name">&mdash; ' + escapeHtml(t.name || 'Anonymous') + '</p>';
      list.appendChild(card);
    });
  }

  function renderFilters(){
    var counts = { All: tickets.length };
    STATUS_ORDER.forEach(function(s){ counts[s] = 0; });
    tickets.forEach(function(t){ counts[t.status] = (counts[t.status] || 0) + 1; });
    var options = ['All'].concat(STATUS_ORDER);
    filtersEl.innerHTML = options.map(function(s){
      return '<button type="button" class="tag-pill ticket-filter' + (s === currentFilter ? ' is-active' : '') + '" data-status="' + escapeHtml(s) + '">' + escapeHtml(s) + ' (' + (counts[s] || 0) + ')</button>';
    }).join('');
    Array.prototype.forEach.call(filtersEl.querySelectorAll('.ticket-filter'), function(btn){
      btn.addEventListener('click', function(){
        currentFilter = btn.getAttribute('data-status');
        renderFilters();
        render();
      });
    });
  }

  fetch(CSV_URL, { cache: 'no-store' }).then(function(res){
    if(!res.ok) throw new Error('bad response');
    return res.text();
  }).then(function(text){
    var rows = parseCSV(text).filter(function(r){ return r.length > 1 || (r[0] || '').trim() !== ''; });
    rows.shift(); // header row: Timestamp, Email Address, Name, Page you were on, What should we fix or change, Status
    tickets = rows.map(function(r){
      return {
        timestamp: r[0] || '',
        name: r[2] || '',
        page: r[3] || '',
        message: r[4] || '',
        status: normalizeStatus(r[5])
      };
    }).reverse(); // newest first
    renderFilters();
    render();
  }).catch(function(){
    errorEl.style.display = 'block';
  });
})();
