/*! Elevated lead capture. Usage (put it on every page so we can tell where visitors came from):
 *  <script src="https://elevatedlevel.app/lead-form.js" data-key="YOUR_KEY" defer></script>
 *  - Shows a contact form wherever you put <div id="elevated-lead-form"></div>
 *  - With data-capture="true" it also copies submissions of your existing forms into Elevated.
 *  Remembers the first ad/post link (utm_*) a visitor arrived from for 90 days. */
(function () {
  var s = document.currentScript || document.querySelector('script[src*="lead-form.js"]');
  if (!s) return;
  var key = s.getAttribute("data-key");
  var base = new URL(s.src).origin;
  var endpoint = base + "/api/leads/" + encodeURIComponent(key);
  var color = s.getAttribute("data-color") || "#86b51f";
  var STORE = "elevated_utm";

  // First-touch attribution.
  var utm = {};
  try {
    var q = new URLSearchParams(location.search);
    ["utm_source", "utm_medium", "utm_campaign", "utm_content"].forEach(function (k) { if (q.get(k)) utm[k] = q.get(k); });
    var saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (utm.utm_source && (!saved || Date.now() - saved.t > 90 * 864e5)) localStorage.setItem(STORE, JSON.stringify({ t: Date.now(), v: utm, r: document.referrer }));
    saved = JSON.parse(localStorage.getItem(STORE) || "null");
    if (saved && Date.now() - saved.t < 90 * 864e5) utm = saved.v, utm.referrer = saved.r;
  } catch (e) {}
  if (!utm.referrer) utm.referrer = document.referrer;

  function send(fields, via) {
    var body = Object.assign({}, utm, fields, { page: location.href, _via: via });
    return fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), keepalive: true });
  }

  // Hosted form.
  var mount = document.getElementById("elevated-lead-form");
  if (mount) {
    var css = "font:inherit;width:100%;padding:10px 12px;border:1px solid #d5dbe1;border-radius:8px;margin:4px 0 12px;box-sizing:border-box";
    mount.innerHTML =
      '<form novalidate style="max-width:520px">' +
      '<label>Name<input name="name" required autocomplete="name" style="' + css + '"></label>' +
      '<label>Email<input name="email" type="email" autocomplete="email" style="' + css + '"></label>' +
      '<label>Phone<input name="phone" type="tel" autocomplete="tel" style="' + css + '"></label>' +
      '<label>How can we help?<textarea name="message" rows="4" style="' + css + '"></textarea></label>' +
      '<input name="_gotcha" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px" aria-hidden="true">' +
      '<button type="submit" style="font:inherit;font-weight:600;padding:12px 20px;border:0;border-radius:8px;background:' + color + ';color:#fff;cursor:pointer">Send</button>' +
      '<p data-msg role="status" style="margin-top:10px"></p></form>';
    var f = mount.querySelector("form");
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var d = Object.fromEntries(new FormData(f).entries());
      var msg = f.querySelector("[data-msg]");
      if (!d.name || (!d.email && !d.phone)) { msg.textContent = "Please add your name and an email or phone number."; return; }
      f.querySelector("button").disabled = true;
      send(d, "elevated-form").then(function (r) {
        if (!r.ok) throw 0;
        f.innerHTML = "<p><strong>Thanks! We'll be in touch soon.</strong></p>";
      }).catch(function () {
        msg.textContent = "Something went wrong. Please call or email us instead.";
        f.querySelector("button").disabled = false;
      });
    });
  }

  // Copy submissions of the site's existing forms.
  if (s.getAttribute("data-capture") === "true") {
    document.addEventListener("submit", function (e) {
      var form = e.target;
      if (!form || !form.elements || (mount && mount.contains(form))) return;
      var d = {};
      Array.prototype.forEach.call(form.elements, function (el) {
        if (!el.name || el.type === "password" || el.type === "hidden" || /card|cvc|cvv|ssn|password/i.test(el.name)) return;
        var n = el.name.toLowerCase(), v = (el.value || "").trim();
        if (!v) return;
        if (/mail/.test(n) || el.type === "email") d.email = v;
        else if (/phone|tel|mobile/.test(n) || el.type === "tel") d.phone = v;
        else if (/first/.test(n)) d.first_name = v;
        else if (/last|surname/.test(n)) d.last_name = v;
        else if (/name/.test(n)) d.name = v;
        else if (/message|comment|detail|help|note/.test(n)) d.message = v;
      });
      if (d.email || d.phone) send(d, "elevated-capture").catch(function () {});
    }, true);
  }
})();
