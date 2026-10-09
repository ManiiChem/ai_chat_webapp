import { Link } from "react-router-dom"
import {
  ChevronsUpDownIcon,
  InfoIcon,
  LogOutIcon,
  MessageCircleIcon,
  MonitorIcon,
  MoonIcon,
  MoreHorizontalIcon,
  PencilIcon,
  SquarePenIcon,
  SunIcon,
  Trash2Icon,
} from "lucide-react"

import type { DialogState } from "@/components/conversation-dialogs"
import { useTheme } from "@/components/theme-provider"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSkeleton,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar"
import { useAuth } from "@/hooks/use-auth"
import type { ConversationSummary } from "@/lib/api"
import { groupByDate } from "@/lib/dates"

type Props = {
  conversations: ConversationSummary[] | null // null while the list is still loading
  activeId: number | null
  onOpenDialog: (state: DialogState) => void
}

export function AppSidebar({ conversations, activeId, onOpenDialog }: Props) {
  const { isMobile, setOpenMobile } = useSidebar()

  // on phones the sidebar is a drawer over the chat, so it closes after picking something
  const closeMobile = () => {
    if (isMobile) setOpenMobile(false)
  }

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" asChild>
              <Link to="/" onClick={closeMobile}>
                <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageCircleIcon className="size-4" />
                </div>
                <span className="font-semibold">AI Chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>

          <SidebarMenuItem>
            <SidebarMenuButton asChild tooltip="New chat">
              <Link to="/" onClick={closeMobile}>
                <SquarePenIcon />
                <span>New chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      {/* the history has no icons, so it hides completely when the sidebar is collapsed to icons */}
      <SidebarContent className="group-data-[collapsible=icon]:hidden">
        {conversations === null && (
          <SidebarGroup>
            <SidebarMenu>
              {[0, 1, 2, 3].map((index) => (
                <SidebarMenuItem key={index}>
                  <SidebarMenuSkeleton />
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        )}

        {conversations?.length === 0 && (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No conversations yet
          </p>
        )}

        {groupByDate(conversations ?? []).map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.conversations.map((conversation) => (
                  <SidebarMenuItem key={conversation.id}>
                    <SidebarMenuButton
                      asChild
                      isActive={conversation.id === activeId}
                    >
                      <Link
                        to={`/c/${conversation.id}`}
                        onClick={closeMobile}
                        title={conversation.title}
                      >
                        <span>{conversation.title}</span>
                      </Link>
                    </SidebarMenuButton>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <SidebarMenuAction showOnHover>
                          <MoreHorizontalIcon />
                          <span className="sr-only">Conversation options</span>
                        </SidebarMenuAction>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        side={isMobile ? "bottom" : "right"}
                        align="start"
                        className="w-40"
                      >
                        <DropdownMenuItem
                          onSelect={() =>
                            onOpenDialog({ kind: "info", conversation })
                          }
                        >
                          <InfoIcon />
                          Info
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onSelect={() =>
                            onOpenDialog({ kind: "rename", conversation })
                          }
                        >
                          <PencilIcon />
                          Rename
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant="destructive"
                          onSelect={() =>
                            onOpenDialog({ kind: "delete", conversation })
                          }
                        >
                          <Trash2Icon />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* keeps the user menu at the bottom while the history above is hidden */}
      <div className="hidden flex-1 group-data-[collapsible=icon]:block" />

      <SidebarFooter>
        <UserMenu />
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { theme, setTheme } = useTheme()
  const { isMobile } = useSidebar()

  if (!user) return null

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg">
              <Avatar className="size-8 rounded-lg">
                <AvatarFallback className="rounded-lg">
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="flex-1 truncate font-medium">
                {user.username}
              </span>
              <ChevronsUpDownIcon className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            side={isMobile ? "top" : "right"}
            align="end"
            className="w-52"
          >
            <DropdownMenuLabel>Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={theme}
              onValueChange={(value) => setTheme(value as typeof theme)}
            >
              <DropdownMenuRadioItem value="light">
                <SunIcon />
                Light
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="dark">
                <MoonIcon />
                Dark
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="system">
                <MonitorIcon />
                System
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>

            <DropdownMenuSeparator />

            <DropdownMenuItem onSelect={() => logout()}>
              <LogOutIcon />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
