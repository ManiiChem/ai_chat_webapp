import * as React from "react"
import { useMatch, useNavigate } from "react-router-dom"
import { toast } from "sonner"

import { AppSidebar } from "@/components/app-sidebar"
import { Composer } from "@/components/chat/composer"
import { DeleteExchangeDialog } from "@/components/chat/delete-exchange-dialog"
import { Message } from "@/components/chat/message"
import {
  ConversationDialogs,
  type DialogState,
} from "@/components/conversation-dialogs"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Skeleton } from "@/components/ui/skeleton"
import {
  api,
  type AiModel,
  type ChatMessage,
  type ConversationSummary,
} from "@/lib/api"

const TITLE_REFRESH_DELAY = 4000 // the server writes the title of a new chat in the background, so the list gets fetched again a bit later

// key stays the same for as long as a message is on screen (the id only shows up once the server saved it),
// react needs that to keep track of which message is which when one gets deleted from the middle
type ShownMessage = ChatMessage & { key: string }

let messageKeyCounter = 0
function newMessageKey(): string {
  return `new-${messageKeyCounter++}`
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Something went wrong"
}

// the sidebar component saves if it was open in a cookie, this reads it back on page load
function sidebarWasOpen(): boolean {
  return !document.cookie.includes("sidebar_state=false")
}

export function ChatPage() {
  const navigate = useNavigate()
  const match = useMatch("/c/:id")
  const idParam = match?.params.id ?? ""
  const activeId = /^\d+$/.test(idParam) ? Number(idParam) : null // null means a new chat that isnt saved yet

  const [conversations, setConversations] = React.useState<
    ConversationSummary[] | null
  >(null)
  const [models, setModels] = React.useState<AiModel[]>([])
  const [selectedModel, setSelectedModel] = React.useState("")
  const [messages, setMessages] = React.useState<ShownMessage[]>([])
  const [loadingChat, setLoadingChat] = React.useState(false)
  const [streaming, setStreaming] = React.useState(false)
  const [draft, setDraft] = React.useState("")
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const [exchangeToDelete, setExchangeToDelete] = React.useState<number | null>(
    null
  ) // id of the message whose delete button was clicked

  const abortRef = React.useRef<AbortController | null>(null) // the request of the answer being written right now
  const shownIdRef = React.useRef<number | null | undefined>(undefined) // which conversation the messages on screen belong to (null is a new chat, undefined is nothing yet)
  const defaultModelRef = React.useRef("")
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const stickToBottomRef = React.useRef(true)

  const refreshConversations = React.useCallback(() => {
    api
      .conversations()
      .then(setConversations)
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    refreshConversations()
    api
      .models()
      .then((data) => {
        setModels(data.models)
        defaultModelRef.current = data.default
        setSelectedModel((current) => current || data.default)
      })
      .catch((error) => toast.error(errorMessage(error)))
  }, [refreshConversations])

  // loads the messages whenever the url points at a different conversation
  /* eslint-disable react-hooks/set-state-in-effect -- switching chats has to cancel the running request (a ref) and reset the screen together */
  React.useEffect(() => {
    // a chat that was just created by sending its first message is already on screen
    if (activeId === shownIdRef.current) return

    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
    shownIdRef.current = activeId
    stickToBottomRef.current = true

    if (activeId === null) {
      setMessages([])
      setLoadingChat(false)
      if (defaultModelRef.current) setSelectedModel(defaultModelRef.current)
      return
    }

    let cancelled = false
    setMessages([])
    setLoadingChat(true)

    api
      .conversation(activeId)
      .then((conversation) => {
        if (cancelled) return
        setMessages(
          conversation.messages.map((message) => ({
            ...message,
            key: `saved-${message.id}`,
          }))
        )
        setSelectedModel(conversation.conversationAiModel)
      })
      .catch((error) => {
        if (cancelled) return
        toast.error(errorMessage(error))
        navigate("/", { replace: true })
      })
      .finally(() => {
        if (!cancelled) setLoadingChat(false)
      })

    return () => {
      cancelled = true
      shownIdRef.current = undefined // so coming back to this conversation loads it again
    }
  }, [activeId, navigate])
  /* eslint-enable react-hooks/set-state-in-effect */

  // follows the answer as it grows, unless the user scrolled up to read something
  React.useEffect(() => {
    const container = scrollRef.current
    if (container && stickToBottomRef.current)
      container.scrollTop = container.scrollHeight
  }, [messages])

  function handleScroll() {
    const container = scrollRef.current
    if (!container) return
    stickToBottomRef.current =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80
  }

  // adds a new piece of text to the last message (the answer being written)
  function appendToLastMessage(text: string) {
    setMessages((current) => {
      const last = current[current.length - 1]
      return [
        ...current.slice(0, -1),
        { ...last, content: last.content + text },
      ]
    })
  }

  // once the server saved the new messages they get their ids, without one a message cant be edited or deleted
  function setNewMessageIds(answerId: number, userMessageId: number | null) {
    setMessages((current) =>
      current.map((message, index) => {
        if (index === current.length - 1) return { ...message, id: answerId }
        if (index === current.length - 2 && userMessageId !== null)
          return { ...message, id: userMessageId }
        return message
      })
    )
  }

  async function handleSend() {
    const prompt = draft.trim()
    if (!prompt || streaming) return

    const controller = new AbortController()
    const conversationId = activeId
    abortRef.current = controller
    stickToBottomRef.current = true

    setDraft("")
    setStreaming(true)
    // both show up right away, the empty answer gets filled in piece by piece
    setMessages((current) => [
      ...current,
      { role: "user", content: prompt, key: newMessageKey() },
      { role: "assistant", content: "", key: newMessageKey() },
    ])

    try {
      const result = await api.sendPrompt(
        prompt,
        conversationId,
        selectedModel,
        (text) => {
          if (!controller.signal.aborted) appendToLastMessage(text)
        },
        controller.signal
      )
      if (controller.signal.aborted) return

      setNewMessageIds(result.messageId, result.userMessageId)
      refreshConversations()

      // an old conversation whose model is gone gets moved to the default model by the server
      if (!models.some((model) => model.id === selectedModel))
        setSelectedModel(defaultModelRef.current)

      if (conversationId === null) {
        shownIdRef.current = result.conversationId
        navigate(`/c/${result.conversationId}`)
        setTimeout(refreshConversations, TITLE_REFRESH_DELAY)
      }
    } catch (error) {
      if (controller.signal.aborted) return // the user moved to another chat, nothing to clean up here

      // the server saves nothing when an answer fails, so the screen goes back to how it was
      setMessages((current) => current.slice(0, -2))
      setDraft(prompt)
      toast.error(errorMessage(error))
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setStreaming(false)
      }
    }
  }

  async function handleRegenerate() {
    if (streaming || activeId === null || messages.length === 0) return

    const controller = new AbortController()
    const oldAnswer = messages[messages.length - 1]
    abortRef.current = controller
    stickToBottomRef.current = true

    setStreaming(true)
    setMessages((current) => [
      ...current.slice(0, -1),
      { role: "assistant", content: "", key: newMessageKey() },
    ])

    try {
      const result = await api.regenerate(
        activeId,
        (text) => {
          if (!controller.signal.aborted) appendToLastMessage(text)
        },
        controller.signal
      )
      if (!controller.signal.aborted) setNewMessageIds(result.messageId, null)
    } catch (error) {
      if (controller.signal.aborted) return

      // the old answer is still saved on the server, so it comes back
      setMessages((current) => [...current.slice(0, -1), oldAnswer])
      toast.error(errorMessage(error))
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null
        setStreaming(false)
      }
    }
  }

  // overwrites a message (the users or the AIs), the next answer is written as if this was always the text.
  // useCallback keeps these two the same function between renders, otherwise every message would re-render for every streamed piece
  const handleEditMessage = React.useCallback(
    async (id: number, content: string) => {
      try {
        const saved = await api.editMessage(id, content)
        setMessages((current) =>
          current.map((message) =>
            message.id === id
              ? { ...message, content: saved.content, edited: saved.edited }
              : message
          )
        )
      } catch (error) {
        toast.error(errorMessage(error))
        throw error // so the editor stays open with the text still in it
      }
    },
    []
  )

  const handleAskDeleteExchange = React.useCallback((id: number) => {
    setExchangeToDelete(id)
  }, [])

  // removes a user message and its answer together, the AI wont know that exchange ever happened
  async function handleDeleteExchange(messageId: number) {
    try {
      const result = await api.deleteExchange(messageId)
      setMessages((current) =>
        current.filter(
          (message) =>
            message.id === undefined || !result.deletedIds.includes(message.id)
        )
      )

      if (result.conversationDeleted) {
        // that was the last exchange, so the server removed the whole conversation
        setConversations((current) =>
          (current ?? []).filter((item) => item.id !== activeId)
        )
        navigate("/")
      } else {
        refreshConversations() // the message count in the info dialog changed
      }
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  async function handleRename(
    conversation: ConversationSummary,
    title: string
  ) {
    try {
      const result = await api.renameConversation(conversation.id, title)
      setConversations((current) =>
        (current ?? []).map((item) =>
          item.id === conversation.id ? { ...item, title: result.title } : item
        )
      )
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  async function handleDelete(conversation: ConversationSummary) {
    try {
      await api.deleteConversation(conversation.id)
      setConversations((current) =>
        (current ?? []).filter((item) => item.id !== conversation.id)
      )
      if (conversation.id === activeId) navigate("/")
    } catch (error) {
      toast.error(errorMessage(error))
      throw error
    }
  }

  const activeTitle = conversations?.find(
    (conversation) => conversation.id === activeId
  )?.title
  const isEmptyChat = activeId === null && messages.length === 0

  const composer = (
    <Composer
      value={draft}
      onChange={setDraft}
      onSend={handleSend}
      busy={streaming}
      models={models}
      selectedModel={selectedModel}
      onSelectModel={setSelectedModel}
      modelLocked={!isEmptyChat}
    />
  )

  return (
    <SidebarProvider defaultOpen={sidebarWasOpen()}>
      <AppSidebar
        conversations={conversations}
        activeId={activeId}
        onOpenDialog={setDialog}
      />

      <SidebarInset className="h-svh overflow-hidden">
        <header className="flex h-12 shrink-0 items-center gap-2 px-3">
          <SidebarTrigger />
          <h1 className="truncate text-sm font-medium">
            {activeId === null ? "New chat" : (activeTitle ?? "")}
          </h1>
        </header>

        {isEmptyChat ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pb-24">
            <h2 className="text-center text-2xl font-semibold tracking-tight sm:text-3xl">
              What can I help with?
            </h2>
            <div className="w-full max-w-2xl">{composer}</div>
          </div>
        ) : (
          <>
            <div
              ref={scrollRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto"
            >
              <div className="mx-auto flex w-full max-w-3xl flex-col gap-3 px-4 pt-4 pb-10">
                {loadingChat && (
                  <>
                    <Skeleton className="h-10 w-1/3 self-end rounded-2xl" />
                    <Skeleton className="h-24 w-full" />
                    <Skeleton className="h-10 w-1/2 self-end rounded-2xl" />
                  </>
                )}

                {messages.map((message, index) => {
                  const isLast = index === messages.length - 1
                  return (
                    <Message
                      key={message.key}
                      message={message}
                      streaming={streaming && isLast}
                      canModify={!streaming}
                      onEdit={handleEditMessage}
                      onDelete={handleAskDeleteExchange}
                      onRegenerate={
                        isLast && message.role === "assistant" && !streaming
                          ? handleRegenerate
                          : undefined
                      }
                    />
                  )
                })}
              </div>
            </div>

            <div className="mx-auto w-full max-w-3xl px-4 pb-4">{composer}</div>
          </>
        )}
      </SidebarInset>

      <DeleteExchangeDialog
        messageId={exchangeToDelete}
        onClose={() => setExchangeToDelete(null)}
        onDelete={handleDeleteExchange}
      />

      <ConversationDialogs
        state={dialog}
        models={models}
        onClose={() => setDialog(null)}
        onRename={handleRename}
        onDelete={handleDelete}
      />
    </SidebarProvider>
  )
}
