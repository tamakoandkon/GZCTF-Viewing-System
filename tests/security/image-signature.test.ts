import { describe, expect, it } from "vitest"

import { detectSafeImageContentType } from "@/lib/image-signature"

function bytes(...values: number[]): ArrayBuffer {
  return Uint8Array.from(values).buffer
}

describe("poster image signature detection", () => {
  it("accepts supported image signatures", () => {
    expect(detectSafeImageContentType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png")
    expect(detectSafeImageContentType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg")
    expect(
      detectSafeImageContentType(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50)),
    ).toBe("image/webp")
  })

  it("rejects arbitrary binary and HTML", () => {
    expect(detectSafeImageContentType(bytes(0, 1, 2, 3))).toBeNull()
    expect(detectSafeImageContentType(new TextEncoder().encode("<script>alert(1)</script>").buffer)).toBeNull()
  })
})
