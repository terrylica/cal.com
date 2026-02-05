import { BadRequestException } from "@nestjs/common";

import { CancelBookingInputPipe } from "./cancel-booking-input.pipe";

describe("CancelBookingInputPipe", () => {
  let pipe: CancelBookingInputPipe;

  beforeEach(() => {
    pipe = new CancelBookingInputPipe();
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
      expect(() => pipe.transform("string" as any)).toThrow(BadRequestException);
      expect(() => pipe.transform("string" as any)).toThrow("Body should be an object");
    });

    it("should handle regular objects with seatUid property", () => {
      const input = {
        seatUid: "seat-123",
        cancellationReason: "Test reason",
      };

      const result = pipe.transform(input as any);
      expect(result).toHaveProperty("seatUid", "seat-123");
    });

    it("should handle regular objects without seatUid property", () => {
      const input = {
        cancellationReason: "Test reason",
      };

      const result = pipe.transform(input as any);
      expect(result).not.toHaveProperty("seatUid");
    });

    it("should handle objects created with Object.create(null)", () => {
      // Create an object without Object prototype
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.cancellationReason = "Test reason";

      // This should NOT throw "hasOwnProperty is not a function"
      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle null prototype objects with seatUid", () => {
      // Create an object without Object prototype
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.seatUid = "seat-456";
      nullPrototypeObj.cancellationReason = "Test reason";

      // This should correctly identify it as a seated booking input
      const result = pipe.transform(nullPrototypeObj as any);
      expect(result).toHaveProperty("seatUid", "seat-456");
    });

    it("should handle objects from JSON.parse correctly", () => {
      const jsonInput = JSON.parse('{"cancellationReason": "From JSON"}');

      expect(() => pipe.transform(jsonInput as any)).not.toThrow(TypeError);
    });

    it("should handle objects with custom prototype correctly", () => {
      const customProto = { customMethod: () => "test" };
      const customObj = Object.create(customProto);
      customObj.cancellationReason = "Test";

      expect(() => pipe.transform(customObj as any)).not.toThrow(TypeError);
    });
  });

  describe("isCancelSeatedBookingInput detection", () => {
    it("should detect seated booking when seatUid is present", () => {
      const input = {
        seatUid: "test-seat",
        cancellationReason: "Test",
      };

      const result = pipe.transform(input as any);
      expect(result).toHaveProperty("seatUid");
    });

    it("should detect regular booking when seatUid is absent", () => {
      const input = {
        cancellationReason: "Test",
      };

      const result = pipe.transform(input as any);
      expect(result).not.toHaveProperty("seatUid");
    });

    it("should detect regular booking when seatUid is explicitly undefined", () => {
      const input = {
        seatUid: undefined,
        cancellationReason: "Test",
      };

      // hasOwnProperty returns true even for undefined values
      const result = pipe.transform(input as any);
      expect(result).toHaveProperty("seatUid");
    });
  });
});
