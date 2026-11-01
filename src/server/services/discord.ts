import { log } from "../log.js";

const WEBHOOK = /^https:\/\/(?:canary\.|ptb\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[\w-]+$/;

export const isDiscordWebhook = (url: string) => WEBHOOK.test(url.trim());

/** Markdown-Steuerzeichen entfernen, damit Namen die Nachricht nicht verbiegen. */
const clean = (text: string) => text.replace(/[*_`~|@<>]/g, "").slice(0, 100);

export interface WebhookMessage {
  title: string;
  description?: string;
  fields?: { name: string; value: string; inline?: boolean }[];
  url?: string;
  mention?: string;
}

export const sendWebhook = async (webhook: string, message: WebhookMessage): Promise<boolean> => {
  if (!isDiscordWebhook(webhook)) return false;
  const mention = message.mention?.trim() ?? "";
  const body = {
    username: "Letopia",
    content: /^<@[&!]?\d+>$/.test(mention) ? mention : undefined,
    allowed_mentions: { parse: [] as string[], roles: [] as string[], users: [] as string[] },
    embeds: [
      {
        title: message.title.slice(0, 250),
        description: message.description?.slice(0, 2000),
        url: message.url,
        color: 0xf0a830,
        fields: message.fields?.slice(0, 10).map(f => ({ name: f.name.slice(0, 250), value: f.value.slice(0, 1000) || "–", inline: f.inline ?? true })),
        timestamp: new Date().toISOString()
      }
    ]
  };
  const roleMatch = mention.match(/^<@&(\d+)>$/);
  const userMatch = mention.match(/^<@!?(\d+)>$/);
  if (roleMatch?.[1]) body.allowed_mentions.roles.push(roleMatch[1]);
  if (userMatch?.[1]) body.allowed_mentions.users.push(userMatch[1]);

  try {
    const res = await fetch(webhook.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(5000)
    });
    if (!res.ok) log.warn(`Discord-Webhook antwortet mit HTTP ${res.status}`);
    return res.ok;
  } catch (error) {
    log.warn(`Discord-Webhook nicht erreichbar: ${(error as Error).message}`);
    return false;
  }
};

export const applicationMessage = (opts: { type: string; player: string; summary: string; adminUrl?: string; mention?: string }): WebhookMessage => ({
  title: `Neue ${opts.type}-Bewerbung`,
  description: `**${clean(opts.player)}**${opts.summary ? ` · ${clean(opts.summary)}` : ""}`,
  url: opts.adminUrl,
  mention: opts.mention
});
