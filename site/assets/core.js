/* Centennial College IT Status — prototype core
 *
 * There is no backend. Demo data is generated relative to "now" so the page
 * always looks current, then kept in this browser's localStorage so changes
 * made in the admin mockup show up on the public page (same browser only).
 * ?scenario=<name> on any page re-seeds; the banner links do this.
 */
(function () {
  'use strict';

  const TZ = 'America/Toronto';
  const KEY = 'ccstatus-demo-v2';
  const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;

  const STATUS = {
    operational:          { label: 'Operational',          rank: 0 },
    maintenance:          { label: 'Under maintenance',    rank: 1 },
    unknown:              { label: 'Unknown',              rank: 1 },
    degraded_performance: { label: 'Degraded performance', rank: 2 },
    partial_outage:       { label: 'Partial outage',       rank: 3 },
    major_outage:         { label: 'Major outage',         rank: 4 },
  };
  const STATES = ['investigating', 'identified', 'monitoring', 'resolved'];
  const SEVERITIES = ['minor', 'significant', 'major', 'critical'];
  const SCENARIOS = {
    incident: 'Active incident',
    operational: 'All operational',
    sso: 'SSO outage (manual takeover)',
  };

  // ---------- helpers ----------
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const iso = (ms) => new Date(ms).toISOString();
  const nowIso = () => new Date().toISOString();

  const fTime = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, hour: 'numeric', minute: '2-digit' });
  const fDate = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const fDateY = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: 'long', day: 'numeric', year: 'numeric' });
  const fMonth = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, month: 'long', year: 'numeric' });
  const fTz = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, timeZoneName: 'short' });
  const fDay = new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' });
  const tzAbbr = (d) => (fTz.formatToParts(d).find((p) => p.type === 'timeZoneName') || {}).value || '';
  const dayKey = (d) => fDay.format(d);

  function time(isoStr) { const d = new Date(isoStr); return fTime.format(d).replace(/\s?([ap])\.?m\.?/i, (m, a) => ' ' + a.toUpperCase() + 'M'); }
  function sameDay(a, b) { return dayKey(new Date(a)) === dayKey(new Date(b)); }
  function when(isoStr) {
    const d = new Date(isoStr);
    const t = time(isoStr) + ' ' + tzAbbr(d);
    if (sameDay(isoStr, Date.now())) return 'Today ' + t;
    if (sameDay(isoStr, Date.now() - DAY)) return 'Yesterday ' + t;
    if (sameDay(isoStr, Date.now() + DAY)) return 'Tomorrow ' + t;
    return fDate.format(d) + ', ' + t;
  }
  function longDate(isoStr) { return fDateY.format(new Date(isoStr)); }
  function monthOf(isoStr) { return fMonth.format(new Date(isoStr)); }
  function dur(ms) {
    ms = Math.abs(ms);
    const m = Math.round(ms / MIN);
    if (m < 1) return 'less than a minute';
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    if (h < 24) return h + ' h' + (r ? ' ' + r + ' min' : '');
    const d = Math.floor(h / 24), rh = h % 24;
    return d + (d > 1 ? ' days' : ' day') + (rh && d < 3 ? ' ' + rh + ' h' : '');
  }
  function ago(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    return diff >= 0 ? dur(diff) + ' ago' : 'in ' + dur(diff);
  }
  // local wall-clock helper for maintenance windows: today+days at hh:mm (browser local time)
  function at(days, hh, mm) { const d = new Date(); d.setDate(d.getDate() + days); d.setHours(hh, mm || 0, 0, 0); return d.toISOString(); }

  // ---------- icons (shape differs per status, not just colour) ----------
  const ICON = {
    operational: '<circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M4.6 8.3l2.2 2.2 4.6-4.8" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/>',
    degraded_performance: '<path d="M8 .9 15.6 14.6H.4z" fill="currentColor"/><path d="M8 5.6v4.3" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="12.2" r="1" fill="#fff"/>',
    partial_outage: '<circle cx="8" cy="8" r="6.6" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 1.4a6.6 6.6 0 0 1 0 13.2z" fill="currentColor"/>',
    major_outage: '<circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M5.3 5.3l5.4 5.4M10.7 5.3l-5.4 5.4" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    maintenance: '<rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2" transform="rotate(45 8 8)" fill="currentColor"/><path d="M5.2 8h5.6" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
    unknown: '<circle cx="8" cy="8" r="7.5" fill="currentColor"/><path d="M6.1 6.2a2 2 0 1 1 2.6 1.9c-.5.2-.7.5-.7 1v.4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="11.9" r=".95" fill="#fff"/>',
  };
  const icon = (st) => `<svg class="si" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${ICON[st] || ICON.unknown}</svg>`;
  const pill = (st) => `<span class="pill st-${st}">${icon(st)}<span>${esc(STATUS[st]?.label || st)}</span></span>`;
  const sevBadge = (s) => `<span class="badge sev-${s}">${esc(cap(s))}</span>`;
  const stateBadge = (s) => `<span class="badge state-${s}">${esc(cap(s))}</span>`;

  // ---------- seed data ----------
  const GROUPS = ['Access & Identity', 'Teaching & Learning', 'Student Services', 'Network & Connectivity', 'Web & Support'];

  function baseComponents() {
    const c = (key, name, description, group) => ({ key, name, description, group, current_status: 'operational', is_public: true, archived: false });
    return [
      c('authentication', 'Authentication / SSO / MFA', 'College account sign-in and multi-factor authentication', 'Access & Identity'),
      c('m365', 'Microsoft 365 / Email', 'Outlook, Teams, OneDrive and SharePoint', 'Access & Identity'),
      c('lms', 'Learning Management System', 'eCentennial (D2L Brightspace) course sites', 'Teaching & Learning'),
      c('student-portal', 'Student Portal / SIS', 'myCentennial — grades, timetables, fees', 'Student Services'),
      c('registration', 'Registration', 'Course registration and timetable building', 'Student Services'),
      c('admissions', 'Admissions / Applicant Systems', 'Applicant portal and document uploads', 'Student Services'),
      c('campus-wifi', 'Campus Wi-Fi', 'Wireless network at all campuses', 'Network & Connectivity'),
      c('wired-network', 'Wired Network', 'Labs, offices and classroom wired connections', 'Network & Connectivity'),
      c('vpn', 'VPN', 'Remote access for staff and faculty', 'Network & Connectivity'),
      c('telephony', 'Telephony', 'Desk phones, softphones and contact centre', 'Network & Connectivity'),
      c('printing', 'Printing', 'Student and staff print release', 'Network & Connectivity'),
      c('website', 'College Website', 'Public college website', 'Web & Support'),
      c('servicenow', 'ServiceNow / IT Support', 'IT Service Desk portal and ticketing', 'Web & Support'),
    ].map((x, i) => ({ ...x, id: i + 1, display_order: i + 1 }));
  }

  let pidSeq = 0;
  const pid = (ms) => { const d = new Date(ms); pidSeq++; return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}-${(pidSeq * 7919 % 9000 + 1000)}`; };

  // Build an incident from minute offsets relative to now (negative = past).
  function mkInc(o, now) {
    const t = (m) => iso(now + m * MIN);
    const inc = {
      public_id: pid(now + o.start * MIN),
      title: o.title, severity: o.severity, summary: o.summary || '',
      source: o.source || 'manual', external_ref: o.ref || null,
      managed_by: o.managed_by || (o.source === 'servicenow' ? 'servicenow' : 'manual'),
      manual_takeover: !!o.takeover,
      started_at: t(o.start),
      resolved_at: o.resolved != null ? t(o.resolved) : null,
      next_update_at: o.next != null ? t(o.next) : null,
      components: o.components.map(([key, impact]) => ({ key, impact })),
      updates: o.updates.map(([m, state, message, by]) => ({ at: t(m), state, message, source: by || o.source || 'manual' })),
    };
    inc.state = inc.updates[inc.updates.length - 1].state;
    inc.updated_at = inc.updates[inc.updates.length - 1].at;
    return inc;
  }

  function pastIncidents(now) {
    // Resolved incidents shared by every scenario.
    return [
      mkInc({ title: 'Delays receiving external email', severity: 'minor', source: 'servicenow', ref: 'INC0012219', start: -2 * 1440 - 300, resolved: -2 * 1440 - 205,
        components: [['m365', 'degraded_performance']], updates: [
          [-2 * 1440 - 300, 'investigating', 'Some messages from outside the college are arriving late (up to 30 minutes). Sending email is not affected. IT is investigating.'],
          [-2 * 1440 - 260, 'identified', 'Microsoft has confirmed a service issue affecting inbound mail flow for some customers. Delayed messages will be delivered automatically — no action is needed.'],
          [-2 * 1440 - 205, 'resolved', 'Microsoft has resolved the issue and all delayed messages have been delivered. Email is operating normally.'],
        ] }, now),
      mkInc({ title: 'Printing unavailable at Morningside Campus', severity: 'significant', source: 'manual', start: -6 * 1440 - 620, resolved: -6 * 1440 - 470,
        components: [['printing', 'partial_outage']], updates: [
          [-6 * 1440 - 620, 'investigating', 'Print release stations at Morningside Campus are not accepting jobs. Printing at other campuses is working. Please use another campus or the library in the meantime.'],
          [-6 * 1440 - 545, 'identified', 'A configuration issue on the Morningside print server has been found. A fix is being applied.'],
          [-6 * 1440 - 470, 'resolved', 'Printing at Morningside Campus has been restored. Jobs sent during the outage may need to be re-sent.'],
        ] }, now),
      mkInc({ title: 'Slow registration during Winter term opening', severity: 'significant', source: 'servicenow', ref: 'INC0011804', start: -19 * 1440 - 840, resolved: -19 * 1440 - 610,
        components: [['registration', 'degraded_performance'], ['student-portal', 'degraded_performance']], updates: [
          [-19 * 1440 - 840, 'investigating', 'Registration is very slow due to high demand at opening. Your place in the queue is kept — please do not refresh repeatedly.'],
          [-19 * 1440 - 760, 'monitoring', 'Additional capacity has been added and response times are improving. We are monitoring.'],
          [-19 * 1440 - 610, 'resolved', 'Registration is operating normally.'],
        ] }, now),
      mkInc({ title: 'Network outage at Progress Campus', severity: 'major', source: 'manual', start: -41 * 1440 - 560, resolved: -41 * 1440 - 395,
        components: [['wired-network', 'major_outage'], ['campus-wifi', 'major_outage'], ['telephony', 'partial_outage']], updates: [
          [-41 * 1440 - 560, 'investigating', 'Wired and wireless network access is unavailable at Progress Campus. Online services can still be reached from home or mobile data.'],
          [-41 * 1440 - 505, 'identified', 'A failed core network component has been identified. Replacement hardware is on site.'],
          [-41 * 1440 - 440, 'monitoring', 'The component has been replaced and connectivity is returning. Some areas may take a few minutes to reconnect.'],
          [-41 * 1440 - 395, 'resolved', 'Network access at Progress Campus is fully restored.'],
        ] }, now),
      mkInc({ title: 'College website unavailable', severity: 'major', source: 'servicenow', ref: 'INC0010977', start: -68 * 1440 - 200, resolved: -68 * 1440 - 150,
        components: [['website', 'major_outage']], updates: [
          [-68 * 1440 - 200, 'investigating', 'The public college website is not loading. Student and staff systems are not affected.'],
          [-68 * 1440 - 150, 'resolved', 'The website hosting provider resolved the issue and the site is available again.'],
        ] }, now),
    ];
  }

  function notices(now) {
    // Planned-impact notices. `slug` is the permanent public link (/n/<slug>) and
    // never changes once published, so links in emails, LMS posts, signage QR
    // codes etc. keep working through reschedules, cancellation and completion.
    const ago = (d) => iso(now - d * DAY);
    const n = (o) => ({ status: 'scheduled', campuses: ['all'], actions: [], history: [], source: 'manual', external_ref: null, ...o, updated_at: o.updated_at || o.published_at });
    return [
      n({ id: 1, slug: 'mycentennial-upgrade', title: 'myCentennial unavailable for system upgrade',
        summary: 'myCentennial and online registration will be unavailable overnight while the student information system is upgraded.',
        description: 'The student information system behind myCentennial is being upgraded to a new version. During the work you will not be able to sign in to myCentennial, view grades, change your timetable, or register for courses.\n\neCentennial (D2L Brightspace), college email and Microsoft 365 are not affected.',
        actions: ['Save or screenshot your timetable before the maintenance starts.', 'Complete any course registration changes before 9:00 PM.', 'Fee payments made through your bank are not affected and will be posted after the work is complete.'],
        audiences: ['students', 'employees'], services: [{ key: 'student-portal', impact: 'unavailable' }, { key: 'registration', impact: 'unavailable' }],
        starts_at: at(1, 22), ends_at: at(2, 2), source: 'servicenow', external_ref: 'CHG0004417', published_at: ago(5),
        history: [{ at: ago(5), text: 'Notice published.' }] }),
      n({ id: 2, slug: 'wifi-morningside-upgrade', title: 'Wi-Fi upgrades at Morningside Campus',
        summary: 'Brief Wi-Fi interruptions at Morningside Campus while new access points are installed.',
        description: 'New wireless access points are being installed across Morningside Campus. Each area will lose Wi-Fi for up to 10 minutes while its access point is replaced. Wired connections in labs are not affected.',
        actions: ['Save your work often during the maintenance window.', 'If Wi-Fi does not come back after 15 minutes, turn your device\'s Wi-Fi off and on again.'],
        audiences: ['students', 'employees', 'public'], campuses: ['morningside'], services: [{ key: 'campus-wifi', impact: 'interruptions' }],
        starts_at: at(3, 7), ends_at: at(3, 9), published_at: ago(3), history: [{ at: ago(3), text: 'Notice published.' }] }),
      n({ id: 3, slug: 'vpn-gateway-upgrade', title: 'VPN gateway upgrade',
        summary: 'Staff VPN connections will drop briefly during an early-morning upgrade.',
        description: 'The VPN gateway used for remote access is being upgraded. Connected users will be disconnected for up to 5 minutes once during the window.',
        actions: ['Save your work before 6:00 AM if you will be connected remotely.', 'Reconnect to the VPN if you are disconnected.'],
        audiences: ['employees'], services: [{ key: 'vpn', impact: 'interruptions' }],
        starts_at: at(5, 6), ends_at: at(5, 8), published_at: ago(2), history: [{ at: ago(2), text: 'Notice published.' }] }),
      n({ id: 4, slug: 'ecentennial-vendor-maintenance', title: 'eCentennial vendor maintenance',
        summary: 'eCentennial will be unavailable for up to 4 hours overnight during the vendor\'s quarterly maintenance.',
        description: 'D2L, the vendor that hosts eCentennial, is carrying out scheduled maintenance. eCentennial course sites, quizzes and assignment submission will be unavailable.\n\nThis work was moved from its original date so it does not fall during midterm week.',
        actions: ['Do not schedule quizzes or assignment deadlines during the maintenance window.', 'Download any course materials you need beforehand.'],
        audiences: ['students', 'employees'], services: [{ key: 'lms', impact: 'unavailable' }],
        starts_at: at(12, 1), ends_at: at(12, 5), source: 'servicenow', external_ref: 'CHG0004431', published_at: ago(10), updated_at: ago(1),
        history: [{ at: ago(10), text: 'Notice published.' }, { at: ago(1), text: 'Rescheduled from ' + fDate.format(new Date(at(6, 1))) + ' to avoid midterm week.' }] }),
      n({ id: 5, slug: 'printing-system-upgrade', title: 'Printing system upgrade', status: 'cancelled',
        summary: 'This upgrade has been cancelled and will be rescheduled. Printing is not affected.',
        description: 'The print release system upgrade planned for this date will not go ahead. A new date will be announced on this page at least two weeks in advance.',
        audiences: ['students', 'employees'], services: [{ key: 'printing', impact: 'unavailable' }],
        starts_at: at(8, 18), ends_at: at(8, 22), published_at: ago(7), updated_at: ago(0.2),
        history: [{ at: ago(7), text: 'Notice published.' }, { at: ago(0.2), text: 'Cancelled. A new date will be announced.' }] }),
      n({ id: 6, slug: 'wifi-ashtonbee-firmware', title: 'Wi-Fi firmware update at Ashtonbee Campus', status: 'completed',
        summary: 'Brief Wi-Fi interruptions at Ashtonbee Campus.', description: 'Wireless controllers at Ashtonbee Campus were updated. Each area lost Wi-Fi for about two minutes.',
        audiences: ['students', 'employees'], campuses: ['ashtonbee'], services: [{ key: 'campus-wifi', impact: 'interruptions' }],
        starts_at: at(-9, 5), ends_at: at(-9, 6), published_at: ago(16), history: [{ at: ago(16), text: 'Notice published.' }, { at: iso(new Date(at(-9, 6)).getTime()), text: 'Completed as planned.' }] }),
    ];
  }

  function seed(scenario) {
    const now = Date.now();
    pidSeq = 0;
    const s = { v: 2, scenario, seeded_at: iso(now), components: baseComponents(), incidents: [], notices: notices(now), events: [], audit: [], processed: [], last_change_at: iso(now) };
    const comp = (k) => s.components.find((c) => c.key === k);

    if (scenario === 'incident') {
      s.incidents.push(mkInc({ title: 'eCentennial (Brightspace) access issues', severity: 'major', source: 'servicenow', ref: 'INC0012345', start: -63, next: 17,
        summary: 'Some users are unable to access eCentennial after signing in.',
        components: [['lms', 'major_outage']], updates: [
          [-63, 'investigating', 'Some users are currently unable to access eCentennial. IT is investigating.'],
          [-24, 'identified', 'The issue has been traced to the connection between eCentennial and the vendor\'s hosting platform. Students may see an error page after signing in. Course content and submitted work are not affected.\n\nIf an assignment or quiz deadline falls during this outage, your instructor will be notified. You do not need to contact them individually.'],
        ] }, now));
      s.incidents.push(mkInc({ title: 'Slow Wi-Fi at Progress Campus', severity: 'minor', source: 'manual', start: -150, next: 40,
        components: [['campus-wifi', 'degraded_performance']], updates: [
          [-150, 'investigating', 'Wi-Fi in some areas of Progress Campus is slower than normal. Wired connections are not affected.'],
          [-95, 'identified', 'High interference has been found on access points in the C and E wings. Network staff are adjusting the configuration.'],
          [-20, 'monitoring', 'Changes have been made and speeds are improving. We will continue monitoring through the afternoon.'],
        ] }, now));
      comp('lms').current_status = 'major_outage';
      comp('campus-wifi').current_status = 'degraded_performance';
      s.notices.unshift({ id: 7, slug: 'voicemail-migration', title: 'Voicemail system migration', status: 'scheduled',
        summary: 'Voicemail may be unavailable for short periods while mailboxes are moved to the new system.',
        description: 'Employee voicemail boxes are being moved to Microsoft Teams voicemail. Calls will still ring through, but you may not be able to leave or check voicemail for short periods.',
        actions: ['After the migration, set up your new greeting in Teams under Settings → Calls.'],
        audiences: ['employees'], campuses: ['all'], services: [{ key: 'telephony', impact: 'degraded' }],
        starts_at: iso(now - 35 * MIN), ends_at: iso(now + 85 * MIN), source: 'manual', external_ref: null,
        published_at: iso(now - 4 * DAY), updated_at: iso(now - 35 * MIN),
        history: [{ at: iso(now - 4 * DAY), text: 'Notice published.' }, { at: iso(now - 35 * MIN), text: 'Work has started.' }] });
      s.events.push({ at: iso(now - 24 * MIN), event_id: 'sn-event-000188', source_id: 'INC0012345', code: 200, result: 'updated' });
      s.events.push({ at: iso(now - 63 * MIN), event_id: 'sn-event-000187', source_id: 'INC0012345', code: 201, result: 'created' });
      s.processed.push('sn-event-000187', 'sn-event-000188');
    }

    if (scenario === 'sso') {
      s.incidents.push(mkInc({ title: 'Unable to sign in to college systems', severity: 'critical', source: 'servicenow', ref: 'INC0012360', managed_by: 'manual', takeover: true, start: -48, next: 12,
        components: [['authentication', 'major_outage'], ['m365', 'partial_outage'], ['lms', 'partial_outage'], ['student-portal', 'partial_outage'], ['servicenow', 'major_outage']], updates: [
          [-48, 'investigating', 'Many users cannot sign in to college systems that use single sign-on, including eCentennial, myCentennial and Microsoft 365. IT is investigating.', 'servicenow'],
          [-31, 'investigating', 'The IT Service Desk portal is also affected, so this page is now being updated directly by IT staff.\n\nIf you are already signed in, please stay signed in — existing sessions continue to work. Do not repeatedly retry your password, as this may lock your account.', 'manual'],
          [-9, 'identified', 'The cause has been identified in the sign-in service. A fix is being prepared. Please do not reset your password — your password is not the problem.\n\nTo reach the IT Service Desk by phone, call 416-555-0100 (demo number).', 'manual'],
        ] }, now));
      ['authentication', 'servicenow'].forEach((k) => (comp(k).current_status = 'major_outage'));
      ['m365', 'lms', 'student-portal'].forEach((k) => (comp(k).current_status = 'partial_outage'));
      s.events.push({ at: iso(now - 22 * MIN), event_id: 'sn-event-000193', source_id: 'INC0012360', code: 202, result: 'ignored — manual takeover active' });
      s.events.push({ at: iso(now - 48 * MIN), event_id: 'sn-event-000191', source_id: 'INC0012360', code: 201, result: 'created' });
      s.processed.push('sn-event-000191', 'sn-event-000193');
    }

    s.incidents.push(...pastIncidents(now));

    // Audit log seed (newest first)
    const a = (m, actor, action, object, details) => s.audit.push({ at: iso(now + m * MIN), actor, action, object, ip: actor.startsWith('integration') ? '198.51.100.24' : '203.0.113.' + (17 + (-m % 50)), request_id: 'req_' + Math.abs(Math.round(m * 7919)).toString(36).padStart(6, '0'), details: details || {} });
    if (scenario === 'incident') {
      a(-24, 'integration:servicenow', 'servicenow.upsert', 'incident INC0012345', { event_id: 'sn-event-000188', result: 'updated', state: 'identified' });
      a(-20, 'user:jpatel', 'incident.update', 'Slow Wi-Fi at Progress Campus', { state: 'monitoring' });
      a(-63, 'integration:servicenow', 'servicenow.upsert', 'incident INC0012345', { event_id: 'sn-event-000187', result: 'created' });
      a(-95, 'user:jpatel', 'incident.update', 'Slow Wi-Fi at Progress Campus', { state: 'identified' });
      a(-150, 'user:jpatel', 'incident.create', 'Slow Wi-Fi at Progress Campus', { severity: 'minor' });
      a(-152, 'user:jpatel', 'auth.login.success', 'session', { mfa: 'totp' });
    }
    if (scenario === 'sso') {
      a(-9, 'user:mchen', 'incident.update', 'Unable to sign in to college systems', { state: 'identified' });
      a(-22, 'integration:servicenow', 'servicenow.upsert.ignored', 'incident INC0012360', { event_id: 'sn-event-000193', reason: 'manual_takeover' });
      a(-31, 'user:mchen', 'incident.update', 'Unable to sign in to college systems', { state: 'investigating' });
      a(-33, 'user:mchen', 'incident.manual_takeover', 'incident INC0012360', {});
      a(-35, 'user:mchen', 'auth.login.success', 'session', { mfa: 'totp', network: 'external (mobile data)' });
      a(-36, 'user:mchen', 'auth.mfa.failure', 'session', {});
      a(-48, 'integration:servicenow', 'servicenow.upsert', 'incident INC0012360', { event_id: 'sn-event-000191', result: 'created' });
    }
    a(-3 * 1440, 'user:admin', 'token.rotate', 'api_token servicenow-prod', { scopes: ['servicenow:incident:write'] });
    a(-6 * 1440 - 470, 'user:jpatel', 'incident.resolve', 'Printing unavailable at Morningside Campus', {});
    s.audit.sort((x, y) => y.at.localeCompare(x.at));

    s.last_change_at = s.incidents.concat().sort((x, y) => y.updated_at.localeCompare(x.updated_at))[0]?.updated_at || iso(now);
    if (new Date(s.last_change_at).getTime() < now - DAY) s.last_change_at = iso(now - 6 * MIN);
    return s;
  }

  // ---------- store ----------
  function save(s) { try { localStorage.setItem(KEY, JSON.stringify(s)); } catch (e) { /* private mode: changes last for this page view only */ } }
  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.v === 2) return s; } catch (e) { /* ignore */ }
    return null;
  }
  function getState() {
    const params = new URLSearchParams(location.search);
    const sc = params.get('scenario');
    let s = null;
    if (sc && SCENARIOS[sc]) {
      s = seed(sc); save(s);
      params.delete('scenario');
      const q = params.toString();
      window.history.replaceState(null, '', location.pathname + (q ? '?' + q : '') + location.hash);
    } else {
      s = load();
      // Stale demo (seeded > 12 h ago, never edited) gets refreshed so times stay plausible.
      if (s && !s.edited && Date.now() - new Date(s.seeded_at).getTime() > 12 * HOUR) s = null;
      if (!s) { s = seed('incident'); save(s); }
    }
    return s;
  }

  // ---------- derived ----------
  const visibleComponents = (s) => s.components.filter((c) => c.is_public && !c.archived).sort((a, b) => a.display_order - b.display_order);
  const activeIncidents = (s) => s.incidents.filter((i) => i.state !== 'resolved').sort((a, b) => SEVERITIES.indexOf(b.severity) - SEVERITIES.indexOf(a.severity) || b.updated_at.localeCompare(a.updated_at));
  const resolvedIncidents = (s) => s.incidents.filter((i) => i.state === 'resolved').sort((a, b) => b.started_at.localeCompare(a.started_at));
  const compName = (s, k) => (s.components.find((c) => c.key === k) || { name: k }).name;
  const findIncident = (s, id) => s.incidents.find((i) => i.public_id === id);

  // ---------- planned-impact notices ----------
  const AUDIENCES = { students: 'Students', employees: 'Employees', applicants: 'Applicants', public: 'Visitors & public' };
  const CAMPUSES = { all: 'All campuses', progress: 'Progress Campus', morningside: 'Morningside Campus', ashtonbee: 'Ashtonbee Campus', 'story-arts': 'Story Arts Centre', downsview: 'Downsview Park', online: 'Online / remote' };
  const IMPACTS = { unavailable: 'Unavailable', degraded: 'Slower or limited', interruptions: 'Brief interruptions', none: 'No expected impact' };
  const NSTATE = { scheduled: 'Scheduled', in_progress: 'In progress', completed: 'Completed', cancelled: 'Cancelled' };

  function noticeState(n) {
    if (n.status === 'cancelled') return 'cancelled';
    const t = Date.now();
    if (n.status === 'completed' || new Date(n.ends_at).getTime() <= t) return 'completed';
    if (new Date(n.starts_at).getTime() <= t) return 'in_progress';
    return 'scheduled';
  }
  const wasRescheduled = (n) => n.history.some((h) => /^Rescheduled/.test(h.text));
  const noticeBySlug = (s, slug) => s.notices.find((n) => n.slug === slug);
  const noticePath = (slug) => '/n/' + encodeURIComponent(slug);
  const noticeUrl = (slug) => location.origin + noticePath(slug);
  // Current + upcoming, plus cancelled-but-not-yet-due (so people who saw the
  // original notice still find out it isn't happening).
  function upcomingNotices(s) {
    const t = Date.now();
    return s.notices.filter((n) => {
      const st = noticeState(n);
      if (st === 'scheduled' || st === 'in_progress') return true;
      return st === 'cancelled' && new Date(n.starts_at).getTime() > t;
    }).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  }
  function countdown(n) {
    const st = noticeState(n);
    if (st === 'in_progress') return 'Ends in ' + dur(new Date(n.ends_at) - Date.now());
    if (st === 'scheduled') return 'Starts in ' + dur(new Date(n.starts_at) - Date.now());
    return '';
  }
  function inProgressNoticeFor(s, key) {
    return s.notices.find((n) => noticeState(n) === 'in_progress' && n.services.some((x) => x.key === key && x.impact !== 'none'));
  }
  // What the public sees for a component: an active planned window shows as
  // maintenance unless an incident has already set something worse.
  function effStatus(s, c) {
    if (c.current_status === 'operational' && inProgressNoticeFor(s, c.key)) return 'maintenance';
    return c.current_status;
  }

  function overall(s) {
    const comps = visibleComponents(s);
    const worst = comps.reduce((w, c) => { const st = effStatus(s, c); return STATUS[st].rank > STATUS[w].rank ? st : w; }, 'operational');
    // "Major disruption" is reserved for sign-in being down or several services out;
    // a single service down reads as "some systems" (the icon still shows severity).
    const affected = comps.filter((c) => STATUS[c.current_status].rank >= 2).length;
    const ssoDown = comps.some((c) => c.key === 'authentication' && c.current_status === 'major_outage');
    const map = {
      operational: 'All systems operational',
      maintenance: 'Planned maintenance in progress',
      unknown: 'Some service statuses are unknown',
      degraded_performance: 'Some systems are experiencing issues',
      partial_outage: 'Some systems are experiencing issues',
      major_outage: ssoDown || affected >= 3 ? 'Major service disruption' : 'Some systems are experiencing issues',
    };
    return { status: worst, text: map[worst] };
  }

  // 90-day daily history for a component: worst impact per day from incidents/notices.
  function dailyBars(s, key) {
    const days = [];
    const today = new Date();
    const idx = {};
    for (let i = 89; i >= 0; i--) { const d = new Date(today.getTime() - i * DAY); const k = dayKey(d); idx[k] = days.length; days.push({ key: k, label: fDateY.format(d), st: 'operational' }); }
    let downMs = 0, incidents = 0;
    const mark = (t, st) => { const i = idx[dayKey(new Date(t))]; if (i != null && STATUS[st].rank > STATUS[days[i].st].rank) days[i].st = st; };
    const bump = (startIso, endIso, st) => {
      const a = new Date(startIso).getTime(), b = endIso ? Math.min(new Date(endIso).getTime(), Date.now()) : Date.now();
      if (st === 'major_outage') downMs += Math.max(0, b - a);
      else if (st === 'partial_outage') downMs += Math.max(0, b - a) * 0.3;
      for (let t = a; t < b; t += HOUR) mark(t, st);
      mark(b, st);
    };
    s.incidents.forEach((inc) => inc.components.forEach((c) => { if (c.key === key && c.impact !== 'operational') { incidents++; bump(inc.started_at, inc.resolved_at, c.impact); } }));
    s.notices.forEach((n) => { const st = noticeState(n); if ((st === 'completed' || st === 'in_progress') && n.status !== 'cancelled' && n.services.some((x) => x.key === key)) bump(n.starts_at, n.ends_at, 'maintenance'); });
    const pct = Math.max(0, 100 - (downMs / (90 * DAY)) * 100);
    return { days, incidents, uptime: pct >= 99.995 ? '100' : pct.toFixed(2) };
  }

  // ---------- shared page chrome ----------
  function protoBanner(s, extra) {
    const links = Object.entries(SCENARIOS).map(([k, v]) => `<a href="?scenario=${k}"${s.scenario === k && !s.edited ? ' aria-current="true"' : ''}>${esc(v)}</a>`).join(' ');
    return `<div class="proto"><div class="wrap">
      <p><span class="proto-tag">Prototype</span> Mockup with dummy data. Not an official Centennial College service.${extra ? ' ' + extra : ''}</p>
      <p class="scen"><span>Demo scenario:</span> ${links}</p>
    </div></div>`;
  }

  // Relative times are rendered as <span data-ago> so pages can refresh the text
  // in place, without re-rendering (which would move keyboard/screen-reader focus).
  const agoSpan = (isoStr) => `<span data-ago="${esc(isoStr)}">${esc(ago(isoStr))}</span>`;
  const cdSpan = (n) => `<span data-countdown="${esc(n.slug)}">${esc(countdown(n))}</span>`;
  function refreshRelative(root, s) {
    root.querySelectorAll('[data-ago]').forEach((el) => { el.textContent = ago(el.dataset.ago); });
    if (s) root.querySelectorAll('[data-countdown]').forEach((el) => { const n = noticeBySlug(s, el.dataset.countdown); if (n) el.textContent = countdown(n); });
  }

  function incidentCard(s, inc, opts) {
    opts = opts || {};
    const last = inc.updates[inc.updates.length - 1];
    const worst = inc.components.reduce((w, c) => (STATUS[c.impact].rank > STATUS[w].rank ? c.impact : w), 'operational');
    const href = '/incident.html?id=' + encodeURIComponent(inc.public_id);
    const H = opts.h || 'h3';
    return `<article class="card incident-card st-${worst}" aria-labelledby="t-${esc(inc.public_id)}">
      <${H} id="t-${esc(inc.public_id)}">${opts.nolink ? esc(inc.title) : `<a href="${esc(href)}">${esc(inc.title)}</a>`}</${H}>
      <div class="meta-row">${sevBadge(inc.severity)} ${stateBadge(inc.state)}</div>
      <ul class="chips" aria-label="Affected services">${inc.components.map((c) => `<li class="chip st-${c.impact}">${icon(c.impact)}<span>${esc(compName(s, c.key))}: ${esc(STATUS[c.impact].label)}</span></li>`).join('')}</ul>
      <p class="latest"><strong>${esc(cap(last.state))}:</strong> ${esc(last.message)}</p>
      <div class="times">
        <span>Updated <strong>${esc(when(last.at))}</strong> (${agoSpan(last.at)})</span>
        ${inc.next_update_at && inc.state !== 'resolved' ? `<span>Next update expected by <strong>${esc(time(inc.next_update_at))}</strong></span>` : ''}
        <span>Started ${esc(when(inc.started_at))}</span>
      </div>
      ${opts.nolink ? '' : `<p class="small card-link"><a href="${esc(href)}">Full timeline<span class="sr-only"> for ${esc(inc.title)}</span></a></p>`}
    </article>`;
  }

  function noticeBadge(n) {
    const st = noticeState(n);
    return `<span class="badge nstate-${st}">${st === 'in_progress' ? icon('maintenance') : ''}${esc(NSTATE[st])}</span>` +
      (wasRescheduled(n) && st === 'scheduled' ? ' <span class="badge">Rescheduled</span>' : '');
  }
  const audienceText = (n) => n.audiences.map((a) => AUDIENCES[a]).join(', ');
  const campusText = (n) => n.campuses.map((c) => CAMPUSES[c]).join(', ');

  function noticeCard(s, n, opts) {
    opts = opts || {};
    const st = noticeState(n);
    const H = opts.h || 'h3';
    const link = opts.target ? ` target="${opts.target}"` : '';
    return `<article class="card notice-card nc-${st}" aria-labelledby="n-${esc(n.slug)}">
      <${H} id="n-${esc(n.slug)}">${opts.nolink ? esc(n.title) : `<a href="${noticePath(n.slug)}"${link}>${esc(n.title)}</a>`}</${H}>
      <div class="meta-row">${noticeBadge(n)}${st === 'scheduled' || st === 'in_progress' ? ` <span class="countdown">${cdSpan(n)}</span>` : ''}</div>
      <p class="when-line"><strong>${esc(when(n.starts_at))}</strong> to <strong>${esc(when(n.ends_at))}</strong></p>
      <p>${esc(n.summary)}</p>
      ${opts.compact ? '' : `<dl class="kv small">
        <dt>Services</dt><dd>${n.services.map((x) => `${esc(compName(s, x.key))} (${esc(IMPACTS[x.impact].toLowerCase())})`).join(', ')}</dd>
        <dt>Who's affected</dt><dd>${esc(audienceText(n))}</dd>
        <dt>Where</dt><dd>${esc(campusText(n))}</dd>
      </dl>`}
      ${opts.nolink ? '' : `<p class="small card-link"><a href="${noticePath(n.slug)}"${link}>Details and what to do<span class="sr-only">: ${esc(n.title)}</span></a></p>`}
    </article>`;
  }

  // iCalendar file for one or more notices (RFC 5545) so people can add planned work to Outlook/Google.
  function ics(list) {
    const stamp = (isoStr) => isoStr.replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const fold = (line) => line.match(/.{1,73}/g).join('\r\n ');
    const txt = (t) => String(t).replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1');
    const ev = list.map((n) => [
      'BEGIN:VEVENT', `UID:${n.slug}@${location.hostname}`, `DTSTAMP:${stamp(nowIso())}`, `DTSTART:${stamp(n.starts_at)}`, `DTEND:${stamp(n.ends_at)}`,
      fold('SUMMARY:' + txt((n.status === 'cancelled' ? 'CANCELLED: ' : 'IT planned work: ') + n.title)),
      fold('DESCRIPTION:' + txt(n.summary + '\n\nDetails: ' + noticeUrl(n.slug))), `URL:${noticeUrl(n.slug)}`,
      `STATUS:${n.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`, 'TRANSP:TRANSPARENT', 'END:VEVENT',
    ].join('\r\n'));
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Centennial College IT Status (prototype)//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', ...ev, 'END:VCALENDAR'].join('\r\n') + '\r\n';
  }
  function download(name, mime, text) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type: mime }));
    a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  // One persistent polite live region, reused, so screen readers reliably announce it.
  function toast(msg) {
    let t = document.getElementById('toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(() => { t.classList.remove('show'); }, 5000);
  }

  window.CC = {
    TZ, STATUS, STATES, SEVERITIES, SCENARIOS, GROUPS, MIN, HOUR, DAY, AUDIENCES, CAMPUSES, IMPACTS, NSTATE,
    esc, cap, iso, nowIso, time, when, longDate, monthOf, dur, ago, tzAbbr,
    icon, pill, sevBadge, stateBadge,
    seed, save, load, getState,
    visibleComponents, activeIncidents, resolvedIncidents, compName, findIncident, overall, dailyBars, effStatus,
    noticeState, noticeBySlug, noticePath, noticeUrl, upcomingNotices, countdown, wasRescheduled, audienceText, campusText, noticeBadge, noticeCard,
    protoBanner, incidentCard, agoSpan, refreshRelative, ics, download, toast,
  };
})();
