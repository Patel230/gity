import assert from "node:assert/strict";
import test from "node:test";
import { fetchWithGatewayFallback } from "./transport.ts";

const response = (status) => new Response(null, { status });

test("uses the direct fallback after a relay gateway error", async () => {
  let fallbackCalled = false;
  const result = await fetchWithGatewayFallback(
    async () => response(502),
    async () => {
      fallbackCalled = true;
      return response(200);
    },
  );

  assert.equal(result.status, 200);
  assert.equal(fallbackCalled, true);
});

test("preserves an authentication response from the fallback", async () => {
  const result = await fetchWithGatewayFallback(
    async () => response(503),
    async () => response(401),
  );

  assert.equal(result.status, 401);
});

test("keeps the relay gateway response if both transports fail", async () => {
  const result = await fetchWithGatewayFallback(
    async () => response(504),
    async () => {
      throw new Error("network down");
    },
  );

  assert.equal(result.status, 504);
});

test("does not call the fallback for a non-gateway response", async () => {
  let fallbackCalled = false;
  const result = await fetchWithGatewayFallback(
    async () => response(401),
    async () => {
      fallbackCalled = true;
      return response(200);
    },
  );

  assert.equal(result.status, 401);
  assert.equal(fallbackCalled, false);
});
