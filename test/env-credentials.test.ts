import assert from "node:assert/strict"
import test from "node:test"
import {
  getGmailCredentialsFromEnv,
  getGmailTokenFromEnv,
  getMessagesConfigFromEnv,
  getSlackCredentialsFromEnv,
  getSlackTokenFromEnv,
} from "../src/config/envCredentials"

function withEnv(vars: Record<string, string | undefined>, fn: () => void) {
  let originals: Record<string, string | undefined> = {}
  for (let key of Object.keys(vars)) {
    originals[key] = process.env[key]
    if (vars[key] === undefined) delete process.env[key]
    else process.env[key] = vars[key]
  }
  try {
    fn()
  } finally {
    for (let key of Object.keys(originals)) {
      if (originals[key] === undefined) delete process.env[key]
      else process.env[key] = originals[key]
    }
  }
}

// Gmail credentials

test("getGmailCredentialsFromEnv returns undefined when no vars set", () => {
  withEnv({ UM_GMAIL_CLIENT_ID: undefined, UM_GMAIL_CLIENT_SECRET: undefined }, () => {
    assert.equal(getGmailCredentialsFromEnv(), undefined)
  })
})

test("getGmailCredentialsFromEnv returns credentials when both set", () => {
  withEnv({ UM_GMAIL_CLIENT_ID: "id1", UM_GMAIL_CLIENT_SECRET: "secret1", UM_GMAIL_REDIRECT_URI: "http://localhost" }, () => {
    let result = getGmailCredentialsFromEnv()
    assert.deepEqual(result, { client_id: "id1", client_secret: "secret1", redirect_uri: "http://localhost" })
  })
})

test("getGmailCredentialsFromEnv throws on partial config", () => {
  withEnv({ UM_GMAIL_CLIENT_ID: "id1", UM_GMAIL_CLIENT_SECRET: undefined }, () => {
    assert.throws(() => getGmailCredentialsFromEnv(), /UM_GMAIL_CLIENT_SECRET/)
  })
})

test("getGmailCredentialsFromEnv treats empty string as unset", () => {
  withEnv({ UM_GMAIL_CLIENT_ID: "", UM_GMAIL_CLIENT_SECRET: "" }, () => {
    assert.equal(getGmailCredentialsFromEnv(), undefined)
  })
})

// Gmail token

test("getGmailTokenFromEnv returns undefined when no vars set", () => {
  withEnv({ UM_GMAIL_ACCESS_TOKEN: undefined, UM_GMAIL_REFRESH_TOKEN: undefined }, () => {
    assert.equal(getGmailTokenFromEnv(), undefined)
  })
})

test("getGmailTokenFromEnv returns token when both set", () => {
  withEnv({ UM_GMAIL_ACCESS_TOKEN: "at", UM_GMAIL_REFRESH_TOKEN: "rt" }, () => {
    let result = getGmailTokenFromEnv()
    assert.deepEqual(result, { access_token: "at", refresh_token: "rt", token_type: "Bearer" })
  })
})

test("getGmailTokenFromEnv throws on partial config", () => {
  withEnv({ UM_GMAIL_ACCESS_TOKEN: "at", UM_GMAIL_REFRESH_TOKEN: undefined }, () => {
    assert.throws(() => getGmailTokenFromEnv(), /UM_GMAIL_REFRESH_TOKEN/)
  })
})

// Slack credentials

test("getSlackCredentialsFromEnv returns undefined when no vars set", () => {
  withEnv({ UM_SLACK_CLIENT_ID: undefined, UM_SLACK_CLIENT_SECRET: undefined }, () => {
    assert.equal(getSlackCredentialsFromEnv(), undefined)
  })
})

test("getSlackCredentialsFromEnv returns credentials when both set", () => {
  withEnv({ UM_SLACK_CLIENT_ID: "sid", UM_SLACK_CLIENT_SECRET: "ssec" }, () => {
    assert.deepEqual(getSlackCredentialsFromEnv(), { client_id: "sid", client_secret: "ssec" })
  })
})

test("getSlackCredentialsFromEnv throws on partial config", () => {
  withEnv({ UM_SLACK_CLIENT_ID: undefined, UM_SLACK_CLIENT_SECRET: "ssec" }, () => {
    assert.throws(() => getSlackCredentialsFromEnv(), /UM_SLACK_CLIENT_ID/)
  })
})

// Slack token

test("getSlackTokenFromEnv returns undefined when no vars set", () => {
  withEnv({ UM_SLACK_BOT_TOKEN: undefined }, () => {
    assert.equal(getSlackTokenFromEnv(), undefined)
  })
})

test("getSlackTokenFromEnv returns token when bot token set", () => {
  withEnv({ UM_SLACK_BOT_TOKEN: "xoxb-123", UM_SLACK_USER_TOKEN: "xoxp-456" }, () => {
    let result = getSlackTokenFromEnv()
    assert.equal(result!.bot_token, "xoxb-123")
    assert.equal(result!.user_token, "xoxp-456")
  })
})

test("getSlackTokenFromEnv works with bot token only", () => {
  withEnv({ UM_SLACK_BOT_TOKEN: "xoxb-123", UM_SLACK_USER_TOKEN: undefined }, () => {
    let result = getSlackTokenFromEnv()
    assert.equal(result!.bot_token, "xoxb-123")
    assert.equal(result!.user_token, undefined)
  })
})

// Messages config

test("getMessagesConfigFromEnv returns undefined when no vars set", () => {
  withEnv({ UM_MESSAGES_DB_PATH: undefined, UM_MESSAGES_ATTACHMENTS_ROOT: undefined, UM_MESSAGES_ME: undefined }, () => {
    assert.equal(getMessagesConfigFromEnv(), undefined)
  })
})

test("getMessagesConfigFromEnv returns config when db path set", () => {
  withEnv(
    {
      UM_MESSAGES_DB_PATH: "~/Library/Messages/chat.db",
      UM_MESSAGES_ATTACHMENTS_ROOT: "/tmp/messages-attachments",
      UM_MESSAGES_ME: "me@example.com",
    },
    () => {
      assert.deepEqual(getMessagesConfigFromEnv(), {
        db_path: "~/Library/Messages/chat.db",
        attachments_root: "/tmp/messages-attachments",
        me: "me@example.com",
      })
    },
  )
})
