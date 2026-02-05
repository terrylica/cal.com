import type { SecretEnvelopeV1 } from "@calcom/lib/crypto/keyring";
import { decryptSecret, encryptSecret } from "@calcom/lib/crypto/keyring";
import { ErrorCode } from "@calcom/lib/errorCodes";
import { ErrorWithCode } from "@calcom/lib/errors";
import type { TFunction } from "i18next";

import type {
  CreateSmtpConfigurationInput,
  SmtpConfigurationPublic,
  SmtpConfigurationRepository,
  SmtpConfigurationWithCredentials,
} from "../../repositories/SmtpConfigurationRepository";
import type { SmtpService } from "./SmtpService";

const SMTP_KEYRING = "SMTP" as const;

export interface CreateSmtpConfigurationParams {
  organizationId: number;
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
}

export interface SmtpEmailConfig {
  fromEmail: string;
  fromName: string;
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassword: string;
  smtpSecure: boolean;
}

export interface ISmtpConfigurationServiceDeps {
  repository: SmtpConfigurationRepository;
  smtpService: SmtpService;
}

export class SmtpConfigurationService {
  constructor(private readonly deps: ISmtpConfigurationServiceDeps) {}

  private get repository(): SmtpConfigurationRepository {
    return this.deps.repository;
  }

  private get smtpService(): SmtpService {
    return this.deps.smtpService;
  }

  private encryptCredentials(
    user: string,
    password: string,
    organizationId: number
  ): { user: string; password: string } {
    const aad = { organizationId };
    return {
      user: JSON.stringify(encryptSecret({ ring: SMTP_KEYRING, plaintext: user, aad })),
      password: JSON.stringify(encryptSecret({ ring: SMTP_KEYRING, plaintext: password, aad })),
    };
  }

  private decryptCredentials(
    encryptedUser: string,
    encryptedPassword: string,
    organizationId: number
  ): { user: string; password: string } {
    const aad = { organizationId };
    return {
      user: decryptSecret({ envelope: JSON.parse(encryptedUser) as SecretEnvelopeV1, aad }),
      password: decryptSecret({ envelope: JSON.parse(encryptedPassword) as SecretEnvelopeV1, aad }),
    };
  }

  async create(params: CreateSmtpConfigurationParams): Promise<SmtpConfigurationPublic> {
    const exists = await this.repository.existsByOrgAndEmail(params.organizationId, params.fromEmail);
    if (exists) {
      throw new ErrorWithCode(ErrorCode.BadRequest, "SMTP configuration already exists for this email");
    }

    const encrypted = this.encryptCredentials(params.smtpUser, params.smtpPassword, params.organizationId);

    const input: CreateSmtpConfigurationInput = {
      organizationId: params.organizationId,
      fromEmail: params.fromEmail,
      fromName: params.fromName,
      smtpHost: params.smtpHost,
      smtpPort: params.smtpPort,
      smtpUser: encrypted.user,
      smtpPassword: encrypted.password,
      smtpSecure: params.smtpSecure,
    };

    const config = await this.repository.create(input);
    return this.toPublic(config);
  }

  async delete(id: number, organizationId: number): Promise<void> {
    const config = await this.repository.findById(id);
    if (!config) {
      throw new ErrorWithCode(ErrorCode.NotFound, "SMTP configuration not found");
    }
    if (config.organizationId !== organizationId) {
      throw new ErrorWithCode(ErrorCode.Forbidden, "Not authorized to delete this SMTP configuration");
    }

    await this.repository.delete(id);
  }

  async toggleEnabled(
    id: number,
    organizationId: number,
    isEnabled: boolean
  ): Promise<SmtpConfigurationPublic> {
    const config = await this.repository.findById(id);
    if (!config) {
      throw new ErrorWithCode(ErrorCode.NotFound, "SMTP configuration not found");
    }
    if (config.organizationId !== organizationId) {
      throw new ErrorWithCode(ErrorCode.Forbidden, "Not authorized to update this SMTP configuration");
    }

    const updated = await this.repository.setEnabled(id, organizationId, isEnabled);
    return this.toPublic(updated);
  }

  async listByOrganization(organizationId: number): Promise<SmtpConfigurationPublic[]> {
    return this.repository.findByOrgId(organizationId);
  }

  async getById(id: number, organizationId: number): Promise<SmtpConfigurationPublic | null> {
    const config = await this.repository.findByIdPublic(id);
    if (!config || config.organizationId !== organizationId) {
      return null;
    }
    return config;
  }

  async getActiveConfigForOrg(organizationId: number): Promise<SmtpEmailConfig | null> {
    const config = await this.repository.findFirstEnabledByOrgId(organizationId);
    if (!config) {
      return null;
    }

    const { user, password } = this.decryptCredentials(
      config.smtpUser,
      config.smtpPassword,
      config.organizationId
    );

    return {
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      smtpHost: config.smtpHost,
      smtpPort: config.smtpPort,
      smtpUser: user,
      smtpPassword: password,
      smtpSecure: config.smtpSecure,
    };
  }

  async sendTestEmail(
    id: number,
    organizationId: number,
    toEmail: string,
    language: TFunction
  ): Promise<{ success: boolean; error?: string }> {
    const config = await this.repository.findById(id);
    if (!config) {
      throw new ErrorWithCode(ErrorCode.NotFound, "SMTP configuration not found");
    }
    if (config.organizationId !== organizationId) {
      throw new ErrorWithCode(ErrorCode.Forbidden, "Not authorized to test this SMTP configuration");
    }

    const { user, password } = this.decryptCredentials(
      config.smtpUser,
      config.smtpPassword,
      config.organizationId
    );

    return this.smtpService.sendTestEmail({
      config: {
        host: config.smtpHost,
        port: config.smtpPort,
        user,
        password,
        secure: config.smtpSecure,
      },
      fromEmail: config.fromEmail,
      fromName: config.fromName,
      toEmail,
      language,
    });
  }

  private toPublic(config: SmtpConfigurationWithCredentials): SmtpConfigurationPublic {
    const { smtpPassword: _p, ...publicFields } = config;
    return publicFields;
  }
}
