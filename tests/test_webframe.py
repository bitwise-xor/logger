"""The hub may show the web app's signed-in pages in a frame (20.11.2026), in the compact view (?compact=1) without the menus.
The sign-in, Settings (it signs out devices), the signed-out pages and the OAuth sign-in (auth.py) stay out of every frame."""
import re
import secrets

from test_auth import client as mcp_client, register, set_owner as set_mcp_owner, start
from test_web import client, web  # noqa: F401 - web is a fixture

HUB = "frame-ancestors 'self' https://hub.19hospitalroad.fyi"


def framed_by_the_hub(r):
    return "x-frame-options" not in r.headers and HUB in r.headers["content-security-policy"] \
        and "frame-ancestors 'none'" not in r.headers["content-security-policy"]


def in_no_frame(r):
    return r.headers["x-frame-options"] == "DENY" and "frame-ancestors 'none'" in r.headers["content-security-policy"] \
        and "hub." not in r.headers["content-security-policy"]


def test_signed_in_pages_may_be_framed_by_the_hub_only(web):
    c, _csrf = web
    for path in ("/web/", "/web/?compact=1", "/web/food", "/web/health", "/web/habits", "/web/gym", "/web/home", "/web/week",
                 "/web/gratitude", "/web/nowhere"):
        r = c.get(path)
        assert r.status_code in (200, 404), path
        assert framed_by_the_hub(r), path
        # the rest of the policy is the same as before
        csp = r.headers["content-security-policy"]
        assert "default-src 'none'" in csp and "script-src 'self'" in csp and "form-action 'self'" in csp, path
        assert r.headers["referrer-policy"] == "same-origin" and r.headers["cache-control"] == "no-store", path


def test_settings_and_the_sign_in_stay_out_of_every_frame(web):
    c, _csrf = web
    for tab in ("", "?tab=devices", "?tab=notify", "?tab=export", "?tab=targets"):
        assert in_no_frame(c.get("/web/settings" + tab)), tab
    signed_out = client()
    assert in_no_frame(signed_out.get("/web/login"))
    assert in_no_frame(signed_out.get("/web/login?next=/web/food"))
    assert in_no_frame(signed_out.get("/web/nowhere"))  # a signed-out page: the bare frame
    assert signed_out.get("/web/").status_code == 302  # signed out, Today only sends to the sign-in (no page to frame)


def test_the_oauth_sign_in_stays_out_of_every_frame():
    set_mcp_owner()
    c = mcp_client()
    req = start(c, register(c).json()["client_id"], secrets.token_urlsafe(48))
    for r in (c.get("/login", params={"req": req}), c.get("/login", params={"req": "gone"}),
              c.post("/login", data={"req": req, "password": "wrong", "code": "000000"})):
        assert in_no_frame(r), r.status_code


def test_the_cookie_stays_strict_and_this_host_only(web):
    # the hub and the app are one site, so the frame sends the cookie as it is; nothing about it changed for the frame
    c, csrf = web
    r = c.post("/web/logout", data={"csrf": csrf}, headers={"Origin": "https://app.example.test"})
    assert r.status_code == 303
    gone = r.headers["set-cookie"].lower()
    assert "__host-logger_session=" in gone and "samesite=strict" in gone and "domain" not in gone


def test_compact_view_hides_the_top_bar_and_the_tab_bar(web):
    c, _csrf = web
    page = c.get("/web/?compact=1").text
    head = page.split("</head>")[0]
    # theme.js decides before the first paint: loaded in <head>, blocking (no defer), before the stylesheet
    theme = re.search(r'<script src="/web/static/theme\.js\?v=\w+"></script>', head)
    assert theme and head.index(theme.group(0)) < head.index("app.css")
    # what the compact view hides is the page's only top bar and tab bar; the entry box and the day stay
    assert page.count("<header>") == 1 and page.count('<nav class="tabs"') == 1 and 'class="entry' in page
    js = c.get("/web/static/theme.js").text
    for want in ('get("compact")', 'q === "1"', 'sessionStorage.setItem("compact", "1")', 'sessionStorage.removeItem("compact")',
                 "window.self !== window.top", 'classList.add("compact")'):
        assert want in js, want
    css = c.get("/web/static/app.css").text
    assert "html.compact header,html.compact .tabs{display:none}" in css
    # the compact rules come after the ones they override (same weight or less: the later one wins)
    assert css.index("html.compact .entry{") > css.index(".entry{position:fixed")


def test_compact_view_changes_no_data_and_no_action(web):
    c, _csrf = web
    plain, compact = c.get("/web/").text, c.get("/web/?compact=1").text
    strip = lambda t: re.sub(r'name="(csrf|key)" value="[^"]*"', "", t)
    assert strip(plain) == strip(compact)  # the same page; only the browser hides the menus
