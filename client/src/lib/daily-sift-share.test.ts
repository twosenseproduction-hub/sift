import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import {
  buildDailySiftShareUrl,
  copyTextToClipboard,
  dailySiftShareTitle,
  shareDailySiftLink,
} from "./daily-sift-share";
import { dailySiftSharePath, dailySiftShareUrl } from "@shared/daily-sift-url";

describe("daily-sift-url (shared)", () => {
  it("builds hash route path and full URL", () => {
    assert.equal(dailySiftSharePath(42), "/daily-sift/42");
    assert.equal(
      dailySiftShareUrl(42, "https://app.siftnow.io"),
      "https://app.siftnow.io/#/daily-sift/42",
    );
  });
});

describe("daily-sift-share", () => {
  it("builds share URL from prompt id", () => {
    assert.equal(
      buildDailySiftShareUrl(7, "https://app.siftnow.io"),
      "https://app.siftnow.io/#/daily-sift/7",
    );
  });

  it("formats share title with theme", () => {
    assert.equal(dailySiftShareTitle("Energy"), "Today from Sift · Energy");
  });

  it("uses navigator.share when available", async () => {
    const share = mock.fn(async () => undefined);
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: {
        share,
        canShare: () => true,
        clipboard: { writeText: mock.fn() },
      },
      configurable: true,
    });

    const outcome = await shareDailySiftLink(
      { promptId: 3, themeName: "Career", promptText: "What matters?" },
      { baseUrl: "https://app.siftnow.io" },
    );

    assert.equal(outcome, "shared");
    assert.equal(share.mock.calls.length, 1);
    assert.match(String(share.mock.calls[0].arguments[0]?.url), /daily-sift\/3$/);

    Object.defineProperty(globalThis, "navigator", {
      value: original,
      configurable: true,
    });
  });

  it("falls back to clipboard when share is unavailable", async () => {
    const writeText = mock.fn(async () => undefined);
    const original = globalThis.navigator;
    Object.defineProperty(globalThis, "navigator", {
      value: { clipboard: { writeText } },
      configurable: true,
    });

    const outcome = await shareDailySiftLink(
      { promptId: 9, themeName: "Identity", promptText: "Name one thing." },
      { baseUrl: "https://app.siftnow.io" },
    );

    assert.equal(outcome, "copied");
    assert.equal(writeText.mock.calls.length, 1);
    assert.equal(
      writeText.mock.calls[0].arguments[0],
      "https://app.siftnow.io/#/daily-sift/9",
    );

    Object.defineProperty(globalThis, "navigator", {
      value: original,
      configurable: true,
    });
  });

  it("copyTextToClipboard uses execCommand fallback", async () => {
    const original = globalThis.navigator;
    const originalDoc = globalThis.document;
    Object.defineProperty(globalThis, "navigator", {
      value: {},
      configurable: true,
    });

    let copied = "";
    const execCommand = mock.fn(() => {
      copied = "https://example.com/#/daily-sift/1";
      return true;
    });

    Object.defineProperty(globalThis, "document", {
      value: {
        createElement: () => ({
          value: "",
          style: {},
          setAttribute: () => undefined,
          select: () => undefined,
          remove: () => undefined,
        }),
        body: {
          appendChild: (el: { value: string }) => {
            el.value = "https://example.com/#/daily-sift/1";
          },
        },
        execCommand,
      },
      configurable: true,
    });

    await copyTextToClipboard("https://example.com/#/daily-sift/1");
    assert.equal(execCommand.mock.calls.length, 1);
    assert.equal(copied, "https://example.com/#/daily-sift/1");

    Object.defineProperty(globalThis, "navigator", {
      value: original,
      configurable: true,
    });
    Object.defineProperty(globalThis, "document", {
      value: originalDoc,
      configurable: true,
    });
  });
});
