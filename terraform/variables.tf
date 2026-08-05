variable "name" {
  type = string
  validation {
    condition     = can(regex("^[a-z][a-z0-9]{4,16}$", var.name))
    error_message = "Use 5–17 lowercase alphanumeric characters, starting with a letter; names must be globally unique."
  }
}
