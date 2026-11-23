// November 22 (Michael): his bonus courses, moved over from Xperiencify (PCOS Be Gone, Driven Women Challenge,
// High-T Timeline, Afternoon Energy Fix, Strong & Sculpted, Travel Workout Guide). Every client sees them.
// Videos: YouTube and Wistia links play as embeds; "code:BC-01" is a video uploaded in Coach → Videos.
export type BonusBlock = { k: "h" | "p" | "video" | "link"; v: string; t?: string };
export type BonusLesson = { slug: string; title: string; section?: string; blocks: BonusBlock[] };
export type BonusCourse = { slug: string; title: string; blurb: string; coachOnly?: boolean; intro?: BonusBlock[]; lessons: BonusLesson[] };

export const BONUS_COURSES: BonusCourse[] = [
 {
  "slug": "pcos-be-gone",
  "title": "PCOS Be Gone Blueprint",
  "blurb": "3 short videos on beating PCOS with the basics: sleep, protein, water, and a plan your brain actually likes.",
  "lessons": [
   {
    "slug": "part-1",
    "title": "Start here: how this works",
    "blocks": [
     {
      "k": "p",
      "v": "Most doctors treat PCOS with fancy pills and metformin\nAnd they're not bad people....\nBut, let's be real - nobody can say with 100% certainty what causes PCOS\nStudies point to high insulin from bad food, poor sleep, zero exercise, and stress levels through the roof\nWhile PCOS symptoms can be all over the place\nThat's why I created this 3-day PCOS Body Reset Blueprint Challenge\nNo complicated protocols - No expensive supplements\nJust the highest pleasure, lowest pain activities that actually move the needle for women with PCOS\n👇 Watch the video below to see exactly how it works."
     },
     {
      "k": "video",
      "v": "https://youtu.be/F-dQhpGCmEE"
     }
    ]
   },
   {
    "slug": "part-2",
    "title": "Part 1: 3 things your hormones need now",
    "blocks": [
     {
      "k": "p",
      "v": "The Average Woman With PCOS Tries 8 Different Diets Before Finding What Works\nThat's like trying on 8 wedding dresses when you're single\nMeanwhile doctors are pushing meds that mask symptoms instead of fixing the root cause\nBut here's the TRUTH no one tells you...\nYou already have everything you need to beat PCOS\nThe magic weight loss trio is sitting right in front of you:\n1) Better Sleep (and more of it)\nYour hormones reset when you sleep. Without it, your insulin goes wild like a toddler with candy\n2) Protein at every meal\nMuscle burns more fat than Netflix burns time - and protein builds muscle\n3) Water everywhere\nYour body holds onto fat when you're dehydrated - think of water as your fat-flushing friend\nThese are not groundbreaking (and that's the point)\nPCOS weight loss isn't about finding some exotic berry extract from the Amazon\nIt's about mastering the basics that everyone overlooks\nWant the complete blueprint for attacking PCOS at its root?\n👇 Watch this video:"
     },
     {
      "k": "video",
      "v": "https://youtu.be/zgk81uGP9pI"
     }
    ]
   },
   {
    "slug": "part-3",
    "title": "Part 2: the 3 PCOS pleasure principles",
    "blocks": [
     {
      "k": "p",
      "v": "Your Brain Only Cares About 3 Things:\n😊 Finding pleasure\n🙅‍♀️ Avoiding pain\n🔌 Saving energy\nMost weight loss programs ignore this\nThey force you into miserable diets that feel like punishment (no wonder 95% of New Years resolutioners quit by February)\nRemember that time you tried keto?\nOr when you did those extreme workouts?\nYour brain HATED that\nAnd with the hormone circus in your body is fighting against you, PCOS makes this even harder\nThe trick is creating a positive feedback loop\nMaking yourself WANT to do the things that get results.\nDoes it take longer?\nYes\nBut you're building a fit identity that lasts forever\nMost women with PCOS fail because the pain is too high:\nUnrealistic expectations, rigid restrictions, no support.\nYou need someone asking the right questions\nRedirecting your focus, and showing you options you never saw before\nThat's why I created the PCOS Body Reset Program\nIt works with your brain instead of against it\n👇 Watch the video below to see how we've helped women just like you lose weight and keep it off - without the misery"
     },
     {
      "k": "video",
      "v": "https://youtu.be/vg2dHkSG_2M"
     }
    ]
   }
  ]
 },
 {
  "slug": "driven-women-challenge",
  "title": "Driven Women Challenge",
  "blurb": "3 videos: the morning ritual, the eating and sleep system, and the supplements that help women over 35.",
  "lessons": [
   {
    "slug": "part-1",
    "title": "Video 1: the morning ritual",
    "blocks": [
     {
      "k": "p",
      "v": "Your Hormones Might Be Sabotaging You As You Read This... 😰\nIf you wake up exhausted, crash every night, though you can't even sleep properly...\nWhile other women your age are glowing...\nThe next 3 videos will help\nI made them based on the exact habits my best clients use to reclaim energy, confidence, and age like wine 🔥\nGet started with Video #1 below ⬇️"
     },
     {
      "k": "p",
      "v": "What if I told you:\n✨ There's a simple morning ritual that kickstarts your metabolism\n 💧 There's a drink that turns your brain into a powerhouse\n ☀️ There's a 10-minute trick that fixes your sleep forever\n 💪 There's an exact workout formula that reverses aging\nMy most successful clients wake up energized every day, stay focused, and sleep like babies at night 😴\n👇 Watch this video to see how"
     },
     {
      "k": "video",
      "v": "https://www.youtube.com/watch?v=aMxzqLJbcpY"
     }
    ]
   },
   {
    "slug": "part-2",
    "title": "Video 2: food and sleep",
    "blocks": [
     {
      "k": "p",
      "v": "If you eat processed foods, your hormones will throw a party you're not invited to 🍕➡️😵\nMost women over 35 are unknowingly triggering hormonal chaos with every meal 🔥\nEven worse is that intermittent fasting trend everyone's obsessing over\n(I'll tell you in the video below why women shouldn't fast 🚫)\nHere's what actually works:\n🥗 A simple eating system that fits your real life\n😴 My 10-3-2-1-0 sleep formula that melts fat overnight\n🧠 Why your body burns fat while you sleep (not when you workout!)\n💊 The one supplement that changes everything\nYour cortisol is already sky-high during menopause 📈\nDon't make it worse with outdated advice designed for 25-year-old men 🙄"
     },
     {
      "k": "p",
      "v": "Watch the video below for the nutrition and sleep secrets that are helping women over 35 thrive instead of just survive ⬇️"
     },
     {
      "k": "video",
      "v": "https://youtu.be/vDInVJYh-sg"
     }
    ]
   },
   {
    "slug": "part-3",
    "title": "Video 3: supplements",
    "blocks": [
     {
      "k": "p",
      "v": "In the FINAL video you'll learn: 🎯\nOne supplement that fights depression AND improves sleep 🧠😴\nOne vitamin you literally can't get enough of unless you walk around naked all day ☀️\nThe anti-inflammatory powerhouse that does more than I can fit in this video 🔥\nThe liquid energy booster that transforms your liver health ⚡\nAlso.. 🌿\nThere are some ancient plant compounds that work with your body to:\n• Slash cortisol when it's too high 📉\n• Boost sensitivity when it's too low 📈\n• Keep everything in perfect balance (naturally!) ⚖️\nWatch the final video to discover the exact supplements to make you feel better than you did in their 20s ✨"
     },
     {
      "k": "video",
      "v": "https://youtu.be/3KqXXPV9oUE"
     }
    ]
   }
  ]
 },
 {
  "slug": "high-t-timeline",
  "title": "The High-T Timeline",
  "blurb": "For the men in your life: 3 videos on raising testosterone naturally with mornings, food, sleep and supplements.",
  "lessons": [
   {
    "slug": "part-1",
    "title": "Part 1: what successful men do before breakfast",
    "blocks": [
     {
      "k": "p",
      "v": "Your testosterone is dropping 1% every year after 40\nAnd most guys think taking supplements or drinking \"hormone-boosting\" shakes will fix it\nTruth is...\nYour first 60 minutes after waking program your entire hormonal cascade for the day\nGet it wrong, and your testosterone takes a nosedive\nGet it right, and you can boost it up to 15%\nAfter 15+ years of coaching men just like you, I've discovered exactly:\n1.) What high-performing men need to do in those first 60 minutes after waking\n2.) Which workout techniques provide the fastest gains in the shortest amount of time\nAnd I break it all down in the first video\n(hint: training to failure is actually killing your gains if you're over 40)\nWatch it now while it's still up."
     },
     {
      "k": "video",
      "v": "https://youtu.be/Zks3JsWXZU8"
     }
    ]
   },
   {
    "slug": "part-2",
    "title": "Part 2: the foods you eat and the hours you sleep",
    "blocks": [
     {
      "k": "p",
      "v": "Ever wonder why some guys maintain muscle into their 50s while others turn into whales?\nOf course your food is paramount\nBut one of the least talked answers is your bed\nYour body creates 80% of its testosterone while you sleep\nYou might be tracking protein grams and pushing through those last few reps in your workout\nYet by not prioritizing sleep and/or food you will never see the fruits of your labor\nHere's where most guys mess up:\n1) They eating testosterone-killing foods daily\n2) They sleep horrible\nNobody tells you this though - because Big Pharma can't patent a good night's rest\nWatch video 2 for the exact foods & sleep protocol to build natural testosterone:"
     },
     {
      "k": "video",
      "v": "https://www.youtube.com/watch?v=2wrhRE1kKjw"
     }
    ]
   },
   {
    "slug": "part-3",
    "title": "Part 3: TRT is (probably) not the answer",
    "blocks": [
     {
      "k": "p",
      "v": "Most guys think they need to jump straight to TRT (testosterone replacement therapy)\nBut that's like using a sledgehammer to hang a picture.\nI recommend to start with the supplements that I list in this video\nAnd as I mention in the video, remember that your lifestyle is the horse and supplements are the carriage\nIf your sleep is garbage and you're eating like Santa, no supplement will save you\nMost men can increase their testosterone by 50-100% through lifestyle optimization alone\nAnd there ARE some supplements that will accelerate the process\nCheck them out in this final video of your High-T Timeline:"
     },
     {
      "k": "video",
      "v": "https://youtu.be/RopEkl2uLvI"
     }
    ]
   }
  ]
 },
 {
  "slug": "afternoon-energy-fix",
  "title": "The Office Worker's Afternoon Energy Fix",
  "blurb": "Fix your 3 PM crash: map your energy, time your coffee and meals, and set up your workspace.",
  "lessons": [
   {
    "slug": "l1",
    "title": "Energy Mapping Protocol",
    "section": "Your Energy Algorithm (start here)",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/9EvN8Us72aA"
     },
     {
      "k": "p",
      "v": "Your 3PM energy crash isn't random - it's 100% predictable\nThat's why in this video I will show you:\n✨ A systematic way to identify your personal energy leaks\n📈 One tracking method that reveals your crash patterns\n🔍 A 3-day protocol that maps your energy like debugging code\n⚡ The exact triggers that kill your afternoon performance\nThis isn't guesswork—it's what my most successful clients do to diagnose their energy system\nThey identify their patterns, fix the leaks, and maintain consistent energy all day 💪\n👇 Watch this video to start mapping your energy - your productivity will thank you"
     }
    ]
   },
   {
    "slug": "l2",
    "title": "Biorhythm Timing System",
    "section": "Your Energy Algorithm (start here)",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/CfSEOdai7OU"
     },
     {
      "k": "p",
      "v": "Quick question: When did you have your first coffee today? ☕\nIf it was within 90 minutes of waking up... this video is going to reveal something for you\nIn it you will discover:\n🕐 The 90-minute rule (backed by Stanford neuroscience)\n 🥗 Strategic meal timing that prevents blood sugar crashes\n⚡ Nutrient protocols that work WITH your biology\nWatch this if you're tired of being tired:"
     }
    ]
   },
   {
    "slug": "l3",
    "title": "Workspace Energy Matrix",
    "section": "Your Energy Algorithm (start here)",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/HQDVL1HzCHg"
     },
     {
      "k": "p",
      "v": "Fluorescent lights. Static sitting. Poor ergonomics.\nYour workspace is basically designed by someone who hates productivity 🏢\nBut here's the thing - small environmental changes create massive energy improvements.\n→ Lighting optimization that doesn't require IT approval\n→ Movement protocols that look professional\n→ Ergonomic hacks that prevent energy drain\n→ The 5-minute sequence that prevents crashes\nBottom line: Your environment either supports peak performance or kills it. There's no middle ground.\nWatch this video to engineer your workspace for sustained energy:"
     }
    ]
   },
   {
    "slug": "l4",
    "title": "How To Implement (And What Comes Next?)",
    "section": "Your Energy Algorithm (start here)",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/3gz_RhY2Ccg"
     },
     {
      "k": "p",
      "v": "So you've eliminated your afternoon crashes. Now what?\nHere's what I've discovered coaching 1,200+ professionals:\nFixing your energy is just the beginning.\nOnce you have consistent energy, you start wanting more. You realize your body doesn't match your professional success. You want to be the example of what's possible.\nThis video covers:\n• 4-week implementation roadmap (no overwhelm)\n• Common troubleshooting scenarios\n• What happens when energy isn't your biggest problem anymore\n• The transformation that goes beyond just \"not crashing\"\nFair warning: This video might make you want to tackle bigger challenges 💪"
     }
    ]
   },
   {
    "slug": "l5",
    "title": "The Nutrient Calculator 2.0",
    "section": "Bonus Resources",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/duZmbdtEoKc"
     },
     {
      "k": "p",
      "v": "This isn't another generic macro calculator.\nThis is precision timing for your specific work schedule 🎯\nInput your wake time, goal weight, and bedtime. Get your exact:\n• First caffeine timing (down to the minute)\n• Protein targets that prevent crashes\n• Meal windows that work with meetings\n• Hydration schedule that actually fits your day\n•\nMy engineering clients call this \"energy optimization made simple\"\nTakes 3 minutes to use. Results last all day:"
     }
    ]
   },
   {
    "slug": "l6",
    "title": "5-Minute Movement Library",
    "section": "Bonus Resources",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/e5_IFbudCM0"
     },
     {
      "k": "p",
      "v": "You can NOT be sitting motionless for 8 hours in a row...\nThat's why I'm giving you some 'office exercises' that boost energy without drawing attention 💼\n✅ Blood flow activators (when you feel sluggish)\n ✅ Pre-meeting sharpeners (when you need to be \"on\")\n✅ Discrete exercises (that work during calls)\n✅ Spinal mobility (for that tight back)\nEach movement: 30 seconds. Total sequence: 2.5 minutes.\nYour coworkers will wonder why you never crash:"
     }
    ]
   },
   {
    "slug": "l7",
    "title": "Emergency Meeting Energy Rescue Protocol",
    "section": "Bonus Resources",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/bVQPyjRCoi8"
     },
     {
      "k": "p",
      "v": "Imagine it's 2:47 PM. Critical meeting at 3:00 PM. Brain feels dead.\nThis is your emergency protocol.\nNot caffeine. Not hope. Actual physiology.\n3 scenarios covered:\n🚨 5 minutes available = Full rescue protocol\n⚡ 2 minutes available = Compressed version\n💨 30 seconds available = Emergency micro-protocol\nUses breathing patterns, movement sequences, and environmental changes that activate your nervous system instantly.\nYou'll need it when you least expect it:"
     }
    ]
   },
   {
    "slug": "l8",
    "title": "High Performance Workspace Energy Audit",
    "section": "Bonus Resources",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/xLkPK1Irdno"
     },
     {
      "k": "p",
      "v": "Your workspace is either optimizing your energy or killing it\nThere's no neutral.\nThis audit scores 5 critical areas:\n📊 Lighting setup (natural + artificial)\n🪑 Ergonomic positioning\n🌡️ Environmental factors\n💻 Technology optimization\n⚡ Energy support tools\nGet your score out of 100 + specific improvements based on your weak points\nTakes 10 minutes. Reveals exactly why you're drained by 3 PM.\nMost office workers score under 60. What's your number?"
     }
    ]
   },
   {
    "slug": "l9",
    "title": "Printable Action Sheets",
    "section": "Implementation Guide",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/UkG9QOmJww8"
     },
     {
      "k": "p",
      "v": "You have the algorithm. Now here's how to actually implement it.\nWithout getting overwhelmed. Without trying to optimize everything at once.\n4 weeks. Systematic progression. Zero guesswork.\nEach week builds on the previous. Each day has specific actions.\nDownload. Print. Follow. Transform.\nYour step-by-step roadmap starts here:"
     }
    ]
   },
   {
    "slug": "l10",
    "title": "Special Situations",
    "section": "Implementation Guide",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/sxHGNhCXZHU"
     },
     {
      "k": "p",
      "v": "\"But what if my schedule is completely unpredictable?\"\n\"What if I can't control my workspace?\"\n\"What if I travel constantly?\"\nHere are the real-world solutions for every scenario my clients face:\n→ Shift work adaptations\n→ Travel protocols\n→ No workspace control workarounds\n→ Inconsistent schedule adjustments\n→ High-stress period modifications\nThe goal isn't perfect conditions. It's systematic adaptation.\nYour obstacles aren't excuses. They're just variables to optimize around:"
     }
    ]
   },
   {
    "slug": "l11",
    "title": "Final Notes",
    "section": "Implementation Guide",
    "blocks": [
     {
      "k": "video",
      "v": "https://youtu.be/2mmYSnCB2K0"
     },
     {
      "k": "p",
      "v": "Success comes down to 4 things:\nConsistency over perfection. Data over guesswork. Systems over willpower. One change at a time.\nBut here's what happens after you master afternoon energy...\nYou realize energy was just the beginning. You want more than \"not crashing.\" You want the complete transformation.\n→ Success factors that guarantee results\n→ Common mistakes that kill progress\n→ Long-term sustainability principles\n→ The bigger opportunity beyond energy\nReady to see what comes after consistent energy?"
     }
    ]
   }
  ]
 },
 {
  "slug": "strong-and-sculpted",
  "title": "Strong & Sculpted in 90 Min a Week",
  "blurb": "A 3-week strength routine: 3 workouts of 30 minutes, with a video for every exercise.",
  "intro": [
   {
    "k": "h",
    "v": "You're about to prove you do NOT need 2-hour gym sessions to build lean, sculpted muscle"
   },
   {
    "k": "p",
    "v": "All you need is 90 minutes - per week\nHere's how to use this program:\nFollow the workouts below for 3 weeks and track your strength gains each week\nDo them on whichever days work best for your schedule\nThe ideal setup is:• Monday - Workout 1\n• Tuesday - Rest\n• Wednesday - Workout 2\n• Thursday - Rest\n• Friday - Workout 3\n• Weekend - Rest\nBut overall, just make sure not to do more than 2 workouts in a row\n(because your muscle needs 72 hours to recover)"
   }
  ],
  "lessons": [
   {
    "slug": "day-1",
    "title": "Strong & Sculpted Day 1",
    "blocks": [
     {
      "k": "p",
      "v": "This video is an entire overview of every exercise you'll do on Day 1.\nI recommend you watch this video BEFORE starting the workout.\nIdeally the night before, or at home so you can let it 'sink in' and know exactly what to do when you start your workout =)"
     },
     {
      "k": "video",
      "v": "code:BC-01"
     },
     {
      "k": "h",
      "v": "Day 1 Exercises"
     },
     {
      "k": "p",
      "v": "In case you did not watch the video above -> all video's you see below are short excerpts of the big video above.\nBelow you will see every exercise in a short clip.\nAnd here's the mobility routine to start Day 1 with:"
     },
     {
      "k": "video",
      "v": "code:BC-02"
     },
     {
      "k": "p",
      "v": "Perform 2 Sets of the following Reps:\n• 25 Cat-Camels\n• 5 Cobra to Downward Dogs\n• 5 Groiners each side\n• 5 seconds of Outward Knee Push\n• 5 seconds of Moving Your Hips Around\n(so, do the 25 Cat-Camels, immediately followed by the 5 Cobra's, 5 Groiners, 5 Knee pushes, 5 Hip moves... then rest, and do one more round to complete 2 'sets')"
     },
     {
      "k": "p",
      "v": "Exercises #1, #2, #3 (in a Superset)"
     },
     {
      "k": "h",
      "v": "Banded Face Pulls -> Bodyweight Glute Bridges -> Dumbbell Cossack Squats"
     },
     {
      "k": "video",
      "v": "code:BC-03"
     },
     {
      "k": "p",
      "v": "Perform 2 sets of the following Reps:\n• 20 Banded Face Pulls\n• 15 Bodyweight Glute Bridges\n• 5 Cossack Squats Each Side\nYou'll start this workout with what is called a 'superset'.\nThis means you will do 1 set of an exercise, followed by 1 set of a different exercise.\nIn this case, you'll be doing 3 exercises 'in a row' as shown in the video: Banded Face Pulls to a Bodyweight Glute Bridge to a Cossack Squat.\nFor the Banded Face Pulls, do 20 reps in a row\nFor the Bodyweight Glute Bridges, do 15 reps in a row\nFor the Cossack Squats, do 5 reps each side in a row\nAfter doing all 3 exercises non-stop in a row, you take a break of 60 seconds.\nThen repeat that sequence 1 more time.\nThis will be your very first 'superset' of the program.\nWe will be using this method in the other workouts as well, since it allows you to do more 'work' in less time.\nThese exercises do not need to be tracked, as they are mostly bodyweight. And they primarily serve to 'activate' all the right muscles for your big lift coming up next."
     },
     {
      "k": "p",
      "v": "Exercise #4 (Straight Sets)"
     },
     {
      "k": "h",
      "v": "Jump Squats"
     },
     {
      "k": "video",
      "v": "code:BC-04"
     },
     {
      "k": "p",
      "v": "Perform 2 sets of 6 Reps.\nThese jump squats will serve to 'wake up' your leg muscles.\nIt's always a good idea to do something explosive before your main lift of the day, as it gets you mentally ready and all connecting muscles fired up.\nPerform just 2 sets of 6 reps (with enough seconds in between to catch your breath)\nThese do not need to be tracked, as they are bodyweight only."
     },
     {
      "k": "p",
      "v": "Exercise #5 (Straight Sets)"
     },
     {
      "k": "h",
      "v": "Dumbbell Bulgarian Split Squats"
     },
     {
      "k": "video",
      "v": "code:BC-05"
     },
     {
      "k": "p",
      "v": "Find your '8 Rep Max' and improve upon it every week\nBulgarian Split Squats will be your 'Big Lift' of the day. Where you build the most amount of strength.\nHere's what to do:\nStart every week with 1 warmup set of 10 reps with just your bodyweight.\nThen take 2-4 sets to work up to an '8-Rep Max'\nThis means you hit the MAX weight that you can properly do for 8 reps.\nSo for instance, after your warmup, you might start with:\n1 set of 8 with 20 lbs Dumbbells - and it goes easy\nSo you grab 25 lbs Dumbbells, and you do another set of 8 - this time it's more challenging, but you can still do more...\nThen you grab the 30 lbs Dumbbells and keep trying to hit 8 reps per leg\nAnd keep going heavier until you 'find' the max weight you can only lift for 8 reps...\nThis is called your '8-rep max'.\nHeads-up:\n> You might need more than 3 sets to 'find' your 8 rep max, feel it out and listen to your body\n> Take long breaks in between these sets, as this is your strength movement of the day\n> The goal here is to lift heavier every week\nYou can track your performance in the boxes below:"
     },
     {
      "k": "p",
      "v": "Exercise #6 (Timed Set)"
     },
     {
      "k": "h",
      "v": "Ring (or Barbell) Assisted Pullups"
     },
     {
      "k": "video",
      "v": "code:BC-06"
     },
     {
      "k": "p",
      "v": "Perform as many reps as you can in 1 set of 60 seconds\nThis will be a 'timed set' - meaning you set a timer and try to accomplish the most amount of clean reps in the allotted time\nIn this case, it's 1 set of 60 seconds\nOnly 1 set...\nSo prepare mentally for it, and give it your all. Then track your reps for every week to see how much you're improving."
     },
     {
      "k": "p",
      "v": "Exercises #7, #8 (Superset)"
     },
     {
      "k": "h",
      "v": "Banded Kickouts -> Dumbbell Bicep Curls"
     },
     {
      "k": "video",
      "v": "code:BC-07"
     },
     {
      "k": "p",
      "v": "Perform 2 sets of the following Reps:\n• 20 Banded Kickouts (each leg)\n• 12 Dumbbell Bicep Curls\nFirst perform 20 Banded Kickouts per leg.\nThen right afterwards, perform the Dumbbell Bicep Curls for a set of 12 reps.\nThen you rest for 60 seconds before repeating that one more time.\nThe weight of the Banded Kickouts does not need to be tracked, but go heavier on the Dumbbell Bicep Curls every week.\nYou can track the weight of the Dumbbells you used for the Bicep Curls in the boxes below:"
     }
    ]
   },
   {
    "slug": "day-2",
    "title": "Strong & Sculpted Day 2",
    "blocks": [
     {
      "k": "p",
      "v": "This video is an entire overview of every exercise you'll do on Day 2.\nI recommend you watch this video BEFORE starting the workout.\nIdeally the night before, or at home so you can let it 'sink in' and know exactly what to do when you start your workout =)"
     },
     {
      "k": "video",
      "v": "code:BC-08"
     },
     {
      "k": "h",
      "v": "Day 2 Exercises"
     },
     {
      "k": "p",
      "v": "In case you did not watch the above video, I want to remind you that all video's you see below are short excerpts of the big video above.\nBelow you will see every exercise in a short clip.\nAnd here's the mobility routine to start Day 2 with:"
     },
     {
      "k": "video",
      "v": "code:BC-09"
     },
     {
      "k": "p",
      "v": "Perform 1 Set of the following Reps:\n• 10 seconds of a Kneeling Lat Stretch (each side)\n• 3 Dynamic Chest Stretches (each side)\n• 10 Banded Dislocations\n• 10 seconds of a Banded Shoulder Stretch\n(so, do the 10 seconds of a Kneeling Lat Stretch, immediately followed by the 3 Dynamic Chest Stretches, 10 Banded Dislocations, etc... all in a row without stopping in between)"
     },
     {
      "k": "p",
      "v": "Exercise #1"
     },
     {
      "k": "h",
      "v": "Jump Rope"
     },
     {
      "k": "video",
      "v": "code:BC-10"
     },
     {
      "k": "p",
      "v": "In Week 1:\nPerform 150 jumps\nIn Week 2:\nPerform 200 jumps\nIn Week 3:\nPerform 250 jumps\nNo need to track anything here, simply go at your own pace and use this as a warmup"
     },
     {
      "k": "p",
      "v": "Exercises #2, #3, #4 (in a Superset)"
     },
     {
      "k": "h",
      "v": "Pushups (at your level) -> Banded Pullaparts -> Incline Dumbbell Kickbacks"
     },
     {
      "k": "video",
      "v": "code:BC-11"
     },
     {
      "k": "p",
      "v": "Perform 2 sets of the following Reps:\n• 10 Pushups\n• 15 Banded Pullaparts\n• 20 Incline Dumbbell Kickbacks\nYou'll start this workout with another 'superset' - if you don't know what this means, go back to your Day 1 workout and you'll see it there.\nFrom now on, if you see multiple exercises in the title (and video), then that means you will be doing those exercises in a superset.\nOn this one, go for:\n- 10 reps on the Pushups\n- 15 reps on the Banded Pullaparts\n- 20 Incline Dumbbell Kickbacks\nThen rest 60 seconds, and complete another set of the above exercises non-stop.\nNo need to track the weight on these, just make it 'feel good' and keep it light."
     },
     {
      "k": "p",
      "v": "Exercise #5 (Straight Sets)"
     },
     {
      "k": "h",
      "v": "Dumbbell Incline Press"
     },
     {
      "k": "video",
      "v": "code:BC-12"
     },
     {
      "k": "p",
      "v": "Find your '8 Rep Max' and improve upon it every week\nThe DB Incline Press is your 'Big Lift' of the day. Where you build the most amount of strength.\nJust like in Day 1 with he Bulgarians, start every week with 1 warmup set of 10 reps with just your bodyweight.\nThen take 2-4 sets to work up to an '8-Rep Max'\nThis means you hit the MAX weight that you can do properly for 8 reps.\nSo for instance, after your warmup, you might start with:\n1 set of 8 with 20 lbs Dumbbells - and it goes easy\nSo you grab 25 lbs Dumbbells, and you do another set of 8 - this time it's more challenging, but you can still do more...\nThen you grab the 30 lbs Dumbbells and keep trying to hit 8 reps per leg\nAnd keep going heavier until you 'find' the max weight you can only lift for 8 reps...\nThis is called your '8-rep max'.\nHeads-up:\n> You might need more than 3 sets to 'find' your 8 rep max, feel it out and listen to your body\n> Take long breaks in between these sets, as this is your strength movement of the day\n> The goal here is to lift heavier every week\nYou can track your performance in the boxes below:"
     },
     {
      "k": "p",
      "v": "Exercises #6, #7, #8 (in a Superset)"
     },
     {
      "k": "h",
      "v": "Incline DB Rows -> Incline Dumbbell Tricep Extensions -> Diamond Pushups"
     },
     {
      "k": "video",
      "v": "code:BC-13"
     },
     {
      "k": "p",
      "v": "Perform just 1 set of the following Reps:\n• 15 Incline Dumbbell Rows\n• 20 Incline Dumbbell Tricep Extensions\n• As Many As Possible Diamond Pushups\nFirst perform 15 Incline Dumbbell Rows\nThen right afterwards, perform the Incline Dumbbell Tricep Extensions for 20 reps.\nThen with no rest in between, perform as many Diamond Pushups as possible\nReally go all out\nAnd for best results (and to have the most fun), track the weights of both the Dumbbell Rows... and the weights used for the Incline Dumbbell Tricep Extensions... AND the amount of reps you got for the Diamond Pushups\nYou can track both the weights used and reps performed in the boxes below:"
     }
    ]
   },
   {
    "slug": "day-3",
    "title": "Strong & Sculpted Day 3",
    "blocks": [
     {
      "k": "p",
      "v": "This video is an entire overview of every exercise you'll do on Day 3.\nI recommend you watch this video BEFORE starting the workout.\nIdeally the night before, or at home so you can let it 'sink in' and know exactly what to do when you start your workout =)"
     },
     {
      "k": "video",
      "v": "code:BC-14"
     },
     {
      "k": "h",
      "v": "Day 3 - The Exercises"
     },
     {
      "k": "p",
      "v": "In case you did not watch the above video, I want to remind you that all video's you see below are short excerpts of the big video above.\nHere's the mobility routine to start Day 3 with:"
     },
     {
      "k": "video",
      "v": "code:BC-15"
     },
     {
      "k": "p",
      "v": "Perform 1 Set of the following Reps:\n• 6 Windshield Wipers\n• 6 90-90's\n• 60 seconds of a Bodyweight Squat Hold"
     },
     {
      "k": "p",
      "v": "Exercise #1, #2, #3 (in a Superset)"
     },
     {
      "k": "h",
      "v": "Slider Leg Curls -> Banded Palloff Presses -> Elevated RKC Planks"
     },
     {
      "k": "video",
      "v": "code:BC-16"
     },
     {
      "k": "p",
      "v": "Perform 2 sets of the following Reps:\n• 15 Slider Leg Curls\n• 8 Palloff Presses (each side)\n• 2 Squeezes of 5 Seconds on an Elevated RKC Plank\nYou'll start this workout with another 'superset' - if you don't know what this means, go back to your Day 1 workout and you'll see it there.\nOn this one, go for the above reps. And on the RKC plank, you will do intermittent 'butt squeezes' of 5 seconds each as shown in the big video above\nRest 60 seconds after the first set, then complete another set to properly warmup for Day 3.\nNo need to track the weight on these, just make it 'feel good' and keep it light."
     },
     {
      "k": "p",
      "v": "Exercise #4 (Straight Sets)"
     },
     {
      "k": "h",
      "v": "Ring-Assisted Lunge Jumps"
     },
     {
      "k": "video",
      "v": "code:BC-17"
     },
     {
      "k": "p",
      "v": "Perform 2 sets of 6 reps\nThese lunge jumps will serve to 'wake up' your whole lower body\nPerform the 2 sets with enough seconds in between to catch your breath (and try to 'land soft')\nThese do not need to be tracked, as they are bodyweight only."
     },
     {
      "k": "p",
      "v": "Exercise #5 (Straight Sets)"
     },
     {
      "k": "h",
      "v": "Dumbbell Deadlifts"
     },
     {
      "k": "video",
      "v": "code:BC-18"
     },
     {
      "k": "p",
      "v": "Find your '8 Rep Max' and improve upon it every week\nDB Deadlifts are your 'Big Lift' of the day. As in the previous workout days, start every week with 1 warmup set of 10 reps with just your bodyweight.\nThen take 2-4 sets to work up to an '8-Rep Max'\nThis means you hit the MAX weight that you can do properly for 8 reps.\nSo for instance, after your warmup, you might start with:\n1 set of 8 with 20 lbs Dumbbells - and it goes easy\nSo you grab 25 lbs Dumbbells, and you do another set of 8 - this time it's more challenging, but you can still do more...\nThen you grab the 30 lbs Dumbbells and keep trying to hit 8 reps per leg\nAnd keep going heavier until you 'find' the max weight you can only lift for 8 reps...\nThis is called your '8-rep max'.\nHeads-up:\n> You might need more than 3 sets to 'find' your 8 rep max, feel it out and listen to your body\n> Take long breaks in between these sets, as this is your strength movement of the day\n> The goal here is to stick to get stronger on this lift, especially in Week 3 as you will have built up your conditioning in Weeks 1 & 2.\nYou can track your performance in the boxes below:"
     },
     {
      "k": "p",
      "v": "Exercises #6, #7 (in a Superset)"
     },
     {
      "k": "h",
      "v": "Dumbbell Pullovers -> Dumbbell Lungewalks"
     },
     {
      "k": "video",
      "v": "code:BC-19"
     },
     {
      "k": "p",
      "v": "Perform 2 sets of the following Reps:\n• 12 Dumbbell Pullovers\n• 16 Lungewalks (8 Steps Each Leg)\nIn all 3 weeks, perform 12 Pullovers followed by 16 Lungewalks, and then resting for 60 seconds before doing it again.\nEvery week you'll keep the reps the same, so track the weight you lift on both exercises and aim to increase the weights used each week (if doing Bodyweight on Lungewalks, simply note 'Bodyweight')"
     },
     {
      "k": "p",
      "v": "Exercise #8 (Timed Set)"
     },
     {
      "k": "h",
      "v": "Slider Knee Tucks"
     },
     {
      "k": "video",
      "v": "code:BC-20"
     },
     {
      "k": "p",
      "v": "In Week 1:\nPerform 30 Reps As Fast As Possible\nIn Week 2:\nPerform 40 Reps As Fast As Possible\nIn Week 3:\nPerform 50 Reps As Fast As Possible\nAfter your first week, track how long it took you to complete all 30 reps\nThen the goal here is to complete 40 reps the following week in the same time or less\nAnd in Week 3, to complete 50 reps in that same time or less again."
     }
    ]
   }
  ]
 },
 {
  "slug": "travel-workout-guide",
  "title": "Travel Workout Guide",
  "blurb": "3 hotel-room workouts, 30 minutes each, no gym needed. Keep your strength on the road.",
  "intro": [
   {
    "k": "h",
    "v": "You're about to prove you do NOT need 2-hour gym sessions to build lean, sculpted muscle"
   },
   {
    "k": "p",
    "v": "All you need is 30 minutes and a hotel room.\nNo excuses. No equipment. No gym required.\nHere's how to use this program:\nFollow these 3 travel workouts to maintain your muscle and strength while you're on the road.\nDo them on whichever days work best for your travel schedule.\nThe ideal setup is:\n• Travel Day 1 - Workout 1\n• Travel Day 2 - Rest (or light walking/exploring)\n• Travel Day 3 - Workout 2\n• Travel Day 4 - Rest\n• Travel Day 5 - Workout 3\n• Remaining Days - Active recovery (walking, sightseeing)\nBut overall, just make sure not to do more than 2 workouts in a row\n(because your muscles need 48-72 hours to recover between sessions)\nThe goal isn't to make gains while traveling, it's to maintain what you've built.\nSo you come home feeling strong, not soft.\nSo you don't lose momentum.\nSo your clothes still fit the same way.\nAnd so you're not starting from scratch when you get back.\nBecause driven women don't let a business trip or vacation derail months of progress."
   }
  ],
  "lessons": [
   {
    "slug": "day-1",
    "title": "Travel Workout Day 1",
    "blocks": [
     {
      "k": "p",
      "v": "> ​Each workout is full-body: So I don't recommend doing 2 in a row (take a day off between workouts)\n​\n> A 'Superset' is 2 or more exercises performed in a row: Without stopping, until you finish the last exercise of the 'Superset'\n> The goal is to get the entire workout done in 30 min: So you can head right back to la playa afterwards\n> ​Don't go TOO heavy: Use your vacation as a 'deload' week and these workouts as a means to 'refresh' your routine with something new (and lightweight)"
     },
     {
      "k": "h",
      "v": "Day 1 Superset 1"
     },
     {
      "k": "p",
      "v": "3 Rounds of:\n> 10 Scissor Kicks (each leg)\n​> 10 Body Rocks\n​> 5 Windshields (each side)\n​> 20 Steps (each side)\n(with 45 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/k-r8FCPhnUg"
     },
     {
      "k": "h",
      "v": "Day 1 Superset 2"
     },
     {
      "k": "p",
      "v": "3 Rounds of:\n> 12 Lunges (each leg)\n​> 12 Rows (each arm)\n(with 60 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/D7XWGtCEeYg"
     },
     {
      "k": "h",
      "v": "Day 1 Superset 3"
     },
     {
      "k": "p",
      "v": "2 Rounds of:\n> 10 Pushups\n​> 15 Rows\n​> 20 Pullthroughs\n(with 60 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/AvVQG0ibXrY"
     },
     {
      "k": "h",
      "v": "Day 1 Finisher"
     },
     {
      "k": "p",
      "v": "1 set of 100 Landmine Raises:\n> As fast as possible at a challenging weight, taking the minimum amount of breaks\n(with as little rest as possible between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/DMCkOJ8mjnw"
     }
    ]
   },
   {
    "slug": "day-2",
    "title": "Travel Workout Day 2",
    "blocks": [
     {
      "k": "p",
      "v": "> ​Each workout is full-body: So I don't recommend doing 2 in a row (take a day off between workouts)\n​\n> A 'Superset' is 2 or more exercises performed in a row: Without stopping, until you finish the last exercise of the 'Superset'\n> The goal is to get the entire workout done in 30 min: So you can head right back to la playa afterwards\n> ​Don't go TOO heavy: Use your vacation as a 'deload' week and these workouts as a means to 'refresh' your routine with something new (and lightweight)"
     },
     {
      "k": "h",
      "v": "Day 2 Superset 1"
     },
     {
      "k": "p",
      "v": "3 Rounds of:\n> 20 Squats\n​> 20 Presses\n(with 45 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/raW9CzqMXEw"
     },
     {
      "k": "h",
      "v": "Day 2 Superset 2"
     },
     {
      "k": "p",
      "v": "3 Rounds of:\n> 12 Bulgarians (each leg)\n​> 12 Dips\n(with 60 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/WQCnEYjzVto"
     },
     {
      "k": "h",
      "v": "Day 2 Superset 3"
     },
     {
      "k": "p",
      "v": "2 Rounds of:\n> 15 Extensions\n​> 5 DragonFlyes\n​> 10 Romanians\n(with 45 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/zDW5R_vNMHw"
     },
     {
      "k": "h",
      "v": "Day 2 Finisher"
     },
     {
      "k": "p",
      "v": "1 Round of:\n> 5 sec hold per letter... followed immediately by:\n​> 10 sec hold per letter... followed immediately by:\n​> 15 sec hold per letter... followed immediately by:\n​> 20 sec hold per letter\n(with no rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/eK74IgTlB3Y"
     }
    ]
   },
   {
    "slug": "day-3",
    "title": "Travel Workout Day 3",
    "blocks": [
     {
      "k": "p",
      "v": "> ​Each workout is full-body: So I don't recommend doing 2 in a row (take a day off between workouts)\n> A 'Superset' is 2 or more exercises performed in a row: Without stopping, until you finish the last exercise of the 'Superset'\n> The goal is to get the entire workout done in 30 min: So you can head right back to la playa afterwards\n> ​Don't go TOO heavy: Use your vacation as a 'deload' week and these workouts as a means to 'refresh' your routine with something new (and lightweight)"
     },
     {
      "k": "h",
      "v": "Day 3 Superset 1"
     },
     {
      "k": "p",
      "v": "3 rounds of:\n> 10 taps (each side)\n> 10 steps (each side)\n(with 45 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/Q4nMI9LfdcE"
     },
     {
      "k": "h",
      "v": "Day 3 Superset 2"
     },
     {
      "k": "p",
      "v": "3 rounds of:\n> 12 Shoulder Presses (each arm)\n> 12 Deadlifts (each leg)\n(with 60 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/Unf7WwpU6O0"
     },
     {
      "k": "h",
      "v": "Day 3 Superset 3"
     },
     {
      "k": "p",
      "v": "2 rounds of:\n> 20 Pulldowns\n​> 15 Squats\n​> 15 Pushups\n(with 45 sec rest between sets)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/qjwBFXQKvFY"
     },
     {
      "k": "h",
      "v": "Day 3 Finisher"
     },
     {
      "k": "p",
      "v": "1,000 jumps on a jump rope:\n> As fast as possible, taking the minimum amount of breaks\n(with as little rest as possible between breaks)"
     },
     {
      "k": "video",
      "v": "https://youtu.be/374xzr2v4xY"
     }
    ]
   }
  ]
 }
];

import { COACH_COURSES } from "./coach-courses";

// Coach-only courses (Capacity Jumpstart) are found only for the coach.
export const bonusCourse = (slug: string, coach = false) => [...BONUS_COURSES, ...(coach ? COACH_COURSES : [])].find((c) => c.slug === slug) ?? null;
