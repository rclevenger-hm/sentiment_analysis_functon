output "endpoint" { value = "https://${azurerm_function_app_flex_consumption.api.default_hostname}/api" }
output "function_name" { value = azurerm_function_app_flex_consumption.api.name }
