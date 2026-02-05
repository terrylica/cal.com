/* Add this test inside describe("Field Type: phone", () => { ... }) section, after the existing phone field tests (around line 1289) */

test(`hidden required phone field should not be validated`, async () => {
  const schema = getBookingResponsesSchema({
    bookingFields: [
      {
        name: "name",
        type: "name",
        required: true,
      },
      {
        name: "email",
        type: "email",
        required: true,
      },
      {
        name: "attendeePhoneNumber",
        type: "phone",
        required: true,
        hidden: true,
      },
    ] as z.infer<typeof eventTypeBookingFields> & z.BRAND<"HAS_SYSTEM_FIELDS">,
    view: "ALL_VIEWS",
  });
  const parsedResponses = await schema.safeParseAsync({
    name: "John",
    email: "john@example.com",
    attendeePhoneNumber: "",
  });
  expect(parsedResponses.success).toBe(true);
});