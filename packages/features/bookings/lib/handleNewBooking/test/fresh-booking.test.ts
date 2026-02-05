// Already updated in PR - Added describe("smtp") block with tests:
// - should send booking confirmation emails via org custom SMTP when configured
// - should send booking confirmation emails via default SMTP when org has no custom SMTP
// - should send broken integration emails via org custom SMTP when video app fails
// - should send booking request emails via org custom SMTP when confirmation required
// - should send awaiting payment emails via org custom SMTP