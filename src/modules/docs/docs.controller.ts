import { Controller, Get, Res, Header } from '@nestjs/common';
import type { FastifyReply } from 'fastify';
import { readFileSync } from 'fs';
import { join } from 'path';
import { Public } from '../../common/decorators/index.js';

@Controller('docs')
export class DocsController {
  private readonly docsPath = join(process.cwd(), 'docs');

  /**
   * Main documentation landing page - AsyncAPI spec viewer
   */
  @Get()
  @Public()
  @Header('Content-Type', 'text/html')
  getDocsPage(): string {
    return this.renderAsyncApiPage();
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
   * AsyncAPI specification (JSON format - returns YAML for component compatibility)
   */
  @Get('asyncapi.json')
  @Public()
  @Header('Content-Type', 'application/json')
  getAsyncApiJson(@Res() reply: FastifyReply): void {
    const yaml = readFileSync(join(this.docsPath, 'asyncapi.yaml'), 'utf-8');
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
    return this.renderMarkdownPage('API Guide', markdown);
  }

  /**
   * Authentication Guide (Markdown)
   */
  @Get('auth')
  @Public()
  @Header('Content-Type', 'text/html')
  getAuthGuide(): string {
    const markdown = readFileSync(
      join(this.docsPath, 'AUTHENTICATION.md'),
      'utf-8',
    );
    return this.renderMarkdownPage('Authentication Guide', markdown);
  }

  /**
   * Data Models Reference (Markdown)
   */
  @Get('models')
  @Public()
  @Header('Content-Type', 'text/html')
  getModelsGuide(): string {
    const markdown = readFileSync(join(this.docsPath, 'MODELS.md'), 'utf-8');
    return this.renderMarkdownPage('Data Models', markdown);
  }

  // =========================================================================
  // HTML Rendering
  // =========================================================================

  private renderAsyncApiPage(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SkiMate API Documentation</title>
  <link rel="stylesheet" href="https://unpkg.com/@asyncapi/react-component@1.4.10/styles/default.min.css">
  <link rel="stylesheet" href="/static/css/docs-common.css">
  <link rel="stylesheet" href="/static/css/docs-asyncapi.css">
</head>
<body>
  ${this.renderHeader()}
  ${this.renderNav('asyncapi')}
  
  <div class="docs-container">
    <div id="asyncapi">
      <div class="docs-loading">
        <p>Loading API specification...</p>
      </div>
    </div>
  </div>

  <script src="https://unpkg.com/@asyncapi/react-component@1.0.0-next.54/browser/standalone/index.js"></script>
  <script>
    (async function() {
      try {
        const response = await fetch('/docs/asyncapi.yaml');
        if (!response.ok) {
          throw new Error('Failed to load: ' + response.status + ' ' + response.statusText);
        }
        const schema = await response.text();
        
        if (typeof AsyncApiStandalone === 'undefined') {
          throw new Error('AsyncAPI component failed to load from CDN');
        }
        
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
      } catch (error) {
        console.error('AsyncAPI Error:', error);
        document.getElementById('asyncapi').innerHTML = 
          '<div class="docs-error">' +
          '<h2>Error Loading API Specification</h2>' +
          '<p>' + error.message + '</p>' +
          '<p><a href="/docs/asyncapi.yaml">Download YAML directly</a></p>' +
          '</div>';
      }
    })();
  </script>
</body>
</html>`;
  }

  private renderMarkdownPage(title: string, markdown: string): string {
    const html = this.markdownToHtml(markdown);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} - SkiMate API</title>
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github.min.css">
  <link rel="stylesheet" href="/static/css/docs-common.css">
  <link rel="stylesheet" href="/static/css/docs-markdown.css">
</head>
<body>
  ${this.renderHeader()}
  ${this.renderNav(this.getNavKey(title))}
  
  <div class="docs-container docs-container--narrow">
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

  // =========================================================================
  // Shared Components
  // =========================================================================

  private renderHeader(): string {
    return `
  <div class="docs-header">
    <h1>SkiMate API Documentation</h1>
    <p>Real-time ski tracking and social platform WebSocket API</p>
  </div>`;
  }

  private renderNav(activeKey: string): string {
    const items = [
      { key: 'asyncapi', href: '/docs', label: 'AsyncAPI Spec' },
      { key: 'api', href: '/docs/api', label: 'API Guide' },
      { key: 'auth', href: '/docs/auth', label: 'Authentication' },
      { key: 'models', href: '/docs/models', label: 'Data Models' },
      { key: 'download', href: '/docs/asyncapi.yaml', label: 'Download YAML', target: '_blank' },
    ];

    const links = items
      .map((item) => {
        const activeClass = item.key === activeKey ? ' class="active"' : '';
        const target = item.target ? ` target="${item.target}"` : '';
        return `<a href="${item.href}"${activeClass}${target}>${item.label}</a>`;
      })
      .join('\n    ');

    return `
  <nav class="docs-nav">
    ${links}
  </nav>`;
  }

  private getNavKey(title: string): string {
    const mapping: Record<string, string> = {
      'API Guide': 'api',
      'Authentication Guide': 'auth',
      'Data Models': 'models',
    };
    return mapping[title] || '';
  }

  // =========================================================================
  // Markdown Conversion
  // =========================================================================

  private markdownToHtml(markdown: string): string {
    let html = markdown;

    // Escape HTML entities first (except in code blocks)
    html = this.escapeHtmlOutsideCode(html);

    // Code blocks (``` ... ```)
    html = html.replace(
      /```(\w*)\n([\s\S]*?)```/g,
      (_match: string, lang: string, code: string) => {
        const language = lang || 'plaintext';
        const unescapedCode = this.unescapeHtml(code.trim());
        return `<pre><code class="language-${language}">${this.escapeHtml(unescapedCode)}</code></pre>`;
      },
    );

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // Headers (process largest first)
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
