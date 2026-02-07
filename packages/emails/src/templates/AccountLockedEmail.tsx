import { CallToAction, V2BaseEmailHtml } from "../components";

export const AccountLockedEmail = (props: {
  user: {
    name: string;
    email: string;
  };
  reason: string;
  supportUrl: string;
}) => {
  const { user, reason, supportUrl } = props;

  return (
    <V2BaseEmailHtml subject="Your Cal.com account has been locked">
      <p style={{ fontWeight: 400, lineHeight: "24px" }}>Hi {user.name || user.email},</p>
      <p style={{ fontWeight: 400, lineHeight: "24px", marginBottom: "20px" }}>
        Your Cal.com account has been locked for the following reason:
      </p>
      <p
        style={{
          fontWeight: 600,
          lineHeight: "24px",
          marginBottom: "20px",
          padding: "12px 16px",
          backgroundColor: "#f3f4f6",
          borderRadius: "6px",
        }}>
        {reason}
      </p>
      <p style={{ fontWeight: 400, lineHeight: "24px", marginBottom: "20px" }}>
        If you believe this was done in error, please contact our support team for assistance.
      </p>
      <div style={{ textAlign: "center", marginTop: "24px" }}>
        <CallToAction label="Contact Support" href={supportUrl} endIconName="linkIcon" />
      </div>
    </V2BaseEmailHtml>
  );
};
