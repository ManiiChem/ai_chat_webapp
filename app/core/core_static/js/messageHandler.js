document.addEventListener("DOMContentLoaded", () => {
    let currentConversationId = document.getElementById("conversationIdField").value;
    const messageButton = document.getElementById("submitMessage");
    const messageText = document.getElementById("messageArea");
    const chatHistory = document.getElementById("chatHistory");
    const welcomeTitle = document.getElementById("welcomeTitle");
    const sidebarList = document.querySelector("#offcanvasChatHistory .list-group"); 
    const offcanvasElement = document.getElementById('offcanvasChatHistory');
    const newChatButton = document.getElementById("newChatButton");

    function createMessageBubble(text, isUser) {
        const wrapper = document.createElement("div");
        wrapper.className = `d-flex ${isUser ? "justify-content-end" : "justify-content-start"}`;

        const bubble = document.createElement("div");
        bubble.className = `p-3 rounded-4 ${isUser ? 'bg-primary text-white' : 'bg-light text-dark shadow-sm'}`;
        bubble.style.maxWidth = "75%";
        bubble.textContent = text;

        wrapper.appendChild(bubble);
        return wrapper;
    }

    function createLoadingBubble() {
        const wrapper = document.createElement("div");
        wrapper.className = "d-flex justify-content-start";
        wrapper.id = "loadingBubble";

        const bubble = document.createElement("div");
        bubble.className = "p-3 rounded-4 bg-light text-dark shadow-sm d-flex align-items-center gap-2";
        bubble.innerHTML = `
            <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
            <span class="text-secondary small">Thinking..</span>
        `;
        wrapper.appendChild(bubble);
        return wrapper;
    }

    async function refreshSidebar() {
        try {
            const response = await fetch('/ai/api/updateConversations');
            if (!response.ok) return;
            const convos = await response.json();

            sidebarList.innerHTML = '';

            if (convos.length === 0) {
                sidebarList.innerHTML = `
                    <div class="text-center text-muted mt-5">
                        <i class="bi bi-inbox fs-1"></i>
                        <p class="mt-2">No history yet.</p>
                    </div>`;
                return;
            }

            convos.forEach(c => {
                const itemContainer = document.createElement('div');
                itemContainer.className = "list-group-item list-group-item-action py-3 lh-sm d-flex justify-content-between align-items-start";
                itemContainer.style.cursor = "pointer";
                
                itemContainer.id = `convo-${c.id}`; 

                itemContainer.innerHTML = `
                    <div class="me-2 text-truncate conversationLink" data-id="${c.id}" style="flex-grow: 1;">
                        <div class="d-flex w-100 align-items-center justify-content-between mb-1">
                            <strong class="mb-1 text-truncate" id="title-${c.id}">
                                ${c.title}
                            </strong>
                        </div>
                        <div class="small text-muted text-truncate">
                            ${c.date}
                        </div>
                    </div>

                    <div class="dropdown">
                        <button class="btn btn-sm btn-light text-secondary border-0" type="button" data-bs-toggle="dropdown" aria-expanded="false" onclick="event.stopPropagation()">
                            <i class="bi bi-three-dots-vertical"></i>
                        </button>
                        <ul class="dropdown-menu dropdown-menu-end shadow">
                            <li>
                                <a class="dropdown-item d-flex align-items-center gap-2 rename-btn" href="#" data-id="${c.id}" data-title="${c.title}">
                                    <i class="bi bi-pencil small"></i> Rename
                                </a>
                            </li>
                            <li><hr class="dropdown-divider"></li>
                            <li>
                                <a class="dropdown-item d-flex align-items-center gap-2 text-danger delete-btn" href="#" data-id="${c.id}">
                                    <i class="bi bi-trash small"></i> Delete
                                </a>
                            </li>
                        </ul>
                    </div>
                `;
                
                sidebarList.appendChild(itemContainer);
            });

        } catch (error) {
            console.error("Failed to refresh sidebar:", error);
        }
    }

    if (sidebarList) {
        sidebarList.addEventListener('click', async (e) => {
            
            const renameBtn = e.target.closest('.rename-btn');
            if (renameBtn) {
                e.preventDefault();
                e.stopPropagation(); 
                
                const convoId = renameBtn.dataset.id;
                const currentTitle = renameBtn.dataset.title;
                const newTitle = prompt("Enter new chat title:", currentTitle);

                if (newTitle && newTitle.trim() !== "") {
                    try {
                        const response = await fetch('/ai/api/renameConversation', {
                            method: "PUT",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ conversation_id: convoId, new_title: newTitle })
                        });
                        if (response.ok) {
                            document.getElementById(`title-${convoId}`).textContent = newTitle;
                            renameBtn.dataset.title = newTitle; 
                        }
                    } catch (err) {
                        alert("Failed to rename.");
                    }
                }
                return;
            }

            const deleteBtn = e.target.closest('.delete-btn');
            if (deleteBtn) {
                e.preventDefault();
                e.stopPropagation();

                if (confirm("Are you sure you want to delete this chat?")) {
                    const convoId = deleteBtn.dataset.id;
                    try {
                        const response = await fetch(`/ai/api/deleteConversation/${convoId}`, {
                            method: "DELETE"
                        });

                        if (response.ok) {
                            document.getElementById(`convo-${convoId}`).remove();
                            
                            if (currentConversationId == convoId) {
                                chatHistory.innerHTML = '';
                                chatHistory.classList.add('d-none');
                                welcomeTitle.classList.remove('d-none');
                                document.getElementById("conversationIdField").value = "";
                                currentConversationId = null;
                            }
                            refreshSidebar(); // For the no history icon
                        }
                    } catch (err) {
                        alert("Failed to delete.");
                    }
                }
                return;
            }

            const link = e.target.closest('.conversationLink');
            if (link) {
                e.preventDefault();
                const convoId = link.dataset.id;
                loadConversation(convoId);
            }
        });
    }

    if (offcanvasElement) {
        offcanvasElement.addEventListener('show.bs.offcanvas', refreshSidebar);
    }

    async function loadConversation(id) {
        try {
            chatHistory.innerHTML = ''; 
            welcomeTitle.classList.add('d-none');
            chatHistory.classList.remove('d-none');

            const response = await fetch(`/ai/api/getConversation/${id}`);
            if (!response.ok) throw new Error("Failed to load chat");

            const data = await response.json();

            currentConversationId = data.id;
            const hiddenInput = document.getElementById("conversationIdField");
            if (hiddenInput) hiddenInput.value = data.id;

            data.messages.forEach(msg => {
                const isUser = (msg.role === 'user'); 
                chatHistory.appendChild(createMessageBubble(msg.content, isUser));
            });

            chatHistory.scrollTop = chatHistory.scrollHeight;

            // close sidebar on mobile
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasElement);
            if (bsOffcanvas) bsOffcanvas.hide();

        } catch (error) {
            console.error(error);
            alert("Could not load conversation.");
        }
    }

    messageButton.addEventListener("click", async () => {
        const user_chat = messageText.value.trim();
        if (!user_chat) return;

        messageButton.disabled = true;
        welcomeTitle.classList.add('d-none');
        chatHistory.classList.remove('d-none');

        chatHistory.appendChild(createMessageBubble(user_chat, true));
        messageText.value = "";
        chatHistory.scrollTop = chatHistory.scrollHeight;

        const loadingBubble = createLoadingBubble();
        chatHistory.appendChild(loadingBubble);
        chatHistory.scrollTop = chatHistory.scrollHeight;

        const localTime = new Date().toLocaleString();

        try {
            const response = await fetch('/ai/api/sendPrompt', {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    user_prompt: user_chat,
                    conversation_id: currentConversationId || null,
                    created_at: localTime 
                })
            });
            
            if (!response.ok) throw new Error(`Error: ${response.status}`);
            const jsonData = await response.json();

            if (jsonData.conversationId) {
                currentConversationId = jsonData.conversationId;
                const hiddenInput = document.getElementById("conversationIdField");
                if (hiddenInput) hiddenInput.value = jsonData.conversationId;
            }

            if (loadingBubble) loadingBubble.remove();
            chatHistory.appendChild(createMessageBubble(jsonData.aiResponse, false));
            chatHistory.scrollTop = chatHistory.scrollHeight;

            // refreshSidebar(); 

        } catch (error) {
            console.error("Error:", error.message);
            if (loadingBubble) loadingBubble.remove();
            chatHistory.appendChild(createMessageBubble("Sorry, something went wrong.", false));
        } finally {
            messageButton.disabled = false;
            messageText.focus();
        }
    });

    if (newChatButton) {
        newChatButton.addEventListener("click", (e) => {
            e.preventDefault();
            currentConversationId = null;
            document.getElementById("conversationIdField").value = "";

            chatHistory.innerHTML = "";
            welcomeTitle.classList.remove('d-none');
            chatHistory.classList.add('d-none');

            messageText.value = "";
            const bsOffcanvas = bootstrap.Offcanvas.getInstance(offcanvasElement);
            if (bsOffcanvas) bsOffcanvas.hide();
        });
    }
});