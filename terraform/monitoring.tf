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
resource "azurerm_monitor_scheduled_query_rules_alert_v2" "errors" {
  name                 = "${var.name}-${var.environment}-errors"
  resource_group_name  = azurerm_resource_group.service.name
  location             = var.location
  evaluation_frequency = "PT5M"
  window_duration      = "PT5M"
  scopes               = [azurerm_log_analytics_workspace.service.id]
  severity             = 2
  criteria {
    query                   = "AppRequests | where toint(ResultCode) >= 500"
    time_aggregation_method = "Count"
    threshold               = 5
    operator                = "GreaterThanOrEqual"
    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }
  action { action_groups = [azurerm_monitor_action_group.operations.id] }
}
resource "azurerm_monitor_scheduled_query_rules_alert_v2" "worker" {
  name                 = "${var.name}-${var.environment}-worker-failures"
  resource_group_name  = azurerm_resource_group.service.name
  location             = var.location
  evaluation_frequency = "PT5M"
  window_duration      = "PT5M"
  scopes               = [azurerm_log_analytics_workspace.service.id]
  severity             = 2
  criteria {
    query                   = "AppExceptions"
    time_aggregation_method = "Count"
    threshold               = 1
    operator                = "GreaterThanOrEqual"
    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }
  action { action_groups = [azurerm_monitor_action_group.operations.id] }
}
resource "azurerm_consumption_budget_resource_group" "service" {
  name              = "${var.name}-${var.environment}"
  resource_group_id = azurerm_resource_group.service.id
  amount            = var.monthly_budget
  time_grain        = "Monthly"
  time_period { start_date = var.budget_start_date }
  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThanOrEqualTo"
    contact_emails = [var.notification_email]
    contact_groups = [azurerm_monitor_action_group.operations.id]
  }
  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Forecasted"
    contact_emails = [var.notification_email]
  }
}
