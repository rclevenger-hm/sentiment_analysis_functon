resource "azurerm_cosmosdb_account" "data" {
  name                          = "${var.name}-${var.environment}"
  resource_group_name           = azurerm_resource_group.service.name
  location                      = var.location
  offer_type                    = "Standard"
  kind                          = "GlobalDocumentDB"
  local_authentication_disabled = true
  consistency_policy { consistency_level = "Session" }
  capabilities { name = "EnableServerless" }
  geo_location {
    location          = var.location
    failover_priority = 0
  }
  tags = local.tags
}
resource "azurerm_cosmosdb_sql_database" "data" {
  name                = "sentiment"
  resource_group_name = azurerm_resource_group.service.name
  account_name        = azurerm_cosmosdb_account.data.name
}
