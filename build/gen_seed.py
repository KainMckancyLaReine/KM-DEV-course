#!/usr/bin/env python3
"""
KM.dev Academy — seed generator

content/*.json is the single source of truth for the course. This script emits
both targets from it, so the content never has to be maintained twice:

  db/seed.sql            → run in Supabase after schema.sql
  assets/js/seed-data.js → the same course for the browser preview store

Ids are derived from slugs (uuid5), so the same lesson has the same id in both
places and progress recorded in preview lines up if you later import it.
"""

import io, json, os, uuid

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
NS = uuid.UUID("6f9619ff-8b86-d011-b42d-00c04fc964ff")

ADMIN_EMAILS = ["kain@km.dev", "kkain25@gmail.com"]


def uid(kind, key):
    return str(uuid.uuid5(NS, "km.dev/%s/%s" % (kind, key)))


def q(v):
    """Quote a value for SQL."""
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, (int, float)):
        return str(v)
    if isinstance(v, (dict, list)):
        return "'" + json.dumps(v, ensure_ascii=False).replace("'", "''") + "'::jsonb"
    return "'" + str(v).replace("'", "''") + "'"


def read(name):
    return json.load(io.open(os.path.join(ROOT, "content", name), encoding="utf-8"))


def read_nl(name):
    """The Dutch twin of a content file. Missing means untranslated, not broken."""
    path = os.path.join(ROOT, "content", "nl", name)
    if not os.path.exists(path):
        return {}
    return json.load(io.open(path, encoding="utf-8"))


def build():
    course = read("course.json")
    nl = read_nl("course.json")
    nl_levels = nl.get("levels", {})
    nl_projects = nl.get("projects", {})
    nl_quizzes = nl.get("assessments", {})
    nl_prompts = nl.get("prompts", {})
    c = course["course"]
    course_id = uid("course", c["slug"])

    levels, lessons, projects, quizzes, questions, answers = [], [], [], [], [], []

    # ---------------------------------------------------------------- levels
    for li, lv in enumerate(course["levels"], start=1):
        level_id = uid("level", lv["slug"])
        tl = nl_levels.get(lv["slug"], {})
        levels.append({
            "id": level_id, "course_id": course_id, "slug": lv["slug"],
            "title": lv["title"], "description": lv["description"],
            "title_nl": tl.get("title", ""), "description_nl": tl.get("description", ""),
            "position": li, "published": True,
        })

        if "lessons_file" in lv:
            tles = read_nl(lv["lessons_file"]).get("lessons", {})
            for pi, les in enumerate(read(lv["lessons_file"])["lessons"], start=1):
                t = tles.get(les["slug"], {})
                lessons.append({
                    "id": uid("lesson", les["slug"]), "level_id": level_id,
                    "slug": les["slug"], "title": les["title"],
                    "description": les.get("description", ""),
                    "content": les["content"], "position": pi, "published": True,
                    "title_nl": t.get("title", ""),
                    "description_nl": t.get("description", ""),
                    "content_nl": t.get("content", []),
                    "estimated_minutes": les.get("minutes", 10),
                    "video_url": les.get("video_url"),
                    "video_duration": les.get("video_duration"),
                })
        else:
            tles = tl.get("lessons", {})
            for pi, (slug, title, minutes) in enumerate(lv["lessons"], start=1):
                lessons.append({
                    "id": uid("lesson", slug), "level_id": level_id,
                    "slug": slug, "title": title, "description": "",
                    "content": [], "position": pi, "published": False,
                    "title_nl": tles.get(slug, ""), "description_nl": "",
                    "content_nl": [],
                    "estimated_minutes": minutes,
                    "video_url": None, "video_duration": None,
                })

    # -------------------------------------------------------------- projects
    for pi, pr in enumerate(course["projects"], start=1):
        t = nl_projects.get(pr["slug"], {})
        projects.append({
            "id": uid("project", pr["slug"]),
            "level_id": uid("level", pr["level"]),
            "slug": pr["slug"], "title": pr["title"],
            "description": pr["description"], "brief": pr["brief"],
            "title_nl": t.get("title", ""), "description_nl": t.get("description", ""),
            "brief_nl": t.get("brief", {}),
            "is_final": bool(pr.get("final")), "position": pi, "published": True,
        })

    # ----------------------------------------------------------- assessments
    for ai, az in enumerate(course["assessments"], start=1):
        quiz_id = uid("quiz", az["slug"])
        published = not az.get("draft") and len(az["questions"]) > 0
        t = nl_quizzes.get(az["slug"], {})
        tq = t.get("questions", [])
        quizzes.append({
            "id": quiz_id, "level_id": uid("level", az["level"]), "lesson_id": None,
            "slug": az["slug"], "title": az["title"], "subtitle": az.get("subtitle", ""),
            "title_nl": t.get("title", ""), "subtitle_nl": t.get("subtitle", ""),
            "passing_score": az.get("passing_score", 70),
            "published": published, "position": ai,
        })
        for qi, qq in enumerate(az["questions"], start=1):
            qid = uid("question", "%s/%d" % (az["slug"], qi))
            tqq = tq[qi - 1] if qi - 1 < len(tq) else {}
            questions.append({
                "id": qid, "quiz_id": quiz_id, "question": qq["question"],
                "type": qq["type"], "explanation": qq.get("why", ""),
                "question_nl": tqq.get("question", ""),
                "explanation_nl": tqq.get("why", ""),
                "points": qq.get("points", 1), "position": qi,
            })
            topts = tqq.get("options", [])
            for oi, opt in enumerate(qq["options"]):
                answers.append({
                    "id": uid("answer", "%s/%d/%d" % (az["slug"], qi, oi)),
                    "question_id": qid, "answer": opt,
                    "answer_nl": topts[oi] if oi < len(topts) else "",
                    "is_correct": oi in qq["correct"], "position": oi + 1,
                })

    # --------------------------------------------------------------- prompts
    prompts = []
    for pi, pr in enumerate(course["prompts"], start=1):
        t = nl_prompts.get(pr["slug"], {})
        prompts.append({
            "id": uid("prompt", pr["slug"]), "slug": pr["slug"],
            "category": pr["category"], "title": pr["title"],
            "purpose": pr.get("purpose", ""), "body": pr["body"],
            "explanation": pr.get("explanation", {}),
            "title_nl": t.get("title", ""), "purpose_nl": t.get("purpose", ""),
            "body_nl": t.get("body", ""), "explanation_nl": t.get("explanation", {}),
            "position": pi,
        })

    tc = nl.get("course", {})
    return {
        "course": dict(c, id=course_id,
                       title_nl=tc.get("title", ""),
                       description_nl=tc.get("description", "")),
        "levels": levels, "lessons": lessons, "projects": projects,
        "quizzes": quizzes, "questions": questions, "answers": answers,
        "prompts": prompts,
    }


def insert(table, rows, cols):
    if not rows:
        return "-- %s: nothing to insert\n" % table
    out = ["insert into public.%s (%s) values" % (table, ", ".join(cols))]
    body = []
    for r in rows:
        body.append("  (" + ", ".join(q(r.get(c)) for c in cols) + ")")
    out.append(",\n".join(body))
    out.append("on conflict (id) do update set " +
               ", ".join("%s = excluded.%s" % (c, c) for c in cols if c != "id") + ";\n")
    return "\n".join(out)


def to_sql(d):
    p = []
    p.append("-- Generated by build/gen_seed.py — do not edit by hand.")
    p.append("-- Source of truth: content/*.json\n")
    p.append("begin;\n")

    p.append("insert into public.admin_bootstrap (email) values")
    p.append(",\n".join("  (%s)" % q(e) for e in ADMIN_EMAILS))
    p.append("on conflict (email) do nothing;\n")

    c = d["course"]
    p.append("insert into public.courses "
             "(id, slug, title, description, title_nl, description_nl, published) values")
    p.append("  (%s, %s, %s, %s, %s, %s, %s)"
             % (q(c["id"]), q(c["slug"]), q(c["title"]), q(c["description"]),
                q(c["title_nl"]), q(c["description_nl"]), q(c["published"])))
    p.append("on conflict (id) do update set title = excluded.title, "
             "description = excluded.description, title_nl = excluded.title_nl, "
             "description_nl = excluded.description_nl, published = excluded.published;\n")

    p.append(insert("levels", d["levels"],
                    ["id", "course_id", "slug", "title", "description",
                     "title_nl", "description_nl", "position", "published"]))
    p.append(insert("lessons", d["lessons"],
                    ["id", "level_id", "slug", "title", "description", "content",
                     "title_nl", "description_nl", "content_nl",
                     "position", "published", "estimated_minutes", "video_url", "video_duration"]))
    p.append(insert("projects", d["projects"],
                    ["id", "level_id", "slug", "title", "description", "brief",
                     "title_nl", "description_nl", "brief_nl",
                     "is_final", "position", "published"]))
    p.append(insert("prompts", d["prompts"],
                    ["id", "slug", "category", "title", "purpose", "body", "explanation",
                     "title_nl", "purpose_nl", "body_nl", "explanation_nl", "position"]))
    p.append(insert("quizzes", d["quizzes"],
                    ["id", "level_id", "lesson_id", "slug", "title", "subtitle",
                     "title_nl", "subtitle_nl", "passing_score", "published", "position"]))
    p.append(insert("quiz_questions", d["questions"],
                    ["id", "quiz_id", "question", "type", "explanation",
                     "question_nl", "explanation_nl", "points", "position"]))
    p.append(insert("quiz_answers", d["answers"],
                    ["id", "question_id", "answer", "answer_nl", "is_correct", "position"]))

    p.append("commit;")
    return "\n".join(p) + "\n"


def to_outline(d):
    """The pricing page needs the programme's shape, not the programme.

    Live, that comes from course_outline() on the server. Preview mode has no
    server, and loading the whole 220 KB seed onto a public marketing page to
    count eight levels would be an odd thing to do to a first-time visitor —
    so the same shape is emitted here as a few kilobytes of its own."""
    by_level = {}
    for l in d["lessons"]:
        by_level.setdefault(l["level_id"], []).append(l)

    def lv_rows(level_id):
        return sorted(by_level.get(level_id, []), key=lambda l: l["position"])

    levels = []
    for lv in sorted(d["levels"], key=lambda x: x["position"]):
        rows = lv_rows(lv["id"])
        levels.append({
            "position": lv["position"], "slug": lv["slug"],
            "title": lv["title"], "title_nl": lv["title_nl"],
            "description": lv["description"], "description_nl": lv["description_nl"],
            "lessons": len(rows),
            "published": sum(1 for l in rows if l["published"]),
            "minutes": sum(l["estimated_minutes"] for l in rows),
            "projects": sum(1 for p in d["projects"] if p["level_id"] == lv["id"]),
            "assessments": sum(1 for q in d["quizzes"] if q["level_id"] == lv["id"]),
            "lesson_titles": [{
                "title": l["title"], "title_nl": l["title_nl"],
                "minutes": l["estimated_minutes"], "published": l["published"],
            } for l in rows],
        })

    payload = {
        "found": True,
        "course": {k: d["course"][k] for k in
                   ("slug", "title", "title_nl", "description", "description_nl")},
        "totals": {
            "levels": len(d["levels"]),
            "lessons": len(d["lessons"]),
            "published": sum(1 for l in d["lessons"] if l["published"]),
            "minutes": sum(l["estimated_minutes"] for l in d["lessons"]),
            "projects": len(d["projects"]),
            "assessments": len(d["quizzes"]),
            "questions": len(d["questions"]),
            "prompts": len(d["prompts"]),
        },
        "levels": levels,
    }
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return ("/* Generated by build/gen_seed.py — do not edit by hand.\n"
            "   The programme's shape, for the public pricing page. */\n"
            "window.KM_OUTLINE = " + blob + ";\n")


def to_js(d):
    # The browser copy powers preview mode only. It is not a security surface:
    # preview mode stores everything in this browser and says so on screen.
    payload = {
        "course": d["course"],
        "levels": d["levels"],
        "lessons": d["lessons"],
        "projects": d["projects"],
        "prompts": d["prompts"],
        "quizzes": d["quizzes"],
        "questions": d["questions"],
        "answers": d["answers"],
    }
    # Lesson code samples contain </script>. Escaping every "<" keeps the file
    # safe to inline into an HTML document as well as to load as a script.
    blob = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    return ("/* Generated by build/gen_seed.py — do not edit by hand.\n"
            "   Source of truth: content/*.json */\n"
            "window.KM_SEED = " + blob + ";\n")


def main():
    d = build()
    sql = os.path.join(ROOT, "db", "seed.sql")
    js = os.path.join(ROOT, "assets", "js", "seed-data.js")
    outline = os.path.join(ROOT, "assets", "js", "km-outline.js")
    io.open(sql, "w", encoding="utf-8").write(to_sql(d))
    io.open(js, "w", encoding="utf-8").write(to_js(d))
    io.open(outline, "w", encoding="utf-8").write(to_outline(d))

    pub = sum(1 for l in d["lessons"] if l["published"])
    print("seed · %d levels, %d lessons (%d published), %d projects, "
          "%d quizzes, %d questions, %d prompts"
          % (len(d["levels"]), len(d["lessons"]), pub, len(d["projects"]),
             len(d["quizzes"]), len(d["questions"]), len(d["prompts"])))
    for path in (sql, js, outline):
        print("  →", os.path.relpath(path, ROOT),
              "%.1f KB" % (os.path.getsize(path) / 1024))


if __name__ == "__main__":
    main()
