import { encryptSecret } from "@calcom/lib/crypto/keyring";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import { describe, expect, it, vi } from "vitest";
import type {
  SmtpConfigurationRepository,
  SmtpConfigurationWithCredentials,
} from "../../repositories/SmtpConfigurationRepository";
import { SmtpConfigurationService } from "./SmtpConfigurationService";
import type { SmtpService } from "./SmtpService";

const TEAM_ID = 1;
const CONFIG_ID = 10;

function encryptTestCredentials(
  user: string,
  password: string,
  teamId: number
): { user: string; password: string } {
  const aad = { teamId };
  return {
    user: JSON.stringify(encryptSecret({ ring: "SMTP", plaintext: user, aad })),
    password: JSON.stringify(encryptSecret({ ring: "SMTP", plaintext: password, aad })),
  };
}

function makeConfig(overrides?: Partial<SmtpConfigurationWithCredentials>): SmtpConfigurationWithCredentials {
  const encrypted = encryptTestCredentials("testuser", "testpass", TEAM_ID);
  return {
    id: CONFIG_ID,
    teamId: TEAM_ID,
    fromEmail: "noreply@org.com",
    fromName: "Org",
    smtpHost: "smtp.org.com",
    smtpPort: 465,
    smtpUser: encrypted.user,
    smtpPassword: encrypted.password,
    smtpSecure: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function createMockRepository(): SmtpConfigurationRepository {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findByIdPublic: vi.fn(),
    findByTeamId: vi.fn(),
    findByTeamIdWithCredentials: vi.fn(),
    delete: vi.fn(),
    existsByTeamId: vi.fn(),
    update: vi.fn(),
  } as unknown as SmtpConfigurationRepository;
}

function createMockSmtpService(): SmtpService {
  return {
    testConnection: vi.fn(),
    sendTestEmail: vi.fn(),
    createTransportOptions: vi.fn(),
  } as unknown as SmtpService;
}

function createService(
  repoOverrides?: Partial<SmtpConfigurationRepository>,
  smtpOverrides?: Partial<SmtpService>
): SmtpConfigurationService {
  const repository = { ...createMockRepository(), ...repoOverrides };
  const smtpService = { ...createMockSmtpService(), ...smtpOverrides };
  return new SmtpConfigurationService({ repository, smtpService });
}

describe("SmtpConfigurationService", () => {
  describe("create", () => {
    it("should encrypt credentials and create config", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.existsByTeamId).mockResolvedValue(false);
      vi.mocked(mockRepo.create).mockResolvedValue(makeConfig());

      const service = createService(mockRepo);
      const result = await service.create({
        teamId: TEAM_ID,
        fromEmail: "noreply@org.com",
        fromName: "Org",
        smtpHost: "smtp.org.com",
        smtpPort: 465,
        smtpUser: "testuser",
        smtpPassword: "testpass",
        smtpSecure: true,
      });

      expect(mockRepo.create).toHaveBeenCalledOnce();
      const createArg = vi.mocked(mockRepo.create).mock.calls[0][0];
      expect(createArg.smtpUser).not.toBe("testuser");
      expect(createArg.smtpPassword).not.toBe("testpass");
      expect(JSON.parse(createArg.smtpUser)).toHaveProperty("v");
      expect(result).not.toHaveProperty("smtpUser");
      expect(result).not.toHaveProperty("smtpPassword");
    });

    it("should reject duplicate config for same team", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.existsByTeamId).mockResolvedValue(true);

      const service = createService(mockRepo);
      await expect(
        service.create({
          teamId: TEAM_ID,
          fromEmail: "noreply@org.com",
          fromName: "Org",
          smtpHost: "smtp.org.com",
          smtpPort: 465,
          smtpUser: "testuser",
          smtpPassword: "testpass",
          smtpSecure: true,
        })
      ).rejects.toThrow(ErrorWithCode);
    });
  });

  describe("delete", () => {
    it("should delete config when authorized", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findById).mockResolvedValue(makeConfig());
      vi.mocked(mockRepo.delete).mockResolvedValue(undefined);

      const service = createService(mockRepo);
      await service.delete(CONFIG_ID, TEAM_ID);

      expect(mockRepo.delete).toHaveBeenCalledWith(CONFIG_ID);
    });

    it("should throw NotFound when config does not exist", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findById).mockResolvedValue(null);

      const service = createService(mockRepo);
      await expect(service.delete(CONFIG_ID, TEAM_ID)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.NotFound })
      );
    });

    it("should throw Forbidden when teamId does not match", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findById).mockResolvedValue(makeConfig({ teamId: 999 }));

      const service = createService(mockRepo);
      await expect(service.delete(CONFIG_ID, TEAM_ID)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.Forbidden })
      );
    });
  });

  describe("getConfigForOrg", () => {
    it("should return decrypted config", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findByTeamIdWithCredentials).mockResolvedValue(makeConfig());

      const service = createService(mockRepo);
      const result = await service.getConfigForOrg(TEAM_ID);

      expect(result).not.toBeNull();
      expect(result?.smtpUser).toBe("testuser");
      expect(result?.smtpPassword).toBe("testpass");
      expect(result?.fromEmail).toBe("noreply@org.com");
    });

    it("should return null when no config exists", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findByTeamIdWithCredentials).mockResolvedValue(null);

      const service = createService(mockRepo);
      const result = await service.getConfigForOrg(TEAM_ID);

      expect(result).toBeNull();
    });
  });

  describe("update", () => {
    it("should update non-credential fields without encrypting", async () => {
      const config = makeConfig();
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findById).mockResolvedValue(config);
      vi.mocked(mockRepo.update).mockResolvedValue(makeConfig({ fromEmail: "new@org.com" }));

      const service = createService(mockRepo);
      await service.update(CONFIG_ID, TEAM_ID, { fromEmail: "new@org.com" });

      const updateArg = vi.mocked(mockRepo.update).mock.calls[0][2];
      expect(updateArg.fromEmail).toBe("new@org.com");
      expect(updateArg.smtpUser).toBeUndefined();
      expect(updateArg.smtpPassword).toBeUndefined();
    });

    it("should encrypt credentials when provided", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findById).mockResolvedValue(makeConfig());
      vi.mocked(mockRepo.update).mockResolvedValue(makeConfig());

      const service = createService(mockRepo);
      await service.update(CONFIG_ID, TEAM_ID, { smtpUser: "newuser", smtpPassword: "newpass" });

      const updateArg = vi.mocked(mockRepo.update).mock.calls[0][2];
      expect(updateArg.smtpUser).toBeDefined();
      expect(updateArg.smtpUser).not.toBe("newuser");
      expect(JSON.parse(updateArg.smtpUser ?? "")).toHaveProperty("v");
      expect(updateArg.smtpPassword).toBeDefined();
      expect(JSON.parse(updateArg.smtpPassword ?? "")).toHaveProperty("v");
    });

    it("should throw Forbidden when teamId does not match", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findById).mockResolvedValue(makeConfig({ teamId: 999 }));

      const service = createService(mockRepo);
      await expect(service.update(CONFIG_ID, TEAM_ID, { fromEmail: "x@y.com" })).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.Forbidden })
      );
    });
  });

  describe("sendTestEmail", () => {
    it("should decrypt credentials and call smtpService", async () => {
      const mockRepo = createMockRepository();
      const mockSmtp = createMockSmtpService();
      vi.mocked(mockRepo.findById).mockResolvedValue(makeConfig());
      vi.mocked(mockSmtp.sendTestEmail).mockResolvedValue({ success: true });

      const service = createService(mockRepo, mockSmtp);
      const language = vi.fn() as unknown as import("i18next").TFunction;
      const result = await service.sendTestEmail(CONFIG_ID, TEAM_ID, "user@test.com", language);

      expect(result.success).toBe(true);
      expect(mockSmtp.sendTestEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          config: expect.objectContaining({ user: "testuser", password: "testpass" }),
          toEmail: "user@test.com",
        })
      );
    });

    it("should throw Forbidden when teamId does not match", async () => {
      const mockRepo = createMockRepository();
      vi.mocked(mockRepo.findById).mockResolvedValue(makeConfig({ teamId: 999 }));

      const service = createService(mockRepo);
      const language = vi.fn() as unknown as import("i18next").TFunction;
      await expect(service.sendTestEmail(CONFIG_ID, TEAM_ID, "user@test.com", language)).rejects.toThrow(
        expect.objectContaining({ code: ErrorCode.Forbidden })
      );
    });
  });
});
