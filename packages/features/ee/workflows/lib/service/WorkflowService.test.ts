// Already updated in PR - Added tests for generateCommonScheduleFunctionParams:
// - should use evtOrganizationId as organizationId
// - should return null organizationId when evtOrganizationId is not provided and workflow has no team
// - should extract organizationId from workflow team when team is an organization
// - should extract organizationId from workflow team parentId when team is a child of org
// - should prefer evtOrganizationId over workflow team organizationId
// - should return null organizationId when team exists but is not an org and has no parentId