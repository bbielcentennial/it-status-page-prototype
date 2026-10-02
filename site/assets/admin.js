/* Admin mockup. Hash-routed views over the same localStorage demo state the
 * public page reads, so publishing here changes the public page (same browser). */
(function () {
  'use strict';
  const C = window.CC;
  const esc = C.esc;
  let s = C.getState();
  const app = document.getElementById('content');
  const USER = { id: 'demo.publisher', name: 'Demo Publisher', role: 'admin' };
  const AUTH = 'ccstatus-demo-auth';

  document.getElementById('proto').innerHTML = C.protoBanner(s, 'Any username, password and 6-digit code will sign you in.');

  const authed = () => { try { return sessionStorage.getItem(AUTH) === '2'; } catch (e) { return window.__auth === '2'; } };
  const authStep = () => { try { return sessionStorage.getItem(AUTH); } catch (e) { return window.__auth; } };
  const setAuth = (v) => { try { v ? sessionStorage.setItem(AUTH, v) : sessionStorage.removeItem(AUTH); } catch (e) { window.__auth = v; } };

  let reqN = 0;
  function audit(action, object, details, actor) {
    s.audit.unshift({ at: C.nowIso(), actor: actor || 'user:' + USER.id, action, object, ip: actor && actor.startsWith('integration') ? '198.51.100.24' : '203.0.113.42', request_id: 'req_' + (Date.now().toString(36).slice(-5)) + (++reqN), details: details || {} });
  }
  function commit(msg) { s.edited = true; s.last_change_at = C.nowIso(); C.save(s); if (msg) C.toast(msg); }

  const go = (h) => { location.hash = h; };
  const comp = (k) => s.components.find((c) => c.key === k);
  const activeComps = () => s.components.filter((c) => !c.archived).sort((a, b) => a.display_order - b.display_order);
  const $ = (id) => document.getElementById(id);

  // datetime-local <-> ISO (browser local time)
  const toLocal = (isoStr) => { const d = new Date(isoStr); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16); };
  const fromLocal = (v) => (v ? new Date(v).toISOString() : null);

  const statusOptions = (sel, withNone) =>
    (withNone ? `<option value="">No impact</option>` : '') +
    Object.entries(C.STATUS).map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(v.label)}</option>`).join('');
  const opts = (list, sel) => list.map((x) => `<option value="${x}"${x === sel ? ' selected' : ''}>${esc(C.cap(x))}</option>`).join('');

  // ---------- accessible form errors ----------
  // Error summary (focused, with links to each field) + inline message tied to the field via aria-describedby.
  const errBox = (id) => `<div id="${id}" class="notice err" tabindex="-1" hidden></div>`;
  function showErrors(boxId, errs) {
    const box = $(boxId);
    const form = box.closest('form') || app;
    form.querySelectorAll('[aria-invalid]').forEach((el) => {
      el.removeAttribute('aria-invalid');
      const d = (el.getAttribute('aria-describedby') || '').split(' ').filter((x) => !x.endsWith('-err')).join(' ');
      d ? el.setAttribute('aria-describedby', d) : el.removeAttribute('aria-describedby');
    });
    form.querySelectorAll('.field-error').forEach((e) => e.remove());
    if (!errs.length) { box.hidden = true; return false; }
    errs.forEach((e) => {
      const el = e.id && $(e.id);
      if (!el) return;
      el.setAttribute('aria-invalid', 'true');
      const p = document.createElement('p');
      p.className = 'field-error'; p.id = e.id + '-err'; p.textContent = e.msg;
      (el.closest('.checks') || el).insertAdjacentElement('afterend', p);
      el.setAttribute('aria-describedby', ((el.getAttribute('aria-describedby') || '') + ' ' + p.id).trim());
    });
    box.hidden = false;
    box.innerHTML = `<h2 style="font-size:1rem">${errs.length > 1 ? `There are ${errs.length} problems` : 'There is a problem'}</h2>
      <ul>${errs.map((e) => `<li>${e.id ? `<a href="#${e.id}" data-focus="${e.id}">${esc(e.msg)}</a>` : esc(e.msg)}</li>`).join('')}</ul>`;
    box.querySelectorAll('[data-focus]').forEach((a) => (a.onclick = (ev) => { ev.preventDefault(); $(a.dataset.focus).focus(); }));
    box.focus();
    return true;
  }
  function sensitive(t) {
    if (/\b\d{1,3}(\.\d{1,3}){3}\b/.test(t)) return 'an IP address';
    if (/\b[a-z0-9-]+\.(corp|local|internal|lan)\b/i.test(t) || /\b(srv|sql|db|vm)[-_]?[a-z0-9]*\d\b/i.test(t)) return 'a hostname';
    return null;
  }

  function managedBadge(inc) {
    return inc.managed_by === 'servicenow'
      ? '<span class="badge src">Managed by ServiceNow</span>'
      : `<span class="badge src">Managed manually${inc.manual_takeover ? ' (takeover)' : ''}</span>`;
  }

  function shell(active, body) {
    const nav = [['#/dashboard', 'Dashboard'], ['#/new', 'Create incident'], ['#/notices', 'Planned work'], ['#/components', 'Components'], ['#/audit', 'Audit log']];
    return `<div class="admin-shell">
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center">
        <nav class="admin-nav" aria-label="Admin"><ul>${nav.map(([h, l]) => `<li><a href="${h}"${h === active ? ' aria-current="page"' : ''}>${l}</a></li>`).join('')}</ul></nav>
        <p class="small" style="margin:0">Signed in as <strong>${esc(USER.name)}</strong> (local account, ${esc(USER.role)}). <a href="#/logout">Sign out</a></p>
      </div>
      ${body}
    </div>`;
  }
  const setTitle = (t) => { document.title = t + ' | Staff admin | IT System Status (prototype)'; };
  function focusHeading() { const h = app.querySelector('h1'); if (h) { h.setAttribute('tabindex', '-1'); h.focus(); } }

  // ---------- sign-in ----------
  function vLogin() {
    setTitle('Sign in');
    app.innerHTML = `<div class="card login-card">
      <h1 class="page-title">Staff sign-in</h1>
      <p>This is a local status-page account. It does <strong>not</strong> use college single sign-on, so it still works when college sign-in is down.</p>
      <form id="f" novalidate style="margin-top:14px">
        ${errBox('lerr')}
        <div class="field"><label for="u">Username</label><input id="u" type="text" autocomplete="username"></div>
        <div class="field"><label for="p">Password</label><input id="p" type="password" autocomplete="current-password"></div>
        <button class="btn primary" style="width:100%">Continue</button>
      </form>
      <p class="small muted" style="margin-top:12px">Demo: any username and password will work.</p>
    </div>`;
    $('f').onsubmit = (e) => {
      e.preventDefault();
      const errs = [];
      if (!$('u').value.trim()) errs.push({ id: 'u', msg: 'Enter your username.' });
      if (!$('p').value) errs.push({ id: 'p', msg: 'Enter your password.' });
      if (showErrors('lerr', errs)) return;
      setAuth('1'); go('#/mfa');
    };
  }

  function vMfa() {
    if (!authStep()) return go('#/login');
    setTitle('Two-step verification');
    app.innerHTML = `<div class="card login-card">
      <h1 class="page-title">Two-step verification</h1>
      <form id="f" novalidate style="margin-top:14px">
        ${errBox('merr')}
        <div class="field"><label for="c">Authentication code</label><span class="hint" id="c-hint">Enter the 6-digit code from your authenticator app.</span><input id="c" class="otp" type="text" inputmode="numeric" autocomplete="one-time-code" maxlength="6" aria-describedby="c-hint"></div>
        <button class="btn primary" style="width:100%">Verify and sign in</button>
      </form>
      <p class="small" style="margin-top:12px">Lost your device? Recovery codes would be used here (not part of this mockup).</p>
    </div>`;
    focusHeading();
    $('f').onsubmit = (e) => {
      e.preventDefault();
      if (showErrors('merr', /^\d{6}$/.test($('c').value.trim()) ? [] : [{ id: 'c', msg: 'Enter all 6 digits of the code.' }])) return;
      setAuth('2'); audit('auth.login.success', 'session', { mfa: 'totp' }); C.save(s); go('#/dashboard');
    };
  }

  // ---------- dashboard ----------
  function vDashboard() {
    setTitle('Dashboard');
    const active = C.activeIncidents(s);
    const planned = C.upcomingNotices(s);
    app.innerHTML = shell('#/dashboard', `
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center">
        <h1 class="page-title">Dashboard</h1>
        <div class="btn-row" style="margin:0"><a class="btn primary" href="#/new">Create incident</a><a class="btn" href="#/notice/new">New planned-work notice</a><a class="btn" href="/" target="_blank" rel="noopener">View public page<span class="sr-only"> (opens in a new tab)</span></a></div>
      </div>
      <div class="dash-grid">
        <section class="card span2" aria-labelledby="h-a">
          <h2 id="h-a">Active incidents</h2>
          ${active.length ? `<div class="table-scroll"><table><caption class="sr-only">Active incidents</caption><thead><tr><th scope="col">Incident</th><th scope="col">Severity</th><th scope="col">State</th><th scope="col">Control</th><th scope="col">Updated</th></tr></thead><tbody>
            ${active.map((i) => `<tr><td><a href="#/incident/${encodeURIComponent(i.public_id)}"><strong>${esc(i.title)}</strong></a>${i.external_ref ? `<div class="small muted">${esc(i.external_ref)}</div>` : ''}</td>
              <td>${C.sevBadge(i.severity)}</td><td>${C.stateBadge(i.state)}</td><td>${managedBadge(i)}</td><td class="small">${esc(C.ago(i.updated_at))}${i.next_update_at && new Date(i.next_update_at) < Date.now() ? '<br><strong style="color:var(--major)">Next update overdue</strong>' : ''}</td></tr>`).join('')}
          </tbody></table></div>` : '<p>No active incidents.</p>'}
        </section>

        <section class="card span2" aria-labelledby="h-pw">
          <div class="section-head"><h2 id="h-pw">Planned work</h2><a class="small" href="#/notices">Manage notices</a></div>
          ${planned.length ? `<div class="table-scroll"><table><caption class="sr-only">Upcoming planned work</caption><thead><tr><th scope="col">Notice</th><th scope="col">When</th><th scope="col">Status</th></tr></thead><tbody>
            ${planned.map((n) => `<tr><td><a href="#/notice/${n.id}"><strong>${esc(n.title)}</strong></a><div class="small muted"><code>${esc(C.noticePath(n.slug))}</code></div></td><td class="small">${esc(C.when(n.starts_at))}<br>${esc(C.countdown(n))}</td><td>${C.noticeBadge(n)}</td></tr>`).join('')}
          </tbody></table></div>` : '<p>No upcoming planned work.</p>'}
        </section>

        <section class="card" aria-labelledby="h-c">
          <div class="section-head"><h2 id="h-c">Components</h2><a class="small" href="#/components">Manage</a></div>
          <table><caption class="sr-only">Component status</caption><tbody>${activeComps().map((c) => `<tr><th scope="row" style="font-weight:400">${esc(c.name)}${c.is_public ? '' : ' <span class="small muted">(hidden)</span>'}</th><td style="text-align:right">${C.pill(C.effStatus(s, c))}</td></tr>`).join('')}</tbody></table>
        </section>

        <section class="card" aria-labelledby="h-sn">
          <h2 id="h-sn">Simulate ServiceNow</h2>
          <p class="small">Sends a mock payload to <code>POST /api/v1/integrations/servicenow/incidents/upsert</code>. Send each one twice to see idempotency. Take manual control of an incident first to see its update ignored.</p>
          <div class="field" style="margin-top:10px"><label for="snp">Payload</label><select id="snp">${SN_PAYLOADS.map((p, i) => `<option value="${i}">${esc(p.label)}</option>`).join('')}</select></div>
          <details><summary>Show JSON</summary><pre id="snjson" tabindex="0"></pre></details>
          <div class="btn-row"><button class="btn dark" id="snsend" type="button">Send to status app</button></div>
          <div id="snres" role="status"></div>
        </section>

        <section class="card span2" aria-labelledby="h-e">
          <div class="section-head"><h2 id="h-e">Integration events</h2><a class="small" href="#/audit">All events</a></div>
          ${eventsTable(s.events.slice(0, 6))}
        </section>

        <section class="card span2" aria-labelledby="h-au">
          <div class="section-head"><h2 id="h-au">Recent audit events</h2><a class="small" href="#/audit">Full audit log</a></div>
          ${auditTable(s.audit.slice(0, 6))}
        </section>
      </div>`);

    const sel = $('snp'), pre = $('snjson');
    const show = () => { pre.textContent = JSON.stringify(SN_PAYLOADS[sel.value].body(), null, 2); };
    sel.onchange = show; show();
    $('snsend').onclick = () => {
      const r = snUpsert(SN_PAYLOADS[sel.value].body());
      const html = `<div class="notice ${r.code >= 400 ? 'err' : r.code === 202 ? 'warn' : 'ok'}"><strong>HTTP ${r.code}:</strong> ${esc(r.message)}</div>`;
      const v = sel.value;
      vDashboard();
      $('snp').value = v; $('snp').onchange();
      $('snres').innerHTML = html;
      $('snsend').focus();
    };
  }

  function eventsTable(list) {
    if (!list.length) return '<p>No integration events yet.</p>';
    return `<div class="table-scroll"><table><caption class="sr-only">Integration events</caption><thead><tr><th scope="col">When</th><th scope="col">Event</th><th scope="col">Result</th></tr></thead><tbody>${list.map((e) => `<tr><td class="small">${esc(C.ago(e.at))}</td><td class="small"><code>${esc(e.event_id)}</code><br>${esc(e.source_id)}</td><td class="small"><strong>${e.code}</strong> ${esc(e.result)}</td></tr>`).join('')}</tbody></table></div>`;
  }
  function auditTable(list) {
    return `<div class="table-scroll"><table><caption class="sr-only">Audit events</caption><thead><tr><th scope="col">Time</th><th scope="col">Actor</th><th scope="col">Action</th><th scope="col">Object</th><th scope="col">Request</th></tr></thead><tbody>${list.map((a) => `<tr>
      <td class="small" style="white-space:nowrap">${esc(C.when(a.at))}</td><td class="small">${esc(a.actor)}</td><td class="small"><code>${esc(a.action)}</code></td>
      <td class="small">${esc(a.object)}${Object.keys(a.details || {}).length ? `<br><span class="muted">${esc(JSON.stringify(a.details))}</span>` : ''}</td>
      <td class="small muted"><code>${esc(a.request_id)}</code><br>${esc(a.ip)}</td></tr>`).join('')}</tbody></table></div>`;
  }

  function impactFieldset(legend, current, withNone, prefix) {
    return `<fieldset><legend>${esc(legend)}</legend>
      ${activeComps().map((c) => `<div class="imp-row"><label for="${prefix}-${c.key}">${esc(c.name)}</label><select id="${prefix}-${c.key}" data-key="${c.key}">${statusOptions(current(c), withNone)}</select></div>`).join('')}
    </fieldset>`;
  }
  const readImpacts = (prefix) => [...document.querySelectorAll(`select[id^="${prefix}-"]`)].map((x) => ({ key: x.dataset.key, impact: x.value })).filter((x) => x.impact);

  // ---------- create incident (with preview) ----------
  let draft = null;
  function vNew() {
    setTitle('Create incident');
    const d = draft || { title: '', severity: 'significant', state: 'investigating', message: '', started_at: C.nowIso(), next_update_at: new Date(Date.now() + 30 * C.MIN).toISOString(), components: [] };
    app.innerHTML = shell('#/new', `
      <h1 class="page-title">Create incident</h1>
      <form id="f" class="card" novalidate>
        ${errBox('err')}
        <p class="notice">Fields marked <span class="public-tag">Public</span> appear on the public status page. Do not include hostnames, IP addresses, security details or personal information.</p>
        <div class="field"><label for="title">Title <span class="public-tag">Public</span></label><input id="title" type="text" maxlength="120" value="${esc(d.title)}" placeholder="e.g. eCentennial access issues"></div>
        <div class="grid2">
          <div class="field"><label for="sev">Severity</label><span class="hint" id="sev-hint">How much it affects people, not the ticket priority.</span><select id="sev" aria-describedby="sev-hint">${opts(C.SEVERITIES, d.severity)}</select></div>
          <div class="field"><label for="state">Incident state</label><span class="hint">&nbsp;</span><select id="state">${opts(C.STATES.slice(0, 3), d.state)}</select></div>
        </div>
        ${impactFieldset('Affected components and impact', (c) => (d.components.find((x) => x.key === c.key) || {}).impact || '', true, 'imp')}
        <div class="field"><label for="msg">Public message <span class="public-tag">Public</span></label><span class="hint" id="msg-hint">What people are experiencing, what they should do, and what IT is doing.</span><textarea id="msg" aria-describedby="msg-hint">${esc(d.message)}</textarea></div>
        <div class="grid2">
          <div class="field"><label for="start">Started at</label><input id="start" type="datetime-local" value="${toLocal(d.started_at)}"></div>
          <div class="field"><label for="next">Next update at</label><input id="next" type="datetime-local" value="${d.next_update_at ? toLocal(d.next_update_at) : ''}"></div>
        </div>
        <div class="btn-row"><button class="btn primary">Preview</button><a class="btn" href="#/dashboard">Cancel</a></div>
      </form>`);
    $('f').onsubmit = (e) => {
      e.preventDefault();
      const val = (id) => $(id).value;
      draft = { title: val('title').trim(), severity: val('sev'), state: val('state'), message: val('msg').trim(), started_at: fromLocal(val('start')) || C.nowIso(), next_update_at: fromLocal(val('next')), components: readImpacts('imp') };
      const errs = [];
      if (!draft.title) errs.push({ id: 'title', msg: 'Enter a title.' });
      if (!draft.components.length) errs.push({ id: 'imp-' + activeComps()[0].key, msg: 'Choose the impact for at least one affected component.' });
      if (!draft.message) errs.push({ id: 'msg', msg: 'Enter a public message.' });
      const leak = sensitive(draft.title + ' ' + draft.message);
      if (leak) errs.push({ id: 'msg', msg: 'The public text looks like it contains ' + leak + '. Remove it before publishing.' });
      if (showErrors('err', errs)) return;
      vPreview();
    };
  }

  function vPreview() {
    if (!draft) return go('#/new');
    setTitle('Preview incident');
    const fake = { public_id: 'preview', ...draft, updates: [{ at: C.nowIso(), state: draft.state, message: draft.message }], updated_at: C.nowIso() };
    app.innerHTML = shell('#/new', `
      <h1 class="page-title">Preview before publishing</h1>
      <p class="notice warn">This is exactly how the incident will appear on the <strong>public</strong> status page. Check the wording before you publish.</p>
      ${C.incidentCard(s, fake, { nolink: true, h: 'h2' })}
      <div class="btn-row"><button class="btn primary" id="pub" type="button">Publish incident</button><a class="btn" href="#/new">Back to edit</a></div>`);
    focusHeading();
    $('pub').onclick = () => {
      const id = new Date().toISOString().slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000);
      const inc = { public_id: id, title: draft.title, severity: draft.severity, state: draft.state, summary: '', source: 'manual', external_ref: null, managed_by: 'manual', manual_takeover: false,
        started_at: draft.started_at, resolved_at: null, next_update_at: draft.next_update_at, components: draft.components,
        updates: [{ at: C.nowIso(), state: draft.state, message: draft.message, source: 'manual' }], updated_at: C.nowIso() };
      s.incidents.push(inc);
      inc.components.forEach((c) => { comp(c.key).current_status = c.impact; });
      audit('incident.create', inc.title, { severity: inc.severity, components: inc.components.map((c) => c.key) });
      commit('Incident published.');
      draft = null;
      go('#/incident/' + id);
    };
  }

  // ---------- incident detail / update / takeover / resolve ----------
  function vIncident(id) {
    const inc = C.findIncident(s, id);
    if (!inc) { app.innerHTML = shell('', '<div class="card"><h1 class="page-title">Incident not found</h1><p><a href="#/dashboard">Back to dashboard</a></p></div>'); return; }
    setTitle(inc.title);
    const sn = inc.managed_by === 'servicenow';
    const resolved = inc.state === 'resolved';
    const locked = sn || resolved;
    app.innerHTML = shell('', `
      <a class="back" href="#/dashboard">Dashboard</a>
      <div class="card">
        <h1 class="page-title">${esc(inc.title)}</h1>
        <div class="meta-row">${C.sevBadge(inc.severity)} ${C.stateBadge(inc.state)} ${managedBadge(inc)}</div>
        <dl class="kv">
          <dt>Public ID</dt><dd><code>${esc(inc.public_id)}</code>, <a href="/incident.html?id=${encodeURIComponent(inc.public_id)}" target="_blank" rel="noopener">public page<span class="sr-only"> (opens in a new tab)</span></a></dd>
          <dt>Source</dt><dd>${esc(inc.source)}${inc.external_ref ? ', ' + esc(inc.external_ref) : ''}</dd>
          <dt>Started</dt><dd>${esc(C.when(inc.started_at))}</dd>
          ${inc.next_update_at && !resolved ? `<dt>Next update</dt><dd>${esc(C.when(inc.next_update_at))}</dd>` : ''}
        </dl>
        ${inc.external_ref ? `<div class="btn-row">
          ${sn ? '<button class="btn dark" id="take" type="button">Take manual control</button>' : ''}
          ${!sn && inc.manual_takeover ? '<button class="btn" id="ret" type="button">Return control to ServiceNow</button>' : ''}
        </div>
        ${sn ? '<p class="notice">ServiceNow is publishing this incident. Take manual control to publish updates here, for example if ServiceNow is unavailable. While under manual control, ServiceNow updates for this incident are acknowledged but not published.</p>' : ''}
        ${!sn && inc.manual_takeover ? '<p class="notice warn">Manual control is active. ServiceNow updates for this incident are being ignored and logged. Return control only after the ServiceNow integration is confirmed healthy.</p>' : ''}` : ''}
      </div>

      ${resolved ? '' : `<form id="uf" class="card" novalidate>
        <h2>Publish update</h2>
        ${errBox('uerr')}
        <fieldset ${locked ? 'disabled' : ''} style="border:0;padding:0;margin:10px 0 0">
          <legend class="sr-only">Update details</legend>
          <div class="grid2">
            <div class="field"><label for="ust">State</label><select id="ust">${opts(C.STATES.slice(0, 3), inc.state)}</select></div>
            <div class="field"><label for="unext">Next update at</label><input id="unext" type="datetime-local" value="${toLocal(new Date(Date.now() + 30 * C.MIN).toISOString())}"></div>
          </div>
          <div class="field"><label for="umsg">Public update message <span class="public-tag">Public</span></label><textarea id="umsg"></textarea></div>
          <details><summary>Component status changes</summary><div style="margin-top:10px">${impactFieldset('Component status', (c) => (inc.components.find((x) => x.key === c.key) || {}).impact || '', true, 'uimp')}</div></details>
          <div class="btn-row"><button class="btn primary">Publish update</button></div>
        </fieldset>
      </form>

      <form id="rf" class="card" novalidate>
        <h2>Resolve incident</h2>
        ${errBox('rerr')}
        <fieldset ${locked ? 'disabled' : ''} style="border:0;padding:0;margin:10px 0 0">
          <legend class="sr-only">Resolution details</legend>
          <div class="field"><label for="rmsg">Resolution message <span class="public-tag">Public</span></label><span class="hint" id="rmsg-hint">What was fixed, and anything people need to do now.</span><textarea id="rmsg" aria-describedby="rmsg-hint"></textarea></div>
          <div class="field" style="max-width:320px"><label for="rat">Resolved time</label><input id="rat" type="datetime-local" value="${toLocal(C.nowIso())}"></div>
          ${impactFieldset('Final component statuses', (c) => (inc.components.find((x) => x.key === c.key) ? 'operational' : ''), true, 'rimp')}
          <div class="btn-row"><button class="btn ok">Resolve incident</button></div>
        </fieldset>
      </form>`}

      <section class="card" aria-labelledby="h-tl">
        <h2 id="h-tl">Published timeline</h2>
        <ol class="timeline" style="margin-top:14px">${inc.updates.slice().reverse().map((u) => `<li class="tl-${u.state}"><span class="dot" aria-hidden="true"></span>
          <h3>${esc(C.cap(u.state))} <time>${esc(C.when(u.at))}</time> <span class="badge src">${esc(u.source === 'servicenow' ? 'via ServiceNow' : 'manual')}</span></h3><p>${esc(u.message)}</p></li>`).join('')}</ol>
      </section>`);

    const take = $('take');
    if (take) take.onclick = () => { inc.managed_by = 'manual'; inc.manual_takeover = true; audit('incident.manual_takeover', 'incident ' + inc.external_ref, {}); commit('Manual control taken.'); vIncident(id); $('umsg') && $('umsg').focus(); };
    const ret = $('ret');
    if (ret) ret.onclick = () => {
      if (!confirm('Return this incident to ServiceNow control? The next ServiceNow update will replace the public message.')) return;
      inc.managed_by = 'servicenow'; inc.manual_takeover = false; audit('incident.return_to_servicenow', 'incident ' + inc.external_ref, {}); commit('Control returned to ServiceNow.'); vIncident(id);
    };

    const uf = $('uf');
    if (uf) uf.onsubmit = (e) => {
      e.preventDefault();
      const msg = $('umsg').value.trim();
      const leak = sensitive(msg);
      if (showErrors('uerr', !msg ? [{ id: 'umsg', msg: 'Enter a public update message.' }] : leak ? [{ id: 'umsg', msg: 'The message looks like it contains ' + leak + '. Remove it.' }] : [])) return;
      const st = $('ust').value;
      inc.updates.push({ at: C.nowIso(), state: st, message: msg, source: 'manual' });
      inc.state = st; inc.updated_at = C.nowIso(); inc.next_update_at = fromLocal($('unext').value);
      const imp = readImpacts('uimp');
      s.components.forEach((c) => { const n = imp.find((x) => x.key === c.key); const was = inc.components.find((x) => x.key === c.key); if (was && !n) c.current_status = 'operational'; });
      inc.components = imp; imp.forEach((c) => { comp(c.key).current_status = c.impact; });
      audit('incident.update', inc.title, { state: st });
      commit('Update published.'); vIncident(id); focusHeading();
    };
    const rf = $('rf');
    if (rf) rf.onsubmit = (e) => {
      e.preventDefault();
      const msg = $('rmsg').value.trim();
      if (showErrors('rerr', msg ? [] : [{ id: 'rmsg', msg: 'Enter a resolution message.' }])) return;
      const at = fromLocal($('rat').value) || C.nowIso();
      inc.updates.push({ at, state: 'resolved', message: msg, source: 'manual' });
      inc.state = 'resolved'; inc.resolved_at = at; inc.updated_at = at; inc.next_update_at = null;
      readImpacts('rimp').forEach((c) => { comp(c.key).current_status = c.impact; });
      audit('incident.resolve', inc.title, {});
      commit('Incident resolved.'); vIncident(id); focusHeading();
    };
  }

  // ---------- planned-work notices ----------
  function vNotices() {
    setTitle('Planned work');
    const list = s.notices.slice().sort((a, b) => b.starts_at.localeCompare(a.starts_at));
    app.innerHTML = shell('#/notices', `
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:12px;align-items:center">
        <h1 class="page-title">Planned work notices</h1>
        <a class="btn primary" href="#/notice/new">New notice</a>
      </div>
      <p class="lede">Each notice gets a permanent link (<code>/n/&lt;name&gt;</code>) to share in emails, eCentennial announcements, social posts and posters. If you reschedule or cancel, the same link shows the change, and the change is recorded in the notice's public history.</p>
      <div class="card"><div class="table-scroll"><table>
        <caption class="sr-only">All planned-work notices</caption>
        <thead><tr><th scope="col">Notice</th><th scope="col">When</th><th scope="col">Status</th><th scope="col">Who</th><th scope="col">Link</th></tr></thead>
        <tbody>${list.map((n) => `<tr>
          <td><a href="#/notice/${n.id}"><strong>${esc(n.title)}</strong></a>${n.external_ref ? `<div class="small muted">${esc(n.external_ref)}</div>` : ''}</td>
          <td class="small">${esc(C.when(n.starts_at))}</td>
          <td>${C.noticeBadge(n)}</td>
          <td class="small">${esc(C.audienceText(n))}</td>
          <td><a class="small" href="${C.noticePath(n.slug)}" target="_blank" rel="noopener"><code>${esc(C.noticePath(n.slug))}</code><span class="sr-only"> (opens in a new tab)</span></a></td>
        </tr>`).join('')}</tbody>
      </table></div></div>`);
  }

  const slugify = (t) => t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  let ndraft = null;

  function vNoticeEdit(id) {
    const existing = id === 'new' ? null : s.notices.find((n) => String(n.id) === String(id));
    if (id !== 'new' && !existing) { app.innerHTML = shell('#/notices', '<div class="card"><h1 class="page-title">Notice not found</h1><p><a href="#/notices">Back to notices</a></p></div>'); return; }
    const st = existing ? C.noticeState(existing) : 'scheduled';
    const n = existing || (ndraft && ndraft.id === 'new' ? ndraft : { id: 'new', title: '', slug: '', summary: '', description: '', actions: [], audiences: ['students', 'employees'], campuses: ['all'], services: [], starts_at: new Date(Date.now() + 7 * C.DAY).toISOString(), ends_at: new Date(Date.now() + 7 * C.DAY + 2 * C.HOUR).toISOString(), external_ref: '' });
    const closed = st === 'cancelled' || st === 'completed';
    setTitle(existing ? 'Edit notice' : 'New notice');
    const checks = (name, map, sel) => Object.entries(map).map(([k, l], i) => `<label><input type="checkbox" id="${name}-${i ? k : 'first'}" name="${name}" value="${esc(k)}"${sel.includes(k) ? ' checked' : ''}> ${esc(l)}</label>`).join('');
    const impactOpts = (v) => `<option value="">Not affected</option>` + Object.entries(C.IMPACTS).map(([k, l]) => `<option value="${k}"${k === v ? ' selected' : ''}>${esc(l)}</option>`).join('');

    app.innerHTML = shell('#/notices', `
      <a class="back" href="#/notices">All notices</a>
      <h1 class="page-title">${existing ? esc(existing.title) : 'New planned-work notice'}</h1>
      ${existing ? `<div class="meta-row">${C.noticeBadge(existing)} <a href="${C.noticePath(existing.slug)}" target="_blank" rel="noopener">View public notice<span class="sr-only"> (opens in a new tab)</span></a></div>` : ''}
      ${closed ? `<p class="notice">This notice is ${st}. It stays available at its permanent link but can no longer be edited.</p>` : ''}
      <form id="nf" class="card" novalidate>
        ${errBox('nerr')}
        <fieldset ${closed ? 'disabled' : ''} style="border:0;padding:0;margin:0">
          <legend class="sr-only">Notice details</legend>
          <p class="notice">Everything on this form is <strong>public</strong> except the ServiceNow change number. Write for students and staff: say what will happen, when, and what to do.</p>
          <div class="field"><label for="n-title">Title</label><span class="hint" id="n-title-hint">Lead with the service and the effect, e.g. "myCentennial unavailable for system upgrade".</span><input id="n-title" type="text" maxlength="100" value="${esc(n.title)}" aria-describedby="n-title-hint"></div>
          <div class="field"><label for="n-slug">Permanent link</label>
            <span class="hint" id="n-slug-hint">${existing ? 'This link is already published and other sites may use it, so it cannot be changed.' : 'Lowercase letters, numbers and hyphens. It cannot be changed after publishing.'}</span>
            <div class="copy-row"><span aria-hidden="true" style="align-self:center;font-family:ui-monospace,Consolas,monospace;font-size:.9rem">${esc(location.host)}/n/</span><input id="n-slug" type="text" value="${esc(n.slug)}" aria-describedby="n-slug-hint"${existing ? ' readonly' : ''}></div></div>
          <div class="field"><label for="n-summary">Summary</label><span class="hint" id="n-summary-hint">One or two sentences. Shown in lists, the widget and calendar entries.</span><textarea id="n-summary" rows="2" style="min-height:70px" maxlength="240" aria-describedby="n-summary-hint">${esc(n.summary)}</textarea></div>
          <div class="grid2">
            <div class="field"><label for="n-start">Starts</label><input id="n-start" type="datetime-local" value="${toLocal(n.starts_at)}"></div>
            <div class="field"><label for="n-end">Ends</label><input id="n-end" type="datetime-local" value="${toLocal(n.ends_at)}"></div>
          </div>
          <fieldset><legend>Services affected and expected impact</legend>
            ${activeComps().map((c) => { const cur = (n.services.find((x) => x.key === c.key) || {}).impact || ''; return `<div class="imp-row"><label for="svc-${c.key}">${esc(c.name)}</label><select id="svc-${c.key}" data-key="${c.key}">${impactOpts(cur)}</select></div>`; }).join('')}
          </fieldset>
          <fieldset><legend>Who is affected</legend><div class="checks">${checks('aud', C.AUDIENCES, n.audiences)}</div></fieldset>
          <fieldset><legend>Where</legend><div class="checks">${checks('camp', C.CAMPUSES, n.campuses)}</div></fieldset>
          <div class="field"><label for="n-actions">What people need to do</label><span class="hint" id="n-actions-hint">One action per line. Shown as a list near the top of the notice.</span><textarea id="n-actions" aria-describedby="n-actions-hint">${esc(n.actions.join('\n'))}</textarea></div>
          <div class="field"><label for="n-desc">Details</label><textarea id="n-desc">${esc(n.description)}</textarea></div>
          <div class="field" style="max-width:320px"><label for="n-ref">ServiceNow change number <span class="hint" style="display:inline">(internal, optional)</span></label><input id="n-ref" type="text" value="${esc(n.external_ref || '')}" placeholder="CHG0000000"></div>
          ${existing ? `<div class="field"><label for="n-reason">Reason for this change</label><span class="hint" id="n-reason-hint">Shown publicly in the notice's history, e.g. "Moved to avoid midterm week."</span><input id="n-reason" type="text" aria-describedby="n-reason-hint"></div>` : ''}
          <div class="btn-row">
            <button class="btn primary">${existing ? 'Save changes' : 'Preview'}</button>
            ${existing && st === 'in_progress' ? '<button class="btn ok" type="button" id="n-done">Mark complete now</button>' : ''}
            ${existing && st !== 'in_progress' ? '<button class="btn danger" type="button" id="n-cancel">Cancel this work</button>' : ''}
            <a class="btn" href="#/notices">Back</a>
          </div>
        </fieldset>
      </form>`);

    const slug = $('n-slug');
    let slugTouched = !!n.slug;
    if (!existing) {
      slug.oninput = () => { slugTouched = true; };
      $('n-title').oninput = () => { if (!slugTouched) slug.value = slugify($('n-title').value); };
    }

    const read = () => ({
      title: $('n-title').value.trim(), slug: slug.value.trim(), summary: $('n-summary').value.trim(), description: $('n-desc').value.trim(),
      actions: $('n-actions').value.split('\n').map((x) => x.trim()).filter(Boolean),
      audiences: [...app.querySelectorAll('input[name=aud]:checked')].map((x) => x.value),
      campuses: [...app.querySelectorAll('input[name=camp]:checked')].map((x) => x.value),
      services: [...app.querySelectorAll('select[id^="svc-"]')].filter((x) => x.value).map((x) => ({ key: x.dataset.key, impact: x.value })),
      starts_at: fromLocal($('n-start').value), ends_at: fromLocal($('n-end').value), external_ref: $('n-ref').value.trim() || null,
    });
    const validate = (d) => {
      const e = [];
      if (!d.title) e.push({ id: 'n-title', msg: 'Enter a title.' });
      if (!existing) {
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(d.slug)) e.push({ id: 'n-slug', msg: 'The permanent link can only use lowercase letters, numbers and single hyphens.' });
        else if (s.notices.some((x) => x.slug === d.slug)) e.push({ id: 'n-slug', msg: 'That link is already used by another notice. Choose a different one.' });
      }
      if (!d.summary) e.push({ id: 'n-summary', msg: 'Enter a summary.' });
      if (!d.starts_at) e.push({ id: 'n-start', msg: 'Enter a start date and time.' });
      if (!d.ends_at) e.push({ id: 'n-end', msg: 'Enter an end date and time.' });
      else if (d.starts_at && d.ends_at <= d.starts_at) e.push({ id: 'n-end', msg: 'The end must be after the start.' });
      if (!d.services.length) e.push({ id: 'svc-' + activeComps()[0].key, msg: 'Choose the expected impact for at least one service.' });
      if (!d.audiences.length) e.push({ id: 'aud-first', msg: 'Choose who is affected.' });
      if (!d.campuses.length) e.push({ id: 'camp-first', msg: 'Choose where, or All campuses.' });
      const leak = sensitive([d.title, d.summary, d.description, d.actions.join(' ')].join(' '));
      if (leak) e.push({ id: 'n-desc', msg: 'The public text looks like it contains ' + leak + '. Remove it.' });
      return e;
    };

    $('nf').onsubmit = (ev) => {
      ev.preventDefault();
      const d = read();
      if (showErrors('nerr', validate(d))) return;
      if (!existing) { ndraft = { id: 'new', ...d }; return vNoticePreview(); }
      // Existing notice: record what changed in its public history.
      const reason = ($('n-reason').value || '').trim();
      const changes = [];
      if (d.starts_at !== existing.starts_at) changes.push(`Rescheduled from ${C.when(existing.starts_at)} to ${C.when(d.starts_at)}.`);
      else if (d.ends_at !== existing.ends_at) changes.push(d.ends_at > existing.ends_at ? `Extended to ${C.when(d.ends_at)}.` : `End time changed to ${C.when(d.ends_at)}.`);
      const contentChanged = ['title', 'summary', 'description'].some((k) => d[k] !== existing[k]) || JSON.stringify([d.actions, d.audiences, d.campuses, d.services]) !== JSON.stringify([existing.actions, existing.audiences, existing.campuses, existing.services]);
      if (!changes.length && contentChanged) changes.push('Details updated.');
      if (!changes.length && !reason) { C.toast('No changes to save.'); return; }
      Object.assign(existing, d, { slug: existing.slug, updated_at: C.nowIso() });
      existing.history.push({ at: C.nowIso(), text: (changes.join(' ') || 'Notice updated.') + (reason ? ' ' + reason.replace(/([^.!?])$/, '$1.') : '') });
      audit(changes[0] && changes[0].startsWith('Rescheduled') ? 'notice.reschedule' : 'notice.update', 'notice ' + existing.slug, { change: changes.join(' ') });
      commit('Notice saved. The permanent link now shows the change.');
      vNoticeEdit(existing.id); focusHeading();
    };
    const cx = $('n-cancel');
    if (cx) cx.onclick = () => {
      const reason = ($('n-reason').value || '').trim();
      if (showErrors('nerr', reason ? [] : [{ id: 'n-reason', msg: 'Enter a public reason before cancelling, e.g. "A new date will be announced."' }])) return;
      if (!confirm('Cancel "' + existing.title + '"? The notice will stay at its link and show that the work is cancelled.')) return;
      existing.status = 'cancelled'; existing.updated_at = C.nowIso();
      existing.history.push({ at: C.nowIso(), text: 'Cancelled. ' + reason.replace(/([^.!?])$/, '$1.') });
      audit('notice.cancel', 'notice ' + existing.slug, { reason });
      commit('Notice cancelled.'); vNoticeEdit(existing.id); focusHeading();
    };
    const done = $('n-done');
    if (done) done.onclick = () => {
      existing.status = 'completed'; existing.ends_at = C.nowIso(); existing.updated_at = C.nowIso();
      existing.history.push({ at: C.nowIso(), text: 'Completed' + ((Date.now() < new Date(n.ends_at)) ? ' early' : '') + '.' });
      audit('notice.complete', 'notice ' + existing.slug, {});
      commit('Notice marked complete.'); vNoticeEdit(existing.id); focusHeading();
    };
  }

  function vNoticePreview() {
    if (!ndraft) return go('#/notice/new');
    setTitle('Preview notice');
    const fake = { ...ndraft, status: 'scheduled', history: [] };
    app.innerHTML = shell('#/notices', `
      <h1 class="page-title">Preview before publishing</h1>
      <p class="notice warn">This is how the notice will appear in public lists and the website widget. Once published, it will be at <strong>${esc(C.noticeUrl(fake.slug))}</strong> and that link cannot change.</p>
      ${C.noticeCard(s, fake, { nolink: true, h: 'h2' })}
      <div class="btn-row"><button class="btn primary" id="npub" type="button">Publish notice</button><a class="btn" href="#/notice/new">Back to edit</a></div>`);
    focusHeading();
    $('npub').onclick = () => {
      const id = Math.max(0, ...s.notices.map((x) => x.id)) + 1;
      const now = C.nowIso();
      const n = { ...ndraft, id, status: 'scheduled', source: 'manual', published_at: now, updated_at: now, history: [{ at: now, text: 'Notice published.' }] };
      s.notices.push(n);
      audit('notice.create', 'notice ' + n.slug, { starts_at: n.starts_at, services: n.services.map((x) => x.key) });
      commit('Notice published.');
      ndraft = null;
      go('#/notice/' + id);
    };
  }

  // ---------- components ----------
  function vComponents() {
    setTitle('Components');
    const list = activeComps();
    app.innerHTML = shell('#/components', `
      <h1 class="page-title">Components</h1>
      <div class="card"><div class="table-scroll"><table>
        <caption class="sr-only">Components, in public display order</caption>
        <thead><tr><th scope="col">Order</th><th scope="col">Component</th><th scope="col">Key</th><th scope="col">Current status</th><th scope="col">Public</th><th scope="col"><span class="sr-only">Archive</span></th></tr></thead>
        <tbody>${list.map((c, i) => `<tr>
          <td><span class="order-btns"><button class="btn sm" type="button" data-up="${c.key}" ${i === 0 ? 'disabled' : ''} aria-label="Move ${esc(c.name)} up">↑</button><button class="btn sm" type="button" data-down="${c.key}" ${i === list.length - 1 ? 'disabled' : ''} aria-label="Move ${esc(c.name)} down">↓</button></span></td>
          <th scope="row" style="font-weight:400"><strong>${esc(c.name)}</strong><div class="small muted">${esc(c.group)}</div></th>
          <td><code>${esc(c.key)}</code></td>
          <td><label class="sr-only" for="cs-${c.key}">Status of ${esc(c.name)}</label><select id="cs-${c.key}" data-status="${c.key}" style="min-width:190px">${statusOptions(c.current_status)}</select></td>
          <td><button class="btn sm" type="button" data-vis="${c.key}" aria-pressed="${c.is_public}" aria-label="Show ${esc(c.name)} on public page">${c.is_public ? 'Visible' : 'Hidden'}</button></td>
          <td><button class="btn sm danger" type="button" data-arch="${c.key}" aria-label="Archive ${esc(c.name)}">Archive</button></td></tr>`).join('')}</tbody>
      </table></div></div>
      <form id="af" class="card" novalidate>
        <h2>Add component</h2>
        ${errBox('aerr')}
        <div class="grid2" style="margin-top:10px">
          <div class="field"><label for="an">Name</label><input id="an" type="text"></div>
          <div class="field"><label for="ak">Key</label><span class="hint" id="ak-hint">Stable and API-friendly, e.g. <code>library-systems</code>.</span><input id="ak" type="text" aria-describedby="ak-hint"></div>
          <div class="field"><label for="ad">Description</label><input id="ad" type="text"></div>
          <div class="field"><label for="ag">Group</label><select id="ag">${C.GROUPS.map((g) => `<option>${esc(g)}</option>`).join('')}</select></div>
        </div>
        <button class="btn primary">Add component</button>
      </form>`);

    const refocus = (sel) => { const el = app.querySelector(sel); if (el && !el.disabled) el.focus(); };
    const swap = (key, dir) => { const i = list.findIndex((c) => c.key === key), j = i + dir; const a = list[i].display_order; list[i].display_order = list[j].display_order; list[j].display_order = a; audit('component.reorder', key, {}); commit(comp(key).name + ' moved ' + (dir < 0 ? 'up' : 'down') + '.'); vComponents(); refocus(`[data-${dir < 0 ? 'up' : 'down'}="${key}"]`); };
    app.querySelectorAll('[data-up]').forEach((b) => (b.onclick = () => swap(b.dataset.up, -1)));
    app.querySelectorAll('[data-down]').forEach((b) => (b.onclick = () => swap(b.dataset.down, 1)));
    app.querySelectorAll('[data-status]').forEach((sel) => (sel.onchange = () => { const c = comp(sel.dataset.status); audit('component.status_change', c.key, { from: c.current_status, to: sel.value }); c.current_status = sel.value; commit(c.name + ': ' + C.STATUS[sel.value].label + '.'); }));
    app.querySelectorAll('[data-vis]').forEach((b) => (b.onclick = () => { const c = comp(b.dataset.vis); c.is_public = !c.is_public; audit(c.is_public ? 'component.show' : 'component.hide', c.key, {}); commit(c.name + (c.is_public ? ' is visible.' : ' is hidden.')); vComponents(); refocus(`[data-vis="${c.key}"]`); }));
    app.querySelectorAll('[data-arch]').forEach((b) => (b.onclick = () => { const c = comp(b.dataset.arch); if (!confirm('Archive ' + c.name + '? It will be removed from the public page.')) return; c.archived = true; audit('component.archive', c.key, {}); commit(c.name + ' archived.'); vComponents(); focusHeading(); }));
    $('af').onsubmit = (e) => {
      e.preventDefault();
      const v = (id) => $(id).value.trim();
      const errs = [];
      if (!v('an')) errs.push({ id: 'an', msg: 'Enter a name.' });
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(v('ak'))) errs.push({ id: 'ak', msg: 'The key can only use lowercase letters, numbers and hyphens.' });
      else if (comp(v('ak'))) errs.push({ id: 'ak', msg: 'That key already exists.' });
      if (showErrors('aerr', errs)) return;
      s.components.push({ id: s.components.length + 1, key: v('ak'), name: v('an'), description: v('ad'), group: v('ag'), current_status: 'operational', is_public: true, archived: false, display_order: Math.max(...s.components.map((c) => c.display_order)) + 1 });
      audit('component.create', v('ak'), {}); commit('Component added.'); vComponents();
    };
  }

  function vAudit() {
    setTitle('Audit log');
    app.innerHTML = shell('#/audit', `
      <h1 class="page-title">Audit log</h1>
      <p>Every sign-in, publication, takeover, notice change, component change and integration request. Passwords, MFA codes and tokens are never recorded.</p>
      <section class="card" aria-labelledby="h-al"><h2 id="h-al" class="sr-only">Audit events</h2>${auditTable(s.audit)}</section>
      <section class="card" aria-labelledby="h-ie"><h2 id="h-ie">Integration events</h2>${eventsTable(s.events)}</section>`);
  }

  // ---------- ServiceNow upsert simulator ----------
  const SN_PAYLOADS = [
    { label: 'Update INC0012345 to monitoring', body: () => ({ source_id: 'INC0012345', source_sys_id: '0123456789abcdef0123456789abcdef', event_id: 'sn-event-000201', title: 'eCentennial (Brightspace) access issues', public_message: 'The vendor has applied a fix and access to eCentennial is returning. Some users may need to sign out and back in. IT is monitoring.', severity: 'major', state: 'monitoring', components: [{ key: 'lms', status: 'degraded_performance' }], started_at: null, next_update_at: new Date(Date.now() + 30 * C.MIN).toISOString(), resolved_at: null }) },
    { label: 'Resolve INC0012345', body: () => ({ source_id: 'INC0012345', source_sys_id: '0123456789abcdef0123456789abcdef', event_id: 'sn-event-000202', title: 'eCentennial (Brightspace) access issues', public_message: 'eCentennial is operating normally. If you still cannot access a course, sign out fully and sign back in.', severity: 'major', state: 'resolved', components: [{ key: 'lms', status: 'operational' }], started_at: null, next_update_at: null, resolved_at: new Date().toISOString() }) },
    { label: 'New incident INC0012399 (Teams calling)', body: () => ({ source_id: 'INC0012399', source_sys_id: 'fedcba9876543210fedcba9876543210', event_id: 'sn-event-000203', title: 'Microsoft Teams calls dropping', public_message: 'Some Teams calls and meetings are disconnecting unexpectedly. Chat and email are not affected. IT is investigating with Microsoft.', severity: 'significant', state: 'investigating', components: [{ key: 'm365', status: 'degraded_performance' }, { key: 'telephony', status: 'degraded_performance' }], started_at: new Date(Date.now() - 12 * C.MIN).toISOString(), next_update_at: new Date(Date.now() + 30 * C.MIN).toISOString(), resolved_at: null }) },
    { label: 'Update INC0012360 (SSO outage scenario)', body: () => ({ source_id: 'INC0012360', source_sys_id: 'aaaabbbbccccddddeeeeffff00001111', event_id: 'sn-event-000204', title: 'SSO outage', public_message: 'Investigating SSO issue.', severity: 'critical', state: 'investigating', components: [{ key: 'authentication', status: 'major_outage' }], started_at: null, next_update_at: null, resolved_at: null }) },
    { label: 'Invalid: unknown component key', body: () => ({ source_id: 'INC0012400', source_sys_id: '99998888777766665555444433332222', event_id: 'sn-event-000205', title: 'Brightspace slow', public_message: 'Brightspace is slow.', severity: 'minor', state: 'investigating', components: [{ key: 'brightspace', status: 'degraded_performance' }], started_at: null, next_update_at: null, resolved_at: null }) },
  ];

  function snUpsert(p) {
    const actor = 'integration:servicenow';
    const record = (code, result, message, action) => {
      s.events.unshift({ at: C.nowIso(), event_id: p.event_id, source_id: p.source_id, code, result });
      audit(action, 'incident ' + p.source_id, { event_id: p.event_id, result }, actor);
      commit();
      return { code, message };
    };
    if (s.processed.includes(p.event_id)) return record(200, 'duplicate, no change', `Event ${p.event_id} was already processed. Acknowledged; nothing was created or changed (idempotent).`, 'servicenow.upsert.duplicate');
    const bad = p.components.filter((c) => !comp(c.key)).map((c) => c.key);
    if (bad.length) return record(422, 'rejected, unknown component', `Unknown component key "${bad.join(', ')}". Components are never auto-created from ServiceNow.`, 'servicenow.upsert.rejected');
    let inc = s.incidents.find((i) => i.external_ref === p.source_id);
    if (inc && inc.manual_takeover) return record(202, 'ignored, manual takeover active', `"${inc.title}" is under manual control. The update was acknowledged and logged but not published.`, 'servicenow.upsert.ignored');
    s.processed.push(p.event_id);
    const now = C.nowIso();
    const created = !inc;
    if (!inc) {
      inc = { public_id: now.slice(0, 10).replace(/-/g, '') + '-' + Math.floor(1000 + Math.random() * 9000), title: p.title, severity: p.severity, state: p.state, summary: '', source: 'servicenow', external_ref: p.source_id, managed_by: 'servicenow', manual_takeover: false,
        started_at: p.started_at || now, resolved_at: null, next_update_at: null, components: [], updates: [], updated_at: now };
      s.incidents.push(inc);
    }
    inc.title = p.title; inc.severity = p.severity; inc.state = p.state; inc.updated_at = now; inc.next_update_at = p.next_update_at;
    inc.updates.push({ at: now, state: p.state, message: p.public_message, source: 'servicenow' });
    if (p.state === 'resolved') { inc.resolved_at = p.resolved_at || now; p.components.forEach((c) => { comp(c.key).current_status = 'operational'; }); }
    else { inc.components = p.components.map((c) => ({ key: c.key, impact: c.status })); p.components.forEach((c) => { comp(c.key).current_status = c.status; }); }
    return record(created ? 201 : 200, created ? 'created' : 'updated', `${created ? 'Created' : 'Updated'} "${inc.title}" and published it to the public page.`, 'servicenow.upsert');
  }

  // ---------- router ----------
  function route() {
    s = C.load() || s;
    const h = location.hash || '#/dashboard';
    if (h === '#/logout') { audit('auth.logout', 'session', {}); C.save(s); setAuth(null); return go('#/login'); }
    if (h === '#/mfa') return vMfa();
    if (!authed()) return vLogin();
    window.scrollTo(0, 0);
    if (h.startsWith('#/incident/')) vIncident(decodeURIComponent(h.slice(11)));
    else if (h === '#/notice/preview') vNoticePreview();
    else if (h.startsWith('#/notice/')) vNoticeEdit(decodeURIComponent(h.slice(9)));
    else ({ '#/new': vNew, '#/preview': vPreview, '#/notices': vNotices, '#/components': vComponents, '#/audit': vAudit }[h] || vDashboard)();
    // Move focus to the new view's heading so screen-reader and keyboard users land on the new content.
    if (document.activeElement === document.body || !app.contains(document.activeElement)) focusHeading();
  }
  window.addEventListener('hashchange', route);
  route();
})();
