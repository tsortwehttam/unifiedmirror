import type { AsanaMetadata, UnifiedAttachment, UnifiedParty, UnifiedRecord } from "../../types"
import { buildRecordId, dedupeParties, trimSummary } from "../PlatformUtils"

export type AsanaUser = {
  gid: string
  name: string | undefined
}

export type AsanaAttachment = {
  gid: string
  name: string
  resource_type: string
  host: string | undefined
  download_url: string | undefined
  size: number | undefined
  content_type: string | undefined
}

export type AsanaCustomField = {
  gid: string
  name: string
  display_value: string | undefined
}

export type AsanaMembership = {
  project: { gid: string; name: string } | undefined
  section: { gid: string; name: string } | undefined
}

export type AsanaTask = {
  gid: string
  name: string
  notes: string | undefined
  html_notes: string | undefined
  created_at: string
  modified_at: string | undefined
  created_by: AsanaUser | undefined
  assignee: AsanaUser | undefined
  followers: AsanaUser[]
  attachments: AsanaAttachment[]
  parent: { gid: string } | undefined
  memberships: AsanaMembership[]
  completed: boolean
  due_on: string | undefined
  permalink_url: string | undefined
  custom_fields: AsanaCustomField[]
}

export type AsanaStory = {
  gid: string
  created_at: string
  created_by: AsanaUser | undefined
  text: string | undefined
  html_text: string | undefined
  type: string
  resource_subtype: string | undefined
}

function toParty(user: AsanaUser, role: string): UnifiedParty {
  return { id: user.gid, address: user.gid, name: user.name, role }
}

export function toUnifiedRecord(task: AsanaTask, account: string): UnifiedRecord {
  let projectGids = task.memberships
    .map(m => m.project?.gid)
    .filter((gid): gid is string => !!gid)

  let sectionGid = task.memberships
    .map(m => m.section?.gid)
    .find((gid): gid is string => !!gid)

  let from: UnifiedParty | undefined = task.created_by ? toParty(task.created_by, "creator") : undefined
  let to: UnifiedParty[] = task.assignee ? [toParty(task.assignee, "assignee")] : []
  let assigneeGid = task.assignee?.gid
  let cc: UnifiedParty[] = task.followers
    .filter(f => f.gid !== assigneeGid)
    .map(user => toParty(user, "follower"))

  let attachments: UnifiedAttachment[] = task.attachments.map(a => ({
    id: a.gid,
    filename: a.name,
    mimeType: a.content_type,
    sizeBytes: a.size,
    url: a.download_url,
  }))

  let threadId = buildRecordId("asana", account, "task", "thread", task.parent?.gid ?? projectGids[0] ?? task.gid)

  let metadata: AsanaMetadata = {
    platform: "asana",
    taskGid: task.gid,
    projectGids,
    sectionGid,
    parentTaskGid: task.parent?.gid,
    status: task.completed ? "complete" : "incomplete",
    dueOn: task.due_on,
    permalink: task.permalink_url,
    customFields: task.custom_fields.map(cf => ({
      gid: cf.gid,
      name: cf.name,
      displayValue: cf.display_value,
    })),
  }

  return {
    id: buildRecordId("asana", account, "task", task.gid),
    kind: "task",
    platform: "asana",
    account,
    timestamp: task.created_at,
    timestamps: {
      created: task.created_at,
      updated: task.modified_at,
      occurred: task.created_at,
      sent: undefined,
      received: undefined,
    },
    subject: task.name,
    summary: trimSummary(task.notes ?? task.name),
    bodyText: task.notes,
    bodyHtml: task.html_notes,
    from,
    to,
    cc,
    bcc: [],
    participants: dedupeParties([from, ...to, ...cc]),
    attachments,
    amounts: [],
    tags: [],
    status: task.completed ? "complete" : "incomplete",
    url: task.permalink_url,
    threadId,
    parentId: task.parent?.gid ? buildRecordId("asana", account, "task", task.parent.gid) : undefined,
    platformMetadata: metadata,
  }
}

export function commentToUnifiedRecord(story: AsanaStory, taskGid: string, taskName: string, account: string): UnifiedRecord {
  let from: UnifiedParty | undefined = story.created_by ? toParty(story.created_by, "author") : undefined

  let metadata: AsanaMetadata = {
    platform: "asana",
    taskGid,
    projectGids: [],
    sectionGid: undefined,
    parentTaskGid: undefined,
    status: undefined,
    dueOn: undefined,
    permalink: undefined,
    customFields: [],
  }

  return {
    id: buildRecordId("asana", account, "comment", story.gid),
    kind: "comment",
    platform: "asana",
    account,
    timestamp: story.created_at,
    timestamps: {
      created: story.created_at,
      updated: undefined,
      occurred: story.created_at,
      sent: undefined,
      received: undefined,
    },
    subject: taskName,
    summary: trimSummary(story.text ?? taskName),
    bodyText: story.text,
    bodyHtml: story.html_text,
    from,
    to: [],
    cc: [],
    bcc: [],
    participants: dedupeParties([from]),
    attachments: [],
    amounts: [],
    tags: [],
    status: undefined,
    url: undefined,
    threadId: buildRecordId("asana", account, "task", "thread", taskGid),
    parentId: buildRecordId("asana", account, "task", taskGid),
    platformMetadata: metadata,
  }
}
