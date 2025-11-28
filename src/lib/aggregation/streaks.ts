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
  if (mostRecentOutcome === 'WIN' || mostRecentOutcome === 'LOSS') {
    let streakCount = 0;
    for (const entry of normalized) {
      if (entry.outcome === mostRecentOutcome) {
        streakCount += 1;
      } else if (entry.outcome === 'BREAKEVEN') {
        break;
      } else {
        break;
      }
    }
    current = mostRecentOutcome === 'WIN' ? streakCount : -streakCount;
  }

  let maxWin = 0;
  let maxLoss = 0;
  let winStreak = 0;
  let lossStreak = 0;

  for (let i = normalized.length - 1; i >= 0; i -= 1) {
    const outcome = normalized[i].outcome;
    if (outcome === 'WIN') {
      winStreak += 1;
      lossStreak = 0;
      if (winStreak > maxWin) {
        maxWin = winStreak;
      }
    } else if (outcome === 'LOSS') {
      lossStreak += 1;
      winStreak = 0;
      if (lossStreak > maxLoss) {
        maxLoss = lossStreak;
      }
    } else if (outcome === 'BREAKEVEN') {
      winStreak = 0;
      lossStreak = 0;
    } else {
      winStreak = 0;
      lossStreak = 0;
    }
  }

  let longest = 0;
  if (maxWin > maxLoss) {
    longest = maxWin;
  } else if (maxLoss > maxWin) {
    longest = -maxLoss;
  } else if (maxWin > 0) {
    longest = maxWin;
  } else if (maxLoss > 0) {
    longest = -maxLoss;
  }

  return { current, longest };
};


