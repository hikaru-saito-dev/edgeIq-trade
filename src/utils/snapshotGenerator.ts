export interface TradeSnapshotData {
  result: 'WIN' | 'LOSS' | 'BREAKEVEN' | 'PENDING' | 'OPEN';
  pnl: number; // Net P&L in dollars
  ticker: string;
  strike: number;
  optionType: 'C' | 'P';
  expiryDate: string | Date;
  contracts: number;
  entryPrice: number; // Entry price per contract
  notional?: number; // Optional override for notional (defaults to contracts * entryPrice * 100)
}

export interface StatsSnapshotData {
  type: 'personal' | 'company';
  winRate: number;
  roi: number;
  netPnl: number;
  totalTrades: number;
  wins: number;
  losses: number;
  breakevens?: number;
  currentStreak?: number;
  longestStreak?: number;
  userName?: string;
  companyName?: string;
}

/**
 * Load an image and return a Promise that resolves when loaded
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Load Poppins font
 */
async function loadPoppinsFont(): Promise<void> {
  return new Promise((resolve) => {
    if (document.fonts.check('1em Poppins')) {
      resolve();
      return;
    }

    const link = document.createElement('link');
    link.href = 'https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap';
    link.rel = 'stylesheet';
    document.head.appendChild(link);

    const font = new FontFace('Poppins', 'url(https://fonts.gstatic.com/s/poppins/v20/pxiEyp8kv8JHgFVrJJfecg.woff2)');
    font.load().then(() => {
      document.fonts.add(font);
      resolve();
    }).catch(() => {
      // Fallback if font fails to load
      resolve();
    });
  });
}

/**
 * Draw text with word-wrapping within a max width.
 * Returns the Y position after the last line.
 */
function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  color: string,
  font: string
): number {
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = font;
  ctx.textAlign = 'left';

  const words = text.split(/\s+/);
  let line = '';
  let currentY = y;

  for (let n = 0; n < words.length; n += 1) {
    const testLine = line.length === 0 ? words[n] : `${line} ${words[n]}`;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && n > 0) {
      ctx.fillText(line, x, currentY);
      line = words[n];
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }

  if (line.length > 0) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }

  ctx.restore();
  return currentY;
}

/**
 * Draw text that first attempts to fit on one line by reducing font size,
 * and if it still overflows, falls back to wrapping. Returns next Y.
 */
function drawFittedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  color: string,
  preferredFont: string,
  fallbackFont: string
): number {
  ctx.save();
  ctx.fillStyle = color;
  ctx.textAlign = 'left';

  // Try preferred font (e.g., 42px)
  ctx.font = preferredFont;
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    const sizeMatch = preferredFont.match(/(\d+)px/);
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 42;
    ctx.restore();
    return y + size + 6;
  }

  // Try fallback font (e.g., smaller size like 36px)
  ctx.font = fallbackFont;
  if (ctx.measureText(text).width <= maxWidth) {
    ctx.fillText(text, x, y);
    const sizeMatch = fallbackFont.match(/(\d+)px/);
    const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 36;
    ctx.restore();
    return y + size + 6;
  }

  // Still too long: wrap with fallback font
  const sizeMatch = fallbackFont.match(/(\d+)px/);
  const size = sizeMatch ? parseInt(sizeMatch[1], 10) : 36;
  const lineHeight = size + 6;
  const nextY = drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, color, fallbackFont);
  ctx.restore();
  return nextY;
}

/**
 * Generate a trade snapshot image
 */
export async function generateTradeSnapshot(trade: TradeSnapshotData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Load background image and font
  const [bgImage] = await Promise.all([
    loadImage('/snapshot-bg.png'),
    loadPoppinsFont(),
  ]);

  // Draw background (already contains branding)
  ctx.drawImage(bgImage, 0, 0, 1920, 1080);

  // Colors
  const greenColor = '#22c55e';
  const whiteColor = '#ffffff';
  const darkGrayColor = '#1a1a1a';

  // Result badge text
  const resultText = trade.result === 'WIN' ? 'WON'
    : trade.result === 'LOSS' ? 'LOST'
      : trade.result === 'BREAKEVEN' ? 'BREAKEVEN'
        : 'PENDING';
  ctx.fillStyle = whiteColor;
  ctx.font = 'bold 32px Poppins';
  ctx.textAlign = 'center';
  ctx.fillText(resultText, 960, 110);

  // PnL value (center, large)
  ctx.fillStyle = greenColor;
  ctx.font = 'bold 304px Poppins';
  ctx.textAlign = 'center';
  const pnlText = `${trade.pnl >= 0 ? '+' : ''}$${trade.pnl.toFixed(2)}`;
  ctx.fillText(pnlText, 960, 520);

  // Option/Trade details card positions
  const leftColX = 600;   // Left column X
  const rightColX = 970;  // Right column X
  const topRowY = 705;     // Top row Y
  const bottomRowY = 870;  // Bottom row Y
  const labelYOffset = -65;
  const valueYOffset = 10;

  const expiry = new Date(trade.expiryDate);
  const expiryStr = `${expiry.getMonth() + 1}/${expiry.getDate()}/${expiry.getFullYear()}`;
  const optionLabel = `${trade.ticker} ${trade.strike}${trade.optionType}`;
  const notional = trade.notional ?? trade.contracts * trade.entryPrice * 100;

  // Left top: Ticker/Strike
  ctx.fillStyle = greenColor;
  ctx.font = '600 32px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText('Ticker / Strike', leftColX, topRowY + labelYOffset);
  ctx.fillStyle = whiteColor;
  ctx.font = 'bold 64px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText(optionLabel, leftColX, topRowY + valueYOffset);

  // Right top: Expiry
  ctx.fillStyle = greenColor;
  ctx.font = '600 32px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText('Expiry', rightColX, topRowY + labelYOffset);
  ctx.fillStyle = whiteColor;
  ctx.font = 'bold 64px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText(expiryStr, rightColX, topRowY + valueYOffset);

  // Bottom Left: Contracts / Entry
  ctx.fillStyle = greenColor;
  ctx.font = '600 32px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText('Contracts', leftColX, bottomRowY + labelYOffset);
  ctx.fillStyle = whiteColor;
  ctx.font = 'bold 64px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText(`${trade.contracts} @ $${trade.entryPrice.toFixed(2)}`, leftColX, bottomRowY + valueYOffset);

  // Bottom Right: Notional
  ctx.fillStyle = greenColor;
  ctx.font = '600 32px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText('Notional', rightColX, bottomRowY + labelYOffset);
  ctx.fillStyle = whiteColor;
  ctx.font = 'bold 64px Poppins';
  ctx.textAlign = 'left';
  ctx.fillText(`$${notional.toFixed(2)}`, rightColX, bottomRowY + valueYOffset);

  // Subtitle with ticker for context (left side, below BET text in bg)
  const primaryFont = '400 42px Poppins';
  const fallbackFont = '400 36px Poppins';
  drawFittedText(ctx, `${trade.ticker} ${trade.strike}${trade.optionType}`, 118, 730, 400, greenColor, primaryFont, fallbackFont);
  drawFittedText(ctx, `Expires ${expiryStr}`, 118, 780, 400, greenColor, primaryFont, fallbackFont);

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/png');
  });
}

/**
 * Generate a stats snapshot image
 */
export async function generateStatsSnapshot(stats: StatsSnapshotData): Promise<Blob> {
  const canvas = document.createElement('canvas');
  canvas.width = 1920;
  canvas.height = 1080;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Failed to get canvas context');
  }

  // Load background image and font
  const [bgImage] = await Promise.all([
    loadImage('/snapshot-bg.png'),
    loadPoppinsFont(),
  ]);

  // Draw background (already contains branding)
  ctx.drawImage(bgImage, 0, 0, 1920, 1080);

  // Colors
  const greenColor = '#22c55e';
  const whiteColor = '#ffffff';

  // Header: WON/LOST badge text based on net P&L
  ctx.fillStyle = whiteColor;
  ctx.font = 'bold 32px Poppins';
  ctx.textAlign = 'center';
  ctx.fillText(stats.netPnl >= 0 ? 'WON' : 'LOST', 960, 110);

  // PnL value (large, centered)
  ctx.fillStyle = greenColor;
  ctx.font = 'bold 304px Poppins';
  ctx.textAlign = 'center';
  const pnlText = `${stats.netPnl >= 0 ? '+' : ''}$${stats.netPnl.toFixed(2)}`;
  ctx.fillText(pnlText, 960, 520);

  // Main stats cards (2x2 grid)
  const statsPositions = [
    { label: 'Win Rate', value: `${stats.winRate.toFixed(1)}%`, x: 600, labelY: 640, valueY: 710, color: greenColor },
    { label: 'ROI', value: `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(2)}%`, x: 970, labelY: 640, valueY: 710, color: stats.roi >= 0 ? greenColor : '#ef4444' },
    { label: 'Wins', value: `${stats.wins ?? 0}`, x: 600, labelY: 815, valueY: 885, color: stats.netPnl >= 0 ? greenColor : '#ef4444' },
    { label: 'Total Trades', value: `${stats.totalTrades}`, x: 970, labelY: 815, valueY: 885, color: greenColor },
  ];

  statsPositions.forEach((stat) => {
    ctx.fillStyle = whiteColor;
    ctx.font = '600 32px Poppins';
    ctx.textAlign = 'left';
    ctx.fillText(stat.label, stat.x, stat.labelY);

    ctx.fillStyle = stat.color;
    ctx.font = 'bold 64px Poppins';
    ctx.textAlign = 'left';
    ctx.fillText(stat.value, stat.x, stat.valueY);
  });

  const title = stats.type === 'personal'
    ? (stats.userName ? `${stats.userName} • Personal Stats` : 'Personal Stats')
    : (stats.companyName ? `${stats.companyName} • Company Stats` : 'Company Stats');
  drawFittedText(ctx, title, 118, 730, 400, greenColor, '400 42px Poppins', '400 36px Poppins');

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error('Failed to create blob'));
      }
    }, 'image/png');
  });
}

/**
 * Download a blob as a file
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

