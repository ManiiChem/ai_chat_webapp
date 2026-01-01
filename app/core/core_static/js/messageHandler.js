document.addEventListener("DOMContentLoaded", () => {
    let currentConversationId = document.getElementById("conversationIdField").value;
    const messageButton = document.getElementById("submitMessage");
    const messageText = document.getElementById("messageArea");
    const chatHistory = document.getElementById("chatHistory");
    const welcomeTitle = document.getElementById("welcomeTitle")

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
        wrapper.className = "d-flex justify-content-start"
        wrapper.id = "loadingBubble";

        const bubble = document.createElement("div")
        bubble.className = "p-3 rounded-4 bg-light text-dark shadow-sm d-flex align-items-center gap-2";
        bubble.innerHTML = `
            <div class="spinner-border spinner-border-sm text-secondary" role="status"></div>
            <span class="text-secondary small">Thinking..</span>
        `;

        wrapper.appendChild(bubble);
        return wrapper;
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
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({
                    user_prompt: user_chat,
                    conversation_id: currentConversationId || null,
                    created_at: localTime 
                })
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const jsonData = await response.json();
            // Change DOM and display message
            if (jsonData.conversationId) {
                currentConversationId = jsonData.conversationId;
                document.getElementById("conversationIdField").value = jsonData.conversationId; // just incase
            }

            if (loadingBubble) loadingBubble.remove();

            chatHistory.appendChild(createMessageBubble(jsonData.aiResponse, false));
            chatHistory.scrollTop = chatHistory.scrollHeight;

        } catch (error) {
            console.error("Error:", error.message);
            if (loadingBubble) loadingBubble.remove();
            chatHistory.appendChild(createMessageBubble("Sorry, something went wrong. Please try again.", false));
        } finally {
            // finally always run whether success or error
            messageButton.disabled = false;
            messageText.focus();
        }
    });
});