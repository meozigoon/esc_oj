const fs = require("fs");
const path = require("path");

const indexPath = path.join(__dirname, "index.html");
const password = (process.env.PREVIEW_PASSWORD || "").trim();
const html = fs.readFileSync(indexPath, "utf8");
const metaRegex = /(<meta name="preview-password" content=")[^"]*(")/;

if (!metaRegex.test(html)) {
    throw new Error("Preview password meta tag not found in index.html.");
}

const escaped = password.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const next = html.replace(metaRegex, `$1${escaped}$2`);

fs.writeFileSync(indexPath, next, "utf8");
console.log(
    `Preview password ${password ? "set" : "cleared"} in index.html.`
);
