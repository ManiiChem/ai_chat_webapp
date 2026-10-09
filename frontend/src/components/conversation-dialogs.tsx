import * as React from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import type { AiModel, ConversationSummary } from "@/lib/api"
import { formatDate } from "@/lib/dates"

const TITLE_MAX_LENGTH = 100 // same limit the server checks

// which dialog is open and for which conversation, null means none
export type DialogState = {
  kind: "info" | "rename" | "delete"
  conversation: ConversationSummary
} | null

type Props = {
  state: DialogState
  models: AiModel[]
  onClose: () => void
  onRename: (conversation: ConversationSummary, title: string) => Promise<void>
  onDelete: (conversation: ConversationSummary) => Promise<void>
}

export function ConversationDialogs({
  state,
  models,
  onClose,
  onRename,
  onDelete,
}: Props) {
  const [title, setTitle] = React.useState("")
  const [busy, setBusy] = React.useState(false)

  // remembers the last opened dialog, so its text stays readable while the dialog fades out (state is already null then)
  const [shown, setShown] = React.useState(state)
  if (state && state !== shown) {
    setShown(state)
    setTitle(state.conversation.title) // fills the rename field with the current title every time a dialog opens
    setBusy(false)
  }
  const conversation = shown?.conversation

  const closeOnDismiss = (open: boolean) => {
    if (!open) onClose()
  }

  async function run(action: () => Promise<void>) {
    setBusy(true)
    try {
      await action()
      onClose()
    } catch {
      setBusy(false) // the caller already showed what went wrong, the dialog stays open to try again
    }
  }

  // old conversations can have a model that isnt offered anymore, those just show the saved id
  const modelName =
    models.find((model) => model.id === conversation?.ai_model)?.name ??
    conversation?.ai_model

  return (
    <>
      <Dialog open={state?.kind === "info"} onOpenChange={closeOnDismiss}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="pr-6 break-words">
              {conversation?.title}
            </DialogTitle>
            <DialogDescription>
              Details about this conversation
            </DialogDescription>
          </DialogHeader>

          <dl className="divide-y text-sm">
            <InfoRow label="AI model" value={modelName} />
            <InfoRow label="Messages" value={conversation?.message_count} />
            <InfoRow
              label="Created"
              value={conversation ? formatDate(conversation.date) : ""}
            />
            <InfoRow label="Conversation ID" value={conversation?.id} mono />
          </dl>
        </DialogContent>
      </Dialog>

      <Dialog open={state?.kind === "rename"} onOpenChange={closeOnDismiss}>
        <DialogContent className="sm:max-w-sm">
          <form
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (conversation && title.trim())
                run(() => onRename(conversation, title.trim()))
            }}
          >
            <DialogHeader>
              <DialogTitle>Rename conversation</DialogTitle>
              <DialogDescription>
                Give this conversation a new title
              </DialogDescription>
            </DialogHeader>

            <Input
              aria-label="Conversation title"
              autoFocus
              maxLength={TITLE_MAX_LENGTH}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy || !title.trim()}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={state?.kind === "delete"}
        onOpenChange={closeOnDismiss}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this conversation?</AlertDialogTitle>
            <AlertDialogDescription className="break-words">
              "{conversation?.title}" and all of its messages will be deleted
              for good.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={busy}
              onClick={(event) => {
                event.preventDefault() // keeps the dialog open until the request is done
                if (conversation) run(() => onDelete(conversation))
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string
  value: React.ReactNode
  mono?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? "font-mono text-xs" : "text-right font-medium"}>
        {value}
      </dd>
    </div>
  )
}
