import { EMAIL_FROM_NAME } from "@calcom/lib/constants";
import renderEmail from "../src/renderEmail";
import BaseEmail from "./_base-email";

export interface AccountLockedEmailInput {
  user: {
    name: string | null;
    email: string;
  };
  reason: string;
  supportUrl: string;
}

export default class AccountLockedEmail extends BaseEmail {
  private input: AccountLockedEmailInput;

  constructor(input: AccountLockedEmailInput) {
    super();
    this.name = "SEND_ACCOUNT_LOCKED";
    this.input = input;
  }

  protected async getNodeMailerPayload(): Promise<Record<string, unknown>> {
    return {
      from: `${EMAIL_FROM_NAME} <${this.getMailerOptions().from}>`,
      to: this.input.user.email,
      subject: "Your Cal.com account has been locked",
      html: await renderEmail("AccountLockedEmail", {
        user: {
          name: this.input.user.name || "",
          email: this.input.user.email,
        },
        reason: this.input.reason,
        supportUrl: this.input.supportUrl,
      }),
      text: this.getTextBody(),
    };
  }

  protected getTextBody(): string {
    return `Your Cal.com account has been locked. Reason: ${this.input.reason}. If you believe this was done in error, please contact support at ${this.input.supportUrl}`;
  }
}
