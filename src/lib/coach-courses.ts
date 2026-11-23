import type { BonusCourse } from "./bonus-courses";

/**
 * November 22 (Michael): courses kept in the app for him only (moved over from Xperiencify). Clients never see
 * them: not in Lessons, not in Search, and their pages are refused. Capacity Jumpstart is the pre-workshop
 * course for people who sign up for his free workshop, kept here for the low-ticket challenge he's building.
 */
export const COACH_COURSES: BonusCourse[] = [
  {
    slug: "capacity-jumpstart",
    title: "Capacity Jumpstart",
    coachOnly: true,
    blurb: "The pre-workshop course for Desk Job Detox workshop sign-ups: 3 short videos before the workshop, Video 4 and the live bonuses after.",
    lessons: [
      {
        slug: "video-1",
        title: "Video 1: start here",
        section: "Before the workshop",
        blocks: [
          { k: "p", v: "If you are seeing this, you are in for the Desk Job Detox workshop, and you can totally just show up.\nBut the women who get the most out of it complete the Capacity Jumpstart first.\nIt's 3 short videos, start with video #1 here:" },
          { k: "video", v: "code:BC-21" },
        ],
      },
      {
        slug: "video-2",
        title: "Video 2: how to fix your sleep",
        section: "Before the workshop",
        blocks: [
          { k: "p", v: "Good work on filling out your Score Card! 👍\nHere's a tip you can use before the workshop starts (or tomorrow morning).\nTakes 2 minutes, and most women notice a difference within 48 hours ⬇️" },
          { k: "video", v: "code:BC-22" },
        ],
      },
      {
        slug: "video-3",
        title: "Video 3: your personal starting point",
        section: "Before the workshop",
        blocks: [
          { k: "p", v: "Almost there! 🚀\nThis last video takes 2 minutes and sets you up to get the absolute most out of the live workshop ⬇️" },
          { k: "video", v: "code:BC-23" },
          { k: "p", v: "You made it through the pre-work 🤩\nStep 4 unlocks the night of the workshop after you show up LIVE." },
        ],
      },
      {
        slug: "video-4",
        title: "Video 4 + live attendance bonuses",
        section: "After the workshop (live attendees)",
        blocks: [
          { k: "h", v: "You showed up LIVE! 🔥" },
          { k: "p", v: "You now know more about your sleep, energy, and metabolism than 95% of women who sit behind a desk.\nBut knowing what to do and doing it are different things.\nThe women who get the full transformation do not just watch the workshop, they take the next step." },
          { k: "h", v: "Here is your next step..." },
          { k: "p", v: "Watch Video 4 first:" },
          { k: "video", v: "code:BC-24" },
          { k: "h", v: "LIVE Attendance Bonus #1" },
          { k: "p", v: "Your Desk Job Capacity Quiz\nFive questions that tell you exactly where YOU should start based on your specific sleep history, your energy patterns, and what you have already tried." },
          { k: "link", v: "https://link.straightupfitness.com/widget/quiz/OlRvDLCuoJqHAU12yTYv", t: "Take the Capacity Quiz" },
          { k: "h", v: "LIVE Attendance Bonus #2" },
          { k: "p", v: "My Proteins, Ice Cream, and Superfoods Recipe Videos\nThese are the actual meals my private clients eat (every one hits 25-40 grams of protein)." },
          { k: "h", v: "LIVE Attendance Bonus #3" },
          { k: "p", v: "The Replay of our Desk Job Detox Workshop\nIn case you want to revisit anything we covered." },
          { k: "video", v: "https://www.youtube.com/watch?v=Z5gxRCZIuC0" },
          { k: "p", v: "And when you finish and think:\n\"Ok, I get it - I want to do this\"\nThen schedule a free assessment call with me next.\nWe'll go deep on your specific goals so you get a clear picture of what needs to change first (regardless of whether we work together).\nIt's 30 minutes - and it is NOT a sales call.\nYou already showed up to the workshop.\nNow finish what you started 😊" },
          { k: "link", v: "https://straightupfitness.com/driven-woman-assessment-call", t: "Book my free assessment call" },
        ],
      },
      {
        slug: "replay",
        title: "Missed the workshop? Watch the replay",
        section: "After the workshop (missed it)",
        blocks: [
          { k: "h", v: "We missed you on the Workshop! 🙁" },
          { k: "p", v: "But you're here now, so let's watch the Replay." },
          { k: "video", v: "https://youtu.be/Z5gxRCZIuC0" },
          { k: "p", v: "And when you finish and think:\n\"Ok, I get it - I want to do this\"\nThen schedule a free assessment call with me here:" },
          { k: "link", v: "https://straightupfitness.com/driven-woman-assessment-call", t: "Book my free assessment call" },
        ],
      },
    ],
  },
];
