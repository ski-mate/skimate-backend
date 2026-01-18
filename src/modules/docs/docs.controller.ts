import { Controller, Get, Res, Header } from '@nestjs/common';
import { FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Public } from '../../common/decorators/index.js';

@Controller('docs')
export class DocsController {
  private readonly docsPath = join(process.cwd(), 'docs');

  /**
   * Main documentation landing page
   * Renders AsyncAPI spec with interactive UI
   */
  @Get()
  @Public()
  @Header('Content-Type', 'text/html')
  getDocsPage(): string {
    return this.getAsyncApiHtml();
  }

  /**
   * AsyncAPI specification (YAML)
   */
  @Get('asyncapi.yaml')
  @Public()
  @Header('Content-Type', 'text/yaml')
  getAsyncApiYaml(): string {
    return readFileSync(join(this.docsPath, 'asyncapi.yaml'), 'utf-8');
  }

  /**
   * AsyncAPI specification (JSON)
   */
  @Get('asyncapi.json')
  @Public()
  @Header('Content-Type', 'application/json')
  getAsyncApiJson(@Res() reply: FastifyReply): void {
    const yaml = readFileSync(join(this.docsPath, 'asyncapi.yaml'), 'utf-8');
    // Simple YAML to JSON conversion for basic cases
    // The AsyncAPI React component can handle YAML directly
    reply.header('Content-Type', 'text/yaml').send(yaml);
  }

  /**
   * API Guide (Markdown)
   */
  @Get('api')
  @Public()
  @Header('Content-Type', 'text/html')
  getApiGuide(): string {
    const markdown = readFileSync(join(this.docsPath, 'API.md'), 'utf-8');
    return this.renderMarkdown('API Guide', markdown);
  }

  /**
   * Authentication Guide (Markdown)
   */
  @Get('auth')
  @Public()
  @Header('Content-Type', 'text/html')
  getAuthGuide(): string {
    const markdown = readFileSync(join(this.docsPath, 'AUTHENTICATION.md'), 'utf-8');
    return this.renderMarkdown('Authentication Guide', markdown);
  }

  /**
   * Data Models Reference (Markdown)
   */
  @Get('models')
  @Public()
  @Header('Content-Type', 'text/html')
  getModelsGuide(): string {
    const markdown = readFileSync(join(this.docsPath, 'MODELS.md'), 'utf-8');
    return this.renderMarkdown('Data Models', markdown);
  }

  /**
   * Generate AsyncAPI HTML page with React component
   */
  private getAsyncApiHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SkiMate API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/@asyncapi/react-component@1.4.10/styles/default.min.css">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
      color: white;
      padding: 20px 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
    }
    .nav {
      background: white;
      padding: 15px 40px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .nav a {
      color: #1a73e8;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .nav a:hover {
      background: #e3f2fd;
    }
    .nav a.active {
      background: #1a73e8;
      color: white;
    }
    .container {
      max-width: 1400px;
      margin: 0 auto;
      padding: 20px;
    }
    #asyncapi {
      background: white;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
      overflow: hidden;
    }
    .asyncapi__info {
      padding: 20px !important;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SkiMate API Documentation</h1>
    <p>Real-time ski tracking and social platform WebSocket API</p>
  </div>
  
  <nav class="nav">
    <a href="/docs" class="active">AsyncAPI Spec</a>
    <a href="/docs/api">API Guide</a>
    <a href="/docs/auth">Authentication</a>
    <a href="/docs/models">Data Models</a>
    <a href="/docs/asyncapi.yaml" target="_blank">Download YAML</a>
  </nav>
  
  <div class="container">
    <div id="asyncapi"></div>
  </div>

  <script src="https://unpkg.com/@asyncapi/react-component@1.4.10/browser/standalone/index.js"></script>
  <script>
    fetch('/docs/asyncapi.yaml')
      .then(response => response.text())
      .then(schema => {
        AsyncApiStandalone.render({
          schema: schema,
          config: {
            show: {
              sidebar: true,
              info: true,
              servers: true,
              operations: true,
              messages: true,
              schemas: true,
              errors: true,
            },
            sidebar: {
              showServers: 'byDefault',
              showOperations: 'byDefault',
            },
          },
        }, document.getElementById('asyncapi'));
      })
      .catch(error => {
        document.getElementById('asyncapi').innerHTML = 
          '<div style="padding: 40px; text-align: center; color: #666;">' +
          '<h2>Error Loading API Specification</h2>' +
          '<p>' + error.message + '</p>' +
          '</div>';
      });
  </script>
</body>
</html>`;
  }

  /**
   * Render Markdown as HTML with GitHub-like styling
   */
  private renderMarkdown(title: string, markdown: string): string {
    // Escape HTML in code blocks but convert markdown syntax
    const html = this.markdownToHtml(markdown);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - SkiMate API</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/github-markdown-css/5.5.0/github-markdown.min.css">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background: #f5f5f5;
    }
    .header {
      background: linear-gradient(135deg, #1a73e8 0%, #0d47a1 100%);
      color: white;
      padding: 20px 40px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.1);
    }
    .header h1 {
      margin: 0 0 10px 0;
      font-size: 28px;
    }
    .header p {
      margin: 0;
      opacity: 0.9;
    }
    .nav {
      background: white;
      padding: 15px 40px;
      border-bottom: 1px solid #e0e0e0;
      display: flex;
      gap: 20px;
      flex-wrap: wrap;
    }
    .nav a {
      color: #1a73e8;
      text-decoration: none;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .nav a:hover {
      background: #e3f2fd;
    }
    .nav a.active {
      background: #1a73e8;
      color: white;
    }
    .container {
      max-width: 1000px;
      margin: 0 auto;
      padding: 40px 20px;
    }
    .markdown-body {
      background: white;
      padding: 40px;
      border-radius: 8px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.05);
    }
    .markdown-body pre {
      background: #f6f8fa;
      border-radius: 6px;
      padding: 16px;
      overflow-x: auto;
    }
    .markdown-body code {
      background: #f6f8fa;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 85%;
    }
    .markdown-body pre code {
      background: none;
      padding: 0;
    }
    .markdown-body table {
      width: 100%;
      border-collapse: collapse;
    }
    .markdown-body table th,
    .markdown-body table td {
      border: 1px solid #d0d7de;
      padding: 8px 12px;
    }
    .markdown-body table th {
      background: #f6f8fa;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>SkiMate API Documentation</h1>
    <p>Real-time ski tracking and social platform WebSocket API</p>
  </div>
  
  <nav class="nav">
    <a href="/docs">AsyncAPI Spec</a>
    <a href="/docs/api" ${title === 'API Guide' ? 'class="active"' : ''}>API Guide</a>
    <a href="/docs/auth" ${title === 'Authentication Guide' ? 'class="active"' : ''}>Authentication</a>
    <a href="/docs/models" ${title === 'Data Models' ? 'class="active"' : ''}>Data Models</a>
    <a href="/docs/asyncapi.yaml" target="_blank">Download YAML</a>
  </nav>
  
  <div class="container">
    <article class="markdown-body">
      ${html}
    </article>
  </div>

  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/highlight.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/typescript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/bash.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/json.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/languages/yaml.min.js"></script>
  <script>hljs.highlightAll();</script>
</body>
</html>`;
  }

  /**
   * Simple markdown to HTML converter
   * Handles basic markdown syntax for documentation
   */
  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Escape HTML entities first (except in code blocks)
    html = this.escapeHtmlOutsideCode(html);

    // Code blocks (``` ... ```)
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, (_match: string, lang: string, code: string) => {
      const language = lang || 'plaintext';
      const unescapedCode = this.unescapeHtml(code.trim());
      return `<pre><code class="language-${language}">${this.escapeHtml(unescapedCode)}</code></pre>`;
    });

    // Inline code (`...`)
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers
    html = html.replace(/^######\s+(.+)$/gm, '<h6>$1</h6>');
    html = html.replace(/^#####\s+(.+)$/gm, '<h5>$1</h5>');
    html = html.replace(/^####\s+(.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Bold and italic
    html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Tables
    html = this.convertTables(html);

    // Lists
    html = this.convertLists(html);

    // Paragraphs (lines not already wrapped)
    html = html.replace(/^(?!<[hpuolt]|<pre|<hr|<table)(.+)$/gm, '<p>$1</p>');

    // Clean up empty paragraphs
    html = html.replace(/<p>\s*<\/p>/g, '');

    return html;
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private unescapeHtml(text: string): string {
    return text
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'");
  }

  private escapeHtmlOutsideCode(text: string): string {
    // Don't escape inside code blocks - they're handled separately
    const parts = text.split(/(```[\s\S]*?```)/);
    return parts
      .map((part, i) => {
        if (i % 2 === 1) return part; // Code block - don't escape
        return part
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      })
      .join('');
  }

  private convertTables(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let inTable = false;
    let tableRows: string[] = [];

    for (const line of lines) {
      if (line.includes('|') && line.trim().startsWith('|')) {
        if (!inTable) {
          inTable = true;
          tableRows = [];
        }
        tableRows.push(line);
      } else {
        if (inTable) {
          result.push(this.buildTable(tableRows));
          inTable = false;
          tableRows = [];
        }
        result.push(line);
      }
    }

    if (inTable) {
      result.push(this.buildTable(tableRows));
    }

    return result.join('\n');
  }

  private buildTable(rows: string[]): string {
    if (rows.length < 2) return rows.join('\n');

    const headerRow = rows[0];
    const dataRows = rows.slice(2); // Skip separator row

    const headers = headerRow
      .split('|')
      .filter((c) => c.trim())
      .map((c) => `<th>${c.trim()}</th>`)
      .join('');

    const body = dataRows
      .map((row) => {
        const cells = row
          .split('|')
          .filter((c) => c.trim())
          .map((c) => `<td>${c.trim()}</td>`)
          .join('');
        return `<tr>${cells}</tr>`;
      })
      .join('');

    return `<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`;
  }

  private convertLists(html: string): string {
    const lines = html.split('\n');
    const result: string[] = [];
    let inList = false;
    let listType = '';

    for (const line of lines) {
      const unorderedMatch = line.match(/^(\s*)[-*]\s+(.+)$/);
      const orderedMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

      if (unorderedMatch) {
        if (!inList || listType !== 'ul') {
          if (inList) result.push(`</${listType}>`);
          result.push('<ul>');
          inList = true;
          listType = 'ul';
        }
        result.push(`<li>${unorderedMatch[2]}</li>`);
      } else if (orderedMatch) {
        if (!inList || listType !== 'ol') {
          if (inList) result.push(`</${listType}>`);
          result.push('<ol>');
          inList = true;
          listType = 'ol';
        }
        result.push(`<li>${orderedMatch[2]}</li>`);
      } else {
        if (inList && line.trim() === '') {
          result.push(`</${listType}>`);
          inList = false;
        }
        result.push(line);
      }
    }

    if (inList) {
      result.push(`</${listType}>`);
    }

    return result.join('\n');
  }
}
