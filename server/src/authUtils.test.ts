import assert from "node:assert/strict";
import test from "node:test";
import {
    isQueueWaitTimeoutError,
    isValidPasswordInput,
    parseTokenSubject,
} from "./authUtils";

test("parseTokenSubject supports numeric and string sub", () => {
    assert.equal(parseTokenSubject({ sub: 10 }), 10);
    assert.equal(parseTokenSubject({ sub: "42" }), 42);
});

test("parseTokenSubject rejects invalid values", () => {
    assert.equal(parseTokenSubject(null), null);
    assert.equal(parseTokenSubject({}), null);
    assert.equal(parseTokenSubject({ sub: -1 }), null);
    assert.equal(parseTokenSubject({ sub: "abc" }), null);
});

test("isValidPasswordInput enforces min/max and non-whitespace", () => {
    const limits = { min: 8, max: 12 };
    assert.equal(isValidPasswordInput("abc12345", limits), true);
    assert.equal(isValidPasswordInput("short", limits), false);
    assert.equal(isValidPasswordInput("way-too-long-password", limits), false);
    assert.equal(isValidPasswordInput("        ", limits), false);
});

test("isQueueWaitTimeoutError detects timeout messages", () => {
    assert.equal(
        isQueueWaitTimeoutError(new Error("job timed out after 20000ms")),
        true,
    );
    assert.equal(isQueueWaitTimeoutError(new Error("other failure")), false);
    assert.equal(isQueueWaitTimeoutError("timed out"), false);
});
