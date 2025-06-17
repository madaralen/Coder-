"""
AI Client for Coder Bot
Handles AI/LLM interactions for generating responses
"""

import os
import json
from typing import Dict, List, Optional, Any
import structlog

# Import OpenAI client (can be replaced with other providers)
try:
    import openai
    HAS_OPENAI = True
except ImportError:
    HAS_OPENAI = False

logger = structlog.get_logger()


class AIClient:
    """Handles AI/LLM interactions"""
    
    def __init__(self):
        self.provider = os.getenv('AI_PROVIDER', 'openai')
        self.model = os.getenv('AI_MODEL', 'gpt-4')
        
        if self.provider == 'openai':
            if not HAS_OPENAI:
                raise ImportError("OpenAI package not installed. Run: pip install openai")
            
            api_key = os.getenv('OPENAI_API_KEY')
            if not api_key:
                raise ValueError("OPENAI_API_KEY environment variable not set")
            
            self.client = openai.OpenAI(api_key=api_key)
        else:
            # Can add support for other providers (Anthropic, local models, etc.)
            raise ValueError(f"Unsupported AI provider: {self.provider}")
    
    def generate_response(self, messages: List[Dict[str, Any]], 
                         repo_context: Dict[str, Any],
                         conversation_context: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Generate AI response for conversation"""
        try:
            # Build system prompt
            system_prompt = self._build_system_prompt(repo_context, conversation_context)
            
            # Convert messages to AI format
            ai_messages = self._format_messages_for_ai(messages, system_prompt)
            
            # Generate response
            if self.provider == 'openai':
                response = self._generate_openai_response(ai_messages)
            else:
                raise ValueError(f"Unsupported provider: {self.provider}")
            
            # Parse and structure response
            return self._parse_ai_response(response)
            
        except Exception as e:
            logger.exception("Failed to generate AI response", error=str(e))
            return None
    
    def _build_system_prompt(self, repo_context: Dict[str, Any], 
                           conversation_context: Dict[str, Any]) -> str:
        """Build system prompt for AI"""
        repo_info = repo_context.get('repository', {})
        repo_name = repo_info.get('full_name', 'unknown')
        repo_desc = repo_info.get('description', '')
        repo_lang = repo_info.get('language', '')
        
        system_prompt = f"""You are Coder Bot, an AI assistant that helps developers with code-related tasks in GitHub repositories.

**Repository Context:**
- Repository: {repo_name}
- Description: {repo_desc}
- Primary Language: {repo_lang}

**Your Capabilities:**
1. **Code Analysis**: Review, explain, and suggest improvements for code
2. **Bug Fixing**: Help identify and fix bugs in code
3. **Feature Implementation**: Assist with implementing new features
4. **Documentation**: Help with code documentation and README files
5. **Testing**: Suggest and help write tests
6. **Code Review**: Provide constructive feedback on pull requests
7. **File Operations**: Create, update, and organize files in the repository

**Repository Structure:**"""

        # Add repository structure if available
        if repo_context.get('structure'):
            system_prompt += "\n```\n"
            for item in repo_context['structure'][:20]:  # Limit to first 20 items
                system_prompt += f"{'📁' if item['type'] == 'dir' else '📄'} {item['path']}\n"
            system_prompt += "```\n"

        # Add key file contents if available
        if repo_context.get('files'):
            system_prompt += "\n**Key Files:**\n"
            for file_info in repo_context['files']:
                system_prompt += f"\n**{file_info['path']}:**\n```\n{file_info['content'][:1000]}...\n```\n"

        system_prompt += """

**Response Guidelines:**
1. Be helpful, concise, and professional
2. Provide specific, actionable advice
3. Include code examples when relevant
4. Explain your reasoning
5. If you need to make changes to files, be explicit about what you're doing
6. Ask clarifying questions if the request is ambiguous

**Action Format:**
If you need to perform actions (create/update files, create PRs, etc.), include them in a JSON block at the end:

```json
{
  "actions": [
    {
      "type": "create_file|update_file|create_pr|create_branch",
      "path": "file/path",
      "content": "file content",
      "message": "commit message",
      "branch": "branch-name"
    }
  ]
}
```

Remember: You're here to help make the development process smoother and more efficient!
"""
        
        return system_prompt
    
    def _format_messages_for_ai(self, messages: List[Dict[str, Any]], 
                               system_prompt: str) -> List[Dict[str, str]]:
        """Format messages for AI API"""
        ai_messages = [{"role": "system", "content": system_prompt}]
        
        for msg in messages:
            role = msg.get('role', 'user')
            content = msg.get('content', '')
            author = msg.get('author', 'unknown')
            
            # Convert roles to AI format
            if role == 'assistant':
                ai_role = 'assistant'
            else:
                ai_role = 'user'
                # Add author information for user messages
                if author != 'unknown':
                    content = f"**{author}:** {content}"
            
            ai_messages.append({
                "role": ai_role,
                "content": content
            })
        
        return ai_messages
    
    def _generate_openai_response(self, messages: List[Dict[str, str]]) -> str:
        """Generate response using OpenAI"""
        try:
            response = self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                max_tokens=2000,
                temperature=0.7,
                presence_penalty=0.1,
                frequency_penalty=0.1
            )
            
            return response.choices[0].message.content
            
        except Exception as e:
            logger.exception("OpenAI API error", error=str(e))
            raise
    
    def _parse_ai_response(self, response: str) -> Dict[str, Any]:
        """Parse AI response and extract actions"""
        # Split content and actions
        content = response
        actions = []
        
        # Look for JSON action block
        if "```json" in response:
            try:
                # Extract JSON block
                json_start = response.find("```json") + 7
                json_end = response.find("```", json_start)
                
                if json_end > json_start:
                    json_str = response[json_start:json_end].strip()
                    action_data = json.loads(json_str)
                    
                    if 'actions' in action_data:
                        actions = action_data['actions']
                    
                    # Remove JSON block from content
                    content = response[:response.find("```json")].strip()
                    
            except json.JSONDecodeError as e:
                logger.warning("Failed to parse action JSON", error=str(e))
        
        return {
            'content': content,
            'actions': actions
        }
    
    def generate_issue_analysis(self, issue_title: str, issue_body: str, 
                               repo_context: Dict[str, Any]) -> Optional[str]:
        """Generate analysis for a new issue"""
        try:
            prompt = f"""Analyze this GitHub issue and provide helpful insights:

**Issue Title:** {issue_title}

**Issue Description:**
{issue_body}

**Repository Context:** {repo_context.get('repository', {}).get('full_name', 'unknown')}

Please provide:
1. A brief summary of the issue
2. Potential causes or areas to investigate
3. Suggested next steps or approach
4. Any questions that need clarification

Keep your response concise but helpful."""

            if self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1000,
                    temperature=0.5
                )
                return response.choices[0].message.content
            
        except Exception as e:
            logger.exception("Failed to generate issue analysis", error=str(e))
        
        return None
    
    def generate_pr_review(self, pr_title: str, pr_body: str, 
                          changed_files: List[Dict[str, Any]], 
                          repo_context: Dict[str, Any]) -> Optional[str]:
        """Generate PR review"""
        try:
            files_summary = "\n".join([f"- {f.get('filename', 'unknown')}" for f in changed_files[:10]])
            
            prompt = f"""Review this pull request and provide constructive feedback:

**PR Title:** {pr_title}

**PR Description:**
{pr_body}

**Files Changed:**
{files_summary}

**Repository:** {repo_context.get('repository', {}).get('full_name', 'unknown')}

Please provide:
1. Overall assessment of the changes
2. Potential issues or concerns
3. Suggestions for improvement
4. Positive aspects of the PR

Be constructive and helpful in your feedback."""

            if self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=1500,
                    temperature=0.6
                )
                return response.choices[0].message.content
            
        except Exception as e:
            logger.exception("Failed to generate PR review", error=str(e))
        
        return None
    
    def generate_code_suggestion(self, code_context: str, user_request: str, 
                                file_path: str = "") -> Optional[Dict[str, Any]]:
        """Generate code suggestions"""
        try:
            prompt = f"""Help with this code-related request:

**User Request:** {user_request}

**File:** {file_path}

**Code Context:**
```
{code_context}
```

Please provide:
1. A clear explanation of what needs to be done
2. The suggested code changes
3. Explanation of the changes

If you're suggesting a complete file replacement or creation, format it as an action."""

            if self.provider == 'openai':
                response = self.client.chat.completions.create(
                    model=self.model,
                    messages=[{"role": "user", "content": prompt}],
                    max_tokens=2000,
                    temperature=0.5
                )
                
                return self._parse_ai_response(response.choices[0].message.content)
            
        except Exception as e:
            logger.exception("Failed to generate code suggestion", error=str(e))
        
        return None
