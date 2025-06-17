"""
Conversation Manager for Coder Bot
Handles AI conversations, context management, and repository interactions
"""

import json
import time
from datetime import datetime
from typing import Dict, List, Optional, Any
import structlog

from .ai_client import AIClient
from .database import DatabaseManager
from .github_app import GitHubApp

logger = structlog.get_logger()


class ConversationManager:
    """Manages AI conversations and GitHub interactions"""
    
    def __init__(self, db_manager: DatabaseManager, github_app: GitHubApp):
        self.db = db_manager
        self.github = github_app
        self.ai_client = AIClient()
        
        # Conversation context limits
        self.max_context_messages = 20
        self.max_file_size = 100000  # 100KB
    
    def handle_issue_event(self, payload: Dict[str, Any]):
        """Handle issue webhook events"""
        action = payload.get('action')
        issue = payload.get('issue', {})
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        sender = payload.get('sender', {})
        
        repo_full_name = repository.get('full_name')
        issue_number = issue.get('number')
        installation_id = installation.get('id')
        
        logger.info("Handling issue event", 
                   action=action, repo=repo_full_name, issue=issue_number)
        
        # Create or update conversation
        conversation_id = self._get_or_create_conversation(
            installation_id, repo_full_name, 'issue', issue_number
        )
        
        # Process the issue
        if action == 'opened':
            self._process_new_issue(conversation_id, payload)
        elif action == 'edited':
            self._process_issue_edit(conversation_id, payload)
    
    def handle_comment_event(self, payload: Dict[str, Any]):
        """Handle issue/PR comment events"""
        comment = payload.get('comment', {})
        issue = payload.get('issue', {})
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        sender = payload.get('sender', {})
        
        repo_full_name = repository.get('full_name')
        issue_number = issue.get('number')
        installation_id = installation.get('id')
        
        logger.info("Handling comment event", 
                   repo=repo_full_name, issue=issue_number)
        
        # Determine if this is an issue or PR
        context_type = 'pull_request' if 'pull_request' in issue else 'issue'
        
        # Get or create conversation
        conversation_id = self._get_or_create_conversation(
            installation_id, repo_full_name, context_type, issue_number
        )
        
        # Process the comment
        self._process_comment(conversation_id, payload)
    
    def handle_pr_event(self, payload: Dict[str, Any]):
        """Handle pull request events"""
        action = payload.get('action')
        pull_request = payload.get('pull_request', {})
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        pr_number = pull_request.get('number')
        installation_id = installation.get('id')
        
        logger.info("Handling PR event", 
                   action=action, repo=repo_full_name, pr=pr_number)
        
        # Create or update conversation
        conversation_id = self._get_or_create_conversation(
            installation_id, repo_full_name, 'pull_request', pr_number
        )
        
        # Process the PR
        if action == 'opened':
            self._process_new_pr(conversation_id, payload)
        elif action == 'edited':
            self._process_pr_edit(conversation_id, payload)
        elif action == 'synchronize':
            self._process_pr_sync(conversation_id, payload)
    
    def handle_review_event(self, payload: Dict[str, Any]):
        """Handle PR review events"""
        review = payload.get('review', {})
        pull_request = payload.get('pull_request', {})
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        pr_number = pull_request.get('number')
        installation_id = installation.get('id')
        
        logger.info("Handling review event", 
                   repo=repo_full_name, pr=pr_number)
        
        # Get conversation
        conversation_id = self._get_or_create_conversation(
            installation_id, repo_full_name, 'pull_request', pr_number
        )
        
        # Process the review
        self._process_review(conversation_id, payload)
    
    def handle_review_comment_event(self, payload: Dict[str, Any]):
        """Handle PR review comment events"""
        comment = payload.get('comment', {})
        pull_request = payload.get('pull_request', {})
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        pr_number = pull_request.get('number')
        installation_id = installation.get('id')
        
        logger.info("Handling review comment event", 
                   repo=repo_full_name, pr=pr_number)
        
        # Get conversation
        conversation_id = self._get_or_create_conversation(
            installation_id, repo_full_name, 'pull_request', pr_number
        )
        
        # Process the review comment
        self._process_review_comment(conversation_id, payload)
    
    def _get_or_create_conversation(self, installation_id: int, repo_full_name: str, 
                                   context_type: str, context_number: int) -> str:
        """Get existing conversation or create new one"""
        conversation = self.db.get_conversation(
            installation_id, repo_full_name, context_type, context_number
        )
        
        if conversation:
            return conversation['id']
        
        # Create new conversation
        conversation_id = self.db.create_conversation(
            installation_id=installation_id,
            repo_full_name=repo_full_name,
            context_type=context_type,
            context_number=context_number,
            status='active'
        )
        
        logger.info("Created new conversation", 
                   conversation_id=conversation_id,
                   repo=repo_full_name,
                   context=f"{context_type}#{context_number}")
        
        return conversation_id
    
    def _process_new_issue(self, conversation_id: str, payload: Dict[str, Any]):
        """Process a new issue"""
        issue = payload.get('issue', {})
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        title = issue.get('title', '')
        body = issue.get('body', '')
        author = issue.get('user', {}).get('login', 'unknown')
        
        # Store the issue in conversation history
        self.db.add_message(
            conversation_id=conversation_id,
            role='user',
            content=f"**Issue Title:** {title}\n\n**Description:**\n{body}",
            author=author,
            github_event_type='issue_opened'
        )
        
        # Generate AI response
        self._generate_ai_response(conversation_id, payload)
    
    def _process_issue_edit(self, conversation_id: str, payload: Dict[str, Any]):
        """Process issue edit"""
        issue = payload.get('issue', {})
        changes = payload.get('changes', {})
        
        # Check what was changed
        if 'title' in changes or 'body' in changes:
            title = issue.get('title', '')
            body = issue.get('body', '')
            author = issue.get('user', {}).get('login', 'unknown')
            
            # Store the edit in conversation history
            self.db.add_message(
                conversation_id=conversation_id,
                role='user',
                content=f"**Updated Issue Title:** {title}\n\n**Updated Description:**\n{body}",
                author=author,
                github_event_type='issue_edited'
            )
            
            # Generate AI response if significant changes
            if self._is_significant_edit(changes):
                self._generate_ai_response(conversation_id, payload)
    
    def _process_comment(self, conversation_id: str, payload: Dict[str, Any]):
        """Process a comment"""
        comment = payload.get('comment', {})
        author = comment.get('user', {}).get('login', 'unknown')
        body = comment.get('body', '')
        
        # Store the comment in conversation history
        self.db.add_message(
            conversation_id=conversation_id,
            role='user',
            content=body,
            author=author,
            github_event_type='comment_created'
        )
        
        # Generate AI response
        self._generate_ai_response(conversation_id, payload)
    
    def _process_new_pr(self, conversation_id: str, payload: Dict[str, Any]):
        """Process a new pull request"""
        pr = payload.get('pull_request', {})
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        title = pr.get('title', '')
        body = pr.get('body', '')
        author = pr.get('user', {}).get('login', 'unknown')
        
        # Get PR files for context
        pr_files = self._get_pr_files(payload)
        
        # Store the PR in conversation history
        content = f"**Pull Request Title:** {title}\n\n**Description:**\n{body}"
        if pr_files:
            content += f"\n\n**Files Changed:**\n" + "\n".join([f"- {f['filename']}" for f in pr_files[:10]])
        
        self.db.add_message(
            conversation_id=conversation_id,
            role='user',
            content=content,
            author=author,
            github_event_type='pr_opened'
        )
        
        # Generate AI response
        self._generate_ai_response(conversation_id, payload)
    
    def _process_pr_edit(self, conversation_id: str, payload: Dict[str, Any]):
        """Process PR edit"""
        pr = payload.get('pull_request', {})
        changes = payload.get('changes', {})
        
        if 'title' in changes or 'body' in changes:
            title = pr.get('title', '')
            body = pr.get('body', '')
            author = pr.get('user', {}).get('login', 'unknown')
            
            self.db.add_message(
                conversation_id=conversation_id,
                role='user',
                content=f"**Updated PR Title:** {title}\n\n**Updated Description:**\n{body}",
                author=author,
                github_event_type='pr_edited'
            )
            
            if self._is_significant_edit(changes):
                self._generate_ai_response(conversation_id, payload)
    
    def _process_pr_sync(self, conversation_id: str, payload: Dict[str, Any]):
        """Process PR synchronization (new commits)"""
        pr = payload.get('pull_request', {})
        
        # Get updated files
        pr_files = self._get_pr_files(payload)
        
        content = "**Pull Request Updated** (new commits pushed)"
        if pr_files:
            content += f"\n\n**Files Changed:**\n" + "\n".join([f"- {f['filename']}" for f in pr_files[:10]])
        
        self.db.add_message(
            conversation_id=conversation_id,
            role='system',
            content=content,
            author='system',
            github_event_type='pr_synchronize'
        )
        
        # Generate AI response for significant changes
        if len(pr_files) > 0:
            self._generate_ai_response(conversation_id, payload)
    
    def _process_review(self, conversation_id: str, payload: Dict[str, Any]):
        """Process PR review"""
        review = payload.get('review', {})
        author = review.get('user', {}).get('login', 'unknown')
        body = review.get('body', '')
        state = review.get('state', '')
        
        content = f"**Review ({state}):**\n{body}" if body else f"**Review:** {state}"
        
        self.db.add_message(
            conversation_id=conversation_id,
            role='user',
            content=content,
            author=author,
            github_event_type='review_submitted'
        )
        
        # Generate AI response if review requests changes or has comments
        if state in ['changes_requested', 'commented'] and body:
            self._generate_ai_response(conversation_id, payload)
    
    def _process_review_comment(self, conversation_id: str, payload: Dict[str, Any]):
        """Process PR review comment"""
        comment = payload.get('comment', {})
        author = comment.get('user', {}).get('login', 'unknown')
        body = comment.get('body', '')
        path = comment.get('path', '')
        
        content = f"**Review Comment on {path}:**\n{body}"
        
        self.db.add_message(
            conversation_id=conversation_id,
            role='user',
            content=content,
            author=author,
            github_event_type='review_comment_created'
        )
        
        # Generate AI response
        self._generate_ai_response(conversation_id, payload)
    
    def _generate_ai_response(self, conversation_id: str, payload: Dict[str, Any]):
        """Generate AI response for conversation"""
        try:
            # Get conversation context
            conversation = self.db.get_conversation_by_id(conversation_id)
            if not conversation:
                logger.error("Conversation not found", conversation_id=conversation_id)
                return
            
            # Get recent messages for context
            messages = self.db.get_conversation_messages(conversation_id, limit=self.max_context_messages)
            
            # Build repository context
            repo_context = self._build_repository_context(payload)
            
            # Generate AI response
            ai_response = self.ai_client.generate_response(
                messages=messages,
                repo_context=repo_context,
                conversation_context=conversation
            )
            
            if ai_response:
                # Store AI response
                self.db.add_message(
                    conversation_id=conversation_id,
                    role='assistant',
                    content=ai_response['content'],
                    author='coder-bot',
                    github_event_type='ai_response'
                )
                
                # Post response to GitHub
                self._post_github_response(payload, ai_response)
                
                # Execute any actions suggested by AI
                if 'actions' in ai_response:
                    self._execute_ai_actions(conversation_id, payload, ai_response['actions'])
            
        except Exception as e:
            logger.exception("Failed to generate AI response", 
                           conversation_id=conversation_id, error=str(e))
    
    def _build_repository_context(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """Build repository context for AI"""
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        installation_id = installation.get('id')
        
        context = {
            'repository': {
                'name': repository.get('name'),
                'full_name': repo_full_name,
                'description': repository.get('description'),
                'language': repository.get('language'),
                'default_branch': repository.get('default_branch', 'main')
            },
            'files': [],
            'structure': []
        }
        
        try:
            # Get repository structure
            files = self.github.get_repository_files(installation_id, repo_full_name)
            context['structure'] = files
            
            # Get key files for context (README, package.json, etc.)
            key_files = ['README.md', 'package.json', 'requirements.txt', 'Cargo.toml', 'go.mod']
            for file_info in files:
                if file_info['name'] in key_files and file_info['type'] == 'file':
                    content = self.github.get_file_content(installation_id, repo_full_name, file_info['path'])
                    if content and len(content) < self.max_file_size:
                        context['files'].append({
                            'path': file_info['path'],
                            'content': content
                        })
        
        except Exception as e:
            logger.exception("Failed to build repository context", 
                           repo=repo_full_name, error=str(e))
        
        return context
    
    def _get_pr_files(self, payload: Dict[str, Any]) -> List[Dict[str, Any]]:
        """Get files changed in PR"""
        # This would typically use GitHub API to get PR files
        # For now, return empty list - can be implemented later
        return []
    
    def _is_significant_edit(self, changes: Dict[str, Any]) -> bool:
        """Check if edit is significant enough to warrant AI response"""
        # Simple heuristic - if title or body changed significantly
        if 'title' in changes:
            return True
        
        if 'body' in changes:
            old_body = changes['body'].get('from', '')
            # If body changed by more than 50 characters, consider significant
            return abs(len(old_body) - len(changes.get('body', {}).get('to', ''))) > 50
        
        return False
    
    def _post_github_response(self, payload: Dict[str, Any], ai_response: Dict[str, Any]):
        """Post AI response to GitHub"""
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        installation_id = installation.get('id')
        
        # Determine where to post the response
        if 'issue' in payload:
            issue_number = payload['issue']['number']
            self.github.create_issue_comment(
                installation_id, repo_full_name, issue_number, ai_response['content']
            )
        elif 'pull_request' in payload:
            pr_number = payload['pull_request']['number']
            self.github.create_issue_comment(
                installation_id, repo_full_name, pr_number, ai_response['content']
            )
    
    def _execute_ai_actions(self, conversation_id: str, payload: Dict[str, Any], actions: List[Dict[str, Any]]):
        """Execute actions suggested by AI"""
        for action in actions:
            try:
                action_type = action.get('type')
                
                if action_type == 'create_file':
                    self._execute_create_file_action(conversation_id, payload, action)
                elif action_type == 'update_file':
                    self._execute_update_file_action(conversation_id, payload, action)
                elif action_type == 'create_pr':
                    self._execute_create_pr_action(conversation_id, payload, action)
                elif action_type == 'create_branch':
                    self._execute_create_branch_action(conversation_id, payload, action)
                else:
                    logger.warning("Unknown action type", action_type=action_type)
                    
            except Exception as e:
                logger.exception("Failed to execute AI action", 
                               action_type=action.get('type'), error=str(e))
    
    def _execute_create_file_action(self, conversation_id: str, payload: Dict[str, Any], action: Dict[str, Any]):
        """Execute create file action"""
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        installation_id = installation.get('id')
        
        file_path = action.get('path')
        content = action.get('content')
        message = action.get('message', f'Create {file_path}')
        branch = action.get('branch', 'main')
        
        success = self.github.create_or_update_file(
            installation_id, repo_full_name, file_path, content, message, branch
        )
        
        if success:
            logger.info("File created via AI action", path=file_path, repo=repo_full_name)
        else:
            logger.error("Failed to create file via AI action", path=file_path, repo=repo_full_name)
    
    def _execute_update_file_action(self, conversation_id: str, payload: Dict[str, Any], action: Dict[str, Any]):
        """Execute update file action"""
        # Similar to create file but with SHA for updates
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        installation_id = installation.get('id')
        
        file_path = action.get('path')
        content = action.get('content')
        message = action.get('message', f'Update {file_path}')
        branch = action.get('branch', 'main')
        sha = action.get('sha')  # Required for updates
        
        success = self.github.create_or_update_file(
            installation_id, repo_full_name, file_path, content, message, branch, sha
        )
        
        if success:
            logger.info("File updated via AI action", path=file_path, repo=repo_full_name)
        else:
            logger.error("Failed to update file via AI action", path=file_path, repo=repo_full_name)
    
    def _execute_create_pr_action(self, conversation_id: str, payload: Dict[str, Any], action: Dict[str, Any]):
        """Execute create PR action"""
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        installation_id = installation.get('id')
        
        title = action.get('title')
        body = action.get('body')
        head = action.get('head')
        base = action.get('base', 'main')
        
        pr = self.github.create_pull_request(
            installation_id, repo_full_name, title, body, head, base
        )
        
        if pr:
            logger.info("PR created via AI action", pr_number=pr['number'], repo=repo_full_name)
        else:
            logger.error("Failed to create PR via AI action", repo=repo_full_name)
    
    def _execute_create_branch_action(self, conversation_id: str, payload: Dict[str, Any], action: Dict[str, Any]):
        """Execute create branch action"""
        repository = payload.get('repository', {})
        installation = payload.get('installation', {})
        
        repo_full_name = repository.get('full_name')
        installation_id = installation.get('id')
        
        branch_name = action.get('name')
        source_branch = action.get('source', 'main')
        
        success = self.github.create_branch(
            installation_id, repo_full_name, branch_name, source_branch
        )
        
        if success:
            logger.info("Branch created via AI action", branch=branch_name, repo=repo_full_name)
        else:
            logger.error("Failed to create branch via AI action", branch=branch_name, repo=repo_full_name)
    
    def archive_conversation(self, repo_full_name: str, issue_number: int):
        """Archive a conversation when issue/PR is closed"""
        try:
            conversation = self.db.get_conversation_by_context(repo_full_name, issue_number)
            if conversation:
                self.db.update_conversation_status(conversation['id'], 'archived')
                logger.info("Conversation archived", 
                           conversation_id=conversation['id'],
                           repo=repo_full_name,
                           issue=issue_number)
        except Exception as e:
            logger.exception("Failed to archive conversation", 
                           repo=repo_full_name, issue=issue_number, error=str(e))
