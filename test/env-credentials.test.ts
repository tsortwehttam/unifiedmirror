import assert from "node:assert/strict"
import test from "node:test"
import {
  getGmailCredentialsFromEnv,
  getGmailTokenFromEnv,
  getMessagesConfigFromEnv,
  getShopifyCredentialsFromEnv,
  getShopifyTokenFromEnv,
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
  withEnv({ UNIFIEDMIRROR_GMAIL_CLIENT_ID: undefined, UNIFIEDMIRROR_GMAIL_CLIENT_SECRET: undefined }, () => {
    assert.equal(getGmailCredentialsFromEnv(), undefined)
  })
})

test("getGmailCredentialsFromEnv returns credentials when both set", () => {
  withEnv({ UNIFIEDMIRROR_GMAIL_CLIENT_ID: "id1", UNIFIEDMIRROR_GMAIL_CLIENT_SECRET: "secret1", UNIFIEDMIRROR_GMAIL_REDIRECT_URI: "http://localhost" }, () => {
    let result = getGmailCredentialsFromEnv()
    assert.deepEqual(result, { client_id: "id1", client_secret: "secret1", redirect_uri: "http://localhost" })
  })
})

test("getGmailCredentialsFromEnv throws on partial config", () => {
  withEnv({ UNIFIEDMIRROR_GMAIL_CLIENT_ID: "id1", UNIFIEDMIRROR_GMAIL_CLIENT_SECRET: undefined }, () => {
    assert.throws(() => getGmailCredentialsFromEnv(), /UNIFIEDMIRROR_GMAIL_CLIENT_SECRET/)
  })
})

test("getGmailCredentialsFromEnv treats empty string as unset", () => {
  withEnv({ UNIFIEDMIRROR_GMAIL_CLIENT_ID: "", UNIFIEDMIRROR_GMAIL_CLIENT_SECRET: "" }, () => {
    assert.equal(getGmailCredentialsFromEnv(), undefined)
  })
})

// Gmail token

test("getGmailTokenFromEnv returns undefined when no vars set", () => {
  withEnv({ UNIFIEDMIRROR_GMAIL_ACCESS_TOKEN: undefined, UNIFIEDMIRROR_GMAIL_REFRESH_TOKEN: undefined }, () => {
    assert.equal(getGmailTokenFromEnv(), undefined)
  })
})

test("getGmailTokenFromEnv returns token when both set", () => {
  withEnv({ UNIFIEDMIRROR_GMAIL_ACCESS_TOKEN: "at", UNIFIEDMIRROR_GMAIL_REFRESH_TOKEN: "rt" }, () => {
    let result = getGmailTokenFromEnv()
    assert.deepEqual(result, { access_token: "at", refresh_token: "rt", token_type: "Bearer" })
  })
})

test("getGmailTokenFromEnv throws on partial config", () => {
  withEnv({ UNIFIEDMIRROR_GMAIL_ACCESS_TOKEN: "at", UNIFIEDMIRROR_GMAIL_REFRESH_TOKEN: undefined }, () => {
    assert.throws(() => getGmailTokenFromEnv(), /UNIFIEDMIRROR_GMAIL_REFRESH_TOKEN/)
  })
})

// Slack credentials

test("getSlackCredentialsFromEnv returns undefined when no vars set", () => {
  withEnv({ UNIFIEDMIRROR_SLACK_CLIENT_ID: undefined, UNIFIEDMIRROR_SLACK_CLIENT_SECRET: undefined }, () => {
    assert.equal(getSlackCredentialsFromEnv(), undefined)
  })
})

test("getSlackCredentialsFromEnv returns credentials when both set", () => {
  withEnv({ UNIFIEDMIRROR_SLACK_CLIENT_ID: "sid", UNIFIEDMIRROR_SLACK_CLIENT_SECRET: "ssec" }, () => {
    assert.deepEqual(getSlackCredentialsFromEnv(), { client_id: "sid", client_secret: "ssec" })
  })
})

test("getSlackCredentialsFromEnv throws on partial config", () => {
  withEnv({ UNIFIEDMIRROR_SLACK_CLIENT_ID: undefined, UNIFIEDMIRROR_SLACK_CLIENT_SECRET: "ssec" }, () => {
    assert.throws(() => getSlackCredentialsFromEnv(), /UNIFIEDMIRROR_SLACK_CLIENT_ID/)
  })
})

// Slack token

test("getSlackTokenFromEnv returns undefined when no vars set", () => {
  withEnv({ UNIFIEDMIRROR_SLACK_BOT_TOKEN: undefined }, () => {
    assert.equal(getSlackTokenFromEnv(), undefined)
  })
})

test("getSlackTokenFromEnv returns token when bot token set", () => {
  withEnv({ UNIFIEDMIRROR_SLACK_BOT_TOKEN: "xoxb-123", UNIFIEDMIRROR_SLACK_USER_TOKEN: "xoxp-456" }, () => {
    let result = getSlackTokenFromEnv()
    assert.equal(result!.bot_token, "xoxb-123")
    assert.equal(result!.user_token, "xoxp-456")
  })
})

test("getSlackTokenFromEnv works with bot token only", () => {
  withEnv({ UNIFIEDMIRROR_SLACK_BOT_TOKEN: "xoxb-123", UNIFIEDMIRROR_SLACK_USER_TOKEN: undefined }, () => {
    let result = getSlackTokenFromEnv()
    assert.equal(result!.bot_token, "xoxb-123")
    assert.equal(result!.user_token, undefined)
  })
})

// Shopify token

test("getShopifyTokenFromEnv returns undefined when no vars set", () => {
  withEnv({ UNIFIEDMIRROR_SHOPIFY_SHOP: undefined, UNIFIEDMIRROR_SHOPIFY_ACCESS_TOKEN: undefined }, () => {
    assert.equal(getShopifyTokenFromEnv(), undefined)
  })
})

test("getShopifyTokenFromEnv returns token when both set", () => {
  withEnv({ UNIFIEDMIRROR_SHOPIFY_SHOP: "store.myshopify.com", UNIFIEDMIRROR_SHOPIFY_ACCESS_TOKEN: "shpat_123" }, () => {
    assert.deepEqual(getShopifyTokenFromEnv(), {
      shop: "store.myshopify.com",
      access_token: "shpat_123",
    })
  })
})

test("getShopifyTokenFromEnv returns undefined when no access token is set", () => {
  withEnv({ UNIFIEDMIRROR_SHOPIFY_SHOP: "store.myshopify.com", UNIFIEDMIRROR_SHOPIFY_ACCESS_TOKEN: undefined }, () => {
    assert.equal(getShopifyTokenFromEnv(), undefined)
  })
})

test("getShopifyCredentialsFromEnv returns undefined when no vars set", () => {
  withEnv(
    {
      UNIFIEDMIRROR_SHOPIFY_SHOP: undefined,
      UNIFIEDMIRROR_SHOPIFY_CLIENT_ID: undefined,
      UNIFIEDMIRROR_SHOPIFY_CLIENT_SECRET: undefined,
    },
    () => {
      assert.equal(getShopifyCredentialsFromEnv(), undefined)
    },
  )
})

test("getShopifyCredentialsFromEnv returns credentials when all vars set", () => {
  withEnv(
    {
      UNIFIEDMIRROR_SHOPIFY_SHOP: "store.myshopify.com",
      UNIFIEDMIRROR_SHOPIFY_CLIENT_ID: "cid_123",
      UNIFIEDMIRROR_SHOPIFY_CLIENT_SECRET: "csec_123",
    },
    () => {
      assert.deepEqual(getShopifyCredentialsFromEnv(), {
        shop: "store.myshopify.com",
        client_id: "cid_123",
        client_secret: "csec_123",
      })
    },
  )
})

test("getShopifyCredentialsFromEnv throws when shop is missing", () => {
  withEnv(
    {
      UNIFIEDMIRROR_SHOPIFY_SHOP: undefined,
      UNIFIEDMIRROR_SHOPIFY_CLIENT_ID: "cid_123",
      UNIFIEDMIRROR_SHOPIFY_CLIENT_SECRET: "csec_123",
    },
    () => {
      assert.throws(() => getShopifyCredentialsFromEnv(), /UNIFIEDMIRROR_SHOPIFY_SHOP/)
    },
  )
})

test("getShopifyCredentialsFromEnv throws on partial credential config", () => {
  withEnv(
    {
      UNIFIEDMIRROR_SHOPIFY_SHOP: "store.myshopify.com",
      UNIFIEDMIRROR_SHOPIFY_CLIENT_ID: "cid_123",
      UNIFIEDMIRROR_SHOPIFY_CLIENT_SECRET: undefined,
    },
    () => {
      assert.throws(() => getShopifyCredentialsFromEnv(), /UNIFIEDMIRROR_SHOPIFY_CLIENT_SECRET/)
    },
  )
})

// Messages config

test("getMessagesConfigFromEnv returns undefined when no vars set", () => {
  withEnv({ UNIFIEDMIRROR_MESSAGES_DB_PATH: undefined, UNIFIEDMIRROR_MESSAGES_ATTACHMENTS_ROOT: undefined, UNIFIEDMIRROR_MESSAGES_ME: undefined }, () => {
    assert.equal(getMessagesConfigFromEnv(), undefined)
  })
})

test("getMessagesConfigFromEnv returns config when db path set", () => {
  withEnv(
      {
      UNIFIEDMIRROR_MESSAGES_DB_PATH: "~/Library/Messages/chat.db",
      UNIFIEDMIRROR_MESSAGES_ATTACHMENTS_ROOT: "/tmp/messages-attachments",
      UNIFIEDMIRROR_MESSAGES_ME: "me@example.com",
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
