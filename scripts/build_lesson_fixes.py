"""Builds supabase/migrations/0014_lesson_fixes.sql: Michael's approved edits to the Week 1-26 lesson texts (October 25).

Starts from the text 0013 imported (scripts/lessons_0013.json). Each update only applies if the lesson
still has that imported text, so anything Michael already edited in the app is left alone.
"""
import json, re, sys, uuid, hashlib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NS = uuid.UUID("6f1c2b8e-1d2a-4f0e-9a51-6c2b7d9e0a13")
lid = lambda kind, n: str(uuid.uuid5(NS, f"lesson:{kind}:{n}"))
q = lambda s: "'" + s.replace("'", "''") + "'"
E21 = sys.argv[1] if len(sys.argv) > 1 else None  # "1", "2" or "3"

lessons = {(l["kind"], l["number"]): l for l in json.loads((ROOT / "scripts/lessons_0013.json").read_text())}
new = {k: dict(l) for k, l in lessons.items()}
missing = []


def sub(kind, n, old, rep, regex=False):
    b = new[(kind, n)]["body"]
    nb = re.sub(old, rep, b, flags=re.M | re.S) if regex else b.replace(old, rep)
    if nb == b:
        missing.append(f"{kind} {n}: {old[:60]!r}")
    new[(kind, n)]["body"] = nb


# A1. Xperiencify check-in links at the end of every Strong Mind Friday.
for (kind, n), l in new.items():
    if kind != "smf":
        continue
    w = l["week"]
    b = re.sub(r"(?m)^Click here to check in[^\n]*\n(\s*\n)*\{Training Magic Link[^}]*\}\n?", "", l["body"])
    if w == 12:
        line = "Once you check in, I'll get back to you and we'll go over your future goals. Your Week 13 Habits & Homework unlocks in the app right away."
    elif w == 26:
        line = "Once you check in, I'll go over your 26-week results with you personally. And if you're continuing with me, your next 26 weeks start right after."
    else:
        line = f"Once you check in, your Week {w + 1} Habits & Homework unlocks in the app."
    b2 = re.sub(r"(?m)^Once you complete your check-in[^\n]*$", line, b)
    if b2 == l["body"] or "Training Magic" in b2:
        missing.append(f"smf {n}: check-in ending")
    l["body"] = b2.strip()
sub("sbw", 41, r"Click here to see a video on what I mean[^\n]*$",
    "Watch the video above to see what I mean, then take the quick quiz below.", regex=True)

# A2. Broken embed code where extra videos used to sit.
sub("sbw", 2, '"}" data-trix-content-type="undefined" class="attachment attachment--content">\n\n', "")
sub("sbw", 3, " Here's a quick video on this:\n\n\"}\" data-trix-content-type=\"undefined\" class=\"attachment attachment--content\">\n\n", "\n\n")

# A3 + C11. Old XP questions, and "next week" that is now a few weeks away.
sub("sbw", 2, "That’s what we’re going to cover in next week's Strong Body Wednesday, answer the questions below and I'll talk to you soon!",
    "That’s what we’re going to cover in a few weeks. For now, take the quick quiz below and I'll talk to you soon!")
sub("sbw", 3, "Now go answer the questions below and show me you're becoming a nutrition expert =)",
    "Now take the quick quiz below and show me you're becoming a nutrition expert =)")

# B4. The line that was an image.
sub("sbw", 2, "The most important thing to know about losing weight is:\n\nAgain, that's...\n\n",
    "The most important thing to know about losing weight is:\n\nCalories in versus calories out.\n\nAgain, that's...\n\nCalories in versus calories out.\n\n")

# B5. The supplement list the text promised.
sub("sbw", 8, "6 of them are for overall health\n\n3 of them for performance",
    "6 of them are for overall health\n\n3 of them for performance\n\n"
    "In the video I go through all 9. Here are the essentials I want you to start with, one new one each week (from Week 7):\n\n"
    "- Magnesium glycinate: deep sleep, mood, muscle repair (300 mg, 2–3 hours before bed)\n"
    "- Vitamin D: hormones, immunity, mood\n"
    "- Creatine monohydrate: strength, brain and memory (5 g daily)\n"
    "- Omega-3 (fish or krill oil): inflammation, mood, joint aches (2–5 g daily)\n"
    "- Protein powder: makes hitting your protein easy\n"
    "- Chlorophyll: red blood cells, liver support\n"
    "- Chromium picolinate: steadier blood sugar, fewer cravings\n"
    "- Boron: boosts the effect of chromium\n\n"
    "Check with your doctor first if you take medication, are pregnant, or have a medical condition.\n\n"
    "And remember: supplements supplement what's already very good. Calories, protein, sleep and water come first.")

# B6. A closing line for "How long does it take to get lean?"
sub("sbw", 12, "But asking yourself \"how long will it take to lose the weight?\" doesn't really make sense",
    "But asking yourself \"how long will it take to lose the weight?\" doesn't really make sense\n\n"
    "Because the real answer is: it takes as long as it takes\n\n"
    "Your body doesn't care about a deadline. It cares about what you do every single day\n\n"
    "So stop asking \"how long?\"\n\n"
    "And start asking \"did I do my habits today?\"\n\n"
    "Keep logging. Keep checking in. Keep showing up\n\n"
    "And only compare yourself to who you were 26 weeks ago. That's the only race you're in\n\n"
    "Michael")

# C7. No meal plan up front anymore.
sub("sbw", 2, "1.) The right amount of calories for your goals - your calorie level will be shown in your training app once you complete this meal plan\n\n2.) Enough protein - your protein requirements will also be shown in your training app",
    "1.) The right amount of calories for your goals - I'll set your calorie target from your first 14 days of food logs\n\n2.) Enough protein - 40 g+ at every meal (your protein target is in your app)")
sub("sbw", 3, "Lucky for you, these are the foods I primarily used for your meal plan.", "Lucky for you, these are the foods we'll build your favorite meals around.")
sub("smf", 7, "But as you've seen in the meal plan I've given you, the only 2 foods you should really cut are processed foods and excess sugars.",
    "But as you'll see in this program, the only 2 things you should really cut are processed foods and excess sugars.")
sub("smf", 7, "Sticking to the 55 best foods from your meal plan", "Sticking to real food and your favorite meals")
sub("smf", 20, "You can have the greatest meal plan (like, the one you got from me)\n\nBut if you don't read & eat it, you'll get chubby",
    "You can have the greatest plan (like, the one you're getting from me)\n\nBut if you don't actually follow it, you'll get chubby")
sub("smf", 25, "The #1 reason you're not following your meal plan is because your desire is too weak",
    "The #1 reason you're not sticking to your plan is because your desire is too weak")
sub("smf", 25, "This is when you will no longer 'not follow' your meal plan.", "This is when sticking to your plan stops being a struggle.")

# C8, C9. Fasting and the caffeine limit.
sub("sbw", 43, "(or put cinnamon in it if you're fasting - and protein powder if you're in your eating window)", "(or put cinnamon or protein powder in it)")
sub("sbw", 43, "--- Max out your total caffeine intake to 300-400 mg per day", "--- Max out your total caffeine intake at 300 mg per day")

# C10. Protein: 40 g+ every meal, 120 g a day minimum.
sub("sbw", 3, "So if you're currently 180, but want to weigh 140 - then eat 140 grams of protein... every day",
    "So if you're currently 180, but want to weigh 140 - then eat 140 grams of protein... every day (and never less than 120 grams)")
sub("sbw", 3, "So have your first meal be 30-40 grams of protein right away",
    "So have every meal be 40+ grams of protein, starting with breakfast within 60 minutes of waking")

# C12. Jump rope frequency.
sub("sbw", 46, "You become good in just 2-3x week", "You get good at it doing it just once or twice a week")

# C14, C15. Titles.
new[("sbw", 14)]["title"] = "Why you need to fix your metabolism"
new[("sbw", 13)]["title"] = "When you're doing everything right, but the scale isn't moving"

# D16-D19. Health claims.
sub("sbw", 6, "But building muscle and burning fat ONLY happens when you're asleep", "But most of your muscle building and recovery happens while you're asleep")
sub("smf", 8, "Remember, only 2 things will ever give you a stomach ulcer:\n\n1. Worry\n\n2. Negative attitudes\n\nPrevent ulcers (and other ailments) by practicing your positive mental attitude, every day.",
    "Remember, worry and negativity take a real toll on your health.\n\nProtect your health by practicing your positive mental attitude, every day.")
sub("sbw", 3, "Provides iodine which optimizes thyroid, metabolism, immune system, and digestion. Iodine also flushes out toxins from your thyroid (which might cause nausea at first)",
    "Provides antioxidants and vitamin C, and supports urinary tract health")
sub("sbw", 3, " Furthermore, oranges provide Naringin, an enzyme that extends free testosterone", "")
sub("sbw", 50, "This is often also where people will get back on their prescription meds (and live a downward spiraling life)\n\n", "")

# E20. Water: keep the urgency, cut the shaming.
sub("sbw", 1, r"But honestly, from what I'm seeing, NOBODY IN AMERICA.*?Everybody's fat\n\n",
    "But honestly, from what I'm seeing, almost NOBODY drinks enough water\n\n"
    "If you don't drink enough water, nothing will work\n\n"
    "You will NEVER lose weight if you don't drink enough water\n\n"
    "Your hunger goes up, your energy goes down, your skin and digestion suffer, and your cravings win\n\n"
    "I know this sounds intense\n\n"
    "But it's that important\n\n"
    "Everyone plays it off like it's nothing, and I'm the crazy one\n\n", regex=True)
new[("sbw", 1)]["body"] = new[("sbw", 1)]["body"].replace("\\'", "'")

# E21. Political lines (Michael picks the option).
E21_OPTIONS = {
    "1": ("They run from anything hard, scroll the news, and let fear tell them to 'play it safe'",
          "Until you end up with no spine, accepting whatever everyone else says is 'normal'",
          "Like the saying goes: \"facts don't care about your feelings\""),
    "2": ("They hit snooze on their own life, scroll their phone, and let other people's fear decide how big they're allowed to dream",
          "Until you end up settling for a life that's just 'fine'",
          "Like I tell my clients: your feelings are real, but they're not always facts"),
    "3": ("They run from anything hard and let fear make every decision for them",
          "Until you end up with no fire left, just going through the motions",
          "Feelings are information, not instructions"),
}
if E21:
    a, b, c = E21_OPTIONS[E21]
    sub("smf", 15, "They run, watch the news, and plug their umbilical cord into some grey-haired authority-type figure that tells them to 'stay safe' and live in fear", a)
    sub("smf", 15, "Until you end up with no spine and accept whatever the government recommends", b)
    sub("smf", 17, "Like Ben Shapiro says - \"facts don't care about your feelings\"", c)

# E23-E25.
sub("sbw", 15, "If you're in need of a little push, or just want some distraction in these crazy times, check out this video.", "If you're in need of a little push, check out this video.")
sub("sbw", 37, "- what to do if your wife says \"let's go to IHOP!\"", "- what to do if your family says \"let's go to IHOP!\"")
sub("sbw", 32, "Swap them out for foods on this list and see how you do with them.",
    "Swap them out for foods on this list and see how you do with them.\n\nAnd to be clear: this list is about what's easy on your stomach, not a green light for sugar. Real food still comes first.")

# F26. Typos.
sub("smf", 2, "nobody is every doomed", "nobody is ever doomed")
sub("smf", 3, "fall of the wagon", "fall off the wagon")
sub("smf", 18, "(and now the life that others expected of them)", "(and not the life that others expected of them)")
sub("smf", 19, "3 'types' pf environment", "3 'types' of environment")
sub("smf", 20, "when the cat is moving", "when the car is moving")

sub("sbw", 1, "means your feeding your body", "means you're feeding your body")
for l in new.values():
    l["body"] = re.sub(r"\n{3,}", "\n\n", l["body"]).strip()

if missing:
    print("NOT FOUND:\n  " + "\n  ".join(missing))
    sys.exit(1)

md5 = lambda s: hashlib.md5((s or "").encode()).hexdigest()
out = ["-- Michael's approved fixes to the Week 1-26 lesson texts (October 25). Generated by scripts/build_lesson_fixes.py.",
       "-- Each update only applies while the lesson still has its imported text, so your own edits in the app are kept.", ""]
changed = 0
for k, l in sorted(new.items()):
    o = lessons[k]
    if l["body"] == o["body"] and l["title"] == o["title"]:
        continue
    changed += 1
    out.append(f"update public.lessons set title = {q(l['title'])}, body = {q(l['body'])} where id = {q(lid(*k))} and md5(coalesce(body, '')) = '{md5(o['body'])}';")
(ROOT / "supabase/migrations/0014_lesson_fixes.sql").write_text("\n".join(out) + "\n")
(ROOT / "scripts/lessons_0014.json").write_text(json.dumps(list(new.values()), ensure_ascii=False, indent=1))
print(changed, "lessons changed" + ("" if E21 else " (E21 not applied yet)"))
