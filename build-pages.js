// Generates the HTML shells in site/ so every page shares the same header,
// navigation, footer and accessibility features. Run: node build-pages.js
const fs = require('fs');
const path = require('path');
const out = (f) => path.join(__dirname, 'site', f);
// CDNs (e.g. Cloudflare) often override Cache-Control on static assets, so asset
// URLs carry a content hash: a changed file gets a new URL and is fetched fresh.
const v = (f) => '/assets/' + f + '?v=' + require('crypto').createHash('sha1').update(fs.readFileSync(out('assets/' + f))).digest('hex').slice(0, 8);

const NAV = [
  ['/', 'Current status', 'home'],
  ['/notices.html', 'Planned work', 'notices'],
  ['/history.html', 'History', 'history'],
  ['/admin/', 'Staff sign-in', 'admin'],
];

function page({ file, page, title, script = 'public', navKey, body = '', extraHead = '', admin = false }) {
  const nav = NAV.map(([href, label, key]) => `        <li><a href="${href}"${key === navKey ? ' aria-current="page"' : ''}>${label}</a></li>`).join('\n');
  // In the admin app the URL hash is the router, so the skip link moves focus without touching the hash.
  const skip = admin
    ? '<a class="skip" href="#main" onclick="event.preventDefault();document.getElementById(\'main\').focus()">Skip to main content</a>'
    : '<a class="skip" href="#main">Skip to main content</a>';
  const html = `<!doctype html>
<html lang="en-CA">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="Prototype IT system status page for Centennial College, with dummy data.">
<meta name="theme-color" content="#D4DF38">
<title>${title} | IT System Status (prototype)</title>
<link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' rx='3' fill='%23D4DF38'/%3E%3Cpath d='M4 8.3l2.4 2.4L12 5' fill='none' stroke='%23414042' stroke-width='2'/%3E%3C/svg%3E">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@700;800&display=swap">
<link rel="stylesheet" href="${v('style.css')}">
${extraHead}</head>
<body data-page="${page}">
${skip}
<aside id="proto" aria-label="Prototype notice"><div class="proto"><div class="wrap"><p><span class="proto-tag">Prototype</span> Mockup with dummy data. Not an official Centennial College service.</p></div></div></aside>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="/"><small>Centennial College</small><span>IT System Status</span></a>
    <nav class="site-nav" aria-label="Main">
      <ul>
${nav}
      </ul>
    </nav>
  </div>
</header>
<main id="main" tabindex="-1">
  <div class="wrap" id="content">
${body || `    <noscript><div class="card"><p><strong>JavaScript is turned off.</strong> This prototype builds its demo data in the browser. The production version will be server-rendered and work fully without JavaScript.</p></div></noscript>`}
  </div>
</main>
<footer class="site-footer">
  <div class="wrap">
    <p>This page is hosted outside the college network, so it stays available when college systems, sign-in or the college website are down.</p>
    <p>Need help? IT Service Desk: <a href="tel:+14165550100">416-555-0100</a> (demo number). All times are Eastern Time.</p>
    <ul class="foot-links">
      <li><a href="/accessibility.html">Accessibility</a></li>
      <li><a href="/notices.html">Planned work</a></li>
      <li><a href="/history.html">Incident history</a></li>
    </ul>
  </div>
</footer>
<script src="${v('core.js')}"></script>
<script src="${v(script + '.js')}"></script>
</body>
</html>
`;
  fs.mkdirSync(path.dirname(out(file)), { recursive: true });
  fs.writeFileSync(out(file), html);
  console.log('wrote', file);
}

page({ file: 'index.html', page: 'home', title: 'Current status', navKey: 'home' });
page({ file: 'incident.html', page: 'incident', title: 'Incident' });
page({ file: 'history.html', page: 'history', title: 'Incident history', navKey: 'history' });
page({ file: 'notices.html', page: 'notices', title: 'Planned work', navKey: 'notices' });
page({ file: 'notice.html', page: 'notice', title: 'Planned work notice', navKey: 'notices',
  extraHead: '<script src="https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js"></script>\n' });
page({ file: 'admin/index.html', page: 'admin', title: 'Staff admin', navKey: 'admin', script: 'admin', admin: true });

page({ file: 'accessibility.html', page: 'static', title: 'Accessibility', script: 'static', body: `
    <section>
      <h1 class="page-title">Accessibility</h1>
      <p class="lede">This status page is for everyone, including during an outage when people may be stressed, on a phone, or using assistive technology. It is designed to meet the Web Content Accessibility Guidelines (WCAG) 2.2 Level AA. That goes beyond the WCAG 2.0 Level AA required by the Accessibility for Ontarians with Disabilities Act (AODA) Integrated Accessibility Standards.</p>
    </section>
    <section aria-labelledby="a-what">
      <div class="section-head"><h2 id="a-what">What we've done</h2></div>
      <div class="card">
        <ul class="actions-list">
          <li>Every status uses an icon shape and a text label, not just colour.</li>
          <li>Text and controls meet WCAG contrast ratios in both light and dark mode. Centennial Green is used only as a background behind dark text, never as text on white.</li>
          <li>Everything works with a keyboard, with a clearly visible focus outline and a "Skip to main content" link.</li>
          <li>The page doesn't refresh on its own. When new information arrives you get an announcement and a "Show latest updates" button, so screen readers don't lose your place.</li>
          <li>Pages reflow to 320 pixels wide and support text zoom to 200%, Windows High Contrast (forced colours) and reduced-motion settings.</li>
          <li>Buttons and links are at least 44 by 44 pixels where possible, which makes them easier to tap.</li>
          <li>Planned-work notices can be added to your calendar, so you don't need to remember to check back.</li>
          <li>We write in plain language and tell you what to do, not just what's broken.</li>
        </ul>
      </div>
    </section>
    <section aria-labelledby="a-known">
      <div class="section-head"><h2 id="a-known">Known limitations of this prototype</h2></div>
      <div class="card">
        <ul class="actions-list">
          <li>This prototype needs JavaScript. The production version will be server-rendered and work without it.</li>
          <li>The 90-day history bars give a summary to screen readers, but not day-by-day detail. The <a href="/history.html">incident history</a> page lists the same information as text.</li>
          <li>The prototype has not yet had a formal audit or testing with assistive-technology users. That should happen before launch.</li>
        </ul>
      </div>
    </section>
    <section aria-labelledby="a-fb">
      <div class="section-head"><h2 id="a-fb">Feedback and alternative formats</h2></div>
      <div class="card">
        <p>If you have trouble using this page, or you need information in another format, contact the IT Service Desk at <a href="tel:+14165550100">416-555-0100</a> (demo number). We will provide it in a format that works for you, in a timely way and at no cost.</p>
      </div>
    </section>` });

page({ file: 'embed.html', page: 'embed', title: 'Planned work widget', body: '' });
// The embed is shown inside other sites' iframes: strip the site chrome.
let embed = fs.readFileSync(out('embed.html'), 'utf8');
embed = embed
  .replace('<body data-page="embed">', '<body data-page="embed" class="embed">')
  .replace(/<a class="skip"[^\n]*\n/, '')
  .replace(/<aside id="proto"[\s\S]*?<\/header>\n/, '')
  .replace(/<footer[\s\S]*?<\/footer>\n/, '')
  .replace('<main id="main" tabindex="-1">\n  <div class="wrap" id="content">', '<main id="main">\n  <div id="content">');
fs.writeFileSync(out('embed.html'), embed);
