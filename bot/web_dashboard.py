"""
Web Dashboard for Coder Bot
Provides a simple web interface to monitor bot activity
"""

from flask import render_template, jsonify, request
from typing import Dict, Any
import structlog

from .database import DatabaseManager
from .conversation_manager import ConversationManager

logger = structlog.get_logger()


def create_dashboard_routes(app, db_manager: DatabaseManager, conversation_manager: ConversationManager, server_config: dict):
    """Create dashboard routes for the Flask app"""
    
    @app.route('/dashboard')
    def dashboard():
        """Main dashboard page"""
        try:
            # Get statistics
            stats = db_manager.get_statistics()
            
            # Get recent conversations
            max_display = server_config['web_panel']['max_conversations_display']
            recent_conversations = db_manager.get_active_conversations(limit=max_display)
            
            # Format conversations for display
            formatted_conversations = []
            for conv in recent_conversations:
                formatted_conversations.append({
                    'id': conv['id'],
                    'repo': conv['repo_full_name'],
                    'type': conv['context_type'],
                    'number': conv['context_number'],
                    'status': conv['status'],
                    'created_at': conv['created_at'],
                    'updated_at': conv['updated_at'],
                    'message_count': conv.get('message_count', 0),
                    'last_message_at': conv.get('last_message_at')
                })
            
            return render_template('dashboard.html', 
                                 stats=stats, 
                                 conversations=formatted_conversations,
                                 config=server_config)
                                 
        except Exception as e:
            logger.exception("Dashboard error", error=str(e))
            return render_template('error.html', error="Dashboard temporarily unavailable"), 500
    
    @app.route('/api/stats')
    def api_stats():
        """API endpoint for statistics"""
        try:
            stats = db_manager.get_statistics()
            return jsonify(stats)
        except Exception as e:
            logger.exception("Stats API error", error=str(e))
            return jsonify({'error': 'Failed to get statistics'}), 500
    
    @app.route('/api/conversations')
    def api_conversations():
        """API endpoint for conversations"""
        try:
            limit = request.args.get('limit', 20, type=int)
            installation_id = request.args.get('installation_id', type=int)
            
            conversations = db_manager.get_active_conversations(
                installation_id=installation_id, 
                limit=limit
            )
            
            # Format for JSON response
            formatted_conversations = []
            for conv in conversations:
                formatted_conversations.append({
                    'id': conv['id'],
                    'installation_id': conv['installation_id'],
                    'repo_full_name': conv['repo_full_name'],
                    'context_type': conv['context_type'],
                    'context_number': conv['context_number'],
                    'status': conv['status'],
                    'created_at': conv['created_at'],
                    'updated_at': conv['updated_at'],
                    'message_count': conv.get('message_count', 0),
                    'last_message_at': conv.get('last_message_at'),
                    'github_url': f"https://github.com/{conv['repo_full_name']}/{'issues' if conv['context_type'] == 'issue' else 'pull'}/{conv['context_number']}"
                })
            
            return jsonify(formatted_conversations)
            
        except Exception as e:
            logger.exception("Conversations API error", error=str(e))
            return jsonify({'error': 'Failed to get conversations'}), 500
    
    @app.route('/api/conversation/<conversation_id>')
    def api_conversation_detail(conversation_id: str):
        """API endpoint for conversation details"""
        try:
            # Get conversation
            conversation = db_manager.get_conversation_by_id(conversation_id)
            if not conversation:
                return jsonify({'error': 'Conversation not found'}), 404
            
            # Get messages
            messages = db_manager.get_conversation_messages(conversation_id)
            
            # Get agent actions
            actions = db_manager.get_agent_actions(conversation_id)
            
            # Format response
            response = {
                'conversation': {
                    'id': conversation['id'],
                    'installation_id': conversation['installation_id'],
                    'repo_full_name': conversation['repo_full_name'],
                    'context_type': conversation['context_type'],
                    'context_number': conversation['context_number'],
                    'status': conversation['status'],
                    'created_at': conversation['created_at'],
                    'updated_at': conversation['updated_at'],
                    'github_url': f"https://github.com/{conversation['repo_full_name']}/{'issues' if conversation['context_type'] == 'issue' else 'pull'}/{conversation['context_number']}"
                },
                'messages': [
                    {
                        'id': msg['id'],
                        'role': msg['role'],
                        'content': msg['content'],
                        'author': msg['author'],
                        'github_event_type': msg['github_event_type'],
                        'created_at': msg['created_at']
                    } for msg in messages
                ],
                'actions': [
                    {
                        'id': action['id'],
                        'action_type': action['action_type'],
                        'status': action['status'],
                        'created_at': action['created_at'],
                        'completed_at': action.get('completed_at'),
                        'error_message': action.get('error_message')
                    } for action in actions
                ]
            }
            
            return jsonify(response)
            
        except Exception as e:
            logger.exception("Conversation detail API error", error=str(e))
            return jsonify({'error': 'Failed to get conversation details'}), 500
    
    @app.route('/conversation/<conversation_id>')
    def conversation_detail(conversation_id: str):
        """Conversation detail page"""
        try:
            # Get conversation
            conversation = db_manager.get_conversation_by_id(conversation_id)
            if not conversation:
                return render_template('error.html', error="Conversation not found"), 404
            
            # Get messages
            messages = db_manager.get_conversation_messages(conversation_id)
            
            # Get agent actions
            actions = db_manager.get_agent_actions(conversation_id)
            
            return render_template('conversation.html',
                                 conversation=conversation,
                                 messages=messages,
                                 actions=actions)
                                 
        except Exception as e:
            logger.exception("Conversation detail error", error=str(e))
            return render_template('error.html', error="Failed to load conversation"), 500
    
    @app.route('/installations')
    def installations():
        """Installations page"""
        try:
            # This would show installation management
            # For now, just show basic info
            return render_template('installations.html')
        except Exception as e:
            logger.exception("Installations error", error=str(e))
            return render_template('error.html', error="Failed to load installations"), 500
    
    @app.route('/api/installations')
    def api_installations():
        """API endpoint for installations"""
        try:
            # This would return installation data
            # For now, return empty array
            return jsonify([])
        except Exception as e:
            logger.exception("Installations API error", error=str(e))
            return jsonify({'error': 'Failed to get installations'}), 500
    
    @app.route('/logs')
    def logs():
        """Logs page (simple log viewer)"""
        try:
            # This could show recent log entries
            # For now, just a placeholder
            return render_template('logs.html')
        except Exception as e:
            logger.exception("Logs error", error=str(e))
            return render_template('error.html', error="Failed to load logs"), 500
