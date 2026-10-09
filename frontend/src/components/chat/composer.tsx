import * as React from "react"
import { ArrowUpIcon, Loader2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { AiModel } from "@/lib/api"

type Props = {
  value: string
  onChange: (value: string) => void
  onSend: () => void
  busy: boolean // an answer is being written, so nothing new can be sent
  models: AiModel[]
  selectedModel: string
  onSelectModel: (modelId: string) => void
  modelLocked: boolean // a conversation keeps the model it was started with
}

export function Composer({
  value,
  onChange,
  onSend,
  busy,
  models,
  selectedModel,
  onSelectModel,
  modelLocked,
}: Props) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const canSend = !busy && value.trim().length > 0

  // typing can continue right away after an answer finishes or another chat opens
  React.useEffect(() => {
    if (!busy) textareaRef.current?.focus()
  }, [busy, modelLocked])

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    // enter sends, shift+enter makes a new line (isComposing is for japanese/chinese keyboards picking a character)
    if (
      event.key === "Enter" &&
      !event.shiftKey &&
      !event.nativeEvent.isComposing
    ) {
      event.preventDefault()
      if (canSend) onSend()
    }
  }

  // old conversations can have a model that isnt offered anymore, it still needs to show up as the selected one
  const options =
    models.some((model) => model.id === selectedModel) || !selectedModel
      ? models
      : [...models, { id: selectedModel, name: selectedModel }]

  return (
    <div className="rounded-2xl border bg-card shadow-sm transition-colors focus-within:border-ring">
      <textarea
        ref={textareaRef}
        rows={1}
        value={value}
        placeholder="Ask anything"
        aria-label="Message"
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={handleKeyDown}
        className="block field-sizing-content max-h-52 min-h-12 w-full resize-none bg-transparent px-4 pt-3.5 pb-1 text-base outline-none placeholder:text-muted-foreground md:text-sm"
      />

      <div className="flex items-center justify-between gap-2 p-2">
        <Select
          value={selectedModel}
          onValueChange={onSelectModel}
          disabled={modelLocked}
        >
          <SelectTrigger
            size="sm"
            aria-label="AI model"
            className="border-none bg-transparent shadow-none dark:bg-transparent"
          >
            <SelectValue placeholder="Model" />
          </SelectTrigger>
          {/* popper makes the list open next to the button, the default lays it on top of the button lined up with the selected item */}
          <SelectContent position="popper" align="start">
            {options.map((model) => (
              <SelectItem key={model.id} value={model.id}>
                {model.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button
          size="icon"
          className="rounded-full"
          disabled={!canSend}
          onClick={onSend}
          aria-label="Send message"
        >
          {busy ? <Loader2Icon className="animate-spin" /> : <ArrowUpIcon />}
        </Button>
      </div>
    </div>
  )
}
