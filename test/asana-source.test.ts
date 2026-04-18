import assert from "node:assert/strict"
import test from "node:test"
import { listAsanaMessages } from "../src/platforms/asana/AsanaSource"

function buildTask(
  gid: string,
  name: string,
  createdAt: string,
  projectGid: string,
  modifiedAt = "2026-04-16T00:00:00.000Z",
) {
  return {
    gid,
    name,
    notes: `${name} notes`,
    html_notes: `<body>${name} notes</body>`,
    created_at: createdAt,
    modified_at: modifiedAt,
    created_by: { gid: "user-1", name: "User 1" },
    assignee: undefined,
    followers: [],
    attachments: [],
    parent: undefined,
    memberships: [{ project: { gid: projectGid, name: `Project ${projectGid}` }, section: undefined }],
    completed: false,
    due_on: undefined,
    permalink_url: `https://app.asana.com/0/${projectGid}/${gid}`,
    custom_fields: [],
  }
}

test("listAsanaMessages skips missing projects and continues", async t => {
  let oldFetch = global.fetch
  let oldPat = process.env.UNIFIEDMIRROR_ASANA_PAT
  let oldWorkspace = process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID

  process.env.UNIFIEDMIRROR_ASANA_PAT = "pat"
  process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID = "workspace"

  let urls: string[] = []

  global.fetch = (async input => {
    let url = String(input)
    urls.push(url)

    if (url.includes("/projects/project-a/tasks")) {
      return new Response(
        JSON.stringify({
          data: [buildTask("task-a", "Task A", "2026-04-15T00:00:00.000Z", "project-a")],
          next_page: undefined,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    if (url.includes("/projects/project-missing/tasks")) {
      return new Response(
        JSON.stringify({
          errors: [{ message: "project: Not a recognized ID: project-missing" }],
        }),
        { status: 404, headers: { "Content-Type": "application/json" } },
      )
    }

    if (url.includes("/projects/project-b/tasks")) {
      return new Response(
        JSON.stringify({
          data: [buildTask("task-b", "Task B", "2026-04-15T01:00:00.000Z", "project-b")],
          next_page: undefined,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    if (url.includes("/tasks/task-a/subtasks") || url.includes("/tasks/task-b/subtasks")) {
      return new Response(JSON.stringify({ data: [], next_page: undefined }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url.includes("/tasks/task-a/stories") || url.includes("/tasks/task-b/stories")) {
      return new Response(JSON.stringify({ data: [], next_page: undefined }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }) as typeof fetch

  t.after(() => {
    global.fetch = oldFetch
    if (oldPat === undefined) delete process.env.UNIFIEDMIRROR_ASANA_PAT
    else process.env.UNIFIEDMIRROR_ASANA_PAT = oldPat
    if (oldWorkspace === undefined) delete process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID
    else process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID = oldWorkspace
  })

  let rows = await listAsanaMessages({
    account: "default",
    query: "project-a, project-missing, project-b",
    preset: undefined,
    since: undefined,
    until: undefined,
    maxResults: 10,
    currentState: false,
    includeSubtasks: true,
    includeComments: true,
    verbose: false,
    onBatch: undefined,
  })

  assert.deepEqual(
    rows.map(row => row.subject),
    ["Task A", "Task B"],
  )
  assert.equal(urls.some(url => url.includes("/projects/project-missing/tasks")), true)
  assert.equal(urls.some(url => url.includes("/projects/project-b/tasks")), true)
})

test("listAsanaMessages currentState honors since locally using modified_at and still ignores maxResults", async t => {
  let oldFetch = global.fetch
  let oldPat = process.env.UNIFIEDMIRROR_ASANA_PAT
  let oldWorkspace = process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID

  process.env.UNIFIEDMIRROR_ASANA_PAT = "pat"
  process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID = "workspace"

  let urls: string[] = []

  global.fetch = (async input => {
    let url = String(input)
    urls.push(url)

    if (url.includes("/projects/project-a/tasks")) {
      return new Response(
        JSON.stringify({
          data: [
            buildTask("task-a", "Task A", "2026-04-01T00:00:00.000Z", "project-a"),
            buildTask("task-b", "Task B", "2026-04-02T00:00:00.000Z", "project-a", "2026-04-10T00:00:00.000Z"),
          ],
          next_page: undefined,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      )
    }

    if (url.includes("/tasks/task-a/subtasks") || url.includes("/tasks/task-b/subtasks")) {
      return new Response(JSON.stringify({ data: [], next_page: undefined }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    if (url.includes("/tasks/task-a/stories") || url.includes("/tasks/task-b/stories")) {
      return new Response(JSON.stringify({ data: [], next_page: undefined }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    }

    throw new Error(`Unexpected fetch URL: ${url}`)
  }) as typeof fetch

  t.after(() => {
    global.fetch = oldFetch
    if (oldPat === undefined) delete process.env.UNIFIEDMIRROR_ASANA_PAT
    else process.env.UNIFIEDMIRROR_ASANA_PAT = oldPat
    if (oldWorkspace === undefined) delete process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID
    else process.env.UNIFIEDMIRROR_ASANA_WORKSPACE_GID = oldWorkspace
  })

  let rows = await listAsanaMessages({
    account: "default",
    query: "project-a",
    preset: undefined,
    since: "2026-04-15T00:00:00.000Z",
    until: undefined,
    maxResults: 1,
    currentState: true,
    includeSubtasks: true,
    includeComments: true,
    verbose: false,
    onBatch: undefined,
  })

  assert.deepEqual(
    rows.map(row => row.subject),
    ["Task A"],
  )
  assert.equal(rows[0]?.timestamps.updated, "2026-04-16T00:00:00.000Z")
  assert.equal(
    urls.some(url => new URL(url).searchParams.has("completed_since")),
    false,
  )
  assert.equal(
    urls.some(url => new URL(url).searchParams.get("limit") === "1"),
    false,
  )
})
