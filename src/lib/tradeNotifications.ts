import { Trade } from '@/models/Trade';
import type { ITrade } from '@/models/Trade';
import type { IUser } from '@/models/User';
import { User } from '@/models/User';
import connectDB from '@/lib/db';

/**
 * Check if a webhook URL supports embeds (Discord and Whop both support embeds)
 */
function supportsEmbeds(url: string): boolean {
  try {
    const urlObj = new URL(url);
    // Both Discord and Whop webhooks support embeds
    return urlObj.hostname.includes('discord.com') || 
           urlObj.hostname.includes('discordapp.com') ||
           urlObj.hostname.includes('whop.com');
  } catch {
    return false;
  }
}

/**
 * Parse message text into Discord embed structure
 */
function parseMessageToEmbed(message: string): {
  title: string;
  description?: string;
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  color?: number;
  footer?: { text: string };
} | null {
  const lines = message.split('\n').filter(line => line.trim());
  if (lines.length === 0) return null;

  // Extract title (first line with emoji and bold)
  const titleLine = lines[0];
  const titleMatch = titleLine.match(/^([🆕✏️🗑️✅❌➖⚪⏳])\s*\*\*(.+?)\*\*/);
  const title = titleMatch ? titleMatch[2] : titleLine.replace(/\*\*/g, '').trim();
  
  // Determine color based on emoji/type
  let color: number | undefined;
  if (titleLine.includes('🆕')) color = 0x6366f1; // Indigo for new
  else if (titleLine.includes('✏️')) color = 0xf59e0b; // Amber for update
  else if (titleLine.includes('🗑️')) color = 0xef4444; // Red for delete
  else if (titleLine.includes('✅')) color = 0x10b981; // Green for win
  else if (titleLine.includes('❌')) color = 0xef4444; // Red for loss
  else if (titleLine.includes('➖')) color = 0x6b7280; // Gray for breakeven
  else color = 0x6366f1; // Default indigo

  // Parse fields from remaining lines
  const fields: Array<{ name: string; value: string; inline?: boolean }> = [];
  let currentSection: string | null = null;
  let currentSectionLines: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Check if this is a section header
    const isSectionHeader = line.endsWith(':') && 
      (line.split(':').length === 2) && 
      (i + 1 < lines.length && lines[i + 1]?.trim().startsWith('•'));
    
    if (isSectionHeader) {
      if (currentSection && currentSectionLines.length > 0) {
        fields.push({
          name: currentSection,
          value: currentSectionLines.join('\n'),
          inline: false,
        });
      }
      currentSection = line.slice(0, -1).trim();
      currentSectionLines = [];
      continue;
    }

    // Check if this is a key-value pair
    const kvMatch = line.match(/^([^:•]+?):\s*(.+)$/);
    if (kvMatch && !line.startsWith('•')) {
      const key = kvMatch[1].trim();
      const value = kvMatch[2].trim();
      
      if (key === 'User' || key === 'Trade' || key === 'Contract') {
        fields.push({
          name: key,
          value: value.replace(/\*\*/g, ''),
          inline: key !== 'Trade' && key !== 'Contract',
        });
      } else if (key === 'Fill Price' || key === 'Contracts' || key === 'Notional' || key === 'P&L') {
        fields.push({
          name: key,
          value: value.replace(/\*\*/g, ''),
          inline: true,
        });
      } else {
        fields.push({
          name: key,
          value: value.replace(/\*\*/g, ''),
          inline: false,
        });
      }
    } else if (line.startsWith('•')) {
      const cleanLine = line.replace(/^•\s*/, '').replace(/\*\*/g, '');
      if (currentSection) {
        currentSectionLines.push(cleanLine);
      } else {
        fields.push({
          name: '\u200b',
          value: cleanLine,
          inline: false,
        });
      }
    } else {
      if (currentSection) {
        currentSectionLines.push(line.replace(/\*\*/g, ''));
      } else {
        fields.push({
          name: '\u200b',
          value: line.replace(/\*\*/g, ''),
          inline: false,
        });
      }
    }
  }

  if (currentSection && currentSectionLines.length > 0) {
    fields.push({
      name: currentSection,
      value: currentSectionLines.join('\n'),
      inline: false,
    });
  }

  const result: {
    title: string;
    description?: string;
    fields?: Array<{ name: string; value: string; inline?: boolean }>;
    color?: number;
    footer?: { text: string };
  } = {
    title,
    color,
  };

  if (fields.length === 0) {
    result.description = message.replace(/\*\*/g, '');
  } else {
    result.fields = fields;
  }

  return result;
}

/**
 * Send message via webhook (works for both Discord and Whop webhooks)
 */
async function sendWebhookMessage(message: string, webhookUrl: string, imageUrl?: string): Promise<void> {
  if (!webhookUrl || !message.trim()) {
    return;
  }

  try {
    const useEmbeds = supportsEmbeds(webhookUrl);
    
    let payload: { content?: string; embeds?: Array<unknown> };
    
    if (useEmbeds) {
      const embed = parseMessageToEmbed(message);
      
      if (embed) {
        const embedPayload: {
          title: string;
          description?: string;
          fields?: Array<{ name: string; value: string; inline?: boolean }>;
          color?: number;
          footer?: { text: string };
          image?: { url: string };
          timestamp: string;
        } = {
          title: embed.title,
          timestamp: new Date().toISOString(),
        };

        if (embed.description) {
          embedPayload.description = embed.description;
        }
        if (embed.fields && embed.fields.length > 0) {
          embedPayload.fields = embed.fields;
        }
        if (embed.color) {
          embedPayload.color = embed.color;
        }
        if (embed.footer) {
          embedPayload.footer = embed.footer;
        }
        if (imageUrl) {
          embedPayload.image = { url: imageUrl };
        }

        payload = {
          embeds: [embedPayload],
        };
      } else {
        payload = { content: message };
      }
    } else {
      payload = { content: message };
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok || response.status === 204) {
      return;
    }
  } catch {
    // Silently fail
  }
}

/**
 * Send message to a specific user's webhooks
 * 
 * @param message - The formatted message to send
 * @param user - The user to send the message to (must be owner or admin)
 * @param imageUrl - Optional image URL to include in the embed
 * @param selectedWebhookIds - Optional array of webhook IDs to send to. If undefined or empty, sends to all webhooks
 */
async function sendMessageToUser(
  message: string, 
  user: IUser | null | undefined, 
  imageUrl?: string,
  selectedWebhookIds?: string[]
): Promise<void> {
  if (!user || (user.role !== 'companyOwner' && user.role !== 'owner' && user.role !== 'admin')) {
    return;
  }

  try {
    const webhookPromises: Promise<void>[] = [];
    const availableWebhooks = user.webhooks || [];
    
    // If no webhooks configured, don't send
    if (availableWebhooks.length === 0) {
      return;
    }

    // If selectedWebhookIds is explicitly provided (even if empty array), use it
    // If undefined, send to all webhooks (for backward compatibility)
    let webhooksToUse: typeof availableWebhooks;
    if (selectedWebhookIds !== undefined) {
      // Explicit selection (could be empty array - don't send)
      if (selectedWebhookIds.length === 0) {
        return;
      }
      // Filter to only selected webhooks
      webhooksToUse = availableWebhooks.filter((webhook) => selectedWebhookIds.includes(webhook.id));
    } else {
      // Undefined means backward compatibility - send to all webhooks
      webhooksToUse = availableWebhooks;
    }

    // Send to selected webhooks
    webhooksToUse.forEach((webhook) => {
      webhookPromises.push(sendWebhookMessage(message, webhook.url, imageUrl));
    });

    // Send to all configured webhooks in parallel
    // Use Promise.allSettled so if one fails, the others still work
    if (webhookPromises.length > 0) {
      await Promise.allSettled(webhookPromises);
    }
  } catch {
    // Silently fail to prevent breaking trade operations
  }
}

function formatDate(date: Date): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(date);
  } catch {
    return date.toISOString();
  }
}

function formatTradeLabel(trade: ITrade): string {
  const expiry = new Date(trade.expiryDate);
  const expiryStr = `${expiry.getMonth() + 1}/${expiry.getDate()}/${expiry.getFullYear()}`;
  const optionLabel = trade.optionType === 'C' ? 'CALL' : 'PUT';
  return `${trade.contracts}x ${trade.ticker} ${trade.strike}${trade.optionType} ${expiryStr}`;
}

function formatUser(user?: IUser | null): string {
  if (!user) return 'Unknown trader';
  return user.alias || user.whopDisplayName || user.whopUsername || user.whopUserId || 'Unknown trader';
}

function formatNotional(notional: number): string {
  return `$${notional.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export async function notifyTradeCreated(trade: ITrade, user?: IUser | null, _companyId?: string, selectedWebhookIds?: string[]): Promise<void> {
  if (!user || (user.role !== 'companyOwner' && user.role !== 'owner' && user.role !== 'admin')) {
    return;
  }

  const messageLines = [
    '🆕 **Trade Created**',
    `User: ${formatUser(user)}`,
    `Trade: ${formatTradeLabel(trade)}`,
    `Contracts: ${trade.contracts}`,
    `Fill Price: $${trade.fillPrice.toFixed(2)}`,
    `Notional: ${formatNotional(trade.contracts * trade.fillPrice * 100)}`,
    `Created: ${formatDate(new Date(trade.createdAt))}`,
  ];

  if (trade.status === 'REJECTED') {
    messageLines.push(`Status: REJECTED (Price verification failed)`);
  }

  // For trade creation: if selectedWebhookIds is undefined, send to all webhooks (backward compatibility)
  // If it's an empty array, don't send (explicitly no webhooks selected)
  await sendMessageToUser(messageLines.join('\n'), user, undefined, selectedWebhookIds);
}

export async function notifyTradeDeleted(trade: ITrade, user?: IUser | null, selectedWebhookIds?: string[]): Promise<void> {
  if (!user || (user.role !== 'companyOwner' && user.role !== 'owner' && user.role !== 'admin')) {
    return;
  }

  const message = [
    '🗑️ **Trade Deleted**',
    `User: ${formatUser(user)}`,
    `Trade: ${formatTradeLabel(trade)}`,
    `Contracts: ${trade.contracts}`,
    `Fill Price: $${trade.fillPrice.toFixed(2)}`,
  ].join('\n');

  await sendMessageToUser(message, user, undefined, selectedWebhookIds);
}

export async function notifyTradeSettled(trade: ITrade, fillContracts: number, fillPrice: number, user?: IUser | null): Promise<void> {
  let userForNotification = user;
  if (!userForNotification && trade.userId) {
    try {
      await connectDB();
      userForNotification = await User.findById(trade.userId).lean() as unknown as IUser | null;
    } catch {
      return;
    }
  }

  if (!userForNotification || (userForNotification.role !== 'companyOwner' && userForNotification.role !== 'owner' && userForNotification.role !== 'admin')) {
    return;
  }
  if (!userForNotification.notifyOnSettlement) {
    return;
  }

  // If onlyNotifyWinningSettlements is enabled, only send for winning trades
  if (userForNotification.onlyNotifyWinningSettlements && trade.outcome !== 'WIN') {
    return;
  }

  // Determine which webhook IDs to use for settlement notification
  // Priority: Use webhook IDs from trade creation (trade.selectedWebhookIds)
  // This ensures settlement notifications go to the same webhooks used at trade creation
  const webhookIdsToUse = trade.selectedWebhookIds && trade.selectedWebhookIds.length > 0
    ? trade.selectedWebhookIds
    : undefined; // If no webhooks were selected at creation, don't send settlement notification

  // Must have webhook IDs from trade creation to send settlement notification
  if (!webhookIdsToUse || webhookIdsToUse.length === 0) {
    return;
  }

  const outcomeEmoji: Record<string, string> = {
    WIN: '✅',
    LOSS: '❌',
    BREAKEVEN: '➖',
  };

  const outcome = trade.outcome || 'OPEN';
  const emoji = outcomeEmoji[outcome] || '⏳';

  const sellNotional = fillContracts * fillPrice * 100;
  const messageLines = [
    `${emoji} **Trade Settled – ${outcome}**`,
    `User: ${formatUser(userForNotification)}`,
    `Trade: ${formatTradeLabel(trade)}`,
    `Sell: ${fillContracts} contracts @ $${fillPrice.toFixed(2)}`,
    `Sell Notional: ${formatNotional(sellNotional)}`,
  ];

  if (trade.status === 'CLOSED' && trade.netPnl !== undefined) {
    messageLines.push(`Net P&L: ${trade.netPnl >= 0 ? '+' : ''}${formatNotional(trade.netPnl)}`);
  }

  if (trade.remainingOpenContracts > 0) {
    messageLines.push(`Remaining Contracts: ${trade.remainingOpenContracts}`);
  }

  // Send to the same webhooks that were used when the trade was created
  await sendMessageToUser(messageLines.join('\n'), userForNotification, undefined, webhookIdsToUse);
}

