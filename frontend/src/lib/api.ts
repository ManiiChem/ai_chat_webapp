export type User = { id: number; username: string }

export type AiModel = { name: string; id: string }

export type ConversationSummary = {
  id: number
  title: string
  date: string
  message_count: number
  ai_model: string
}

export type ChatMessage = {
  id?: number // messages that are still being written dont have one yet
  role: "user" | "assistant"
  content: string
  edited?: boolean // the user rewrote this message by hand
}

export type ConversationDetail = {
  id: number
  title: string
  conversationAiModel: string
  messages: ChatMessage[]
}

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

// the auth provider sets this so a 401 from any request logs the user out in the ui too
let unauthorizedHandler: (() => void) | null = null
export function setUnauthorizedHandler(handler: (() => void) | null) {
  unauthorizedHandler = handler
}

async function toApiError(response: Response): Promise<ApiError> {
  let message = "Something went wrong"
  try {
    const data = await response.json()
    if (typeof data.error === "string") message = data.error
  } catch {
    // the response wasnt json, the default message is fine
  }

  if (response.status === 401 && unauthorizedHandler) unauthorizedHandler()
  return new ApiError(response.status, message)
}

async function request<T>(
  url: string,
  method = "GET",
  body?: unknown
): Promise<T> {
  const response = await fetch(url, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (!response.ok) throw await toApiError(response)
  return response.json()
}

type StreamEvent =
  | { type: "delta"; text: string }
  | {
      type: "done"
      conversationId: number
      messageId: number
      userMessageId: number | null
    }
  | { type: "error"; message: string }

export type StreamResult = {
  conversationId: number
  messageId: number // the id of the saved answer
  userMessageId: number | null // the id of the saved user message, null when an answer was only regenerated
}

// reads the answer while the model is still writing it, the server sends one json object per line
async function streamReply(
  url: string,
  body: unknown,
  onDelta: (text: string) => void,
  signal: AbortSignal
): Promise<StreamResult> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  })

  if (!response.ok || !response.body) throw await toApiError(response)

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  const state: { result: StreamResult | null } = { result: null }

  const handleLine = (line: string) => {
    if (!line.trim()) return
    const event = JSON.parse(line) as StreamEvent

    if (event.type === "delta") onDelta(event.text)
    else if (event.type === "done")
      state.result = {
        conversationId: event.conversationId,
        messageId: event.messageId,
        userMessageId: event.userMessageId,
      }
    else if (event.type === "error") throw new ApiError(500, event.message)
  }

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })

    // a chunk can end in the middle of a line, so the unfinished part stays in the buffer
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""
    lines.forEach(handleLine)
  }
  handleLine(buffer)

  if (!state.result)
    throw new ApiError(500, "The connection closed before the answer finished")
  return state.result
}

export const api = {
  me: () => request<User>("/auth/api/me"),
  login: (username: string, password: string) =>
    request<User>("/auth/api/login", "POST", { username, password }),
  signup: (username: string, password: string) =>
    request<User>("/auth/api/signup", "POST", { username, password }),
  logout: () => request<{ success: boolean }>("/auth/api/logout", "POST"),

  models: () =>
    request<{ models: AiModel[]; default: string }>("/ai/api/models"),
  conversations: () =>
    request<ConversationSummary[]>("/ai/api/updateConversations"),
  conversation: (id: number) =>
    request<ConversationDetail>(`/ai/api/getConversation/${id}`),
  renameConversation: (id: number, title: string) =>
    request<{ title: string }>("/ai/api/renameConversation", "PUT", {
      conversation_id: id,
      new_title: title,
    }),
  deleteConversation: (id: number) =>
    request<{ success: boolean }>(`/ai/api/deleteConversation/${id}`, "DELETE"),

  editMessage: (id: number, content: string) =>
    request<ChatMessage>(`/ai/api/editMessage/${id}`, "PUT", { content }),
  deleteExchange: (messageId: number) =>
    request<{ deletedIds: number[]; conversationDeleted: boolean }>(
      `/ai/api/deleteExchange/${messageId}`,
      "DELETE"
    ),

  sendPrompt: (
    prompt: string,
    conversationId: number | null,
    aiModel: string,
    onDelta: (text: string) => void,
    signal: AbortSignal
  ) =>
    streamReply(
      "/ai/api/sendPrompt",
      {
        user_prompt: prompt,
        conversation_id: conversationId,
        ai_model: aiModel,
      },
      onDelta,
      signal
    ),
  regenerate: (
    conversationId: number,
    onDelta: (text: string) => void,
    signal: AbortSignal
  ) => streamReply(`/ai/api/regenerate/${conversationId}`, {}, onDelta, signal),
}
