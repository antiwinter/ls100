#!/usr/bin/env node

const { Command } = require('commander');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');

const program = new Command();

// Get the prompt directory path
const PROMPT_DIR = path.join(process.cwd(), 'prompt');

// Ensure prompt directory exists
async function ensurePromptDir() {
  try {
    await fs.access(PROMPT_DIR);
  } catch {
    await fs.mkdir(PROMPT_DIR, { recursive: true });
  }
}

// Replace code blocks with summary placeholders
function removeCodeBlocks(text) {
  return text.replace(/```(.*?)\n([\s\S]*?)```/g, (match, language, code) => {
    try {
      const lines = code.split('\n').filter(line => line.trim() !== ''); // Remove empty lines for accurate count
      const totalLines = lines.length;
      
      // Initialize variables
      let addedLines = 0;
      let removedLines = 0;
      let fileName = '';
      let languageInfo = (language || '').trim();
      
      // Handle different language/citation patterns safely
      if (languageInfo) {
        // Check for citation patterns like "12:15:app/components/Todo.tsx"
        const citationMatch = languageInfo.match(/^(\d+):(\d+):(.+)$/);
        if (citationMatch) {
          fileName = ` | ${citationMatch[3]}`;
          languageInfo = 'code'; // Default for citations
        } else {
          // Keep original language (javascript, python, etc.)
          languageInfo = languageInfo.split(' ')[0]; // Take first word only
        }
      }
      
      // Count git diff patterns safely
      let hasDiffPatterns = false;
      lines.forEach(line => {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('+') && !trimmedLine.startsWith('+++')) {
          addedLines++;
          hasDiffPatterns = true;
        } else if (trimmedLine.startsWith('-') && !trimmedLine.startsWith('---')) {
          removedLines++;
          hasDiffPatterns = true;
        }
      });
      
      // Try to extract filename from git diff headers
      if (!fileName && hasDiffPatterns) {
        const fileMatch = code.match(/^[\+\-]{3}\s+(.+)$/m);
        if (fileMatch) {
          fileName = ` | ${fileMatch[1]}`;
        }
      }
      
      // Build summary info
      let summary = `[CODE BLOCK: ${languageInfo || 'text'}${fileName}`;
      
      // Add line information
      if (hasDiffPatterns && (addedLines > 0 || removedLines > 0)) {
        summary += ` | ++${addedLines} --${removedLines}`;
      } else {
        summary += ` | ${totalLines} lines`;
      }
      
      summary += ']';
      
      return summary;
    } catch (error) {
      // Fallback in case anything goes wrong
      return `[CODE BLOCK: ${(language || 'unknown').trim()} | content removed]`;
    }
  });
}

// Get current conversation from cursor (this is a placeholder - would need actual cursor integration)
async function getCurrentConversation() {
  // Placeholder implementation - in real scenario, this would integrate with cursor's API
  // For now, we'll read from clipboard or stdin
  throw new Error('Current conversation retrieval not implemented yet. Please specify a conversation name.');
}

// Get conversation by name from Cursor
async function getConversationByName(name) {
  // Placeholder implementation - in real scenario, this would fetch specific conversation from cursor's API
  throw new Error(`Getting conversation '${name}' not implemented yet. This requires Cursor API integration.`);
}

// Save conversation
async function saveConversation(name, options) {
  await ensurePromptDir();
  
  let conversationText;
  
  if (name) {
    // Save specified conversation by name from Cursor
    try {
      conversationText = await getConversationByName(name);
    } catch (error) {
      console.error(`Error getting conversation '${name}':`, error.message);
      process.exit(1);
    }
  } else {
    // Save current conversation
    try {
      conversationText = await getCurrentConversation();
    } catch (error) {
      console.error('Error getting current conversation:', error.message);
      process.exit(1);
    }
  }
  
  // Apply trimming (remove code blocks by default unless --no-trim is specified)
  if (!options.noTrim) {
    conversationText = removeCodeBlocks(conversationText);
  }
  
  // Generate filename with timestamp if no name provided
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = name || `conversation-${timestamp}`;
  const filepath = path.join(PROMPT_DIR, `${filename}.md`);
  
  try {
    await fs.writeFile(filepath, conversationText, 'utf8');
    console.log(`Conversation saved to: ${filepath}`);
  } catch (error) {
    console.error('Error saving conversation:', error.message);
    process.exit(1);
  }
}

// Get all available conversations from Cursor
async function getAllCursorConversations() {
  // Placeholder implementation - in real scenario, this would integrate with cursor's API
  // This would fetch all conversations (saved and unsaved) from Cursor
  throw new Error('Listing all Cursor conversations not implemented yet. This requires Cursor API integration.');
}

// List all available conversations from Cursor
async function listConversations() {
  try {
    const conversations = await getAllCursorConversations();
    
    if (conversations.length === 0) {
      console.log('No conversations found in Cursor.');
    } else {
      console.log('Available conversations in Cursor:');
      conversations.forEach(conv => {
        const status = conv.saved ? '[SAVED]' : '[UNSAVED]';
        console.log(`  ${status} ${conv.name || conv.id}`);
      });
    }
  } catch (error) {
    console.error('Error listing conversations:', error.message);
    process.exit(1);
  }
}

// Process a single .md file for trimming
async function processMdFile(filePath) {
  try {
    const content = await fs.readFile(filePath, 'utf8');
    const trimmedContent = removeCodeBlocks(content);
    await fs.writeFile(filePath, trimmedContent, 'utf8');
    console.log(`Processed: ${filePath}`);
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
  }
}

// Trim files/folders - process .md files and remove code blocks
async function trimPath(targetPath) {
  if (!targetPath) {
    console.error('Error: Target file or folder path is required for trim command.');
    process.exit(1);
  }
  
  try {
    // Check if target path exists
    await fs.access(targetPath);
    
    const stats = await fs.stat(targetPath);
    
    if (stats.isDirectory()) {
      // Process all .md files in the directory
      const files = await fs.readdir(targetPath);
      const mdFiles = files.filter(file => file.endsWith('.md'));
      
      if (mdFiles.length === 0) {
        console.log(`No .md files found in directory: ${targetPath}`);
        return;
      }
      
      console.log(`Processing ${mdFiles.length} .md file(s) in directory: ${targetPath}`);
      
      for (const file of mdFiles) {
        const fullPath = path.join(targetPath, file);
        await processMdFile(fullPath);
      }
    } else if (stats.isFile()) {
      // Process single file
      if (!targetPath.endsWith('.md')) {
        console.error('Error: Trim command only processes .md files.');
        process.exit(1);
      }
      
      await processMdFile(targetPath);
    } else {
      console.error(`Error: ${targetPath} is neither a file nor a directory.`);
      process.exit(1);
    }
    
    console.log('Trim operation completed.');
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Error: Path '${targetPath}' not found.`);
    } else {
      console.error('Error during trim operation:', error.message);
    }
    process.exit(1);
  }
}

// Setup CLI commands
program
  .name('manage')
  .description('CLI tool to manage user cursor conversations')
  .version('1.0.0');

program
  .command('save')
  .description('Save current conversation')
  .argument('[name]', 'Name for the conversation')
  .option('--no-trim', 'Do not remove code blocks from conversation')
  .action(saveConversation);

program
  .command('list')
  .description('List conversation names')
  .action(listConversations);

program
  .command('trim')
  .description('Trim code blocks from .md files in a given file or folder')
  .argument('<path>', 'File or folder path to trim')
  .action(trimPath);

// Parse command line arguments
program.parse(); 