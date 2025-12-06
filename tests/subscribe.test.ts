import { assertEquals } from "@std/assert";
import { STATUS_CODE } from "@std/http";

const BASE_URL = "http://localhost:8000";
const TEST_EMAIL = "support@virtualdns.io";

Deno.test("POST /subscribe - should successfully subscribe vip@virtualdns.io", async () => {
  // Generate a unique UUID for the x-i header (required for rate limiting)
  const uniqueId = crypto.randomUUID();

  const response = await fetch(`${BASE_URL}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-i": uniqueId,
      "Accept-Language": "en",
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      cta: "tester",
      refer: "x",
    }),
  });

  // Assert that the subscription was created successfully
  assertEquals(
    response.status,
    STATUS_CODE.Created,
    "Expected status code 201 (Created)"
  );

  // Parse the response body
  const data = await response.json();

  // The response should be an empty object on success
  assertEquals(data, {}, "Expected empty response body");
});

Deno.test(`POST /subscribe - should return 409 if ${TEST_EMAIL} already subscribed`, async () => {
  // Generate a unique UUID for the x-i header
  const uniqueId = crypto.randomUUID();

  // First subscription attempt
  const firstResponse = await fetch(`${BASE_URL}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-i": uniqueId,
      "Accept-Language": "en",
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      cta: "tester",
    }),
  });

  await firstResponse.text();
  // Wait a second to avoid rate limiting
  await new Promise((resolve) => setTimeout(resolve, 1000));

  // Generate a new UUID for the second request
  const secondUniqueId = crypto.randomUUID();

  // Second subscription attempt with the same email
  const secondResponse = await fetch(`${BASE_URL}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-i": secondUniqueId,
      "Accept-Language": "en",
    },
    body: JSON.stringify({
      email: TEST_EMAIL,
      cta: "adopter",
    }),
  });

  await secondResponse.text();
  // Assert that duplicate subscription returns Conflict status
  assertEquals(
    secondResponse.status,
    STATUS_CODE.Conflict,
    "Expected status code 409 (Conflict) for duplicate email"
  );
});

Deno.test("POST /subscribe - should validate email format", async () => {
  const uniqueId = crypto.randomUUID();

  const response = await fetch(`${BASE_URL}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-i": uniqueId,
    },
    body: JSON.stringify({
      email: "invalid-email",
      cta: "interested",
    }),
  });

  await response.text();
  // Assert that invalid email returns Bad Request status
  assertEquals(
    response.status,
    STATUS_CODE.BadRequest,
    "Expected status code 400 (Bad Request) for invalid email"
  );
});

Deno.test("POST /subscribe - should require x-i header", async () => {
  const response = await fetch(`${BASE_URL}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Missing x-i header
    },
    body: JSON.stringify({
      email: "test@example.com",
      cta: "interested",
    }),
  });

  await response.text();
  // Assert that missing x-i header returns Bad Request status
  assertEquals(
    response.status,
    STATUS_CODE.BadRequest,
    "Expected status code 400 (Bad Request) for missing x-i header"
  );
});

Deno.test("POST /subscribe - should validate cta values", async () => {
  const uniqueId = crypto.randomUUID();

  const response = await fetch(`${BASE_URL}/subscribe`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-i": uniqueId,
    },
    body: JSON.stringify({
      email: "test@example.com",
      cta: "invalid-cta",
    }),
  });

  await response.text();
  // Assert that invalid cta returns Bad Request status
  assertEquals(
    response.status,
    STATUS_CODE.BadRequest,
    "Expected status code 400 (Bad Request) for invalid cta value"
  );
});

Deno.test("POST /subscribe - should accept all valid cta options", async () => {
  const ctaOptions = ["interested", "tester", "adopter"];

  for (const cta of ctaOptions) {
    const uniqueId = crypto.randomUUID();
    const testEmail = `test-${cta}-${Date.now()}@example.com`;

    const response = await fetch(`${BASE_URL}/subscribe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-i": uniqueId,
      },
      body: JSON.stringify({
        email: testEmail,
        cta: cta,
      }),
    });

    await response.text();
    // Assert that valid cta option is accepted
    assertEquals(
      response.status,
      STATUS_CODE.Created,
      `Expected status code 201 (Created) for cta: ${cta}`
    );

    // Wait to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
});
