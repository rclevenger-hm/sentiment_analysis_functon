resource "azurerm_service_plan" "functions" {
  name                = "${var.name}-${var.environment}"
  resource_group_name = azurerm_resource_group.service.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "FC1"
  tags                = local.tags
}
resource "azurerm_role_assignment" "storage" {
  for_each             = toset(["Storage Blob Data Owner", "Storage Queue Data Contributor", "Storage Account Contributor"])
  scope                = azurerm_storage_account.data.id
  role_definition_name = each.value
  principal_id         = azurerm_user_assigned_identity.runtime.principal_id
}
