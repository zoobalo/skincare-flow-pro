/**
 * Talking to a Google Apps Script web app.
 *
 * Apps Script intermittently answers with an HTML interstitial instead of the
 * script's JSON — on a cold start, or when Google briefly serves a redirect
 * page. Parsing that blindly surfaces "Unexpected token '<'" and loses the
 * request, so read as text, detect the page, and retry once.
 */

export type ScriptResponse = {
  error?: string;
  values?: string[][];
  appended?: number;
  skipped?: number;
  total?: number;
};

async function callOnce(url: string, body: unknown): Promise<ScriptResponse> {
  const res = await fetch(url, {
    method: "POST",
    redirect: "follow",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });

  const text = await res.text();
  if (text.trimStart().startsWith("<")) {
    throw new Error(
      "Google returned a web page instead of data. This is usually temporary — try again in a few seconds. " +
      "If it persists, redeploy the Apps Script with access set to \"Anyone\".",
    );
  }

  let json: ScriptResponse;
  try {
    json = JSON.parse(text) as ScriptResponse;
  } catch {
    throw new Error(`Unreadable response from the sheet (${res.status}): ${text.slice(0, 120)}`);
  }
  if (json.error) throw new Error(json.error);
  return json;
}

export async function callAppsScript(url: string, body: unknown): Promise<ScriptResponse> {
  try {
    return await callOnce(url, body);
  } catch {
    // One retry covers the transient interstitial; a second failure is real.
    await new Promise((r) => setTimeout(r, 1500));
    return await callOnce(url, body);
  }
}

/** Reads a script URL from the environment, with a message that says what to do. */
export function scriptUrlFromEnv(key: string, what: string): string {
  const url = process.env[key];
  if (!url) {
    throw new Error(
      `${key} is not set on the server. Deploy the Apps Script from the ${what} spreadsheet and set its /exec URL.`,
    );
  }
  return url;
}
