require("dotenv").config();

const axios = require("axios");
const cron = require("node-cron");

// ===== CONFIG =====
const SAMPARK_USERNAME = process.env.SAMPARK_USERNAME;
const SAMPARK_PASSWORD = process.env.SAMPARK_PASSWORD;

const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

/**
 * Logs Axios (and other) errors with HTTP status and response body when available.
 *
 * @param {string} context Short label for each log line (e.g. `Sampark login`).
 * @param {unknown} err
 */
function logAxiosError(context, err) {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data;
    let dataStr;
    if (data !== undefined) {
      dataStr =
        typeof data === "object" ? JSON.stringify(data) : String(data);
    }
    console.error(`[${context}] Request failed`, {
      status: err.response?.status ?? null,
      statusText: err.response?.statusText ?? null,
      message: err.message,
      responseData: dataStr,
    });
    return;
  }
  console.error(`[${context}]`, err);
}

/**
 * Member shape returned by the Sampark birthdays API (fields vary by record).
 *
 * @typedef {object} BirthdayMember
 * @property {string} [firstName]
 * @property {string} [lastName]
 * @property {string} [name]
 */

// ===== API CALLS =====
/**
 * Logs in to Sampark and returns the session token from the response body.
 *
 * @returns {Promise<string|undefined>} Auth token, or undefined if not present or on request failure.
 */
async function getToken() {
  try {
    const res = await axios.post(
      "https://m.sampark369.org/v1/auth/user/login",
      {
        userName: SAMPARK_USERNAME,
        passCode: SAMPARK_PASSWORD,
        remember: "true",
      },
    );

    const token =
      res.data?.data?.token ||
      res.data?.token ||
      res.data?.result?.token;

    if (!token) {
      console.warn("[Sampark login] No token in response", {
        topLevelKeys:
          res.data && typeof res.data === "object"
            ? Object.keys(res.data)
            : typeof res.data,
      });
    }

    return token;
  } catch (err) {
    logAxiosError("Sampark login", err);
    return undefined;
  }
}

/**
 * Fetches today’s birthday list from the Sampark API.
 *
 * @param {string} token Session token from {@link getToken}.
 * @returns {Promise<BirthdayMember[]>} Array of members; empty if none, missing `data`, or on failure.
 */
async function getBirthdays(token) {
  try {
    const res = await axios.get(
      "https://m.sampark369.org/v1/sam2api/member/birthdays",
      {
        headers: {
          token: token,
        },
      },
    );

    return res.data?.data || [];
  } catch (err) {
    logAxiosError("Sampark birthdays", err);
    return [];
  }
}

// ===== MESSAGE FORMAT =====
/**
 * Builds the birthday greeting text sent to Telegram.
 *
 * @param {BirthdayMember[]|null|undefined} list Members with birthdays today.
 * @returns {string|null} Formatted message, or `null` if there is nothing to send.
 */
function formatMessage(list) {
  if (!list || !list.length) return null;

  const header =
    "Jai Swaminarayan\nDas na Das\n\nHappy Birthday to bhoolkus";

  const lines = list
    .map((p) => {
      const first = p.firstName || p.name || "Friend";
      const last = p.lastName || "";
      const name = [first, last].filter(Boolean).join(" bhai ");
      return `${name}`;
    })
    .join(" and ");

  return `${header} ${lines} 🎂🍰🎉🎊🥳`;
}

// ===== TELEGRAM SEND =====
/**
 * Sends plain text to the configured Telegram chat using the Bot API.
 *
 * @param {string} message Body to send as `text`.
 * @returns {Promise<boolean>} `true` if Telegram accepted the message, `false` on config or HTTP error.
 */
async function sendTelegramMessage(message) {
  if (!BOT_TOKEN || !CHAT_ID) {
    console.error(
      "[Telegram] BOT_TOKEN and CHAT_ID must be set in the environment",
    );
    return false;
  }

  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: CHAT_ID,
      text: message,
    });

    console.log("[Telegram] Message sent successfully");
    return true;
  } catch (err) {
    logAxiosError("Telegram sendMessage", err);
    return false;
  }
}

// ===== MAIN =====
/**
 * End-to-end job: login, load birthdays, format message, send via Telegram.
 * Logs errors to the console and exits early when credentials, token, or birthdays are missing.
 *
 * @returns {Promise<boolean>} `true` if the job finished without a hard failure; `false` on config, auth, send, or unexpected errors.
 */
async function run() {
  try {
    if (!SAMPARK_USERNAME || !SAMPARK_PASSWORD) {
      console.error("SAMPARK_USERNAME and SAMPARK_PASSWORD must be set in the environment");
      return false;
    }

    console.log("Running Birthday Job...");

    const token = await getToken();
    if (!token) {
      console.error(
        "[Birthday job] No Sampark session token (invalid credentials, API error, or unexpected response — see logs above)",
      );
      return false;
    }

    const list = await getBirthdays(token);

    const message = formatMessage(list);
    console.log(message);

    if (!message) {
      console.log("No birthdays today");
      return true;
    }

    const sent = await sendTelegramMessage(message);
    if (!sent) {
      console.error("[Birthday job] Telegram send failed");
      return false;
    }

    return true;
  } catch (err) {
    console.error("[Birthday job] Unexpected error:", err);
    return false;
  }
}

const isGitHubActions = process.env.GITHUB_ACTIONS === "true";

if (isGitHubActions) {
  run()
    .then((ok) => {
      process.exit(ok ? 0 : 1);
    })
    .catch((err) => {
      console.error("[Birthday job] Fatal:", err);
      process.exit(1);
    });
} else {
  // ===== CRON (Every 30 seconds) =====
  cron.schedule(
    "*/30 * * * * *",
    () => {
      run();
    },
    { timezone: "Asia/Kolkata" },
  );
}
