resource "azurerm_log_analytics_workspace" "service" {
  name                = "${var.name}-${var.environment}"
  resource_group_name = azurerm_resource_group.service.name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 1
  tags                = local.tags
}
