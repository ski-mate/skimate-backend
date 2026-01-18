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
  // HTML Rendering with Tailwind CSS
  // =========================================================================

  private getHeadContent(title: string): string {
    return `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            primary: {
              50: '#eff6ff',
              100: '#dbeafe',
              200: '#bfdbfe',
              300: '#93c5fd',
              400: '#60a5fa',
              500: '#3b82f6',
              600: '#2563eb',
              700: '#1d4ed8',
              800: '#1e40af',
              900: '#1e3a8a',
            }
          }
        }
      }
    }
  </script>
  <style type="text/tailwindcss">
    @layer utilities {
      .prose-custom h1 { @apply text-3xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200; }
      .prose-custom h2 { @apply text-2xl font-semibold text-gray-900 mt-8 mb-4 pb-2 border-b border-gray-200; }
      .prose-custom h3 { @apply text-xl font-semibold text-gray-900 mt-6 mb-3; }
      .prose-custom h4 { @apply text-lg font-semibold text-gray-900 mt-4 mb-2; }
      .prose-custom p { @apply text-gray-700 leading-relaxed mb-4; }
      .prose-custom a { @apply text-primary-600 hover:text-primary-700 hover:underline; }
      .prose-custom ul, .prose-custom ol { @apply pl-6 mb-4 space-y-1; }
      .prose-custom li { @apply text-gray-700; }
      .prose-custom code { @apply bg-gray-100 text-gray-800 px-1.5 py-0.5 rounded text-sm font-mono; }
      .prose-custom pre { @apply bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto mb-4; }
      .prose-custom pre code { @apply bg-transparent text-gray-100 p-0; }
      .prose-custom table { @apply w-full border-collapse mb-4; }
      .prose-custom th { @apply bg-gray-100 text-left text-gray-900 font-semibold px-4 py-3 border border-gray-200; }
      .prose-custom td { @apply text-gray-700 px-4 py-3 border border-gray-200; }
      .prose-custom tr:nth-child(even) td { @apply bg-gray-50; }
      .prose-custom hr { @apply border-gray-200 my-8; }
      .prose-custom strong { @apply font-semibold text-gray-900; }
    }
  </style>`;
  }

  private renderAsyncApiPage(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  ${this.getHeadContent('SkiMate API Documentation')}
  <link rel="stylesheet" href="https://unpkg.com/@asyncapi/react-component@1.4.10/styles/default.min.css">
  <style>
    /* AsyncAPI Layout - Fixed sidebar on left */
    .asyncapi {
      display: flex !important;
      flex-direction: row !important;
    }
    
    /* Sidebar - Always visible on left */
    .asyncapi__sidebar {
      position: fixed !important;
      left: 0 !important;
      top: 130px !important;
      bottom: 0 !important;
      width: 280px !important;
      overflow-y: auto !important;
      background: #f8fafc !important;
      border-right: 1px solid #e2e8f0 !important;
      padding: 1rem !important;
      z-index: 40 !important;
    }
    
    /* Hide the hamburger menu button */
    .asyncapi__sidebar-button {
      display: none !important;
    }
    
    /* Main content - offset for sidebar */
    .asyncapi__content {
      margin-left: 280px !important;
      padding: 1.5rem !important;
      width: calc(100% - 280px) !important;
    }
    
    /* Scroll offset for anchor links */
    .asyncapi [id] {
      scroll-margin-top: 150px;
    }
    
    /* Responsive - hide sidebar on mobile */
    @media (max-width: 768px) {
      .asyncapi__sidebar {
        display: none !important;
      }
      .asyncapi__sidebar-button {
        display: flex !important;
      }
      .asyncapi__content {
        margin-left: 0 !important;
        width: 100% !important;
      }
    }
  </style>
</head>
<body class="bg-gray-50 min-h-screen">
  ${this.renderHeader()}
  ${this.renderNav('asyncapi')}
  
  <main class="relative">
    <div id="asyncapi" class="bg-white min-h-screen">
      <div class="flex items-center justify-center h-64 text-gray-500">
        <div class="text-center">
          <svg class="animate-spin h-8 w-8 mx-auto mb-4 text-primary-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <p class="text-sm">Loading API specification...</p>
        </div>
      </div>
    </div>
  </main>

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
        
        // Fix sidebar navigation - handle clicks on sidebar links
        setTimeout(() => {
          const sidebar = document.querySelector('.asyncapi__sidebar');
          if (sidebar) {
            sidebar.addEventListener('click', (e) => {
              const link = e.target.closest('a[href^="#"]');
              if (link) {
                e.preventDefault();
                const targetId = link.getAttribute('href').slice(1);
                const targetEl = document.getElementById(targetId);
                if (targetEl) {
                  const navHeight = 130; // Account for fixed header + nav
                  const targetPosition = targetEl.getBoundingClientRect().top + window.pageYOffset - navHeight;
                  window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                  });
                }
              }
            });
          }
        }, 1000); // Wait for component to render
        
      } catch (error) {
        console.error('AsyncAPI Error:', error);
        document.getElementById('asyncapi').innerHTML = 
          '<div class="flex flex-col items-center justify-center h-64 text-red-600">' +
          '<svg class="h-12 w-12 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>' +
          '<h2 class="text-lg font-semibold mb-2">Error Loading API Specification</h2>' +
          '<p class="text-gray-600 mb-4">' + error.message + '</p>' +
          '<a href="/docs/asyncapi.yaml" class="text-primary-600 hover:text-primary-700 hover:underline">Download YAML directly</a>' +
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
  ${this.getHeadContent(`${title} - SkiMate API`)}
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/highlight.js/11.9.0/styles/github-dark.min.css">
</head>
<body class="bg-gray-50 min-h-screen">
  ${this.renderHeader()}
  ${this.renderNav(this.getNavKey(title))}
  
  <main class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <article class="bg-white rounded-xl shadow-sm p-8 sm:p-10 prose-custom">
      ${html}
    </article>
  </main>

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
  <header class="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      <h1 class="text-2xl sm:text-3xl font-bold">SkiMate API Documentation</h1>
      <p class="mt-1 text-primary-100 text-sm sm:text-base">Real-time ski tracking and social platform WebSocket API</p>
    </div>
  </header>`;
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
        const isActive = item.key === activeKey;
        const baseClasses = 'px-4 py-2 rounded-lg text-sm font-medium transition-colors';
        const activeClasses = isActive
          ? 'bg-primary-600 text-white'
          : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';
        const target = item.target ? ` target="${item.target}"` : '';
        return `<a href="${item.href}" class="${baseClasses} ${activeClasses}"${target}>${item.label}</a>`;
      })
      .join('\n      ');

    return `
  <nav class="bg-white border-b border-gray-200 sticky top-0 z-50 shadow-sm">
    <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="flex gap-2 py-3 overflow-x-auto">
        ${links}
      </div>
    </div>
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
