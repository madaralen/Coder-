"""
Database Manager for Coder Bot
Handles conversation storage, message history, and agent state
"""

import sqlite3
import json
import uuid
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Any
import structlog

logger = structlog.get_logger()


class DatabaseManager:
    """Manages SQLite database for conversation and message storage"""
    
    def __init__(self, db_path: str = "coder_bot.db"):
        self.db_path = db_path
        self.connection = None
    
    def initialize(self):
        """Initialize database and create tables"""
        try:
            self.connection = sqlite3.connect(self.db_path, check_same_thread=False)
            self.connection.row_factory = sqlite3.Row  # Enable dict-like access
            
            self._create_tables()
            logger.info("Database initialized", db_path=self.db_path)
            
        except Exception as e:
            logger.exception("Failed to initialize database", error=str(e))
            raise
    
    def _create_tables(self):
        """Create database tables"""
        cursor = self.connection.cursor()
        
        # Conversations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS conversations (
                id TEXT PRIMARY KEY,
                installation_id INTEGER NOT NULL,
                repo_full_name TEXT NOT NULL,
                context_type TEXT NOT NULL,  -- 'issue', 'pull_request'
                context_number INTEGER NOT NULL,
                status TEXT NOT NULL DEFAULT 'active',  -- 'active', 'archived', 'paused'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,  -- JSON for additional data
                UNIQUE(installation_id, repo_full_name, context_type, context_number)
            )
        """)
        
        # Messages table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                role TEXT NOT NULL,  -- 'user', 'assistant', 'system'
                content TEXT NOT NULL,
                author TEXT,  -- GitHub username
                github_event_type TEXT,  -- 'issue_opened', 'comment_created', etc.
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                metadata TEXT,  -- JSON for additional data
                FOREIGN KEY (conversation_id) REFERENCES conversations (id)
            )
        """)
        
        # Installations table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS installations (
                id INTEGER PRIMARY KEY,
                account_login TEXT NOT NULL,
                account_type TEXT NOT NULL,  -- 'User', 'Organization'
                installed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                repositories TEXT,  -- JSON array of repo names
                metadata TEXT  -- JSON for additional data
            )
        """)
        
        # Agent actions table (for tracking what the bot does)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS agent_actions (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                action_type TEXT NOT NULL,  -- 'file_created', 'pr_created', etc.
                action_data TEXT NOT NULL,  -- JSON data
                status TEXT NOT NULL DEFAULT 'pending',  -- 'pending', 'completed', 'failed'
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                completed_at TIMESTAMP,
                error_message TEXT,
                FOREIGN KEY (conversation_id) REFERENCES conversations (id)
            )
        """)
        
        # Create indexes for better performance
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_repo ON conversations (repo_full_name)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_conversations_installation ON conversations (installation_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages (conversation_id)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_messages_created ON messages (created_at)")
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_actions_conversation ON agent_actions (conversation_id)")
        
        self.connection.commit()
    
    def get_connection(self) -> sqlite3.Connection:
        """Get database connection"""
        if not self.connection:
            self.initialize()
        return self.connection
    
    def create_conversation(self, installation_id: int, repo_full_name: str, 
                           context_type: str, context_number: int, 
                           status: str = 'active', metadata: Dict[str, Any] = None) -> str:
        """Create a new conversation"""
        conversation_id = str(uuid.uuid4())
        
        cursor = self.get_connection().cursor()
        cursor.execute("""
            INSERT INTO conversations 
            (id, installation_id, repo_full_name, context_type, context_number, status, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            conversation_id,
            installation_id,
            repo_full_name,
            context_type,
            context_number,
            status,
            json.dumps(metadata) if metadata else None
        ))
        
        self.connection.commit()
        
        logger.info("Created conversation", 
                   conversation_id=conversation_id,
                   repo=repo_full_name,
                   context=f"{context_type}#{context_number}")
        
        return conversation_id
    
    def get_conversation(self, installation_id: int, repo_full_name: str, 
                        context_type: str, context_number: int) -> Optional[Dict[str, Any]]:
        """Get conversation by context"""
        cursor = self.get_connection().cursor()
        cursor.execute("""
            SELECT * FROM conversations 
            WHERE installation_id = ? AND repo_full_name = ? 
            AND context_type = ? AND context_number = ?
        """, (installation_id, repo_full_name, context_type, context_number))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_conversation_by_id(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get conversation by ID"""
        cursor = self.get_connection().cursor()
        cursor.execute("SELECT * FROM conversations WHERE id = ?", (conversation_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def get_conversation_by_context(self, repo_full_name: str, context_number: int) -> Optional[Dict[str, Any]]:
        """Get conversation by repo and context number (for archiving)"""
        cursor = self.get_connection().cursor()
        cursor.execute("""
            SELECT * FROM conversations 
            WHERE repo_full_name = ? AND context_number = ?
            ORDER BY created_at DESC LIMIT 1
        """, (repo_full_name, context_number))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def update_conversation_status(self, conversation_id: str, status: str):
        """Update conversation status"""
        cursor = self.get_connection().cursor()
        cursor.execute("""
            UPDATE conversations 
            SET status = ?, updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (status, conversation_id))
        
        self.connection.commit()
    
    def add_message(self, conversation_id: str, role: str, content: str, 
                   author: str = None, github_event_type: str = None, 
                   metadata: Dict[str, Any] = None) -> str:
        """Add a message to conversation"""
        message_id = str(uuid.uuid4())
        
        cursor = self.get_connection().cursor()
        cursor.execute("""
            INSERT INTO messages 
            (id, conversation_id, role, content, author, github_event_type, metadata)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (
            message_id,
            conversation_id,
            role,
            content,
            author,
            github_event_type,
            json.dumps(metadata) if metadata else None
        ))
        
        # Update conversation timestamp
        cursor.execute("""
            UPDATE conversations 
            SET updated_at = CURRENT_TIMESTAMP 
            WHERE id = ?
        """, (conversation_id,))
        
        self.connection.commit()
        
        return message_id
    
    def get_conversation_messages(self, conversation_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """Get messages for a conversation"""
        cursor = self.get_connection().cursor()
        cursor.execute("""
            SELECT * FROM messages 
            WHERE conversation_id = ? 
            ORDER BY created_at ASC 
            LIMIT ?
        """, (conversation_id, limit))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_active_conversations(self, installation_id: int = None, 
                                limit: int = 50) -> List[Dict[str, Any]]:
        """Get active conversations"""
        cursor = self.get_connection().cursor()
        
        if installation_id:
            cursor.execute("""
                SELECT c.*, 
                       (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
                       (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
                FROM conversations c 
                WHERE c.installation_id = ? AND c.status = 'active'
                ORDER BY c.updated_at DESC 
                LIMIT ?
            """, (installation_id, limit))
        else:
            cursor.execute("""
                SELECT c.*, 
                       (SELECT COUNT(*) FROM messages WHERE conversation_id = c.id) as message_count,
                       (SELECT created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1) as last_message_at
                FROM conversations c 
                WHERE c.status = 'active'
                ORDER BY c.updated_at DESC 
                LIMIT ?
            """, (limit,))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def record_agent_action(self, conversation_id: str, action_type: str, 
                           action_data: Dict[str, Any], status: str = 'pending') -> str:
        """Record an agent action"""
        action_id = str(uuid.uuid4())
        
        cursor = self.get_connection().cursor()
        cursor.execute("""
            INSERT INTO agent_actions 
            (id, conversation_id, action_type, action_data, status)
            VALUES (?, ?, ?, ?, ?)
        """, (
            action_id,
            conversation_id,
            action_type,
            json.dumps(action_data),
            status
        ))
        
        self.connection.commit()
        
        return action_id
    
    def update_agent_action(self, action_id: str, status: str, error_message: str = None):
        """Update agent action status"""
        cursor = self.get_connection().cursor()
        
        if status == 'completed':
            cursor.execute("""
                UPDATE agent_actions 
                SET status = ?, completed_at = CURRENT_TIMESTAMP, error_message = ?
                WHERE id = ?
            """, (status, error_message, action_id))
        else:
            cursor.execute("""
                UPDATE agent_actions 
                SET status = ?, error_message = ?
                WHERE id = ?
            """, (status, error_message, action_id))
        
        self.connection.commit()
    
    def get_agent_actions(self, conversation_id: str, limit: int = 20) -> List[Dict[str, Any]]:
        """Get agent actions for a conversation"""
        cursor = self.get_connection().cursor()
        cursor.execute("""
            SELECT * FROM agent_actions 
            WHERE conversation_id = ? 
            ORDER BY created_at DESC 
            LIMIT ?
        """, (conversation_id, limit))
        
        return [dict(row) for row in cursor.fetchall()]
    
    def get_installation_info(self, installation_id: int) -> Optional[Dict[str, Any]]:
        """Get installation information"""
        cursor = self.get_connection().cursor()
        cursor.execute("SELECT * FROM installations WHERE id = ?", (installation_id,))
        
        row = cursor.fetchone()
        return dict(row) if row else None
    
    def upsert_installation(self, installation_id: int, account_login: str, 
                           account_type: str, repositories: List[str] = None):
        """Insert or update installation info"""
        cursor = self.get_connection().cursor()
        
        # Check if installation exists
        cursor.execute("SELECT id FROM installations WHERE id = ?", (installation_id,))
        exists = cursor.fetchone()
        
        if exists:
            cursor.execute("""
                UPDATE installations 
                SET account_login = ?, account_type = ?, repositories = ?, updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            """, (
                account_login,
                account_type,
                json.dumps(repositories) if repositories else None,
                installation_id
            ))
        else:
            cursor.execute("""
                INSERT INTO installations 
                (id, account_login, account_type, repositories)
                VALUES (?, ?, ?, ?)
            """, (
                installation_id,
                account_login,
                account_type,
                json.dumps(repositories) if repositories else None
            ))
        
        self.connection.commit()
    
    def delete_installation(self, installation_id: int):
        """Delete installation and related data"""
        cursor = self.get_connection().cursor()
        
        # Delete related conversations and messages
        cursor.execute("""
            DELETE FROM messages WHERE conversation_id IN (
                SELECT id FROM conversations WHERE installation_id = ?
            )
        """, (installation_id,))
        
        cursor.execute("DELETE FROM conversations WHERE installation_id = ?", (installation_id,))
        cursor.execute("DELETE FROM installations WHERE id = ?", (installation_id,))
        
        self.connection.commit()
        
        logger.info("Deleted installation data", installation_id=installation_id)
    
    def get_statistics(self) -> Dict[str, Any]:
        """Get bot usage statistics"""
        cursor = self.get_connection().cursor()
        
        # Get conversation counts
        cursor.execute("SELECT COUNT(*) FROM conversations WHERE status = 'active'")
        active_conversations = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM conversations")
        total_conversations = cursor.fetchone()[0]
        
        # Get message counts
        cursor.execute("SELECT COUNT(*) FROM messages WHERE role = 'assistant'")
        bot_messages = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM messages WHERE role = 'user'")
        user_messages = cursor.fetchone()[0]
        
        # Get recent activity
        cursor.execute("""
            SELECT COUNT(*) FROM messages 
            WHERE created_at > datetime('now', '-24 hours')
        """)
        messages_24h = cursor.fetchone()[0]
        
        cursor.execute("""
            SELECT COUNT(*) FROM conversations 
            WHERE created_at > datetime('now', '-7 days')
        """)
        conversations_7d = cursor.fetchone()[0]
        
        # Get installation count
        cursor.execute("SELECT COUNT(*) FROM installations")
        total_installations = cursor.fetchone()[0]
        
        return {
            'conversations': {
                'active': active_conversations,
                'total': total_conversations,
                'new_this_week': conversations_7d
            },
            'messages': {
                'bot_messages': bot_messages,
                'user_messages': user_messages,
                'total': bot_messages + user_messages,
                'last_24h': messages_24h
            },
            'installations': {
                'total': total_installations
            }
        }
    
    def cleanup_old_data(self, days_old: int = 90):
        """Clean up old archived conversations and messages"""
        cursor = self.get_connection().cursor()
        
        # Delete old archived conversations and their messages
        cursor.execute("""
            DELETE FROM messages WHERE conversation_id IN (
                SELECT id FROM conversations 
                WHERE status = 'archived' AND updated_at < datetime('now', '-{} days')
            )
        """.format(days_old))
        
        cursor.execute("""
            DELETE FROM conversations 
            WHERE status = 'archived' AND updated_at < datetime('now', '-{} days')
        """.format(days_old))
        
        # Delete old completed agent actions
        cursor.execute("""
            DELETE FROM agent_actions 
            WHERE status = 'completed' AND completed_at < datetime('now', '-{} days')
        """.format(days_old))
        
        self.connection.commit()
        
        logger.info("Cleaned up old data", days_old=days_old)
    
    def close(self):
        """Close database connection"""
        if self.connection:
            self.connection.close()
            self.connection = None
