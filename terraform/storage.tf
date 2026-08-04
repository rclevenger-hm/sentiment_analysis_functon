resource "azurerm_storage_account" "data" {
  name                            = "${var.name}${var.environment}"
  resource_group_name             = azurerm_resource_group.service.name
  location                        = var.location
  account_tier                    = "Standard"
  account_replication_type        = "LRS"
  min_tls_version                 = "TLS1_2"
  allow_nested_items_to_be_public = false
  shared_access_key_enabled       = false
  tags                            = local.tags
}
resource "azurerm_storage_container" "data" {
  name                  = "feedback"
  storage_account_id    = azurerm_storage_account.data.id
  container_access_type = "private"
}
resource "azurerm_storage_container" "deployment" {
  name                  = "deployment"
  storage_account_id    = azurerm_storage_account.data.id
  container_access_type = "private"
}
resource "azurerm_storage_queue" "jobs" {
  name                 = "sentiment-jobs"
  storage_account_name = azurerm_storage_account.data.name
}
