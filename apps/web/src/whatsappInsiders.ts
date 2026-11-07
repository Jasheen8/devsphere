const OFFICIAL_WHATSAPP_CHANNEL_URL =
  "https://whatsapp.com/channel/0029VbD3hYGKrWQq3itzyH1o";

const configuredChannelUrl = import.meta.env.VITE_WHATSAPP_CHANNEL_URL?.trim();

function getChannelUrl(value?: string) {
  if (!value) return OFFICIAL_WHATSAPP_CHANNEL_URL;
  try {
    const parsed = new URL(value);
    if (
      parsed.protocol === "https:" &&
      ["whatsapp.com", "www.whatsapp.com"].includes(parsed.hostname)
    ) {
      return parsed.toString();
    }
  } catch {
    // Keep the supplied official channel URL when an override is malformed.
  }
  return OFFICIAL_WHATSAPP_CHANNEL_URL;
}

export const WHATSAPP_INSIDERS_CHANNEL_URL = getChannelUrl(configuredChannelUrl);
