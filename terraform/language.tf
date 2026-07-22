resource "azurerm_cognitive_account" "language" {
  name                          = "${var.name}-${var.environment}"
  resource_group_name           = azurerm_resource_group.service.name
  location                      = var.location
  kind                          = "TextAnalytics"
  sku_name                      = "S"
  custom_subdomain_name         = "${var.name}-${var.environment}"
  local_auth_enabled            = false
  public_network_access_enabled = true
  tags                          = local.tags
}
resource "azurerm_role_assignment" "language" {
  scope                = azurerm_cognitive_account.language.id
  role_definition_name = "Cognitive Services User"
  principal_id         = azurerm_user_assigned_identity.runtime.principal_id
}
