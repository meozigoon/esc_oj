import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { Components } from "react-markdown";

type MarkdownProps = {
    children: string;
};

const mathTags = [
    "math",
    "annotation",
    "semantics",
    "mrow",
    "mi",
    "mo",
    "mn",
    "ms",
    "mtext",
    "mspace",
    "mfrac",
    "msqrt",
    "mroot",
    "mtable",
    "mtr",
    "mtd",
    "msup",
    "msub",
    "msubsup",
    "munder",
    "mover",
    "munderover",
    "mstyle",
    "mpadded",
    "mphantom",
    "menclose",
    "mmultiscripts",
];

const markdownSchema = {
    ...defaultSchema,
    tagNames: [...(defaultSchema.tagNames || []), ...mathTags],
    protocols: {
        ...defaultSchema.protocols,
        href: ["http", "https", "mailto"],
        src: ["http", "https"],
    },
    attributes: {
        ...defaultSchema.attributes,
        img: [
            ...((defaultSchema.attributes || {}).img || []),
            "src",
            "alt",
            "title",
            "width",
            "height",
        ],
        span: [
            ...((defaultSchema.attributes || {}).span || []),
            "className",
            "aria-hidden",
        ],
        div: [...((defaultSchema.attributes || {}).div || []), "className"],
        math: [
            ...((defaultSchema.attributes || {}).math || []),
            "xmlns",
            "display",
        ],
        annotation: [
            ...((defaultSchema.attributes || {}).annotation || []),
            "encoding",
        ],
        mrow: ["mathvariant"],
        mi: ["mathvariant"],
        mo: ["mathvariant"],
        mn: ["mathvariant"],
        ms: ["mathvariant"],
        mtext: ["mathvariant"],
        mstyle: ["mathvariant"],
    },
};

const components: Components = {
    a: ({ href, children, ...props }) => (
        <a {...props} href={href} target="_blank" rel="noreferrer noopener">
            {children}
        </a>
    ),
    img: ({ ...props }) => (
        <img
            {...props}
            style={{ maxWidth: "100%", height: "auto" }}
            loading="lazy"
        />
    ),
};

export default function Markdown({ children }: MarkdownProps) {
    return (
        <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkMath]}
            rehypePlugins={[
                rehypeRaw,
                rehypeKatex,
                [rehypeSanitize, markdownSchema],
            ]}
            components={components}
        >
            {children}
        </ReactMarkdown>
    );
}
