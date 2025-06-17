# Coder Bot 🤖

A Python-based GitHub App that provides AI-powered code assistance, similar to MentatBot. Coder Bot can interact with issues, pull requests, review code, create files, and help with various development tasks directly in your GitHub repositories.

## 🌟 Features

- **AI-Powered Conversations**: Intelligent responses to issues, PRs, and comments
- **Code Analysis**: Review and analyze code changes
- **File Operations**: Create, update, and manage repository files
- **Pull Request Management**: Create PRs and provide code reviews
- **Repository Integration**: Full GitHub API integration
- **Web Dashboard**: Monitor bot activity and conversations
- **Multi-Repository Support**: Works across multiple repositories and organizations

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- GitHub App (you'll need to create one)
- OpenAI API key (or configure alternative AI provider)

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/coder-bot.git
cd coder-bot
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Create a GitHub App

1. Go to GitHub Settings > Developer settings > GitHub Apps
2. Click "New GitHub App"
3. Fill in the basic information:
   - **App name**: Coder Bot (or your preferred name)
   - **Homepage URL**: Your deployment URL
   - **Webhook URL**: `https://your-domain.com/webhook`
   - **Webhook secret**: Generate a secure secret

4. Set the following **Repository permissions**:
   - Issues: Read & Write
   - Pull requests: Read & Write
   - Contents: Read & Write
   - Metadata: Read

5. Subscribe to these **events**:
   - Issues
   - Issue comments
   - Pull requests
   - Pull request reviews
   - Pull request review comments

6. Create the app and note down:
   - App ID
   - Generate and download the private key

### 4. Configure Environment

Copy the example environment file and fill in your details:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
GITHUB_APP_ID=123456
GITHUB_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----
Your private key content here
-----END RSA PRIVATE KEY-----"
GITHUB_WEBHOOK_SECRET=your_webhook_secret
OPENAI_API_KEY=sk-your_openai_api_key
```

### 5. Run the Application

```bash
python main.py
```

The bot will start on `http://localhost:8080` by default.

### 6. Install the App

1. Go to your GitHub App settings
2. Click "Install App"
3. Select the repositories you want to enable the bot for
4. Grant the required permissions

## 📊 Web Dashboard

Access the web dashboard at `http://localhost:8080/dashboard` to:

- Monitor active conversations
- View bot statistics
- Track agent actions
- Review system logs
- Manage installations

## 🎯 Usage

Once installed, you can interact with Coder Bot by:

### In Issues
- Mention `@your-bot-name` in issue comments
- Create issues with keywords like "help", "bug", "implement"
- The bot will analyze the issue and provide assistance

### In Pull Requests
- Mention `@your-bot-name` in PR comments or descriptions
- The bot can review code changes and provide feedback
- Ask for specific help with code improvements

### Example Interactions

```markdown
@coder-bot can you help me implement a login system for this React app?
```

```markdown
@coder-bot please review this code and suggest improvements
```

```markdown
@coder-bot create a README file for this project
```

## 🔧 Configuration

### AI Providers

Currently supports OpenAI GPT models. You can extend support for other providers by modifying `bot/ai_client.py`.

### Database

Uses SQLite by default. For production, consider using PostgreSQL or MySQL by updating the database configuration.

### Webhooks

Ensure your webhook URL is publicly accessible. For local development, use tools like:
- [ngrok](https://ngrok.com/)
- [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/)

## 🏗️ Architecture

```
coder-bot/
├── main.py                 # Application entry point
├── bot/
│   ├── __init__.py
│   ├── github_app.py       # GitHub App integration
│   ├── conversation_manager.py  # Conversation handling
│   ├── ai_client.py        # AI/LLM integration
│   ├── database.py         # Database operations
│   └── web_dashboard.py    # Web interface
├── templates/              # HTML templates
├── static/                 # Static assets
└── requirements.txt        # Python dependencies
```

### Key Components

- **GitHub App**: Handles authentication and API calls
- **Conversation Manager**: Manages AI conversations and context
- **AI Client**: Interfaces with language models
- **Database Manager**: Stores conversations and bot state
- **Web Dashboard**: Provides monitoring interface

## 🚀 Deployment

### Using Docker

Create a `Dockerfile`:

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .

EXPOSE 8080
CMD ["python", "main.py"]
```

Build and run:

```bash
docker build -t coder-bot .
docker run -p 8080:8080 --env-file .env coder-bot
```

### Using Heroku

1. Create a Heroku app
2. Set environment variables in Heroku dashboard
3. Deploy using Git or GitHub integration

### Using Railway/Render

1. Connect your repository
2. Set environment variables
3. Deploy with automatic builds

## 🛠️ Development

### Running in Development Mode

```bash
export FLASK_DEBUG=True
python main.py
```

### Adding New Features

1. **New AI Capabilities**: Extend `bot/ai_client.py`
2. **GitHub Integrations**: Modify `bot/github_app.py`
3. **Webhook Events**: Add handlers in `main.py`
4. **Dashboard Features**: Update `bot/web_dashboard.py`

### Testing

```bash
# Install test dependencies
pip install pytest pytest-cov

# Run tests
pytest tests/
```

## 🔒 Security

- Webhook signatures are verified for all GitHub events
- Private keys are stored securely in environment variables
- Database connections use parameterized queries
- API keys are never logged or exposed

## 📝 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GITHUB_APP_ID` | Your GitHub App ID | Yes |
| `GITHUB_PRIVATE_KEY` | GitHub App private key | Yes |
| `GITHUB_WEBHOOK_SECRET` | Webhook secret for verification | Yes |
| `OPENAI_API_KEY` | OpenAI API key | Yes |
| `FLASK_SECRET_KEY` | Flask session secret | Yes |
| `PORT` | Server port (default: 8080) | No |
| `FLASK_DEBUG` | Enable debug mode | No |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by [MentatBot](https://mentat.ai)
- Built with [PyGithub](https://github.com/PyGithub/PyGithub)
- Uses [OpenAI GPT](https://openai.com/api/) for AI capabilities
- Web interface powered by [Flask](https://flask.palletsprojects.com/)

## 📞 Support

- Create an issue for bug reports
- Start a discussion for feature requests
- Check the [wiki](../../wiki) for additional documentation

---

Made with ❤️ for the developer community
