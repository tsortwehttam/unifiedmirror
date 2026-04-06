import type { AsanaMetadata, Participant, UnifiedAttachment, UnifiedMessage } from "../../types"

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

function toParticipant(user: AsanaUser): Participant {
  return { address: user.gid, name: user.name }
}

export function toUnifiedMessage(task: AsanaTask): UnifiedMessage {
  let projectGids = task.memberships
    .map(m => m.project?.gid)
    .filter((gid): gid is string => !!gid)

  let sectionGid = task.memberships
    .map(m => m.section?.gid)
    .find((gid): gid is string => !!gid)

  let from: Participant | undefined = task.created_by ? toParticipant(task.created_by) : undefined
  let to: Participant[] = task.assignee ? [toParticipant(task.assignee)] : []
  let assigneeGid = task.assignee?.gid
  let cc: Participant[] = task.followers
    .filter(f => f.gid !== assigneeGid)
    .map(toParticipant)

  let attachments: UnifiedAttachment[] = task.attachments.map(a => ({
    id: a.gid,
    filename: a.name,
    mimeType: a.content_type,
    sizeBytes: a.size,
    url: a.download_url,
  }))

  let threadId = task.parent?.gid ?? projectGids[0]

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
    id: task.gid,
    platform: "asana",
    timestamp: task.created_at,
    subject: task.name,
    bodyText: task.notes,
    bodyHtml: task.html_notes,
    from,
    to,
    cc,
    bcc: [],
    attachments,
    threadId,
    platformMetadata: metadata,
  }
}

export function commentToUnifiedMessage(story: AsanaStory, taskGid: string, taskName: string): UnifiedMessage {
  let from: Participant | undefined = story.created_by ? toParticipant(story.created_by) : undefined

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
    id: `comment:${story.gid}`,
    platform: "asana",
    timestamp: story.created_at,
    subject: taskName,
    bodyText: story.text,
    bodyHtml: story.html_text,
    from,
    to: [],
    cc: [],
    bcc: [],
    attachments: [],
    threadId: taskGid,
    platformMetadata: metadata,
  }
}
