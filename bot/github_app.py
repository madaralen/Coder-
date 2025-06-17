"""
GitHub App integration for Coder Bot
Handles authentication, API calls, and webhook verification
"""

import os
import time
import hmac
import hashlib
import logging
from datetime import datetime, timedelta
from typing import Optional, Dict, List, Any

import jwt
import requests
from github import Github, GithubIntegration
import structlog

logger = structlog.get_logger()


class GitHubApp:
    """Handles GitHub App authentication and API interactions"""
    
    def __init__(self):
        self.app_id = os.getenv('GITHUB_APP_ID')
        self.private_key = os.getenv('GITHUB_PRIVATE_KEY')
        self.webhook_secret = os.getenv('GITHUB_WEBHOOK_SECRET')
        
        if not all([self.app_id, self.private_key, self.webhook_secret]):
            raise ValueError("Missing required GitHub App credentials")
        
        # Initialize GitHub integration
        self.integration = GithubIntegration(self.app_id, self.private_key)
        self.bot_username = None
        
        # Cache for installation tokens
        self.token_cache = {}
        
    def get_bot_username(self) -> str:
        """Get the bot's GitHub username"""
        if not self.bot_username:
            try:
                # Get app info to determine bot username
                jwt_token = self.get_jwt_token()
                headers = {
                    'Authorization': f'Bearer {jwt_token}',
                    'Accept': 'application/vnd.github.v3+json'
                }
                
                response = requests.get('https://api.github.com/app', headers=headers)
                response.raise_for_status()
                
                app_data = response.json()
                self.bot_username = app_data.get('slug', 'coder-bot')
                
            except Exception as e:
                logger.exception("Failed to get bot username", error=str(e))
                self.bot_username = 'coder-bot'  # fallback
                
        return self.bot_username
    
    def get_jwt_token(self) -> str:
        """Generate JWT token for GitHub App authentication"""
        now = int(time.time())
        payload = {
            'iat': now - 60,  # Issued at time (60 seconds ago to account for clock skew)
            'exp': now + 600,  # Expiration time (10 minutes from now)
            'iss': self.app_id  # Issuer (GitHub App ID)
        }
        
        return jwt.encode(payload, self.private_key, algorithm='RS256')
    
    def get_installation_token(self, installation_id: int) -> str:
        """Get installation access token (cached for efficiency)"""
        cache_key = f"token_{installation_id}"
        
        # Check cache
        if cache_key in self.token_cache:
            token_data = self.token_cache[cache_key]
            # Check if token expires in next 5 minutes
            if datetime.fromisoformat(token_data['expires_at'].replace('Z', '+00:00')) > datetime.now().astimezone() + timedelta(minutes=5):
                return token_data['token']
        
        try:
            # Get new token from GitHub
            token = self.integration.get_access_token(installation_id)
            
            # Cache the token
            self.token_cache[cache_key] = {
                'token': token.token,
                'expires_at': token.expires_at
            }
            
            return token.token
            
        except Exception as e:
            logger.exception("Failed to get installation token", 
                           installation_id=installation_id, error=str(e))
            raise
    
    def get_github_client(self, installation_id: int) -> Github:
        """Get authenticated GitHub client for installation"""
        token = self.get_installation_token(installation_id)
        return Github(token)
    
    def verify_webhook_signature(self, request) -> bool:
        """Verify GitHub webhook signature"""
        signature = request.headers.get('X-Hub-Signature-256')
        if not signature:
            return False
        
        # Calculate expected signature
        expected_signature = 'sha256=' + hmac.new(
            self.webhook_secret.encode(),
            request.get_data(),
            hashlib.sha256
        ).hexdigest()
        
        return hmac.compare_digest(signature, expected_signature)
    
    def get_repository_files(self, installation_id: int, repo_full_name: str, 
                           path: str = "", ref: str = "main") -> List[Dict[str, Any]]:
        """Get repository files and directories"""
        try:
            github = self.get_github_client(installation_id)
            repo = github.get_repo(repo_full_name)
            
            contents = repo.get_contents(path, ref=ref)
            
            files = []
            for content in contents:
                files.append({
                    'name': content.name,
                    'path': content.path,
                    'type': content.type,  # 'file' or 'dir'
                    'size': content.size,
                    'sha': content.sha,
                    'download_url': content.download_url if content.type == 'file' else None
                })
            
            return sorted(files, key=lambda x: (x['type'] != 'dir', x['name'].lower()))
            
        except Exception as e:
            logger.exception("Failed to get repository files", 
                           repo=repo_full_name, path=path, error=str(e))
            return []
    
    def get_file_content(self, installation_id: int, repo_full_name: str, 
                        file_path: str, ref: str = "main") -> Optional[str]:
        """Get content of a specific file"""
        try:
            github = self.get_github_client(installation_id)
            repo = github.get_repo(repo_full_name)
            
            file_content = repo.get_contents(file_path, ref=ref)
            
            if file_content.type != 'file':
                return None
                
            # Decode content (GitHub API returns base64 encoded content)
            return file_content.decoded_content.decode('utf-8')
            
        except Exception as e:
            logger.exception("Failed to get file content", 
                           repo=repo_full_name, path=file_path, error=str(e))
            return None
    
    def create_or_update_file(self, installation_id: int, repo_full_name: str, 
                             file_path: str, content: str, message: str, 
                             branch: str = "main", sha: Optional[str] = None) -> bool:
        """Create or update a file in the repository"""
        try:
            github = self.get_github_client(installation_id)
            repo = github.get_repo(repo_full_name)
            
            if sha:
                # Update existing file
                repo.update_file(file_path, message, content, sha, branch=branch)
            else:
                # Create new file
                repo.create_file(file_path, message, content, branch=branch)
            
            logger.info("File updated successfully", 
                       repo=repo_full_name, path=file_path, branch=branch)
            return True
            
        except Exception as e:
            logger.exception("Failed to create/update file", 
                           repo=repo_full_name, path=file_path, error=str(e))
            return False
    
    def create_pull_request(self, installation_id: int, repo_full_name: str, 
                           title: str, body: str, head: str, base: str = "main") -> Optional[Dict[str, Any]]:
        """Create a pull request"""
        try:
            github = self.get_github_client(installation_id)
            repo = github.get_repo(repo_full_name)
            
            pr = repo.create_pull(
                title=title,
                body=body,
                head=head,
                base=base
            )
            
            logger.info("Pull request created", 
                       repo=repo_full_name, pr_number=pr.number, title=title)
            
            return {
                'number': pr.number,
                'url': pr.html_url,
                'title': pr.title,
                'body': pr.body,
                'head': pr.head.ref,
                'base': pr.base.ref
            }
            
        except Exception as e:
            logger.exception("Failed to create pull request", 
                           repo=repo_full_name, title=title, error=str(e))
            return None
    
    def create_issue_comment(self, installation_id: int, repo_full_name: str, 
                            issue_number: int, body: str) -> bool:
        """Create a comment on an issue or PR"""
        try:
            github = self.get_github_client(installation_id)
            repo = github.get_repo(repo_full_name)
            
            issue = repo.get_issue(issue_number)
            issue.create_comment(body)
            
            logger.info("Comment created", 
                       repo=repo_full_name, issue=issue_number)
            return True
            
        except Exception as e:
            logger.exception("Failed to create comment", 
                           repo=repo_full_name, issue=issue_number, error=str(e))
            return False
    
    def create_branch(self, installation_id: int, repo_full_name: str, 
                     branch_name: str, source_branch: str = "main") -> bool:
        """Create a new branch"""
        try:
            github = self.get_github_client(installation_id)
            repo = github.get_repo(repo_full_name)
            
            # Get source branch reference
            source_ref = repo.get_git_ref(f"heads/{source_branch}")
            
            # Create new branch
            repo.create_git_ref(
                ref=f"refs/heads/{branch_name}",
                sha=source_ref.object.sha
            )
            
            logger.info("Branch created", 
                       repo=repo_full_name, branch=branch_name, source=source_branch)
            return True
            
        except Exception as e:
            logger.exception("Failed to create branch", 
                           repo=repo_full_name, branch=branch_name, error=str(e))
            return False
    
    def get_installation_repositories(self, installation_id: int) -> List[Dict[str, Any]]:
        """Get repositories accessible by installation"""
        try:
            github = self.get_github_client(installation_id)
            
            # Get installation repositories
            installations = github.get_installation(installation_id)
            repos = installations.get_repos()
            
            repositories = []
            for repo in repos:
                repositories.append({
                    'id': repo.id,
                    'name': repo.name,
                    'full_name': repo.full_name,
                    'description': repo.description,
                    'private': repo.private,
                    'default_branch': repo.default_branch,
                    'html_url': repo.html_url,
                    'clone_url': repo.clone_url
                })
            
            return repositories
            
        except Exception as e:
            logger.exception("Failed to get installation repositories", 
                           installation_id=installation_id, error=str(e))
            return []
    
    def initialize_installation(self, installation_data: Dict[str, Any]):
        """Initialize a new installation"""
        installation_id = installation_data.get('id')
        account = installation_data.get('account', {})
        
        logger.info("Initializing installation", 
                   installation_id=installation_id,
                   account=account.get('login'))
        
        # Could add setup logic here (e.g., create welcome issue)
    
    def cleanup_installation(self, installation_data: Dict[str, Any]):
        """Clean up when installation is removed"""
        installation_id = installation_data.get('id')
        
        logger.info("Cleaning up installation", installation_id=installation_id)
        
        # Remove cached tokens
        cache_key = f"token_{installation_id}"
        if cache_key in self.token_cache:
            del self.token_cache[cache_key]
