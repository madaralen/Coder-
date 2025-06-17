#!/usr/bin/env python3
"""
Coder Bot - A GitHub App for AI-powered code assistance
Similar to MentatBot functionality with repository interaction capabilities
"""

import os
import logging
import sqlite3
import yaml
from datetime import datetime
from flask import Flask, request, jsonify, render_template
from werkzeug.exceptions import BadRequest
import structlog

# Import our bot modules
from bot.github_app import GitHubApp
from bot.conversation_manager import ConversationManager
from bot.database import DatabaseManager
from bot.web_dashboard import create_dashboard_routes

# Load server configuration
def load_server_config():
    """Load server configuration from server.yml"""
    config_file = "server.yml"
    
    # Default configuration
    default_config = {
        'server': {
            'host': '0.0.0.0',
            'port': 8080,
            'debug': False,
            'workers': 1
        },
        'web_panel': {
            'title': 'Coder Bot Dashboard',
            'refresh_interval': 30,
            'max_conversations_display': 10,
            'max_log_entries': 1000
        },
        'security': {
            'enable_https': False,
            'ssl_cert_path': '',
            'ssl_key_path': '',
            'enable_cors': True,
            'cors_origins': ['http://localhost:3000', 'http://127.0.0.1:3000']
        }
    }
    
    try:
        if os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config = yaml.safe_load(f)
                # Merge with defaults
                for section in default_config:
                    if section not in config:
                        config[section] = default_config[section]
                    else:
                        for key in default_config[section]:
                            if key not in config[section]:
                                config[section][key] = default_config[section][key]
                return config
        else:
            print(f"Configuration file {config_file} not found, using defaults")
            return default_config
    except Exception as e:
        print(f"Error loading configuration: {e}, using defaults")
        return default_config

# Load configuration
server_config = load_server_config()

# Configure structured logging
structlog.configure(
    processors=[
        structlog.stdlib.filter_by_level,
        structlog.stdlib.add_logger_name,
        structlog.stdlib.add_log_level,
        structlog.stdlib.PositionalArgumentsFormatter(),
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.UnicodeDecoder(),
        structlog.processors.JSONRenderer()
    ],
    context_class=dict,
    logger_factory=structlog.stdlib.LoggerFactory(),
    wrapper_class=structlog.stdlib.BoundLogger,
    cache_logger_on_first_use=True,
)

logger = structlog.get_logger()

# Initialize Flask app
app = Flask(__name__)
app.config['SECRET_KEY'] = os.getenv('FLASK_SECRET_KEY', 'dev-key-change-in-production')

# Configure CORS if enabled
if server_config['security']['enable_cors']:
    try:
        from flask_cors import CORS
        CORS(app, origins=server_config['security']['cors_origins'])
        logger.info("CORS enabled", origins=server_config['security']['cors_origins'])
    except ImportError:
        logger.warning("flask-cors not installed, CORS not enabled")

# Initialize components
db_manager = DatabaseManager()
github_app = GitHubApp()
conversation_manager = ConversationManager(db_manager, github_app)

# Register dashboard routes
create_dashboard_routes(app, db_manager, conversation_manager, server_config)


@app.route('/')
def index():
    """Main dashboard page"""
    return render_template('dashboard.html')


@app.route('/health')
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })


@app.route('/webhook', methods=['POST'])
def github_webhook():
    """Handle GitHub webhook events"""
    try:
        # Verify webhook signature
        if not github_app.verify_webhook_signature(request):
            logger.warning("Invalid webhook signature")
            return jsonify({'error': 'Invalid signature'}), 401

        # Parse webhook payload
        event_type = request.headers.get('X-GitHub-Event')
        payload = request.get_json()
        
        if not payload:
            raise BadRequest("No JSON payload received")

        logger.info(
            "Received GitHub webhook",
            event_type=event_type,
            action=payload.get('action'),
            repo=payload.get('repository', {}).get('full_name'),
            sender=payload.get('sender', {}).get('login')
        )

        # Handle different webhook events
        if event_type == 'issues':
            handle_issues_event(payload)
        elif event_type == 'issue_comment':
            handle_issue_comment_event(payload)
        elif event_type == 'pull_request':
            handle_pull_request_event(payload)
        elif event_type == 'pull_request_review':
            handle_pr_review_event(payload)
        elif event_type == 'pull_request_review_comment':
            handle_pr_review_comment_event(payload)
        elif event_type == 'installation':
            handle_installation_event(payload)
        elif event_type == 'installation_repositories':
            handle_installation_repositories_event(payload)
        else:
            logger.info(f"Unhandled webhook event: {event_type}")

        return jsonify({'status': 'processed'})

    except Exception as e:
        logger.exception("Error processing webhook", error=str(e))
        return jsonify({'error': 'Internal server error'}), 500


def handle_issues_event(payload):
    """Handle issues webhook events"""
    action = payload.get('action')
    issue = payload.get('issue', {})
    repository = payload.get('repository', {})
    
    if action in ['opened', 'edited']:
        # Check if bot is mentioned or if this is a new issue
        body = issue.get('body', '')
        title = issue.get('title', '')
        
        # Check if bot should respond
        if should_respond_to_issue(payload):
            conversation_manager.handle_issue_event(payload)
    
    elif action == 'closed':
        # Archive conversation if needed
        conversation_manager.archive_conversation(
            repo_full_name=repository.get('full_name'),
            issue_number=issue.get('number')
        )


def handle_issue_comment_event(payload):
    """Handle issue comment webhook events"""
    action = payload.get('action')
    comment = payload.get('comment', {})
    issue = payload.get('issue', {})
    
    if action == 'created':
        # Check if bot is mentioned
        if should_respond_to_comment(payload):
            conversation_manager.handle_comment_event(payload)


def handle_pull_request_event(payload):
    """Handle pull request webhook events"""
    action = payload.get('action')
    pull_request = payload.get('pull_request', {})
    
    if action in ['opened', 'edited', 'synchronize']:
        # Check if bot should respond
        if should_respond_to_pr(payload):
            conversation_manager.handle_pr_event(payload)


def handle_pr_review_event(payload):
    """Handle PR review webhook events"""
    action = payload.get('action')
    if action == 'submitted':
        review = payload.get('review', {})
        if should_respond_to_review(payload):
            conversation_manager.handle_review_event(payload)


def handle_pr_review_comment_event(payload):
    """Handle PR review comment webhook events"""
    action = payload.get('action')
    if action == 'created':
        if should_respond_to_review_comment(payload):
            conversation_manager.handle_review_comment_event(payload)


def handle_installation_event(payload):
    """Handle app installation events"""
    action = payload.get('action')
    installation = payload.get('installation', {})
    
    logger.info(
        "App installation event",
        action=action,
        installation_id=installation.get('id'),
        account=installation.get('account', {}).get('login')
    )
    
    if action == 'created':
        # Initialize for new installation
        github_app.initialize_installation(installation)
    elif action == 'deleted':
        # Clean up installation data
        github_app.cleanup_installation(installation)


def handle_installation_repositories_event(payload):
    """Handle installation repositories events"""
    action = payload.get('action')
    repositories = payload.get('repositories_added', [])
    
    logger.info(
        "Installation repositories event",
        action=action,
        repos_count=len(repositories)
    )


def should_respond_to_issue(payload):
    """Determine if bot should respond to issue"""
    issue = payload.get('issue', {})
    body = issue.get('body', '')
    title = issue.get('title', '')
    sender = payload.get('sender', {})
    
    # Don't respond to own issues
    if sender.get('type') == 'Bot':
        return False
    
    # Check if bot is mentioned
    bot_username = github_app.get_bot_username()
    if f'@{bot_username}' in body or f'@{bot_username}' in title:
        return True
    
    # Check for specific keywords that indicate coding assistance is needed
    keywords = ['help', 'assist', 'code', 'bug', 'fix', 'implement', 'feature']
    return any(keyword.lower() in title.lower() or keyword.lower() in body.lower() for keyword in keywords)


def should_respond_to_comment(payload):
    """Determine if bot should respond to comment"""
    comment = payload.get('comment', {})
    body = comment.get('body', '')
    sender = payload.get('sender', {})
    
    # Don't respond to own comments
    if sender.get('type') == 'Bot':
        return False
    
    # Check if bot is mentioned
    bot_username = github_app.get_bot_username()
    return f'@{bot_username}' in body


def should_respond_to_pr(payload):
    """Determine if bot should respond to PR"""
    pull_request = payload.get('pull_request', {})
    body = pull_request.get('body', '')
    title = pull_request.get('title', '')
    sender = payload.get('sender', {})
    
    # Don't respond to own PRs
    if sender.get('type') == 'Bot':
        return False
    
    # Check if bot is mentioned
    bot_username = github_app.get_bot_username()
    return f'@{bot_username}' in body or f'@{bot_username}' in title


def should_respond_to_review(payload):
    """Determine if bot should respond to review"""
    review = payload.get('review', {})
    body = review.get('body', '')
    sender = payload.get('sender', {})
    
    if sender.get('type') == 'Bot':
        return False
    
    bot_username = github_app.get_bot_username()
    return f'@{bot_username}' in body if body else False


def should_respond_to_review_comment(payload):
    """Determine if bot should respond to review comment"""
    comment = payload.get('comment', {})
    body = comment.get('body', '')
    sender = payload.get('sender', {})
    
    if sender.get('type') == 'Bot':
        return False
    
    bot_username = github_app.get_bot_username()
    return f'@{bot_username}' in body


def initialize_environment():
    """Initialize the application environment"""
    # Check required environment variables
    required_vars = [
        'GITHUB_APP_ID',
        'GITHUB_PRIVATE_KEY',
        'GITHUB_WEBHOOK_SECRET'
    ]
    
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    if missing_vars:
        logger.error("Missing required environment variables", missing=missing_vars)
        raise EnvironmentError(f"Missing environment variables: {', '.join(missing_vars)}")
    
    # Initialize database
    db_manager.initialize()
    
    logger.info("Application initialized successfully")


if __name__ == '__main__':
    try:
        # Load environment variables from .env file if it exists
        from dotenv import load_dotenv
        load_dotenv()
        
        # Initialize application
        initialize_environment()
        
        # Start the Flask application
        host = server_config['server']['host']
        port = int(os.getenv('PORT', server_config['server']['port']))
        debug = os.getenv('FLASK_DEBUG', str(server_config['server']['debug'])).lower() == 'true'
        
        logger.info(
            "Starting Coder Bot",
            host=host,
            port=port,
            debug=debug,
            config_file="server.yml"
        )
        
        # Check for HTTPS configuration
        if server_config['security']['enable_https']:
            ssl_cert = server_config['security']['ssl_cert_path']
            ssl_key = server_config['security']['ssl_key_path']
            
            if ssl_cert and ssl_key and os.path.exists(ssl_cert) and os.path.exists(ssl_key):
                logger.info("Starting with HTTPS", cert=ssl_cert, key=ssl_key)
                app.run(host=host, port=port, debug=debug, ssl_context=(ssl_cert, ssl_key))
            else:
                logger.error("HTTPS enabled but SSL files not found or invalid")
                logger.info("Falling back to HTTP")
                app.run(host=host, port=port, debug=debug)
        else:
            app.run(host=host, port=port, debug=debug)
        
    except Exception as e:
        logger.exception("Failed to start application", error=str(e))
        exit(1)
