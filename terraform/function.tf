resource "azurerm_service_plan" "functions" {
  name                = "${var.name}-${var.environment}"
  resource_group_name = azurerm_resource_group.service.name
  location            = var.location
  os_type             = "Linux"
  sku_name            = "FC1"
  tags                = local.tags
}
