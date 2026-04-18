import type { AttachmentSelector, UnifiedRecord } from "../../types"
import { verboseLog } from "../../Verbose"
import { asanaClient, asanaFetch, asanaFetchOptional, type AsanaPage } from "./asanaClient"
import { toUnifiedRecord, commentToUnifiedRecord, type AsanaTask, type AsanaStory } from "./toUnifiedRecord"

const TASK_OPT_FIELDS = [
  "gid",
  "name",
  "notes",
  "html_notes",
  "created_at",
  "modified_at",
  "created_by.gid",
  "created_by.name",
  "assignee.gid",
  "assignee.name",
  "followers.gid",
  "followers.name",
  "attachments.gid",
  "attachments.name",
  "attachments.resource_type",
  "attachments.host",
  "attachments.download_url",
  "attachments.size",
  "attachments.content_type",
  "parent.gid",
  "memberships.project.gid",
  "memberships.project.name",
  "memberships.section.gid",
  "memberships.section.name",
  "completed",
  "due_on",
  "permalink_url",
  "custom_fields.gid",
  "custom_fields.name",
  "custom_fields.display_value",
].join(",")

const STORY_OPT_FIELDS = [
  "gid",
  "created_at",
  "created_by.gid",
  "created_by.name",
  "text",
  "html_text",
  "type",
  "resource_subtype",
].join(",")

async function fetchSubtasks(
  pat: string,
  taskGid: string,
  verbose: boolean,
): Promise<AsanaTask[]> {
  let subtasks: AsanaTask[] = []
  let offset: string | undefined = undefined
  while (true) {
    let params: Record<string, string> = { opt_fields: TASK_OPT_FIELDS, limit: "100" }
    if (offset) params.offset = offset
    let response = await asanaFetch<AsanaPage<AsanaTask>>(pat, `/tasks/${taskGid}/subtasks`, params, verbose)
    let batch: AsanaTask[] = response.data ?? []
    subtasks.push(...batch)
    offset = response.next_page?.offset
    if (!offset) break
  }
  verboseLog(verbose, "asana subtasks fetched", { taskGid, count: subtasks.length })
  return subtasks
}

async function fetchComments(
  pat: string,
  taskGid: string,
  taskName: string,
  account: string,
  verbose: boolean,
): Promise<UnifiedRecord[]> {
  let results: UnifiedRecord[] = []
  let offset: string | undefined = undefined
  while (true) {
    let params: Record<string, string> = { opt_fields: STORY_OPT_FIELDS, limit: "100" }
    if (offset) params.offset = offset
    let response = await asanaFetch<AsanaPage<AsanaStory>>(pat, `/tasks/${taskGid}/stories`, params, verbose)
    let stories: AsanaStory[] = response.data ?? []
    for (let story of stories) {
      if (story.type !== "comment" && story.resource_subtype !== "comment_added") continue
      results.push(commentToUnifiedRecord(story, taskGid, taskName, account))
    }
    offset = response.next_page?.offset
    if (!offset) break
  }
  verboseLog(verbose, "asana comments fetched", { taskGid, count: results.length })
  return results
}

export async function listAsanaMessages(params: {
  account: string
  query: string
  preset: string | undefined
  since: string | undefined
  until: string | undefined
  maxResults: number
  currentState: boolean
  includeSubtasks: boolean
  includeComments: boolean
  verbose: boolean
  onBatch: ((rows: UnifiedRecord[]) => Promise<void>) | undefined
}): Promise<UnifiedRecord[]> {
  let { token } = asanaClient(params.account, params.verbose)
  let projectGids = params.query
    .split(",")
    .map(s => s.trim())
    .filter(Boolean)

  if (projectGids.length === 0) {
    throw new Error("--query must contain at least one Asana project GID")
  }

  let results: UnifiedRecord[] = []
  let shouldFilterByWindow = !params.currentState
  let sinceTime = params.since ? new Date(params.since).getTime() : undefined
  let untilTime = params.until ? new Date(params.until).getTime() : undefined

  for (let projectGid of projectGids) {
    let offset: string | undefined = undefined
    while (params.currentState || results.length < params.maxResults) {
      let fetchParams: Record<string, string> = {
        opt_fields: TASK_OPT_FIELDS,
        limit: String(params.currentState ? 100 : Math.min(100, params.maxResults - results.length)),
      }
      if (params.since && !params.currentState) fetchParams.completed_since = params.since
      if (offset) fetchParams.offset = offset

      let response = await asanaFetchOptional<AsanaPage<AsanaTask>>(
        token.pat,
        `/projects/${projectGid}/tasks`,
        fetchParams,
        [404],
        params.verbose,
      )
      if (!response) {
        verboseLog(params.verbose, "asana project missing", { projectGid })
        break
      }
      let tasks: AsanaTask[] = response.data ?? []
      verboseLog(params.verbose, "asana tasks fetched", { projectGid, count: tasks.length })

      let batch: UnifiedRecord[] = []
      for (let task of tasks) {
        if (!params.currentState && results.length >= params.maxResults) break
        let ts = new Date(task.created_at).getTime()
        if (shouldFilterByWindow && sinceTime !== undefined && ts < sinceTime) continue
        if (shouldFilterByWindow && untilTime !== undefined && ts >= untilTime) continue
        let row = toUnifiedRecord(task, params.account)
        results.push(row)
        batch.push(row)

        if (params.includeSubtasks) {
          let subtasks = await fetchSubtasks(token.pat, task.gid, params.verbose)
          for (let subtask of subtasks) {
            let subTs = new Date(subtask.created_at).getTime()
            if (shouldFilterByWindow && sinceTime !== undefined && subTs < sinceTime) continue
            if (shouldFilterByWindow && untilTime !== undefined && subTs >= untilTime) continue
            let row = toUnifiedRecord(subtask, params.account)
            results.push(row)
            batch.push(row)
          }
        }

        if (params.includeComments) {
          let comments = await fetchComments(token.pat, task.gid, task.name, params.account, params.verbose)
          for (let comment of comments) {
            let commentTs = new Date(comment.timestamp).getTime()
            if (shouldFilterByWindow && sinceTime !== undefined && commentTs < sinceTime) continue
            if (shouldFilterByWindow && untilTime !== undefined && commentTs >= untilTime) continue
            results.push(comment)
            batch.push(comment)
          }
        }
      }

      if (batch.length) await params.onBatch?.(batch)

      offset = response.next_page?.offset
      if (!offset) break
    }
  }

  return results
}

export async function fetchAsanaAttachment(
  row: UnifiedRecord,
  selector: AttachmentSelector,
  account: string,
): Promise<Buffer | undefined> {
  let attachment = selector.id
    ? row.attachments.find(a => a.id === selector.id)
    : row.attachments.filter(a => !selector.filename || a.filename === selector.filename)[selector.index]
  if (!attachment?.url) return undefined

  let { token } = asanaClient(account)
  let response = await fetch(attachment.url, {
    headers: { Authorization: `Bearer ${token.pat}` },
  })
  if (!response.ok) return undefined
  return Buffer.from(await response.arrayBuffer())
}
