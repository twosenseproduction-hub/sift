import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { dailySiftSharePath, dailySiftShareUrl } from "./daily-sift-url";

describe("dailySiftShareUrl", () => {
  it("strips trailing slash from base", () => {
    assert.equal(
      dailySiftShareUrl(1, "https://app.siftnow.io/"),
      "https://app.siftnow.io/#/daily-sift/1",
    );
  });

  it("uses hash path convention", () => {
    assert.equal(dailySiftSharePath(300), "/daily-sift/300");
  });
});
