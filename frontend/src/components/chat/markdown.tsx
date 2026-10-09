import * as React from "react"
import ReactMarkdown from "react-markdown"
import rehypeHighlight from "rehype-highlight"
import remarkGfm from "remark-gfm"
import { CheckIcon, CopyIcon } from "lucide-react"

import { Button } from "@/components/ui/button"

// shows a check mark for a moment after copying
export function useCopy() {
  const [copied, setCopied] = React.useState(false)

  const copy = React.useCallback((text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }, [])

  return { copied, copy }
}

// a code block with the language name and a copy button on top
function CodeBlock({ children }: React.ComponentProps<"pre">) {
  const preRef = React.useRef<HTMLPreElement>(null)
  const { copied, copy } = useCopy()

  // markdown puts the language on the inner <code> as a class like "language-python"
  const codeClass = React.isValidElement<{ className?: string }>(children)
    ? (children.props.className ?? "")
    : ""
  const language = /language-([\w-]+)/.exec(codeClass)?.[1] ?? "code"

  return (
    <div className="my-4 overflow-hidden rounded-lg border bg-muted/40">
      <div className="flex items-center justify-between border-b bg-muted/60 py-1 pr-1 pl-3">
        <span className="font-mono text-xs text-muted-foreground">
          {language}
        </span>
        <Button
          variant="ghost"
          size="xs"
          onClick={() => copy(preRef.current?.textContent ?? "")}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        ref={preRef}
        className="overflow-x-auto p-3 font-mono text-[13px] leading-relaxed"
      >
        {children}
      </pre>
    </div>
  )
}

const components = {
  pre: CodeBlock,
  // links from the model open in a new tab so the chat doesnt get replaced
  a: ({ children, href }: React.ComponentProps<"a">) => (
    <a href={href} target="_blank" rel="noreferrer noopener">
      {children}
    </a>
  ),
  // wide tables scroll sideways instead of stretching the page
  table: ({ children }: React.ComponentProps<"table">) => (
    <div className="my-4 overflow-x-auto">
      <table>{children}</table>
    </div>
  ),
}

// react-markdown never renders raw html from the text (and rehype-raw is left out on purpose),
// so whatever the model writes cant inject tags or scripts into the page
export const Markdown = React.memo(function Markdown({
  text,
}: {
  text: string
}) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
})
