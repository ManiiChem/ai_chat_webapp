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
                const item = document.createElement('a');
                item.href = "#";
                item.className = "list-group-item list-group-item-action py-3 lh-sm conversationLink";
                item.dataset.id = c.id; 

                item.innerHTML = `
                    <div class="d-flex w-100 align-items-center justify-content-between mb-1">
                        <strong class="mb-1 text-truncate" style="max-width: 70%;">
                            ${c.title}
                        </strong>
                        <small class="text-muted" style="font-size: 0.75rem;">${c.date}</small>
                    </div>
                    <div class="d-flex justify-content-between align-items-center">
                        <div class="col-10 mb-1 small text-muted text-truncate">
                            ${c.message_count} messages
                        </div>
                        <i class="bi bi-chevron-right text-muted" style="font-size: 0.8rem;"></i>
                    </div>
                `;
                sidebarList.appendChild(item);
            });

        } catch (error) {
            console.error("Failed to refresh sidebar:", error);
        }
    }

    if (sidebarList) {
        sidebarList.addEventListener('click', (e) => {
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