# Flask AI Chat Wrapper

This is a full-stack AI chat application built with Flask and AWS Bedrock. With multiple model support, asynchronous background tasks, and persistent history, and user authentication.

![Project screenshot](/media/index.png) 
![Project screenshot 2](/media/index2.png) 

## Features

**Multi Model Support:** Switch between many popular AI models such as **Claude 3 Haiku**, **Llama 3**, and **Mistral** using AWS Bedrock.

**Persistent History:** All conversations are stored in a relational database using `SQLAlchemy`.

**Smart Title Generation:** Uses background **threading** to auto generate chat titles without blocking the UI response.

**User Authentication:** Secure login and registration system using `Flask-Login` and `Bcrypt` hashing.

**Modern UI:** Responsive Bootstrap 5 interface with a dynamic sidebar, modals, and mobile support.

**CRUD Functionality:** Users can Load, Rename and Delete conversations instantly.

## Tech Stack

**Backend:** Python (Flask), Flask-SQLAlchemy 

**AI:** AWS Bedrock (Boto3)

**Database:** SQLite (Development) & PostgreSQL (Production ready)

**Frontend:** Bootstrap 5, Jinja2, JavaScript (Fetch API)

## Installation

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
    AWS_BEARER_TOKEN_BEDROCK=your_aws_bedrock_api
    ```

5.  **Initialize the database**
    ```bash
    flask db init
    flask db migrate
    flask db upgrade
    ```

6.  **Run the Application**
    ```bash
    python run.py
    ```
    Access the app at 'http://127.0.0.1:5000'

## License

This project is open source and available under the [MIT License](LICENSE).