"""Builds the approved-quiz migrations (0015: weeks 1-4, 0016: weeks 5-8). Correct answer marked with *."""
import json, uuid
from pathlib import Path

NS = uuid.UUID("6f1c2b8e-1d2a-4f0e-9a51-6c2b7d9e0a13")
lid = lambda kind, n: str(uuid.uuid5(NS, f"lesson:{kind}:{n}"))
q = lambda s: "'" + s.replace("'", "''") + "'"

QUIZZES = {
    ("hh", 1): [("How soon after waking should you get outside light?", ["*Within 30 minutes", "Within 3 hours", "Does the glow of my phone count?"]),
                ("What's your food job this week?", ["Cut out carbs", "*Eat whatever you want, but log every meal and drink", "Stay under 1,200 calories"])],
    ("sbw", 2): [("What decides whether you lose weight?", ["Cutting carbs", "Doing more cardio", "*Calories in versus calories out"]),
                 ("What happens if your calorie deficit is too big?", ["You lose fat faster with no downside", "*Your body goes into survival mode, and hunger and cravings get out of control", "Nothing changes"])],
    ("smf", 1): [("What is \"definiteness of purpose\"?", ["*Knowing exactly what you want, and why you want it", "Following a strict diet", "Working out every day"]),
                 ("How often should you read your written goal summary out loud?", ["Once a month", "Only when you feel motivated", "*Twice a day, morning and afternoon"])],
    ("hh", 2): [("You wake up at 3 AM. What do you do?", ["Check your phone", "*Use the Blinking Method", "Make a 3 AM snack and watch reruns"]),
                ("When do you do your NSDR (the No-Nap Nap)?", ["Right before bed", "*Around 2:30 PM, for 10–20 minutes", "Whenever, for an hour"])],
    ("sbw", 6): [("A client is doing everything right but not losing weight. What's usually missing?", ["*Sleep", "More cardio", "Fewer meals"]),
                 ("Why does sleep matter for getting lean?", ["Sleep is optional once you have kids, right?", "It doesn't, as long as you eat well", "*Most of your muscle building and recovery happens while you're asleep"])],
    ("smf", 2): [("In the submarine story, who's looking through the periscope?", ["Your coach", "*You, your conscious thinking", "A dolphin with strong opinions"]),
                 ("What does your subconscious mind act on?", ["*Whatever thoughts you feed it, positive or negative", "Only positive thoughts", "Nothing you can control"])],
    ("hh", 3): [("How does Michael set your maintenance calories?", ["From an online calculator", "*From 14 days of your food logs", "From your weight alone"]),
                ("How much water are you aiming for each day?", ["Coffee counts as water, right?", "Only when you're thirsty", "*About a gallon"])],
    ("sbw", 1): [("How does water help you lose weight?", ["*It reduces hunger and cravings, so you stick to your calories", "It burns fat directly", "It replaces a meal"]),
                 ("What does a caloric deficit mean?", ["Eating more than your body needs", "Skipping breakfast", "*Eating less than your body needs, which brings hunger and cravings"])],
    ("smf", 3): [("The scale doesn't move one week. What's the right move?", ["Quit and try again next year", "*Respond, don't react: adjust your plan and keep going", "Cut your calories in half"]),
                 ("\"Every failure brings with it…\"", ["*the seed of an equivalent success", "a reason to stop", "a good excuse for the whole pint of ice cream"])],
    ("hh", 4): [("Your bedtime is 10 PM. When should you have your last caffeine?", ["6 PM", "8 PM", "*Noon"]),
                ("In 10-3-2-1-0, what does the \"1\" mean?", ["*1 hour before bed: no screens", "1 glass of wine is fine", "1 snooze is allowed"])],
    ("sbw", 43): [("When should you have your first caffeine of the day?", ["Right when you wake up", "*At least 90 minutes after waking", "Late afternoon"]),
                  ("What's your daily caffeine limit?", ["Whatever it takes to see sounds", "600 mg", "*300 mg"])],
    ("smf", 4): [("What does going the extra mile mean?", ["*Doing more than what's asked, all the time, with a pleasant attitude", "Taking the long way to the drive-thru", "Doing extra only when someone's watching"]),
                 ("Why does it pay off?", ["It works in a couple of days", "*The returns compound over months and years", "It doesn't matter much"])],
}


QUIZZES_5_8 = {
    ("hh", 5): [("Why eat your protein first at every meal?", ["It burns more calories", "*It blunts the blood sugar spike and keeps you fuller", "So the broccoli knows who's boss"]),
                ("When do you take your 10-minute walk this week?", ["*After every meal", "Only on weekends", "Right before bed"])],
    ("sbw", 3): [("How much protein should you eat each day?", ["1 gram per pound of what you weigh now", "*1 gram per pound of the weight you want to be (at least 120 g)", "As little as possible"]),
                 ("Why does protein matter so much when you're in a calorie deficit?", ["*It kills cravings and keeps your weight loss coming from fat, not muscle", "It has fewer calories than vegetables", "Mostly because steak is delicious"])],
    ("smf", 5): [("What does living in fear and doubt mean?", ["*Dwelling on the things you don't want in your life", "Being careful with your money", "Watching scary movies before bed"]),
                 ("What's one way to strengthen your faith?", ["Wait until you get what you want, then say thanks", "*Express gratitude every day for what you want, even before you have it", "Keep your goals a secret"])],
    ("hh", 6): [("What does logging like a pro mean?", ["Logging just the main food", "*Logging ingredient by ingredient, including oil, sauces and little bites", "Logging only on good days"]),
                ("Which of these is a \"tiny calorie\" you still log?", ["*The tablespoon of oil you cooked with", "A glass of water", "Black coffee"])],
    ("sbw", 17): [("What has to come first, before cardio, carb cycling or fish oil?", ["A new pair of leggings", "*Getting your calories right", "Fasting"]),
                  ("Why do so many people get frustrated with their results?", ["*They focus on the wrong things instead of calories first", "They drink too much water", "They sleep too much"])],
    ("smf", 6): [("How should you start each day?", ["*By expressing gratitude, for your successes and your failures", "By checking the news", "By scrolling until your eyes open"]),
                 ("Something unpleasant is going on in your life. What do you do?", ["Wait for it to go away", "Complain about it", "*Take action on it right away"])],
    ("hh", 7): [("How big should your calorie deficit be?", ["As big as you can handle", "*15–20% below your maintenance calories (never under 1,200)", "Half of your maintenance calories"]),
                ("What is a diet break?", ["*1 week at maintenance after every 8–12 weeks in a deficit", "A week off from logging", "A cheat weekend with a different cake each day"])],
    ("sbw", 14): [("What's the one reason your weight goes up and down?", ["*Calories in versus calories out", "Hundreds of reasons, it's a mystery", "The phases of the moon"]),
                  ("What protects your metabolism while you lose weight?", ["*A deficit that isn't too big, plus diet breaks at maintenance", "Cutting calories as low as possible", "Skipping meals"])],
    ("smf", 7): [("What is discipline?", ["*Choosing what you want most over what you want now", "Never eating anything you enjoy", "Waking up at 4 AM every day"]),
                 ("Which 2 things should you really cut?", ["All carbs and fats", "*Processed foods and excess sugars", "Anything beige"])],
    ("hh", 8): [("It's a diet break week. What do you do?", ["Stop logging for a week", "*Eat at maintenance, keep logging, and keep 40 g+ protein per meal", "Eat as little as possible to catch up"]),
                ("What's the best bedroom temperature for sleep?", ["72–75°F", "*65–68°F", "Whatever your partner wants it to be"])],
    ("sbw", 8): [("How much difference do supplements make to your weight loss?", ["About half of your results", "*About 3% at most", "None at all"]),
                 ("What comes before any supplement?", ["*Calories, protein, sleep and water", "The most expensive brand", "Pills that promise the world"])],
    ("smf", 8): [("Knowledge is only power when…", ["You keep it to yourself", "*You put it into action with energy and enthusiasm", "You read it twice"]),
                 ("Why does enthusiasm matter?", ["*It's contagious and carries your positive attitude to the people around you", "It burns extra calories", "It doesn't, staying calm is always better"])],
}

def build(quizzes, name, label):
    out = [f"-- Approved quizzes for {label} (October 25). Generated by scripts/build_quizzes.py. Safe to run more than once.", ""]
    for (kind, n), qs in quizzes.items():
        assert all(sum(o.startswith("*") for o in opts) == 1 for _, opts in qs), (kind, n)
        quiz = [{"q": text, "options": [o.lstrip("*") for o in opts], "correct": next(i for i, o in enumerate(opts) if o.startswith("*"))} for text, opts in qs]
        out.append(f"update public.lessons set quiz = {q(json.dumps(quiz, ensure_ascii=False))}::jsonb, quiz_status = 'approved' where id = {q(lid(kind, n))};")
    Path(__file__).resolve().parent.parent.joinpath(f"supabase/migrations/{name}").write_text("\n".join(out) + "\n")
    print(name, len(quizzes), "quizzes")


build(QUIZZES, "0015_quizzes_weeks_1_4.sql", "Weeks 1-4")
build(QUIZZES_5_8, "0016_quizzes_weeks_5_8.sql", "Weeks 5-8")
