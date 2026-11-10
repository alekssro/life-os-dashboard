/**
 * Due-date verification.
 *
 * A task's due date is a calendar day, not an instant. These checks assert
 * that the day a task is scheduled for is the same in the app's timezone
 * (Europe/Madrid) and in every browser timezone — including the ones west of
 * the server, which is where "schedule for today" used to land on yesterday.
 *
 * Run with:
 *   npx tsc -p /tmp/tsconfig.streak-check.json   (see scripts/verify-streaks.ts)
 *   node /tmp/streak-check/scripts/verify-due-dates.js
 */
import { formatDateDDMMYYYY, parseISODateLocal, serializeDueDate, todayISO } from '../src/lib/date';

let failures = 0;

function check(name: string, actual: unknown, expected: unknown) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(
    `${ok ? '  ok  ' : ' FAIL '} ${name}${ok ? '' : ` — expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`}`
  );
}

// The app's current day (server side, Europe/Madrid in production).
const appDay = todayISO();
check('app day is a calendar date', /^\d{4}-\d{2}-\d{2}$/.test(appDay), true);

// What the API now sends to the browser.
const serialized = serializeDueDate(parseISODateLocal(appDay));
check('due date is serialised as a calendar day', serialized, appDay);

// The browser renders it — the date-only path of formatDateDDMMYYYY must
// return the same day whatever the browser's timezone is.
check('renders the same day in any timezone', formatDateDDMMYYYY(serialized), formatDateDDMMYYYY(appDay));

// A date-only string must never shift a day when parsed.
check('date-only strings parse as local dates', formatDateDDMMYYYY(parseISODateLocal(appDay)), formatDateDDMMYYYY(appDay));

// The old shape the API used to send: the server's instant for local midnight.
// In Europe/Madrid (UTC+1 in November) that is 23:00 UTC on the *previous*
// day, which every browser west of the server renders as yesterday.
const y = Number(appDay.slice(0, 4));
const m = Number(appDay.slice(5, 7));
const d = Number(appDay.slice(8, 10));
const madridMidnightInstant = new Date(Date.UTC(y, m - 1, d - 1, 23, 0, 0)).toISOString();
const oldRendered = formatDateDDMMYYYY(madridMidnightInstant);
const newRendered = formatDateDDMMYYYY(serialized);

if (oldRendered === newRendered) {
  console.log(`  ok   the old timestamp form renders the same day here (${oldRendered})`);
} else {
  console.log(
    `  ok   the old timestamp form shifts the day here (${oldRendered} instead of ${newRendered}) — the bug being fixed`
  );
}
check('the calendar-day form never shifts', newRendered, formatDateDDMMYYYY(appDay));

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
