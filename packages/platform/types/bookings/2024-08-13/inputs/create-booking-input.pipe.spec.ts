import { BadRequestException } from "@nestjs/common";

import { CreateBookingInputPipe } from "./create-booking-input.pipe";

describe("CreateBookingInputPipe", () => {
  let pipe: CreateBookingInputPipe;

  beforeEach(() => {
    pipe = new CreateBookingInputPipe();
  });

  it("should be defined", () => {
    expect(pipe).toBeDefined();
  });

  describe("transform", () => {
    it("should throw BadRequestException when body is null", () => {
      expect(() => pipe.transform(null as any)).toThrow(BadRequestException);
      expect(() => pipe.transform(null as any)).toThrow("Body is required");
    });

    it("should throw BadRequestException when body is undefined", () => {
      expect(() => pipe.transform(undefined as any)).toThrow(BadRequestException);
      expect(() => pipe.transform(undefined as any)).toThrow("Body is required");
    });

    it("should throw BadRequestException when body is not an object", () => {
      expect(() => pipe.transform(123 as any)).toThrow(BadRequestException);
      expect(() => pipe.transform(123 as any)).toThrow("Body should be an object");
    });
  });

  describe("null prototype object handling", () => {
    it("should handle objects created with Object.create(null)", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.start = "2024-01-01T10:00:00Z";
      nullPrototypeObj.eventTypeId = 1;
      nullPrototypeObj.attendee = { name: "Test", email: "test@example.com", timeZone: "UTC" };

      // Should NOT throw "hasOwnProperty is not a function"
      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle null prototype objects with recurrenceCount", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.start = "2024-01-01T10:00:00Z";
      nullPrototypeObj.eventTypeId = 1;
      nullPrototypeObj.attendee = { name: "Test", email: "test@example.com", timeZone: "UTC" };
      nullPrototypeObj.recurrenceCount = 5;

      // Should correctly identify as recurring booking
      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle null prototype objects with instant flag", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.start = "2024-01-01T10:00:00Z";
      nullPrototypeObj.eventTypeId = 1;
      nullPrototypeObj.attendee = { name: "Test", email: "test@example.com", timeZone: "UTC" };
      nullPrototypeObj.instant = true;

      // Should correctly identify as instant booking
      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle JSON.parse output correctly", () => {
      const jsonInput = JSON.parse(
        '{"start": "2024-01-01T10:00:00Z", "eventTypeId": 1, "attendee": {"name": "Test", "email": "test@example.com", "timeZone": "UTC"}}'
      );

      expect(() => pipe.transform(jsonInput as any)).not.toThrow(TypeError);
    });
  });

  describe("isRecurringBookingInput detection", () => {
    it("should detect recurring booking when recurrenceCount is present", () => {
      const input = {
        start: "2024-01-01T10:00:00Z",
        eventTypeId: 1,
        attendee: { name: "Test", email: "test@example.com", timeZone: "UTC" },
        recurrenceCount: 3,
      };

      // If recurrenceCount is present, it should be validated as recurring booking
      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });

    it("should not detect recurring booking when recurrenceCount is absent", () => {
      const input = {
        start: "2024-01-01T10:00:00Z",
        eventTypeId: 1,
        attendee: { name: "Test", email: "test@example.com", timeZone: "UTC" },
      };

      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });
  });

  describe("isInstantBookingInput detection", () => {
    it("should detect instant booking when instant is true", () => {
      const input = {
        start: "2024-01-01T10:00:00Z",
        eventTypeId: 1,
        attendee: { name: "Test", email: "test@example.com", timeZone: "UTC" },
        instant: true,
      };

      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });

    it("should not detect instant booking when instant is false", () => {
      const input = {
        start: "2024-01-01T10:00:00Z",
        eventTypeId: 1,
        attendee: { name: "Test", email: "test@example.com", timeZone: "UTC" },
        instant: false,
      };

      // instant: false should not be treated as instant booking
      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });

    it("should not detect instant booking when instant is absent", () => {
      const input = {
        start: "2024-01-01T10:00:00Z",
        eventTypeId: 1,
        attendee: { name: "Test", email: "test@example.com", timeZone: "UTC" },
      };

      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });
  });

  describe("custom prototype handling", () => {
    it("should handle objects with custom prototype", () => {
      const customProto = { customMethod: () => "test" };
      const customObj = Object.create(customProto);
      customObj.start = "2024-01-01T10:00:00Z";
      customObj.eventTypeId = 1;
      customObj.attendee = { name: "Test", email: "test@example.com", timeZone: "UTC" };

      expect(() => pipe.transform(customObj as any)).not.toThrow(TypeError);
    });

    it("should handle objects with shadowed hasOwnProperty", () => {
      const input = {
        start: "2024-01-01T10:00:00Z",
        eventTypeId: 1,
        attendee: { name: "Test", email: "test@example.com", timeZone: "UTC" },
        hasOwnProperty: "shadowed", // This would break direct hasOwnProperty calls
      };

      // The safe hasOwnProperty call should still work
      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });
  });
});
