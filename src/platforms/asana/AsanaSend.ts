import fs from "node:fs"
import path from "node:path"
import { verboseLog } from "../../Verbose"
import { asanaClient, asanaPost } from "./asanaClient"

export async function sendAsanaMessage(params: {
  account: string
  assignee: string | undefined
  projectGid: string | undefined
  name: string
  notes: string
  attach: string[]
  verbose: boolean
}): Promise<{ ok: boolean; taskGid: string | undefined; filesUploaded: number }> {
  let { token } = asanaClient(params.account, params.verbose)

  let body: Record<string, unknown> = { name: params.name, notes: params.notes }
  if (params.assignee) body.assignee = params.assignee
  if (params.projectGid) body.projects = [params.projectGid]

  let response = await asanaPost(token.pat, "/tasks", body, params.verbose)
  let taskGid: string = response.data?.gid
  verboseLog(params.verbose, "asana task created", { taskGid })

  let filesUploaded = 0
  for (let filePath of params.attach) {
    let data = fs.readFileSync(filePath)
    let filename = path.basename(filePath)
    let form = new FormData()
    form.append("parent", taskGid)
    form.append("file", new Blob([data]), filename)

    let uploadResponse = await fetch("https://app.asana.com/api/1.0/attachments", {
      method: "POST",
      headers: { Authorization: `Bearer ${token.pat}` },
      body: form,
    })
    if (!uploadResponse.ok) {
      let text = await uploadResponse.text()
      throw new Error(`Asana attachment upload ${uploadResponse.status}: ${text}`)
    }
    filesUploaded += 1
    verboseLog(params.verbose, "asana attachment uploaded", { taskGid, filename })
  }

  return { ok: true, taskGid, filesUploaded }
}
