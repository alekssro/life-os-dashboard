/**
 * Streak engine verification.
 *
 * Run with:
 *   npx tsc scripts/verify-streaks.ts --outDir /tmp/streak-check --module esnext \
 *     --target es2020 --moduleResolution bundler --skipLibCheck
 *   node /tmp/streak-check/scripts/verify-streaks.js
 *
 * (The timezone case is meant to be run twice: once with TZ=Europe/Madrid and
 * once with TZ=America/New_York — log dates are plain YYYY-MM-DD strings and
 * must never shift a day.)
 */
import { computeStreak } from '../src/lib/streaks';
import { parseISODateLocal } from '../src/lib/date';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${name}${ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`);
}

const d = (iso: string) => parseISODateLocal(iso);
const daily = { frequency: 'DAILY', graceDays: 1 };
const weekly = { frequency: 'WEEKLY', daysOfWeek: '[1]', graceDays: 1 };
const monthly = { frequency: 'MONTHLY', dayOfMonth: 7, graceDays: 1 };

console.log('\n— daily habits —');
{
  // Two days in a row, today still open → the chain is alive but at risk.
  const s = computeStreak(daily, ['2026-11-08', '2026-11-09'], d('2026-11-10'));
  check('streak counts consecutive days', s.streak, 2);
  check('unit is days', s.unit, 'DAY');
  check('open period is at risk, not broken', s.atRisk, true);
  check('best streak', s.bestStreak, 2);
  check('label', s.label, '2 days');
  check('short label', s.shortLabel, '2d');
}
{
  // Today completed → today counts and there is no risk.
  const s = computeStreak(daily, ['2026-11-08', '2026-11-09', '2026-11-10'], d('2026-11-10'));
  check('completed today extends the streak', s.streak, 3);
  check('not at risk', s.atRisk, false);
  check('current period completed', s.completedCurrentPeriod, true);
}
{
  // One missed day (08/11) is covered by grace = 1, so the chain survives it:
  // 07/11, 09/11 and 10/11 are three completed days.
  const s = computeStreak(daily, ['2026-11-07', '2026-11-09', '2026-11-10'], d('2026-11-10'));
  check('grace covers a single missed day', s.streak, 3);
  check('grace is reported as used', s.graceUsed, 1);
  check('completed today → not at risk', s.atRisk, false);
}
{
  // Two missed days (07/11 + 08/11) exceed the grace window: the chain
  // restarts on 09/11, so 09/11 + 10/11 = 2 days.
  const s = computeStreak(daily, ['2026-11-06', '2026-11-09', '2026-11-10'], d('2026-11-10'));
  check('streak breaks beyond the grace window', s.streak, 2);
  check('the broken chain carries no grace', s.graceUsed, 0);
}
{
  // No grace at all: a single missed day breaks the chain. The habit was done
  // on 09/11 and today is still open, so the streak is 1 day and at risk.
  const s = computeStreak({ frequency: 'DAILY', graceDays: 0 }, ['2026-11-07', '2026-11-09'], d('2026-11-10'));
  check('grace = 0 breaks on the first miss', s.streak, 1);
  check('but today is open → at risk', s.atRisk, true);
}
{
  // A chain that was already broken has nothing left to protect.
  const s = computeStreak({ frequency: 'DAILY', graceDays: 0 }, ['2026-11-06'], d('2026-11-10'));
  check('broken chain → no streak', s.streak, 0);
  check('broken chain → not at risk', s.atRisk, false);
}
{
  // The best run is remembered even when the chain is broken.
  const s = computeStreak(daily, ['2026-11-01', '2026-11-02', '2026-11-03', '2026-11-09'], d('2026-11-10'));
  check('current streak', s.streak, 1);
  check('best streak keeps the longest run', s.bestStreak, 3);
}
{
  // Consistency is measured over closed periods only.
  const s = computeStreak(daily, ['2026-11-08', '2026-11-09'], d('2026-11-10'));
  check('consistency over the trailing window', s.consistencyScore, 100);
}

console.log('\n— weekly habits —');
{
  // Two Mondays in a row. Today (Wednesday) falls in the same week as the
  // 09/11 completion, so that week is already hit.
  const s = computeStreak(weekly, ['2026-11-02', '2026-11-09'], d('2026-11-11'));
  check('streak counts weeks', s.streak, 2);
  check('unit is weeks', s.unit, 'WEEK');
  check('label', s.label, '2 weeks');
  check('short label', s.shortLabel, '2w');
  check('the current week is already done', s.atRisk, false);
}
{
  // A habit with several days per week counts one completion per week.
  const multi = { frequency: 'WEEKLY', daysOfWeek: '[1,3,5]', graceDays: 1 };
  const s = computeStreak(multi, ['2026-11-02', '2026-11-09'], d('2026-11-11'));
  check('one completion per week is enough', s.streak, 2);
}
{
  // The week of 09/11 was missed but grace covers it; the week of 16/11 is
  // still running → the chain survives and is at risk.
  const s = computeStreak(weekly, ['2026-11-02'], d('2026-11-18'));
  check('a missed week covered by grace keeps the streak', s.streak, 1);
  check('the missed week is reported as grace', s.graceUsed, 1);
  check('at risk until the week closes', s.atRisk, true);
}
{
  // Without grace the missed week breaks the chain.
  const s = computeStreak({ frequency: 'WEEKLY', daysOfWeek: '[1]', graceDays: 0 }, ['2026-11-02'], d('2026-11-18'));
  check('a missed week breaks the streak', s.streak, 0);
}

console.log('\n— monthly habits —');
{
  // Two months completed, this month still open.
  const s = computeStreak(monthly, ['2026-09-07', '2026-10-07'], d('2026-11-10'));
  check('streak counts months', s.streak, 2);
  check('unit is months', s.unit, 'MONTH');
  check('label', s.label, '2 months');
  check('short label', s.shortLabel, '2mo');
  check('at risk until the month closes', s.atRisk, true);
}
{
  // This month completed too.
  const s = computeStreak(monthly, ['2026-09-07', '2026-10-07', '2026-11-07'], d('2026-11-10'));
  check('completed month extends the streak', s.streak, 3);
  check('not at risk', s.atRisk, false);
}

console.log('\n— edge cases —');
{
  // A habit with no history at all.
  const s = computeStreak(daily, [], d('2026-11-10'));
  check('no history → zero streak', s.streak, 0);
  check('no history → not at risk', s.atRisk, false);
}
{
  // Log dates are local calendar dates and must not shift a day.
  const s = computeStreak(daily, ['2026-11-10'], d('2026-11-10'));
  check('today counts as today (no UTC shift)', s.streak, 1);
  check('current period completed', s.completedCurrentPeriod, true);
}
{
  // A completion on the first day of a month belongs to that month.
  const first = { frequency: 'MONTHLY', dayOfMonth: 1, graceDays: 0 };
  const s = computeStreak(first, ['2026-09-01', '2026-10-01'], d('2026-11-10'));
  check('month boundaries line up', s.streak, 2);
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
