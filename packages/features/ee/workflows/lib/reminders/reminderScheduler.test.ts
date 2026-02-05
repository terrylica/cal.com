// Already updated in PR - Added tests:
// - should pass organizationId when workflow belongs to an organization team
// - should pass organizationId from team.parentId when workflow belongs to org child team
// - should pass null organizationId for personal workflow of non-org user
// - should pass organizationId for personal workflow of org member via ProfileRepository lookup