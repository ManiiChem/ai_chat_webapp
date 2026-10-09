import * as React from "react"
import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Trash2Icon,
} from "lucide-react"

import { Markdown, useCopy } from "@/components/chat/markdown"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import type { ChatMessage } from "@/lib/api"
import { cn } from "@/lib/utils"

type Props = {
  message: ChatMessage
  streaming: boolean // this message is the one being written right now
  canModify: boolean // false while any answer is being written, so the history cant change under it
  onRegenerate?: () => void // only set on the last answer
  onEdit: (id: number, content: string) => Promise<void>
  onDelete: (id: number) => void
}

// memo so that while an answer streams in only that one message re-renders, not the whole chat
export const Message = React.memo(function Message({
  message,
  streaming,
  canModify,
  onRegenerate,
  onEdit,
  onDelete,
}: Props) {
  const { copied, copy } = useCopy()
  const [editing, setEditing] = React.useState(false)
  const isUser = message.role === "user"
  const messageId = message.id // a message that isnt saved yet has no id and cant be edited or deleted

  if (editing && messageId !== undefined) {
    return (
      <MessageEditor
        initialText={message.content}
        isUser={isUser}
        onCancel={() => setEditing(false)}
        onSave={async (text) => {
          await onEdit(messageId, text)
          setEditing(false)
        }}
      />
    )
  }

  return (
    <div
      className={cn(
        "group/message flex flex-col gap-1",
        isUser ? "items-end" : "items-start"
      )}
    >
      {isUser ? (
        <div className="max-w-[85%] rounded-2xl bg-secondary px-4 py-2.5 break-words whitespace-pre-wrap text-secondary-foreground">
          {message.content}
        </div>
      ) : message.content ? (
        <div className="w-full min-w-0">
          <Markdown text={message.content} />
        </div>
      ) : (
        <ThinkingIndicator />
      )}

      {!streaming && message.content && (
        // the label sits on the outer edge (left for the AI, right for the user) so it lines up with the message while the buttons r hidden
        <div
          className={cn(
            "flex items-center gap-1",
            !isUser && "flex-row-reverse"
          )}
        >
          <div
            className={cn(
              "flex items-center gap-0.5 transition-opacity",
              // older messages only show their buttons on hover (touch screens cant hover, so there they always show)
              !onRegenerate &&
                "group-focus-within/message:opacity-100 group-hover/message:opacity-100 [@media(hover:hover)]:opacity-0"
            )}
          >
            <ActionButton
              label={copied ? "Copied" : "Copy"}
              onClick={() => copy(message.content)}
            >
              {copied ? <CheckIcon /> : <CopyIcon />}
            </ActionButton>

            {canModify && messageId !== undefined && (
              <>
                <ActionButton label="Edit" onClick={() => setEditing(true)}>
                  <PencilIcon />
                </ActionButton>
                <ActionButton
                  label="Delete"
                  onClick={() => onDelete(messageId)}
                >
                  <Trash2Icon />
                </ActionButton>
              </>
            )}

            {onRegenerate && (
              <ActionButton label="Regenerate" onClick={onRegenerate}>
                <RefreshCwIcon />
              </ActionButton>
            )}
          </div>

          {/* only the user sees this, the model just gets the rewritten text */}
          {message.edited && (
            <span className="px-1 text-xs text-muted-foreground">edited</span>
          )}
        </div>
      )}
    </div>
  )
})

// the message turned into a text box, for the AIs answers it shows the raw markdown
function MessageEditor({
  initialText,
  isUser,
  onCancel,
  onSave,
}: {
  initialText: string
  isUser: boolean
  onCancel: () => void
  onSave: (text: string) => Promise<void>
}) {
  const [text, setText] = React.useState(initialText)
  const [saving, setSaving] = React.useState(false)
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const canSave = !saving && text.trim().length > 0

  // starts with the cursor at the end of the text instead of the start
  React.useEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.focus()
    textarea.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [])

  async function save() {
    if (!canSave) return
    setSaving(true)
    try {
      await onSave(text)
    } catch {
      setSaving(false) // the error already showed up as a toast, the text stays so nothing typed is lost
    }
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape") {
      event.preventDefault()
      onCancel()
    } else if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      // plain enter has to stay a new line here, so saving is ctrl+enter
      event.preventDefault()
      save()
    }
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2",
        isUser ? "ml-auto w-full max-w-[85%]" : "w-full"
      )}
    >
      <textarea
        ref={textareaRef}
        value={text}
        aria-label={isUser ? "Edit your message" : "Edit the AI's answer"}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        className={cn(
          "block field-sizing-content max-h-[60vh] min-h-20 w-full resize-none rounded-2xl border bg-card px-4 py-3 text-base outline-none focus-visible:border-ring md:text-sm",
          !isUser && "font-mono"
        )}
      />

      <div className="flex items-center justify-end gap-2">
        <span className="mr-auto text-xs text-muted-foreground">
          {isUser
            ? "The AI will think you said this"
            : "The AI will think it said this"}
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button size="sm" onClick={save} disabled={!canSave}>
          Save
        </Button>
      </div>
    </div>
  )
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="text-muted-foreground"
          aria-label={label}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

// shown until the first piece of the answer arrives, these models think for a bit before they write
function ThinkingIndicator() {
  return (
    <div
      className="flex items-center gap-2 py-1 text-sm text-muted-foreground"
      role="status"
    >
      <span className="flex gap-1">
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.3s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current [animation-delay:-0.15s]" />
        <span className="size-1.5 animate-bounce rounded-full bg-current" />
      </span>
      Thinking
    </div>
  )
}
