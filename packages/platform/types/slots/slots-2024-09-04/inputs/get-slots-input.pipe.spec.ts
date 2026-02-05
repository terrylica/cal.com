import { BadRequestException } from "@nestjs/common";

import { GetSlotsInputPipe } from "./get-slots-input.pipe";

describe("GetSlotsInputPipe", () => {
  let pipe: GetSlotsInputPipe;

  beforeEach(() => {
    pipe = new GetSlotsInputPipe();
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
  });

  describe("null prototype object handling", () => {
    it("should handle objects created with Object.create(null) for eventTypeId", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.eventTypeId = 123;
      nullPrototypeObj.startTime = "2024-01-01";
      nullPrototypeObj.endTime = "2024-01-07";

      // Should NOT throw "hasOwnProperty is not a function"
      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle objects created with Object.create(null) for username and eventTypeSlug", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.username = "testuser";
      nullPrototypeObj.eventTypeSlug = "test-event";
      nullPrototypeObj.startTime = "2024-01-01";
      nullPrototypeObj.endTime = "2024-01-07";

      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle objects created with Object.create(null) for teamSlug and eventTypeSlug", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.teamSlug = "test-team";
      nullPrototypeObj.eventTypeSlug = "test-event";
      nullPrototypeObj.startTime = "2024-01-01";
      nullPrototypeObj.endTime = "2024-01-07";

      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle JSON.parse output correctly", () => {
      const jsonInput = JSON.parse(
        '{"eventTypeId": 123, "startTime": "2024-01-01", "endTime": "2024-01-07"}'
      );

      expect(() => pipe.transform(jsonInput as any)).not.toThrow(TypeError);
    });
  });

  describe("isById detection", () => {
    it("should detect by ID when eventTypeId is present", () => {
      const input = {
        eventTypeId: 123,
        startTime: "2024-01-01",
        endTime: "2024-01-07",
      };

      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });

    it("should handle null prototype object with eventTypeId", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.eventTypeId = 456;
      nullPrototypeObj.startTime = "2024-01-01";
      nullPrototypeObj.endTime = "2024-01-07";

      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });
  });

  describe("isByUsernameAndEventTypeSlug detection", () => {
    it("should detect by username and event type slug", () => {
      const input = {
        username: "testuser",
        eventTypeSlug: "test-event",
        startTime: "2024-01-01",
        endTime: "2024-01-07",
      };

      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });

    it("should handle null prototype object with username and eventTypeSlug", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.username = "user123";
      nullPrototypeObj.eventTypeSlug = "my-event";
      nullPrototypeObj.startTime = "2024-01-01";
      nullPrototypeObj.endTime = "2024-01-07";

      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });
  });

  describe("isByTeamSlugAndEventTypeSlug detection", () => {
    it("should detect by team slug and event type slug", () => {
      const input = {
        teamSlug: "test-team",
        eventTypeSlug: "team-event",
        startTime: "2024-01-01",
        endTime: "2024-01-07",
      };

      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });

    it("should handle null prototype object with teamSlug and eventTypeSlug", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.teamSlug = "engineering";
      nullPrototypeObj.eventTypeSlug = "standup";
      nullPrototypeObj.startTime = "2024-01-01";
      nullPrototypeObj.endTime = "2024-01-07";

      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });
  });

  describe("custom prototype handling", () => {
    it("should handle objects with custom prototype", () => {
      const customProto = { customMethod: () => "test" };
      const customObj = Object.create(customProto);
      customObj.eventTypeId = 789;
      customObj.startTime = "2024-01-01";
      customObj.endTime = "2024-01-07";

      expect(() => pipe.transform(customObj as any)).not.toThrow(TypeError);
    });

    it("should handle objects with shadowed hasOwnProperty", () => {
      const input = {
        eventTypeId: 123,
        startTime: "2024-01-01",
        endTime: "2024-01-07",
        hasOwnProperty: "shadowed", // This would break direct hasOwnProperty calls
      };

      // The safe hasOwnProperty call should still work
      expect(() => pipe.transform(input as any)).not.toThrow(TypeError);
    });
  });

  describe("edge cases", () => {
    it("should handle empty object", () => {
      const nullPrototypeObj = Object.create(null);

      // Empty object should fall through to validateByUsernames which will fail validation
      // but should NOT throw TypeError
      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });

    it("should handle object with only startTime and endTime", () => {
      const nullPrototypeObj = Object.create(null);
      nullPrototypeObj.startTime = "2024-01-01";
      nullPrototypeObj.endTime = "2024-01-07";

      // Should fall through to validateByUsernames
      expect(() => pipe.transform(nullPrototypeObj as any)).not.toThrow(TypeError);
    });
  });
});
