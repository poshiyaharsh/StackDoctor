import net from "node:net";
import { describe, it, expect } from "vitest";
import { checkPort } from "@stackdoctor/adapters";

describe("Port Checker Adapter (ports.ts)", () => {
  it("safely handles invalid port numbers without crashing", async () => {
    const negative = await checkPort("127.0.0.1", -5);
    expect(negative.status).toBe("invalid");
    expect(negative.conclusive).toBe(true);
    expect(negative.error).toContain("must be an integer between 1 and 65535");

    const zero = await checkPort("127.0.0.1", 0);
    expect(zero.status).toBe("invalid");

    const tooHigh = await checkPort("127.0.0.1", 70000);
    expect(tooHigh.status).toBe("invalid");

    const nonInteger = await checkPort("127.0.0.1", 3000.5);
    expect(nonInteger.status).toBe("invalid");
  });

  it("detects available ports when connection is refused", async () => {
    // Find an unused ephemeral port
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address() as net.AddressInfo;
    const testPort = address.port;
    await new Promise<void>((resolve) => server.close(() => resolve()));

    // Now testPort is free
    const result = await checkPort("127.0.0.1", testPort, 200);
    expect(result.status).toBe("available");
    expect(result.conclusive).toBe(true);
    expect(result.evidence[0]?.observed).toContain("refused");
  });

  it("detects when a port is actively in use without killing or modifying the process", async () => {
    const server = net.createServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", () => resolve()));
    const address = server.address() as net.AddressInfo;
    const activePort = address.port;

    try {
      const result = await checkPort("127.0.0.1", activePort, 400);
      expect(result.status).toBe("in_use");
      expect(typeof result.conclusive).toBe("boolean");
      if (result.conclusive) {
        expect(result.processInfo?.pid).toBeDefined();
        expect(result.evidence[0]?.observed).toContain("Evidence is conclusive");
      } else {
        expect(result.evidence[0]?.observed).toContain("not conclusive");
      }
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  });
});
