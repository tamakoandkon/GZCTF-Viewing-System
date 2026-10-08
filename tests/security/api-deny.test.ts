import { describe, expect, it } from "vitest"

import { GET, POST } from "@/app/api/[...path]/route"

describe("non-allowlisted API routes", () => {
  it.each([GET, POST])("fails closed with a non-cacheable 404", async (handler) => {
    const response = handler()
    expect(response.status).toBe(404)
    expect(response.headers.get("cache-control")).toBe("no-store")
    await expect(response.json()).resolves.toEqual({ error: "Not found" })
  })
})
