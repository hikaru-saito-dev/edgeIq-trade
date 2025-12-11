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
  profilePictureUrl?: string; // Creator's profile picture URL
  alias?: string; // Creator's alias
}

export interface StatsSnapshotData {
  type: 'personal' | 'company';
  winRate?: number;
  roi?: number;
  netPnl?: number;
  totalTrades?: number;
  wins?: number;
  losses?: number;
  breakevens?: number;
  currentStreak?: number;
  longestStreak?: number;
  userName?: string;
  companyName?: string;
  profilePictureUrl?: string; // User's or company owner's profile picture URL
  alias?: string; // User's or company owner's alias
}

/**
 * Load an image and return a Promise that resolves when loaded
 */
function resolveAssetUrl(src: string): string {
  // If absolute URL already, return as-is
  if (/^https?:\/\//i.test(src)) return src;
  // Prefer current origin so assets still load inside embeds/iframes
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${src.startsWith('/') ? src : `/${src}`}`;
  }
  return src;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  // Check if it's a cross-origin URL
  const isCrossOrigin = src.startsWith('http://') || src.startsWith('https://');
  
  if (isCrossOrigin) {
    // Fetch as blob to avoid CORS issues
    try {
      return fetch(src)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Failed to fetch image: ${response.statusText}`);
          }
          return response.blob();
        })
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          
          return new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
              URL.revokeObjectURL(blobUrl); // Clean up blob URL
              if (img.complete && img.naturalWidth > 0) {
                resolve(img);
              } else {
                reject(new Error('Image failed to load'));
              }
            };
            img.onerror = () => {
              URL.revokeObjectURL(blobUrl); // Clean up on error
              reject(new Error('Image load error'));
            };
            img.src = blobUrl;
          });
        });
    } catch (error) {
      return Promise.reject(new Error(`Failed to load image: ${error}`));
    }
  } else {
    // Same-origin image, load directly
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        if (img.complete && img.naturalWidth > 0) {
          resolve(img);
        } else {
          reject(new Error('Image failed to load'));
        }
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = resolveAssetUrl(src);
    });
  }
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
  fallbackFont: string,
  center: string
): number {
  ctx.save();
  ctx.fillStyle = color;
  if(center === "center") {
    ctx.textAlign = 'center'
  } else {
      ctx.textAlign = 'left';
  }

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

  // Normalize numbers
  const pnl = Number.isFinite(trade.pnl) ? (trade.pnl as number) : 0;
  const contracts = Number.isFinite(trade.contracts) ? (trade.contracts as number) : 0;
  const entryPrice = Number.isFinite(trade.entryPrice) ? (trade.entryPrice as number) : 0;
  const strike = Number.isFinite(trade.strike) ? (trade.strike as number) : 0;
  const notional = Number.isFinite(trade.notional) ? (trade.notional as number) : contracts * entryPrice * 100;

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
  const pnlText = `${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}`;
  drawFittedText(ctx, pnlText, 960, 520, 1800, greenColor, 'bold 304px Poppins', 'bold 150px Poppins','center');

  // Option/Trade details card positions
  const leftColX = 600;   // Left column X
  const rightColX = 970;  // Right column X
  const topRowY = 705;     // Top row Y
  const bottomRowY = 870;  // Bottom row Y
  const labelYOffset = -65;
  const valueYOffset = 10;

  const expiry = new Date(trade.expiryDate);
  const expiryStr = `${expiry.getMonth() + 1}/${expiry.getDate()}/${expiry.getFullYear()}`;
  const optionLabel = `${trade.ticker} ${strike}${trade.optionType}`;

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
  drawFittedText(ctx, `${trade.ticker} ${trade.strike}${trade.optionType}`, 118, 730, 400, greenColor, primaryFont, fallbackFont,'');
  drawFittedText(ctx, `Expires ${expiryStr}`, 118, 780, 400, greenColor, primaryFont, fallbackFont, '');

  // Draw profile picture and alias (bottom left area)
  if (trade.profilePictureUrl || trade.alias) {
    const profileX = 96;
    const profileY = 960; // Bottom left area
    const profileSize = 80; // Profile picture size
    let profileImageLoaded = false;

    // Draw profile picture if available
    const profileUrl = trade.profilePictureUrl?.trim();
    if (profileUrl && profileUrl.length > 0 && (profileUrl.startsWith('http://') || profileUrl.startsWith('https://'))) {
      try {
        const profileImg = await loadImage(profileUrl);
        if (profileImg && profileImg.complete && profileImg.naturalWidth > 0) {
          // Draw circular profile picture
          ctx.save();
          ctx.beginPath();
          ctx.arc(profileX + profileSize / 2, profileY + profileSize / 2, profileSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(profileImg, profileX, profileY, profileSize, profileSize);
          ctx.restore();
          profileImageLoaded = true;
        }
      } catch (error) {
        // Image failed to load, will use placeholder
      }
    }

    // Draw placeholder profile picture if image didn't load or no URL provided
    if (!profileImageLoaded) {
      // Create a placeholder circular profile picture
      ctx.save();
      ctx.fillStyle = greenColor;
      ctx.beginPath();
      ctx.arc(profileX + profileSize / 2, profileY + profileSize / 2, profileSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw alias next to profile picture
    if (trade.alias) {
      ctx.fillStyle = greenColor;
      ctx.font = 'bold 32px Poppins';
      ctx.textAlign = 'left';
      const aliasX = profileX + profileSize + 15; // 15px gap from profile picture
      const aliasY = profileY + profileSize / 2 + 10; // Vertically centered with profile picture
      drawFittedText(ctx, trade.alias, aliasX, aliasY, 350, greenColor, 'bold 32px Poppins', 'bold 28px Poppins', '');
    }
  }

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      // Fallback: use data URL if toBlob fails/returns null
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i += 1) {
          ia[i] = byteString.charCodeAt(i);
        }
        resolve(new Blob([ab], { type: 'image/png' }));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to create blob'));
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

  // Normalize numbers to avoid undefined/NaN
  const netPnl = Number.isFinite(stats.netPnl) ? (stats.netPnl as number) : 0;
  const roi = Number.isFinite(stats.roi) ? (stats.roi as number) : 0;
  const winRate = Number.isFinite(stats.winRate) ? (stats.winRate as number) : 0;
  const totalTrades = Number.isFinite(stats.totalTrades) ? (stats.totalTrades as number) : 0;
  const wins = Number.isFinite(stats.wins) ? (stats.wins as number) : 0;

  // Header: WON/LOST badge text based on net P&L
  ctx.fillStyle = whiteColor;
  ctx.font = 'bold 32px Poppins';
  ctx.textAlign = 'center';
  ctx.fillText(netPnl >= 0 ? 'WON' : 'LOST', 960, 110);

 
  const pnlText = `${netPnl >= 0 ? '+' : ''}$${netPnl.toFixed(2)}`;
  drawFittedText(ctx, pnlText, 960, 520, 1800, greenColor, 'bold 304px Poppins', 'bold 150px Poppins', 'center');

  // Main stats cards (2x2 grid)
  const statsPositions = [
    { label: 'Win Rate', value: `${winRate.toFixed(1)}%`, x: 600, labelY: 640, valueY: 710, color: greenColor },
    { label: 'ROI', value: `${roi >= 0 ? '+' : ''}${roi.toFixed(2)}%`, x: 970, labelY: 640, valueY: 710, color: roi >= 0 ? greenColor : '#ef4444' },
    { label: 'Wins', value: `${wins}`, x: 600, labelY: 815, valueY: 885, color: greenColor },
    { label: 'Total Trades', value: `${totalTrades}`, x: 970, labelY: 815, valueY: 885, color: greenColor },
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
  drawFittedText(ctx, title, 118, 730, 400, greenColor, '400 42px Poppins', '400 36px Poppins','');

  // Draw profile picture and alias (bottom left area)
  if (stats.profilePictureUrl || stats.alias) {
    const profileX = 96;
    const profileY = 960; // Bottom left area
    const profileSize = 80; // Profile picture size
    let profileImageLoaded = false;

    // Draw profile picture if available
    const profileUrl = stats.profilePictureUrl?.trim();
    if (profileUrl && profileUrl.length > 0 && (profileUrl.startsWith('http://') || profileUrl.startsWith('https://'))) {
      try {
        const profileImg = await loadImage(profileUrl);
        if (profileImg && profileImg.complete && profileImg.naturalWidth > 0) {
          // Draw circular profile picture
          ctx.save();
          ctx.beginPath();
          ctx.arc(profileX + profileSize / 2, profileY + profileSize / 2, profileSize / 2, 0, Math.PI * 2);
          ctx.clip();
          ctx.drawImage(profileImg, profileX, profileY, profileSize, profileSize);
          ctx.restore();
          profileImageLoaded = true;
        }
      } catch (error) {
        // Image failed to load, will use placeholder
      }
    }

    // Draw placeholder profile picture if image didn't load or no URL provided
    if (!profileImageLoaded) {
      // Create a placeholder circular profile picture
      ctx.save();
      ctx.fillStyle = greenColor;
      ctx.beginPath();
      ctx.arc(profileX + profileSize / 2, profileY + profileSize / 2, profileSize / 2, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Draw alias next to profile picture
    if (stats.alias) {
      ctx.fillStyle = greenColor;
      ctx.font = 'bold 32px Poppins';
      ctx.textAlign = 'left';
      const aliasX = profileX + profileSize + 15; // 15px gap from profile picture
      const aliasY = profileY + profileSize / 2 + 10; // Vertically centered with profile picture
      drawFittedText(ctx, stats.alias, aliasX, aliasY, 350, greenColor, 'bold 32px Poppins', 'bold 28px Poppins', '');
    }
  }

  // Convert to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
        return;
      }
      // Fallback: use data URL if toBlob fails/returns null
      try {
        const dataUrl = canvas.toDataURL('image/png');
        const byteString = atob(dataUrl.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i += 1) {
          ia[i] = byteString.charCodeAt(i);
        }
        resolve(new Blob([ab], { type: 'image/png' }));
      } catch (err) {
        reject(err instanceof Error ? err : new Error('Failed to create blob'));
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

