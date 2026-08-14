mock_provider "azurerm" {}
variables {
  name               = "sentimenttest"
  location           = "eastus"
  entra_tenant_id    = "00000000-0000-0000-0000-000000000001"
  entra_audience     = "00000000-0000-0000-0000-000000000002"
  notification_email = "owner@example.com"
  budget_start_date  = "2026-10-01T00:00:00Z"
}
run "secure_defaults" {
  command = plan
  assert {
    condition     = azurerm_function_app_flex_consumption.api.https_only && azurerm_function_app_flex_consumption.api.storage_authentication_type == "UserAssignedIdentity"
    error_message = "Functions must require TLS and identity-based deployment storage."
  }
  assert {
    condition     = !azurerm_storage_account.data.shared_access_key_enabled && !azurerm_storage_account.data.allow_nested_items_to_be_public
    error_message = "Storage must disable keys and public blobs."
  }
  assert {
    condition     = azurerm_cosmosdb_account.data.local_authentication_disabled && azurerm_cognitive_account.language.local_auth_enabled == false
    error_message = "Cosmos and Language must use Entra identities."
  }
  assert {
    condition     = azurerm_cosmosdb_sql_container.items.partition_key_paths == tolist(["/tenantId"])
    error_message = "Tenant partitioning is required for quota transactions."
  }
  assert {
    condition     = azurerm_storage_management_policy.retention.rule[0].filters[0].prefix_match == toset(["feedback/"])
    error_message = "Retention must never delete deployment blobs."
  }
}
