"""To-dos and shopping in Todoist: v1's chat rules (v1 chat instructions, section 7), now in the core.
Shopping, per item: an open item with that name means "already on your list"; otherwise a completed one of the last
90 days is unchecked; otherwise the item goes on the list in English, in the best section with a store label (a small
AI call places it). Several close names become a question; a generic word ("fruits") is not added. Tasks go to the
fitting section of Lists, unclear ones to the Inbox. Every action is stored in todo_actions, so undo can take it back;
when Todoist is down, the item waits and is sent again with the next message.
A task is made once (core item 33, 21.11.2026): each create has a key (`once`) that is the same on every retry of the same
request, and the task Todoist made for it is kept in todo_sent, committed at once, so a retry of a save that failed after
the add takes it from there instead of adding it again."""
import hashlib
import os
import pathlib
import re
import secrets
import time
from datetime import datetime, timedelta, timezone
from typing import Optional

from psycopg.types.json import Jsonb

from .ai.parser import BOOL, STR, _null, _obj
from .ai.provider import Provider, ProviderError, Usage
from .db import connect
from .todoist import Todoist, TodoistAPI, TodoistError
from .v1_food import _sing

# v1's ids (chat instructions, section 7); they belong to the owner's Todoist account.
SHOPPING, LISTS, INBOX = "6gfMhf7M79qmgRJ5", "6hjQ62fhxpmGj2rH", "6gfMc8H3vr6qQ5H8"
PLACE_MODEL = "claude-haiku-5-5"
PLACE_PROMPT = (pathlib.Path(__file__).parent / "ai" / "prompts" / "todo_place.md").read_text()
PLACE_SCHEMA = _obj({"section": STR, "label": _null(STR), "generic": BOOL})
CACHE_SECONDS = 600
WAIT_DAYS = 3
SENT_DAYS = 7  # todo_sent rows are kept this long (maintenance.py): a retry comes within hours, a waiting item within 3 days
LOST_WINDOW = (timedelta(minutes=1), timedelta(minutes=5))  # a lost add's task was made this long before or after it was sent

CLIENT: Optional[Todoist] = None  # created on first use; tests put a fake here
_cache: dict = {}
_last: dict = {}  # key -> (time read, value): the last good answer, kept when the cache is cleared (the page's fallback)


def client() -> Todoist:
    global CLIENT
    if CLIENT is None:
        CLIENT = TodoistAPI(os.environ["TODOIST_API_TOKEN"])
    return CLIENT


def _cached(key, fetch):
    hit = _cache.get(key)
    if hit and time.monotonic() - hit[0] < CACHE_SECONDS:
        return hit[1]
    value = fetch()
    _cache[key] = (time.monotonic(), value)
    _last[key] = (datetime.now(), value)
    return value


def last_good(*keys):
    """(the oldest read time, [values]) of the last good answers for all keys, or None (none yet since the start)."""
    if not all(k in _last for k in keys):
        return None
    return min(_last[k][0] for k in keys), [_last[k][1] for k in keys]


def forget() -> None:
    """After a change in Todoist the cached lists are stale."""
    _cache.clear()


def _open(project: str) -> list[dict]:
    return _cached(("open", project), lambda: client().open_tasks(project))


def _sections(project: str) -> dict[str, str]:
    """section id -> name"""
    return _cached(("sections", project), lambda: {s["id"]: s["name"] for s in client().sections(project)})


def _en(content: str) -> str:
    """Shopping items are named "English | French | German"; the English part is what is matched and shown."""
    return content.split(" | ")[0].strip()


def _word(w: str) -> str:
    w = _sing(w)
    return w[:-1] if w.endswith("oe") else w  # tomatoes -> tomatoe -> tomato


def _key(s: str) -> str:
    return " ".join(_word(w) for w in re.findall(r"[a-z0-9äöüß]+", s.lower()))


def _match(item: str, tasks: list[dict]) -> tuple[list[dict], bool]:
    """-> (matches, exact). The exact name wins (Milk over Oat Milk); otherwise close names: every word of the item in
    the name, or every word of the name in the item ("low-fat quark" and "Quark"). Completed tasks repeat; the newest
    completion of a name counts."""
    k = _key(item)
    words = set(k.split())
    exact, close, seen = [], [], set()
    for t in sorted(tasks, key=lambda t: t.get("completed_at") or "", reverse=True):
        tk = _key(_en(t["content"]))
        if tk in seen:
            continue
        seen.add(tk)
        if tk == k:
            exact.append(t)
        elif words and tk and (words <= set(tk.split()) or set(tk.split()) <= words):
            close.append(t)
    return (exact, True) if exact else (close, False)


def _record(cur, batch: str, raw_id, op: str, item: str, t: Optional[dict] = None, place: Optional[str] = None,
            payload: Optional[dict] = None) -> None:
    cur.execute("""INSERT INTO todo_actions (batch, raw_id, op, item, task_id, content, place, payload)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (batch, raw_id, op, item, t and t["id"], t and t["content"], place, Jsonb(payload) if payload else None))


def _where(t: dict) -> str:
    sec = _sections(t["project_id"]).get(t.get("section_id")) if t.get("section_id") else None
    proj = {SHOPPING: "Shopping", LISTS: "Lists", INBOX: "Inbox"}.get(t["project_id"], "Todoist")
    return ", ".join([sec or proj] + list(t.get("labels") or []))


def place(provider: Provider, it: dict, text: str) -> tuple[dict, Usage]:
    shop = it["list"] == "shopping"
    secs = sorted(set(_sections(SHOPPING if shop else LISTS).values()) - {"Packing"})
    user = "\n".join([f"Item: {it['item']}", f"List: {'shopping' if shop else 'task'}", f"Store words: {it.get('store') or 'none'}",
                      f"Sections: {', '.join(secs + ([] if shop else ['Inbox']))}", "", "Message:", '"""', text, '"""'])
    return provider.json(PLACE_PROMPT, user, PLACE_SCHEMA, PLACE_MODEL, max_tokens=300)


def once_key(*parts) -> str:
    """The key of one create, the same on every retry of the same request (the message's time and the item, a question's
    id, a waiting row's id), hashed: it may hold the item's words, which are not kept a second time in clear."""
    return hashlib.sha256("|".join(str(p) for p in parts).encode()).hexdigest()


def _keep_sent(once: str, task: dict) -> None:
    """On its own connection, committed at once: the row outlives the caller's transaction when that one rolls back."""
    with connect() as c:
        c.execute("""INSERT INTO todo_sent (once, task) VALUES (%s, %s)
                     ON CONFLICT (once) DO UPDATE SET task = EXCLUDED.task, at = now()""", (once, Jsonb(task)))


def _made(cur, once: str) -> Optional[dict]:
    """The task already made for this create, or None. An add whose answer was lost (todoist.TodoistError.unsure) may
    have made it: then the target project's open tasks are read (fresh, not cached) for one with exactly that content
    made within LOST_WINDOW of the add; found, it is taken (and kept), so it is not added a second time."""
    cur.execute("SELECT task FROM todo_sent WHERE once = %s", (once,))
    r = cur.fetchone()
    if not r:
        return None
    t = r["task"]
    if not t.get("unsure"):
        return t
    sent = datetime.fromisoformat(t["sent_at"])
    for x in client().open_tasks(t["project_id"]):
        try:
            added = datetime.fromisoformat(str(x.get("added_at")).replace("Z", "+00:00"))
        except ValueError:
            continue  # no time on it: never taken (an older task of the same name is the owner's own)
        if x["content"] == t["content"] and sent - LOST_WINDOW[0] <= added <= sent + LOST_WINDOW[1]:
            _keep_sent(once, x)
            return x
    return None


def _created(cur, t: dict, batch: str, raw_id, out: dict) -> None:
    """The receipt and the undo row of a task the logger made (now, or on an earlier try of the same request)."""
    _record(cur, batch, raw_id, "created", t["content"], t, _where(t))
    out["receipt"].append(f"Created: {t['content']} ({_where(t)})")


def _create(cur, provider: Provider, it: dict, batch: str, raw_id, text: str, out: dict, once: str) -> None:
    """once: once_key(...) of this request; the caller checked _made first."""
    p, u = place(provider, it, text)
    out["usages"].append(u)
    words = it["item"].split()
    name = (" ".join(w[:1].upper() + w[1:] for w in words) if it["list"] == "shopping"  # like the list: "Bell Peppers"
            else " ".join(words)[:1].upper() + " ".join(words)[1:])                     # a task: "Renew passport"
    if p["generic"]:
        out["notes"].append(f"'{name}' is a group of things, so nothing was added: say which ones")
        return
    shop = it["list"] == "shopping"
    by_name = {v: k for k, v in _sections(SHOPPING if shop else LISTS).items()}
    project = SHOPPING if shop else (INBOX if p["section"] == "Inbox" or p["section"] not in by_name else LISTS)
    section = by_name.get(p["section"]) if project != INBOX else None
    sent_at = datetime.now(timezone.utc)
    try:
        t = client().add(name, project, section, [p["label"]] if p["label"] else [])
    except TodoistError as e:
        if e.unsure:  # it may be there: the next try looks for it before adding (_made)
            _keep_sent(once, {"unsure": True, "content": name, "project_id": project, "sent_at": sent_at.isoformat()})
        raise
    _keep_sent(once, t)
    forget()
    _created(cur, t, batch, raw_id, out)


def _one(cur, provider: Provider, it: dict, batch: str, raw_id, text: str, now: datetime, out: dict, once: str) -> None:
    t = _made(cur, once)
    if t:  # made on an earlier try of this same request, whose save then failed: not added again (core item 33)
        _created(cur, t, batch, raw_id, out)
        return
    name = it["item"].strip()
    if it["list"] == "shopping":  # only the exact name acts on its own; a close one is asked ("meat" is not "Meat seasoning")
        m, exact = _match(name, _open(SHOPPING))
        if exact:
            _record(cur, batch, raw_id, "exists", name, m[0], _where(m[0]))
            out["receipt"].append(f"Already on your list: {_en(m[0]['content'])}")
            return
        done, dexact = _match(name, _cached(("done", SHOPPING), lambda: client().completed_tasks(SHOPPING)))
        if dexact:
            client().reopen(done[0]["id"])
            forget()
            _record(cur, batch, raw_id, "reopened", name, done[0], _where(done[0]))
            out["receipt"].append(f"Unchecked: {_en(done[0]['content'])} ({_where(done[0])})")
            return
        open_ids = {t["id"] for t in m}
        cands = [dict(id=t["id"], content=t["content"], state="open") for t in m] + \
                [dict(id=t["id"], content=t["content"], state="done") for t in done if t["id"] not in open_ids]
        if cands:
            text_q = (f"Which one is '{name}': " + "; ".join(
                f"{i}) {_en(c['content'])} ({'on your list' if c['state'] == 'open' else 'bought before'})"
                for i, c in enumerate(cands[:6], 1)) + "? Or 'new' to add it as a new item.")
            out["ask"].append(dict(kind="todo", text=text_q, item={**it, "text": text}, candidates=cands[:6]))
            return
    _create(cur, provider, it, batch, raw_id, text, out, once)


def apply(cur, provider: Provider, items: list[dict], raw_id: int, now: datetime, text: str) -> dict:
    """The to-dos of one message. -> receipt lines, notes, questions to ask (record._ask stores them), AI usages."""
    out = {"receipt": [], "notes": [], "ask": [], "usages": []}
    for it in items:
        # A message read again later keeps its own time, so this key is the same on every try of the same message.
        once = once_key(now.isoformat(), it["list"], it["item"].lower())
        try:
            _one(cur, provider, it, f"r{raw_id}", raw_id, text, now, out, once)
        except (TodoistError, ProviderError) as e:  # Todoist, or the AI that places a new item, did not answer (core item 32)
            _record(cur, f"r{raw_id}", raw_id, "waiting", it["item"], payload={**it, "text": text, "once": once})
            why = e if isinstance(e, TodoistError) else "The AI service did not answer"
            out["notes"].append(f"{why}: '{it['item']}' waits and is sent again with your next message")
    return out


def answer(cur, provider: Provider, p: dict, reply: str, now: datetime) -> dict:
    """The user's answer to "which one is X?": a number, a name, or 'new'."""
    q, r = p["payload"], reply.strip().lower()
    it, cands, raw_id = q["item"], q["candidates"], q["raw_id"]
    out = {"receipt": [], "notes": [], "ask": [], "usages": []}
    if r in ("skip", "cancel", "no", "none", "nothing"):
        cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'cancelled' WHERE id = %s", (p["id"],))
        return {"outcome": "cancelled"}
    try:
        if r in ("new", "add it", "new item", "add new", "a new one"):
            once = once_key("answer", p["id"])  # answered again after a failed save: the same question, the same task
            t = _made(cur, once)
            if t:
                _created(cur, t, f"r{raw_id}", raw_id, out)
            else:
                _create(cur, provider, it, f"r{raw_id}", raw_id, it.get("text", ""), out, once)
        else:
            m = re.fullmatch(r"\s*(\d+)\s*\)?\s*", r)
            pick = cands[int(m[1]) - 1] if m and 0 < int(m[1]) <= len(cands) else None
            if not pick:
                hits = [c for c in cands if _key(r) and (_key(r) in _key(_en(c["content"])) or _key(_en(c["content"])) in _key(r))]
                pick = hits[0] if len(hits) == 1 else None
            if not pick:
                return {"outcome": "needs_choice", "question": p["reason"]}
            t = {"id": pick["id"], "content": pick["content"]}
            if pick["state"] == "done":
                client().reopen(pick["id"])
                forget()
                _record(cur, f"r{raw_id}", raw_id, "reopened", it["item"], t, None)
                out["receipt"].append(f"Unchecked: {_en(pick['content'])}")
            else:
                _record(cur, f"r{raw_id}", raw_id, "exists", it["item"], t, None)
                out["receipt"].append(f"Already on your list: {_en(pick['content'])}")
    except TodoistError as e:
        return {"outcome": "rejected", "reason": f"{e}; answer again later"}
    except ProviderError:  # the AI that places the new item did not answer: the question stays open
        return {"outcome": "rejected", "reason": "The AI service did not answer; answer again later"}
    cur.execute("UPDATE pending SET resolved_at = now(), resolution = 'confirmed' WHERE id = %s", (p["id"],))
    return {"outcome": "saved", "raw_id": raw_id, "receipt": out["receipt"], "notes": out["notes"], "usages": out["usages"]}


def retry(cur, provider: Provider, now: datetime) -> dict:
    """Items that waited because Todoist was down, sent again (up to 3 days)."""
    out = {"receipt": [], "notes": [], "ask": [], "usages": []}
    cur.execute("""SELECT * FROM todo_actions WHERE op = 'waiting' AND undone_at IS NULL AND at > %s - interval '3 days'
                   ORDER BY id FOR UPDATE SKIP LOCKED""", (now,))
    for a in cur.fetchall():
        try:
            # The key of the message's own try when it has one (its add may have been lost), else this waiting row's.
            once = a["payload"].get("once") or once_key("waiting", a["id"])
            _one(cur, provider, a["payload"], a["batch"], a["raw_id"], a["payload"].get("text", ""), now, out, once)
        except (TodoistError, ProviderError):
            break  # Todoist or the AI still down: they keep waiting, and the message being saved is saved (core item 32)
        cur.execute("UPDATE todo_actions SET undone_at = now(), place = 'sent later' WHERE id = %s", (a["id"],))
    if out["receipt"]:
        out["receipt"] = ["Sent to Todoist now (from an earlier message):"] + out["receipt"]
    return out


def _clean(name: str) -> str:
    """The item without the words around it: "pizza cutter from the list" -> "pizza cutter"."""
    name = re.sub(r"\b(from|off|on|in|to)\s+(the|my)\s+(shopping\s+)?(list|todoist)\b.*$", "", name.strip(), flags=re.I)
    return re.sub(r"\s+in\s+todoist\b.*$", "", name, flags=re.I).strip()


def todo(cur, args: dict, now: datetime, dry: bool = False) -> tuple[list[str], bool]:
    """Changes asked in words, straight away (decided 25.10.); undo takes them back. -> (lines, anything changed).
    done: tick off ("got the milk"). remove: an item the logger added in the last 24 hours is deleted, any other item
    is only ticked off (the user's own items are never deleted). back: put a ticked-off item back on the list."""
    batch, lines, changed = "c" + secrets.token_hex(4), [], False
    tasks = _open(SHOPPING) + _open(LISTS) + _open(INBOX)
    for kind in ("done", "remove", "back"):
        for raw in args.get(kind) or []:
            name = _clean(str(raw))
            pool = tasks if kind != "back" else _cached(("done", SHOPPING), lambda: client().completed_tasks(SHOPPING))
            m, exact = _match(name, pool)
            if not (exact or len(m) == 1):
                where = "on an open list" if kind != "back" else "among the items ticked off in the last 90 days"
                lines.append(f"'{name}': " + ("several fit: " + "; ".join(_en(t["content"]) for t in m[:6]) + ", say which"
                                              if m else f"not found {where}, nothing changed"))
                continue
            t = m[0]
            if kind == "back":
                if not dry:
                    client().reopen(t["id"])
                    _record(cur, batch, None, "reopened", name, t, _where(t))
                lines.append(f"Back on the list: {_en(t['content'])}")
            elif kind == "remove" and _ours(cur, t["id"]):
                if not dry:
                    client().delete(t["id"])
                    cur.execute("UPDATE todo_actions SET undone_at = now() WHERE task_id = %s AND op = 'created'", (t["id"],))
                lines.append(f"Deleted: {_en(t['content'])} (added by the logger)")
            else:
                if not dry:
                    client().close(t["id"])
                    _record(cur, batch, None, "closed", name, t, _where(t))
                lines.append(f"Ticked off: {_en(t['content'])}" + (" (your own item, so it is ticked off, not deleted)"
                                                                     if kind == "remove" else ""))
            changed = True
    if not dry:
        forget()
    return lines, changed


def _ours(cur, task_id: str) -> bool:
    cur.execute("""SELECT 1 FROM todo_actions WHERE task_id = %s AND op = 'created' AND undone_at IS NULL
                   AND at > now() - interval '24 hours'""", (task_id,))
    return cur.fetchone() is not None


def undo(cur, batch: str, dry: bool = False) -> list[str]:
    """Take back one message's or one command's Todoist actions (newest first)."""
    cur.execute("SELECT * FROM todo_actions WHERE batch = %s AND undone_at IS NULL ORDER BY id DESC", (batch,))
    lines = []
    for a in cur.fetchall():
        name = _en(a["content"] or a["item"])
        what = {"created": f"delete {name} from Todoist", "reopened": f"check {name} again",
                "closed": f"put {name} back on the list", "waiting": f"not send {name} to Todoist"}.get(a["op"])
        if not what:
            continue
        if not dry:
            if a["op"] == "created":
                client().delete(a["task_id"])
            elif a["op"] == "reopened":
                client().close(a["task_id"])
            elif a["op"] == "closed":
                client().reopen(a["task_id"])
            cur.execute("UPDATE todo_actions SET undone_at = now() WHERE id = %s", (a["id"],))
        lines.append(what)
    if not dry:
        forget()
    return lines


def find(what: str) -> str:
    """Look-ups: 'shopping' (by section), 'shopping <store or section>', 'tasks' (Lists and Inbox), 'today'."""
    w = (what or "shopping").lower().strip()
    if w in ("today", "due", "overdue", "today and overdue"):
        rows = client().filter_tasks("today | overdue")
        return (f"{len(rows)} due today or overdue:\n" + "\n".join(f"- {_en(t['content'])} ({_where(t)})" for t in rows)) if rows \
            else "Nothing due today or overdue."
    if w.startswith("shopping"):
        rest, groups = w[len("shopping"):].strip(), {}
        secs = _sections(SHOPPING)
        for t in _open(SHOPPING):
            sec = secs.get(t.get("section_id"), "No section")
            if rest and rest not in sec.lower() and not any(rest.replace(" ", "-") in l.lower() or rest in l.lower()
                                                            for l in t.get("labels") or []):
                continue
            groups.setdefault(sec, []).append(_en(t["content"]) + (f" [{', '.join(t['labels'])}]" if t.get("labels") else ""))
        n = sum(len(v) for v in groups.values())
        return (f"Shopping list{' (' + rest + ')' if rest else ''}: {n} open item(s)\n"
                + "\n".join(f"{s}: {', '.join(v)}" for s, v in sorted(groups.items()))) if n else "Nothing open on that list."
    groups = {}
    for proj in (LISTS, INBOX):
        secs = _sections(proj) if proj == LISTS else {}
        for t in _open(proj):
            groups.setdefault(secs.get(t.get("section_id"), "Inbox" if proj == INBOX else "Lists"), []).append(_en(t["content"]))
    n = sum(len(v) for v in groups.values())
    return (f"{n} open task(s):\n" + "\n".join(f"{s}: {', '.join(v)}" for s, v in sorted(groups.items()))) if n else "No open tasks."