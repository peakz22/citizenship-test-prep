# True North — Canadian Citizenship Test Prep

A mobile-first study app for the Canadian citizenship test. All questions are written from
[Discover Canada: The Rights and Responsibilities of Citizenship](https://www.canada.ca/en/immigration-refugees-citizenship/corporate/publications-manuals/discover-canada.html),
the official IRCC study guide — the only source the real test draws from.

**Unofficial study aid. Not affiliated with the Government of Canada / IRCC.**

## Features

- **Mock test** — 20 questions, 30-minute timer, 15/20 (75%) to pass, sampled across all
  chapters, no feedback until the end: the real test format.
- **Practice by chapter** — instant right/wrong feedback with an explanation after every
  answer (retrieval practice + immediate feedback).
- **Smart review** — Leitner-style spaced repetition. Misses reset to box 0; correct answers
  graduate through 1 → 2 → 4 → 7-day intervals. The Review tab badge shows what's due.
- **Flashcards** — tap to flip, self-grade; feeds the same review schedule.
- **Progress dashboard** — readiness score, per-chapter mastery, mock test history, daily
  streak, countdown to your test date.
- **PWA** — installable on a phone home screen, works offline, dark mode.

## Notes on accuracy

Questions are faithful to the guide's text (the edition the test is based on), including a
few facts that are dated in the real world (e.g., the guide's references to the Queen and
the G8). The citizenship test is scored against the guide, so study the guide's answers.

Progress is stored only in your browser (localStorage) — no account, no server.
