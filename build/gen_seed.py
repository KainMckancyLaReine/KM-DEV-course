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

ADMIN_EMAILS = ["kain@km.dev"]


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


def build():
    course = read("course.json")
    c = course["course"]
    course_id = uid("course", c["slug"])

    levels, lessons, projects, quizzes, questions, answers = [], [], [], [], [], []

    # ---------------------------------------------------------------- levels
    for li, lv in enumerate(course["levels"], start=1):
        level_id = uid("level", lv["slug"])
        levels.append({
            "id": level_id, "course_id": course_id, "slug": lv["slug"],
            "title": lv["title"], "description": lv["description"],
            "position": li, "published": True,
        })

        if "lessons_file" in lv:
            for pi, les in enumerate(read(lv["lessons_file"])["lessons"], start=1):
                lessons.append({
                    "id": uid("lesson", les["slug"]), "level_id": level_id,
                    "slug": les["slug"], "title": les["title"],
                    "description": les.get("description", ""),
                    "content": les["content"], "position": pi, "published": True,
                    "estimated_minutes": les.get("minutes", 10),
                    "video_url": les.get("video_url"),
                    "video_duration": les.get("video_duration"),
                })
        else:
            for pi, (slug, title, minutes) in enumerate(lv["lessons"], start=1):
                lessons.append({
                    "id": uid("lesson", slug), "level_id": level_id,
                    "slug": slug, "title": title, "description": "",
                    "content": [], "position": pi, "published": False,
                    "estimated_minutes": minutes,
                    "video_url": None, "video_duration": None,
                })

    # -------------------------------------------------------------- projects
    for pi, pr in enumerate(course["projects"], start=1):
        projects.append({
            "id": uid("project", pr["slug"]),
            "level_id": uid("level", pr["level"]),
            "slug": pr["slug"], "title": pr["title"],
            "description": pr["description"], "brief": pr["brief"],
            "is_final": bool(pr.get("final")), "position": pi, "published": True,
        })

    # ----------------------------------------------------------- assessments
    for ai, az in enumerate(course["assessments"], start=1):
        quiz_id = uid("quiz", az["slug"])
        published = not az.get("draft") and len(az["questions"]) > 0
        quizzes.append({
            "id": quiz_id, "level_id": uid("level", az["level"]), "lesson_id": None,
            "slug": az["slug"], "title": az["title"], "subtitle": az.get("subtitle", ""),
            "passing_score": az.get("passing_score", 70),
            "published": published, "position": ai,
        })
        for qi, qq in enumerate(az["questions"], start=1):
            qid = uid("question", "%s/%d" % (az["slug"], qi))
            questions.append({
                "id": qid, "quiz_id": quiz_id, "question": qq["question"],
                "type": qq["type"], "explanation": qq.get("why", ""),
                "points": qq.get("points", 1), "position": qi,
            })
            for oi, opt in enumerate(qq["options"]):
                answers.append({
                    "id": uid("answer", "%s/%d/%d" % (az["slug"], qi, oi)),
                    "question_id": qid, "answer": opt,
                    "is_correct": oi in qq["correct"], "position": oi + 1,
                })

    # --------------------------------------------------------------- prompts
    prompts = []
    for pi, pr in enumerate(course["prompts"], start=1):
        prompts.append({
            "id": uid("prompt", pr["slug"]), "slug": pr["slug"],
            "category": pr["category"], "title": pr["title"],
            "purpose": pr.get("purpose", ""), "body": pr["body"],
            "explanation": pr.get("explanation", {}), "position": pi,
        })

    return {
        "course": dict(c, id=course_id),
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
    p.append("insert into public.courses (id, slug, title, description, published) values")
    p.append("  (%s, %s, %s, %s, %s)" % (q(c["id"]), q(c["slug"]), q(c["title"]),
                                         q(c["description"]), q(c["published"])))
    p.append("on conflict (id) do update set title = excluded.title, "
             "description = excluded.description, published = excluded.published;\n")

    p.append(insert("levels", d["levels"],
                    ["id", "course_id", "slug", "title", "description", "position", "published"]))
    p.append(insert("lessons", d["lessons"],
                    ["id", "level_id", "slug", "title", "description", "content",
                     "position", "published", "estimated_minutes", "video_url", "video_duration"]))
    p.append(insert("projects", d["projects"],
                    ["id", "level_id", "slug", "title", "description", "brief",
                     "is_final", "position", "published"]))
    p.append(insert("prompts", d["prompts"],
                    ["id", "slug", "category", "title", "purpose", "body", "explanation", "position"]))
    p.append(insert("quizzes", d["quizzes"],
                    ["id", "level_id", "lesson_id", "slug", "title", "subtitle",
                     "passing_score", "published", "position"]))
    p.append(insert("quiz_questions", d["questions"],
                    ["id", "quiz_id", "question", "type", "explanation", "points", "position"]))
    p.append(insert("quiz_answers", d["answers"],
                    ["id", "question_id", "answer", "is_correct", "position"]))

    p.append("commit;")
    return "\n".join(p) + "\n"


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
    io.open(sql, "w", encoding="utf-8").write(to_sql(d))
    io.open(js, "w", encoding="utf-8").write(to_js(d))

    pub = sum(1 for l in d["lessons"] if l["published"])
    print("seed · %d levels, %d lessons (%d published), %d projects, "
          "%d quizzes, %d questions, %d prompts"
          % (len(d["levels"]), len(d["lessons"]), pub, len(d["projects"]),
             len(d["quizzes"]), len(d["questions"]), len(d["prompts"])))
    for path in (sql, js):
        print("  →", os.path.relpath(path, ROOT),
              "%.1f KB" % (os.path.getsize(path) / 1024))


if __name__ == "__main__":
    main()
