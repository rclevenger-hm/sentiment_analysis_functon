resource "azurerm_log_analytics_workspace" "service" {
  name                = "${var.name}-${var.environment}"
  resource_group_name = azurerm_resource_group.service.name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30
  daily_quota_gb      = 1
  tags                = local.tags
}
resource "azurerm_application_insights" "service" {
  name                = "${var.name}-${var.environment}"
  resource_group_name = azurerm_resource_group.service.name
  location            = var.location
  workspace_id        = azurerm_log_analytics_workspace.service.id
  application_type    = "web"
  tags                = local.tags
}
resource "azurerm_monitor_action_group" "operations" {
  name                = "${var.name}-${var.environment}"
  resource_group_name = azurerm_resource_group.service.name
  short_name          = "sentiment"
  email_receiver {
    name          = "operations"
    email_address = var.notification_email
  }
}
