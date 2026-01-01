document.addEventListener("DOMContentLoaded", () => {
    const messageButton = document.getElementById("submitMessage");
    const messageText = document.getElementById("messageArea");

    messageButton.addEventListener("click", async () => {
        const user_prompt = messageText.value;
        try {
            const response = await fetch('/ai/api/sendPrompt', {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Accept": "application/json"
                },
                body: JSON.stringify({user_prompt})
            });
            
            if (!response.ok) {
                throw new Error(`Error: ${response.status}`);
            }

            const jsonData = await response.json();
            // Change DOM and display message
            console.log(jsonData)
        } catch (error) {
            console.error("Error:", error.message);
            // Probably refresh the page or tell the user to try again
        }
    });
});