# Flask AI Chat Wrapper

This is a full-stack AI chat application built with Flask and the Groq API (previously with the AWS Bedrock API). With a React + shadcn/ui frontend, multiple model support, streamed replies, asynchronous background tasks, persistent history, and user authentication.

![Project screenshot](/media/index.png) 
![Project screenshot 2](/media/index2.png) 

## Features

**Multi Model Support:** Switch between open AI models such as **GPT-OSS 120B** and **GPT-OSS 20B** using the free Groq API (or any other OpenAI compatible provider by setting `AI_BASE_URL`).

**Persistent History:** All conversations are stored in a relational database using `SQLAlchemy`.

**Smart Title Generation:** Uses background **threading** to auto generate chat titles without blocking the UI response.

**User Authentication:** Secure login and registration system using `Flask-Login` and `Bcrypt` hashing.

**Modern UI:** React interface built with shadcn/ui: collapsible sidebar with the chat history, dark and light theme, and mobile support.

**Streaming and Markdown:** Replies show up word by word while the model writes them and render as markdown with syntax highlighted code blocks. Any message can be copied and the last reply can be regenerated.

**CRUD Functionality:** Users can Load, Rename and Delete conversations instantly.

**Rewritable History:** Any message can be edited in place, yours or the AI's, and the AI carries on as if that was what was said all along. Single exchanges can also be deleted from the middle of a chat.

## Tech Stack

**Backend:** Python (Flask), Flask-SQLAlchemy 

**AI:** Groq API (OpenAI Python SDK)

**Database:** SQLite (Development) & PostgreSQL (Production ready)

**Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui

## Installation

You need Python and [Node.js](https://nodejs.org) (for building the frontend).

1.  **Clone the repository**
    ```bash
    git clone https://github.com/ManiiChem/ai_chat_webapp.git
    cd ai_chat_webapp
    ```

2. **Create a python virtual environment:**
    ```bash
    python -m venv .venv
    # Windows
    .venv\Scripts\activate
    # Linux/Mac
    source .venv/bin/activate
    ```

3. **Install the dependencies:**
    ```bash
    pip install -r requirements.txt
    ```

4.  **Setup environment variables**
    Create a `.env` file in the root directory:
    ```ini
    SECRET_KEY=your_flask_secret_key
    DATABASE_URI=sqlite:///database.db
    AI_API_KEY=your_groq_api_key
    ```

5.  **Initialize the database**
    ```bash
    flask db upgrade
    ```

6.  **Build the frontend**
    ```bash
    cd frontend
    npm install
    npm run build
    cd ..
    ```

7.  **Run the Application**
    ```bash
    python run.py
    ```
    Access the app at 'http://127.0.0.1:5000'

## Working on the frontend

Flask only serves the built files from `frontend/dist`, so while changing the frontend its easier to run the Vite dev server next to Flask. It reloads on every save and passes the API calls on to Flask.

```bash
# terminal 1
python run.py

# terminal 2
cd frontend
npm run dev
```

Then open 'http://localhost:5173' instead. Run `npm run build` again when you're done so Flask serves the new version.

## License

This project is open source and available under the [MIT License](LICENSE).