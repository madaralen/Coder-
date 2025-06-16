export interface CodeBlock {
  language: string;
  filename: string;
  content: string;
  path: string;
}

export interface ProjectStructure {
  name: string;
  files: CodeBlock[];
  dependencies?: string[];
  type: 'react' | 'html' | 'python' | 'nodejs' | 'general';
}

export function parseAIResponse(content: string): CodeBlock[] {
  const codeBlocks: CodeBlock[] = [];
  
  // Simple and robust regex pattern for standard code blocks
  const codeBlockPattern = /```(\w+)?\s*\n([\s\S]*?)```/g;
  
  let fileCounter = 1;
  const foundBlocks = new Set<string>(); // To avoid duplicates
  
  // Look for filename references in the content before code blocks
  const explicitFilenamePattern = /(?:^|\n)(?:filename|file):\s*([^\s\n]+\.\w+)/gi;
  const filenameReferences: string[] = [];
  let filenameMatch;
  while ((filenameMatch = explicitFilenamePattern.exec(content)) !== null) {
    filenameReferences.push(filenameMatch[1].trim());
  }
  
  // Look for filenames mentioned in comments before code blocks
  const commentFilenamePattern = /(?:^|\n)(?:\/\/|#|\/\*)\s*([^\s\n]+\.\w+)[\s\S]*?\n```/g;
  let commentMatch;
  while ((commentMatch = commentFilenamePattern.exec(content)) !== null) {
    filenameReferences.push(commentMatch[1].trim());
  }
  
  let referenceIndex = 0;
  
  // Parse standard code blocks
  let match;
  while ((match = codeBlockPattern.exec(content)) !== null) {
    const language = match[1] || '';
    let code = match[2] || '';
    
    // Clean up the code
    code = code.trim();
    
    // Skip empty or very short code blocks
    if (code.length < 5) continue;
    
    // Skip if we already found this exact code block
    const blockKey = `${language}-${code.substring(0, 50)}`;
    if (foundBlocks.has(blockKey)) continue;
    foundBlocks.add(blockKey);
    
    // Skip if this looks like it's just text and not code
    if (isJustText(code)) continue;
    
    // Determine filename
    let filename = '';
    
    // 1. Try to use explicit filename references in order
    if (referenceIndex < filenameReferences.length) {
      filename = filenameReferences[referenceIndex];
      referenceIndex++;
    }
    
    // 2. Try to detect filename from code content
    if (!filename) {
      const detectedName = detectFilenameFromContent(code, language);
      if (detectedName) {
        filename = detectedName;
      }
    }
    
    // 3. Generate a meaningful filename based on language and content
    if (!filename) {
      const detectedLang = language || detectLanguageFromCode(code);
      filename = generateMeaningfulFilename(code, detectedLang, fileCounter);
      fileCounter++;
    }
    
    // Ensure filename is valid and doesn't contain code content
    filename = sanitizeFilename(filename);
    
    // Only add if we have valid content and filename
    if (code.length > 0 && filename && !filename.includes('\n') && filename.length < 100) {
      codeBlocks.push({
        language: language || detectLanguageFromCode(code),
        filename,
        content: code,
        path: filename
      });
    }
  }
  
  // If no code blocks found, try to create a simple file from the entire content
  if (codeBlocks.length === 0 && content.trim().length > 0) {
    // Remove any obvious AI response formatting
    const cleanedContent = content
      .replace(/^Here'?s?\s+(?:the|your|a)\s+.*?:\s*/i, '')
      .replace(/^I'?(?:ve|ll)\s+.*?:\s*/i, '')
      .replace(/^```\s*/, '')
      .replace(/\s*```$/, '')
      .trim();
    
    if (cleanedContent.length > 0 && !isJustText(cleanedContent)) {
      const detectedLang = detectLanguageFromCode(cleanedContent);
      const filename = `generated.${getExtensionFromLanguage(detectedLang)}`;
      
      codeBlocks.push({
        language: detectedLang,
        filename,
        content: cleanedContent,
        path: filename
      });
    }
  }
  
  return codeBlocks;
}

// Helper function to check if content is just plain text and not code
function isJustText(content: string): boolean {
  // Check if content looks like natural language rather than code
  const codeIndicators = [
    /function\s+\w+/,
    /class\s+\w+/,
    /import\s+\w+/,
    /def\s+\w+/,
    /var\s+\w+/,
    /const\s+\w+/,
    /let\s+\w+/,
    /<\w+[^>]*>/,
    /\{\s*\w+/,
    /if\s*\(/,
    /for\s*\(/,
    /while\s*\(/,
    /return\s+/,
    /console\./,
    /print\s*\(/
  ];
  
  const hasCodeIndicators = codeIndicators.some(pattern => pattern.test(content));
  
  // If it has clear code indicators, it's likely code
  if (hasCodeIndicators) return false;
  
  // Check if it's mostly natural language
  const words = content.split(/\s+/);
  const longWords = words.filter(word => word.length > 4).length;
  const totalWords = words.length;
  
  // If more than 60% are long words and no code indicators, it's probably text
  return totalWords > 5 && (longWords / totalWords) > 0.6;
}

// Helper function to generate meaningful filenames
function generateMeaningfulFilename(code: string, language: string, counter: number): string {
  const detectedLang = language || detectLanguageFromCode(code);
  
  // Try to extract meaningful names from the code
  const functionMatch = code.match(/function\s+(\w+)|def\s+(\w+)|class\s+(\w+)/);
  if (functionMatch) {
    const name = functionMatch[1] || functionMatch[2] || functionMatch[3];
    return `${name}.${getExtensionFromLanguage(detectedLang)}`;
  }
  
  // Check for specific file types
  if (code.includes('<!DOCTYPE html>') || code.includes('<html')) {
    return 'index.html';
  }
  
  if (code.includes('package.json') || code.includes('"name"') && code.includes('"version"')) {
    return 'package.json';
  }
  
  if (code.includes('body {') || code.includes('@media')) {
    return 'styles.css';
  }
  
  // Default meaningful names
  const defaultNames = {
    'javascript': 'script',
    'jsx': 'component',
    'typescript': 'script',
    'tsx': 'component',
    'python': 'main',
    'html': 'index',
    'css': 'styles',
    'json': 'data'
  };
  
  const baseName = defaultNames[detectedLang] || 'file';
  return `${baseName}${counter > 1 ? counter : ''}.${getExtensionFromLanguage(detectedLang)}`;
}

// Helper function to sanitize filenames
function sanitizeFilename(filename: string): string {
  if (!filename) return '';
  
  // Remove any newlines, excessive whitespace, or invalid characters
  return filename
    .replace(/[\n\r]/g, '')
    .replace(/\s+/g, '_')
    .replace(/[<>:"|?*]/g, '')
    .substring(0, 100) // Limit length
    .trim();
}

export function detectProjectStructure(codeBlocks: CodeBlock[]): ProjectStructure {
  const hasReact = codeBlocks.some(block => 
    block.content.includes('import React') || 
    block.filename.endsWith('.jsx') || 
    block.filename.endsWith('.tsx')
  );
  
  const hasHTML = codeBlocks.some(block => 
    block.filename.endsWith('.html') || 
    block.content.includes('<!DOCTYPE html>')
  );
  
  const hasPython = codeBlocks.some(block => 
    block.filename.endsWith('.py') || 
    block.language === 'python'
  );
  
  const hasPackageJson = codeBlocks.some(block => 
    block.filename === 'package.json'
  );
  
  let type: ProjectStructure['type'] = 'general';
  let name = 'generated-project';
  
  if (hasReact) {
    type = 'react';
    name = 'react-app';
  } else if (hasHTML) {
    type = 'html';
    name = 'html-project';
  } else if (hasPython) {
    type = 'python';
    name = 'python-project';
  } else if (hasPackageJson) {
    type = 'nodejs';
    name = 'nodejs-project';
  }
  
  // Extract dependencies from package.json if it exists
  const dependencies: string[] = [];
  const packageJsonBlock = codeBlocks.find(block => block.filename === 'package.json');
  if (packageJsonBlock) {
    try {
      const packageData = JSON.parse(packageJsonBlock.content);
      if (packageData.dependencies) {
        dependencies.push(...Object.keys(packageData.dependencies));
      }
      if (packageData.name) {
        name = packageData.name;
      }
    } catch (error) {
      console.warn('Failed to parse package.json:', error);
    }
  }
  
  return {
    name,
    files: codeBlocks,
    dependencies,
    type
  };
}

function detectFilenameFromContent(content: string, language: string): string | null {
  // Look for common patterns that indicate filename
  const filenamePatterns = [
    /\/\/\s*(@filename|filename|file):\s*(.+)/i,
    /\/\*\s*(@filename|filename|file):\s*(.+)\s*\*\//i,
    /#\s*(@filename|filename|file):\s*(.+)/i,
  ];
  
  for (const pattern of filenamePatterns) {
    const match = content.match(pattern);
    if (match && match[2]) {
      return match[2].trim();
    }
  }
  
  // Try to detect from import statements or common patterns
  if (language === 'javascript' || language === 'jsx') {
    if (content.includes('import React')) {
      return content.includes('export default') ? 'App.jsx' : 'index.jsx';
    }
    if (content.includes('<!DOCTYPE html>')) {
      return 'index.html';
    }
  }
  
  if (language === 'html') {
    return 'index.html';
  }
  
  if (language === 'css') {
    return 'styles.css';
  }
  
  if (language === 'python') {
    if (content.includes('if __name__ == "__main__"')) {
      return 'main.py';
    }
    return 'script.py';
  }
  
  return null;
}

function detectLanguageFromCode(code: string): string {
  // Simple language detection based on code patterns
  if (code.includes('<!DOCTYPE html>') || code.includes('<html') || /<\w+.*>/.test(code)) {
    return 'html';
  }
  if (code.includes('import React') || code.includes('export default') || code.includes('useState')) {
    return 'jsx';
  }
  if (code.includes('function') && (code.includes('const ') || code.includes('let ') || code.includes('var '))) {
    return 'javascript';
  }
  if (code.includes('def ') || code.includes('import ') || code.includes('if __name__')) {
    return 'python';
  }
  if (code.includes('body {') || code.includes('@media') || /\.\w+\s*\{/.test(code)) {
    return 'css';
  }
  if (code.includes('"name":') || code.includes('"version":')) {
    return 'json';
  }
  if (code.includes('public class') || code.includes('public static void main')) {
    return 'java';
  }
  if (code.includes('#include') || code.includes('int main')) {
    return 'c';
  }
  
  return 'text';
}

function getExtensionFromLanguage(language: string): string {
  const extensionMap: { [key: string]: string } = {
    'javascript': 'js',
    'js': 'js',
    'jsx': 'jsx',
    'typescript': 'ts',
    'ts': 'ts',
    'tsx': 'tsx',
    'python': 'py',
    'py': 'py',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'json': 'json',
    'markdown': 'md',
    'md': 'md',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'rust': 'rs',
    'go': 'go',
    'php': 'php',
    'ruby': 'rb',
    'shell': 'sh',
    'bash': 'sh',
    'sql': 'sql',
    'yaml': 'yml',
    'xml': 'xml',
    'text': 'txt'
  };
  
  return extensionMap[language.toLowerCase()] || 'txt';
}
interface ProjectNode {
  name: string;
  type: 'file' | 'folder';
  path: string;
  expanded?: boolean;
  isNew?: boolean;
  children?: ProjectNode[];
}


export function createProjectFromStructure(structure: ProjectStructure): ProjectNode {
  const projectNode: ProjectNode = {
    name: structure.name,
    type: 'folder' as const,
    path: structure.name,
    expanded: true,
    isNew: true,
    children: [] as ProjectNode[]
  };
  
  // Group files by directory
  const directories: { [path: string]: ProjectNode[] } = {};
  
  structure.files.forEach(file => {
    const pathParts = file.path.split('/');
    const filename = pathParts.pop() || file.filename;
    const dirPath = pathParts.join('/');
    
    const fileNode = {
      name: filename,
      type: 'file' as const,
      path: `${structure.name}/${file.path}`,
      content: file.content,
      isNew: true
    };
    
    if (dirPath) {
      if (!directories[dirPath]) {
        directories[dirPath] = [];
      }
      directories[dirPath].push(fileNode);
    } else {
      if (projectNode.children) {
        projectNode.children.push(fileNode);
      }
    }
  });
  
  // Create directory nodes
  Object.entries(directories).forEach(([dirPath, files]) => {
    const dirParts = dirPath.split('/');
    let currentLevel = projectNode.children;
    let currentPath = structure.name;
    
    dirParts.forEach((dirName, index) => {
      currentPath += '/' + dirName;
      let existingDir = currentLevel?.find(node => node.name === dirName && node.type === 'folder');
      
      if (!existingDir) {
        existingDir = {
          name: dirName,
          type: 'folder' as const,
          path: currentPath,
          expanded: true,
          isNew: true,
          children: []
        };
        if (currentLevel) {
          currentLevel.push(existingDir);
        }
      }
      
      currentLevel = existingDir.children;
      
      // Add files to the deepest directory
      if (index === dirParts.length - 1 && currentLevel) {
        currentLevel.push(...files);
      }
    });
  });
  
  return projectNode;
}

export function generateRunScript(projectType: ProjectStructure['type'], projectName: string): string {
  switch (projectType) {
    case 'react':
      return `cd ${projectName} && npm install && npm start`;
    case 'nodejs':
      return `cd ${projectName} && npm install && npm start`;
    case 'python':
      return `cd ${projectName} && python main.py`;
    case 'html':
      return `cd ${projectName} && python -m http.server 3000`;
    default:
      return `cd ${projectName} && echo "Project created successfully!"`;
  }
}

export function detectErrors(output: string): string[] {
  const errors: string[] = [];
  const errorPatterns = [
    /Error: (.+)/g,
    /SyntaxError: (.+)/g,
    /TypeError: (.+)/g,
    /ReferenceError: (.+)/g,
    /Module not found: (.+)/g,
    /Cannot find module (.+)/g,
    /Traceback \(most recent call last\):([\s\S]*?)(?=\n\n|\n$)/g,
    /fatal error: (.+)/g,
    /error: (.+)/g
  ];
  
  errorPatterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(output)) !== null) {
      errors.push(match[1] || match[0]);
    }
  });
  
  return errors;
}
