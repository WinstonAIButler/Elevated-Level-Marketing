import { describe, expect, it } from "vitest";
import { analyzeWebsite, isPrivateAddress, normalizeWebsite, robotsBlocks, scoreChecks, topFixes } from "./site-audit";

const GOOD_HTML = `<!doctype html><html lang="en"><head>
<title>Emergency Plumber in Austin | Smith Plumbing</title>
<meta name="description" content="Licensed Austin plumbers for leaks, drains and water heaters. Same-day service across Travis County. Call for a free quote.">
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="canonical" href="https://smith.example/">
<meta property="og:title" content="Smith Plumbing"><meta property="og:image" content="https://smith.example/og.png">
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Plumber","name":"Smith Plumbing"}</script>
</head><body><h1>Austin plumbing done right</h1><a href="tel:+15125550100">Call</a><form></form>
<img src="a.jpg" alt="Van"><h2>How much does a plumber cost?</h2><p>${"word ".repeat(300)}</p></body></html>`;

const base = { url: "https://smith.example/", robotsTxt: "User-agent: *\nAllow: /", hasSitemap: true, hasLlmsTxt: true };

describe("analyzeWebsite", () => {
  it("passes every check for a well-built page", () => {
    const checks = analyzeWebsite({ ...base, html: GOOD_HTML });
    expect(checks).toHaveLength(19);
    expect(checks.filter((c) => !c.passed).map((c) => c.id)).toEqual([]);
    expect(scoreChecks(checks)).toBe(100);
  });

  it("flags the important gaps on a bare page", () => {
    const checks = analyzeWebsite({
      url: "http://bare.example/",
      html: "<html><head><meta name='robots' content='noindex'></head><body><img src=x></body></html>",
      robotsTxt: "User-agent: GPTBot\nDisallow: /",
      hasSitemap: false,
      hasLlmsTxt: false,
    });
    const failed = new Set(checks.filter((c) => !c.passed).map((c) => c.id));
    for (const id of ["https", "indexable", "title", "structured-data", "crawlers", "mobile", "alt-text", "contact"]) {
      expect(failed.has(id)).toBe(true);
    }
    expect(scoreChecks(checks)).toBeLessThan(15);
    expect(topFixes(checks, 3).map((c) => c.weight)).toEqual([10, 10, 10]);
  });
});

describe("robotsBlocks", () => {
  it("uses the most specific group", () => {
    const txt = "User-agent: *\nDisallow: /\n\nUser-agent: ClaudeBot\nAllow: /";
    expect(robotsBlocks(txt, "ClaudeBot")).toBe(false);
    expect(robotsBlocks(txt, "GPTBot")).toBe(true);
  });
  it("ignores partial disallows and comments", () => {
    expect(robotsBlocks("User-agent: * # all\nDisallow: /admin", "GPTBot")).toBe(false);
    expect(robotsBlocks("", "GPTBot")).toBe(false);
  });
  it("handles grouped user-agents", () => {
    const txt = "User-agent: GPTBot\nUser-agent: PerplexityBot\nDisallow: /";
    expect(robotsBlocks(txt, "PerplexityBot")).toBe(true);
    expect(robotsBlocks(txt, "ClaudeBot")).toBe(false);
  });
});

describe("normalizeWebsite / isPrivateAddress", () => {
  it("adds https and rejects junk", () => {
    expect(normalizeWebsite("acme.com")?.toString()).toBe("https://acme.com/");
    expect(normalizeWebsite("http://acme.com/x")?.protocol).toBe("http:");
    expect(normalizeWebsite("ftp://acme.com")).toBeNull();
    expect(normalizeWebsite("localhost")).toBeNull();
    expect(normalizeWebsite("https://user:pw@acme.com")).toBeNull();
    expect(normalizeWebsite("")).toBeNull();
  });
  it("detects private ranges", () => {
    for (const ip of ["127.0.0.1", "10.1.2.3", "172.20.0.1", "192.168.1.1", "169.254.169.254", "::1", "fd00::1", "::ffff:10.0.0.1", "100.64.0.1"]) {
      expect(isPrivateAddress(ip)).toBe(true);
    }
    for (const ip of ["8.8.8.8", "172.32.0.1", "2606:4700::1111"]) expect(isPrivateAddress(ip)).toBe(false);
  });
});
