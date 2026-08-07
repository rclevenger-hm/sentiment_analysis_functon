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
