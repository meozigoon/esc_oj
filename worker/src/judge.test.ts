import assert from "node:assert/strict";
import test from "node:test";
import {
    buildOutputLimitDetail,
    extractTimeStats,
    parseGeneratedInputs,
} from "./judge";

test("parseGeneratedInputs parses JSON string array", () => {
    const parsed = parseGeneratedInputs('["1 2\\n","3 4\\n"]');
    assert.deepEqual(parsed, ["1 2\n", "3 4\n"]);
});

test("parseGeneratedInputs parses --- delimiter format", () => {
    const parsed = parseGeneratedInputs("1 2\n---\n3 4\n");
    assert.deepEqual(parsed, ["1 2", "3 4"]);
});

test("extractTimeStats removes /usr/bin/time lines and parses memory", () => {
    const raw = [
        "Maximum resident set size (kbytes): 4096",
        "Elapsed (wall clock) time (h:mm:ss or m:ss): 0:00.01",
        "runtime stderr",
    ].join("\n");
    const result = extractTimeStats(raw);
    assert.equal(result.memoryKb, 4096);
    assert.equal(result.cleanedStderr, "runtime stderr");
});

test("buildOutputLimitDetail reports truncated streams", () => {
    const detailBoth = buildOutputLimitDetail({
        code: 0,
        stdout: "",
        stderr: "",
        timedOut: false,
        stdoutTruncated: true,
        stderrTruncated: true,
    });
    assert.match(detailBoth, /표준 출력/);
    assert.match(detailBoth, /표준 에러/);
});
