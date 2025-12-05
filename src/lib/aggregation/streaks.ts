export const aggregationStreakFunction = function (trades: Array<{ outcome?: string; updatedAt?: Date | string; createdAt?: Date | string }>) {
  if (!Array.isArray(trades) || trades.length === 0) {
    return { current: 0, longest: 0 };
  }

  const normalized: Array<{ outcome?: string; date: Date }> = [];
  for (const trade of trades) {
    if (!trade) continue;
    const timestamp = (trade.updatedAt as Date | string | undefined) ?? (trade.createdAt as Date | string | undefined);
    if (!timestamp) continue;
    const parsedDate = new Date(timestamp);
    if (Number.isNaN(parsedDate.getTime())) continue;
    normalized.push({ outcome: trade.outcome, date: parsedDate });
  }

  if (normalized.length === 0) {
    return { current: 0, longest: 0 };
  }

  normalized.sort((a, b) => b.date.getTime() - a.date.getTime());

  let current = 0;
  const mostRecentOutcome = normalized[0].outcome;
  if (mostRecentOutcome === 'WIN') {
    let streakCount = 0;
    for (const entry of normalized) {
      if (entry.outcome === 'WIN') {
        streakCount += 1;
      } else {
        // LOSS, BREAKEVEN, or undefined breaks the streak
        break;
      }
    }
    current = streakCount;
  }

  let maxStreak = 0;
  let streak = 0;

  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const outcome = normalized[i].outcome;
    if (outcome === 'WIN') {
      streak += 1;
      if (streak > maxStreak) {
        maxStreak = streak;
      }
    } else {
      // LOSS, BREAKEVEN, or undefined breaks the streak
      streak = 0;
    }
  }

  return { current, longest: maxStreak };
};


