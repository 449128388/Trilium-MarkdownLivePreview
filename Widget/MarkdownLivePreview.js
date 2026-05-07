/**
 * Trilium 0.100.0 Markdown Live Preview Widget
 * 样式精修版：高对比度深色主题，解决文字看不清问题
 */

class MarkdownLivePreview extends api.NoteContextAwareWidget {
    static get parentWidget() { return "note-detail-pane"; }
    get position() { return 100; }

    constructor() {
        super();
        this.contentSized();
        this.markedLoaded = false;
        this.hljsLoaded = false;
        this.cmEditor = null;
        this.debounceTimer = null;
        this.pollTimer = null;
        this.lastNoteId = null;
        this.lastContent = '';
    }

    isEnabled() {
        const base = super.isEnabled() && this.note;
        if (!base) return false;
        const hasTag = this.note.hasLabel('markdownPreview');
        const isMdMime = this.note.mime && this.note.mime.includes('markdown');
        return hasTag || isMdMime;
    }

    async doRender() {
        this.$widget = $(
            `<div class="md-live-preview" style="display:none; flex:1; overflow:auto; padding:20px; border-left:1px solid #444; background:#1e1e1e; min-width:0;">
                <div class="markdown-body" style="color:#e0e0e0; max-width:100%;"></div>
            </div>`
        );
        this.$body = this.$widget.find('.markdown-body');
        this.injectBaseStyles();

        if (!window.__triliumMDLibsLoaded) {
            window.__triliumMDLibsLoaded = true;
            await this.loadOfflineLibs();
        } else {
            this.markedLoaded = (typeof marked !== 'undefined');
            this.hljsLoaded = (typeof hljs !== 'undefined');
        }
        return this.$widget;
    }

    /**
     * 精修 CSS：高对比度、柔和配色、清晰层级
     */
    injectBaseStyles() {
        if (document.getElementById('md-base-styles')) return;
        const style = document.createElement('style');
        style.id = 'md-base-styles';
        style.textContent = `
            .md-live-preview { scrollbar-width: thin; scrollbar-color: #555 #2a2a2a; }
            .md-live-preview::-webkit-scrollbar { width: 8px; }
            .md-live-preview::-webkit-scrollbar-track { background: #2a2a2a; }
            .md-live-preview::-webkit-scrollbar-thumb { background: #555; border-radius: 4px; }
            
            .markdown-body {
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans SC", Helvetica, Arial, sans-serif;
                font-size: 14.5px;
                line-height: 1.7;
                color: #e0e0e0 !important;
                word-wrap: break-word;
            }
            
            /* 标题 */
            .markdown-body h1, .markdown-body h2, .markdown-body h3,
            .markdown-body h4, .markdown-body h5, .markdown-body h6 {
                margin-top: 24px;
                margin-bottom: 14px;
                font-weight: 600;
                line-height: 1.35;
                color: #f0f0f0 !important;
                border-bottom: 1px solid #444;
                padding-bottom: 8px;
            }
            .markdown-body h1 { font-size: 1.7em; font-weight: 700; }
            .markdown-body h2 { font-size: 1.45em; }
            .markdown-body h3 { font-size: 1.25em; }
            .markdown-body h4 { font-size: 1.1em; color: #d0d0d0 !important; }
            .markdown-body h5 { font-size: 1em; color: #b0b0b0 !important; }
            .markdown-body h6 { font-size: 0.9em; color: #909090 !important; }
            
            /* 段落 */
            .markdown-body p { margin-top: 0; margin-bottom: 14px; color: #e0e0e0 !important; }
            
            /* 列表 */
            .markdown-body ul, .markdown-body ol {
                margin-top: 0;
                margin-bottom: 14px;
                padding-left: 28px;
                color: #e0e0e0 !important;
            }
            .markdown-body li { margin-bottom: 6px; color: #e0e0e0 !important; }
            .markdown-body li > p { margin-bottom: 6px; }
            .markdown-body ul ul, .markdown-body ol ol { margin-bottom: 4px; }
            
            /* 表格 - 核心修复：统一柔和背景，高对比文字 */
            .markdown-body table {
                border-collapse: collapse;
                width: 100%;
                margin-bottom: 18px;
                font-size: 13.5px;
                border: 1px solid #555;
                border-radius: 6px;
                overflow: hidden;
            }
            .markdown-body table thead {
                background: linear-gradient(180deg, #3a3a3a 0%, #2e2e2e 100%);
            }
            .markdown-body table th {
                padding: 10px 14px;
                border: 1px solid #555;
                text-align: left;
                font-weight: 600;
                color: #ffffff !important;
                background: transparent;
            }
            .markdown-body table td {
                padding: 10px 14px;
                border: 1px solid #444;
                text-align: left;
                color: #e8e8e8 !important;
                background: #252525;
            }
            .markdown-body table tbody tr:nth-child(even) td {
                background: #2a2a2a;
            }
            .markdown-body table tbody tr:hover td {
                background: #333333;
            }
            
            /* 代码 */
            .markdown-body pre {
                background: #252525;
                border-radius: 8px;
                padding: 14px;
                overflow: auto;
                margin-bottom: 18px;
                border: 1px solid #444;
            }
            .markdown-body pre code {
                background: transparent;
                padding: 0;
                border-radius: 0;
                font-size: 13px;
                color: #e8e8e8 !important;
                font-family: "SFMono-Regular", "Fira Code", Consolas, "Liberation Mono", Menlo, monospace;
            }
            .markdown-body code {
                background: rgba(255,255,255,0.08);
                padding: 2px 6px;
                border-radius: 4px;
                font-family: "SFMono-Regular", "Fira Code", Consolas, Menlo, monospace;
                font-size: 0.88em;
                color: #ffab70 !important;
            }
            
            /* 引用块 */
            .markdown-body blockquote {
                margin: 0 0 14px 0;
                padding: 6px 16px;
                border-left: 4px solid #58a6ff;
                background: rgba(88,166,255,0.06);
                border-radius: 0 6px 6px 0;
                color: #c0c0c0 !important;
            }
            .markdown-body blockquote p { color: #c0c0c0 !important; margin-bottom: 6px; }
            
            /* 链接 */
            .markdown-body a {
                color: #58a6ff !important;
                text-decoration: none;
                border-bottom: 1px solid transparent;
                transition: border-color 0.2s;
            }
            .markdown-body a:hover {
                border-bottom-color: #58a6ff;
            }
            
            /* 图片 */
            .markdown-body img {
                max-width: 100%;
                height: auto;
                border-radius: 6px;
                border: 1px solid #444;
                display: block;
                margin: 8px 0;
            }
            
            /* 分割线 */
            .markdown-body hr {
                height: 1px;
                background: #444;
                border: none;
                margin: 20px 0;
            }
            
            /* 复选框 */
            .markdown-body input[type="checkbox"] {
                margin-right: 8px;
                accent-color: #58a6ff;
            }
            
            /* 粗体 */
            .markdown-body strong { color: #ffffff !important; font-weight: 600; }
            
            /* 斜体 */
            .markdown-body em { color: #d0d0d0 !important; }
            
            /* 删除线 */
            .markdown-body del { color: #888 !important; }
        `;
        document.head.appendChild(style);
    }

    async fetchNoteContent(noteId) {
        const resp = await fetch(`/api/notes/${noteId}/blob`);
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const text = await resp.text();
        if (text.trimStart().startsWith('{')) {
            const json = JSON.parse(text);
            if (json.content && typeof json.content === 'string') return json.content;
        }
        return text;
    }

    async loadOfflineLibs() {
        try {
            const widgetNoteId = api.startNote?.noteId;
            if (!widgetNoteId) return;

            const childNotes = await api.runAsyncOnBackendWithManualTransactionHandling(async (parentId) => {
                const n = api.getNote(parentId);
                if (!n) return [];
                return (await n.getChildNotes()).map(c => ({ noteId: c.noteId, title: c.title, mime: c.mime }));
            }, [widgetNoteId]);

            const markedNote = childNotes.find(c => c.title === 'marked-lib');
            if (markedNote) {
                const content = await this.fetchNoteContent(markedNote.noteId);
                if (content.length > 100) {
                    this.injectScript(content, 'marked-lib');
                    this.markedLoaded = (typeof marked !== 'undefined');
                }
            }

            const hljsNote = childNotes.find(c => c.title === 'highlight-lib');
            if (hljsNote) {
                const content = await this.fetchNoteContent(hljsNote.noteId);
                if (content.length > 100) {
                    this.injectScript(content, 'highlight-lib');
                    this.hljsLoaded = (typeof hljs !== 'undefined');
                }
            }

            const cssNotes = childNotes.filter(c => c.mime === 'text/css');
            for (const cssNote of cssNotes) {
                const content = await this.fetchNoteContent(cssNote.noteId);
                if (content) this.injectStyle(content, cssNote.noteId);
            }
        } catch (err) {
            console.error('[MD Preview] 库加载失败:', err);
        }
    }

    injectScript(jsContent, id) {
        const tagId = 'md-script-' + id;
        if (document.getElementById(tagId)) return;
        const script = document.createElement('script');
        script.id = tagId;
        script.textContent = jsContent;
        document.head.appendChild(script);
    }

    injectStyle(cssContent, id) {
        const tagId = 'md-style-' + id;
        if (document.getElementById(tagId)) return;
        const style = document.createElement('style');
        style.id = tagId;
        style.textContent = cssContent;
        document.head.appendChild(style);
    }

    async refreshWithNote(note) {
        if (!this.isEnabled()) {
            this.detachEditor();
            this.resetLayout();
            return;
        }
        setTimeout(() => this.attachToEditor(note), 300);
    }

    attachToEditor(note) {
        if (this.lastNoteId === note.noteId && (this.cmEditor || this.pollTimer)) return;
        this.lastNoteId = note.noteId;
        this.detachEditor();

        const $editorArea = $('.note-detail-code');
        if (!$editorArea.length) {
            setTimeout(() => this.attachToEditor(note), 500);
            return;
        }

        const $detail = $editorArea.closest('.note-detail');
        let $wrapper = $detail.find('.md-split-wrapper');
        if (!$wrapper.length) {
            $editorArea.wrap('<div class="md-split-wrapper" style="display:flex;flex-direction:row;width:100%;height:100%;overflow:hidden;"></div>');
            $wrapper = $detail.find('.md-split-wrapper');
        }

        $editorArea.css({ flex: '1 1 50%', width: '50%', maxWidth: '50%', minWidth: '0', height: '100%' });
        this.$widget.css({ display: 'flex', flex: '1 1 50%', width: '50%', maxWidth: '50%', minWidth: '0', height: '100%' });
        $wrapper.append(this.$widget);

        const cmConnected = this.tryConnectCodeMirror(note, $editorArea);
        if (cmConnected) return;
        const taConnected = this.tryConnectTextarea(note, $editorArea);
        if (taConnected) return;
        this.startFetchPolling(note);
    }

    tryConnectCodeMirror(note, $editorArea) {
        const cmEl = $editorArea.find('.CodeMirror')[0];
        if (cmEl && cmEl.CodeMirror) {
            this.cmEditor = cmEl.CodeMirror;
            this.bindEditorEvents(note);
            this.updatePreview(note);
            return true;
        }
        return false;
    }

    tryConnectTextarea(note, $editorArea) {
        const ta = $editorArea.find('.CodeMirror textarea')[0] || $editorArea.find('textarea')[0];
        if (!ta) return false;
        this.renderMarkdown(ta.value);
        ta.addEventListener('input', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.renderMarkdown(ta.value), 200);
        });
        ta.addEventListener('keyup', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.renderMarkdown(ta.value), 200);
        });
        return true;
    }

    startFetchPolling(note) {
        this.updatePreviewByFetch(note);
        this.pollTimer = setInterval(() => this.updatePreviewByFetch(note), 600);
    }

    async updatePreviewByFetch(note) {
        try {
            const content = await this.fetchNoteContent(note.noteId);
            if (content !== this.lastContent) {
                this.lastContent = content;
                this.renderMarkdown(content);
            }
        } catch (e) {
            console.warn('[MD Preview] fetch 轮询失败:', e.message);
        }
    }

    renderMarkdown(mdContent) {
        if (!this.markedLoaded) return;
        if (typeof marked !== 'undefined') {
            marked.setOptions({
                gfm: true, tables: true, breaks: false, pedantic: false,
                sanitize: false, smartLists: true, smartypants: false, xhtml: false
            });
            const html = marked.parse(mdContent);
            this.$body.html(html);
            if (this.hljsLoaded && typeof hljs !== 'undefined') {
                this.$widget.find('pre code').each((i, block) => hljs.highlightElement(block));
            }
        }
    }

    updatePreview(note) {
        if (!this.cmEditor) return;
        this.renderMarkdown(this.cmEditor.getValue());
    }

    bindEditorEvents(note) {
        if (!this.cmEditor) return;
        this.cmEditor.on('changes', () => {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = setTimeout(() => this.updatePreview(note), 200);
        });
    }

    detachEditor() {
        if (this.cmEditor) {
            this.cmEditor.off('changes');
            this.cmEditor = null;
        }
        if (this.pollTimer) {
            clearInterval(this.pollTimer);
            this.pollTimer = null;
        }
        this.$widget.off('scroll');
        this.lastContent = '';
    }

    resetLayout() {
        const $wrapper = $('.md-split-wrapper');
        if ($wrapper.length) {
            const $editorArea = $wrapper.find('.note-detail-code');
            $editorArea.insertBefore($wrapper);
            $editorArea.css({ flex: '', width: '', maxWidth: '', minWidth: '', height: '' });
            $wrapper.remove();
        }
        this.$widget.hide();
    }

    async entitiesReloadedEvent({loadResults}) {
        if (loadResults.isNoteContentReloaded(this.noteId)) this.refresh();
    }
}

module.exports = MarkdownLivePreview;