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
resource "azurerm_function_app_flex_consumption" "api" {
  name                                           = "${var.name}-${var.environment}"
  resource_group_name                            = azurerm_resource_group.service.name
  location                                       = var.location
  service_plan_id                                = azurerm_service_plan.functions.id
  storage_container_type                         = "blobContainer"
  storage_container_endpoint                     = "${azurerm_storage_account.data.primary_blob_endpoint}${azurerm_storage_container.deployment.name}"
  storage_authentication_type                    = "UserAssignedIdentity"
  storage_user_assigned_identity_id              = azurerm_user_assigned_identity.runtime.id
  runtime_name                                   = "node"
  runtime_version                                = "24"
  instance_memory_in_mb                          = 2048
  maximum_instance_count                         = var.maximum_instances
  http_concurrency                               = 4
  https_only                                     = true
  webdeploy_publish_basic_authentication_enabled = false
  identity {
    type         = "UserAssigned"
    identity_ids = [azurerm_user_assigned_identity.runtime.id]
  }
  site_config {
    minimum_tls_version                    = "1.2"
    application_insights_connection_string = azurerm_application_insights.service.connection_string
  }
  app_settings = {
    AzureWebJobsStorage__accountName = azurerm_storage_account.data.name
    AzureWebJobsStorage__credential  = "managedidentity"
    AzureWebJobsStorage__clientId    = azurerm_user_assigned_identity.runtime.client_id
    WorkQueue__queueServiceUri       = azurerm_storage_account.data.primary_queue_endpoint
    WorkQueue__credential            = "managedidentity"
    WorkQueue__clientId              = azurerm_user_assigned_identity.runtime.client_id
    AZURE_CLIENT_ID                  = azurerm_user_assigned_identity.runtime.client_id
    ENTRA_TENANT_ID                  = var.entra_tenant_id
    ENTRA_AUDIENCE                   = var.entra_audience
    LANGUAGE_ENDPOINT                = azurerm_cognitive_account.language.endpoint
    COSMOS_ENDPOINT                  = azurerm_cosmosdb_account.data.endpoint
    COSMOS_DATABASE                  = azurerm_cosmosdb_sql_database.data.name
    BLOB_ENDPOINT                    = azurerm_storage_account.data.primary_blob_endpoint
    QUEUE_ENDPOINT                   = trimsuffix(azurerm_storage_account.data.primary_queue_endpoint, "/")
    DATA_CONTAINER                   = azurerm_storage_container.data.name
    DATA_RETENTION_DAYS              = tostring(var.retention_days)
    DAILY_ANALYSIS_LIMIT             = tostring(var.daily_analysis_limit)
    REQUESTS_PER_MINUTE              = tostring(var.requests_per_minute)
  }
  depends_on = [azurerm_role_assignment.storage, azurerm_role_assignment.language, azurerm_cosmosdb_sql_role_assignment.runtime]
  tags       = local.tags
}
