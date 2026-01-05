"use strict";

const templateNodes = document.querySelectorAll("template[data-md]");
const markdownMap = new Map();

templateNodes.forEach((template) => {
    const key = template.dataset.problem
        ? `problem/${template.dataset.problem}/${template.dataset.md}`
        : template.dataset.md;
    const raw = template.content.textContent || "";
    markdownMap.set(key, dedent(raw));
});

const problemIndexKey = "problem-index";
const problemIndexFile = "content/problem-index.md";

const tabs = Array.from(document.querySelectorAll(".tab"));
const panels = Array.from(document.querySelectorAll(".panel"));

let problemList = [];
let currentProblemId = null;

initContent();

tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
        activateTab(tab.dataset.tab);
    });
});

function activateTab(tabName) {
    tabs.forEach((tab) => {
        const isActive = tab.dataset.tab === tabName;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
    });

    panels.forEach((panel) => {
        const isActive = panel.dataset.panel === tabName;
        panel.toggleAttribute("hidden", !isActive);
        panel.classList.toggle("is-active", isActive);
        if (isActive) {
            restartAnimation(panel, "panel-animate");
        }
    });
}

function restartAnimation(element, className) {
    element.classList.remove(className);
    void element.offsetWidth;
    element.classList.add(className);
}

function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
        node.textContent = value;
    }
}

async function initContent() {
    const indexSource = await loadMarkdownFile(
        problemIndexFile,
        markdownMap.get(problemIndexKey) || ""
    );
    problemList = parseProblemIndex(indexSource);
    if (!problemList.length) {
        problemList = [{ id: "1", title: "문제 1", path: "." }];
    }

    const selected = resolveSelectedProblem(problemList);
    currentProblemId = selected.id;
    renderProblemList(problemList, selected.id);
    await loadProblem(selected);
}

function resolveSelectedProblem(problems) {
    const params = new URLSearchParams(window.location.search);
    const targetId = params.get("problem");
    if (targetId) {
        const found = problems.find((problem) => problem.id === targetId);
        if (found) {
            return found;
        }
    }
    return problems[0];
}

function renderProblemList(problems, selectedId) {
    const listNode = document.getElementById("problem-list");
    const selectNode = document.getElementById("problem-select");

    if (listNode) {
        listNode.innerHTML = "";
    }
    if (selectNode) {
        selectNode.innerHTML = "";
        selectNode.onchange = () => {
            const next = problems.find(
                (problem) => problem.id === selectNode.value
            );
            if (next) {
                void selectProblem(next);
            }
        };
    }

    problems.forEach((problem) => {
        const label = problem.title || "문제";
        if (selectNode) {
            const option = document.createElement("option");
            option.value = problem.id;
            option.textContent = label;
            if (problem.id === selectedId) {
                option.selected = true;
            }
            selectNode.appendChild(option);
        }

        if (listNode) {
            const item = document.createElement("li");
            const button = document.createElement("button");
            button.type = "button";
            button.className = "problem-item";
            button.textContent = label;
            if (problem.id === selectedId) {
                button.classList.add("is-active");
            }
            button.addEventListener("click", () => {
                void selectProblem(problem);
            });
            item.appendChild(button);
            listNode.appendChild(item);
        }
    });
}

async function selectProblem(problem) {
    if (currentProblemId === problem.id) {
        return;
    }
    currentProblemId = problem.id;
    renderProblemList(problemList, problem.id);
    updateUrl(problem.id);
    await loadProblem(problem);
}

function updateUrl(problemId) {
    const url = new URL(window.location.href);
    url.searchParams.set("problem", problemId);
    history.replaceState(null, "", url);
}

async function loadProblem(problem) {
    const metaSource = await loadProblemMarkdown(problem, "meta");
    const { meta } = parseFrontMatter(metaSource);

    const title = meta.title || problem.title || "문제 제목";
    setText("problem-title", title);
    setText("time-limit", formatLimit(meta.timeLimitMs, "ms"));
    setText("memory-limit", formatLimit(meta.memoryLimitMb, "MB"));
    setText("difficulty-text", formatText(meta.difficulty));
    setText("difficulty-badge", formatText(meta.difficulty));

    document.title = `${title} · ESC OJ`;

    for (const key of [
        "problem",
        "samples",
        "tests",
        "solution",
        "generator",
    ]) {
        const target = document.querySelector(`[data-md-target="${key}"]`);
        if (!target) {
            continue;
        }
        const source = await loadProblemMarkdown(problem, key);
        target.innerHTML = renderMarkdown(source || "_내용 없음_");
    }

    applyMath();
}

function formatLimit(value, unit) {
    if (!value) {
        return "-";
    }
    const trimmed = String(value).trim();
    if (!trimmed || trimmed === "-") {
        return "-";
    }
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
        return `${trimmed} ${unit}`;
    }
    return trimmed;
}

function formatText(value) {
    const trimmed = String(value ?? "").trim();
    return trimmed ? trimmed : "-";
}

async function loadProblemMarkdown(problem, key) {
    const fallbackKey = `problem/${problem.id}/${key}`;
    const fallback = markdownMap.get(fallbackKey) || "";
    if (window.location.protocol === "file:") {
        return fallback;
    }
    const basePath = resolveProblemBasePath(problem);
    const filePath = `${basePath}/${key}.md`;
    return loadMarkdownFile(filePath, fallback);
}

function resolveProblemBasePath(problem) {
    const rawPath = (problem.path || "").trim();
    if (!rawPath || rawPath === ".") {
        return "content";
    }
    return rawPath.startsWith("content/") ? rawPath : `content/${rawPath}`;
}

async function loadMarkdownFile(filePath, fallback) {
    if (window.location.protocol === "file:") {
        return fallback;
    }
    try {
        const response = await fetch(filePath, { cache: "no-store" });
        if (!response.ok) {
            return fallback;
        }
        const text = await response.text();
        return text.trim().length ? text : fallback;
    } catch (error) {
        return fallback;
    }
}

function parseProblemIndex(source) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    const problems = [];

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed === "---") {
            return;
        }
        const listMatch = /^-\s*(.+)$/.exec(trimmed);
        const row = listMatch ? listMatch[1] : trimmed;
        const parts = row.split("|").map((part) => part.trim());
        if (parts.length < 2) {
            return;
        }
        const [id, title, path] = parts;
        if (!id || !title) {
            return;
        }
        problems.push({ id, title, path: path || id });
    });

    return problems;
}

function parseFrontMatter(source) {
    const normalized = source.replace(/\r\n/g, "\n").trim();
    const match = normalized.match(/^---\n([\s\S]*?)\n---\n*/);
    if (!match) {
        return { meta: {}, body: normalized };
    }
    const meta = {};
    match[1]
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
        .forEach((line) => {
            const splitIndex = line.indexOf(":");
            if (splitIndex === -1) {
                return;
            }
            const key = line.slice(0, splitIndex).trim();
            const value = line.slice(splitIndex + 1).trim();
            if (!key) {
                return;
            }
            meta[key] = value;
        });
    const body = normalized.slice(match[0].length);
    return { meta, body };
}

function renderMarkdown(source) {
    const lines = source.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let paragraph = [];
    let listItems = [];
    let listType = null;
    let blockquoteLines = [];
    let inCodeBlock = false;
    let codeLang = "";

    const flushParagraph = () => {
        if (paragraph.length === 0) {
            return;
        }
        html += `<p>${formatInline(paragraph.join(" "))}</p>`;
        paragraph = [];
    };

    const flushList = () => {
        if (listItems.length === 0) {
            return;
        }
        const tag = listType || "ul";
        html += `<${tag}>${listItems
            .map((item) => `<li>${item}</li>`)
            .join("")}</${tag}>`;
        listItems = [];
        listType = null;
    };

    const flushBlockquote = () => {
        if (blockquoteLines.length === 0) {
            return;
        }
        const content = blockquoteLines
            .map((line) => formatInline(line))
            .join("<br>");
        html += `<blockquote>${content}</blockquote>`;
        blockquoteLines = [];
    };

    lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.startsWith("```")) {
            if (!inCodeBlock) {
                flushParagraph();
                flushList();
                flushBlockquote();
                inCodeBlock = true;
                codeLang = trimmed.slice(3).trim();
                html += `<pre><code${
                    codeLang ? ` class="language-${escapeHtml(codeLang)}"` : ""
                }>`;
            } else {
                inCodeBlock = false;
                html += "</code></pre>";
            }
            return;
        }

        if (inCodeBlock) {
            html += `${escapeHtml(line)}\n`;
            return;
        }

        if (!trimmed) {
            flushParagraph();
            flushList();
            flushBlockquote();
            return;
        }

        if (blockquoteLines.length && !trimmed.startsWith(">")) {
            flushBlockquote();
        }

        if (trimmed.startsWith(">")) {
            flushParagraph();
            flushList();
            blockquoteLines.push(trimmed.replace(/^>\s?/, ""));
            return;
        }

        if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
            flushParagraph();
            flushList();
            flushBlockquote();
            html += "<hr>";
            return;
        }

        const headingMatch = /^(#{1,3})\s+(.*)$/.exec(line);
        if (headingMatch) {
            flushParagraph();
            flushList();
            flushBlockquote();
            const level = Math.min(5, headingMatch[1].length + 1);
            html += `<h${level}>${formatInline(
                headingMatch[2].trim()
            )}</h${level}>`;
            return;
        }

        const unorderedMatch = /^-\s+(.*)$/.exec(line);
        if (unorderedMatch) {
            flushParagraph();
            flushBlockquote();
            if (listType && listType !== "ul") {
                flushList();
            }
            listType = "ul";
            listItems.push(formatInline(unorderedMatch[1].trim()));
            return;
        }

        const orderedMatch = /^\d+[.)]\s+(.*)$/.exec(line);
        if (orderedMatch) {
            flushParagraph();
            flushBlockquote();
            if (listType && listType !== "ol") {
                flushList();
            }
            listType = "ol";
            listItems.push(formatInline(orderedMatch[1].trim()));
            return;
        }

        if (listItems.length) {
            flushList();
        }
        paragraph.push(line.trim());
    });

    flushParagraph();
    flushList();
    flushBlockquote();

    if (inCodeBlock) {
        html += "</code></pre>";
    }

    return html;
}

function formatInline(text) {
    const mathSegments = [];
    const mathRegex =
        /(\$\$[\s\S]+?\$\$|\$[^$\n]+?\$|\\\([\s\S]+?\\\)|\\\[[\s\S]+?\\\])/g;
    const placeholder = (index) => `@@MATH${index}@@`;
    const withPlaceholders = text.replace(mathRegex, (match) => {
        const token = placeholder(mathSegments.length);
        mathSegments.push(match);
        return token;
    });

    let escaped = escapeHtml(withPlaceholders);
    escaped = escaped.replace(/`([^`]+)`/g, "<code>$1</code>");
    escaped = escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
        const safeUrl = sanitizeUrl(url);
        return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    });
    escaped = escaped.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    escaped = escaped.replace(/__(.+?)__/g, "<strong>$1</strong>");
    escaped = escaped.replace(/\*(?!\*)([^*]+)\*(?!\*)/g, "<em>$1</em>");
    escaped = escaped.replace(/_(?!_)([^_]+)_(?!_)/g, "<em>$1</em>");

    mathSegments.forEach((segment, index) => {
        const token = placeholder(index);
        const safeSegment = escapeHtml(segment);
        escaped = escaped.split(token).join(safeSegment);
    });
    return escaped;
}

function sanitizeUrl(url) {
    const trimmed = url.trim();
    if (!trimmed) {
        return "#";
    }
    if (/^(https?:|mailto:|\/)/i.test(trimmed)) {
        return trimmed;
    }
    return "#";
}

function applyMath() {
    if (typeof renderMathInElement !== "function") {
        return;
    }
    const container = document.querySelector(".content-card");
    if (!container) {
        return;
    }
    renderMathInElement(container, {
        delimiters: [
            { left: "$$", right: "$$", display: true },
            { left: "$", right: "$", display: false },
            { left: "\\(", right: "\\)", display: false },
            { left: "\\[", right: "\\]", display: true },
        ],
        throwOnError: false,
        ignoredTags: ["script", "noscript", "style", "textarea", "pre", "code"],
    });
}

function escapeHtml(text) {
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function dedent(text) {
    const normalized = text.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    while (lines.length && lines[0].trim() === "") {
        lines.shift();
    }
    while (lines.length && lines[lines.length - 1].trim() === "") {
        lines.pop();
    }
    const indents = lines
        .filter((line) => line.trim().length)
        .map((line) => line.match(/^\s*/)?.[0].length ?? 0);
    const minIndent = indents.length ? Math.min(...indents) : 0;
    return lines.map((line) => line.slice(minIndent)).join("\n");
}
