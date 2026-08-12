variable "name" {
  type = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{4,16}$", var.name))
    error_message = "Use 5–17 lowercase alphanumeric characters, starting with a letter; names must be globally unique."
  }
}
variable "environment" {
  type    = string
  default = "dev"
  validation {
    condition     = contains(["dev", "stage", "prod"], var.environment)
    error_message = "Choose dev, stage, or prod."
  }
}
variable "location" { type = string }
variable "entra_tenant_id" {
  type = string
  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.entra_tenant_id))
    error_message = "Provide the Entra directory GUID."
  }
}
variable "entra_audience" {
  type = string
  validation {
    condition     = can(regex("^[0-9a-fA-F-]{36}$", var.entra_audience))
    error_message = "Provide the v2 API application client GUID."
  }
}
variable "notification_email" {
  type = string
  validation {
    condition     = can(regex("^[^@ ]+@[^@ ]+\\.[^@ ]+$", var.notification_email))
    error_message = "Provide an email for operational and budget alerts."
  }
}
variable "daily_analysis_limit" {
  type    = number
  default = 1000
  validation {
    condition     = var.daily_analysis_limit >= 1 && var.daily_analysis_limit <= 100000 && floor(var.daily_analysis_limit) == var.daily_analysis_limit
    error_message = "Daily limit must be an integer from 1 to 100000."
  }
}
variable "requests_per_minute" {
  type    = number
  default = 60
  validation {
    condition     = var.requests_per_minute >= 1 && var.requests_per_minute <= 1000 && floor(var.requests_per_minute) == var.requests_per_minute
    error_message = "Rate must be an integer from 1 to 1000."
  }
}
variable "retention_days" {
  type    = number
  default = 30
  validation {
    condition     = var.retention_days >= 1 && var.retention_days <= 365 && floor(var.retention_days) == var.retention_days
    error_message = "Retention must be 1–365 whole days."
  }
}
variable "maximum_instances" {
  type    = number
  default = 40
  validation {
    condition     = var.maximum_instances >= 40 && var.maximum_instances <= 100 && floor(var.maximum_instances) == var.maximum_instances
    error_message = "Set a bounded Flex scale ceiling of 40–100 instances."
  }
}
