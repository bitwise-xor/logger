"""The Home timer's notification (web item 57, 22.11.2026): "Time is up" on the phone at the moment the Home > Pick timer ends,
also when the phone is locked or the page is closed. The nudges' check (nudges.py, cron every 5 minutes) is too coarse for that,
so a thread of the core (started beside the clean-up in main.py; the core runs as one uvicorn process) looks every 10 seconds.

A round claims the timers that just ended in one UPDATE (home_timers.notified_at, migration 036), so two rounds or two processes
never send the same one twice. The claim is committed before the send, and a send that fails is not repeated: a late "time is up"
is worse than none. Only a timer that ended in the last 10 minutes is claimed (after the core was down, nothing comes late).
Pause, resume and "Done, next job" need nothing here: a paused timer has no end, a resumed one has its new end, the next job keeps
the end; a timer closed before its end is never claimed. The switch is the nudge "home_timer" (Settings > Notifications, on by
default) under the master switch; the quiet hours and the once-a-day rule do not apply (the owner started this timer just now).
The job's name goes only into the message, never into a log line."""
import logging
import threading
import time

from . import home, logbook, nudges
from .db import connect

log = logging.getLogger("logger.hometimer")
EVERY_SECONDS = 10
LATE_MINUTES = 10  # a timer that ended longer ago than this is never announced
URL = "/web/home/pick"  # the Pick page shows the open timer's job (logger.: /home/pick, nudges.LOGGER_LINKS)
TAG = "home_timer"
PUSH = {"ttl": LATE_MINUTES * 60, "urgency": "high"}  # a phone offline longer than that gets nothing late; a sleeping one wakes now


def claim(cur, now=None) -> list[dict]:
    """Mark the timers that ended in the last LATE_MINUTES and were not announced; -> those rows (id, minutes, pairs). now: the
    database's clock when None. One statement: a second claim at the same moment waits for the first and then finds nothing."""
    cur.execute("""WITH t AS (SELECT coalesce(%s::timestamptz, now()) AS now)
                   UPDATE home_timers h SET notified_at = t.now FROM t
                   WHERE NOT h.closed AND h.notified_at IS NULL AND h.ends_at IS NOT NULL
                     AND h.ends_at <= t.now AND h.ends_at > t.now - make_interval(mins => %s)
                   RETURNING h.id, h.minutes, h.pairs""", (now, LATE_MINUTES))
    return cur.fetchall()


def message(t: dict) -> dict:
    """The notification for a claimed timer: the job's name and the minutes, or the minutes alone when the job is gone."""
    mins = f'{t["minutes"]} minute{"" if t["minutes"] == 1 else "s"}'
    try:
        with connect() as c, c.cursor() as cur:
            job = home.job_of(home.load(cur), [tuple(x) for x in t["pairs"]])
    except Exception as e:  # noqa: BLE001 - the minutes alone are still worth sending
        log.error("home timer job not read: %s", type(e).__name__)
        job = None
    return {"title": "Time is up", "body": f'{job["title"]} · {mins}' if job else mins,
            "url": URL, "tag": TAG}


def round(now=None) -> dict:  # noqa: A001 - the name the brief and the tests use
    """One look: claim the timers that just ended and, when the setting allows, send each one's notification to every device.
    -> {"claimed", "sent" (timers that reached a device), "devices"}. Never raises for a failed send."""
    with connect() as c, c.cursor() as cur:  # committed here, before anything is sent
        done = claim(cur, now)
    if not done:
        return {"claimed": 0, "sent": 0, "devices": 0}
    with connect() as c, c.cursor() as cur:
        s = nudges.load(cur)
        cur.execute("SELECT count(*) AS n FROM push_subscriptions")
        devices = cur.fetchone()["n"]
    sent = 0
    if devices and s["on"] and s["home_timer"]:
        for t in done:
            try:
                sent += bool(nudges.deliver(message(t), **PUSH))
                with connect() as c, c.cursor() as cur:
                    logbook._audit(cur, "nudge", "sent", {"kind": TAG}, "nudges")
            except Exception as e:  # noqa: BLE001 - not repeated: a late "time is up" is worse than none
                log.error("home timer notification failed: %s", type(e).__name__)
    return {"claimed": len(done), "sent": sent, "devices": devices}


def _loop() -> None:
    while True:
        time.sleep(EVERY_SECONDS)
        try:
            r = round()
            if r["claimed"]:
                log.info("home timer ended: %s", r)
        except Exception as e:  # noqa: BLE001 - a failed round must never stop the app
            log.error("home timer round failed: %s", type(e).__name__)


def start() -> None:
    threading.Thread(target=_loop, name="hometimer", daemon=True).start()
