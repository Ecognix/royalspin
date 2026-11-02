"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const appRoot = ["src/app", "app"]
  .map((relativePath) => path.join(root, relativePath))
  .find((candidate) => fs.existsSync(candidate));

function listFiles(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(fullPath) : [fullPath];
  });
}

if (appRoot) {
  test("the root route exports a page component", () => {
    const candidates = ["page.js", "page.jsx", "page.ts", "page.tsx"]
      .map((name) => path.join(appRoot, name));
    const pagePath = candidates.find((candidate) => fs.existsSync(candidate));

    assert.ok(pagePath, "the app router root page should exist");
    assert.match(
      fs.readFileSync(pagePath, "utf8"),
      /\bexport\s+default\b/,
      "the root route should export its page component",
    );
  });

  test("every non-API app route exports a page component", () => {
    const pages = listFiles(appRoot).filter((filePath) => {
      const relativePath = path.relative(appRoot, filePath);
      return (
        /^page\.(js|jsx|ts|tsx)$/.test(path.basename(filePath)) &&
        !relativePath.split(path.sep).includes("api")
      );
    });

    assert.ok(pages.length > 0, "the app should define at least one route");
    for (const pagePath of pages) {
      assert.match(
        fs.readFileSync(pagePath, "utf8"),
        /\bexport\s+default\b/,
        `${path.relative(root, pagePath)} should export a page component`,
      );
    }
  });

  test("the root layout exports a layout component", () => {
    const candidates = ["layout.js", "layout.jsx", "layout.ts", "layout.tsx"]
      .map((name) => path.join(appRoot, name));
    const layoutPath = candidates.find((candidate) => fs.existsSync(candidate));

    assert.ok(layoutPath, "the app router root layout should exist");
    assert.match(
      fs.readFileSync(layoutPath, "utf8"),
      /\bexport\s+default\b/,
      "the root layout should export its component",
    );
  });
} else {
  const entryPath = path.join(root, "index.html");

  test("the static site has a valid HTML entry document", () => {
    assert.ok(fs.existsSync(entryPath), "index.html should exist");
    const html = fs.readFileSync(entryPath, "utf8");

    assert.match(html, /<!doctype html>/i, "the document should declare HTML5");
    assert.match(html, /<html\b[^>]*\blang=["'][^"']+["']/i);
    assert.match(html, /<title\b[^>]*>[^<]+<\/title>/i);
    assert.match(html, /<meta\b[^>]*name=["']viewport["']/i);
  });
}
