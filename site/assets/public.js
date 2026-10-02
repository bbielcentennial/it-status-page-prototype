/* Public pages: status home, incident detail, history, planned-work notices, embed widget. */
(function () {
  'use strict';
  const C = window.CC;
  const esc = C.esc;
  const s = C.getState();
  const page = document.body.dataset.page;
  const main = document.getElementById('content');
  const params = new URLSearchParams(location.search);

  const proto = document.getElementById('proto');
  if (proto) proto.innerHTML = C.protoBanner(s, '<a href="/admin/">Try the staff admin mockup</a>');

  const okIcon = () => C.icon('operational').replace('class="si"', 'class="si" style="color:var(--ok)"');

  // ---------------- home ----------------
  function renderHome() {
    const o = C.overall(s);
    const active = C.activeIncidents(s);
    const planned = C.upcomingNotices(s).filter((n) => new Date(n.starts_at) - Date.now() < 14 * C.DAY);
    const recent = C.resolvedIncidents(s).filter((i) => Date.now() - new Date(i.resolved_at) < 14 * C.DAY);
    const comps = C.visibleComponents(s);
    const groups = C.GROUPS.map((g) => ({ g, items: comps.filter((c) => c.group === g) })).filter((x) => x.items.length);
    document.title = (o.status === 'operational' ? '' : 'Issues: ') + 'IT System Status | Centennial College (prototype)';

    const compNote = (c) => {
      const n = s.notices.find((x) => x.services.some((y) => y.key === c.key) && ['scheduled', 'in_progress'].includes(C.noticeState(x)) && new Date(x.starts_at) - Date.now() < 7 * C.DAY);
      if (!n) return '';
      return `<p class="comp-note">${C.icon('maintenance').replace('class="si"', 'class="si" style="color:var(--maint)"')} ${C.noticeState(n) === 'in_progress' ? 'Planned work in progress' : 'Planned work ' + esc(C.when(n.starts_at))}: <a href="${C.noticePath(n.slug)}">${esc(n.title)}</a></p>`;
    };

    main.innerHTML = `
      <section aria-labelledby="overall-h">
        <div class="overall st-${o.status}">
          ${C.icon(o.status)}
          <div>
            <h1 id="overall-h" tabindex="-1">${esc(o.text)}</h1>
            <p>Last updated ${esc(C.when(s.last_change_at))}</p>
          </div>
        </div>
      </section>

      <section aria-labelledby="h-active">
        <div class="section-head"><h2 id="h-active">Active incidents</h2>${active.length ? `<span class="small">${active.length} active</span>` : ''}</div>
        ${active.length ? active.map((i) => C.incidentCard(s, i)).join('') : `<div class="card empty">${okIcon()} <span>No active incidents.</span></div>`}
      </section>

      <section aria-labelledby="h-planned">
        <div class="section-head"><h2 id="h-planned">Planned work</h2><a href="/notices.html" class="small">All planned work, filters and calendar</a></div>
        ${planned.length ? planned.map((n) => C.noticeCard(s, n)).join('') : '<div class="card empty">No planned work in the next 14 days.</div>'}
      </section>

      <section aria-labelledby="h-svc">
        <div class="section-head"><h2 id="h-svc">Service status</h2><span class="small">Bars show the past 90 days, oldest on the left</span></div>
        ${groups.map(({ g, items }) => `
          <div class="card group" role="group" aria-labelledby="g-${esc(g.replace(/\W+/g, '-'))}">
            <h3 id="g-${esc(g.replace(/\W+/g, '-'))}">${esc(g)}</h3>
            ${items.map((c) => {
              const b = C.dailyBars(s, c.key);
              const st = C.effStatus(s, c);
              const bad = b.days.filter((d) => d.st !== 'operational').length;
              return `<div class="comp" id="svc-${esc(c.key)}">
                <div class="comp-top">
                  <div><div class="comp-name">${esc(c.name)}</div><div class="comp-desc">${esc(c.description)}</div></div>
                  ${C.pill(st)}
                </div>
                ${compNote(c)}
                <div class="bars" role="img" aria-label="${esc(c.name)}, past 90 days: ${bad ? bad + ' day' + (bad > 1 ? 's' : '') + ' with incidents or maintenance' : 'no incidents'}, ${b.uptime}% uptime.">
                  ${b.days.map((d) => `<span class="d-${d.st}" title="${esc(d.label)}: ${esc(C.STATUS[d.st].label)}"></span>`).join('')}
                </div>
                <div class="bars-legend" aria-hidden="true"><span class="full">90 days ago</span><span class="short">30 days ago</span><span>${b.uptime}% uptime</span><span>Today</span></div>
              </div>`;
            }).join('')}
          </div>`).join('')}
      </section>

      <section aria-labelledby="h-recent">
        <div class="section-head"><h2 id="h-recent">Recently resolved</h2><a href="/history.html" class="small">Incident history</a></div>
        <div class="card" style="padding:0">
          ${recent.length ? `<ul class="list">${recent.map((i) => `<li>
            <a href="/incident.html?id=${encodeURIComponent(i.public_id)}">${esc(i.title)}</a>
            <div class="small muted">${esc(C.when(i.started_at))}, resolved after ${esc(C.dur(new Date(i.resolved_at) - new Date(i.started_at)))}</div>
          </li>`).join('')}</ul>` : '<div class="empty">No incidents in the past 14 days.</div>'}
        </div>
      </section>`;
  }

  // ---------------- incident ----------------
  function renderIncident() {
    const id = params.get('id');
    const inc = id && C.findIncident(s, id);
    if (!inc) {
      main.innerHTML = `<a class="back" href="/">Current status</a><div class="card"><h1 class="page-title" tabindex="-1">Incident not found</h1><p>This incident may belong to a different demo scenario. <a href="/history.html">Browse incident history</a>.</p></div>`;
      return;
    }
    document.title = inc.title + ' | IT System Status (prototype)';
    const duration = inc.resolved_at ? C.dur(new Date(inc.resolved_at) - new Date(inc.started_at)) : null;
    const done = inc.state === 'resolved';
    main.innerHTML = `
      <a class="back" href="/">Current status</a>
      <section>
        <h1 class="page-title" tabindex="-1">${esc(inc.title)}</h1>
        <div class="meta-row">${C.sevBadge(inc.severity)} ${C.stateBadge(inc.state)}</div>
        <dl class="kv">
          <dt>Started</dt><dd>${esc(C.when(inc.started_at))}</dd>
          ${done ? `<dt>Resolved</dt><dd>${esc(C.when(inc.resolved_at))} (lasted ${esc(duration)})</dd>` : `<dt>Last update</dt><dd>${esc(C.when(inc.updated_at))} (${C.agoSpan(inc.updated_at)})</dd>`}
          ${!done && inc.next_update_at ? `<dt>Next update</dt><dd>Expected by ${esc(C.when(inc.next_update_at))}</dd>` : ''}
        </dl>
        <h2 class="small" style="margin-top:16px">Affected services</h2>
        <ul class="chips">${inc.components.map((c) => { const st = done ? 'operational' : c.impact; return `<li class="chip st-${st}">${C.icon(st)}<span>${esc(C.compName(s, c.key))}: ${esc(C.STATUS[st].label)}</span></li>`; }).join('')}</ul>
      </section>
      <section aria-labelledby="h-tl">
        <div class="section-head"><h2 id="h-tl">Updates</h2><span class="small">Oldest first. Times are Eastern Time.</span></div>
        <div class="card">
          <ol class="timeline">
            ${inc.updates.map((u) => `<li class="tl-${u.state}"><span class="dot" aria-hidden="true"></span>
              <h3>${esc(C.cap(u.state))} <time datetime="${esc(u.at)}">${esc(C.when(u.at))}</time></h3>
              <p>${esc(u.message)}</p></li>`).join('')}
          </ol>
        </div>
      </section>`;
  }

  // ---------------- history ----------------
  function renderHistory() {
    const all = s.incidents.slice().sort((a, b) => b.started_at.localeCompare(a.started_at));
    const byMonth = {};
    all.forEach((i) => { (byMonth[C.monthOf(i.started_at)] = byMonth[C.monthOf(i.started_at)] || []).push(i); });
    main.innerHTML = `
      <section><h1 class="page-title" tabindex="-1">Incident history</h1><p class="lede">Unplanned incidents in the past 90 days. Select an incident for its full timeline. For planned work, see <a href="/notices.html">Planned work</a>.</p></section>
      ${Object.entries(byMonth).map(([mon, list]) => `
        <section aria-labelledby="m-${esc(mon.replace(/\W+/g, '-'))}">
          <div class="section-head"><h2 id="m-${esc(mon.replace(/\W+/g, '-'))}">${esc(mon)}</h2></div>
          <div class="card" style="padding:0"><ul class="list">${list.map((i) => `<li>
            <a href="/incident.html?id=${encodeURIComponent(i.public_id)}">${esc(i.title)}</a>
            <div class="meta-row" style="margin:6px 0">${C.sevBadge(i.severity)} ${C.stateBadge(i.state)}</div>
            <div class="small muted">${esc(C.when(i.started_at))}${i.resolved_at ? ', lasted ' + esc(C.dur(new Date(i.resolved_at) - new Date(i.started_at))) : ', ongoing'}. ${i.components.map((c) => esc(C.compName(s, c.key))).join(', ')}</div>
          </li>`).join('')}</ul></div>
        </section>`).join('')}`;
  }

  // ---------------- planned work list ----------------
  function filterNotices(list, f) {
    return list.filter((n) =>
      (!f.audience || n.audiences.includes(f.audience)) &&
      (!f.campus || n.campuses.includes(f.campus) || n.campuses.includes('all')) &&
      (!f.service || n.services.some((x) => x.key === f.service)));
  }
  function renderNotices() {
    const f = { audience: params.get('audience') || '', campus: params.get('campus') || '', service: params.get('service') || '' };
    const sel = (name, label, map, v) => `<div class="field"><label for="f-${name}">${label}</label><select id="f-${name}" name="${name}"><option value="">All</option>${Object.entries(map).map(([k, l]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select></div>`;
    const svcMap = Object.fromEntries(C.visibleComponents(s).map((c) => [c.key, c.name]));
    const campusMap = Object.fromEntries(Object.entries(C.CAMPUSES).filter(([k]) => k !== 'all'));
    const list = filterNotices(s.notices, f);
    const now = list.filter((n) => C.noticeState(n) === 'in_progress');
    const up = list.filter((n) => C.noticeState(n) === 'scheduled').sort((a, b) => a.starts_at.localeCompare(b.starts_at));
    const cancelled = list.filter((n) => C.noticeState(n) === 'cancelled' && new Date(n.starts_at) > Date.now());
    const past = list.filter((n) => C.noticeState(n) === 'completed' && Date.now() - new Date(n.ends_at) < 30 * C.DAY).sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    const filtered = f.audience || f.campus || f.service;
    const shareUrl = location.origin + '/notices.html' + (filtered ? '?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString() : '');
    const embedUrl = location.origin + '/embed.html' + (filtered ? '?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v)).toString() : '');
    const block = (id, title, items, empty) => `<section aria-labelledby="${id}">
        <div class="section-head"><h2 id="${id}">${title}</h2>${items.length ? `<span class="small">${items.length} notice${items.length > 1 ? 's' : ''}</span>` : ''}</div>
        ${items.length ? items.map((n) => C.noticeCard(s, n)).join('') : `<div class="card empty">${empty}</div>`}
      </section>`;

    main.innerHTML = `
      <section>
        <h1 class="page-title" tabindex="-1">Planned work</h1>
        <p class="lede">Upcoming maintenance and changes that will affect college IT services. Every notice has a permanent link you can share in emails, course announcements or on posters. The link keeps working if the work is rescheduled or cancelled.</p>
      </section>

      <section aria-labelledby="h-filter">
        <h2 id="h-filter" class="sr-only">Filter planned work</h2>
        <form class="card filters" method="get" action="/notices.html">
          ${sel('audience', 'Who', C.AUDIENCES, f.audience)}
          ${sel('campus', 'Campus', campusMap, f.campus)}
          ${sel('service', 'Service', svcMap, f.service)}
          <div class="btn-row" style="margin:0"><button class="btn dark" type="submit">Apply filters</button>${filtered ? '<a class="btn" href="/notices.html">Clear</a>' : ''}</div>
        </form>
        <p class="small" role="status">${filtered ? `Showing notices for: ${[f.audience && C.AUDIENCES[f.audience], f.campus && C.CAMPUSES[f.campus], f.service && svcMap[f.service]].filter(Boolean).map(esc).join(', ')}.` : 'Showing all notices.'}</p>
      </section>

      ${block('h-now', 'Happening now', now, 'No planned work is in progress.')}
      ${block('h-up', 'Upcoming', up, 'No upcoming planned work matches these filters.')}
      ${cancelled.length ? block('h-cx', 'Cancelled', cancelled, '') : ''}

      <section aria-labelledby="h-sub">
        <div class="section-head"><h2 id="h-sub">Stay informed</h2></div>
        <div class="card">
          <h3>Add to your calendar</h3>
          <p>Download the ${filtered ? 'filtered' : ''} upcoming notices as a calendar file for Outlook, Google Calendar or Apple Calendar.</p>
          <button class="btn primary" type="button" id="ics-all"${up.length + now.length ? '' : ' disabled'}>Download calendar file (.ics)</button>
          <h3 style="margin-top:20px">Share this list</h3>
          <p>Link to this view${filtered ? ', with your filters applied,' : ''} from a website, email or course page.</p>
          <div class="copy-row"><label class="sr-only" for="share-list">Link to this list</label><input id="share-list" type="text" readonly value="${esc(shareUrl)}"><button class="btn" type="button" data-copy="share-list">Copy link</button></div>
          <h3 style="margin-top:20px">Show planned work on another website</h3>
          <p>Paste this into a department site, intranet page or eCentennial widget. It shows the same filtered list and stays current.</p>
          <label class="sr-only" for="embed-code">Embed code</label>
          <textarea id="embed-code" readonly rows="3" style="min-height:0;font-family:ui-monospace,Consolas,monospace;font-size:.85rem">&lt;iframe src="${esc(embedUrl)}" title="Centennial College IT planned work" width="100%" height="420" style="border:0"&gt;&lt;/iframe&gt;</textarea>
          <div class="btn-row" style="margin-top:8px"><button class="btn" type="button" data-copy="embed-code">Copy embed code</button><a class="btn" href="${esc(embedUrl)}">Preview widget</a></div>
          <p class="small muted" style="margin-top:12px">Planned for production: RSS feed and <code>GET /api/v1/notices</code> so other systems can pull notices automatically.</p>
        </div>
      </section>

      ${past.length ? `<section aria-labelledby="h-past"><div class="section-head"><h2 id="h-past">Completed in the past 30 days</h2></div>
        <div class="card" style="padding:0"><ul class="list">${past.map((n) => `<li><a href="${C.noticePath(n.slug)}">${esc(n.title)}</a><div class="small muted">${esc(C.when(n.starts_at))} to ${esc(C.time(n.ends_at))}</div></li>`).join('')}</ul></div></section>` : ''}`;

    document.getElementById('ics-all').onclick = () => {
      C.download('centennial-it-planned-work.ics', 'text/calendar', C.ics(now.concat(up)));
      C.toast('Calendar file downloaded.');
    };
  }

  // ---------------- single notice (permanent link) ----------------
  function slugFromUrl() {
    const m = location.pathname.match(/^\/n\/([a-z0-9-]+)\/?$/i);
    return m ? decodeURIComponent(m[1]) : params.get('n');
  }
  function renderNotice() {
    const n = C.noticeBySlug(s, slugFromUrl());
    if (!n) {
      main.innerHTML = `<a class="back" href="/notices.html">All planned work</a><div class="card"><h1 class="page-title" tabindex="-1">Notice not found</h1><p>We couldn't find this notice. It may belong to a different demo scenario. See <a href="/notices.html">all planned work</a>.</p></div>`;
      return;
    }
    const st = C.noticeState(n);
    const url = C.noticeUrl(n.slug);
    document.title = (st === 'cancelled' ? 'Cancelled: ' : '') + n.title + ' | Planned work | IT System Status (prototype)';
    const emailText = `${n.title}\n${C.when(n.starts_at)} to ${C.when(n.ends_at)}\n\n${n.summary}\n\nDetails and updates: ${url}`;

    const stateCallout = {
      cancelled: `<div class="callout cancel" role="note"><h2>This work has been cancelled</h2><p>${esc(n.history[n.history.length - 1].text.replace(/^Cancell?ed\.\s*/, ''))} Services will not be affected on this date.</p></div>`,
      completed: `<div class="callout" role="note"><h2>This work is complete</h2><p>It ended ${esc(C.when(n.ends_at))}. If you are still having problems, check the <a href="/">current status</a> or contact the IT Service Desk.</p></div>`,
      in_progress: `<div class="callout" role="note"><h2>This work is happening now</h2><p>It is expected to finish ${esc(C.when(n.ends_at))} (<span data-countdown="${esc(n.slug)}">${esc(C.countdown(n))}</span>).</p></div>`,
      scheduled: '',
    }[st];

    main.innerHTML = `
      <a class="back" href="/notices.html">All planned work</a>
      <article aria-labelledby="notice-title">
        <div class="card notice-head">
          <p class="small" style="margin:0 0 6px;font-weight:700;text-transform:uppercase;letter-spacing:.06em">Planned work notice</p>
          <h1 id="notice-title" class="page-title" tabindex="-1">${esc(n.title)}</h1>
          <div class="meta-row">${C.noticeBadge(n)}${st === 'scheduled' ? ` <span class="countdown"><span data-countdown="${esc(n.slug)}">${esc(C.countdown(n))}</span></span>` : ''}</div>
          <dl class="kv">
            <dt>Starts</dt><dd>${st === 'cancelled' ? '<del>' : ''}<time datetime="${esc(n.starts_at)}">${esc(C.when(n.starts_at))}</time>${st === 'cancelled' ? '</del>' : ''}</dd>
            <dt>Ends</dt><dd>${st === 'cancelled' ? '<del>' : ''}<time datetime="${esc(n.ends_at)}">${esc(C.when(n.ends_at))}</time>${st === 'cancelled' ? '</del>' : ''} (${esc(C.dur(new Date(n.ends_at) - new Date(n.starts_at)))})</dd>
            <dt>Who's affected</dt><dd>${esc(C.audienceText(n))}</dd>
            <dt>Where</dt><dd>${esc(C.campusText(n))}</dd>
          </dl>
          ${stateCallout}
          <p class="lede" style="margin-top:14px">${esc(n.summary)}</p>
        </div>

        ${st !== 'cancelled' && st !== 'completed' && n.actions.length ? `<section class="card" aria-labelledby="h-do" style="margin-top:16px">
          <h2 id="h-do">What you need to do</h2>
          <ul class="actions-list">${n.actions.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>
        </section>` : ''}

        <section class="card" aria-labelledby="h-aff" style="margin-top:16px">
          <h2 id="h-aff">Services affected</h2>
          <div class="table-scroll" style="margin-top:8px"><table>
            <caption class="sr-only">Services affected and expected impact</caption>
            <thead><tr><th scope="col">Service</th><th scope="col">Expected impact</th><th scope="col">Status now</th></tr></thead>
            <tbody>${n.services.map((x) => { const c = s.components.find((y) => y.key === x.key); return `<tr><td><a href="/#svc-${esc(x.key)}">${esc(C.compName(s, x.key))}</a></td><td>${esc(C.IMPACTS[x.impact])}</td><td>${c ? C.pill(C.effStatus(s, c)) : ''}</td></tr>`; }).join('')}</tbody>
          </table></div>
          ${n.description ? `<h2 style="margin-top:18px;font-size:1.05rem">Details</h2>
          <p style="white-space:pre-line;max-width:75ch">${esc(n.description)}</p>` : ''}
        </section>

        <section class="card" aria-labelledby="h-share" style="margin-top:16px">
          <h2 id="h-share">Share or save this notice</h2>
          <div class="share" style="margin-top:10px">
            <div>
              <label for="perma">Permanent link</label>
              <span class="hint" id="perma-hint">This link will always show the latest information, even if the date changes.</span>
              <div class="copy-row"><input id="perma" type="text" readonly value="${esc(url)}" aria-describedby="perma-hint"><button class="btn" type="button" data-copy="perma">Copy link</button></div>
              <div class="btn-row">
                ${st === 'completed' || st === 'cancelled' ? '' : '<button class="btn primary" type="button" id="ics-one">Add to calendar (.ics)</button>'}
                <button class="btn" type="button" id="copy-email">Copy text for an email or announcement</button>
                <button class="btn" type="button" id="print">Print a poster</button>
              </div>
            </div>
            <figure style="margin:0">
              <div class="qr" id="qr" role="img" aria-label="QR code that opens ${esc(url)}"></div>
              <figcaption class="small" style="margin-top:6px;max-width:152px">Scan to open this notice. For posters and screens.</figcaption>
            </figure>
          </div>
        </section>

        <section class="card" aria-labelledby="h-hist" style="margin-top:16px">
          <h2 id="h-hist">Changes to this notice</h2>
          <ul class="timeline-mini">${n.history.slice().reverse().map((h) => `<li><time datetime="${esc(h.at)}">${esc(C.when(h.at))}</time> ${esc(h.text)}</li>`).join('')}</ul>
          ${n.external_ref ? `<p class="small muted" style="margin-top:8px">Reference: ${esc(n.external_ref)}</p>` : ''}
        </section>
      </article>`;

    const ics = document.getElementById('ics-one');
    if (ics) ics.onclick = () => { C.download(n.slug + '.ics', 'text/calendar', C.ics([n])); C.toast('Calendar file downloaded.'); };
    document.getElementById('copy-email').onclick = () => copyText(emailText, 'Email text copied.');
    document.getElementById('print').onclick = () => window.print();
    const qr = document.getElementById('qr');
    if (window.QRCode) {
      new window.QRCode(qr, { text: url, width: 260, height: 260, correctLevel: window.QRCode.CorrectLevel.M });
      [...qr.children].forEach((el) => { el.setAttribute('aria-hidden', 'true'); el.removeAttribute('title'); });
      qr.removeAttribute('title');
    } else {
      qr.textContent = 'QR code unavailable offline.';
      qr.removeAttribute('role');
    }
  }

  // ---------------- embed widget ----------------
  function renderEmbed() {
    const f = { audience: params.get('audience') || '', campus: params.get('campus') || '', service: params.get('service') || '' };
    const list = filterNotices(C.upcomingNotices(s), f).filter((n) => C.noticeState(n) !== 'cancelled').slice(0, 4);
    const issues = C.activeIncidents(s).length;
    const qs = location.search;
    main.innerHTML = `
      <div class="embed-head"><h1>IT planned work</h1><a href="/notices.html${esc(qs)}" target="_blank" rel="noopener">See all<span class="sr-only"> planned work (opens in a new tab)</span></a></div>
      <div class="embed-body">
        ${issues ? `<p class="notice err" style="margin-top:0"><strong>${issues} active incident${issues > 1 ? 's' : ''}.</strong> <a href="/" target="_blank" rel="noopener">Check current status<span class="sr-only"> (opens in a new tab)</span></a></p>` : ''}
        ${list.length ? list.map((n) => C.noticeCard(s, n, { h: 'h2', compact: true, target: '_blank' })).join('') : '<p>No planned work coming up.</p>'}
        <p class="small muted"><span class="proto-tag">Prototype</span> Dummy data, not an official Centennial College service.</p>
      </div>`;
  }

  function copyText(text, msg) {
    (navigator.clipboard ? navigator.clipboard.writeText(text) : Promise.reject()).then(() => C.toast(msg), () => C.toast('Copy failed. Select the text and copy it manually.'));
  }
  main.addEventListener('click', (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const el = document.getElementById(b.dataset.copy);
    copyText(el.value, b.textContent.replace('Copy ', '').replace(/^./, (c) => c.toUpperCase()) + ' copied.');
  });

  const render = { home: renderHome, incident: renderIncident, history: renderHistory, notices: renderNotices, notice: renderNotice, embed: renderEmbed }[page];
  if (render) render();

  // ---------------- updates without moving the user's place ----------------
  // WCAG 2.2.1/2.2.2 + focus order: never silently re-render. Refresh relative times in place;
  // when the data itself changes, offer a "Show latest" button and announce it once.
  if (!render) return;
  let snapshot = JSON.stringify(s);
  let bar = null;
  function checkForChanges() {
    C.refreshRelative(main, s);
    const fresh = C.load();
    if (!fresh || JSON.stringify(fresh) === snapshot || bar) return;
    bar = document.createElement('div');
    bar.className = 'refresh-bar';
    bar.setAttribute('role', 'region');
    bar.setAttribute('aria-label', 'Page updates');
    bar.innerHTML = '<div class="wrap"><p>This page has new updates.</p><button class="btn sm" type="button">Show latest updates</button></div>';
    document.body.insertBefore(bar, document.querySelector('main'));
    C.toast('New status updates are available. Use the Show latest updates button near the top of the page.');
    bar.querySelector('button').onclick = () => {
      const latest = C.load();
      Object.keys(s).forEach((k) => delete s[k]);
      Object.assign(s, latest);
      snapshot = JSON.stringify(s);
      bar.remove(); bar = null;
      render();
      const h = main.querySelector('h1');
      if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
    };
  }
  window.addEventListener('storage', checkForChanges);
  setInterval(checkForChanges, 60000);
})();
