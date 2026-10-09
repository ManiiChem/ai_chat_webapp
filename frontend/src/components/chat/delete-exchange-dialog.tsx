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

type Props = {
  messageId: number | null // null means the dialog is closed
  onClose: () => void
  onDelete: (messageId: number) => Promise<void>
}

// asks before deleting a message together with its other half (the question or the answer)
export function DeleteExchangeDialog({ messageId, onClose, onDelete }: Props) {
  const [busy, setBusy] = React.useState(false)

  async function handleDelete() {
    if (messageId === null) return
    setBusy(true)
    try {
      await onDelete(messageId)
      onClose()
    } catch {
      // the error already showed up as a toast, the dialog stays open to try again
    } finally {
      setBusy(false)
    }
  }

  return (
    <AlertDialog
      open={messageId !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete this exchange?</AlertDialogTitle>
          <AlertDialogDescription>
            Your message and the answer to it will both be deleted, and the AI
            wont remember them.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={busy}
            onClick={(event) => {
              event.preventDefault() // keeps the dialog open until the request is done
              handleDelete()
            }}
          >
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
